import { inject, Injectable } from '@angular/core';
import { SdkLoaderService } from '../../loaders/sdk-loader.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { PaymentError } from '../../errors/payment-error';
import { GooglePayNamespace } from './google-pay.types';

const GOOGLE_PAY_SCRIPT_ID = 'easy-payments-google-pay-sdk';
const GOOGLE_PAY_SCRIPT_SRC = 'https://pay.google.com/gp/p/js/pay.js';

/**
 * Lazy-loads Google's official pay.js once and reuses it.
 */
@Injectable({ providedIn: 'root' })
export class GooglePaySdkLoader {
  private readonly sdkLoader = inject(SdkLoaderService);
  private readonly browser = inject(BrowserGuard);
  private loadPromise: Promise<GooglePayNamespace> | null = null;

  async load(): Promise<GooglePayNamespace> {
    if (!this.browser.isBrowser) {
      throw new PaymentError({
        code: 'SDK_LOAD_FAILED',
        message: 'Google Pay SDK can only load in the browser.',
        method: 'google-pay',
        provider: 'googlePay',
      });
    }

    const existing = this.browser.getWindow()?.google;
    if (existing?.payments?.api?.PaymentsClient) {
      return existing;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        await this.sdkLoader.loadScript({
          id: GOOGLE_PAY_SCRIPT_ID,
          src: GOOGLE_PAY_SCRIPT_SRC,
        });
      } catch (error) {
        this.loadPromise = null;
        throw new PaymentError({
          code: 'SDK_LOAD_FAILED',
          message: 'Google Pay SDK failed to load.',
          method: 'google-pay',
          provider: 'googlePay',
          originalError: error,
        });
      }

      const google = this.browser.getWindow()?.google;
      if (!google?.payments?.api?.PaymentsClient) {
        this.loadPromise = null;
        throw new PaymentError({
          code: 'SDK_LOAD_FAILED',
          message: 'Google Pay SDK loaded but PaymentsClient is unavailable.',
          method: 'google-pay',
          provider: 'googlePay',
        });
      }

      return google;
    })();

    return this.loadPromise;
  }

  /** Test helper — clears the in-flight/cached load promise. */
  resetForTests(): void {
    this.loadPromise = null;
  }
}
