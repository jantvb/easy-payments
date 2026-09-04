import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  CheckoutOptions,
  PaymentProduct,
  PaymentResult,
  ResolvedPaymentTheme,
} from '../../models';
import { PaymentError, normalizeError } from '../../errors/payment-error';
import { validatePaymentProduct } from '../../validators/product.validator';
import { StripeCardAdapter } from '../../adapters/stripe/stripe-card.adapter';
import { buildStripeSessionKey } from '../../adapters/stripe/stripe-appearance';
import { StripeCardUiState } from '../../adapters/stripe/stripe.types';

@Component({
  selector: 'easy-stripe-card-payment',
  standalone: true,
  template: `
    <div class="ep-stripe-card" [attr.data-state]="uiState()">
      <div class="ep-stripe-card__header">
        <h3 class="ep-stripe-card__title">Card</h3>
        <p class="ep-stripe-card__hint">Secure card fields are provided by Stripe.</p>
      </div>

      @if (uiState() === 'initializing' || uiState() === 'loading-session') {
        <p class="ep-stripe-card__status" role="status">Preparing secure card form…</p>
      }

      <!--
        Keep the Stripe mount host always in the DOM and visible to layout.
        Toggling display:none on a mounted Stripe iframe causes severe browser jank.
      -->
      <div
        #paymentElementHost
        class="ep-stripe-card__element"
        [class.ep-stripe-card__element--pending]="
          uiState() === 'initializing' || uiState() === 'loading-session'
        "
        [attr.aria-hidden]="uiState() === 'error' || uiState() === 'idle'"
        aria-label="Stripe secure card payment form"
      ></div>

      @if (inlineError()) {
        <p class="ep-stripe-card__error" role="alert">{{ inlineError() }}</p>
      }

      @if (uiState() === 'success') {
        <p class="ep-stripe-card__success" role="status">Payment completed.</p>
      }

      <button
        type="button"
        class="ep-stripe-card__pay"
        [disabled]="!canPay()"
        [attr.aria-busy]="uiState() === 'processing'"
        (click)="onPay()"
      >
        @if (uiState() === 'processing') {
          Processing…
        } @else {
          Pay with card
        }
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .ep-stripe-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        border-radius: 10px;
        border: 1px solid var(--ep-border, #e2e8f0);
        background: var(--ep-bg, #fff);
        color: var(--ep-text, #0f172a);
      }

      .ep-stripe-card__title {
        margin: 0;
        font-size: 1rem;
      }

      .ep-stripe-card__hint,
      .ep-stripe-card__status {
        margin: 4px 0 0;
        font-size: 13px;
        opacity: 0.75;
      }

      .ep-stripe-card__element {
        min-height: 48px;
      }

      .ep-stripe-card__element--pending {
        opacity: 0.45;
        pointer-events: none;
      }

      .ep-stripe-card__error {
        margin: 0;
        color: #b91c1c;
        font-size: 13px;
      }

      .ep-stripe-card__success {
        margin: 0;
        color: #15803d;
        font-size: 13px;
        font-weight: 600;
      }

      .ep-stripe-card__pay {
        min-height: 48px;
        border: 0;
        border-radius: 8px;
        background: var(--ep-card-bg, #0f172a);
        color: var(--ep-card-text, #f8fafc);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .ep-stripe-card__pay:focus-visible {
        outline: 2px solid var(--ep-focus-color, #2563eb);
        outline-offset: 2px;
      }

      .ep-stripe-card__pay:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      @media (prefers-reduced-motion: reduce) {
        .ep-stripe-card__pay {
          transition: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StripeCardPaymentComponent implements AfterViewInit, OnDestroy {
  private readonly stripeAdapter = inject(StripeCardAdapter);

  readonly product = input.required<PaymentProduct>();
  readonly checkout = input<CheckoutOptions>();
  readonly resolvedTheme = input.required<ResolvedPaymentTheme>();

  readonly success = output<PaymentResult>();
  readonly cancel = output<PaymentResult>();
  readonly error = output<PaymentError>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('paymentElementHost');

  readonly uiState = signal<StripeCardUiState>('idle');
  readonly inlineError = signal<string | null>(null);

  /** Host element is ready for Stripe mount (must be a signal so the session effect can react). */
  private readonly viewReady = signal(false);

  private sessionKey: string | null = null;
  private initGeneration = 0;
  private lastAppliedTheme: ResolvedPaymentTheme | null = null;

  constructor() {
    // Product/checkout changes may require a new PaymentIntent.
    // Theme must NOT recreate PaymentIntents — only update appearance.
    //
    // CRITICAL: ensureSession reads/writes uiState. Without untracked(), those
    // signal writes re-trigger this effect and spam PaymentIntent creation /
    // Element remounts (browser freeze).
    effect(() => {
      const product = this.product();
      const checkout = this.checkout();
      const ready = this.viewReady();
      if (!ready) {
        return;
      }
      untracked(() => {
        void this.ensureSession(product, checkout);
      });
    });

    effect(() => {
      const theme = this.resolvedTheme();
      const ready = this.viewReady();
      if (!ready) {
        return;
      }
      untracked(() => {
        void this.applyTheme(theme);
      });
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  ngOnDestroy(): void {
    this.initGeneration += 1;
    this.sessionKey = null;
    void this.stripeAdapter.destroy();
  }

  canPay(): boolean {
    return this.uiState() === 'ready' && !this.stripeAdapter.isConfirming();
  }

  async onPay(): Promise<void> {
    if (!this.canPay()) {
      return;
    }

    this.inlineError.set(null);
    this.uiState.set('processing');

    try {
      const result = await this.stripeAdapter.confirmPayment(this.checkout()?.successUrl);

      if (result.status === 'success') {
        this.uiState.set('success');
        this.success.emit(result);
      } else if (result.status === 'cancelled') {
        this.uiState.set('ready');
        this.cancel.emit(result);
      } else {
        this.uiState.set('ready');
        const paymentError = new PaymentError({
          code: 'PAYMENT_FAILED',
          message: result.message ?? 'Payment failed.',
          method: 'card',
          provider: 'stripe',
        });
        this.inlineError.set(paymentError.message);
        this.error.emit(paymentError);
      }
    } catch (err) {
      const paymentError = normalizeError(err, { method: 'card', provider: 'stripe' });
      if (paymentError.code === 'PAYMENT_CANCELLED') {
        this.uiState.set('ready');
        this.cancel.emit({
          status: 'cancelled',
          method: 'card',
          provider: 'stripe',
          message: paymentError.message,
        });
        return;
      }

      this.uiState.set('ready');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
    }
  }

  private async applyTheme(theme: ResolvedPaymentTheme): Promise<void> {
    if (this.lastAppliedTheme === theme && this.stripeAdapter.hasMountedElement()) {
      return;
    }
    this.lastAppliedTheme = theme;
    if (this.stripeAdapter.hasMountedElement()) {
      await this.stripeAdapter.updateAppearance(theme);
    }
  }

  private async ensureSession(
    product: PaymentProduct,
    checkout: CheckoutOptions | undefined,
  ): Promise<void> {
    const validation = validatePaymentProduct(product);
    if (!validation.valid) {
      const paymentError = new PaymentError({
        code: 'PRODUCT_INVALID',
        message: validation.errors.join(' '),
        method: 'card',
        provider: 'stripe',
      });
      this.uiState.set('error');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
      return;
    }

    const nextKey = buildStripeSessionKey(product, checkout);

    // Same checkout identity (including in-flight): never create another PaymentIntent.
    // sessionKey is cleared only on error/destroy so retries remain possible.
    if (nextKey === this.sessionKey) {
      return;
    }

    const generation = ++this.initGeneration;
    this.sessionKey = nextKey;
    this.uiState.set('initializing');
    this.inlineError.set(null);

    try {
      await this.stripeAdapter.ensureStripeLoaded();
      if (generation !== this.initGeneration) {
        return;
      }

      this.uiState.set('loading-session');
      const session = await this.stripeAdapter.createPaymentSession(product, checkout);
      if (generation !== this.initGeneration) {
        return;
      }

      const host = this.host().nativeElement;
      const theme = untracked(() => this.resolvedTheme());
      await this.stripeAdapter.mountPaymentElement(host, session.clientSecret, theme);
      if (generation !== this.initGeneration) {
        return;
      }

      this.lastAppliedTheme = theme;
      this.uiState.set('ready');
    } catch (err) {
      if (generation !== this.initGeneration) {
        return;
      }
      this.sessionKey = null;
      const paymentError = normalizeError(err, { method: 'card', provider: 'stripe' });
      this.uiState.set('error');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
    }
  }
}
