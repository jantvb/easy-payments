import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EasyPaymentsConfigService } from '../config/easy-payments-config.service';
import { PaymentError } from '../errors/payment-error';
import {
  CreatePaymentRequest,
  CreateStripePaymentResponse,
} from '../models/create-payment.model';

@Injectable({ providedIn: 'root' })
export class BackendService {
  private readonly http = inject(HttpClient, { optional: true });
  private readonly configService = inject(EasyPaymentsConfigService);

  get createPaymentUrl(): string | undefined {
    return this.configService.getSnapshot().backend?.createPaymentUrl?.trim() || undefined;
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

    if (!this.http) {
      throw new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'HttpClient is required for backend integration. Call provideHttpClient() in your app config.',
        method: 'card',
        provider: 'stripe',
      });
    }

    try {
      const response = await firstValueFrom(
        this.http.post<CreateStripePaymentResponse>(url, payload),
      );
      return response;
    } catch (error) {
      if (error instanceof PaymentError) {
        throw error;
      }

      const network =
        error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);

      throw new PaymentError({
        code: network ? 'NETWORK_ERROR' : 'BACKEND_ERROR',
        message: network
          ? 'A network error occurred while creating the payment session.'
          : 'Failed to create payment on backend.',
        method: 'card',
        provider: 'stripe',
        originalError: error,
      });
    }
  }
}
