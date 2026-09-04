import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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

/** Demo = all mocks. Real = every configured TEST/Sandbox provider becomes live. */
type DemoMode = 'demo' | 'real';

/** Mirrors NestJS CatalogProduct — display must match charged amount in Real mode. */
interface TrustedCatalogProduct {
  id: string;
  name: string;
  description: string;
  unitAmount: number;
  currency: string;
}

const DEFAULT_PRODUCT: PaymentProduct = {
  id: 'premium-plan',
  name: 'Premium Plan',
  description: 'One year subscription',
  amount: 99.99,
  currency: 'USD',
  quantity: 1,
};

const DEFAULT_METHODS: MethodRow[] = [
  { method: 'card', enabled: true },
  { method: 'paypal', enabled: true },
  { method: 'apple-pay', enabled: true },
  { method: 'google-pay', enabled: true },
  { method: 'klarna', enabled: true },
  { method: 'affirm', enabled: true },
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
  private readonly http = inject(HttpClient);

  readonly productName = signal(DEFAULT_PRODUCT.name);
  readonly productDescription = signal(DEFAULT_PRODUCT.description ?? '');
  readonly productAmount = signal(String(DEFAULT_PRODUCT.amount));
  readonly productCurrency = signal(DEFAULT_PRODUCT.currency);
  readonly productQuantity = signal(String(DEFAULT_PRODUCT.quantity ?? 1));
  readonly theme = signal<PaymentTheme>('system');
  /** Demo-only control for <easy-payments [maxWidth]>. */
  readonly checkoutMaxWidth = signal(640);
  readonly methodRows = signal<MethodRow[]>(DEFAULT_METHODS.map((row) => ({ ...row })));
  readonly lastEvent = signal<string>('No payment events yet.');
  readonly mode = signal<DemoMode>('demo');
  readonly modeMessage = signal<string | null>(null);
  readonly switchingMode = signal(false);
  /** When set, Real mode displays/charges from this trusted catalog entry. */
  readonly trustedCatalogProduct = signal<TrustedCatalogProduct | null>(null);

  readonly product = computed<PaymentProduct>(() => {
    const trusted = this.trustedCatalogProduct();
    const quantity = Number(this.productQuantity());

    if (this.mode() === 'real' && trusted) {
      return {
        id: trusted.id,
        name: trusted.name,
        description: trusted.description,
        amount: trusted.unitAmount,
        currency: trusted.currency,
        quantity: Number.isFinite(quantity) && quantity >= 1 ? quantity : 1,
      };
    }

    return {
      id: 'premium-plan',
      name: this.productName(),
      description: this.productDescription(),
      amount: Number(this.productAmount()),
      currency: this.productCurrency().trim().toUpperCase(),
      quantity: Number.isFinite(quantity) && quantity >= 1 ? quantity : 1,
    };
  });

  readonly methods = computed(() =>
    this.methodRows()
      .filter((row) => row.enabled)
      .map((row) => row.method),
  );

  readonly configStatus = computed(() => this.configValidator.getStatusSummary(this.methods()));

  readonly stripeConfigReady = computed(() => {
    const key = environment.stripePublishableKey?.trim() ?? '';
    const url = environment.createPaymentUrl?.trim() ?? '';
    return /^pk_(test|live)_/i.test(key) && !!url && !key.includes('xxxx');
  });

  readonly paypalConfigReady = computed(() => {
    const clientId = environment.paypalClientId?.trim() ?? '';
    const createUrl = environment.paypalCreateOrderUrl?.trim() ?? '';
    const captureUrl = environment.paypalCaptureOrderUrl?.trim() ?? '';
    return !!clientId && !clientId.includes('REPLACE') && !!createUrl && !!captureUrl;
  });

  readonly realProvidersReady = computed(
    () => this.stripeConfigReady() || this.paypalConfigReady(),
  );

  readonly productFieldsLocked = computed(() => this.mode() === 'real');

  constructor() {
    this.mockController.setDelay(350);
    this.applyThemeFromQuery();
  }

  private applyThemeFromQuery(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const value = new URLSearchParams(window.location.search).get('theme');
    if (value === 'light' || value === 'dark' || value === 'system') {
      this.theme.set(value);
    }
  }

  setTheme(theme: PaymentTheme): void {
    this.theme.set(theme);
  }

  setCheckoutMaxWidth(value: number | string): void {
    const numeric = typeof value === 'number' ? value : Number(value);
    this.checkoutMaxWidth.set(Number.isFinite(numeric) ? numeric : 640);
  }

  setMockOutcome(outcome: 'success' | 'cancelled' | 'failed'): void {
    this.mockController.setOutcome(outcome);
  }

  mockOutcome(): 'success' | 'cancelled' | 'failed' {
    return this.mockController.outcome();
  }

  private async loadTrustedCatalogProduct(productId: string): Promise<TrustedCatalogProduct> {
    const base = environment.catalogProductUrl?.trim().replace(/\/$/, '');
    if (!base) {
      throw new Error('catalogProductUrl is not configured in environment.ts');
    }
    return firstValueFrom(this.http.get<TrustedCatalogProduct>(`${base}/${encodeURIComponent(productId)}`));
  }

  async setMode(mode: DemoMode): Promise<void> {
    if (mode === this.mode() || this.switchingMode()) {
      return;
    }

    if (mode === 'real' && !this.realProvidersReady()) {
      this.modeMessage.set(
        'Real / Test Providers mode requires Stripe (pk_test_...) and/or PayPal Sandbox Client ID plus NestJS backend URLs. See projects/demo/src/environments/environment.example.ts.',
      );
      return;
    }

    this.switchingMode.set(true);
    this.modeMessage.set(null);

    try {
      if (mode === 'demo') {
        this.trustedCatalogProduct.set(null);
        this.configService.replace({
          enableMockMode: true,
          providers: {},
        });
        this.mockController.reset();
        this.mockController.setDelay(350);
      } else {
        const trusted = await this.loadTrustedCatalogProduct('premium-plan');
        this.trustedCatalogProduct.set(trusted);
        // Keep playground fields in sync with catalog for visibility when locked.
        this.productName.set(trusted.name);
        this.productDescription.set(trusted.description);
        this.productAmount.set(String(trusted.unitAmount));
        this.productCurrency.set(trusted.currency);

        this.configService.replace({
          enableMockMode: false,
          providers: {
            ...(this.stripeConfigReady()
              ? {
                  stripe: {
                    publishableKey: environment.stripePublishableKey.trim(),
                  },
                  // Google Pay TEST reuses Stripe as PAYMENT_GATEWAY processor.
                  googlePay: {
                    environment: 'TEST' as const,
                    merchantName: 'Easy Payments Demo',
                    countryCode: 'US',
                  },
                }
              : {}),
            ...(this.paypalConfigReady()
              ? {
                  paypal: {
                    clientId: environment.paypalClientId.trim(),
                    currency: trusted.currency,
                    intent: 'capture' as const,
                  },
                }
              : {}),
          },
          backend: {
            createPaymentUrl: environment.createPaymentUrl.trim(),
            paypalCreateOrderUrl: environment.paypalCreateOrderUrl.trim(),
            paypalCaptureOrderUrl: environment.paypalCaptureOrderUrl.trim(),
          },
        });
      }

      this.mode.set(mode);
      await this.orchestrator.reinitialize();
      await this.orchestrator.refreshAvailability(this.methods(), this.product());
    } catch (error) {
      this.trustedCatalogProduct.set(null);
      this.modeMessage.set(
        error instanceof Error
          ? error.message
          : 'Failed to switch payment mode. Is the NestJS catalog endpoint running?',
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

  onSuccessContinue(result: PaymentResult): void {
    // Library already resets the checkout view; keep playground config intact.
    this.lastEvent.set(
      `Continue after success (${result.method}) — checkout reset for another test payment.`,
    );
  }

  onPaymentCancel(result: PaymentResult): void {
    this.lastEvent.set(`Cancelled (${result.method}): ${result.message ?? 'Payment cancelled'}`);
  }

  onPaymentError(error: PaymentError): void {
    this.lastEvent.set(`Error (${error.method ?? 'unknown'}): [${error.code}] ${error.message}`);
  }
}
