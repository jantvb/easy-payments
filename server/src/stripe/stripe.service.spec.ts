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

  it('falls back to the catalog price when the client amount is below the demo minimum', async () => {
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
        amount: 9900,
        currency: 'usd',
      }),
    );
  });

  it('charges the playground amount when it is within the demo bounds', async () => {
    createMock.mockResolvedValue({
      id: 'pi_custom',
      client_secret: 'pi_custom_secret',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);
    await service.createPaymentIntent({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 3,
      currency: 'USD',
      amount: 2.5,
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 750,
        currency: 'usd',
        metadata: expect.objectContaining({ unitAmount: '2.5', catalogUnitAmount: '99' }),
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

  it('creates a Klarna-only PaymentIntent with trusted catalog amount', async () => {
    createMock.mockResolvedValue({
      id: 'pi_klarna',
      client_secret: 'pi_klarna_secret',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);
    const result = await service.createKlarnaPaymentIntent({
      provider: 'klarna',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9900,
        currency: 'usd',
        payment_method_types: ['klarna'],
        metadata: expect.objectContaining({
          productId: 'premium-plan',
          paymentMethod: 'klarna',
        }),
      }),
    );
    expect(result).toEqual({
      provider: 'klarna',
      clientSecret: 'pi_klarna_secret',
      paymentIntentId: 'pi_klarna',
    });
  });

  it('rejects unknown products for Klarna', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);
    await expect(
      service.createKlarnaPaymentIntent({
        provider: 'klarna',
        productId: 'not-in-catalog',
        quantity: 1,
        currency: 'USD',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates an Affirm-only PaymentIntent with trusted catalog amount', async () => {
    createMock.mockResolvedValue({
      id: 'pi_affirm',
      client_secret: 'pi_affirm_secret',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);
    const result = await service.createAffirmPaymentIntent({
      provider: 'affirm',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9900,
        currency: 'usd',
        payment_method_types: ['affirm'],
        metadata: expect.objectContaining({
          productId: 'premium-plan',
          paymentMethod: 'affirm',
        }),
      }),
    );
    expect(result).toEqual({
      provider: 'affirm',
      clientSecret: 'pi_affirm_secret',
      paymentIntentId: 'pi_affirm',
    });
  });

  it('rejects Affirm amounts below the Stripe Affirm minimum', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);
    // basic-plan is $29.99 — below Affirm's ~$35 presentment minimum.
    await expect(
      service.createAffirmPaymentIntent({
        provider: 'affirm',
        productId: 'basic-plan',
        quantity: 1,
        currency: 'USD',
      }),
    ).rejects.toThrow(/minimum of about \$35/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects Affirm presentment currencies outside USD / CAD', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);
    await expect(
      service.createAffirmPaymentIntent({
        provider: 'affirm',
        productId: 'premium-plan',
        quantity: 40,
        currency: 'EUR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects unknown products for Affirm', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StripeService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(StripeService);
    await expect(
      service.createAffirmPaymentIntent({
        provider: 'affirm',
        productId: 'not-in-catalog',
        quantity: 1,
        currency: 'USD',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createMock).not.toHaveBeenCalled();
  });
});
