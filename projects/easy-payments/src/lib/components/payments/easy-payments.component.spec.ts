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

function buttonLabels(fixture: ComponentFixture<EasyPaymentsComponent>): string[] {
  return fixture.debugElement
    .queryAll(By.css('button.ep-button'))
    .map((button) => (button.nativeElement as HTMLButtonElement).getAttribute('aria-label') ?? '');
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

    expect(buttonLabels(fixture)).toEqual([
      'PayPal (Demo mode)',
      'Apple Pay (Demo mode)',
      'Card (Demo mode)',
    ]);
    expect(fixture.nativeElement.textContent).toContain(
      'Demo Mode - No real payment will be processed.',
    );
  });

  it('updates visual order when the methods array changes', async () => {
    fixture.componentRef.setInput('methods', ['card', 'paypal']);
    await render(fixture);
    expect(buttonLabels(fixture)).toEqual(['Card (Demo mode)', 'PayPal (Demo mode)']);

    fixture.componentRef.setInput('methods', ['paypal', 'card']);
    await render(fixture);
    expect(buttonLabels(fixture)).toEqual(['PayPal (Demo mode)', 'Card (Demo mode)']);
  });

  it('hides methods that are not enabled in the methods array', async () => {
    fixture.componentRef.setInput('methods', ['card']);
    await render(fixture);

    expect(buttonLabels(fixture)).toEqual(['Card (Demo mode)']);
    expect(fixture.nativeElement.textContent).not.toContain('PayPal');
  });

  it('hides methods whose mock adapter reports unavailable', async () => {
    TestBed.inject(MockPaymentController).setUnavailableMethods(['paypal']);
    fixture.componentRef.setInput('methods', ['paypal', 'card']);
    await render(fixture);

    expect(buttonLabels(fixture)).toEqual(['Card (Demo mode)']);
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

    (fixture.nativeElement.querySelector('button.ep-button') as HTMLButtonElement).click();
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

    (fixture.nativeElement.querySelector('button.ep-button') as HTMLButtonElement).click();
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

    (fixture.nativeElement.querySelector('button.ep-button') as HTMLButtonElement).click();
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
});
