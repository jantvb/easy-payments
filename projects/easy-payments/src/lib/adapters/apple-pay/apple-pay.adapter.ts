import { inject, Injectable, signal } from '@angular/core';
import type {
  Stripe,
  StripeElements,
  StripeExpressCheckoutElement,
} from '@stripe/stripe-js';
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
import { CreatePaymentRequest } from '../../models/create-payment.model';
import { PaymentError } from '../../errors/payment-error';
import { BackendService } from '../../services/backend.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { BaseMockAdapter, BaseProviderAdapter } from '../base.adapter';
import { StripeSdkLoader } from '../stripe/stripe-sdk.loader';
import { mapApplePayError } from './apple-pay-error.mapper';
import {
  ApplePayAvailabilityState,
  buildApplePayRenderKey,
  toStripeAmountCents,
} from './apple-pay.types';

/**
 * Stripe Express Checkout Element availability helpers.
 * Prefer boolean `ready.availablePaymentMethods.applePay`.
 * Also support change-event shape `{ applePay: { available: boolean } }`.
 *
 * Change-event shape: `{ applePay: { available: boolean }, ... } | undefined`
 * Ready-event shape: `{ applePay: boolean, ... } | undefined`
 */
export function isApplePayAvailableFromPaymentMethods(paymentMethods: unknown): boolean {
  if (!paymentMethods || typeof paymentMethods !== 'object') {
    return false;
  }
  const apple = (paymentMethods as Record<string, unknown>)['applePay'];
  if (apple === true) {
    return true;
  }
  if (apple && typeof apple === 'object') {
    return (apple as { available?: boolean }).available === true;
  }
  return false;
}

@Injectable({ providedIn: 'root' })
export class ApplePayAdapter extends BaseProviderAdapter {
  readonly provider = 'applePay' as const;

  private readonly configService = inject(EasyPaymentsConfigService);
  private readonly backend = inject(BackendService);
  private readonly browser = inject(BrowserGuard);
  private readonly stripeSdk = inject(StripeSdkLoader);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private expressCheckout: StripeExpressCheckoutElement | null = null;
  private configReady = false;
  private readonly configReadySignal = signal(false);
  private processing = false;
  private mountHost: HTMLElement | null = null;
  private successHandler: ((result: PaymentResult) => void) | null = null;
  private cancelHandler: (() => void) | null = null;
  private errorHandler: ((error: PaymentError) => void) | null = null;

  private availabilityState: ApplePayAvailabilityState = 'idle';
  private availabilitySessionKey: string | null = null;
  private readyFired = false;
  private lastAvailablePaymentMethods: unknown = null;
  private availabilityListener: ((state: ApplePayAvailabilityState) => void) | null = null;

  /** Race guard — increment at each mount; abort stale mounts after await. */
  private mountToken = 0;
  private abortedMounts = 0;

  isConfigured(): boolean {
    return this.configReadySignal();
  }

  /** Reactive config readiness for Apple Pay bootstrap mounting. */
  readonly configured = this.configReadySignal.asReadonly();

  getAvailabilityStatus(): ApplePayAvailabilityState {
    return this.availabilityState;
  }

  /**
   * Optional UI hook — fired when production availability state changes
   * (e.g. after ECE `ready`). Use to call orchestrator.refreshAvailability.
   */
  setAvailabilityListener(listener: ((state: ApplePayAvailabilityState) => void) | null): void {
    this.availabilityListener = listener;
  }

  /**
   * Validates Apple Pay + Stripe gateway prerequisites.
   * Does not load Stripe.js until availability or mount.
   */
  async initialize(): Promise<void> {
    const snapshot = this.configService.getSnapshot();
    const applePay = snapshot.providers?.applePay;
    const stripeKey = snapshot.providers?.stripe?.publishableKey?.trim() ?? '';

    if (!applePay) {
      this.configReady = false;
      this.configReadySignal.set(false);
      this.initialized = false;
      return;
    }

    if (!stripeKey || /^sk_/i.test(stripeKey) || !/^pk_(test|live)_/i.test(stripeKey)) {
      this.configReady = false;
      this.configReadySignal.set(false);
      this.initialized = false;
      return;
    }

    if (!snapshot.backend?.createPaymentUrl?.trim()) {
      this.configReady = false;
      this.configReadySignal.set(false);
      this.initialized = false;
      return;
    }

    this.configReady = true;
    this.configReadySignal.set(true);
    this.initialized = true;
  }

