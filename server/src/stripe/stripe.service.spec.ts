import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';

const createMock = jest.fn();

jest.mock('stripe', () => {
  const StripeMock = jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: (...args: unknown[]) => createMock(...args),
    },
  }));

  (StripeMock as unknown as { errors: Record<string, unknown> }).errors = {
    StripeError: class StripeError extends Error {},
    StripeInvalidRequestError: class StripeInvalidRequestError extends Error {},
  };

  return {
    __esModule: true,
    default: StripeMock,
  };
});

describe('StripeService', () => {
  function mockConfig(secret = 'sk_test_demo_key'): ConfigService {
    return {
      get: (key: string) => (key === 'STRIPE_SECRET_KEY' ? secret : undefined),
    } as ConfigService;
  }

  beforeEach(() => {
    createMock.mockReset();
  });

  it('creates a PaymentIntent and returns clientSecret', async () => {
    createMock.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_123_secret_abc',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);
    const result = await service.createPaymentIntent({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 2,
      currency: 'USD',
      amount: 99.99,
      metadata: { productName: 'Premium Plan' },
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 19998,
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: expect.objectContaining({
          productId: 'premium-plan',
          quantity: '2',
        }),
      }),
    );
    expect(createMock.mock.calls[0][0].automatic_payment_methods).toBeUndefined();
    expect(result).toEqual({
      provider: 'stripe',
      clientSecret: 'pi_123_secret_abc',
      paymentIntentId: 'pi_123',
    });
  });

  it('maps Stripe SDK failures to HTTP errors', async () => {
    createMock.mockRejectedValue(new Error('stripe boom'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);

    await expect(
      service.createPaymentIntent({
        provider: 'stripe',
        productId: 'premium-plan',
        quantity: 1,
        currency: 'USD',
        amount: 10,
      }),
    ).rejects.toThrow('Failed to create Stripe PaymentIntent.');
  });

  it('uses trusted catalog price and ignores client amount', async () => {
    createMock.mockResolvedValue({
      id: 'pi_trusted',
      client_secret: 'pi_trusted_secret',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);
    await service.createPaymentIntent({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
      amount: 0.01,
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9999,
        currency: 'usd',
      }),
    );
  });

  it('rejects unknown productId', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);

    await expect(
      service.createPaymentIntent({
        provider: 'stripe',
        productId: 'not-in-catalog',
        quantity: 1,
        currency: 'USD',
        amount: 0.01,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('fails when Stripe secret key is missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig('') }],
    }).compile();

    const service = module.get(StripeService);

    await expect(
      service.createPaymentIntent({
        provider: 'stripe',
        productId: 'premium-plan',
        quantity: 1,
        currency: 'USD',
        amount: 10,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects live secret keys in this demo server', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: mockConfig('sk_live_should_fail') },
      ],
    }).compile();

    const service = module.get(StripeService);

    await expect(
      service.createPaymentIntent({
        provider: 'stripe',
        productId: 'premium-plan',
        quantity: 1,
        currency: 'USD',
        amount: 10,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
