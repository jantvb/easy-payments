import { inject, Injectable } from '@angular/core';
import { SamsungPayProviderConfig } from '../../config/easy-payments.config';
import { EASY_PAYMENTS_CONFIG } from '../../config/provide-easy-payments';
import { PaymentContext, PaymentRequest, PaymentResult } from '../../models';
import { PaymentError } from '../../errors/payment-error';
import { SdkLoaderService } from '../../loaders/sdk-loader.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { BaseMockAdapter, BaseProviderAdapter, realPaymentsNotImplemented } from '../base.adapter';

declare global {
  interface Window {
    SamsungPay?: {
      PaymentClient: new (options: { environment: string }) => SamsungPaymentClient;
    };
  }
}

interface SamsungPaymentClient {
  isReadyToPay(criteria: SamsungPayCriteria): Promise<{ result: boolean }>;
  loadPaymentSheet(request: SamsungPaymentSheetRequest): Promise<SamsungPaymentSheetResponse>;
}

interface SamsungPayCriteria {
  version: string;
  serviceId: string;
  allowedBrands: string[];
}

interface SamsungPaymentSheetRequest {
  orderId: string;
  amount: { currency: string; total: string };
  merchant: { name: string; id: string };
}

interface SamsungPaymentSheetResponse {
  paymentCredential?: { token?: string };
}

@Injectable({ providedIn: 'root' })
export class SamsungPayAdapter extends BaseProviderAdapter {
  readonly provider = 'samsungPay' as const;

  private readonly config = inject(EASY_PAYMENTS_CONFIG);
  private readonly sdkLoader = inject(SdkLoaderService);
  private readonly browser = inject(BrowserGuard);

  private samsungConfig: SamsungPayProviderConfig | null = null;
  private paymentClient: SamsungPaymentClient | null = null;

  async initialize(): Promise<void> {
    this.samsungConfig = this.config?.providers?.samsungPay ?? null;
    if (!this.samsungConfig?.merchantId) {
      return;
    }

    // Samsung Pay Web SDK - load when merchant provides serviceId
    if (this.samsungConfig.serviceId) {
      await this.sdkLoader.loadScript({
        id: 'samsung-pay-sdk',
        src: 'https://img.mpay.samsung.com/gs/mpay/js/mpay-web.min.js',
      });

      const SamsungPay = this.browser.getWindow()?.SamsungPay;
      if (SamsungPay?.PaymentClient) {
        this.paymentClient = new SamsungPay.PaymentClient({ environment: 'PRODUCTION' });
      }
    }

    this.initialized = true;
  }

  async isAvailable(context: PaymentContext): Promise<boolean> {
    if (!this.samsungConfig?.merchantId || !this.samsungConfig.serviceId || !this.paymentClient) {
      return false;
    }

    try {
      const response = await this.paymentClient.isReadyToPay({
        version: '2',
        serviceId: this.samsungConfig.serviceId,
        allowedBrands: ['visa', 'mastercard', 'amex'],
      });
      return response.result && !!context.product.currency;
    } catch {
      return false;
    }
  }

  async createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    throw realPaymentsNotImplemented('samsung-pay', 'samsungPay');
  }
}

@Injectable({ providedIn: 'root' })
export class SamsungPayMockAdapter extends BaseMockAdapter {
  readonly provider = 'samsungPay' as const;
  readonly method = 'samsung-pay' as const;
}
