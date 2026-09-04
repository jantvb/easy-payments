import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePaymentIntentDto } from './create-payment-intent.dto';

describe('CreatePaymentIntentDto', () => {
  async function validateDto(plain: Record<string, unknown>) {
    const dto = plainToInstance(CreatePaymentIntentDto, plain);
    return validate(dto);
  }

  it('accepts a valid request', async () => {
    const errors = await validateDto({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'usd',
      amount: 99.99,
      metadata: { productName: 'Premium Plan' },
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects zero amount', async () => {
    const errors = await validateDto({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
      amount: 0,
    });
    expect(errors.some((error) => error.property === 'amount')).toBe(true);
  });

  it('rejects negative amount', async () => {
    const errors = await validateDto({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
      amount: -5,
    });
    expect(errors.some((error) => error.property === 'amount')).toBe(true);
  });

  it('rejects malformed amount', async () => {
    const errors = await validateDto({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
      amount: 'abc',
    });
    expect(errors.some((error) => error.property === 'amount')).toBe(true);
  });

  it('rejects invalid currency', async () => {
    const errors = await validateDto({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'US',
      amount: 10,
    });
    expect(errors.some((error) => error.property === 'currency')).toBe(true);
  });

  it('rejects missing required fields', async () => {
    const errors = await validateDto({});
    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['provider', 'productId', 'quantity', 'currency', 'amount']),
    );
  });
});
