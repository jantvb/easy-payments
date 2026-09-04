import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideEasyPayments } from '../config/provide-easy-payments';
import { BackendService } from './backend.service';
import { PaymentError } from '../errors/payment-error';

describe('BackendService', () => {
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
            paypal: { clientId: 'paypal-client' },
          },
          backend: {
            createPaymentUrl: '/api/payments/create',
            paypalCreateOrderUrl: '/api/payments/paypal/create',
            paypalCaptureOrderUrl: '/api/payments/paypal/capture',
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

  it('posts CreatePaymentRequest for Stripe', () => {
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

  it('creates a PayPal order via backend with a minimal wire payload', async () => {
    const promise = backend.createPayPalOrder({
      provider: 'paypal',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
      // Extra fields must never be forwarded to Nest (forbidNonWhitelisted).
      ...( {
        amount: 1,
        metadata: { productName: 'Premium Plan' },
      } as object),
    } as never);

    const req = http.expectOne('/api/payments/paypal/create');
    expect(req.request.body).toEqual({
      provider: 'paypal',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    expect(req.request.body.amount).toBeUndefined();
    expect(req.request.body.metadata).toBeUndefined();
    req.flush({ provider: 'paypal', orderId: 'ORDER-1' });

    await expectAsync(promise).toBeResolvedTo({ provider: 'paypal', orderId: 'ORDER-1' });
  });

  it('rejects invalid PayPal create-order responses', async () => {
    const promise = backend.createPayPalOrder({
      provider: 'paypal',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });

    http.expectOne('/api/payments/paypal/create').flush({ provider: 'paypal' });

    try {
      await promise;
      fail('expected error');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentError);
      expect((error as PaymentError).code).toBe('BACKEND_ERROR');
    }
  });

  it('captures a PayPal order via backend', async () => {
    const promise = backend.capturePayPalOrder('ORDER-1');
    const req = http.expectOne('/api/payments/paypal/capture');
    expect(req.request.body).toEqual({ orderId: 'ORDER-1' });
    req.flush({
      provider: 'paypal',
      orderId: 'ORDER-1',
      captureId: 'CAPTURE-1',
      status: 'COMPLETED',
    });

    await expectAsync(promise).toBeResolvedTo(
      jasmine.objectContaining({ captureId: 'CAPTURE-1' }),
    );
  });
});
