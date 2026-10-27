import { ChangeDetectionStrategy, Component, effect, inject, PLATFORM_ID } from '@angular/core';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PaymentError } from '../errors/payment-error';
import { EasyPaymentsConfig } from '../config/easy-payments.config';
import { EasyPaymentsConfigService } from '../config/easy-payments-config.service';
import { provideEasyPayments } from '../config/provide-easy-payments';
import { AdapterRegistry } from '../core/adapter-registry';
import { PaymentProviderAdapter } from '../core/payment-provider.adapter';
import { PaymentMethod } from '../models';
import { PaymentOrchestratorService } from '../services/payment-orchestrator.service';
import { SAMPLE_PRODUCT } from '../testing/test-doubles';
import { EasyPaymentsDiagnosticsService } from './easy-payments-diagnostics.service';

@Component({
  selector: 'ep-diagnostics-probe',
  template: '{{ diagnostics().published }}:{{ diagnostics().methods.length }}',
  changeDetection: ChangeDetectionStrategy.Eager,
})
class DiagnosticsProbe {
  readonly diagnostics = inject(EasyPaymentsDiagnosticsService).diagnostics;
}

describe('EasyPaymentsDiagnosticsService', () => {
  const secretKey = ['sk', '_test_', 'examplekey'].join('');
  const leakedToken = ['example', '.token', '.value'].join('');

  function configure(
    config: EasyPaymentsConfig,
    extra: Parameters<typeof TestBed.configureTestingModule>[0] = {},
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      ...extra,
      providers: [
        ...(extra.providers ?? []),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideEasyPayments(config),
      ],
    });
  }

  async function publish(
    methods: PaymentMethod[],
    config: EasyPaymentsConfig,
  ): Promise<{
    orchestrator: PaymentOrchestratorService;
    diagnostics: EasyPaymentsDiagnosticsService;
  }> {
    configure(config);
    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    const diagnostics = TestBed.inject(EasyPaymentsDiagnosticsService);
    await orchestrator.refreshAvailability(methods, { ...SAMPLE_PRODUCT });
    return { orchestrator, diagnostics };
  }

  it('starts unpublished with an empty method list', () => {
    configure({ enableMockMode: true, providers: {} });
    const diagnostics = TestBed.inject(EasyPaymentsDiagnosticsService);
    const snapshot = diagnostics.snapshot();

    expect(snapshot.published).toBeFalse();
    expect(snapshot.methods).toEqual([]);
    expect(diagnostics.method('card')).toBeUndefined();
  });

  it('publishes ready methods after a successful availability refresh', async () => {
    const { diagnostics } = await publish(['card', 'paypal'], {
      enableMockMode: true,
      providers: {},
    });
    const snapshot = diagnostics.snapshot();

    expect(snapshot.published).toBeTrue();
    expect(snapshot.methods.map((entry) => entry.readiness)).toEqual(['ready', 'ready']);
    expect(snapshot.methods.every((entry) => entry.code === undefined)).toBeTrue();
    expect(snapshot.methods.every((entry) => entry.message === 'This payment method is ready.')).toBeTrue();
    expect(snapshot.methods.every((entry) => entry.mock)).toBeTrue();
  });

  it('does not copy merchant metadata into a diagnostics snapshot', async () => {
    configure({ enableMockMode: true, providers: {} });
    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    const diagnostics = TestBed.inject(EasyPaymentsDiagnosticsService);
    await orchestrator.refreshAvailability(['card', 'paypal'], {
      ...SAMPLE_PRODUCT,
      metadata: { orderId: 'ORDER-12345', customerReference: 'CUSTOMER-789' },
    });

    const snapshot = JSON.stringify(diagnostics.snapshot());
    expect(snapshot).not.toContain('ORDER-12345');
    expect(snapshot).not.toContain('CUSTOMER-789');
    expect(diagnostics.snapshot().methods.map((entry) => entry.readiness)).toEqual(['ready', 'ready']);
  });

  it('maps each method to its provider', async () => {
    const { diagnostics } = await publish(
      ['card', 'paypal', 'apple-pay', 'google-pay', 'klarna', 'affirm'],
      { enableMockMode: true, providers: {} },
    );

    expect(diagnostics.snapshot().methods.map((entry) => [entry.method, entry.provider])).toEqual([
      ['card', 'stripe'],
      ['paypal', 'paypal'],
      ['apple-pay', 'applePay'],
      ['google-pay', 'googlePay'],
      ['klarna', 'klarna'],
      ['affirm', 'affirm'],
    ]);
    expect(diagnostics.method('klarna')?.provider).toBe('klarna');
  });

  it('reports a checking provider as loading and not ready', async () => {
    configure({
      enableMockMode: false,
      providers: { stripe: { publishableKey: 'pk_test_123' } },
      backend: { createPaymentUrl: '/api/payments/create' },
    });
    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    const diagnostics = TestBed.inject(EasyPaymentsDiagnosticsService);
    const registry = TestBed.inject(AdapterRegistry);
    await orchestrator.refreshAvailability(['card'], { ...SAMPLE_PRODUCT });

    const checking: PaymentProviderAdapter & { getAvailabilityStatus(): 'checking' } = {
      provider: 'stripe',
      isMock: false,
      initialize: async () => undefined,
      isAvailable: async () => false,
      createPayment: async () => {
        throw new Error('unused');
      },
      getAvailabilityStatus: () => 'checking',
    };
    registry.register(checking);

    await orchestrator.refreshAvailability(['card'], { ...SAMPLE_PRODUCT });
    const card = diagnostics.method('card');

    expect(card?.readiness).toBe('loading');
    expect(card?.readiness).not.toBe('ready');
    expect(card?.code).toBe('PROVIDER_AVAILABILITY_PENDING');
    expect(card?.message).toBe('This payment method is still checking availability.');
  });

  it('keeps PayPal ready when Stripe initialization fails', async () => {
    const { diagnostics } = await publish(['card', 'apple-pay', 'klarna', 'paypal'], {
      enableMockMode: false,
      providers: {
        stripe: { publishableKey: secretKey },
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
    });

    expect(diagnostics.method('card')).toEqual(
      jasmine.objectContaining({
        provider: 'stripe',
        readiness: 'misconfigured',
        code: 'CONFIG_INVALID',
        message: 'Provider configuration is invalid.',
      }),
    );
    expect(diagnostics.method('apple-pay')?.code).toBe('STRIPE_INITIALIZATION_FAILED');
    expect(diagnostics.method('klarna')?.code).toBe('STRIPE_INITIALIZATION_FAILED');
    expect(diagnostics.method('paypal')).toEqual(
      jasmine.objectContaining({
        provider: 'paypal',
        readiness: 'ready',
        mock: false,
      }),
    );
    expect(JSON.stringify(diagnostics.snapshot())).not.toContain(secretKey);
    expect(JSON.stringify(diagnostics.snapshot())).not.toContain('examplekey');
  });

  it('keeps Stripe ready when PayPal is misconfigured', async () => {
    const { diagnostics } = await publish(['paypal', 'card'], {
      enableMockMode: false,
      providers: {
        stripe: { publishableKey: 'pk_test_123' },
        paypal: { clientId: '' },
      },
      backend: { createPaymentUrl: '/api/payments/create' },
    });

    expect(diagnostics.method('paypal')?.readiness).toBe('unavailable');
    expect(diagnostics.method('paypal')?.code).toBe('PROVIDER_MISCONFIGURED');
    expect(diagnostics.method('card')?.readiness).toBe('ready');
    expect(diagnostics.method('card')?.provider).toBe('stripe');
  });

  it('identifies an invalid backend endpoint without disabling an unrelated provider', async () => {
    const unsafeEndpoint = `javascript:${leakedToken}`;
    const { diagnostics } = await publish(['card', 'paypal'], {
      enableMockMode: false,
      providers: {
        stripe: { publishableKey: 'pk_test_123' },
        paypal: { clientId: 'paypal-client-id' },
      },
      backend: {
        createPaymentUrl: '/api/payments/create',
        paypalCreateOrderUrl: unsafeEndpoint,
        paypalCaptureOrderUrl: '/api/payments/paypal/capture',
      },
    });
    const serialized = JSON.stringify(diagnostics.snapshot());

    expect(diagnostics.method('paypal')?.readiness).not.toBe('ready');
    expect(diagnostics.method('paypal')?.code).toBe('PROVIDER_MISCONFIGURED');
    expect(diagnostics.method('paypal')?.message).toBe('This payment method is misconfigured.');
    expect(diagnostics.method('card')?.readiness).toBe('ready');
    expect(serialized).not.toContain(unsafeEndpoint);
    expect(serialized).not.toContain(leakedToken);
    expect(serialized).not.toContain('javascript:');
  });

  it('keeps an absolute PayPal endpoint ready when baseUrl is invalid', async () => {
    const { diagnostics } = await publish(['card', 'paypal'], {
      enableMockMode: false,
      providers: {
        stripe: { publishableKey: 'pk_test_123' },
        paypal: { clientId: 'paypal-client-id' },
      },
      backend: {
        baseUrl: 'javascript:example',
        createPaymentUrl: '/api/payments/create',
        paypalCreateOrderUrl: 'https://payments.example.test/paypal/create',
        paypalCaptureOrderUrl: 'https://payments.example.test/paypal/capture',
      },
    });

    expect(diagnostics.method('card')?.readiness).not.toBe('ready');
    expect(diagnostics.method('card')?.code).toBe('PROVIDER_MISCONFIGURED');
    expect(diagnostics.method('paypal')?.readiness).toBe('ready');
    expect(JSON.stringify(diagnostics.snapshot())).not.toContain('javascript:example');
  });

  it('uses a fixed message and drops raw provider errors', async () => {
    configure({
      enableMockMode: false,
      providers: { stripe: { publishableKey: 'pk_test_123' } },
      backend: { createPaymentUrl: '/api/payments/create' },
    });
    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    const diagnostics = TestBed.inject(EasyPaymentsDiagnosticsService);
    const registry = TestBed.inject(AdapterRegistry);
    await orchestrator.refreshAvailability(['card'], { ...SAMPLE_PRODUCT });

    const leaking: PaymentProviderAdapter = {
      provider: 'stripe',
      isMock: false,
      initialize: async () => undefined,
      isAvailable: async () => {
        throw new Error(`Bearer ${leakedToken} ${secretKey}`);
      },
      createPayment: async () => {
        throw new PaymentError({
          code: 'BACKEND_ERROR',
          message: `client_secret=${leakedToken}`,
          method: 'card',
          provider: 'stripe',
        });
      },
    };
    registry.register(leaking);
    spyOn(console, 'warn');

    await orchestrator.refreshAvailability(['card'], { ...SAMPLE_PRODUCT });
    const serialized = JSON.stringify(diagnostics.snapshot());
    const warnings = (console.warn as jasmine.Spy).calls.allArgs().flat().join(' ');

    expect(diagnostics.method('card')?.code).toBe('PAYMENT_FAILED');
    expect(diagnostics.method('card')?.message).toBe('The payment could not be completed.');
    expect(serialized).not.toContain(leakedToken);
    expect(serialized).not.toContain(secretKey);
    expect(serialized).not.toContain('originalError');
    expect(serialized).not.toContain('client_secret');
    expect(warnings).not.toContain(leakedToken);
    expect(warnings).not.toContain(secretKey);
  });

  it('returns frozen copies that do not change the published snapshot', async () => {
    const { diagnostics } = await publish(['card'], { enableMockMode: true, providers: {} });
    const first = diagnostics.snapshot();
    const second = diagnostics.snapshot();
    const card = diagnostics.method('card');

    expect(first).not.toBe(second);
    expect(first.methods).not.toBe(second.methods);
    expect(Object.isFrozen(first)).toBeTrue();
    expect(Object.isFrozen(first.methods)).toBeTrue();
    expect(Object.isFrozen(first.methods[0])).toBeTrue();
    expect(Object.isFrozen(card)).toBeTrue();
    expect(() => {
      (first.methods as PaymentMethodDiagnosticMutator[]).push({
        method: 'paypal',
        provider: 'paypal',
        readiness: 'ready',
        message: 'mutated',
        mock: false,
      });
    }).toThrow();
    expect(diagnostics.snapshot().methods.map((entry) => entry.method)).toEqual(['card']);
    expect(diagnostics.diagnostics().methods).not.toBe(first.methods);
  });

  it('updates the diagnostics signal after refresh and clears it on reinitialize', async () => {
    configure({
      enableMockMode: false,
      providers: {
        stripe: { publishableKey: 'pk_test_123' },
        paypal: { clientId: '' },
      },
      backend: { createPaymentUrl: '/api/payments/create' },
    });
    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    const diagnostics = TestBed.inject(EasyPaymentsDiagnosticsService);
    const config = TestBed.inject(EasyPaymentsConfigService);
    const lengths: number[] = [];

    TestBed.runInInjectionContext(() => {
      effect(() => {
        lengths.push(diagnostics.diagnostics().methods.length);
      });
    });
    TestBed.flushEffects();
    expect(diagnostics.snapshot().published).toBeFalse();

    await orchestrator.refreshAvailability(['card', 'paypal'], { ...SAMPLE_PRODUCT });
    TestBed.flushEffects();

    expect(lengths.at(-1)).toBe(2);
    expect(diagnostics.method('paypal')?.readiness).not.toBe('ready');
    expect(diagnostics.method('card')?.readiness).toBe('ready');

    config.replace({
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
    });
    await orchestrator.reinitialize();
    TestBed.flushEffects();

    expect(diagnostics.snapshot().published).toBeFalse();
    expect(diagnostics.snapshot().methods).toEqual([]);

    await orchestrator.refreshAvailability(['card', 'paypal'], { ...SAMPLE_PRODUCT });
    TestBed.flushEffects();

    expect(diagnostics.method('paypal')?.readiness).toBe('ready');
    expect(diagnostics.method('card')?.readiness).toBe('ready');
    expect(lengths.at(-1)).toBe(2);
  });

  it('can be injected and snapshotted during server-side rendering', async () => {
    configure(
      {
        enableMockMode: false,
        providers: {
          stripe: { publishableKey: 'pk_test_123' },
          paypal: { clientId: 'paypal-client-id' },
          applePay: {},
          googlePay: {},
        },
        backend: {
          createPaymentUrl: '/api/payments/create',
          paypalCreateOrderUrl: '/api/payments/paypal/create',
          paypalCaptureOrderUrl: '/api/payments/paypal/capture',
        },
      },
      { providers: [{ provide: PLATFORM_ID, useValue: 'server' }] },
    );
    const diagnostics = TestBed.inject(EasyPaymentsDiagnosticsService);
    const source = EasyPaymentsDiagnosticsService.toString();

    expect(source).not.toMatch(/\bwindow\b/);
    expect(source).not.toMatch(/\bdocument\b/);
    expect(source).not.toMatch(/\bnavigator\b/);
    expect(source).not.toMatch(/\blocalStorage\b/);
    expect(diagnostics.snapshot().published).toBeFalse();

    await TestBed.inject(PaymentOrchestratorService).refreshAvailability(
      ['card', 'paypal', 'apple-pay', 'google-pay'],
      { ...SAMPLE_PRODUCT },
    );
    const snapshot = diagnostics.snapshot();

    expect(snapshot.methods.find((entry) => entry.method === 'apple-pay')?.readiness).not.toBe('ready');
    expect(snapshot.methods.find((entry) => entry.method === 'google-pay')?.readiness).not.toBe('ready');
    expect(snapshot.methods.find((entry) => entry.method === 'card')?.readiness).toBe('ready');
    expect(snapshot.methods.find((entry) => entry.method === 'paypal')?.readiness).toBe('ready');
  });

  it('stops a consumer view without leaving the root snapshot stale', async () => {
    configure(
      { enableMockMode: true, providers: {} },
      { imports: [DiagnosticsProbe] },
    );
    const fixture = TestBed.createComponent(DiagnosticsProbe);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('false:0');
    fixture.destroy();

    const diagnostics = TestBed.inject(EasyPaymentsDiagnosticsService);
    await TestBed.inject(PaymentOrchestratorService).refreshAvailability(['card'], {
      ...SAMPLE_PRODUCT,
    });

    expect(diagnostics.snapshot().published).toBeTrue();
    expect(diagnostics.method('card')?.readiness).toBe('ready');
    expect(fixture.componentRef.hostView.destroyed).toBeTrue();

    const next = TestBed.createComponent(DiagnosticsProbe);
    next.detectChanges();
    expect(next.nativeElement.textContent).toContain('true:1');
    next.destroy();
  });
});

interface PaymentMethodDiagnosticMutator {
  method: string;
  provider: string;
  readiness: string;
  message: string;
  mock: boolean;
}
