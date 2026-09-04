import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';

describe('StripeController', () => {
  let controller: StripeController;
  let service: { createPaymentIntent: jest.Mock };

  beforeEach(async () => {
    service = {
      createPaymentIntent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeController],
      providers: [{ provide: StripeService, useValue: service }],
    }).compile();

    controller = module.get(StripeController);
  });

  it('returns the PaymentIntent client secret on success', async () => {
    service.createPaymentIntent.mockResolvedValue({
      provider: 'stripe',
      clientSecret: 'pi_secret',
      paymentIntentId: 'pi_1',
    });

    await expect(
      controller.createPaymentIntent({
        provider: 'stripe',
        productId: 'premium-plan',
        quantity: 1,
        currency: 'USD',
        amount: 99.99,
      }),
    ).resolves.toEqual({
      provider: 'stripe',
      clientSecret: 'pi_secret',
      paymentIntentId: 'pi_1',
    });
  });

  it('propagates service failures', async () => {
    service.createPaymentIntent.mockRejectedValue(
      new InternalServerErrorException('Failed to create Stripe PaymentIntent.'),
    );

    await expect(
      controller.createPaymentIntent({
        provider: 'stripe',
        productId: 'premium-plan',
        quantity: 1,
        currency: 'USD',
        amount: 99.99,
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('propagates invalid request failures from the service', async () => {
    service.createPaymentIntent.mockRejectedValue(new BadRequestException('invalid amount'));

    await expect(
      controller.createPaymentIntent({
        provider: 'stripe',
        productId: 'premium-plan',
        quantity: 1,
        currency: 'USD',
        amount: -1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
