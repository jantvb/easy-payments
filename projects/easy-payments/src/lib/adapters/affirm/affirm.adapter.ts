import { inject, Injectable } from '@angular/core';
import { AffirmProviderConfig } from '../../config/easy-payments.config';
import { EASY_PAYMENTS_CONFIG } from '../../config/provide-easy-payments';
import { PaymentContext, PaymentRequest, PaymentResult } from '../../models';
import { PaymentError } from '../../errors/payment-error';
import { SdkLoaderService } from '../../loaders/sdk-loader.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { BaseMockAdapter, BaseProviderAdapter, realPaymentsNotImplemented } from '../base.adapter';

declare global {
  interface Window {
    affirm?: {
      ui: {
        ready(): Promise<void>;
        paymentMethod: {
          open(options: {
            checkoutAri: string;
            onFail?: (error: unknown) => void;
            onSuccess?: (checkout: { created_at?: string; checkout_token?: string }) => void;
            onCancel?: () => void;
          }): void;
        };
      };
      checkout?: (config: Record<string, unknown>) => { open: (options: Record<string, unknown>) => void };
    };
  }
}

const AFFIRM_SUPPORTED_CURRENCIES = new Set(['USD', 'CAD']);

@Injectable({ providedIn: 'root' })
export class AffirmAdapter extends BaseProviderAdapter {
  readonly provider = 'affirm' as const;

  private readonly config = inject(EASY_PAYMENTS_CONFIG);
  private readonly sdkLoader = inject(SdkLoaderService);
  private readonly browser = inject(BrowserGuard);

  private affirmConfig: AffirmProviderConfig | null = null;

  async initialize(): Promise<void> {
    this.affirmConfig = this.config?.providers?.affirm ?? null;
    if (!this.affirmConfig?.publicKey) {
      return;
    }

    const scriptUrl =
      this.affirmConfig.scriptUrl ??
      `https://cdn1-sandbox.affirm.com/js/v2/affirm.js`;

    await this.sdkLoader.loadScript({
      id: 'affirm-sdk',
      src: scriptUrl,
      attributes: { 'data-public-key': this.affirmConfig.publicKey },
    });

    const affirm = this.browser.getWindow()?.affirm;
    if (!affirm) {
      throw new PaymentError({
        code: 'SDK_LOAD_FAILED',
        message: 'Affirm SDK failed to load.',
        provider: 'affirm',
      });
    }

    await affirm.ui.ready();
    this.initialized = true;
  }

  async isAvailable(context: PaymentContext): Promise<boolean> {
    if (!this.affirmConfig?.publicKey || !this.initialized) {
      return false;
    }

    if (!AFFIRM_SUPPORTED_CURRENCIES.has(context.product.currency)) {
      return false;
    }

    // Affirm typically supports $50–$30,000 USD
    const amountCents = context.product.amount * 100;
    if (amountCents < 5000 || amountCents > 3000000) {
      return false;
    }

    return !!this.browser.getWindow()?.affirm;
  }

  async createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    throw realPaymentsNotImplemented('affirm', 'affirm');
  }
}

@Injectable({ providedIn: 'root' })
export class AffirmMockAdapter extends BaseMockAdapter {
  readonly provider = 'affirm' as const;
  readonly method = 'affirm' as const;
}
