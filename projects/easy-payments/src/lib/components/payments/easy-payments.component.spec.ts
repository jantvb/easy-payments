import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideEasyPayments } from '../../config/provide-easy-payments';
import { MockPaymentController } from '../../adapters/mock/mock-payment.controller';
import { BrowserGuard } from '../../utils/browser-guard';
import { PaymentError } from '../../errors/payment-error';
import { PaymentResult } from '../../models';
import { FakeBrowserGuard, SAMPLE_PRODUCT } from '../../testing/test-doubles';
import { EasyPaymentsComponent } from './easy-payments.component';

async function render(fixture: ComponentFixture<EasyPaymentsComponent>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function tileLabels(fixture: ComponentFixture<EasyPaymentsComponent>): string[] {
  return fixture.debugElement
    .queryAll(By.css('button.ep-tile'))
    .map((button) => {
      const el = button.nativeElement as HTMLButtonElement;
      return el.getAttribute('aria-label') ?? '';
    });
}

function payCta(fixture: ComponentFixture<EasyPaymentsComponent>): HTMLButtonElement | null {
  return fixture.nativeElement.querySelector(
    'button.ep-mock-panel__cta, button.ep-stripe-card__pay',
  ) as HTMLButtonElement | null;
}

describe('EasyPaymentsComponent', () => {
  let fixture: ComponentFixture<EasyPaymentsComponent>;
  let browser: FakeBrowserGuard;

  beforeEach(async () => {
    browser = new FakeBrowserGuard();
    await TestBed.configureTestingModule({
      imports: [EasyPaymentsComponent],
      providers: [
        provideEasyPayments({ enableMockMode: true, providers: {} }),
        { provide: BrowserGuard, useValue: browser },
      ],
    }).compileComponents();

    TestBed.inject(MockPaymentController).reset();
    fixture = TestBed.createComponent(EasyPaymentsComponent);
    fixture.componentRef.setInput('product', { ...SAMPLE_PRODUCT });
  });

  it('renders the requested methods in array order', async () => {
    fixture.componentRef.setInput('methods', ['paypal', 'apple-pay', 'card']);
    await render(fixture);

    expect(tileLabels(fixture)).toEqual([
      'PayPal, demo mode, selected',
      'Apple Pay, demo mode',
      'Card, demo mode',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Complete your purchase');
    expect(fixture.nativeElement.textContent).toContain('Premium Plan');
  });

  it('updates visual order when the methods array changes', async () => {
    fixture.componentRef.setInput('methods', ['card', 'paypal']);
    await render(fixture);
    expect(tileLabels(fixture).map((label) => label.replace(/,.*/, ''))).toEqual(['Card', 'PayPal']);

    fixture.componentRef.setInput('methods', ['paypal', 'card']);
    await render(fixture);
    expect(tileLabels(fixture).map((label) => label.replace(/,.*/, ''))).toEqual(['PayPal', 'Card']);
  });

  it('hides methods that are not enabled in the methods array', async () => {
    fixture.componentRef.setInput('methods', ['card']);
    await render(fixture);

    expect(tileLabels(fixture)).toEqual(['Card, demo mode, selected']);
    expect(fixture.nativeElement.textContent).not.toContain('PayPal');
  });

  it('hides methods whose mock adapter reports unavailable', async () => {
    TestBed.inject(MockPaymentController).setUnavailableMethods(['paypal']);
    fixture.componentRef.setInput('methods', ['paypal', 'card']);
    await render(fixture);

    expect(tileLabels(fixture)).toEqual(['Card, demo mode, selected']);
  });

  it('selects a payment method and shows only that method panel', async () => {
    fixture.componentRef.setInput('methods', ['paypal', 'card']);
    await render(fixture);

    expect(fixture.componentInstance.selectedMethod()).toBe('paypal');
    expect(fixture.nativeElement.textContent).toContain('Pay with PayPal');

    const cardTile = fixture.debugElement
      .queryAll(By.css('button.ep-tile'))
      .find((btn) =>
        ((btn.nativeElement as HTMLButtonElement).getAttribute('aria-label') ?? '').includes('Card'),
      );
    cardTile!.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedMethod()).toBe('card');
    expect(fixture.nativeElement.textContent).toContain('Pay with Card');
    expect(fixture.nativeElement.querySelector('easy-mock-method-panel')).toBeTruthy();
  });

  it('exposes radiogroup accessibility attributes on the selector', async () => {
    fixture.componentRef.setInput('methods', ['card', 'paypal']);
    await render(fixture);

    const group = fixture.nativeElement.querySelector('[role="radiogroup"]');
    expect(group).toBeTruthy();
    const selected = fixture.nativeElement.querySelector('button.ep-tile[aria-checked="true"]');
    expect(selected).toBeTruthy();
  });

  it('renders a product summary with formatted amount', async () => {
    fixture.componentRef.setInput('methods', ['card']);
    await render(fixture);

    const summary = fixture.nativeElement.querySelector('easy-checkout-product-summary');
    expect(summary.textContent).toContain('Premium Plan');
    expect(summary.textContent).toMatch(/\$99\.99|USD/);
  });

  it('uses a CSS grid structure for payment method tiles', async () => {
    fixture.componentRef.setInput('methods', ['card', 'paypal', 'klarna']);
    await render(fixture);

    const grid = fixture.nativeElement.querySelector('.ep-selector__grid');
    expect(grid).toBeTruthy();
    expect(getComputedStyle(grid).display).toBe('grid');
  });

  it('applies the light theme class', async () => {
    fixture.componentRef.setInput('theme', 'light');
    fixture.componentRef.setInput('methods', ['card']);
    await render(fixture);

    expect(fixture.nativeElement.classList.contains('ep-theme-light')).toBeTrue();
    expect(fixture.nativeElement.getAttribute('data-theme')).toBe('light');
  });

  it('applies the dark theme class', async () => {
    fixture.componentRef.setInput('theme', 'dark');
    fixture.componentRef.setInput('methods', ['card']);
    await render(fixture);

    expect(fixture.nativeElement.classList.contains('ep-theme-dark')).toBeTrue();
    expect(fixture.nativeElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resolves system theme from prefers-color-scheme', async () => {
    browser.prefersDark = true;
    fixture.componentRef.setInput('theme', 'system');
    fixture.componentRef.setInput('methods', ['card']);
    await render(fixture);

    expect(fixture.nativeElement.classList.contains('ep-theme-dark')).toBeTrue();
  });

  it('updates when the system theme changes', async () => {
    browser.prefersDark = false;
    fixture.componentRef.setInput('theme', 'system');
    fixture.componentRef.setInput('methods', ['card']);
    await render(fixture);
    expect(fixture.nativeElement.classList.contains('ep-theme-light')).toBeTrue();

    browser.setPrefersDark(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('ep-theme-dark')).toBeTrue();
  });

  it('emits success for a mock payment', async () => {
    const successes: PaymentResult[] = [];
    fixture.componentInstance.success.subscribe((result) => successes.push(result));
    fixture.componentRef.setInput('methods', ['card']);
    await render(fixture);

    payCta(fixture)!.click();
    await fixture.whenStable();

    expect(successes.length).toBe(1);
    expect(successes[0].status).toBe('success');
    expect(successes[0].method).toBe('card');
    expect(successes[0].metadata?.['mock']).toBeTrue();
  });

  it('emits cancel for a mock cancellation', async () => {
    TestBed.inject(MockPaymentController).setOutcome('cancelled');
    const cancellations: PaymentResult[] = [];
    fixture.componentInstance.cancel.subscribe((result) => cancellations.push(result));
    fixture.componentRef.setInput('methods', ['paypal']);
    await render(fixture);

    payCta(fixture)!.click();
    await fixture.whenStable();

    expect(cancellations.length).toBe(1);
    expect(cancellations[0].status).toBe('cancelled');
  });

  it('emits a normalized PaymentError for a mock failure', async () => {
    TestBed.inject(MockPaymentController).setOutcome('failed');
    const errors: PaymentError[] = [];
    fixture.componentInstance.error.subscribe((error) => errors.push(error));
    fixture.componentRef.setInput('methods', ['card']);
    await render(fixture);

    payCta(fixture)!.click();
    await fixture.whenStable();

    expect(errors.length).toBe(1);
    expect(errors[0]).toBeInstanceOf(PaymentError);
    expect(errors[0].code).toBe('PAYMENT_FAILED');
    expect(errors[0].method).toBe('card');
  });

  it('emits PRODUCT_INVALID for an invalid amount', async () => {
    const errors: PaymentError[] = [];
    fixture.componentInstance.error.subscribe((error) => errors.push(error));
    fixture.componentRef.setInput('product', { ...SAMPLE_PRODUCT, amount: 0 });
    fixture.componentRef.setInput('methods', ['card']);
    await render(fixture);

    expect(errors.some((error) => error.code === 'PRODUCT_INVALID')).toBeTrue();
  });

  it('shows a subtle demo indicator on mock method tiles', async () => {
    fixture.componentRef.setInput('methods', ['paypal']);
    await render(fixture);

    const demoBadge = fixture.nativeElement.querySelector('.ep-tile__demo');
    expect(demoBadge?.textContent?.trim()).toBe('Demo');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Demo Mode - No real payment will be processed.',
    );
  });
});
