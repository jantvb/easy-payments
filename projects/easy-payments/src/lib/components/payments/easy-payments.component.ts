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
import { ApplePayButtonComponent } from '../payment-methods/apple-pay-button.component';
import { GooglePayButtonComponent } from '../payment-methods/google-pay-button.component';
import { SamsungPayButtonComponent } from '../payment-methods/samsung-pay-button.component';
import { PayPalButtonComponent } from '../payment-methods/paypal-button.component';
import { KlarnaButtonComponent } from '../payment-methods/klarna-button.component';
import { AffirmButtonComponent } from '../payment-methods/affirm-button.component';
import { CardPaymentComponent } from '../payment-methods/card-payment.component';
import { StripeCardPaymentComponent } from '../payment-methods/stripe-card-payment.component';

@Component({
  selector: 'easy-payments',
  standalone: true,
  imports: [
    ApplePayButtonComponent,
    GooglePayButtonComponent,
    SamsungPayButtonComponent,
    PayPalButtonComponent,
    KlarnaButtonComponent,
    AffirmButtonComponent,
    CardPaymentComponent,
    StripeCardPaymentComponent,
  ],
  templateUrl: './easy-payments.component.html',
  styleUrl: './easy-payments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ep-theme-light]': 'resolvedTheme() === "light"',
    '[class.ep-theme-dark]': 'resolvedTheme() === "dark"',
    '[attr.data-theme]': 'resolvedTheme()',
    role: 'region',
    'aria-label': 'Payment methods',
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

  private readonly activeMethod = signal<PaymentMethod | null>(null);

  readonly visibleMethods = computed(() => {
    const requested = this.methods();
    const availability = this.availableMethods();

    return requested
      .map((method) => availability.find((a) => a.method === method))
      .filter((entry): entry is NonNullable<typeof entry> => !!entry && entry.available);
  });

  readonly showDemoBanner = computed(() => this.visibleMethods().some((entry) => entry.isMock));

  constructor() {
    effect(() => {
      this.themeService.setTheme(this.theme());
    });

    effect(() => {
      const product = this.product();
      const methods = this.methods();
      const checkout = this.checkout();

      // Avoid tracking orchestrator signals written by refreshAvailability.
      untracked(() => {
        void this.orchestrator.refreshAvailability(methods, product, checkout).catch((err: unknown) => {
          this.error.emit(normalizeError(err));
        });
      });
    });
  }

  isMethodLoading(method: PaymentMethod): boolean {
    return this.loading() && this.activeMethod() === method;
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

  async onPay(method: PaymentMethod): Promise<void> {
    this.activeMethod.set(method);

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
      this.activeMethod.set(null);
    }
  }
}
