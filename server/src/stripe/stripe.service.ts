import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

export interface CreatePaymentIntentResult {
  provider: 'stripe';
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

    const unitAmountCents = Math.round(dto.amount * 100);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents < 50) {
      throw new BadRequestException('amount is too small for Stripe (minimum ~0.50 in major units).');
    }

    const totalAmount = unitAmountCents * dto.quantity;
    if (totalAmount > 99_999_999) {
      throw new BadRequestException('Total charge amount is too large.');
    }

    const description =
      dto.description?.trim() ||
      (typeof dto.metadata?.['productName'] === 'string'
        ? String(dto.metadata['productName'])
        : `Easy Payments demo: ${dto.productId}`);

    const safeMetadata: Record<string, string> = {
      productId: dto.productId,
      quantity: String(dto.quantity),
      source: 'easy-payments-demo',
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
        currency: dto.currency.toLowerCase(),
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
}
