import { Component, computed, inject, signal } from '@angular/core';
import {
  EasyPaymentsComponent,
  EasyPaymentsConfigService,
  EasyPaymentsConfigValidator,
  MockPaymentController,
  PaymentError,
  PaymentMethod,
  PaymentOrchestratorService,
  PaymentProduct,
  PaymentResult,
  PaymentTheme,
  PAYMENT_METHOD_LABELS,
} from 'easy-payments';
import { environment } from '../environments/environment';

interface MethodRow {
  method: PaymentMethod;
  enabled: boolean;
}

type DemoMode = 'demo' | 'stripe';

const DEFAULT_PRODUCT: PaymentProduct = {
  id: 'premium-plan',
  name: 'Premium Plan',
  description: 'One year subscription',
  amount: 99.99,
  currency: 'USD',
  quantity: 1,
};

const DEFAULT_METHODS: MethodRow[] = [
  { method: 'apple-pay', enabled: true },
  { method: 'google-pay', enabled: true },
  { method: 'samsung-pay', enabled: true },
  { method: 'paypal', enabled: true },
  { method: 'klarna', enabled: true },
  { method: 'affirm', enabled: true },
  { method: 'card', enabled: true },
];

@Component({
  selector: 'app-root',
  imports: [EasyPaymentsComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly mockController = inject(MockPaymentController);
  private readonly configValidator = inject(EasyPaymentsConfigValidator);
  private readonly configService = inject(EasyPaymentsConfigService);
  private readonly orchestrator = inject(PaymentOrchestratorService);

  readonly productName = signal(DEFAULT_PRODUCT.name);
  readonly productDescription = signal(DEFAULT_PRODUCT.description ?? '');
  readonly productAmount = signal(String(DEFAULT_PRODUCT.amount));
  readonly productCurrency = signal(DEFAULT_PRODUCT.currency);
  readonly productQuantity = signal(String(DEFAULT_PRODUCT.quantity ?? 1));
  readonly theme = signal<PaymentTheme>('system');
  readonly methodRows = signal<MethodRow[]>(DEFAULT_METHODS.map((row) => ({ ...row })));
  readonly lastEvent = signal<string>('No payment events yet.');
  readonly mode = signal<DemoMode>('demo');
  readonly modeMessage = signal<string | null>(null);
  readonly switchingMode = signal(false);

  readonly product = computed<PaymentProduct>(() => ({
    id: 'premium-plan',
    name: this.productName(),
    description: this.productDescription(),
    amount: Number(this.productAmount()),
    currency: this.productCurrency().trim().toUpperCase(),
    quantity: Number(this.productQuantity()),
  }));

  readonly methods = computed(() =>
    this.methodRows()
      .filter((row) => row.enabled)
      .map((row) => row.method),
  );

  readonly configStatus = computed(() => this.configValidator.getStatusSummary(this.methods()));

  readonly stripeConfigReady = computed(() => {
    const key = environment.stripePublishableKey?.trim() ?? '';
    const url = environment.createPaymentUrl?.trim() ?? '';
    return /^pk_(test|live)_/i.test(key) && !!url;
  });

  constructor() {
    this.mockController.setDelay(350);
  }

  setTheme(theme: PaymentTheme): void {
    this.theme.set(theme);
  }

  setMockOutcome(outcome: 'success' | 'cancelled' | 'failed'): void {
    this.mockController.setOutcome(outcome);
  }

  mockOutcome(): 'success' | 'cancelled' | 'failed' {
    return this.mockController.outcome();
  }

  async setMode(mode: DemoMode): Promise<void> {
    if (mode === this.mode() || this.switchingMode()) {
      return;
    }

    if (mode === 'stripe' && !this.stripeConfigReady()) {
      this.modeMessage.set(
        'Real Stripe mode requires a Stripe publishable key and a backend create-payment endpoint. See projects/demo/src/environments/environment.example.ts.',
      );
      return;
    }

    this.switchingMode.set(true);
    this.modeMessage.set(null);

    try {
      if (mode === 'demo') {
        this.configService.replace({
          enableMockMode: true,
          providers: {},
        });
        this.mockController.reset();
        this.mockController.setDelay(350);
      } else {
        this.configService.replace({
          enableMockMode: false,
          providers: {
            stripe: {
              publishableKey: environment.stripePublishableKey.trim(),
            },
          },
          backend: {
            createPaymentUrl: environment.createPaymentUrl.trim(),
          },
        });
      }

      await this.orchestrator.reinitialize();
      await this.orchestrator.refreshAvailability(this.methods(), this.product());
      this.mode.set(mode);
    } catch (error) {
      this.modeMessage.set(
        error instanceof Error ? error.message : 'Failed to switch payment mode.',
      );
    } finally {
      this.switchingMode.set(false);
    }
  }

  toggleMethod(method: PaymentMethod, enabled: boolean): void {
    this.methodRows.update((rows) =>
      rows.map((row) => (row.method === method ? { ...row, enabled } : row)),
    );
  }

  moveMethod(index: number, direction: -1 | 1): void {
    this.methodRows.update((rows) => {
      const next = [...rows];
      const target = index + direction;
      if (target < 0 || target >= next.length) {
        return next;
      }
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  }

  methodLabel(method: PaymentMethod): string {
    return PAYMENT_METHOD_LABELS[method];
  }

  onPaymentSuccess(result: PaymentResult): void {
    this.lastEvent.set(
      `Success (${result.method}): ${result.message ?? 'Payment completed'} [${result.transactionId ?? 'no id'}]`,
    );
  }

  onPaymentCancel(result: PaymentResult): void {
    this.lastEvent.set(`Cancelled (${result.method}): ${result.message ?? 'Payment cancelled'}`);
  }

  onPaymentError(error: PaymentError): void {
    this.lastEvent.set(`Error (${error.method ?? 'unknown'}): [${error.code}] ${error.message}`);
  }
}
