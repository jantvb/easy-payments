import { inject, Injectable } from '@angular/core';
import { PayPalProviderConfig } from '../../config/easy-payments.config';
import { EASY_PAYMENTS_CONFIG } from '../../config/provide-easy-payments';
import { PaymentContext, PaymentRequest, PaymentResult } from '../../models';
import { PaymentError } from '../../errors/payment-error';
import { SdkLoaderService } from '../../loaders/sdk-loader.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { BaseMockAdapter, BaseProviderAdapter, realPaymentsNotImplemented } from '../base.adapter';

declare global {
  interface Window {
    paypal?: {
      Buttons(options: Record<string, unknown>): { render(selector: string | HTMLElement): Promise<void> };
    };
  }
}

@Injectable({ providedIn: 'root' })
export class PayPalAdapter extends BaseProviderAdapter {
  readonly provider = 'paypal' as const;

  private readonly config = inject(EASY_PAYMENTS_CONFIG);
  private readonly sdkLoader = inject(SdkLoaderService);
  private readonly browser = inject(BrowserGuard);

  private paypalConfig: PayPalProviderConfig | null = null;

  async initialize(): Promise<void> {
    this.paypalConfig = this.config?.providers?.paypal ?? null;
    if (!this.paypalConfig?.clientId) {
      return;
    }

    const currency = this.paypalConfig.currency ?? 'USD';
    await this.sdkLoader.loadScript({
      id: 'paypal-sdk',
      src: `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(this.paypalConfig.clientId)}&currency=${currency}&intent=${this.paypalConfig.intent ?? 'capture'}`,
    });

    if (!this.browser.getWindow()?.paypal) {
      throw new PaymentError({
        code: 'SDK_LOAD_FAILED',
        message: 'PayPal SDK failed to load.',
        provider: 'paypal',
      });
    }

    this.initialized = true;
  }

  async isAvailable(_context: PaymentContext): Promise<boolean> {
    return !!(this.paypalConfig?.clientId && this.initialized && this.browser.getWindow()?.paypal);
  }

  async createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    throw realPaymentsNotImplemented('paypal', 'paypal');
  }
}

@Injectable({ providedIn: 'root' })
export class PayPalMockAdapter extends BaseMockAdapter {
  readonly provider = 'paypal' as const;
  readonly method = 'paypal' as const;
}
