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
import { CreatePaymentRequest, CreateStripePaymentResponse } from '../../models/create-payment.model';
import { PaymentError } from '../../errors/payment-error';
import { BackendService } from '../../services/backend.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { BaseMockAdapter, BaseProviderAdapter } from '../base.adapter';
import {
  mapResolvedThemeToStripeAppearance,
  STRIPE_PAYMENT_ELEMENT_OPTIONS,
} from './stripe-appearance';
import { mapStripeError } from './stripe-error.mapper';
import { StripeSdkLoader } from './stripe-sdk.loader';
import { StripeSessionResult } from './stripe.types';

function looksLikeSecretKey(value: string): boolean {
  return /^sk_(test|live)_/i.test(value.trim());
}

function looksLikePublishableKey(value: string): boolean {
  return /^pk_(test|live)_/i.test(value.trim());
}

@Injectable({ providedIn: 'root' })
export class StripeCardAdapter extends BaseProviderAdapter {
  readonly provider = 'stripe' as const;

  private readonly configService = inject(EasyPaymentsConfigService);
  private readonly backend = inject(BackendService);
  private readonly browser = inject(BrowserGuard);
  private readonly sdkLoader = inject(StripeSdkLoader);

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
   * Validates Stripe frontend config only. Does not load Stripe.js until needed.
   */
  async initialize(): Promise<void> {
    const stripeConfig = this.configService.getSnapshot().providers?.stripe;
    const key = stripeConfig?.publishableKey?.trim() ?? '';

    if (!key) {
      this.configReady = false;
      this.initialized = false;
      return;
    }

    if (looksLikeSecretKey(key)) {
      this.configReady = false;
      this.initialized = false;
      throw new PaymentError({
        code: 'CONFIG_INVALID',
        message:
          'Stripe secret keys must never be used in Angular. Provide a publishable key (pk_...) only.',
        method: 'card',
        provider: 'stripe',
      });
    }

    this.configReady = true;
    this.initialized = true;
  }

  async isAvailable(_context: PaymentContext): Promise<boolean> {
    const snapshot = this.configService.getSnapshot();
    const key = snapshot.providers?.stripe?.publishableKey?.trim() ?? '';
    if (!key || looksLikeSecretKey(key) || !this.configReady) {
      return false;
    }
    if (!snapshot.backend?.createPaymentUrl?.trim()) {
      return false;
    }
    return true;
  }

