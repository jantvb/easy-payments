import { inject, Injectable, signal } from '@angular/core';
import {
  CheckoutOptions,
  PaymentContext,
  PaymentMethod,
  PAYMENT_METHOD_PROVIDER_MAP,
  PaymentProduct,
  PaymentResult,
  PaymentTheme,
  normalizePaymentResult,
} from '../models';
import { PaymentError, normalizeError } from '../errors/payment-error';
import { validatePaymentProduct } from '../validators/product.validator';
import { ThemeService } from '../themes/theme.service';
import { AdapterFactory } from '../adapters/adapter.factory';
import { AdapterRegistry } from '../core/adapter-registry';

export interface AvailablePaymentMethod {
  method: PaymentMethod;
  isMock: boolean;
  available: boolean;
}

@Injectable({ providedIn: 'root' })
export class PaymentOrchestratorService {
  private readonly adapterFactory = inject(AdapterFactory);
  private readonly registry = inject(AdapterRegistry);
  private readonly themeService = inject(ThemeService);

  private readonly _availableMethods = signal<AvailablePaymentMethod[]>([]);
  private readonly _loading = signal(false);
  private initialized = false;

  readonly availableMethods = this._availableMethods.asReadonly();
  readonly loading = this._loading.asReadonly();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.adapterFactory.initializeAdapters();
    this.initialized = true;
  }

  /** Re-register adapters after runtime config changes (e.g. demo mock ↔ Stripe). */
  async reinitialize(): Promise<void> {
    this.initialized = false;
    this._availableMethods.set([]);
    await this.initialize();
  }

  setTheme(theme: PaymentTheme): void {
    this.themeService.setTheme(theme);
  }

  validateProduct(product: PaymentProduct): void {
    const result = validatePaymentProduct(product);
    if (!result.valid) {
      throw new PaymentError({
        code: 'PRODUCT_INVALID',
        message: result.errors.join(' '),
      });
    }
  }

  private buildContext(
    product: PaymentProduct,
    checkout?: CheckoutOptions,
  ): PaymentContext {
    return {
      product,
      checkout,
      theme: this.themeService.resolvedTheme(),
    };
  }

  async refreshAvailability(
    methods: PaymentMethod[],
    product: PaymentProduct,
    checkout?: CheckoutOptions,
  ): Promise<AvailablePaymentMethod[]> {
    await this.initialize();
    this.validateProduct(product);

    const context = this.buildContext(product, checkout);
    const results: AvailablePaymentMethod[] = [];

    for (const method of methods) {
      const provider = PAYMENT_METHOD_PROVIDER_MAP[method];
      const adapter = this.registry.get(provider);

      if (!adapter) {
        results.push({ method, isMock: false, available: false });
        continue;
      }

      try {
        const available = await adapter.isAvailable(context);
        results.push({ method, isMock: adapter.isMock, available });
      } catch {
        results.push({ method, isMock: adapter.isMock, available: false });
      }
    }

    this._availableMethods.set(results);
    return results;
  }

  async processPayment(
    method: PaymentMethod,
    product: PaymentProduct,
    checkout?: CheckoutOptions,
  ): Promise<PaymentResult> {
    await this.initialize();
    this.validateProduct(product);

    const provider = PAYMENT_METHOD_PROVIDER_MAP[method];
    const adapter = this.registry.get(provider);

    if (!adapter) {
      throw new PaymentError({
        code: 'PROVIDER_NOT_CONFIGURED',
        message: `No adapter registered for ${method}.`,
        method,
        provider,
      });
    }

    const context = this.buildContext(product, checkout);

    const available = await adapter.isAvailable(context);
    if (!available) {
      throw new PaymentError({
        code: 'PROVIDER_UNAVAILABLE',
        message: `${method} is not available for this checkout configuration.`,
        method,
        provider,
      });
    }

    this._loading.set(true);

    try {
      const result = await adapter.createPayment({ method, context });
      return normalizePaymentResult(result);
    } catch (error) {
      throw normalizeError(error, { method, provider });
    } finally {
      this._loading.set(false);
    }
  }
}
