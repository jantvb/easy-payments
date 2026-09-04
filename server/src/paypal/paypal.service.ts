import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatMajorAmount, getCatalogProduct } from '../catalog/product-catalog';
import { CreatePayPalOrderDto } from './dto/create-paypal-order.dto';

export interface CreatePayPalOrderResult {
  provider: 'paypal';
  orderId: string;
}

export interface CapturePayPalOrderResult {
  provider: 'paypal';
  orderId: string;
  captureId: string;
  status: string;
}

interface PayPalAccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface PayPalOrderResponse {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id?: string; status?: string }>;
    };
  }>;
  message?: string;
  details?: Array<{ issue?: string; description?: string }>;
  name?: string;
}

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiBase: string;
  private readonly configured: boolean;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('PAYPAL_CLIENT_ID')?.trim() ?? '';
    this.clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET')?.trim() ?? '';
    const mode = (this.config.get<string>('PAYPAL_MODE')?.trim() || 'sandbox').toLowerCase();

    this.apiBase =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    this.configured = !!(this.clientId && this.clientSecret);

    if (!this.configured) {
      this.logger.warn(
        'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not configured. PayPal order APIs will fail.',
      );
    } else if (mode === 'live') {
      this.logger.warn(
        'PAYPAL_MODE=live is set. This demo server is intended for Sandbox testing only.',
      );
    }
  }

  async createOrder(dto: CreatePayPalOrderDto): Promise<CreatePayPalOrderResult> {
    this.ensureConfigured();

    const product = getCatalogProduct(dto.productId);
    if (!product) {
      throw new BadRequestException(
        `Unknown productId "${dto.productId}". Use a catalog product (e.g. premium-plan).`,
      );
    }

    if (dto.currency && dto.currency.toUpperCase() !== product.currency) {
      throw new BadRequestException(
        `Currency mismatch: catalog product uses ${product.currency}, got ${dto.currency}.`,
      );
    }

    const total = Number((product.unitAmount * dto.quantity).toFixed(2));
    if (!Number.isFinite(total) || total < 0.01) {
      throw new BadRequestException('Computed order amount is invalid.');
    }

    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: product.id,
          description: product.name,
          custom_id: product.id.slice(0, 127),
          amount: {
            currency_code: product.currency,
            value: formatMajorAmount(total),
            breakdown: {
              item_total: {
                currency_code: product.currency,
                value: formatMajorAmount(total),
              },
            },
          },
          items: [
            {
              name: product.name.slice(0, 127),
              description: product.description.slice(0, 127),
              quantity: String(dto.quantity),
              unit_amount: {
                currency_code: product.currency,
                value: formatMajorAmount(product.unitAmount),
              },
              category: 'DIGITAL_GOODS',
            },
          ],
        },
      ],
    };

    try {
      const order = await this.paypalRequest<PayPalOrderResponse>('POST', '/v2/checkout/orders', body);

      if (!order.id) {
        throw new InternalServerErrorException('PayPal did not return an order id.');
      }

      return {
        provider: 'paypal',
        orderId: order.id,
      };
    } catch (error) {
      this.rethrowPayPalError(error, 'Failed to create PayPal order.');
    }
  }

  async captureOrder(orderId: string): Promise<CapturePayPalOrderResult> {
    this.ensureConfigured();

    const id = orderId?.trim();
    if (!id) {
      throw new BadRequestException('orderId is required.');
    }

    try {
      const order = await this.paypalRequest<PayPalOrderResponse>(
        'POST',
        `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
        {},
      );

      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
      const captureId = capture?.id;
      const status = capture?.status ?? order.status ?? 'UNKNOWN';

      if (!captureId) {
        throw new InternalServerErrorException(
          'PayPal capture completed without a capture id. The order may be in an invalid state.',
        );
      }

      return {
        provider: 'paypal',
        orderId: order.id ?? id,
        captureId,
        status,
      };
    } catch (error) {
      this.rethrowPayPalError(error, 'Failed to capture PayPal order.');
    }
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in server/.env',
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt - 30_000) {
      return this.cachedToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const payload = (await response.json()) as PayPalAccessTokenResponse;

    if (!response.ok || !payload.access_token) {
      this.logger.error(
        `PayPal OAuth failed: ${payload.error ?? response.status} ${payload.error_description ?? ''}`.trim(),
      );
      throw new ServiceUnavailableException('Failed to authenticate with PayPal.');
    }

    this.cachedToken = payload.access_token;
    this.tokenExpiresAt = now + (payload.expires_in ?? 300) * 1000;
    return this.cachedToken;
  }

  private async paypalRequest<T>(
    method: 'POST' | 'GET',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as T & PayPalOrderResponse;

    if (!response.ok) {
      const detail =
        payload.details?.[0]?.description ||
        payload.message ||
        payload.name ||
        `PayPal API error (${response.status})`;

      this.logger.error(`PayPal ${method} ${path} failed: ${detail}`);

      if (response.status >= 400 && response.status < 500) {
        throw new BadRequestException(detail);
      }

      throw new InternalServerErrorException('PayPal API request failed.');
    }

    return payload;
  }

  private rethrowPayPalError(error: unknown, fallback: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ServiceUnavailableException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }

    this.logger.error(fallback, error instanceof Error ? error.stack : undefined);
    throw new InternalServerErrorException(fallback);
  }
}
