import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  CheckoutOptions,
  CheckoutSuccessBehavior,
  PaymentMethod,
  PaymentProduct,
  PaymentResult,
  PaymentTheme,
} from '../../models';
import { PaymentError, normalizeError } from '../../errors/payment-error';
import { PaymentOrchestratorService } from '../../services/payment-orchestrator.service';
import { ThemeService } from '../../themes/theme.service';
import { StripeCardPaymentComponent } from '../payment-methods/stripe-card-payment.component';
import { PayPalPaymentComponent } from '../payment-methods/paypal-payment.component';
import { GooglePayPaymentComponent } from '../payment-methods/google-pay-payment.component';
import { KlarnaPaymentComponent } from '../payment-methods/klarna-payment.component';
import { AffirmPaymentComponent } from '../payment-methods/affirm-payment.component';
import { CheckoutProductSummaryComponent } from '../checkout/checkout-product-summary.component';
import { PaymentMethodSelectorComponent } from '../checkout/payment-method-selector.component';
import { MockMethodPanelComponent } from '../checkout/mock-method-panel.component';
import { CheckoutOutcomeComponent } from '../checkout/checkout-outcome.component';
import { CheckoutViewState } from '../checkout/checkout-view-state';
import {
  DEFAULT_CHECKOUT_MAX_WIDTH,
  resolveCheckoutMaxWidth,
} from '../../layout/checkout-layout';
import { StripeRedirectRecoveryService } from '../../adapters/stripe/stripe-redirect-recovery.service';
import {
  detectStripeReturnMethod,
  isStripeReturnAttempt,
  type StripeRedirectMethod,
} from '../../adapters/stripe/stripe-redirect-return';

@Component({
  selector: 'easy-payments',
  standalone: true,
  imports: [
    CheckoutProductSummaryComponent,
    PaymentMethodSelectorComponent,
    MockMethodPanelComponent,
    StripeCardPaymentComponent,
    PayPalPaymentComponent,
    GooglePayPaymentComponent,
    KlarnaPaymentComponent,
    AffirmPaymentComponent,
    CheckoutOutcomeComponent,
  ],
  templateUrl: './easy-payments.component.html',
  styleUrl: './easy-payments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ep-theme-light]': 'resolvedTheme() === "light"',
    '[class.ep-theme-dark]': 'resolvedTheme() === "dark"',
    '[attr.data-theme]': 'resolvedTheme()',
    '[style.--ep-checkout-max-width]': 'checkoutMaxWidthCss()',
    '[style.max-width.px]': 'effectiveMaxWidth()',
    role: 'region',
    'aria-label': 'Checkout',
  },
})
export class EasyPaymentsComponent {
  private readonly orchestrator = inject(PaymentOrchestratorService);
  private readonly themeService = inject(ThemeService);
  private readonly stripeRedirectRecovery = inject(StripeRedirectRecoveryService);
  private readonly destroyRef = inject(DestroyRef);
  private destroyed = false;

  readonly product = input.required<PaymentProduct>();
  readonly methods = input<PaymentMethod[]>(['apple-pay', 'google-pay', 'paypal', 'card']);
  readonly checkout = input<CheckoutOptions>();
  readonly theme = input<PaymentTheme>('system');
  /**
   * Maximum checkout width in pixels. The component stays fluid (`width: 100%`)
   * up to this cap. Values are clamped to library-safe limits (320–1200).
   * Defaults to 640.
   */
  readonly maxWidth = input<number | string | null | undefined>(DEFAULT_CHECKOUT_MAX_WIDTH);
  /**
   * Built-in confirmation UI after success. Defaults to confirmation.
   * Can also be set via checkout.successBehavior.
   */
  readonly successBehavior = input<CheckoutSuccessBehavior>('confirmation');

  readonly success = output<PaymentResult>();
  readonly cancel = output<PaymentResult>();
  readonly error = output<PaymentError>();
  /** Fired when the customer clicks Continue on the built-in success screen. */
  readonly successContinue = output<PaymentResult>();

  readonly resolvedTheme = this.themeService.resolvedTheme;
  readonly availableMethods = this.orchestrator.availableMethods;
  readonly loading = this.orchestrator.loading;

  /** Clamped max-width applied to the host (and used by container queries). */
  readonly effectiveMaxWidth = computed(() => resolveCheckoutMaxWidth(this.maxWidth()));
  readonly checkoutMaxWidthCss = computed(() => `${this.effectiveMaxWidth()}px`);

  readonly selectedMethod = signal<PaymentMethod | null>(null);
  private readonly processingMethod = signal<PaymentMethod | null>(null);
  /** Real provider is mid-flow (3DS / PayPal approval / Google Pay sheet). */
  readonly providerBusy = signal(false);

