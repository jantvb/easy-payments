import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { getCatalogProduct } from '../catalog/product-catalog';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateKlarnaPaymentIntentDto } from './dto/create-klarna-payment-intent.dto';

export interface CreatePaymentIntentResult {
  provider: 'stripe';
  clientSecret: string;
  paymentIntentId: string;
}

export interface CreateKlarnaPaymentIntentResult {
  provider: 'klarna';
  clientSecret: string;
  paymentIntentId: string;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY')?.trim() ?? '';

    if (!secretKey) {
      this.stripe = null;
      this.logger.warn('STRIPE_SECRET_KEY is not configured. PaymentIntent creation will fail.');
      return;
    }

    if (!/^sk_test_/i.test(secretKey)) {
      this.stripe = null;
      this.logger.error(
        'STRIPE_SECRET_KEY must be a Stripe TEST secret key (sk_test_...). Live keys are blocked in this demo server.',
      );
      return;
    }

    this.stripe = new Stripe(secretKey);
  }

  async createPaymentIntent(dto: CreatePaymentIntentDto): Promise<CreatePaymentIntentResult> {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY=sk_test_... in server/.env',
      );
    }

    const catalogProduct = getCatalogProduct(dto.productId);
    if (!catalogProduct) {
      throw new BadRequestException(
        `Unknown productId "${dto.productId}". Use a catalog product (e.g. premium-plan).`,
      );
    }

    if (dto.currency.toUpperCase() !== catalogProduct.currency) {
      throw new BadRequestException(
        `Currency mismatch: catalog product uses ${catalogProduct.currency}, got ${dto.currency}.`,
      );
    }

    // Trusted price: ignore any client-supplied amount.
    if (typeof dto.amount === 'number' && dto.amount !== catalogProduct.unitAmount) {
      this.logger.warn(
        `Ignoring client amount ${dto.amount} for ${dto.productId}; using catalog ${catalogProduct.unitAmount}.`,
      );
    }

    const unitAmountCents = Math.round(catalogProduct.unitAmount * 100);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents < 50) {
      throw new BadRequestException('Catalog amount is too small for Stripe (minimum ~0.50).');
    }

    const totalAmount = unitAmountCents * dto.quantity;
    if (totalAmount > 99_999_999) {
      throw new BadRequestException('Total charge amount is too large.');
    }

    const description =
      dto.description?.trim() ||
      catalogProduct.name ||
      (typeof dto.metadata?.['productName'] === 'string'
        ? String(dto.metadata['productName'])
        : `Easy Payments demo: ${dto.productId}`);

    const safeMetadata: Record<string, string> = {
      productId: dto.productId,
      quantity: String(dto.quantity),
      source: 'easy-payments-demo',
      trustedUnitAmount: String(catalogProduct.unitAmount),
    };

    if (dto.metadata) {
      for (const [key, value] of Object.entries(dto.metadata)) {
        if (typeof value === 'string' && value.length <= 500 && key.length <= 40) {
          safeMetadata[key] = value;
        }
      }
    }

    try {
      const intent = await this.stripe.paymentIntents.create({
        amount: totalAmount,
        currency: catalogProduct.currency.toLowerCase(),
        description,
        metadata: safeMetadata,
        // Easy Payments `card` must only collect cards — not Klarna/Cash App/bank, etc.
        payment_method_types: ['card'],
      });

      if (!intent.client_secret) {
        throw new InternalServerErrorException('Stripe did not return a client_secret.');
      }

      return {
        provider: 'stripe',
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      const stripeMessage =
        error instanceof Stripe.errors.StripeError
          ? error.message
          : 'Failed to create Stripe PaymentIntent.';

      this.logger.error(`PaymentIntent creation failed: ${stripeMessage}`);

      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        throw new BadRequestException(stripeMessage);
      }

      throw new InternalServerErrorException('Failed to create Stripe PaymentIntent.');
    }
  }

  /**
   * Klarna via Stripe PaymentIntent (official Stripe Klarna payment method).
   * Trusted catalog pricing — same product catalog as card payments.
   */
  async createKlarnaPaymentIntent(
    dto: CreateKlarnaPaymentIntentDto,
  ): Promise<CreateKlarnaPaymentIntentResult> {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY=sk_test_... in server/.env',
      );
    }

    const catalogProduct = getCatalogProduct(dto.productId);
    if (!catalogProduct) {
      throw new BadRequestException(
        `Unknown productId "${dto.productId}". Use a catalog product (e.g. premium-plan).`,
      );
    }

    if (dto.currency.toUpperCase() !== catalogProduct.currency) {
      throw new BadRequestException(
        `Currency mismatch: catalog product uses ${catalogProduct.currency}, got ${dto.currency}.`,
      );
    }

    const unitAmountCents = Math.round(catalogProduct.unitAmount * 100);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents < 50) {
      throw new BadRequestException('Catalog amount is too small for Stripe (minimum ~0.50).');
    }

    const totalAmount = unitAmountCents * dto.quantity;
    if (totalAmount > 99_999_999) {
      throw new BadRequestException('Total charge amount is too large.');
    }

    const description =
      dto.description?.trim() || catalogProduct.name || `Easy Payments Klarna: ${dto.productId}`;

    const safeMetadata: Record<string, string> = {
      productId: dto.productId,
      quantity: String(dto.quantity),
      source: 'easy-payments-demo',
      paymentMethod: 'klarna',
      trustedUnitAmount: String(catalogProduct.unitAmount),
    };

    if (dto.metadata) {
      for (const [key, value] of Object.entries(dto.metadata)) {
        if (typeof value === 'string' && value.length <= 500 && key.length <= 40) {
          safeMetadata[key] = value;
        }
      }
    }

    try {
      const intent = await this.stripe.paymentIntents.create({
        amount: totalAmount,
        currency: catalogProduct.currency.toLowerCase(),
        description,
        metadata: safeMetadata,
        // Klarna-only PaymentIntent — keeps Card/Google Pay flows isolated.
        payment_method_types: ['klarna'],
      });

      if (!intent.client_secret) {
        throw new InternalServerErrorException('Stripe did not return a client_secret.');
      }

      return {
        provider: 'klarna',
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      const stripeMessage =
        error instanceof Stripe.errors.StripeError
          ? error.message
          : 'Failed to create Klarna PaymentIntent.';

      this.logger.error(`Klarna PaymentIntent creation failed: ${stripeMessage}`);

      if (error instanceof Stripe.errors.StripeInvalidRequestError) {
        throw new BadRequestException(stripeMessage);
      }

      throw new InternalServerErrorException('Failed to create Klarna PaymentIntent.');
    }
  }
}
