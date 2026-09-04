import { inject, Injectable } from '@angular/core';
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { EasyPaymentsConfigService } from '../../config/easy-payments-config.service';
import {
  CheckoutOptions,
  PaymentContext,
  PaymentProduct,
  PaymentRequest,
  PaymentResult,
  ResolvedPaymentTheme,
  normalizePaymentResult,
} from '../../models';
import { CreateAffirmPaymentResponse } from '../../models/create-payment.model';
import { PaymentError } from '../../errors/payment-error';
import { BackendService } from '../../services/backend.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { BaseMockAdapter, BaseProviderAdapter } from '../base.adapter';
import { mapResolvedThemeToStripeAppearance } from '../stripe/stripe-appearance';
import { mapStripeError } from '../stripe/stripe-error.mapper';
import { StripeSdkLoader } from '../stripe/stripe-sdk.loader';
import { StripeRedirectRecoveryService } from '../stripe/stripe-redirect-recovery.service';
import { buildStripeReturnUrl } from '../stripe/stripe-redirect-return';
import {
  AFFIRM_PAYMENT_ELEMENT_OPTIONS,
  AffirmSessionResult,
} from './affirm.types';

/** Affirm via Stripe supports USD and CAD presentment. */
const AFFIRM_SUPPORTED_CURRENCIES = new Set(['USD', 'CAD']);

/** Stripe Affirm docs: minimum about $35 presentment (major units). */
const AFFIRM_MIN_AMOUNT = 35;

function looksLikeSecretKey(value: string): boolean {
  return /^sk_(test|live)_/i.test(value.trim());
}

function looksLikePublishableKey(value: string): boolean {
  return /^pk_(test|live)_/i.test(value.trim());
}

function mapAffirmStripeError(error: unknown): PaymentError {
  const mapped = mapStripeError(error);
  return new PaymentError({
    code: mapped.code,
    message: mapped.message,
    method: 'affirm',
    provider: 'affirm',
    originalError: mapped.originalError ?? error,
  });
}

@Injectable({ providedIn: 'root' })
export class AffirmAdapter extends BaseProviderAdapter {
  readonly provider = 'affirm' as const;

  private readonly configService = inject(EasyPaymentsConfigService);
  private readonly backend = inject(BackendService);
  private readonly browser = inject(BrowserGuard);
  private readonly sdkLoader = inject(StripeSdkLoader);
  private readonly redirectRecovery = inject(StripeRedirectRecoveryService);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private paymentElement: StripePaymentElement | null = null;
  private clientSecret: string | null = null;
  private sessionId: string | undefined;
  private paymentIntentId: string | undefined;
  private loadPromise: Promise<Stripe> | null = null;
  private confirming = false;
  private configReady = false;

  /**
   * Validates Affirm + Stripe gateway config only. Does not load Stripe.js until needed.
   */
  async initialize(): Promise<void> {
    const snapshot = this.configService.getSnapshot();
    const affirm = snapshot.providers?.affirm;
    const stripeKey = snapshot.providers?.stripe?.publishableKey?.trim() ?? '';

    if (!affirm || typeof affirm !== 'object') {
      this.configReady = false;
      this.initialized = false;
      return;
    }

    if (!stripeKey || looksLikeSecretKey(stripeKey) || !looksLikePublishableKey(stripeKey)) {
      this.configReady = false;
      this.initialized = false;
      return;
    }

    this.configReady = true;
    this.initialized = true;
  }

  async isAvailable(context: PaymentContext): Promise<boolean> {
    const snapshot = this.configService.getSnapshot();
    const key = snapshot.providers?.stripe?.publishableKey?.trim() ?? '';
    if (!snapshot.providers?.affirm || !this.configReady) {
      return false;
    }
    if (!key || looksLikeSecretKey(key) || !looksLikePublishableKey(key)) {
      return false;
    }
    if (!snapshot.backend?.affirmCreatePaymentUrl?.trim()) {
      return false;
    }
    if (!AFFIRM_SUPPORTED_CURRENCIES.has(context.product.currency)) {
      return false;
    }
    if (context.product.amount <= 0) {
      return false;
    }
    const quantity = context.product.quantity ?? 1;
    const total = context.product.amount * quantity;
    if (total < AFFIRM_MIN_AMOUNT) {
      return false;
    }
    return true;
  }

