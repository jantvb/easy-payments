import { inject, Injectable } from '@angular/core';
import { ApplePayProviderConfig } from '../../config/easy-payments.config';
import { EASY_PAYMENTS_CONFIG } from '../../config/provide-easy-payments';
import { PaymentContext, PaymentRequest, PaymentResult } from '../../models';
import { PaymentError } from '../../errors/payment-error';
import { BrowserGuard } from '../../utils/browser-guard';
import { BaseMockAdapter, BaseProviderAdapter, realPaymentsNotImplemented } from '../base.adapter';

declare global {
  interface Window {
    ApplePaySession?: {
      canMakePayments(): boolean;
      canMakePaymentsWithActiveCard(merchantId: string): Promise<boolean>;
      STATUS_SUCCESS: number;
      STATUS_FAILURE: number;
      new (version: number, request: ApplePayPaymentRequest): ApplePaySessionInstance;
    };
  }
}

interface ApplePayPaymentRequest {
  countryCode: string;
  currencyCode: string;
  supportedNetworks: string[];
  merchantCapabilities: string[];
  total: { label: string; amount: string; type: string };
}

interface ApplePaySessionInstance {
  begin(): void;
  abort(): void;
  onvalidatemerchant: ((event: { validationURL: string }) => void) | null;
  onpaymentauthorized: ((event: { payment: unknown }) => void) | null;
  oncancel: (() => void) | null;
  completeMerchantValidation(merchantSession: unknown): void;
  completePayment(status: number): void;
}

@Injectable({ providedIn: 'root' })
export class ApplePayAdapter extends BaseProviderAdapter {
  readonly provider = 'applePay' as const;

  private readonly config = inject(EASY_PAYMENTS_CONFIG);
  private readonly browser = inject(BrowserGuard);

  private applePayConfig: ApplePayProviderConfig | null = null;

  async initialize(): Promise<void> {
    this.applePayConfig = this.config?.providers?.applePay ?? null;
    this.initialized = true;
  }

  async isAvailable(context: PaymentContext): Promise<boolean> {
    if (!this.applePayConfig?.merchantId) {
      return false;
    }

    const ApplePaySession = this.browser.getWindow()?.ApplePaySession;
    if (!ApplePaySession?.canMakePayments) {
      return false;
    }

    if (!ApplePaySession.canMakePayments()) {
      return false;
    }

    try {
      const canPay = await ApplePaySession.canMakePaymentsWithActiveCard(
        this.applePayConfig.merchantId,
      );
      return canPay && !!context.product.currency;
    } catch {
      return false;
    }
  }

  async createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    throw realPaymentsNotImplemented('apple-pay', 'applePay');
  }
}

@Injectable({ providedIn: 'root' })
export class ApplePayMockAdapter extends BaseMockAdapter {
  readonly provider = 'applePay' as const;
  readonly method = 'apple-pay' as const;
}
