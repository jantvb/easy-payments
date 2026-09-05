import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideEasyPayments } from '@easy-payments/angular';
import { App } from './app';
import {
  clearPersistedDemoMode,
  DEMO_MODE_STORAGE_KEY,
  persistDemoMode,
  readPersistedDemoMode,
} from './demo-mode-persistence';

describe('demo-mode-persistence', () => {
  let memory: Record<string, string>;
  let storage: Storage;

  beforeEach(() => {
    memory = {};
    storage = {
      getItem: (key: string) => (key in memory ? memory[key] : null),
      setItem: (key: string, value: string) => {
        memory[key] = value;
      },
      removeItem: (key: string) => {
        delete memory[key];
      },
      clear: () => {
        memory = {};
      },
      key: () => null,
      length: 0,
    };
  });

  it('returns null when unset', () => {
    expect(readPersistedDemoMode(storage)).toBeNull();
  });

  it('persists and restores real mode', () => {
    persistDemoMode('real', storage);
    expect(storage.getItem(DEMO_MODE_STORAGE_KEY)).toBe('real');
    expect(readPersistedDemoMode(storage)).toBe('real');
  });

  it('persists demo mode', () => {
    persistDemoMode('demo', storage);
    expect(readPersistedDemoMode(storage)).toBe('demo');
  });
});

describe('App', () => {
  beforeEach(async () => {
    clearPersistedDemoMode();
    history.replaceState({}, '', '/');

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        provideEasyPayments({ enableMockMode: true, providers: {} }),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    clearPersistedDemoMode();
    history.replaceState({}, '', '/');
  });

  async function flushCatalogIfPending(): Promise<void> {
    const http = TestBed.inject(HttpTestingController);
    const catalogReqs = http.match((req) => req.url.includes('/api/catalog/products'));
    for (const req of catalogReqs) {
      req.flush({
        id: 'premium-plan',
        name: 'Premium Plan',
        description: 'One year subscription',
        unitAmount: 99.99,
        currency: 'USD',
      });
    }
  }

  async function settle(fixture: ReturnType<typeof TestBed.createComponent<App>>): Promise<void> {
    fixture.detectChanges();
    const deadline = Date.now() + 5000;

    while (!fixture.componentInstance.checkoutReady() && Date.now() < deadline) {
      // Flush catalog before whenStable — pending HttpClientTesting requests can
      // otherwise stall whenStable and prevent the flush loop from progressing.
      await flushCatalogIfPending();
      fixture.detectChanges();
      await Promise.resolve();
      if (fixture.componentInstance.checkoutReady()) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    await flushCatalogIfPending();
    expect(fixture.componentInstance.checkoutReady()).toBeTrue();
    // Avoid fixture.whenStable() here: Real mode mounts Stripe ECE for Apple Pay
    // availability and can keep the zone unstable indefinitely in Karma.
    fixture.detectChanges();
  }

  it('should create the demo playground', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Easy Payments demo and default to Demo Mode', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Checkout playground');
    expect(compiled.textContent).toContain('Demo Mode');
    expect(fixture.componentInstance.mode()).toBe('demo');
    expect(compiled.querySelector('easy-payments')).toBeTruthy();
  });

  it('defaults payment methods with Card first in a six-method order', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.methods()).toEqual([
      'card',
      'paypal',
      'apple-pay',
      'google-pay',
      'klarna',
      'affirm',
    ]);
    expect(app.checkoutMaxWidth()).toBe(640);

    await settle(fixture);

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('button.ep-tile') as NodeListOf<HTMLButtonElement>,
    ).map((button) => (button.getAttribute('aria-label') ?? '').replace(/,.*/, ''));

    expect(labels).toEqual(['Card', 'PayPal', 'Apple Pay', 'Google Pay', 'Klarna', 'Affirm']);
    expect(labels[0]).toBe('Card');
    expect(
      (fixture.nativeElement.querySelector('button.ep-tile[aria-checked="true"]') as HTMLButtonElement)
        ?.getAttribute('aria-label') ?? '',
    ).toContain('Card');
  });

  it('updates the checkout maxWidth control live', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await settle(fixture);
    app.setCheckoutMaxWidth(1100);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('easy-payments') as HTMLElement;
    expect(app.checkoutMaxWidth()).toBe(1100);
    expect(host.style.maxWidth).toBe('1100px');
  });

  it('keeps product pricing editable in Real mode', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.product().amount).toBe(99);

    app.mode.set('real');
    app.trustedCatalogProduct.set({
      id: 'premium-plan',
      name: 'Premium Plan',
      description: 'One year subscription',
      unitAmount: 99,
      currency: 'USD',
    });

    expect(app.productFieldsLocked()).toBeFalse();
    expect(app.product().id).toBe('premium-plan');
    expect(app.product().amount).toBe(99);
    expect(app.product().currency).toBe('USD');

    // Edits in Real mode reach the product the checkout renders and charges.
    app.productAmount.set('2.5');
    expect(app.product().amount).toBe(2.5);
  });

  it('persists Real mode when selected', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);

    if (!fixture.componentInstance.realProvidersReady()) {
      persistDemoMode('real');
      expect(readPersistedDemoMode()).toBe('real');
      return;
    }

    const switchPromise = fixture.componentInstance.setMode('real');
    await flushCatalogIfPending();
    await switchPromise;
    fixture.detectChanges();

    expect(fixture.componentInstance.mode()).toBe('real');
    expect(readPersistedDemoMode()).toBe('real');
    expect(fixture.nativeElement.textContent).toContain('Real / Test Providers');
  });

  it('forces Real recovery mode when Klarna return URL is present', async () => {
    history.replaceState(
      {},
      '',
      '/?payment_intent=pi_x&payment_intent_client_secret=sec_x&ep_method=klarna',
    );

    const fixture = TestBed.createComponent(App);
    await settle(fixture);

    if (fixture.componentInstance.realProvidersReady()) {
      expect(fixture.componentInstance.mode()).toBe('real');
      expect(readPersistedDemoMode()).toBe('real');
    } else {
      expect(fixture.componentInstance.checkoutReady()).toBeTrue();
    }
  });

  it('Continue after success preserves Real mode when already real', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    const app = fixture.componentInstance;

    app.mode.set('real');
    persistDemoMode('real');
    app.onSuccessContinue({
      status: 'success',
      method: 'klarna',
      provider: 'klarna',
      transactionId: 'pi_continue',
    });

    expect(app.mode()).toBe('real');
    expect(readPersistedDemoMode()).toBe('real');
    expect(app.lastEvent()).toContain('Continue after success');
  });

  it('persists Demo when selecting Demo Mode', async () => {
    const fixture = TestBed.createComponent(App);
    await settle(fixture);
    await fixture.componentInstance.setMode('demo');
    expect(readPersistedDemoMode()).toBe('demo');
    expect(fixture.componentInstance.mode()).toBe('demo');
  });
});
