import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
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
        provideHttpClient(withXhr()),
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
            klarnaCreatePaymentUrl: '/api/payments/klarna/create',
            affirmCreatePaymentUrl: '/api/payments/affirm/create',
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

  it('creates a Klarna payment via backend with a minimal wire payload', async () => {
    const promise = backend.createKlarnaPayment({
      provider: 'klarna',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
      ...( {
        amount: 1,
        metadata: { productName: 'Premium Plan' },
      } as object),
    } as never);

    const req = http.expectOne('/api/payments/klarna/create');
    expect(req.request.body).toEqual({
      provider: 'klarna',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    expect(req.request.body.amount).toBeUndefined();
    expect(req.request.body.metadata).toBeUndefined();
    req.flush({
      provider: 'klarna',
      clientSecret: 'pi_klarna_secret',
      paymentIntentId: 'pi_klarna_1',
    });

    await expectAsync(promise).toBeResolvedTo(
      jasmine.objectContaining({ clientSecret: 'pi_klarna_secret' }),
    );
  });

  it('creates an Affirm payment via backend with a minimal wire payload', async () => {
    const promise = backend.createAffirmPayment({
      provider: 'affirm',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
      ...( {
        amount: 1,
        metadata: { productName: 'Premium Plan' },
      } as object),
    } as never);

    const req = http.expectOne('/api/payments/affirm/create');
    expect(req.request.body).toEqual({
      provider: 'affirm',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    expect(req.request.body.amount).toBeUndefined();
    expect(req.request.body.metadata).toBeUndefined();
    req.flush({
      provider: 'affirm',
      clientSecret: 'pi_affirm_secret',
      paymentIntentId: 'pi_affirm_1',
    });

    await expectAsync(promise).toBeResolvedTo(
      jasmine.objectContaining({ clientSecret: 'pi_affirm_secret' }),
    );
  });
});

describe('BackendService baseUrl resolution', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  function setup(backend: {
    baseUrl?: string;
    createPaymentUrl?: string;
    paypalCreateOrderUrl?: string;
    paypalCaptureOrderUrl?: string;
    klarnaCreatePaymentUrl?: string;
    affirmCreatePaymentUrl?: string;
    confirmPaymentUrl?: string;
  }): { service: BackendService; http: HttpTestingController } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideEasyPayments({
          enableMockMode: false,
          providers: {
            stripe: { publishableKey: 'pk_test_123' },
            paypal: { clientId: 'paypal-client' },
          },
          backend,
        }),
      ],
    });
    return {
      service: TestBed.inject(BackendService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('resolves Stripe, PayPal, Klarna, and Affirm endpoints against baseUrl', async () => {
    const { service, http } = setup({
      baseUrl: 'https://api.example.com/',
      createPaymentUrl: '/api/payments/create',
      paypalCreateOrderUrl: 'api/payments/paypal/create',
      paypalCaptureOrderUrl: '/api/payments/paypal/capture?mode=sandbox',
      klarnaCreatePaymentUrl: '/api/payments/klarna/create',
      affirmCreatePaymentUrl: '/api/payments/affirm/create',
    });

    const stripe = service.createStripePayment({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    http.expectOne('https://api.example.com/api/payments/create').flush({
      provider: 'stripe',
      clientSecret: 'pi_example',
    });
    await expectAsync(stripe).toBeResolved();

    const paypal = service.createPayPalOrder({
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    http.expectOne('https://api.example.com/api/payments/paypal/create').flush({
      provider: 'paypal',
      orderId: 'order-1',
    });
    await expectAsync(paypal).toBeResolved();

    const capture = service.capturePayPalOrder('order-1');
    http.expectOne('https://api.example.com/api/payments/paypal/capture?mode=sandbox').flush({
      provider: 'paypal',
      orderId: 'order-1',
      captureId: 'capture-1',
    });
    await expectAsync(capture).toBeResolved();

    const klarna = service.createKlarnaPayment({
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    http.expectOne('https://api.example.com/api/payments/klarna/create').flush({
      provider: 'klarna',
      clientSecret: 'pi_example',
    });
    await expectAsync(klarna).toBeResolved();

    const affirm = service.createAffirmPayment({
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    http.expectOne('https://api.example.com/api/payments/affirm/create').flush({
      provider: 'affirm',
      clientSecret: 'pi_example',
    });
    await expectAsync(affirm).toBeResolved();
  });

  it('keeps the existing relative URL when baseUrl is omitted', async () => {
    const { service, http } = setup({
      createPaymentUrl: '/api/payments/create',
    });
    const pending = service.createStripePayment({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    http.expectOne('/api/payments/create').flush({
      provider: 'stripe',
      clientSecret: 'pi_example',
    });
    await expectAsync(pending).toBeResolved();
  });

  it('uses an absolute endpoint override and does not post an unsafe URL', async () => {
    const { service, http } = setup({
      baseUrl: 'https://api.example.com',
      createPaymentUrl: 'https://payments.other-provider.com/create',
    });
    const pending = service.createStripePayment({
      provider: 'stripe',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    http.expectOne('https://payments.other-provider.com/create').flush({
      provider: 'stripe',
      clientSecret: 'pi_example',
    });
    await expectAsync(pending).toBeResolved();

    TestBed.resetTestingModule();
    const unsafe = setup({
      baseUrl: 'https://api.example.com',
      createPaymentUrl: 'javascript:example',
    });
    await expectAsync(
      unsafe.service.createStripePayment({
        provider: 'stripe',
        productId: 'premium-plan',
        quantity: 1,
        currency: 'USD',
      }),
    ).toBeRejectedWith(jasmine.objectContaining({ code: 'CONFIG_INVALID' }));
    unsafe.http.expectNone(() => true);
  });
});