  /**
   * Interactive Affirm Payment Element flow is handled by AffirmPaymentComponent.
   * Calling createPayment directly is not supported for real Affirm payments.
   */
  async createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    throw new PaymentError({
      code: 'PROVIDER_UNAVAILABLE',
      message:
        'Affirm payments require the secure Payment Element UI. Use the affirm method inside <easy-payments>.',
      method: 'affirm',
      provider: 'affirm',
    });
  }

  async ensureStripeLoaded(): Promise<Stripe> {
    if (this.stripe) {
      return this.stripe;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    const key = this.configService.getSnapshot().providers?.stripe?.publishableKey?.trim() ?? '';
    if (!key) {
      throw new PaymentError({
        code: 'CONFIG_MISSING',
        message: 'Stripe publishableKey is missing (required for Affirm via Stripe).',
        method: 'affirm',
        provider: 'affirm',
      });
    }

    if (looksLikeSecretKey(key)) {
      throw new PaymentError({
        code: 'CONFIG_INVALID',
        message:
          'Stripe secret keys must never be used in Angular. Provide a publishable key (pk_...) only.',
        method: 'affirm',
        provider: 'affirm',
      });
    }

    if (!looksLikePublishableKey(key)) {
      throw new PaymentError({
        code: 'CONFIG_INVALID',
        message: 'Stripe publishableKey appears invalid. Expected a pk_test_... or pk_live_... value.',
        method: 'affirm',
        provider: 'affirm',
      });
    }

    if (!this.browser.isBrowser) {
      throw new PaymentError({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Stripe.js can only load in the browser.',
        method: 'affirm',
        provider: 'affirm',
      });
    }

    this.loadPromise = (async () => {
      try {
        const stripe = await this.sdkLoader.load(key);
        if (!stripe) {
          throw new PaymentError({
            code: 'SDK_LOAD_FAILED',
            message: 'Stripe.js failed to initialize.',
            method: 'affirm',
            provider: 'affirm',
          });
        }
        this.stripe = stripe;
        return stripe;
      } catch (error) {
        this.loadPromise = null;
        if (error instanceof PaymentError) {
          throw error;
        }
        throw new PaymentError({
          code: 'SDK_LOAD_FAILED',
          message: 'Stripe.js failed to load.',
          method: 'affirm',
          provider: 'affirm',
          originalError: error,
        });
      }
    })();

    return this.loadPromise;
  }

  async createPaymentSession(
    product: PaymentProduct,
    _checkout?: CheckoutOptions,
  ): Promise<AffirmSessionResult> {
    if (!this.configService.getSnapshot().backend?.affirmCreatePaymentUrl?.trim()) {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend affirmCreatePaymentUrl is not configured.',
        method: 'affirm',
        provider: 'affirm',
      });
    }

    const response = await this.backend.createAffirmPayment({
      productId: product.id,
      quantity: product.quantity ?? 1,
      currency: product.currency,
    });
    this.assertValidAffirmResponse(response);

    this.clientSecret = response.clientSecret;
    this.sessionId = response.sessionId;
    this.paymentIntentId = response.paymentIntentId;

    return {
      clientSecret: response.clientSecret,
      sessionId: response.sessionId,
      paymentIntentId: response.paymentIntentId,
    };
  }

  async mountPaymentElement(
    container: HTMLElement,
    clientSecret: string,
    theme: ResolvedPaymentTheme,
  ): Promise<void> {
    const stripe = await this.ensureStripeLoaded();

    this.unmountPaymentElement();

    try {
      this.clientSecret = clientSecret;
      this.elements = stripe.elements({
        clientSecret,
        appearance: mapResolvedThemeToStripeAppearance(theme),
      });

      this.paymentElement = this.elements.create('payment', AFFIRM_PAYMENT_ELEMENT_OPTIONS);
      this.paymentElement.mount(container);
    } catch (error) {
      throw new PaymentError({
        code: 'SDK_LOAD_FAILED',
        message: 'Affirm Payment Element failed to initialize.',
        method: 'affirm',
        provider: 'affirm',
        originalError: error,
      });
    }
  }

  async updateAppearance(theme: ResolvedPaymentTheme): Promise<void> {
    if (!this.elements) {
      return;
    }
    this.elements.update({
      appearance: mapResolvedThemeToStripeAppearance(theme),
    });
  }

  async confirmPayment(returnUrl?: string): Promise<PaymentResult> {
    if (this.confirming) {
      throw new PaymentError({
        code: 'PAYMENT_FAILED',
        message: 'An Affirm payment confirmation is already in progress.',
        method: 'affirm',
        provider: 'affirm',
      });
    }

    this.confirming = true;

    try {
      const stripe = await this.ensureStripeLoaded();
      if (!this.elements) {
        throw new PaymentError({
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Affirm Payment Element is not ready.',
          method: 'affirm',
          provider: 'affirm',
        });
      }

      const { error: submitError } = await this.elements.submit();
      if (submitError) {
        throw mapAffirmStripeError(submitError);
      }

      // Affirm is redirect-based. Stamp ep_method=affirm on return_url so the
      // remounted app can resume as Affirm (Stripe preserves custom query params).
      const resolvedReturnUrl = this.browser.isBrowser
        ? buildStripeReturnUrl('affirm', returnUrl)
        : returnUrl;

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements: this.elements,
        confirmParams: resolvedReturnUrl
          ? {
              return_url: resolvedReturnUrl,
            }
          : undefined,
        redirect: 'if_required',
      });

      if (error) {
        throw mapAffirmStripeError(error);
      }

      // When Affirm redirects, confirmPayment does not resolve in this page —
      // the return path uses StripeRedirectRecoveryService.
      return this.normalizeIntent(paymentIntent);
    } finally {
      this.confirming = false;
    }
  }

  /**
   * Delegates to shared Stripe BNPL redirect recovery (parent owns the flow).
   */
  consumeStripeReturn(): Promise<PaymentResult | null> {
    return this.redirectRecovery.consumeReturn();
  }

  /** True after a Stripe BNPL return was consumed on this page load. */
  wasReturnConsumed(): boolean {
    return this.redirectRecovery.wasReturnConsumed();
  }

  isConfirming(): boolean {
    return this.confirming;
  }

  unmountPaymentElement(): void {
    try {
      this.paymentElement?.unmount();
    } catch {
      // Element may already be unmounted.
    }
    this.paymentElement = null;
    this.elements = null;
  }

  hasMountedElement(): boolean {
    return !!this.elements && !!this.paymentElement;
  }

  async destroy(): Promise<void> {
    this.unmountPaymentElement();
    this.clientSecret = null;
    this.sessionId = undefined;
    this.paymentIntentId = undefined;
    this.confirming = false;
  }

  private assertValidAffirmResponse(response: CreateAffirmPaymentResponse): void {
    if (!response || typeof response !== 'object') {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend returned an invalid Affirm payment response.',
        method: 'affirm',
        provider: 'affirm',
      });
    }

    if (response.provider && response.provider !== 'affirm') {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend response provider must be "affirm".',
        method: 'affirm',
        provider: 'affirm',
      });
    }

    if (!response.clientSecret || typeof response.clientSecret !== 'string') {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend did not return an Affirm clientSecret.',
        method: 'affirm',
        provider: 'affirm',
      });
    }
  }

  private normalizeIntent(paymentIntent: PaymentIntentLike | undefined): PaymentResult {
    const status = paymentIntent?.status;

    // Terminal success only. Do not treat `processing` as success — Affirm may
    // still be settling asynchronously after customer authorization.
    if (status === 'succeeded' || status === 'requires_capture') {
      return normalizePaymentResult({
        status: 'success',
        method: 'affirm',
        provider: 'affirm',
        transactionId: paymentIntent?.id ?? this.paymentIntentId,
        sessionId: this.sessionId,
        message: 'Affirm payment completed successfully.',
        metadata: {
          stripeStatus: status,
          gateway: 'stripe',
        },
      });
    }

    if (status === 'canceled') {
      return normalizePaymentResult({
        status: 'cancelled',
        method: 'affirm',
        provider: 'affirm',
        transactionId: paymentIntent?.id ?? this.paymentIntentId,
        sessionId: this.sessionId,
        message: 'Affirm payment was cancelled.',
        metadata: {
          gateway: 'stripe',
        },
      });
    }

    if (status === 'requires_payment_method') {
      throw new PaymentError({
        code: 'PAYMENT_FAILED',
        message: 'Affirm payment was not completed. Please try again.',
        method: 'affirm',
        provider: 'affirm',
        originalError: paymentIntent,
      });
    }

    if (status === 'requires_action' || status === 'requires_confirmation') {
      throw new PaymentError({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Affirm payment still requires additional customer action.',
        method: 'affirm',
        provider: 'affirm',
        originalError: paymentIntent,
      });
    }

    if (status === 'processing') {
      throw new PaymentError({
        code: 'PAYMENT_FAILED',
        message:
          'Affirm payment is still processing. Please refresh or check your email for confirmation.',
        method: 'affirm',
        provider: 'affirm',
        originalError: paymentIntent,
      });
    }

    throw new PaymentError({
      code: 'PAYMENT_FAILED',
      message: `Unexpected PaymentIntent status: ${status ?? 'unknown'}.`,
      method: 'affirm',
      provider: 'affirm',
      originalError: paymentIntent,
    });
  }
}

interface PaymentIntentLike {
  id?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class AffirmMockAdapter extends BaseMockAdapter {
  readonly provider = 'affirm' as const;
  readonly method = 'affirm' as const;
}
