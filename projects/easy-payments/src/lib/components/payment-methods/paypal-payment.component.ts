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
import { PayPalAdapter } from '../../adapters/paypal/paypal.adapter';
import { buildPayPalRenderKey, PayPalUiState } from '../../adapters/paypal/paypal.types';
import { mapPayPalError } from '../../adapters/paypal/paypal-error.mapper';
import { CheckoutSecurityMessageComponent } from '../checkout/checkout-security-message.component';

@Component({
  selector: 'easy-paypal-payment',
  standalone: true,
  imports: [CheckoutSecurityMessageComponent],
  template: `
    <div class="ep-paypal" [attr.data-state]="uiState()">
      <div class="ep-paypal__header">
        <h3 class="ep-paypal__title">Pay with PayPal</h3>
        <easy-checkout-security-message message="Secure checkout powered by PayPal" />
      </div>

      @if (uiState() === 'initializing') {
        <p class="ep-paypal__status" role="status">Preparing PayPal checkout…</p>
      }

      @if (uiState() === 'creating-order') {
        <p class="ep-paypal__status" role="status">Creating PayPal order…</p>
      }

      @if (uiState() === 'waiting-approval') {
        <p class="ep-paypal__status" role="status">Waiting for PayPal approval…</p>
      }

      @if (uiState() === 'capturing') {
        <p class="ep-paypal__status" role="status">Capturing PayPal payment…</p>
      }

      <!--
        Keep the Buttons host in the DOM while PayPal is available.
        Hide via parent clip (not display:none) when another method is selected.
      -->
      <div
        #paypalButtonsHost
        class="ep-paypal__buttons"
        [class.ep-paypal__buttons--pending]="uiState() === 'initializing'"
        [attr.aria-busy]="isBusyState()"
        aria-label="PayPal official checkout"
      ></div>

      @if (inlineError()) {
        <p class="ep-paypal__error" role="alert">{{ inlineError() }}</p>
      }

      @if (uiState() === 'success') {
        <p class="ep-paypal__success" role="status">Payment completed.</p>
      }

      @if (uiState() === 'cancelled') {
        <p class="ep-paypal__status" role="status">PayPal checkout cancelled.</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .ep-paypal {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .ep-paypal__header {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .ep-paypal__title {
        margin: 0;
        font-size: 1rem;
        font-weight: 650;
        color: var(--ep-text, #0f172a);
      }

      .ep-paypal__status {
        margin: 0;
        font-size: 13px;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-paypal__buttons {
        min-height: 48px;
      }

      .ep-paypal__buttons--pending {
        opacity: 0.45;
        pointer-events: none;
      }

      .ep-paypal__error {
        margin: 0;
        color: var(--ep-danger, #b91c1c);
        font-size: 13px;
      }

      .ep-paypal__success {
        margin: 0;
        color: var(--ep-success, #15803d);
        font-size: 13px;
        font-weight: 600;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayPalPaymentComponent implements AfterViewInit, OnDestroy {
  private readonly paypalAdapter = inject(PayPalAdapter);

  readonly product = input.required<PaymentProduct>();
  readonly checkout = input<CheckoutOptions>();
  /** Theme is accepted for API symmetry with Stripe; PayPal Buttons use official gold styling. */
  readonly resolvedTheme = input.required<ResolvedPaymentTheme>();

  readonly success = output<PaymentResult>();
  readonly cancel = output<PaymentResult>();
  readonly error = output<PaymentError>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('paypalButtonsHost');

  readonly uiState = signal<PayPalUiState>('idle');
  readonly inlineError = signal<string | null>(null);

  private readonly viewReady = signal(false);
  private renderKey: string | null = null;
  private renderGeneration = 0;

  constructor() {
    // Product/checkout identity may require re-rendering Buttons (createOrder closure).
    // Theme must NOT recreate orders or reload the SDK.
    effect(() => {
      const product = this.product();
      const checkout = this.checkout();
      const ready = this.viewReady();
      // Read theme so Angular tracks it, but do not use it as a render key.
      void this.resolvedTheme();
      if (!ready) {
        return;
      }
      untracked(() => {
        void this.ensureButtons(product, checkout);
      });
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  ngOnDestroy(): void {
    this.renderGeneration += 1;
    this.renderKey = null;
    void this.paypalAdapter.destroy();
  }

  isBusyState(): boolean {
    const state = this.uiState();
    return (
      state === 'creating-order' ||
      state === 'waiting-approval' ||
      state === 'capturing' ||
      this.paypalAdapter.isBusy()
    );
  }

  private async ensureButtons(
    product: PaymentProduct,
    checkout: CheckoutOptions | undefined,
  ): Promise<void> {
    const validation = validatePaymentProduct(product);
    if (!validation.valid) {
      const paymentError = new PaymentError({
        code: 'PRODUCT_INVALID',
        message: validation.errors.join(' '),
        method: 'paypal',
        provider: 'paypal',
      });
      this.uiState.set('error');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
      return;
    }

    const nextKey = buildPayPalRenderKey(product, checkout);
    if (nextKey === this.renderKey) {
      return;
    }

    const generation = ++this.renderGeneration;
    this.renderKey = nextKey;
    this.uiState.set('initializing');
    this.inlineError.set(null);

    try {
      await this.paypalAdapter.ensureSdkLoaded();
      if (generation !== this.renderGeneration) {
        return;
      }

      const host = this.host().nativeElement;
      host.replaceChildren();

      await this.paypalAdapter.renderButtons(host, {
        createOrder: () => this.onCreateOrder(product, checkout, generation),
        onApprove: (data) => this.onApprove(data.orderID, generation),
        onCancel: () => this.onCancel(generation),
        onError: (err) => this.onSdkError(err, generation),
        onClick: async (_data, actions) => {
          if (this.paypalAdapter.isBusy() || this.uiState() === 'success') {
            await actions.reject();
            return;
          }
          await actions.resolve();
        },
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
      const paymentError = mapPayPalError(err, 'SDK_LOAD_FAILED', 'Failed to initialize PayPal.');
      this.uiState.set('error');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
    }
  }

  private async onCreateOrder(
    product: PaymentProduct,
    checkout: CheckoutOptions | undefined,
    generation: number,
  ): Promise<string> {
    if (generation !== this.renderGeneration) {
      throw new PaymentError({
        code: 'PAYMENT_FAILED',
        message: 'PayPal checkout was superseded.',
        method: 'paypal',
        provider: 'paypal',
      });
    }

    this.inlineError.set(null);
    this.uiState.set('creating-order');

    try {
      const orderId = await this.paypalAdapter.createOrder(product, checkout);
      if (generation === this.renderGeneration) {
        this.uiState.set('waiting-approval');
      }
      return orderId;
    } catch (err) {
      const paymentError = mapPayPalError(err, 'BACKEND_ERROR', 'Failed to create PayPal order.');
      if (generation === this.renderGeneration) {
        this.uiState.set('ready');
        this.inlineError.set(paymentError.message);
        this.error.emit(paymentError);
      }
      throw paymentError;
    }
  }

  private async onApprove(orderId: string, generation: number): Promise<void> {
    if (generation !== this.renderGeneration) {
      return;
    }

    this.uiState.set('capturing');
    this.inlineError.set(null);

    try {
      const result = await this.paypalAdapter.captureOrder(orderId);
      if (generation !== this.renderGeneration) {
        return;
      }

      if (result.status === 'success') {
        this.uiState.set('success');
        this.success.emit(result);
        return;
      }

      if (result.status === 'cancelled') {
        this.uiState.set('cancelled');
        this.cancel.emit(result);
        return;
      }

      const paymentError = new PaymentError({
        code: 'PAYMENT_FAILED',
        message: result.message ?? 'PayPal payment failed.',
        method: 'paypal',
        provider: 'paypal',
      });
      this.uiState.set('ready');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
    } catch (err) {
      if (generation !== this.renderGeneration) {
        return;
      }
      const paymentError = normalizeError(err, { method: 'paypal', provider: 'paypal' });
      if (paymentError.code === 'PAYMENT_CANCELLED') {
        this.uiState.set('cancelled');
        this.cancel.emit({
          status: 'cancelled',
          method: 'paypal',
          provider: 'paypal',
          message: paymentError.message,
          sessionId: orderId,
        });
        return;
      }

      this.uiState.set('ready');
      this.inlineError.set(paymentError.message);
      this.error.emit(paymentError);
    }
  }

  private onCancel(generation: number): void {
    if (generation !== this.renderGeneration) {
      return;
    }

    this.uiState.set('cancelled');
    this.cancel.emit({
      status: 'cancelled',
      method: 'paypal',
      provider: 'paypal',
      message: 'PayPal checkout was cancelled.',
      sessionId: this.paypalAdapter.getActiveOrderId() ?? undefined,
    });

    // Allow another attempt without remounting Buttons.
    queueMicrotask(() => {
      if (generation === this.renderGeneration && this.uiState() === 'cancelled') {
        this.uiState.set('ready');
      }
    });
  }

  private onSdkError(err: unknown, generation: number): void {
    if (generation !== this.renderGeneration) {
      return;
    }

    const paymentError = mapPayPalError(err);
    if (paymentError.code === 'PAYMENT_CANCELLED') {
      this.onCancel(generation);
      return;
    }

    this.uiState.set('ready');
    this.inlineError.set(paymentError.message);
    this.error.emit(paymentError);
  }
}