  /**
   * Interactive Stripe Payment Element flow is handled by StripeCardPaymentComponent.
   * Calling createPayment directly is not supported for real card payments.
   */
  async createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    throw new PaymentError({
      code: 'PROVIDER_UNAVAILABLE',
      message:
        'Stripe card payments require the secure Payment Element UI. Use the card method inside <easy-payments>.',
      method: 'card',
      provider: 'stripe',
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
        message: 'Stripe publishableKey is missing.',
        method: 'card',
        provider: 'stripe',
      });
    }

    if (looksLikeSecretKey(key)) {
      throw new PaymentError({
        code: 'CONFIG_INVALID',
        message:
          'Stripe secret keys must never be used in Angular. Provide a publishable key (pk_...) only.',
        method: 'card',
        provider: 'stripe',
      });
    }

    if (!looksLikePublishableKey(key)) {
      throw new PaymentError({
        code: 'CONFIG_INVALID',
        message: 'Stripe publishableKey appears invalid. Expected a pk_test_... or pk_live_... value.',
        method: 'card',
        provider: 'stripe',
      });
    }

    if (!this.browser.isBrowser) {
      throw new PaymentError({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Stripe.js can only load in the browser.',
        method: 'card',
        provider: 'stripe',
      });
    }

    this.loadPromise = (async () => {
      try {
        const stripe = await this.sdkLoader.load(key);
        if (!stripe) {
          throw new PaymentError({
            code: 'SDK_LOAD_FAILED',
            message: 'Stripe.js failed to initialize.',
            method: 'card',
            provider: 'stripe',
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
          method: 'card',
          provider: 'stripe',
          originalError: error,
        });
      }
    })();

    return this.loadPromise;
  }

  async createPaymentSession(
    product: PaymentProduct,
    checkout?: CheckoutOptions,
  ): Promise<StripeSessionResult> {
    if (!this.configService.getSnapshot().backend?.createPaymentUrl?.trim()) {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend createPaymentUrl is not configured.',
        method: 'card',
        provider: 'stripe',
      });
    }

    const payload: CreatePaymentRequest = {
      provider: 'stripe',
      productId: product.id,
      quantity: product.quantity ?? 1,
      currency: product.currency,
      // Sent for local demos only — production backends must re-price server-side.
      amount: product.amount,
      metadata: {
        ...(product.metadata ?? {}),
        ...(product.name ? { productName: product.name } : {}),
        ...(product.description ? { productDescription: product.description } : {}),
        ...(checkout?.customer?.email ? { customerEmail: checkout.customer.email } : {}),
        ...(checkout?.customer?.name ? { customerName: checkout.customer.name } : {}),
      },
    };

    const response = await this.backend.createStripePayment(payload);
    this.assertValidStripeResponse(response);

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

      this.paymentElement = this.elements.create('payment', STRIPE_PAYMENT_ELEMENT_OPTIONS);
      this.paymentElement.mount(container);
    } catch (error) {
      throw new PaymentError({
        code: 'SDK_LOAD_FAILED',
        message: 'Stripe Payment Element failed to initialize.',
        method: 'card',
        provider: 'stripe',
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
        message: 'A Stripe payment confirmation is already in progress.',
        method: 'card',
        provider: 'stripe',
      });
    }

    this.confirming = true;

    try {
      const stripe = await this.ensureStripeLoaded();
      if (!this.elements) {
        throw new PaymentError({
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Stripe Payment Element is not ready.',
          method: 'card',
          provider: 'stripe',
        });
      }

      const { error: submitError } = await this.elements.submit();
      if (submitError) {
        throw mapStripeError(submitError);
      }

      const resolvedReturnUrl =
        returnUrl ||
        (this.browser.isBrowser ? `${window.location.origin}${window.location.pathname}` : undefined);

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
        throw mapStripeError(error);
      }

      return this.normalizeIntent(paymentIntent);
    } finally {
      this.confirming = false;
    }
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

  private assertValidStripeResponse(response: CreateStripePaymentResponse): void {
    if (!response || typeof response !== 'object') {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend returned an invalid Stripe payment response.',
        method: 'card',
        provider: 'stripe',
      });
    }

    if (response.provider && response.provider !== 'stripe') {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend response provider must be "stripe".',
        method: 'card',
        provider: 'stripe',
      });
    }

    if (!response.clientSecret || typeof response.clientSecret !== 'string') {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend did not return a Stripe clientSecret.',
        method: 'card',
        provider: 'stripe',
      });
    }
  }

  private normalizeIntent(paymentIntent: PaymentIntentLike | undefined): PaymentResult {
    const status = paymentIntent?.status;

    if (status === 'succeeded' || status === 'processing' || status === 'requires_capture') {
      return normalizePaymentResult({
        status: 'success',
        method: 'card',
        provider: 'stripe',
        transactionId: paymentIntent?.id ?? this.paymentIntentId,
        sessionId: this.sessionId,
        message:
          status === 'succeeded'
            ? 'Card payment completed successfully.'
            : `Card payment accepted (status: ${status}).`,
        metadata: {
          stripeStatus: status,
        },
      });
    }

    if (status === 'canceled') {
      return normalizePaymentResult({
        status: 'cancelled',
        method: 'card',
        provider: 'stripe',
        transactionId: paymentIntent?.id ?? this.paymentIntentId,
        sessionId: this.sessionId,
        message: 'Card payment was cancelled.',
      });
    }

    throw new PaymentError({
      code: 'PAYMENT_FAILED',
      message: `Unexpected PaymentIntent status: ${status ?? 'unknown'}.`,
      method: 'card',
      provider: 'stripe',
      originalError: paymentIntent,
    });
  }
}

interface PaymentIntentLike {
  id?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class StripeCardMockAdapter extends BaseMockAdapter {
  readonly provider = 'stripe' as const;
  readonly method = 'card' as const;
}
