import { inject, Injectable, Injector } from '@angular/core';
import { EasyPaymentsProviderConfig } from '../config/easy-payments.config';
import { EasyPaymentsConfigService } from '../config/easy-payments-config.service';
import { AdapterRegistry } from '../core/adapter-registry';
import { PaymentProviderAdapter } from '../core/payment-provider.adapter';
import { PaymentProviderName } from '../models';
import { EasyPaymentsConfigValidator } from '../validators/config.validator';
import { StripeCardAdapter, StripeCardMockAdapter } from './stripe/stripe-card.adapter';
import { PayPalAdapter, PayPalMockAdapter } from './paypal/paypal.adapter';
import { ApplePayAdapter, ApplePayMockAdapter } from './apple-pay/apple-pay.adapter';
import { GooglePayAdapter, GooglePayMockAdapter } from './google-pay/google-pay.adapter';
import { SamsungPayAdapter, SamsungPayMockAdapter } from './samsung-pay/samsung-pay.adapter';
import { KlarnaAdapter, KlarnaMockAdapter } from './klarna/klarna.adapter';
import { AffirmAdapter, AffirmMockAdapter } from './affirm/affirm.adapter';

type ProviderKey = keyof EasyPaymentsProviderConfig;

const REAL_ADAPTERS: Record<PaymentProviderName, new (...args: never[]) => PaymentProviderAdapter> = {
  stripe: StripeCardAdapter,
  paypal: PayPalAdapter,
  applePay: ApplePayAdapter,
  googlePay: GooglePayAdapter,
  samsungPay: SamsungPayAdapter,
  klarna: KlarnaAdapter,
  affirm: AffirmAdapter,
};

const MOCK_ADAPTERS: Record<PaymentProviderName, new (...args: never[]) => PaymentProviderAdapter> = {
  stripe: StripeCardMockAdapter,
  paypal: PayPalMockAdapter,
  applePay: ApplePayMockAdapter,
  googlePay: GooglePayMockAdapter,
  samsungPay: SamsungPayMockAdapter,
  klarna: KlarnaMockAdapter,
  affirm: AffirmMockAdapter,
};

const CONFIG_KEY_MAP: Record<PaymentProviderName, ProviderKey> = {
  stripe: 'stripe',
  paypal: 'paypal',
  applePay: 'applePay',
  googlePay: 'googlePay',
  samsungPay: 'samsungPay',
  klarna: 'klarna',
  affirm: 'affirm',
};

@Injectable({ providedIn: 'root' })
export class AdapterFactory {
  private readonly configService = inject(EasyPaymentsConfigService);
  private readonly registry = inject(AdapterRegistry);
  private readonly validator = inject(EasyPaymentsConfigValidator);
  private readonly injector = inject(Injector);

  async initializeAdapters(): Promise<void> {
    for (const adapter of this.registry.getAll()) {
      await adapter.destroy?.();
    }
    this.registry.clear();

    const providers = Object.keys(REAL_ADAPTERS) as PaymentProviderName[];

    for (const provider of providers) {
      const adapter = this.createAdapter(provider);
      this.registry.register(adapter);
      await adapter.initialize();
    }
  }

  createAdapter(provider: PaymentProviderName): PaymentProviderAdapter {
    const config = this.configService.getSnapshot();
    const configKey = CONFIG_KEY_MAP[provider];
    const validation = this.validator.validateProvider(
      configKey,
      config.providers?.[configKey],
    );

    const useMock =
      config.enableMockMode === true ||
      validation.status === 'missing' ||
      validation.status === 'invalid';

    const AdapterClass = useMock ? MOCK_ADAPTERS[provider] : REAL_ADAPTERS[provider];
    return this.injector.get(AdapterClass);
  }

  getAdapter(provider: PaymentProviderName): PaymentProviderAdapter | undefined {
    return this.registry.get(provider);
  }
}
