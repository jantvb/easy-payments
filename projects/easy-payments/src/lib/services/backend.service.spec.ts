import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideEasyPayments } from '../config/provide-easy-payments';
import { BackendService } from './backend.service';
import { PaymentError } from '../errors/payment-error';

describe('BackendService createStripePayment', () => {
  let backend: BackendService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideEasyPayments({
          enableMockMode: false,
          providers: {
            stripe: { publishableKey: 'pk_test_123' },
          },
          backend: {
            createPaymentUrl: '/api/payments/create',
          },
        }),
      ],
    });
    backend = TestBed.inject(BackendService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('posts CreatePaymentRequest without a trusted amount', () => {
    const promise = backend.createStripePayment({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });

    const req = http.expectOne('/api/payments/create');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    expect(req.request.body.trustedAmount).toBeUndefined();

    req.flush({
      provider: 'stripe',
      clientSecret: 'pi_secret',
      paymentIntentId: 'pi_1',
    });

    return expectAsync(promise).toBeResolvedTo(
      jasmine.objectContaining({ clientSecret: 'pi_secret' }),
    );
  });

  it('maps HTTP failures to PaymentError', async () => {
    const promise = backend.createStripePayment({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
    });

    http.expectOne('/api/payments/create').flush('fail', {
      status: 500,
      statusText: 'Server Error',
    });

    try {
      await promise;
      fail('expected error');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentError);
      expect((error as PaymentError).code).toBe('NETWORK_ERROR');
    }
  });
});
