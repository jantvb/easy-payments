import { inject, Injectable } from '@angular/core';
import { GooglePayProviderConfig } from '../../config/easy-payments.config';
import { EASY_PAYMENTS_CONFIG } from '../../config/provide-easy-payments';
import { PaymentContext, PaymentRequest, PaymentResult } from '../../models';
import { PaymentError } from '../../errors/payment-error';
import { SdkLoaderService } from '../../loaders/sdk-loader.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { BaseMockAdapter, BaseProviderAdapter, realPaymentsNotImplemented } from '../base.adapter';

declare global {
  interface Window {
    google?: {
      payments?: {
        api: {
          PaymentsClient: new (options: { environment: string }) => GooglePaymentsClient;
        };
      };
    };
  }
}

interface GooglePaymentsClient {
  isReadyToPay(request: GoogleIsReadyToPayRequest): Promise<{ result: boolean }>;
  loadPaymentData(request: GooglePaymentDataRequest): Promise<GooglePaymentData>;
}

interface GoogleIsReadyToPayRequest {
  apiVersion: number;
  apiVersionMinor: number;
  allowedPaymentMethods: unknown[];
}

interface GooglePaymentDataRequest {
  apiVersion: number;
  apiVersionMinor: number;
  allowedPaymentMethods: unknown[];
  transactionInfo: {
    totalPriceStatus: string;
    totalPrice: string;
    currencyCode: string;
  };
  merchantInfo: { merchantId: string; merchantName?: string };
}

interface GooglePaymentData {
  paymentMethodData?: { tokenizationData?: { token?: string } };
}

@Injectable({ providedIn: 'root' })
export class GooglePayAdapter extends BaseProviderAdapter {
  readonly provider = 'googlePay' as const;

  private readonly config = inject(EASY_PAYMENTS_CONFIG);
  private readonly sdkLoader = inject(SdkLoaderService);
  private readonly browser = inject(BrowserGuard);

  private googlePayConfig: GooglePayProviderConfig | null = null;
  private paymentsClient: GooglePaymentsClient | null = null;

  async initialize(): Promise<void> {
    this.googlePayConfig = this.config?.providers?.googlePay ?? null;
    if (!this.googlePayConfig?.merchantId) {
      return;
    }

    await this.sdkLoader.loadScript({
      id: 'google-pay-sdk',
      src: 'https://pay.google.com/gp/p/js/pay.js',
    });

    const google = this.browser.getWindow()?.google;
    if (!google?.payments?.api) {
      throw new PaymentError({
        code: 'SDK_LOAD_FAILED',
        message: 'Google Pay SDK failed to load.',
        provider: 'googlePay',
      });
    }

    this.paymentsClient = new google.payments.api.PaymentsClient({
      environment: this.googlePayConfig.environment ?? 'TEST',
    });

    this.initialized = true;
  }

  private getBaseCardPaymentMethod(): unknown {
    return {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['AMEX', 'DISCOVER', 'MASTERCARD', 'VISA'],
      },
      tokenizationSpecification: this.googlePayConfig?.gateway
        ? {
            type: 'PAYMENT_GATEWAY',
            parameters: {
              gateway: this.googlePayConfig.gateway,
              gatewayMerchantId: this.googlePayConfig.gatewayMerchantId,
            },
          }
        : undefined,
    };
  }

  async isAvailable(context: PaymentContext): Promise<boolean> {
    if (!this.googlePayConfig?.merchantId || !this.paymentsClient) {
      return false;
    }

    try {
      const response = await this.paymentsClient.isReadyToPay({
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [this.getBaseCardPaymentMethod()],
      });
      return response.result && !!context.product.currency;
    } catch {
      return false;
    }
  }

  async createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    throw realPaymentsNotImplemented('google-pay', 'googlePay');
  }
}

@Injectable({ providedIn: 'root' })
export class GooglePayMockAdapter extends BaseMockAdapter {
  readonly provider = 'googlePay' as const;
  readonly method = 'google-pay' as const;
}
