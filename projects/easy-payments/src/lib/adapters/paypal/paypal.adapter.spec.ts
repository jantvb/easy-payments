import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { provideEasyPayments } from '../../config/provide-easy-payments';
import { BackendService } from '../../services/backend.service';
import { SdkLoaderService } from '../../loaders/sdk-loader.service';
import { PaymentError } from '../../errors/payment-error';
import { PayPalAdapter } from './paypal.adapter';
import { PayPalNamespace } from './paypal.types';

describe('PayPalAdapter', () => {
  let adapter: PayPalAdapter;
  let backend: jasmine.SpyObj<BackendService>;
  let sdkLoader: jasmine.SpyObj<SdkLoaderService>;
  let paypalNs: PayPalNamespace;
  let renderSpy: jasmine.Spy;
  let closeSpy: jasmine.Spy;

  beforeEach(async () => {
    backend = jasmine.createSpyObj<BackendService>('BackendService', [
      'createPayPalOrder',
      'capturePayPalOrder',
    ]);
    sdkLoader = jasmine.createSpyObj<SdkLoaderService>('SdkLoaderService', ['loadScript']);
    sdkLoader.loadScript.and.resolveTo();

    renderSpy = jasmine.createSpy('render').and.resolveTo();
    closeSpy = jasmine.createSpy('close').and.resolveTo();
    paypalNs = {
      Buttons: jasmine.createSpy('Buttons').and.callFake(() => ({
        render: renderSpy,
        close: closeSpy,
      })),
    };

    (window as Window & { paypal?: PayPalNamespace }).paypal = undefined;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        { provide: PLATFORM_ID, useValue: 'browser' },
        provideEasyPayments({
          enableMockMode: false,
          providers: {
            paypal: { clientId: 'sb-client', currency: 'USD', intent: 'capture' },
          },
          backend: {
            paypalCreateOrderUrl: '/api/payments/paypal/create',
            paypalCaptureOrderUrl: '/api/payments/paypal/capture',
          },
        }),
        { provide: BackendService, useValue: backend },
        { provide: SdkLoaderService, useValue: sdkLoader },
      ],
    });

    adapter = TestBed.inject(PayPalAdapter);
    await adapter.initialize();
  });

  afterEach(() => {
    delete (window as Window & { paypal?: PayPalNamespace }).paypal;
  });

  it('initializes without loading the SDK', async () => {
    expect(sdkLoader.loadScript).not.toHaveBeenCalled();
    expect(await adapter.isAvailable({} as never)).toBeTrue();
  });

  it('is unavailable without Client ID', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        { provide: PLATFORM_ID, useValue: 'browser' },
        provideEasyPayments({
          enableMockMode: false,
          providers: {},
          backend: {
            paypalCreateOrderUrl: '/api/payments/paypal/create',
            paypalCaptureOrderUrl: '/api/payments/paypal/capture',
          },
        }),
        { provide: BackendService, useValue: backend },
        { provide: SdkLoaderService, useValue: sdkLoader },
      ],
    });
    const empty = TestBed.inject(PayPalAdapter);
    await empty.initialize();
    expect(await empty.isAvailable({} as never)).toBeFalse();
  });

  it('lazy-loads the SDK once and reuses it', async () => {
    sdkLoader.loadScript.and.callFake(async () => {
      (window as Window & { paypal?: PayPalNamespace }).paypal = paypalNs;
    });

    const first = await adapter.ensureSdkLoaded();
    const second = await adapter.ensureSdkLoaded();

    expect(first).toBe(paypalNs);
    expect(second).toBe(paypalNs);
    expect(sdkLoader.loadScript).toHaveBeenCalledTimes(1);
    expect(sdkLoader.loadScript.calls.mostRecent().args[0].id).toBe('easy-payments-paypal-sdk');
  });

  it('creates an order through the backend without amount or metadata', async () => {
    backend.createPayPalOrder.and.resolveTo({ provider: 'paypal', orderId: 'ORDER-9' });

    const orderId = await adapter.createOrder({
      id: 'premium-plan',
      name: 'Premium',
      amount: 0.01,
      currency: 'USD',
      quantity: 1,
    });

    expect(orderId).toBe('ORDER-9');
    expect(backend.createPayPalOrder).toHaveBeenCalledWith({
      provider: 'paypal',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    const sent = backend.createPayPalOrder.calls.mostRecent().args[0] as unknown as Record<
      string,
      unknown
    >;
    expect(sent['amount']).toBeUndefined();
    expect(sent['metadata']).toBeUndefined();
  });

  it('rejects invalid create-order backend responses via BackendService errors', async () => {
    backend.createPayPalOrder.and.rejectWith(
      new PaymentError({
        code: 'BACKEND_ERROR',
        message: 'Invalid PayPal create-order response from backend.',
        method: 'paypal',
        provider: 'paypal',
      }),
    );

    await expectAsync(
      adapter.createOrder({
        id: 'premium-plan',
        name: 'Premium',
        amount: 99.99,
        currency: 'USD',
      }),
    ).toBeRejectedWith(jasmine.any(PaymentError));
  });

  it('captures and normalizes PaymentResult', async () => {
    backend.capturePayPalOrder.and.resolveTo({
      provider: 'paypal',
      orderId: 'ORDER-9',
      captureId: 'CAPTURE-9',
      status: 'COMPLETED',
    });

    const result = await adapter.captureOrder('ORDER-9');
    expect(result).toEqual(
      jasmine.objectContaining({
        status: 'success',
        method: 'paypal',
        provider: 'paypal',
        transactionId: 'CAPTURE-9',
        sessionId: 'ORDER-9',
      }),
    );
  });

  it('prevents duplicate createOrder / capture calls', async () => {
    let resolveCreate!: (value: { provider: 'paypal'; orderId: string }) => void;
    backend.createPayPalOrder.and.returnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    const first = adapter.createOrder({
      id: 'premium-plan',
      name: 'Premium',
      amount: 99.99,
      currency: 'USD',
    });
    const second = adapter.createOrder({
      id: 'premium-plan',
      name: 'Premium',
      amount: 99.99,
      currency: 'USD',
    });

    await expectAsync(second).toBeRejectedWith(
      jasmine.objectContaining({ message: jasmine.stringMatching(/already being created/i) }),
    );

    resolveCreate({ provider: 'paypal', orderId: 'ORDER-1' });
    await expectAsync(first).toBeResolvedTo('ORDER-1');

    let resolveCapture!: (value: {
      provider: 'paypal';
      orderId: string;
      captureId: string;
      status: string;
    }) => void;
    backend.capturePayPalOrder.and.returnValue(
      new Promise((resolve) => {
        resolveCapture = resolve;
      }),
    );

    const captureFirst = adapter.captureOrder('ORDER-1');
    const captureSecond = adapter.captureOrder('ORDER-1');
    await expectAsync(captureSecond).toBeRejectedWith(
      jasmine.objectContaining({ message: jasmine.stringMatching(/already in progress/i) }),
    );
    resolveCapture({
      provider: 'paypal',
      orderId: 'ORDER-1',
      captureId: 'C-1',
      status: 'COMPLETED',
    });
    await expectAsync(captureFirst).toBeResolved();
  });

  it('renders official Buttons and cleans them up', async () => {
    sdkLoader.loadScript.and.callFake(async () => {
      (window as Window & { paypal?: PayPalNamespace }).paypal = paypalNs;
    });

    const host = document.createElement('div');
    await adapter.renderButtons(host, {
      createOrder: async () => 'ORDER-1',
      onApprove: async () => undefined,
      onCancel: () => undefined,
      onError: () => undefined,
    });

    expect(paypalNs.Buttons).toHaveBeenCalled();
    expect(renderSpy).toHaveBeenCalledWith(host);

    await adapter.destroy();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('rejects direct createPayment for real PayPal', async () => {
    await expectAsync(
      adapter.createPayment({
        method: 'paypal',
        context: {
          product: { id: 'premium-plan', name: 'P', amount: 1, currency: 'USD' },
          theme: 'light',
        },
      }),
    ).toBeRejectedWith(jasmine.any(PaymentError));
  });
});
