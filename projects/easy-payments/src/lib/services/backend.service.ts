import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EasyPaymentsConfigService } from '../config/easy-payments-config.service';
import { PaymentError } from '../errors/payment-error';
import { PaymentMethod, PaymentProviderName } from '../models';
import {
  CapturePayPalOrderResponse,
  CreateKlarnaPaymentResponse,
  CreatePaymentRequest,
  CreatePayPalOrderResponse,
  CreateStripePaymentResponse,
  KlarnaCreatePaymentRequest,
  PayPalCreateOrderRequest,
  toKlarnaCreatePaymentRequest,
  toPayPalCreateOrderRequest,
} from '../models/create-payment.model';

@Injectable({ providedIn: 'root' })
export class BackendService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly configService = inject(EasyPaymentsConfigService);

  get createPaymentUrl(): string | undefined {
    return this.configService.getSnapshot().backend?.createPaymentUrl?.trim() || undefined;
  }

  get paypalCreateOrderUrl(): string | undefined {
    return this.configService.getSnapshot().backend?.paypalCreateOrderUrl?.trim() || undefined;
  }

  get paypalCaptureOrderUrl(): string | undefined {
    return this.configService.getSnapshot().backend?.paypalCaptureOrderUrl?.trim() || undefined;
  }

  get klarnaCreatePaymentUrl(): string | undefined {
    return this.configService.getSnapshot().backend?.klarnaCreatePaymentUrl?.trim() || undefined;
  }

  /** @deprecated Prefer createPaymentUrl. Kept optional for future provider flows. */
  get confirmPaymentUrl(): string | undefined {
    return this.configService.getSnapshot().backend?.confirmPaymentUrl?.trim() || undefined;
  }

  async createStripePayment(payload: CreatePaymentRequest): Promise<CreateStripePaymentResponse> {
    const url = this.createPaymentUrl;
    if (!url) {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend createPaymentUrl is not configured.',
        method: 'card',
        provider: 'stripe',
      });
    }

    return this.postJson<CreateStripePaymentResponse>(url, payload, 'card', 'stripe', {
      successMessage: 'Failed to create payment on backend.',
      networkMessage: 'A network error occurred while creating the payment session.',
      validate: (response) => {
        if (
          response?.provider !== 'stripe' ||
          typeof response.clientSecret !== 'string' ||
          !response.clientSecret.trim()
        ) {
          throw new PaymentError({
            code: 'BACKEND_ERROR',
            message: 'Invalid Stripe create-payment response from backend.',
            method: 'card',
            provider: 'stripe',
          });
        }
      },
    });
  }

  /**
   * Posts the minimal PayPal create-order wire contract.
   * Never forwards amount / metadata even if callers pass extra fields.
   */
  async createPayPalOrder(
    payload: PayPalCreateOrderRequest | { productId: string; quantity: number; currency: string },
  ): Promise<CreatePayPalOrderResponse> {
    const url = this.paypalCreateOrderUrl;
    if (!url) {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend paypalCreateOrderUrl is not configured.',
        method: 'paypal',
        provider: 'paypal',
      });
    }

    const body = toPayPalCreateOrderRequest(payload);

    return this.postJson<CreatePayPalOrderResponse>(url, body, 'paypal', 'paypal', {
      successMessage: 'Failed to create PayPal order on backend.',
      networkMessage: 'A network error occurred while creating the PayPal order.',
      validate: (response) => {
        if (
          response?.provider !== 'paypal' ||
          typeof response.orderId !== 'string' ||
          !response.orderId.trim()
        ) {
          throw new PaymentError({
            code: 'BACKEND_ERROR',
            message: 'Invalid PayPal create-order response from backend.',
            method: 'paypal',
            provider: 'paypal',
          });
        }
      },
    });
  }

  async capturePayPalOrder(orderId: string): Promise<CapturePayPalOrderResponse> {
    const url = this.paypalCaptureOrderUrl;
    if (!url) {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend paypalCaptureOrderUrl is not configured.',
        method: 'paypal',
        provider: 'paypal',
      });
    }

    const id = orderId?.trim();
    if (!id) {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'PayPal orderId is required to capture payment.',
        method: 'paypal',
        provider: 'paypal',
      });
    }

    return this.postJson<CapturePayPalOrderResponse>(
      url,
      { orderId: id },
      'paypal',
      'paypal',
      {
        successMessage: 'Failed to capture PayPal order on backend.',
        networkMessage: 'A network error occurred while capturing the PayPal payment.',
        validate: (response) => {
          if (
            response?.provider !== 'paypal' ||
            typeof response.orderId !== 'string' ||
            !response.orderId.trim() ||
            typeof response.captureId !== 'string' ||
            !response.captureId.trim()
          ) {
            throw new PaymentError({
              code: 'BACKEND_ERROR',
              message: 'Invalid PayPal capture response from backend.',
              method: 'paypal',
              provider: 'paypal',
            });
          }
        },
      },
    );
  }

  /**
   * Posts the minimal Klarna create-payment wire contract.
   * Never forwards amount / metadata even if callers pass extra fields.
   */
  async createKlarnaPayment(
    payload: KlarnaCreatePaymentRequest | { productId: string; quantity: number; currency: string },
  ): Promise<CreateKlarnaPaymentResponse> {
    const url = this.klarnaCreatePaymentUrl;
    if (!url) {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Backend klarnaCreatePaymentUrl is not configured.',
        method: 'klarna',
        provider: 'klarna',
      });
    }

    const body = toKlarnaCreatePaymentRequest(payload);

    return this.postJson<CreateKlarnaPaymentResponse>(url, body, 'klarna', 'klarna', {
      successMessage: 'Failed to create Klarna payment on backend.',
      networkMessage: 'A network error occurred while creating the Klarna payment session.',
      validate: (response) => {
        if (
          response?.provider !== 'klarna' ||
          typeof response.clientSecret !== 'string' ||
          !response.clientSecret.trim()
        ) {
          throw new PaymentError({
            code: 'BACKEND_ERROR',
            message: 'Invalid Klarna create-payment response from backend.',
            method: 'klarna',
            provider: 'klarna',
          });
        }
      },
    });
  }

  private async postJson<T>(
    url: string,
    payload: unknown,
    method: PaymentMethod,
    provider: PaymentProviderName,
    options: {
      successMessage: string;
      networkMessage: string;
      validate: (response: T) => void;
    },
  ): Promise<T> {
    if (!this.http) {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message:
          'HttpClient is required for backend integration. Call provideHttpClient() in your app config.',
        method,
        provider,
      });
    }

    try {
      const response = await firstValueFrom(this.http.post<T>(url, payload));
      options.validate(response);
      return response;
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }

      const network =
        error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);

      let message = network ? options.networkMessage : options.successMessage;
      if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
        const body = error.error as { message?: string | string[] } | string | null;
        if (body && typeof body === 'object' && body.message) {
          message = Array.isArray(body.message) ? body.message.join('; ') : String(body.message);
        } else if (typeof body === 'string' && body.trim()) {
          message = body;
        }
      }

      throw new PaymentError({
        code: network ? 'NETWORK_ERROR' : 'BACKEND_ERROR',
        message,
        method,
        provider,
        originalError: error,
      });
    }
  }
}
