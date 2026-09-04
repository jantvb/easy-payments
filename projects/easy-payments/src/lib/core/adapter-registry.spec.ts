import { TestBed } from '@angular/core/testing';
import { AdapterRegistry } from './adapter-registry';
import { PaymentProviderAdapter } from './payment-provider.adapter';

function stubAdapter(provider: PaymentProviderAdapter['provider']): PaymentProviderAdapter {
  return {
    provider,
    isMock: true,
    initialize: async () => undefined,
    isAvailable: async () => true,
    createPayment: async () => ({
      status: 'success',
      method: 'card',
      provider,
    }),
  };
}

describe('AdapterRegistry', () => {
  it('registers, retrieves, lists, and clears adapters', () => {
    TestBed.configureTestingModule({});
    const registry = TestBed.inject(AdapterRegistry);
    const stripe = stubAdapter('stripe');
    const paypal = stubAdapter('paypal');

    registry.register(stripe);
    registry.register(paypal);

    expect(registry.get('stripe')).toBe(stripe);
    expect(registry.get('paypal')).toBe(paypal);
    expect(registry.getAll().length).toBe(2);

    registry.clear();
    expect(registry.get('stripe')).toBeUndefined();
    expect(registry.getAll()).toEqual([]);
  });
});
