import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideEasyPayments } from '../config/provide-easy-payments';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { SAMPLE_PRODUCT } from '../testing/test-doubles';

describe('PaymentOrchestratorService provider isolation', () => {
  async function availability(
    config: Parameters<typeof provideEasyPayments>[0],
    methods: Array<'card' | 'paypal' | 'apple-pay' | 'google-pay' | 'klarna' | 'affirm'>,
  ) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideEasyPayments(config),
      ],
    });
    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    return orchestrator.refreshAvailability(methods, { ...SAMPLE_PRODUCT });
  }

  it('keeps Stripe card ready when PayPal is misconfigured', async () => {
    const results = await availability(
      {
        enableMockMode: false,
        providers: {
          stripe: { publishableKey: 'pk_test_123' },
          paypal: { clientId: '' },
        },
        backend: { createPaymentUrl: '/api/payments/create' },
      },
      ['paypal', 'card'],
    );

    expect(results.map((entry) => entry.method)).toEqual(['paypal', 'card']);
    expect(results[0].available).toBeFalse();
    expect(results[0].readiness).toBe('unavailable');
    expect(results[1].available).toBeTrue();
    expect(results[1].readiness).toBe('ready');
    expect(results[1].isMock).toBeFalse();
  });

  it('keeps PayPal ready when Stripe is misconfigured', async () => {
    const results = await availability(
      {
        enableMockMode: false,
        providers: {
          paypal: { clientId: 'paypal-client-id' },
        },
        backend: {
          paypalCreateOrderUrl: '/api/payments/paypal/create',
          paypalCaptureOrderUrl: '/api/payments/paypal/capture',
        },
      },
      ['card', 'paypal'],
    );

    expect(results[0].method).toBe('card');
    expect(results[0].available).toBeFalse();
    expect(results[0].readiness).not.toBe('ready');
    expect(results[1].available).toBeTrue();
    expect(results[1].readiness).toBe('ready');
  });

  it('limits a Stripe initialization failure to Stripe-dependent methods', async () => {
    const results = await availability(
      {
        enableMockMode: false,
        providers: {
          stripe: { publishableKey: 'sk_test_secretvalue' },
          paypal: { clientId: 'paypal-client-id' },
          applePay: {},
          klarna: { purchaseCountry: 'US' },
        },
        backend: {
          createPaymentUrl: '/api/payments/create',
          paypalCreateOrderUrl: '/api/payments/paypal/create',
          paypalCaptureOrderUrl: '/api/payments/paypal/capture',
          klarnaCreatePaymentUrl: '/api/payments/klarna/create',
        },
      },
      ['card', 'apple-pay', 'klarna', 'paypal'],
    );

    const byMethod = Object.fromEntries(results.map((entry) => [entry.method, entry]));
    expect(byMethod['card'].available).toBeFalse();
    expect(byMethod['card'].readiness).toBe('misconfigured');
    expect(byMethod['apple-pay'].available).toBeFalse();
    expect(byMethod['apple-pay'].diagnosticCode).toBe('STRIPE_INITIALIZATION_FAILED');
    expect(byMethod['klarna'].available).toBeFalse();
    expect(byMethod['klarna'].diagnosticCode).toBe('STRIPE_INITIALIZATION_FAILED');
    expect(byMethod['paypal'].available).toBeTrue();
    expect(byMethod['paypal'].readiness).toBe('ready');
  });

  it('does not disable PayPal when the Stripe backend URL is missing', async () => {
    const results = await availability(
      {
        enableMockMode: false,
        providers: {
          stripe: { publishableKey: 'pk_test_123' },
          paypal: { clientId: 'paypal-client-id' },
        },
        backend: {
          paypalCreateOrderUrl: '/api/payments/paypal/create',
          paypalCaptureOrderUrl: '/api/payments/paypal/capture',
        },
      },
      ['card', 'paypal'],
    );

    expect(results[0].available).toBeFalse();
    expect(results[0].diagnosticCode).toBe('PROVIDER_MISCONFIGURED');
    expect(results[1].available).toBeTrue();
  });

  it('preserves merchant method order when some methods are unavailable', async () => {
    const results = await availability(
      {
        enableMockMode: false,
        providers: {
          stripe: { publishableKey: 'pk_test_123' },
          paypal: { clientId: 'paypal-client-id' },
        },
        backend: {
          createPaymentUrl: '/api/payments/create',
          paypalCreateOrderUrl: '/api/payments/paypal/create',
          paypalCaptureOrderUrl: '/api/payments/paypal/capture',
        },
      },
      ['paypal', 'card', 'affirm'],
    );

    expect(results.map((entry) => entry.method)).toEqual(['paypal', 'card', 'affirm']);
    expect(results.filter((entry) => entry.available).map((entry) => entry.method)).toEqual([
      'paypal',
      'card',
    ]);
  });
});
