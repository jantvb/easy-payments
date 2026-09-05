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
import { ApplePayAdapter } from '../../adapters/apple-pay/apple-pay.adapter';
import { buildApplePayRenderKey, ApplePayUiState } from '../../adapters/apple-pay/apple-pay.types';
import { mapApplePayError } from '../../adapters/apple-pay/apple-pay-error.mapper';
import { CheckoutSecurityMessageComponent } from '../checkout/checkout-security-message.component';
import { formatMoney } from '../../utils/format-money';

@Component({
  selector: 'easy-apple-pay-payment',
  standalone: true,
  imports: [CheckoutSecurityMessageComponent],
  template: `
    <div class="ep-apay" [class.ep-apay--compact]="compact()" [attr.data-state]="uiState()">
      @if (!compact()) {
        <div class="ep-apay__header">
          <h3 class="ep-apay__title">Pay with Apple Pay</h3>
          <easy-checkout-security-message message="Secure checkout with Apple Pay" />
        </div>
      }

      @if (uiState() === 'initializing') {
        <p class="ep-apay__status" role="status">Preparing Apple Pay…</p>
      }

      @if (uiState() === 'unavailable') {
        <p class="ep-apay__status" role="status">
          Apple Pay is not available in this browser or Wallet.
        </p>
      }

      @if (uiState() === 'processing') {
        <p class="ep-apay__status" role="status">Processing Apple Pay payment…</p>
      }

      <div
        #applePayButtonHost
        class="ep-apay__button"
        [class.ep-apay__button--busy]="isBusy()"
        [class.ep-apay__button--hidden]="uiState() === 'unavailable'"
        [attr.aria-busy]="isBusy()"
        aria-label="Apple Pay official checkout"
      ></div>

      @if (!compact()) {
        <p class="ep-apay__amount" aria-live="polite">Total {{ amountLabel() }}</p>
      }

      @if (inlineError()) {
        <p class="ep-apay__error" role="alert">{{ inlineError() }}</p>
      }

      @if (uiState() === 'success' && !compact()) {
        <p class="ep-apay__success" role="status">Payment completed.</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .ep-apay {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      /* Rendered inside the payment methods grid: button only. */
      .ep-apay--compact {
        gap: 4px;
        width: 100%;
        align-items: center;
      }

      .ep-apay--compact .ep-apay__status,
      .ep-apay--compact .ep-apay__error {
        text-align: center;
        font-size: 12px;
        width: 100%;
      }

      /*
        Compact ECE host: ~44px official button, centered.
        Narrow (mobile) containers: full row width for tap comfort.
        Wider containers: capped width so Apple Pay does not dominate the tile.
      */
      .ep-apay--compact .ep-apay__button {
        min-height: 44px;
        height: 44px;
        width: 100%;
        max-width: 100%;
        margin-inline: auto;
      }

      @container ep-checkout (min-width: 360px) {
        .ep-apay--compact .ep-apay__button {
          max-width: 168px;
        }
      }

      @container ep-checkout (min-width: 520px) {
        .ep-apay--compact .ep-apay__button {
          max-width: 152px;
        }
      }

      .ep-apay__header {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .ep-apay__title {
        margin: 0;
        font-size: 1rem;
        font-weight: 650;
        color: var(--ep-text, #0f172a);
      }

      .ep-apay__status {
        margin: 0;
        font-size: 13px;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-apay__button {
        min-height: 44px;
        width: 100%;
      }

      .ep-apay__button--busy {
        pointer-events: none;
        opacity: 0.65;
      }

      .ep-apay__button--hidden {
        display: none;
      }

      .ep-apay__amount {
        margin: 0;
        font-size: 13px;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-apay__error {
        margin: 0;
        color: var(--ep-danger, #b91c1c);
        font-size: 13px;
      }

      .ep-apay__success {
        margin: 0;
        color: var(--ep-success, #15803d);
        font-size: 13px;
        font-weight: 600;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplePayPaymentComponent implements AfterViewInit, OnDestroy {
  private readonly applePayAdapter = inject(ApplePayAdapter);

  readonly product = input.required<PaymentProduct>();
  readonly checkout = input<CheckoutOptions>();
  readonly resolvedTheme = input.required<ResolvedPaymentTheme>();
  /** Button-only rendering for the express slot inside the payment methods list. */
  readonly compact = input(false);

  readonly success = output<PaymentResult>();
  readonly cancel = output<PaymentResult>();
  readonly error = output<PaymentError>();
  readonly busyChange = output<boolean>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('applePayButtonHost');

  readonly uiState = signal<ApplePayUiState>('idle');
  readonly inlineError = signal<string | null>(null);

  private readonly viewReady = signal(false);
  private renderKey: string | null = null;
  private lastTheme: ResolvedPaymentTheme | null = null;
  private renderGeneration = 0;
  private emittedSuccess = false;

  readonly amountLabel = computed(() =>
    formatMoney(this.product().amount, this.product().currency, this.product().quantity ?? 1),
  );

  constructor() {
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
    // Keep the availability decided by `ready`: a full destroy resets it to `idle`
    // and the Apple Pay tile would vanish from the list on method switch.
    this.applePayAdapter.unmountExpressCheckout({ preserveAvailability: true });
  }

  isBusy(): boolean {
    const state = this.uiState();
    return state === 'processing' || this.applePayAdapter.isProcessing();
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
        method: 'apple-pay',
        provider: 'applePay',
      });
      this.uiState.set('error');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
      return;
    }

    const nextKey = buildApplePayRenderKey(product);
    const themeChanged = this.lastTheme !== theme;
    if (nextKey === this.renderKey && !themeChanged && this.uiState() === 'ready') {
      return;
    }

    const generation = ++this.renderGeneration;
    this.renderKey = nextKey;
    this.lastTheme = theme;
    this.emittedSuccess = false;
    // Availability was already proven by the bootstrap `ready`; don't fall back to
    // "Preparing Apple Pay…" while the button re-renders in this panel.
    this.uiState.set(
      this.applePayAdapter.getAvailabilityStatus() === 'available' ? 'ready' : 'initializing',
    );
    this.inlineError.set(null);

    try {
      // Mount the real ECE first — availability comes from ready, not a hidden probe.
      if (!this.applePayAdapter.isConfigured()) {
        this.uiState.set('unavailable');
        return;
      }

      const host = this.host().nativeElement;
      await this.applePayAdapter.mountExpressCheckout(host, {
        product,
        checkout,
        theme,
        onSuccess: (result) => this.onPaymentSuccess(result, generation),
        onCancel: () => this.onPaymentCancel(generation),
        onError: (err) => this.onPaymentError(err, generation),
        onReady: () => {
          if (generation === this.renderGeneration) {
            this.uiState.set('ready');
          }
        },
        onUnavailable: () => {
          if (generation === this.renderGeneration) {
            this.uiState.set('unavailable');
          }
        },
      });

      if (generation !== this.renderGeneration) {
        return;
      }

      // Stay initializing until ready fires (or unavailable/error).
      if (this.applePayAdapter.getAvailabilityStatus() === 'available') {
        this.uiState.set('ready');
      } else if (
        this.applePayAdapter.getAvailabilityStatus() === 'unavailable' ||
        this.applePayAdapter.getAvailabilityStatus() === 'error'
      ) {
        this.uiState.set('unavailable');
      }
    } catch (err) {
      if (generation !== this.renderGeneration) {
        return;
      }
      this.renderKey = null;
      const paymentError = mapApplePayError(err, 'SDK_LOAD_FAILED', 'Failed to initialize Apple Pay.');
      this.uiState.set('error');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
    }
  }

  private onPaymentSuccess(result: PaymentResult, generation: number): void {
    if (generation !== this.renderGeneration || this.emittedSuccess) {
      return;
    }
    this.emittedSuccess = true;
    this.uiState.set('success');
    this.success.emit(result);
  }

  private onPaymentCancel(generation: number): void {
    if (generation !== this.renderGeneration) {
      return;
    }
    this.uiState.set('ready');
    this.cancel.emit({
      status: 'cancelled',
      method: 'apple-pay',
      provider: 'applePay',
      message: 'Apple Pay was cancelled.',
    });
  }

  private onPaymentError(err: PaymentError, generation: number): void {
    if (generation !== this.renderGeneration) {
      return;
    }
    const paymentError = normalizeError(err, { method: 'apple-pay', provider: 'applePay' });
    if (paymentError.code === 'PAYMENT_CANCELLED') {
      this.onPaymentCancel(generation);
      return;
    }
    this.uiState.set('ready');
    this.inlineError.set(paymentError.message);
    this.error.emit(paymentError);
  }
}
