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
import { GooglePayAdapter } from '../../adapters/google-pay/google-pay.adapter';
import { buildGooglePayRenderKey, GooglePayUiState } from '../../adapters/google-pay/google-pay.types';
import { mapGooglePayError } from '../../adapters/google-pay/google-pay-error.mapper';
import { CheckoutSecurityMessageComponent } from '../checkout/checkout-security-message.component';
import { formatMoney } from '../../utils/format-money';

@Component({
  selector: 'easy-google-pay-payment',
  standalone: true,
  imports: [CheckoutSecurityMessageComponent],
  template: `
    <div class="ep-gpay" [attr.data-state]="uiState()">
      <div class="ep-gpay__header">
        <h3 class="ep-gpay__title">Pay with Google Pay</h3>
        <easy-checkout-security-message message="Secure checkout with Google Pay" />
      </div>

      @if (uiState() === 'initializing') {
        <p class="ep-gpay__status" role="status">Preparing Google Pay…</p>
      }

      @if (uiState() === 'unavailable') {
        <p class="ep-gpay__status" role="status">
          Google Pay is not available in this browser or Google account.
        </p>
      }

      @if (uiState() === 'creating-session') {
        <p class="ep-gpay__status" role="status">Preparing secure payment…</p>
      }

      @if (uiState() === 'awaiting-sheet') {
        <p class="ep-gpay__status" role="status">Waiting for Google Pay…</p>
      }

      @if (uiState() === 'processing') {
        <p class="ep-gpay__status" role="status">Processing Google Pay payment…</p>
      }

      <div
        #googlePayButtonHost
        class="ep-gpay__button"
        [class.ep-gpay__button--busy]="isBusy()"
        [attr.aria-busy]="isBusy()"
        aria-label="Google Pay official checkout"
      ></div>

      <p class="ep-gpay__amount" aria-live="polite">Total {{ amountLabel() }}</p>

      @if (inlineError()) {
        <p class="ep-gpay__error" role="alert">{{ inlineError() }}</p>
      }

      @if (uiState() === 'success') {
        <p class="ep-gpay__success" role="status">Payment completed.</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .ep-gpay {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .ep-gpay__header {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .ep-gpay__title {
        margin: 0;
        font-size: 1rem;
        font-weight: 650;
        color: var(--ep-text, #0f172a);
      }

      .ep-gpay__status {
        margin: 0;
        font-size: 13px;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-gpay__button {
        min-height: 48px;
        width: 100%;
      }

      .ep-gpay__button--busy {
        pointer-events: none;
        opacity: 0.65;
      }

      .ep-gpay__amount {
        margin: 0;
        font-size: 13px;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-gpay__error {
        margin: 0;
        color: var(--ep-danger, #b91c1c);
        font-size: 13px;
      }

      .ep-gpay__success {
        margin: 0;
        color: var(--ep-success, #15803d);
        font-size: 13px;
        font-weight: 600;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GooglePayPaymentComponent implements AfterViewInit, OnDestroy {
  private readonly googlePayAdapter = inject(GooglePayAdapter);

  readonly product = input.required<PaymentProduct>();
  readonly checkout = input<CheckoutOptions>();
  readonly resolvedTheme = input.required<ResolvedPaymentTheme>();

  readonly success = output<PaymentResult>();
  readonly cancel = output<PaymentResult>();
  readonly error = output<PaymentError>();
  /** True while sheet/confirm is in progress — parent should lock method switching. */
  readonly busyChange = output<boolean>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('googlePayButtonHost');

  readonly uiState = signal<GooglePayUiState>('idle');
  readonly inlineError = signal<string | null>(null);

  private readonly viewReady = signal(false);
  private renderKey: string | null = null;
  private lastTheme: ResolvedPaymentTheme | null = null;
  private renderGeneration = 0;

  readonly amountLabel = computed(() =>
    formatMoney(this.product().amount, this.product().currency, this.product().quantity ?? 1),
  );

  constructor() {
    // Product identity may require re-checking readiness / rebuilding the button.
    // Theme only restyles the official button — never creates PaymentIntents.
    effect(() => {
      const product = this.product();
      const checkout = this.checkout();
      const theme = this.resolvedTheme();
      const ready = this.viewReady();
      if (!ready) {
        return;
      }
      untracked(() => {
        void this.ensureButton(product, checkout, theme);
      });
    });

    effect(() => {
      const busy = this.isBusy();
      untracked(() => this.busyChange.emit(busy));
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  ngOnDestroy(): void {
    this.renderGeneration += 1;
    this.renderKey = null;
    void this.googlePayAdapter.destroy();
  }

  isBusy(): boolean {
    const state = this.uiState();
    return (
      state === 'creating-session' ||
      state === 'awaiting-sheet' ||
      state === 'processing' ||
      this.googlePayAdapter.isProcessing()
    );
  }

  private async ensureButton(
    product: PaymentProduct,
    checkout: CheckoutOptions | undefined,
    theme: ResolvedPaymentTheme,
  ): Promise<void> {
    const validation = validatePaymentProduct(product);
    if (!validation.valid) {
      const paymentError = new PaymentError({
        code: 'PRODUCT_INVALID',
        message: validation.errors.join(' '),
        method: 'google-pay',
        provider: 'googlePay',
      });
      this.uiState.set('error');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
      return;
    }

    const nextKey = buildGooglePayRenderKey(product);
    const themeChanged = this.lastTheme !== theme;
    if (nextKey === this.renderKey && !themeChanged && this.uiState() === 'ready') {
      return;
    }

    const generation = ++this.renderGeneration;
    this.renderKey = nextKey;
    this.lastTheme = theme;
    this.uiState.set('initializing');
    this.inlineError.set(null);

    try {
      const available = await this.googlePayAdapter.isAvailable({
        product,
        theme,
        checkout,
      });
      if (generation !== this.renderGeneration) {
        return;
      }

      if (!available) {
        this.uiState.set('unavailable');
        this.googlePayAdapter.clearButtonHost();
        return;
      }

      const host = this.host().nativeElement;
      await this.googlePayAdapter.renderOfficialButton(host, {
        theme,
        onClick: () => this.onGooglePayClick(product, checkout, generation),
      });

      if (generation !== this.renderGeneration) {
        return;
      }

      this.uiState.set('ready');
    } catch (err) {
      if (generation !== this.renderGeneration) {
        return;
      }
      this.renderKey = null;
      const paymentError = mapGooglePayError(err, 'SDK_LOAD_FAILED', 'Failed to initialize Google Pay.');
      this.uiState.set('error');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
    }
  }

  private async onGooglePayClick(
    product: PaymentProduct,
    checkout: CheckoutOptions | undefined,
    generation: number,
  ): Promise<void> {
    if (generation !== this.renderGeneration || this.isBusy() || this.uiState() === 'success') {
      return;
    }

    this.inlineError.set(null);
    this.uiState.set('creating-session');

    try {
      // Intermediate UI while PaymentIntent is created, then sheet opens.
      this.uiState.set('awaiting-sheet');
      const result = await this.googlePayAdapter.payWithGooglePay(product, checkout);
      if (generation !== this.renderGeneration) {
        return;
      }

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

      const paymentError = new PaymentError({
        code: 'PAYMENT_FAILED',
        message: result.message ?? 'Google Pay payment failed.',
        method: 'google-pay',
        provider: 'googlePay',
      });
      this.uiState.set('ready');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
    } catch (err) {
      if (generation !== this.renderGeneration) {
        return;
      }

      const paymentError = normalizeError(err, { method: 'google-pay', provider: 'googlePay' });
      if (paymentError.code === 'PAYMENT_CANCELLED') {
        this.uiState.set('ready');
        this.cancel.emit({
          status: 'cancelled',
          method: 'google-pay',
          provider: 'googlePay',
          message: paymentError.message,
        });
        return;
      }

      this.uiState.set('ready');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
    }
  }
}
