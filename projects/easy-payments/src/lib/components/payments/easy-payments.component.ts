import {
  ChangeDetectionStrategy,
  Component,
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
import { CheckoutProductSummaryComponent } from '../checkout/checkout-product-summary.component';
import { PaymentMethodSelectorComponent } from '../checkout/payment-method-selector.component';
import { MockMethodPanelComponent } from '../checkout/mock-method-panel.component';

@Component({
  selector: 'easy-payments',
  standalone: true,
  imports: [
    CheckoutProductSummaryComponent,
    PaymentMethodSelectorComponent,
    MockMethodPanelComponent,
    StripeCardPaymentComponent,
    PayPalPaymentComponent,
  ],
  templateUrl: './easy-payments.component.html',
  styleUrl: './easy-payments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ep-theme-light]': 'resolvedTheme() === "light"',
    '[class.ep-theme-dark]': 'resolvedTheme() === "dark"',
    '[attr.data-theme]': 'resolvedTheme()',
    role: 'region',
    'aria-label': 'Checkout',
  },
})
export class EasyPaymentsComponent {
  private readonly orchestrator = inject(PaymentOrchestratorService);
  private readonly themeService = inject(ThemeService);

  readonly product = input.required<PaymentProduct>();
  readonly methods = input<PaymentMethod[]>(['apple-pay', 'google-pay', 'paypal', 'card']);
  readonly checkout = input<CheckoutOptions>();
  readonly theme = input<PaymentTheme>('system');

  readonly success = output<PaymentResult>();
  readonly cancel = output<PaymentResult>();
  readonly error = output<PaymentError>();

  readonly resolvedTheme = this.themeService.resolvedTheme;
  readonly availableMethods = this.orchestrator.availableMethods;
  readonly loading = this.orchestrator.loading;

  /** Method currently selected in the payment method grid. */
  readonly selectedMethod = signal<PaymentMethod | null>(null);

  /** Method currently processing a mock payment. */
  private readonly processingMethod = signal<PaymentMethod | null>(null);

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

  /** True when real Stripe card UI should stay mounted (even if another method is selected). */
  readonly hasRealCardMethod = computed(() =>
    this.visibleMethods().some((entry) => entry.method === 'card' && !entry.isMock),
  );

  /** True when real PayPal UI should stay mounted. */
  readonly hasRealPayPalMethod = computed(() =>
    this.visibleMethods().some((entry) => entry.method === 'paypal' && !entry.isMock),
  );

  readonly showMockPanel = computed(() => {
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
    return true;
  });

  readonly showStripePanel = computed(() => this.hasRealCardMethod());
  readonly showPayPalPanel = computed(() => this.hasRealPayPalMethod());

  readonly stripePanelActive = computed(
    () => this.selectedMethod() === 'card' && this.hasRealCardMethod(),
  );

  readonly paypalPanelActive = computed(
    () => this.selectedMethod() === 'paypal' && this.hasRealPayPalMethod(),
  );

  constructor() {
    effect(() => {
      this.themeService.setTheme(this.theme());
    });

    effect(() => {
      const product = this.product();
      const methods = this.methods();
      const checkout = this.checkout();

      untracked(() => {
        void this.orchestrator.refreshAvailability(methods, product, checkout).catch((err: unknown) => {
          this.error.emit(normalizeError(err));
        });
      });
    });

    // Keep selection valid as availability / order changes.
    effect(() => {
      const visible = this.visibleMethods();
      const current = untracked(() => this.selectedMethod());

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

  selectMethod(method: PaymentMethod): void {
    this.selectedMethod.set(method);
  }

  isMethodLoading(method: PaymentMethod): boolean {
    return this.loading() && this.processingMethod() === method;
  }

  onStripeSuccess(result: PaymentResult): void {
    this.success.emit(result);
  }

  onStripeCancel(result: PaymentResult): void {
    this.cancel.emit(result);
  }

  onStripeError(error: PaymentError): void {
    this.error.emit(error);
  }

  onPayPalSuccess(result: PaymentResult): void {
    this.success.emit(result);
  }

  onPayPalCancel(result: PaymentResult): void {
    this.cancel.emit(result);
  }

  onPayPalError(error: PaymentError): void {
    this.error.emit(error);
  }

  async onPay(method: PaymentMethod): Promise<void> {
    this.processingMethod.set(method);

    try {
      const result = await this.orchestrator.processPayment(method, this.product(), this.checkout());

      if (result.status === 'success') {
        this.success.emit(result);
      } else if (result.status === 'cancelled') {
        this.cancel.emit(result);
      } else {
        this.error.emit(
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
        this.cancel.emit({
          status: 'cancelled',
          method,
          provider: paymentError.provider ?? 'stripe',
          message: paymentError.message,
        });
      } else {
        this.error.emit(paymentError);
      }
    } finally {
      this.processingMethod.set(null);
    }
  }
}