  /**
   * Production availability from the mounted ECE `ready` event only.
   *
   * Rules:
   * - UNKNOWN (`idle` / `checking`) is never treated as available.
   * - Returns true only when Stripe reported `availablePaymentMethods.applePay`
   *   for the **current** product session key.
   * - Never uses UA sniffing, OS checks, ApplePaySession, or hidden probes.
   * - Windows / Chrome / third-party browsers are allowed when Stripe says so
   *   (including Apple Pay on the Web cross-device flows).
   */
  async isAvailable(context: PaymentContext): Promise<boolean> {
    if (!this.configReady || !this.browser.isBrowser) {
      // idle — not a definitive "unsupported" decision (bootstrap may still mount).
      this.setAvailabilityState('idle', null);
      return false;
    }

    const amount = toStripeAmountCents(context.product);
    const currency = context.product.currency.trim().toLowerCase();
    if (!Number.isFinite(amount) || amount < 1 || !currency) {
      this.setAvailabilityState('unavailable', null);
      return false;
    }

    const sessionKey = buildApplePayRenderKey(context.product);

    // Stale-session guard: a preserved `available` from a previous product/ECE
    // must not leak into a different checkout session.
    if (
      this.availabilityState === 'available' &&
      this.availabilitySessionKey !== null &&
      this.availabilitySessionKey !== sessionKey
    ) {
      this.setAvailabilityState('checking', sessionKey);
      this.readyFired = false;
      this.lastAvailablePaymentMethods = null;
      return false;
    }

    if (
      this.availabilityState === 'available' &&
      this.availabilitySessionKey === sessionKey
    ) {
      return true;
    }

    const decidedForSession =
      this.availabilitySessionKey === sessionKey &&
      (this.availabilityState === 'available' ||
        this.availabilityState === 'unavailable' ||
        this.availabilityState === 'error');

    if (!decidedForSession) {
      // Keep checking while waiting for the real ECE ready event (or remount).
      this.setAvailabilityState('checking', sessionKey);
    }

    return (
      this.availabilityState === 'available' && this.availabilitySessionKey === sessionKey
    );
  }

