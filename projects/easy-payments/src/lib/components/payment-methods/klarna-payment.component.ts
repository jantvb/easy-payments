import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
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
import { KlarnaAdapter } from '../../adapters/klarna/klarna.adapter';
import { buildKlarnaSessionKey, KlarnaUiState } from '../../adapters/klarna/klarna.types';
import {
  buildKlarnaReturnUrl,
  clearKlarnaPendingReturn,
  isKlarnaReturnAttempt,
  markKlarnaPendingReturn,
} from '../../adapters/klarna/klarna-return';
import { formatMoney } from '../../utils/format-money';
import { CheckoutSecurityMessageComponent } from '../checkout/checkout-security-message.component';

@Component({
  selector: 'easy-klarna-payment',
  standalone: true,
  imports: [CheckoutSecurityMessageComponent],
  template: `
    <div class="ep-klarna" [attr.data-state]="uiState()">
      <div class="ep-klarna__header">
        <h3 class="ep-klarna__title">Pay with Klarna</h3>
        <easy-checkout-security-message message="Secure checkout powered by Klarna via Stripe" />
      </div>

      @if (uiState() === 'initializing' || uiState() === 'loading-session') {
        <p class="ep-klarna__status" role="status">Preparing Klarna checkout…</p>
      }

      <!--
        Keep the Stripe mount host always in the DOM and visible to layout.
        Toggling display:none on a mounted Stripe iframe causes severe browser jank.
      -->
      <div
        #paymentElementHost
        class="ep-klarna__element"
        [class.ep-klarna__element--pending]="
          uiState() === 'initializing' || uiState() === 'loading-session'
        "
        [attr.aria-hidden]="uiState() === 'error' || uiState() === 'idle'"
        aria-label="Klarna secure payment form"
      ></div>

      @if (inlineError()) {
        <p class="ep-klarna__error" role="alert">{{ inlineError() }}</p>
      }

      @if (uiState() === 'success') {
        <p class="ep-klarna__success" role="status">Payment completed.</p>
      }

      <button
        type="button"
        class="ep-klarna__pay"
        [disabled]="!canPay()"
        [attr.aria-busy]="uiState() === 'processing'"
        (click)="onPay()"
      >
        @if (uiState() === 'processing') {
          Processing payment…
        } @else {
          Pay {{ amountLabel() }}
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

      .ep-klarna {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .ep-klarna__header {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .ep-klarna__title {
        margin: 0;
        font-size: 1rem;
        font-weight: 650;
        color: var(--ep-text, #0f172a);
      }

      .ep-klarna__status {
        margin: 0;
        font-size: 13px;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-klarna__element {
        min-height: 48px;
        padding: 4px 0;
      }

      .ep-klarna__element--pending {
        opacity: 0.45;
        pointer-events: none;
      }

      .ep-klarna__error {
        margin: 0;
        color: var(--ep-danger, #b91c1c);
        font-size: 13px;
      }

      .ep-klarna__success {
        margin: 0;
        color: var(--ep-success, #15803d);
        font-size: 13px;
        font-weight: 600;
      }

      .ep-klarna__pay {
        min-height: 48px;
        border: 0;
        border-radius: var(--ep-radius-md, 10px);
        background: var(--ep-cta-bg, #0f172a);
        color: var(--ep-cta-text, #f8fafc);
        font: inherit;
        font-size: 15px;
        font-weight: 650;
        cursor: pointer;
      }

      .ep-klarna__pay:hover:not(:disabled) {
        background: var(--ep-cta-bg-hover, #1e293b);
      }

      .ep-klarna__pay:focus-visible {
        outline: 2px solid var(--ep-focus, #2563eb);
        outline-offset: 2px;
      }

      .ep-klarna__pay:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      @media (prefers-reduced-motion: reduce) {
        .ep-klarna__pay {
          transition: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KlarnaPaymentComponent implements AfterViewInit, OnDestroy {
  private readonly klarnaAdapter = inject(KlarnaAdapter);

  readonly product = input.required<PaymentProduct>();
  readonly checkout = input<CheckoutOptions>();
  readonly resolvedTheme = input.required<ResolvedPaymentTheme>();

  readonly success = output<PaymentResult>();
  readonly cancel = output<PaymentResult>();
  readonly error = output<PaymentError>();
  /** True while confirmPayment / redirect is in progress — parent should lock method switching. */
  readonly busyChange = output<boolean>();
  /**
   * True while recovering a Stripe Klarna redirect return (parent should show
   * Processing payment… and must not flash fresh checkout).
   */
  readonly returning = output<boolean>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('paymentElementHost');

  readonly uiState = signal<KlarnaUiState>('idle');
  readonly inlineError = signal<string | null>(null);

  /** Host element is ready for Stripe mount (must be a signal so the session effect can react). */
  private readonly viewReady = signal(false);

  private sessionKey: string | null = null;
  private initGeneration = 0;
  private lastAppliedTheme: ResolvedPaymentTheme | null = null;
  /** Ensures success/cancel/error emit at most once per payment attempt (incl. redirect return). */
  private terminalEmitted = false;
  /** After a redirect return is handled by the parent, never create a new PaymentIntent. */
  private returnHandled = false;

  readonly amountLabel = computed(() =>
    formatMoney(this.product().amount, this.product().currency, this.product().quantity ?? 1),
  );

  constructor() {
    // Product/checkout changes may require a new PaymentIntent.
    // Theme must NOT recreate PaymentIntents — only update appearance.
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
    void this.klarnaAdapter.destroy();
  }

  canPay(): boolean {
    return this.uiState() === 'ready' && !this.klarnaAdapter.isConfirming();
  }

  async onPay(): Promise<void> {
    if (!this.canPay() || this.terminalEmitted) {
      return;
    }

    this.inlineError.set(null);
    this.uiState.set('processing');
    this.busyChange.emit(true);

    try {
      const product = this.product();
      markKlarnaPendingReturn(product.id);
      const returnUrl = buildKlarnaReturnUrl(this.checkout()?.successUrl);
      const result = await this.klarnaAdapter.confirmPayment(returnUrl);

      // If Klarna redirected, this page unloads and confirmPayment never settles here.
      clearKlarnaPendingReturn();
      this.emitTerminal(result);
    } catch (err) {
      clearKlarnaPendingReturn();
      const paymentError = normalizeError(err, { method: 'klarna', provider: 'klarna' });
      if (paymentError.code === 'PAYMENT_CANCELLED') {
        this.emitTerminal({
          status: 'cancelled',
          method: 'klarna',
          provider: 'klarna',
          message: paymentError.message,
        });
        return;
      }

      this.uiState.set('ready');
      this.inlineError.set(paymentError.message);
      this.emitErrorOnce(paymentError);
    } finally {
      this.busyChange.emit(false);
    }
  }

  private async applyTheme(theme: ResolvedPaymentTheme): Promise<void> {
    if (this.lastAppliedTheme === theme && this.klarnaAdapter.hasMountedElement()) {
      return;
    }
    this.lastAppliedTheme = theme;
    if (this.klarnaAdapter.hasMountedElement()) {
      await this.klarnaAdapter.updateAppearance(theme);
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
        method: 'klarna',
        provider: 'klarna',
      });
      this.uiState.set('error');
      this.inlineError.set(paymentError.message);
      this.emitErrorOnce(paymentError);
      return;
    }

    // Redirect return is owned by EasyPaymentsComponent via KlarnaAdapter.consumeStripeReturn().
    // Skip creating a new PaymentIntent while return query params are still present.
    if (!this.returnHandled && isKlarnaReturnAttempt()) {
      this.returnHandled = true;
      this.sessionKey = buildKlarnaSessionKey(product, checkout);
      this.uiState.set('processing');
      return;
    }

    if (this.returnHandled) {
      return;
    }

    const nextKey = buildKlarnaSessionKey(product, checkout);

    // Same checkout identity (including in-flight): never create another PaymentIntent.
    if (nextKey === this.sessionKey) {
      return;
    }

    const generation = ++this.initGeneration;
    this.sessionKey = nextKey;
    this.uiState.set('initializing');
    this.inlineError.set(null);

    try {
      await this.klarnaAdapter.ensureStripeLoaded();
      if (generation !== this.initGeneration) {
        return;
      }

      this.uiState.set('loading-session');
      const session = await this.klarnaAdapter.createPaymentSession(product, checkout);
      if (generation !== this.initGeneration) {
        return;
      }

      const host = this.host().nativeElement;
      const theme = untracked(() => this.resolvedTheme());
      await this.klarnaAdapter.mountPaymentElement(host, session.clientSecret, theme);
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
      const paymentError = normalizeError(err, { method: 'klarna', provider: 'klarna' });
      this.uiState.set('error');
      this.inlineError.set(paymentError.message);
      this.emitErrorOnce(paymentError);
    }
  }

  private emitTerminal(result: PaymentResult): void {
    if (this.terminalEmitted) {
      return;
    }
    this.terminalEmitted = true;

    if (result.status === 'success') {
      this.uiState.set('success');
      this.success.emit(result);
      return;
    }

    if (result.status === 'cancelled') {
      this.uiState.set('ready');
      this.cancel.emit(result);
      return;
    }

    this.uiState.set('ready');
    const paymentError = new PaymentError({
      code: 'PAYMENT_FAILED',
      message: result.message ?? 'Payment failed.',
      method: 'klarna',
      provider: 'klarna',
    });
    this.inlineError.set(paymentError.message);
    this.error.emit(paymentError);
  }

  private emitErrorOnce(paymentError: PaymentError): void {
    if (this.terminalEmitted) {
      return;
    }
    this.terminalEmitted = true;
    this.error.emit(paymentError);
  }
}