  readonly viewState = signal<CheckoutViewState>('checkout');
  readonly lastResult = signal<PaymentResult | null>(null);
  readonly lastError = signal<PaymentError | null>(null);
  /** Bumped on reset so real provider panels remount with a fresh session. */
  readonly providerMountKey = signal(0);

  /** Prevents duplicate Stripe BNPL return recovery / success emits on one page load. */
  private stripeReturnRecoveryStarted = false;
  private terminalSuccessEmitted = false;

  /** Terminal/mock-processing screens that replace the checkout form. */
  readonly showOutcome = computed(() => {
    const state = this.viewState();
    return state === 'success' || state === 'error' || state === 'cancelled' || state === 'processing';
  });

  readonly showCheckoutForm = computed(() => !this.showOutcome());

  readonly methodsLocked = computed(
    () => this.showOutcome() || this.providerBusy() || this.processingMethod() !== null,
  );

  readonly resolvedSuccessBehavior = computed<CheckoutSuccessBehavior>(() => {
    return this.checkout()?.successBehavior ?? this.successBehavior();
  });

  readonly outcomeState = computed(() => {
    const state = this.viewState();
    if (state === 'checkout') {
      return 'processing' as const;
    }
    return state;
  });

  readonly visibleMethods = computed(() => {
    const requested = this.methods();
    const availability = this.availableMethods();

    return requested
      .map((method) => availability.find((a) => a.method === method))
      .filter((entry): entry is NonNullable<typeof entry> => !!entry && entry.available);
  });

  readonly selectedEntry = computed(() => {
    const selected = this.selectedMethod();
    if (!selected) {
      return null;
    }
    return this.visibleMethods().find((entry) => entry.method === selected) ?? null;
  });

  readonly hasRealCardMethod = computed(() =>
    this.visibleMethods().some((entry) => entry.method === 'card' && !entry.isMock),
  );

  readonly hasRealPayPalMethod = computed(() =>
    this.visibleMethods().some((entry) => entry.method === 'paypal' && !entry.isMock),
  );

  readonly hasRealGooglePayMethod = computed(() =>
    this.visibleMethods().some((entry) => entry.method === 'google-pay' && !entry.isMock),
  );

  readonly hasRealKlarnaMethod = computed(() =>
    this.visibleMethods().some((entry) => entry.method === 'klarna' && !entry.isMock),
  );

  readonly hasRealAffirmMethod = computed(() =>
    this.visibleMethods().some((entry) => entry.method === 'affirm' && !entry.isMock),
  );

  readonly showMockPanel = computed(() => {
    if (!this.showCheckoutForm()) {
      return false;
    }
    const entry = this.selectedEntry();
    if (!entry) {
      return false;
    }
    if (entry.method === 'card' && !entry.isMock) {
      return false;
    }
    if (entry.method === 'paypal' && !entry.isMock) {
      return false;
    }
    if (entry.method === 'google-pay' && !entry.isMock) {
      return false;
    }
    if (entry.method === 'klarna' && !entry.isMock) {
      return false;
    }
    if (entry.method === 'affirm' && !entry.isMock) {
      return false;
    }
    return true;
  });

  readonly showStripePanel = computed(() => this.hasRealCardMethod());
  readonly showPayPalPanel = computed(() => this.hasRealPayPalMethod());
  readonly showGooglePayPanel = computed(() => this.hasRealGooglePayMethod());
  readonly showKlarnaPanel = computed(() => this.hasRealKlarnaMethod());
  readonly showAffirmPanel = computed(() => this.hasRealAffirmMethod());

  /**
   * Keep the active real-provider panel interactive while its own UI is needed
   * (including during providerBusy / 3DS / sheets). Clip only when another method
   * is selected or a terminal/mock-processing outcome replaced the form.
   */
  readonly stripePanelActive = computed(
    () =>
      this.showCheckoutForm() &&
      this.selectedMethod() === 'card' &&
      this.hasRealCardMethod(),
  );

  readonly paypalPanelActive = computed(
    () =>
      this.showCheckoutForm() &&
      this.selectedMethod() === 'paypal' &&
      this.hasRealPayPalMethod(),
  );

  readonly googlePayPanelActive = computed(
    () =>
      this.showCheckoutForm() &&
      this.selectedMethod() === 'google-pay' &&
      this.hasRealGooglePayMethod(),
  );

  readonly klarnaPanelActive = computed(
    () =>
      this.showCheckoutForm() &&
      this.selectedMethod() === 'klarna' &&
      this.hasRealKlarnaMethod(),
  );