  async createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    throw new PaymentError({
      code: 'PROVIDER_UNAVAILABLE',
      message:
        'Apple Pay requires the official Apple Pay button UI. Use the apple-pay method inside <easy-payments>.',
      method: 'apple-pay',
      provider: 'applePay',
    });
  }

  async ensureStripeLoaded(): Promise<Stripe> {
    if (this.stripe) {
      return this.stripe;
    }

    const key = this.configService.getSnapshot().providers?.stripe?.publishableKey?.trim() ?? '';
    if (!key) {
      throw new PaymentError({
        code: 'CONFIG_MISSING',
        message: 'Stripe publishableKey is required for Apple Pay.',
        method: 'apple-pay',
        provider: 'applePay',
      });
    }

    const stripe = await this.stripeSdk.load(key);
    if (!stripe) {
      throw new PaymentError({
        code: 'SDK_LOAD_FAILED',
        message: 'Stripe.js failed to load for Apple Pay.',
        method: 'apple-pay',
        provider: 'applePay',
      });
    }

    this.stripe = stripe;
    return stripe;
  }

  /**
   * Mounts Stripe Express Checkout Element with Apple Pay only.
   * One real ECE instance — availability is decided by the `ready` event.
   * PaymentIntent is created only on confirm (not on mount).
   */
  async mountExpressCheckout(
    host: HTMLElement,
    options: {
      product: PaymentProduct;
      checkout?: CheckoutOptions;
      theme: ResolvedPaymentTheme;
      onSuccess: (result: PaymentResult) => void;
      onCancel: () => void;
      onError: (error: PaymentError) => void;
      onReady?: () => void;
      onUnavailable?: () => void;
      onAvailabilityChange?: (state: ApplePayAvailabilityState) => void;
    },
  ): Promise<void> {
    this.teardownExpressCheckout('remount');

    const token = ++this.mountToken;

    const sessionKey = buildApplePayRenderKey(options.product);
    const keepAvailable =
      this.availabilityState === 'available' && this.availabilitySessionKey === sessionKey;
    if (!keepAvailable) {
      this.setAvailabilityState('checking', sessionKey);
      this.readyFired = false;
      this.lastAvailablePaymentMethods = null;
    }

    this.successHandler = options.onSuccess;
    this.cancelHandler = options.onCancel;
    this.errorHandler = options.onError;
    this.mountHost = host;
    host.replaceChildren();

    const stripe = await this.ensureStripeLoaded();
    if (token !== this.mountToken) {
      // A newer mount already owns the host; finishing here would rip the
      // newer element's iframe out of the DOM and ready would never fire.
      this.abortedMounts += 1;
      return;
    }
    const amount = toStripeAmountCents(options.product);
    if (!Number.isFinite(amount) || amount < 1) {
      throw new PaymentError({
        code: 'PRODUCT_INVALID',
        message: 'Invalid amount for Apple Pay.',
        method: 'apple-pay',
        provider: 'applePay',
      });
    }

    const currency = options.product.currency.trim().toLowerCase();

    // Byte-for-byte parity with the known-good Minimal ECE Control on iPhone Safari.
    // Same paymentMethods contract that unlocked ready+applePay on iPhone Safari.
    // buttonHeight is Stripe-supported visual sizing only (does not change availability
    // or PaymentIntent flow). Keep other ECE chrome options out of this path.
    this.elements = stripe.elements({
      mode: 'payment',
      amount,
      currency,
      paymentMethodTypes: ['card'],
    });

    const expressCheckout = this.elements.create('expressCheckout', {
      paymentMethods: {
        applePay: 'always',
        googlePay: 'never',
        link: 'never',
        paypal: 'never',
        amazonPay: 'never',
        klarna: 'never',
      },
      buttonHeight: 44,
    });

    this.expressCheckout = expressCheckout;

    // Listeners MUST be attached before mount (Stripe ECE docs pattern).
    expressCheckout.on('ready', (event) => {
      this.readyFired = true;
      this.lastAvailablePaymentMethods = event.availablePaymentMethods ?? null;
      const available = isApplePayAvailableFromPaymentMethods(event.availablePaymentMethods);
      const next: ApplePayAvailabilityState = available ? 'available' : 'unavailable';
      this.setAvailabilityState(next, sessionKey);
      options.onAvailabilityChange?.(next);
      if (available) {
        options.onReady?.();
      } else {
        options.onUnavailable?.();
      }
    });

    expressCheckout.on('cancel', () => {
      this.processing = false;
      this.cancelHandler?.();
    });

    expressCheckout.on('loaderror', (event) => {
      this.processing = false;
      this.setAvailabilityState('error', sessionKey);
      options.onAvailabilityChange?.('error');
      const mapped = mapApplePayError(event?.error, 'SDK_LOAD_FAILED', 'Failed to load Apple Pay.');
      this.errorHandler?.(mapped);
    });

    expressCheckout.on('confirm', async () => {
      if (this.processing) {
        return;
      }
      this.processing = true;
      try {
        const result = await this.confirmExpressCheckout(options.product, options.checkout);
        this.successHandler?.(result);
      } catch (error) {
        const paymentError = mapApplePayError(error);
        if (paymentError.code === 'PAYMENT_CANCELLED') {
          this.cancelHandler?.();
        } else {
          this.errorHandler?.(paymentError);
        }
      } finally {
        this.processing = false;
      }
    });

    expressCheckout.mount(host);
  }

  unmountExpressCheckout(options?: { preserveAvailability?: boolean }): void {
    this.teardownExpressCheckout('destroy', options?.preserveAvailability === true);
  }

  /**
   * Clears ECE-driven availability (e.g. merchant removed `apple-pay` from methods,
   * or a brand-new checkout session must not inherit a previous ready result).
   */
  clearAvailability(): void {
    this.readyFired = false;
    this.lastAvailablePaymentMethods = null;
    this.setAvailabilityState('idle', null);
  }

  isProcessing(): boolean {
    return this.processing;
  }

  private teardownExpressCheckout(
    mode: 'remount' | 'destroy',
    preserveAvailability = false,
  ): void {
    try {
      this.expressCheckout?.unmount();
      this.expressCheckout?.destroy();
    } catch {
      // Element may already be gone.
    }
    this.expressCheckout = null;
    this.elements = null;
    if (this.mountHost) {
      this.mountHost.replaceChildren();
      this.mountHost = null;
    }
    this.successHandler = null;
    this.cancelHandler = null;
    this.errorHandler = null;

    if (preserveAvailability) {
      // Keep readyFired / availablePaymentMethods / availabilityState for the
      // **current session key only**. isAvailable() still requires session match.
      return;
    }

    if (mode === 'remount') {
      // Same-product remount (e.g. host swap): keep a confirmed `available` so the
      // express slot does not flicker, but do not invent availability. readyFired
      // stays until the replacement ECE emits ready again.
      if (this.availabilityState !== 'available') {
        this.readyFired = false;
        this.lastAvailablePaymentMethods = null;
        this.availabilityState = 'checking';
      }
    } else {
      this.readyFired = false;
      this.lastAvailablePaymentMethods = null;
      this.setAvailabilityState('idle', null);
    }
  }

  private setAvailabilityState(
    state: ApplePayAvailabilityState,
    sessionKey: string | null,
  ): void {
    const changed =
      this.availabilityState !== state || this.availabilitySessionKey !== sessionKey;
    this.availabilityState = state;
    this.availabilitySessionKey = sessionKey;
    if (changed) {
      this.availabilityListener?.(state);
    }
  }

  private async confirmExpressCheckout(
    product: PaymentProduct,
    checkout?: CheckoutOptions,
  ): Promise<PaymentResult> {
    const stripe = await this.ensureStripeLoaded();
    const elements = this.elements;
    if (!elements) {
      throw new PaymentError({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Apple Pay is not ready.',
        method: 'apple-pay',
        provider: 'applePay',
      });
    }

    const { error: submitError } = await elements.submit();
    if (submitError) {
      throw mapApplePayError(submitError);
    }

    const session = await this.createPaymentSession(product, checkout);
    const returnUrl =
      this.browser.getWindow()?.location?.href?.split('#')[0] ||
      'http://localhost/';

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: session.clientSecret,
      confirmParams: {
        return_url: returnUrl,
      },
      redirect: 'if_required',
    });

    if (error) {
      throw mapApplePayError(error);
    }

    const status = paymentIntent?.status;
    if (status === 'succeeded' || status === 'processing' || status === 'requires_capture') {
      return normalizePaymentResult({
        status: 'success',
        method: 'apple-pay',
        provider: 'applePay',
        transactionId: paymentIntent?.id ?? session.paymentIntentId,
        sessionId: paymentIntent?.id ?? session.paymentIntentId,
        message: 'Apple Pay payment completed.',
        metadata: {
          processor: 'stripe',
          stripeStatus: status,
        },
      });
    }

    if (status === 'canceled') {
      return normalizePaymentResult({
        status: 'cancelled',
        method: 'apple-pay',
        provider: 'applePay',
        message: 'Apple Pay payment was cancelled.',
        sessionId: paymentIntent?.id ?? session.paymentIntentId,
      });
    }

    throw new PaymentError({
      code: 'PAYMENT_FAILED',
      message: `Apple Pay payment ended with status: ${status ?? 'unknown'}.`,
      method: 'apple-pay',
      provider: 'applePay',
    });
  }

  private async createPaymentSession(
    product: PaymentProduct,
    checkout?: CheckoutOptions,
  ): Promise<{ clientSecret: string; paymentIntentId?: string }> {
    const payload: CreatePaymentRequest = {
      provider: 'stripe',
      productId: product.id,
      quantity: product.quantity ?? 1,
      currency: product.currency.trim().toUpperCase(),
      amount: product.amount,
      metadata: {
        productName: product.name,
        checkoutMethod: 'apple-pay',
        ...(checkout?.customer?.email ? { customerEmail: checkout.customer.email } : {}),
      },
    };

    try {
      const response = await this.backend.createStripePayment(payload);
      if (
        response.provider !== 'stripe' ||
        typeof response.clientSecret !== 'string' ||
        !response.clientSecret.trim()
      ) {
        throw new PaymentError({
          code: 'BACKEND_ERROR',
          message: 'Invalid Stripe create-payment response for Apple Pay.',
          method: 'apple-pay',
          provider: 'applePay',
        });
      }
      return {
        clientSecret: response.clientSecret,
        paymentIntentId: response.paymentIntentId,
      };
    } catch (error) {
      throw mapApplePayError(error, 'BACKEND_ERROR', 'Failed to create payment session for Apple Pay.');
    }
  }

  async destroy(): Promise<void> {
    this.unmountExpressCheckout();
    this.processing = false;
    this.stripe = null;
    this.availabilityListener = null;
    this.clearAvailability();
  }
}

@Injectable({ providedIn: 'root' })
export class ApplePayMockAdapter extends BaseMockAdapter {
  readonly provider = 'applePay' as const;
  readonly method = 'apple-pay' as const;
}
