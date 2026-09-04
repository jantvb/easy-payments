import { inject, Injectable } from '@angular/core';
import type { Stripe } from '@stripe/stripe-js';
import { PaymentResult, normalizePaymentResult } from '../../models';
import { PaymentError } from '../../errors/payment-error';
import { EasyPaymentsConfigService } from '../../config/easy-payments-config.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { mapStripeError } from './stripe-error.mapper';
import { StripeSdkLoader } from './stripe-sdk.loader';
import {
  clearStripePendingReturn,
  clearStripeReturnParamsFromUrl,
  detectStripeReturnMethod,
  isStripeReturnAttempt,
  readStripeReturnParams,
  STRIPE_PROCESSING_DELAY_MS,
  STRIPE_PROCESSING_MAX_ATTEMPTS,
  type StripeRedirectMethod,
} from './stripe-redirect-return';

function looksLikeSecretKey(value: string): boolean {
  return /^sk_(test|live)_/i.test(value.trim());
}

function looksLikePublishableKey(value: string): boolean {
  return /^pk_(test|live)_/i.test(value.trim());
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Shared Stripe redirect recovery for Klarna / Affirm (and future BNPL methods).
 * Single source of truth so Easy Payments does not duplicate retrieve flows.
 */
@Injectable({ providedIn: 'root' })
export class StripeRedirectRecoveryService {
  private readonly configService = inject(EasyPaymentsConfigService);
  private readonly browser = inject(BrowserGuard);
  private readonly sdkLoader = inject(StripeSdkLoader);

  private stripe: Stripe | null = null;
  private loadPromise: Promise<Stripe> | null = null;
  private consumePromise: Promise<PaymentResult | null> | null = null;
  private consumed = false;

  wasReturnConsumed(): boolean {
    return this.consumed;
  }

  /**
   * Idempotent. Returns null when there is no Stripe BNPL return attempt.
   * Always clears return markers after a handled attempt (success or failure).
   */
  consumeReturn(): Promise<PaymentResult | null> {
    if (!this.consumePromise) {
      this.consumePromise = this.doConsumeReturn();
    }
    return this.consumePromise;
  }

  private async doConsumeReturn(): Promise<PaymentResult | null> {
    if (!this.browser.isBrowser || !isStripeReturnAttempt()) {
      return null;
    }

    this.consumed = true;
    const method = detectStripeReturnMethod() ?? readStripeReturnParams().method;
    const { clientSecret, redirectStatus } = readStripeReturnParams();

    try {
      if (!method) {
        throw new PaymentError({
          code: 'PAYMENT_FAILED',
          message: 'Payment return is missing method context. Please try again.',
          method: 'klarna',
          provider: 'klarna',
        });
      }

      if (redirectStatus === 'failed') {
        throw new PaymentError({
          code: 'PAYMENT_FAILED',
          message: `${methodLabel(method)} payment was not completed.`,
          method,
          provider: method,
        });
      }

      if (!clientSecret?.trim()) {
        throw new PaymentError({
          code: 'PAYMENT_FAILED',
          message: `${methodLabel(method)} return is missing payment details. Please try the payment again.`,
          method,
          provider: method,
        });
      }

      return await this.retrieveReturningPayment(method, clientSecret);
    } finally {
      clearStripePendingReturn();
      clearStripeReturnParamsFromUrl();
    }
  }

  async retrieveReturningPayment(
    method: StripeRedirectMethod,
    clientSecret: string,
  ): Promise<PaymentResult> {
    if (!clientSecret?.trim()) {
      throw new PaymentError({
        code: 'PAYMENT_FAILED',
        message: `Missing payment_intent_client_secret after ${methodLabel(method)} return.`,
        method,
        provider: method,
      });
    }

    const stripe = await this.ensureStripeLoaded();
    const secret = clientSecret.trim();
    let lastIntent: { id?: string; status?: string } | undefined;

    for (let attempt = 0; attempt < STRIPE_PROCESSING_MAX_ATTEMPTS; attempt++) {
      const { paymentIntent, error } = await stripe.retrievePaymentIntent(secret);

      if (error) {
        throw mapMethodError(method, error);
      }

      lastIntent = paymentIntent ?? undefined;
      const status = paymentIntent?.status;

      if (status === 'succeeded' || status === 'requires_capture' || status === 'canceled') {
        return this.normalizeIntent(method, paymentIntent);
      }

      if (
        status === 'requires_payment_method' ||
        status === 'requires_action' ||
        status === 'requires_confirmation'
      ) {
        return this.normalizeIntent(method, paymentIntent);
      }

      if (status === 'processing') {
        if (attempt < STRIPE_PROCESSING_MAX_ATTEMPTS - 1) {
          await delay(STRIPE_PROCESSING_DELAY_MS);
          continue;
        }
        throw new PaymentError({
          code: 'PAYMENT_FAILED',
          message: `${methodLabel(method)} payment is still processing. Please refresh or check your email for confirmation.`,
          method,
          provider: method,
          originalError: paymentIntent,
        });
      }

      return this.normalizeIntent(method, paymentIntent);
    }

    return this.normalizeIntent(method, lastIntent);
  }

  private normalizeIntent(
    method: StripeRedirectMethod,
    paymentIntent: { id?: string; status?: string } | undefined,
  ): PaymentResult {
    const status = paymentIntent?.status;

    if (status === 'succeeded' || status === 'requires_capture') {
      return normalizePaymentResult({
        status: 'success',
        method,
        provider: method,
        transactionId: paymentIntent?.id,
        message: `${methodLabel(method)} payment completed successfully.`,
        metadata: {
          stripeStatus: status,
          gateway: 'stripe',
        },
      });
    }

    if (status === 'canceled') {
      return normalizePaymentResult({
        status: 'cancelled',
        method,
        provider: method,
        transactionId: paymentIntent?.id,
        message: `${methodLabel(method)} payment was cancelled.`,
        metadata: { gateway: 'stripe' },
      });
    }

    if (status === 'requires_payment_method') {
      throw new PaymentError({
        code: 'PAYMENT_FAILED',
        message: `${methodLabel(method)} payment was not completed. Please try again.`,
        method,
        provider: method,
        originalError: paymentIntent,
      });
    }

    if (status === 'requires_action' || status === 'requires_confirmation') {
      throw new PaymentError({
        code: 'AUTHENTICATION_REQUIRED',
        message: `${methodLabel(method)} payment still requires additional customer action.`,
        method,
        provider: method,
        originalError: paymentIntent,
      });
    }

    if (status === 'processing') {
      throw new PaymentError({
        code: 'PAYMENT_FAILED',
        message: `${methodLabel(method)} payment is still processing. Please refresh or check your email for confirmation.`,
        method,
        provider: method,
        originalError: paymentIntent,
      });
    }

    throw new PaymentError({
      code: 'PAYMENT_FAILED',
      message: `Unexpected PaymentIntent status: ${status ?? 'unknown'}.`,
      method,
      provider: method,
      originalError: paymentIntent,
    });
  }

  private async ensureStripeLoaded(): Promise<Stripe> {
    if (this.stripe) {
      return this.stripe;
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const key = this.configService.getSnapshot().providers?.stripe?.publishableKey?.trim() ?? '';
    if (!key || looksLikeSecretKey(key) || !looksLikePublishableKey(key)) {
      throw new PaymentError({
        code: 'CONFIG_MISSING',
        message: 'Stripe publishableKey is missing or invalid (required for redirect recovery).',
        method: 'klarna',
        provider: 'klarna',
      });
    }

    this.loadPromise = (async () => {
      const stripe = await this.sdkLoader.load(key);
      if (!stripe) {
        throw new PaymentError({
          code: 'SDK_LOAD_FAILED',
          message: 'Stripe.js failed to initialize.',
          method: 'klarna',
          provider: 'klarna',
        });
      }
      this.stripe = stripe;
      return stripe;
    })();

    return this.loadPromise;
  }
}

function methodLabel(method: StripeRedirectMethod): string {
  return method === 'affirm' ? 'Affirm' : 'Klarna';
}

function mapMethodError(method: StripeRedirectMethod, error: unknown): PaymentError {
  const mapped = mapStripeError(error);
  return new PaymentError({
    code: mapped.code,
    message: mapped.message,
    method,
    provider: method,
    originalError: mapped.originalError ?? error,
  });
}