  readonly affirmPanelActive = computed(
    () =>
      this.showCheckoutForm() &&
      this.selectedMethod() === 'affirm' &&
      this.hasRealAffirmMethod(),
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });

    // Avoid flashing fresh checkout when Stripe redirects back from Klarna/Affirm.
    // Recovery itself is owned here (not only by the BNPL panel), so Processing
    // always resolves even if the panel has not mounted yet.
    if (typeof window !== 'undefined' && isStripeReturnAttempt()) {
      const method = detectStripeReturnMethod() ?? 'klarna';
      this.viewState.set('processing');
      this.selectedMethod.set(method);
      this.providerBusy.set(true);
      queueMicrotask(() => {
        void this.recoverStripeReturn(method);
      });
    }

    effect(() => {
      this.themeService.setTheme(this.theme());
    });

    effect(() => {
      const product = this.product();
      const methods = this.methods();
      const checkout = this.checkout();

      untracked(() => {
        void this.orchestrator.refreshAvailability(methods, product, checkout).catch((err: unknown) => {
          // Config/availability errors emit only — do not take over the checkout UI.
          this.error.emit(normalizeError(err));
        });
      });
    });

    effect(() => {
      const visible = this.visibleMethods();
      const current = untracked(() => this.selectedMethod());
      const state = untracked(() => this.viewState());

      // Do not steal method selection during Stripe BNPL return recovery / outcomes.
      if (state !== 'checkout') {
        return;
      }

      if (visible.length === 0) {
        if (current !== null) {
          this.selectedMethod.set(null);
        }
        return;
      }

      if (!current || !visible.some((entry) => entry.method === current)) {
        this.selectedMethod.set(visible[0].method);
      }
    });
  }

  /**
   * Library-owned Stripe BNPL redirect recovery (Klarna / Affirm). Always leaves
   * processing for a terminal state (success / error / cancelled). Idempotent per page load.
   */
  private async recoverStripeReturn(method: StripeRedirectMethod): Promise<void> {
    if (this.stripeReturnRecoveryStarted) {
      return;
    }
    this.stripeReturnRecoveryStarted = true;

    this.viewState.set('processing');
    this.selectedMethod.set(method);
    this.providerBusy.set(true);

    const label = method === 'affirm' ? 'Affirm' : 'Klarna';

    try {
      const result = await this.stripeRedirectRecovery.consumeReturn();
      if (this.destroyed) {
        return;
      }
      if (!result) {
        this.handlePaymentError(
          new PaymentError({
            code: 'PAYMENT_FAILED',
            message: `${label} return could not be verified.`,
            method,
            provider: method,
          }),
        );
        return;
      }

      if (result.status === 'success') {
        this.handleSuccess(result);
      } else if (result.status === 'cancelled') {
        this.handleCancelled(result);
      } else {
        this.handlePaymentError(
          new PaymentError({
            code: 'PAYMENT_FAILED',
            message: result.message ?? `${label} payment failed.`,
            method,
            provider: method,
          }),
        );
      }
    } catch (err) {
      if (this.destroyed) {
        return;
      }
      const paymentError = normalizeError(err, { method, provider: method });
      if (paymentError.code === 'PAYMENT_CANCELLED') {
        this.handleCancelled({
          status: 'cancelled',
          method,
          provider: method,
          message: paymentError.message,
        });
      } else {
        this.handlePaymentError(paymentError);
      }
    } finally {
      if (!this.destroyed) {
        this.providerBusy.set(false);
      }
    }
  }

  selectMethod(method: PaymentMethod): void {
    if (this.methodsLocked()) {
      return;
    }
    this.selectedMethod.set(method);
  }

  isMethodLoading(method: PaymentMethod): boolean {
    return this.loading() && this.processingMethod() === method;
  }

  onProviderBusy(busy: boolean): void {
    this.providerBusy.set(busy);
  }

  onStripeSuccess(result: PaymentResult): void {
    this.handleSuccess(result);
  }

  onStripeCancel(result: PaymentResult): void {
    this.handleCancelled(result);
  }

  onStripeError(error: PaymentError): void {
    this.handlePaymentError(error);
  }

  onPayPalSuccess(result: PaymentResult): void {
    this.handleSuccess(result);
  }

  onPayPalCancel(result: PaymentResult): void {
    this.handleCancelled(result);
  }

  onPayPalError(error: PaymentError): void {
    this.handlePaymentError(error);
  }

  onGooglePaySuccess(result: PaymentResult): void {
    this.handleSuccess(result);
  }

  onGooglePayCancel(result: PaymentResult): void {
    this.handleCancelled(result);
  }

  onGooglePayError(error: PaymentError): void {
    this.handlePaymentError(error);
  }

  onKlarnaSuccess(result: PaymentResult): void {
    // Parent owns redirect recovery; ignore duplicate panel success for the same load.
    if (this.stripeRedirectRecovery.wasReturnConsumed() && this.terminalSuccessEmitted) {
      return;
    }
    this.handleSuccess(result);
  }

  onKlarnaCancel(result: PaymentResult): void {
    this.handleCancelled(result);
  }

  onKlarnaError(error: PaymentError): void {
    this.handlePaymentError(error);
  }

  /**
   * Klarna panel busy/returning signals (in-page confirm). Redirect recovery is
   * owned by recoverStripeReturn() so Processing cannot hang without a panel.
   */
  onKlarnaReturning(active: boolean): void {
    if (active) {
      this.selectedMethod.set('klarna');
      if (this.viewState() === 'checkout') {
        this.viewState.set('processing');
      }
      this.providerBusy.set(true);
      return;
    }
    this.providerBusy.set(false);
  }

  onAffirmSuccess(result: PaymentResult): void {
    if (this.stripeRedirectRecovery.wasReturnConsumed() && this.terminalSuccessEmitted) {
      return;
    }
    this.handleSuccess(result);
  }

  onAffirmCancel(result: PaymentResult): void {
    this.handleCancelled(result);
  }

  onAffirmError(error: PaymentError): void {
    this.handlePaymentError(error);
  }

  onAffirmReturning(active: boolean): void {
    if (active) {
      this.selectedMethod.set('affirm');
      if (this.viewState() === 'checkout') {
        this.viewState.set('processing');
      }
      this.providerBusy.set(true);
      return;
    }
    this.providerBusy.set(false);
  }

  async onPay(method: PaymentMethod): Promise<void> {
    if (this.methodsLocked() || this.processingMethod()) {
      return;
    }

    this.processingMethod.set(method);
    this.viewState.set('processing');
    this.lastError.set(null);
    this.lastResult.set(null);

    try {
      const result = await this.orchestrator.processPayment(method, this.product(), this.checkout());

      if (result.status === 'success') {
        this.handleSuccess(result);
      } else if (result.status === 'cancelled') {
        this.handleCancelled(result);
      } else {
        this.handlePaymentError(
          new PaymentError({
            code: 'PAYMENT_FAILED',
            message: result.message ?? 'Payment failed.',
            method,
            provider: result.provider,
          }),
        );
      }
    } catch (err) {
      const paymentError = normalizeError(err, { method });

      if (paymentError.code === 'PAYMENT_CANCELLED') {
        this.handleCancelled({
          status: 'cancelled',
          method,
          provider: paymentError.provider ?? 'stripe',
          message: paymentError.message,
        });
      } else {
        this.handlePaymentError(paymentError);
      }
    } finally {
      this.processingMethod.set(null);
    }
  }

  onOutcomeAction(): void {
    const state = this.viewState();
    if (state === 'success') {
      const result = this.lastResult();
      if (result) {
        this.successContinue.emit(result);
      }
      this.resetCheckoutView();
      return;
    }

    if (state === 'error' || state === 'cancelled') {
      this.resetCheckoutView();
    }
  }

  /** Public helper for hosts (e.g. demo Continue) to restore a fresh checkout UI. */
  resetCheckoutView(): void {
    this.viewState.set('checkout');
    this.lastResult.set(null);
    this.lastError.set(null);
    this.processingMethod.set(null);
    this.providerBusy.set(false);
    this.terminalSuccessEmitted = false;
    this.providerMountKey.update((value) => value + 1);
  }

  private handleSuccess(result: PaymentResult): void {
    if (
      this.terminalSuccessEmitted &&
      (result.method === 'klarna' || result.method === 'affirm')
    ) {
      return;
    }
    if (result.method === 'klarna' || result.method === 'affirm') {
      this.terminalSuccessEmitted = true;
    }

    this.success.emit(result);
    this.lastResult.set(result);
    this.lastError.set(null);
    this.providerBusy.set(false);

    if (this.resolvedSuccessBehavior() === 'confirmation') {
      this.viewState.set('success');
    } else {
      this.viewState.set('checkout');
    }
  }

  private handleCancelled(result: PaymentResult): void {
    this.cancel.emit(result);
    this.lastResult.set(result);
    this.lastError.set(null);
    this.providerBusy.set(false);
    this.viewState.set('cancelled');
  }

  private handlePaymentError(error: PaymentError): void {
    this.error.emit(error);
    this.lastError.set(error);
    this.lastResult.set(null);
    this.providerBusy.set(false);
    this.viewState.set('error');
  }
}
