import { inject, Injectable } from '@angular/core';
import { EasyPaymentsConfigService } from '../../config/easy-payments-config.service';
import {
  CheckoutOptions,
  PaymentContext,
  PaymentProduct,
  PaymentRequest,
  PaymentResult,
  normalizePaymentResult,
} from '../../models';
import { toPayPalCreateOrderRequest } from '../../models/create-payment.model';
import { PaymentError } from '../../errors/payment-error';
import { SdkLoaderService } from '../../loaders/sdk-loader.service';
import { BackendService } from '../../services/backend.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { BaseMockAdapter, BaseProviderAdapter } from '../base.adapter';
import { mapPayPalError } from './paypal-error.mapper';
import {
  PayPalButtonsHandle,
  PayPalButtonsOptions,
  PayPalNamespace,
} from './paypal.types';

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

@Injectable({ providedIn: 'root' })
export class PayPalAdapter extends BaseProviderAdapter {
  readonly provider = 'paypal' as const;

  private readonly configService = inject(EasyPaymentsConfigService);
  private readonly backend = inject(BackendService);
  private readonly sdkLoader = inject(SdkLoaderService);
  private readonly browser = inject(BrowserGuard);

  private configReady = false;
  private loadPromise: Promise<PayPalNamespace> | null = null;
  private buttons: PayPalButtonsHandle | null = null;
  private creatingOrder = false;
  private capturing = false;
  private activeOrderId: string | null = null;

  /**
   * Validates frontend PayPal config only. Does not load the JS SDK until needed.
   */
  async initialize(): Promise<void> {
    const clientId = this.configService.getSnapshot().providers?.paypal?.clientId?.trim() ?? '';
    this.configReady = !!clientId;
    this.initialized = this.configReady;
  }

  async isAvailable(_context: PaymentContext): Promise<boolean> {
    const snapshot = this.configService.getSnapshot();
    const clientId = snapshot.providers?.paypal?.clientId?.trim() ?? '';
    if (!clientId || !this.configReady) {
      return false;
    }
    if (!snapshot.backend?.paypalCreateOrderUrl?.trim()) {
      return false;
    }
    if (!snapshot.backend?.paypalCaptureOrderUrl?.trim()) {
      return false;
    }
    return true;
  }

  /**
   * Interactive PayPal Buttons flow is handled by PayPalPaymentComponent.
   */
  async createPayment(_request: PaymentRequest): Promise<PaymentResult> {
    throw new PaymentError({
      code: 'PROVIDER_UNAVAILABLE',
      message:
        'PayPal payments require the official PayPal Buttons UI. Use the paypal method inside <easy-payments>.',
      method: 'paypal',
      provider: 'paypal',
    });
  }

  async ensureSdkLoaded(): Promise<PayPalNamespace> {
    if (!this.browser.isBrowser) {
      throw new PaymentError({
        code: 'SDK_LOAD_FAILED',
        message: 'PayPal SDK can only load in the browser.',
        method: 'paypal',
        provider: 'paypal',
      });
    }

    const existing = this.browser.getWindow()?.paypal;
    if (existing) {
      return existing;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    const paypalConfig = this.configService.getSnapshot().providers?.paypal;
    const clientId = paypalConfig?.clientId?.trim() ?? '';
    if (!clientId) {
      throw new PaymentError({
        code: 'CONFIG_MISSING',
        message: 'PayPal clientId is not configured.',
        method: 'paypal',
        provider: 'paypal',
      });
    }

    const currency = (paypalConfig?.currency ?? 'USD').trim().toUpperCase() || 'USD';
    const intent = paypalConfig?.intent ?? 'capture';

    this.loadPromise = (async () => {
      try {
        await this.sdkLoader.loadScript({
          id: 'easy-payments-paypal-sdk',
          src: `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=${encodeURIComponent(intent)}&components=buttons`,
        });
      } catch (error) {
        this.loadPromise = null;
        throw mapPayPalError(error, 'SDK_LOAD_FAILED', 'PayPal SDK failed to load.');
      }

      const paypal = this.browser.getWindow()?.paypal;
      if (!paypal?.Buttons) {
        this.loadPromise = null;
        throw new PaymentError({
          code: 'SDK_LOAD_FAILED',
          message: 'PayPal SDK loaded but window.paypal.Buttons is unavailable.',
          method: 'paypal',
          provider: 'paypal',
        });
      }

      return paypal;
    })();

    return this.loadPromise;
  }

  async createOrder(product: PaymentProduct, _checkout?: CheckoutOptions): Promise<string> {
    if (this.creatingOrder) {
      throw new PaymentError({
        code: 'PAYMENT_FAILED',
        message: 'A PayPal order is already being created.',
        method: 'paypal',
        provider: 'paypal',
      });
    }

    this.creatingOrder = true;
    try {
      const payload = toPayPalCreateOrderRequest({
        productId: product.id,
        quantity: product.quantity ?? 1,
        currency: product.currency,
      });

      const response = await this.backend.createPayPalOrder(payload);
      this.activeOrderId = response.orderId;
      return response.orderId;
    } catch (error) {
      throw mapPayPalError(error, 'BACKEND_ERROR', 'Failed to create PayPal order.');
    } finally {
      this.creatingOrder = false;
    }
  }

  async captureOrder(orderId: string): Promise<PaymentResult> {
    if (this.capturing) {
      throw new PaymentError({
        code: 'PAYMENT_FAILED',
        message: 'A PayPal capture is already in progress.',
        method: 'paypal',
        provider: 'paypal',
      });
    }

    this.capturing = true;
    try {
      const response = await this.backend.capturePayPalOrder(orderId);
      return normalizePaymentResult({
        status: 'success',
        method: 'paypal',
        provider: 'paypal',
        transactionId: response.captureId,
        sessionId: response.orderId,
        message: 'PayPal payment completed.',
        metadata: {
          paypalStatus: response.status,
        },
      });
    } catch (error) {
      throw mapPayPalError(error, 'PAYMENT_FAILED', 'Failed to capture PayPal payment.');
    } finally {
      this.capturing = false;
    }
  }

  async renderButtons(
    container: HTMLElement,
    options: Omit<PayPalButtonsOptions, 'style'> & { style?: Record<string, string> },
  ): Promise<void> {
    await this.destroyButtons();

    const paypal = await this.ensureSdkLoaded();
    const buttons = paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        ...(options.style ?? {}),
      },
      createOrder: options.createOrder,
      onApprove: options.onApprove,
      onCancel: options.onCancel,
      onError: options.onError,
      onClick: options.onClick,
    });

    this.buttons = buttons;
    await buttons.render(container);
  }

  async destroyButtons(): Promise<void> {
    const current = this.buttons;
    this.buttons = null;
    if (current?.close) {
      try {
        await current.close();
      } catch {
        // Ignore close failures during teardown.
      }
    }
  }

  isBusy(): boolean {
    return this.creatingOrder || this.capturing;
  }

  getActiveOrderId(): string | null {
    return this.activeOrderId;
  }

  async destroy(): Promise<void> {
    await this.destroyButtons();
    this.activeOrderId = null;
    this.creatingOrder = false;
    this.capturing = false;
  }
}

@Injectable({ providedIn: 'root' })
export class PayPalMockAdapter extends BaseMockAdapter {
  readonly provider = 'paypal' as const;
  readonly method = 'paypal' as const;
}
