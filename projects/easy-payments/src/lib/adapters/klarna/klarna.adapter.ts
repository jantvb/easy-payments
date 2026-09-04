import { inject, Injectable } from '@angular/core';
import { KlarnaProviderConfig } from '../../config/easy-payments.config';
import { EASY_PAYMENTS_CONFIG } from '../../config/provide-easy-payments';
import { PaymentContext, PaymentRequest, PaymentResult } from '../../models';
import { PaymentError } from '../../errors/payment-error';
import { SdkLoaderService } from '../../loaders/sdk-loader.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { BaseMockAdapter, BaseProviderAdapter, realPaymentsNotImplemented } from '../base.adapter';

declare global {
  interface Window {
    Klarna?: {
      Payments: {
        init(options: { client_token: string }): void;
        load(
          options: { container: string | HTMLElement; payment_method_category?: string },
          data: Record<string, unknown>,
          callback?: (res: { show_form: boolean; error?: unknown }) => void,
        ): void;
        authorize(
          options: { payment_method_category?: string },
          data: Record<string, unknown>,
          callback: (res: { approved: boolean; authorization_token?: string; error?: unknown }) => void,
        ): void;
      };
    };
  }
}

const KLARNA_SUPPORTED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK']);

@Injectable({ providedIn: 'root' })
export class KlarnaAdapter extends BaseProviderAdapter {
  readonly provider = 'klarna' as const;

  private readonly config = inject(EASY_PAYMENTS_CONFIG);
  private readonly sdkLoader = inject(SdkLoaderService);
  private readonly browser = inject(BrowserGuard);

  private klarnaConfig: KlarnaProviderConfig | null = null;

  async initialize(): Promise<void> {
    this.klarnaConfig = this.config?.providers?.klarna ?? null;
    if (!this.klarnaConfig?.clientId) {
      return;
    }

    const env = this.klarnaConfig.environment ?? 'playground';
    const baseUrl =
      env === 'production' ? 'https://js.klarna.com/web/v1' : 'https://js.playground.klarna.com/web/v1';

    await this.sdkLoader.loadScript({
      id: 'klarna-sdk',
      src: `${baseUrl}/klarna.js`,
      attributes: { 'data-client-id': this.klarnaConfig.clientId },
    });

    if (!this.browser.getWindow()?.Klarna) {
      throw new PaymentError({
        code: 'SDK_LOAD_FAILED',
        message: 'Klarna SDK failed to load.',
        provider: 'klarna',
      });
    }

    this.initialized = true;
  }

  async isAvailable(context: PaymentContext): Promise<boolean> {
    if (!this.klarnaConfig?.clientId || !this.initialized) {
      return false;
    }

    if (!KLARNA_SUPPORTED_CURRENCIES.has(context.product.currency)) {
      return false;
    }

    if (context.product.amount <= 0) {
      return false;
    }

    return !!this.browser.getWindow()?.Klarna;
  }

  async createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    throw realPaymentsNotImplemented('klarna', 'klarna');
  }
}

@Injectable({ providedIn: 'root' })
export class KlarnaMockAdapter extends BaseMockAdapter {
  readonly provider = 'klarna' as const;
  readonly method = 'klarna' as const;
}
