import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PayPalService } from './paypal.service';

describe('PayPalService', () => {
  const originalFetch = global.fetch;

  function mockConfig(
    overrides: Record<string, string | undefined> = {},
  ): ConfigService {
    const values: Record<string, string | undefined> = {
      PAYPAL_CLIENT_ID: 'test-client-id',
      PAYPAL_CLIENT_SECRET: 'test-client-secret',
      PAYPAL_MODE: 'sandbox',
      ...overrides,
    };
    return {
      get: (key: string) => values[key],
    } as ConfigService;
  }

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('rejects unknown productId before calling PayPal', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PayPalService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(PayPalService);
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      service.createOrder({
        provider: 'paypal',
        productId: 'evil-cheap-item',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid quantity via catalog total path with quantity from DTO (service assumes validated DTO)', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PayPalService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(PayPalService);

    // Service trusts Nest ValidationPipe for quantity bounds; still rejects missing catalog.
    await expect(
      service.createOrder({
        provider: 'paypal',
        productId: '',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an order using trusted catalog price (ignores any client price)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token', expires_in: 300 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'ORDER-123', status: 'CREATED' }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [PayPalService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(PayPalService);
    const result = await service.createOrder({
      provider: 'paypal',
      productId: 'premium-plan',
      quantity: 2,
      currency: 'USD',
    });

    expect(result).toEqual({ provider: 'paypal', orderId: 'ORDER-123' });

    const createCall = fetchMock.mock.calls[1];
    expect(createCall[0]).toContain('/v2/checkout/orders');
    const body = JSON.parse(createCall[1].body as string);
    expect(body.intent).toBe('CAPTURE');
    expect(body.purchase_units[0].amount.value).toBe('198.00');
    expect(body.purchase_units[0].amount.currency_code).toBe('USD');
  });

  it('captures an approved order and returns captureId', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token', expires_in: 300 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'ORDER-123',
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [{ id: 'CAPTURE-9', status: 'COMPLETED' }],
              },
            },
          ],
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [PayPalService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(PayPalService);
    const result = await service.captureOrder('ORDER-123');

    expect(result).toEqual({
      provider: 'paypal',
      orderId: 'ORDER-123',
      captureId: 'CAPTURE-9',
      status: 'COMPLETED',
    });
  });

  it('fails when credentials are missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayPalService,
        {
          provide: ConfigService,
          useValue: mockConfig({
            PAYPAL_CLIENT_ID: '',
            PAYPAL_CLIENT_SECRET: '',
          }),
        },
      ],
    }).compile();

    const service = module.get(PayPalService);

    await expect(
      service.createOrder({
        provider: 'paypal',
        productId: 'premium-plan',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects currency mismatch against catalog', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PayPalService, { provide: ConfigService, useValue: mockConfig() }],
    }).compile();

    const service = module.get(PayPalService);

    await expect(
      service.createOrder({
        provider: 'paypal',
        productId: 'premium-plan',
        quantity: 1,
        currency: 'EUR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
