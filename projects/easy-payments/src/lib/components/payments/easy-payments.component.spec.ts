import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { provideEasyPayments } from '../../config/provide-easy-payments';
import { MockPaymentController } from '../../adapters/mock/mock-payment.controller';
import { StripeRedirectRecoveryService } from '../../adapters/stripe/stripe-redirect-recovery.service';
import { BrowserGuard } from '../../utils/browser-guard';
import { PaymentError } from '../../errors/payment-error';
import { PaymentResult } from '../../models';
import { FakeBrowserGuard, SAMPLE_PRODUCT } from '../../testing/test-doubles';
import { PaymentOrchestratorService } from '../../services/payment-orchestrator.service';
import { ApplePayAdapter } from '../../adapters/apple-pay/apple-pay.adapter';
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

  it('renders six methods in the supplied array order and selects the first', async () => {
    fixture.componentRef.setInput('methods', [
      'card',
      'paypal',
      'apple-pay',
      'google-pay',
      'klarna',
      'affirm',
    ]);
    await render(fixture);

    expect(tileLabels(fixture).map((label) => label.replace(/,.*/, ''))).toEqual([
      'Card',
      'PayPal',
      'Apple Pay',
      'Google Pay',
      'Klarna',
      'Affirm',
    ]);
    expect(fixture.componentInstance.selectedMethod()).toBe('card');
    expect(fixture.nativeElement.textContent).toContain('Pay with Card');
    expect(fixture.componentInstance.effectiveMaxWidth()).toBe(640);
    expect(fixture.nativeElement.style.maxWidth).toBe('640px');
  });

  it('keeps a Minimal-style Apple Pay bootstrap host while availability is unknown', async () => {
    const applePay = TestBed.inject(ApplePayAdapter);
    const configured = signal(true);
    spyOn(applePay, 'isConfigured').and.returnValue(true);
    Object.defineProperty(applePay, 'configured', {
      configurable: true,
      get: () => configured.asReadonly(),
    });
    spyOn(applePay, 'mountExpressCheckout').and.returnValue(Promise.resolve());
    spyOn(applePay, 'unmountExpressCheckout');

    fixture.componentRef.setInput('methods', ['card', 'apple-pay']);
    await render(fixture);

    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    (
      orchestrator as unknown as {
        _availableMethods: { set: (value: unknown) => void };
      }
    )._availableMethods.set([
      { method: 'card', isMock: true, available: true, status: 'available' },
      { method: 'apple-pay', isMock: false, available: false, status: 'checking' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.showApplePayBootstrap()).toBeTrue();
    expect(fixture.componentInstance.hasRealApplePayMethod()).toBeFalse();
    expect(tileLabels(fixture).some((label) => label.startsWith('Apple Pay'))).toBeFalse();

    const bootstrap = fixture.nativeElement.querySelector(
      '.ep-apay-bootstrap__host',
    ) as HTMLElement | null;
    expect(bootstrap).toBeTruthy();
  });

  it('renders the Apple Pay express button in its list position once available', async () => {
    fixture.componentRef.setInput('methods', ['card', 'apple-pay', 'paypal']);
    await render(fixture);

    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    (
      orchestrator as unknown as {
        _availableMethods: { set: (value: unknown) => void };
      }
    )._availableMethods.set([
      { method: 'card', isMock: true, available: true, status: 'available' },
      { method: 'apple-pay', isMock: false, available: true, status: 'available' },
      { method: 'paypal', isMock: true, available: true, status: 'available' },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.hasRealApplePayMethod()).toBeTrue();
    expect(fixture.componentInstance.showApplePayBootstrap()).toBeFalse();
    expect(fixture.componentInstance.applePayExpressInList()).toBeTrue();

    // Apple Pay is no longer a selectable tile: Stripe's own button takes that cell.
    expect(tileLabels(fixture).map((label) => label.replace(/,.*/, ''))).toEqual([
      'Card',
      'PayPal',
    ]);

    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.ep-selector__grid > easy-payment-method-tile, .ep-selector__grid > .ep-selector__express',
      ),
    );
    expect(cells.length).toBe(3);
    expect(cells[1].classList.contains('ep-selector__express')).toBeTrue();
    expect(cells[1].querySelector('easy-apple-pay-payment')).toBeTruthy();

    // Selecting it is a no-op; the express button owns the interaction.
    fixture.componentInstance.selectMethod('apple-pay');
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedMethod()).toBe('card');
    expect(fixture.componentInstance.showApplePayPanel()).toBeFalse();
  });

  it('hides Apple Pay when Stripe availability is false (no empty grid cell)', async () => {
    fixture.componentRef.setInput('methods', ['card', 'apple-pay', 'paypal']);
    await render(fixture);

    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    (
      orchestrator as unknown as {
        _availableMethods: { set: (value: unknown) => void };
      }
    )._availableMethods.set([
      { method: 'card', isMock: true, available: true, status: 'available' },
      { method: 'apple-pay', isMock: false, available: false, status: 'unavailable' },
      { method: 'paypal', isMock: true, available: true, status: 'available' },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.hasRealApplePayMethod()).toBeFalse();
    expect(fixture.componentInstance.applePayExpressInList()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.ep-selector__express')).toBeNull();
    expect(tileLabels(fixture).map((label) => label.replace(/,.*/, ''))).toEqual([
      'Card',
      'PayPal',
    ]);
  });

  it('does not show Apple Pay when merchant methods omit it even if runtime says available (TEST D)', async () => {
    fixture.componentRef.setInput('methods', ['card', 'paypal']);
    await render(fixture);

    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    (
      orchestrator as unknown as {
        _availableMethods: { set: (value: unknown) => void };
      }
    )._availableMethods.set([
      { method: 'card', isMock: true, available: true, status: 'available' },
      { method: 'apple-pay', isMock: false, available: true, status: 'available' },
      { method: 'paypal', isMock: true, available: true, status: 'available' },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.methods().includes('apple-pay')).toBeFalse();
    expect(fixture.componentInstance.hasRealApplePayMethod()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.ep-selector__express')).toBeNull();
    expect(fixture.nativeElement.querySelector('easy-apple-pay-payment')).toBeNull();
  });

  it('preserves merchant method order after runtime filtering (TEST I)', async () => {
    fixture.componentRef.setInput('methods', ['paypal', 'card', 'apple-pay', 'klarna']);
    await render(fixture);

    const orchestrator = TestBed.inject(PaymentOrchestratorService);
    (
      orchestrator as unknown as {
        _availableMethods: { set: (value: unknown) => void };
      }
    )._availableMethods.set([
      { method: 'paypal', isMock: true, available: true, status: 'available' },
      { method: 'card', isMock: true, available: true, status: 'available' },
      { method: 'apple-pay', isMock: false, available: true, status: 'available' },
      { method: 'klarna', isMock: true, available: true, status: 'available' },
    ]);
    fixture.detectChanges();

    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.ep-selector__grid > easy-payment-method-tile, .ep-selector__grid > .ep-selector__express',
      ),
    );
    expect(cells.length).toBe(4);
    expect(cells[0].tagName.toLowerCase()).toBe('easy-payment-method-tile');
    expect(cells[1].tagName.toLowerCase()).toBe('easy-payment-method-tile');
    expect(cells[2].classList.contains('ep-selector__express')).toBeTrue();
    expect(cells[3].tagName.toLowerCase()).toBe('easy-payment-method-tile');
    expect(tileLabels(fixture).map((label) => label.replace(/,.*/, ''))).toEqual([
      'PayPal',
      'Card',
      'Klarna',
    ]);
  });

  it('clears Apple Pay availability when merchant removes apple-pay from methods', async () => {
    const applePay = TestBed.inject(ApplePayAdapter);
    const clearSpy = spyOn(applePay, 'clearAvailability').and.callThrough();

    fixture.componentRef.setInput('methods', ['card', 'apple-pay']);
    await render(fixture);
    clearSpy.calls.reset();

    fixture.componentRef.setInput('methods', ['card']);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(clearSpy).toHaveBeenCalled();
  });

  it('clamps and applies maxWidth on the host', async () => {
    fixture.componentRef.setInput('methods', ['card', 'paypal']);
    fixture.componentRef.setInput('maxWidth', 200);
    await render(fixture);
    expect(fixture.componentInstance.effectiveMaxWidth()).toBe(320);
    expect(fixture.nativeElement.style.maxWidth).toBe('320px');

    fixture.componentRef.setInput('maxWidth', 3000);
    fixture.detectChanges();
    expect(fixture.componentInstance.effectiveMaxWidth()).toBe(1200);

    fixture.componentRef.setInput('maxWidth', 'not-a-number');
    fixture.detectChanges();
    expect(fixture.componentInstance.effectiveMaxWidth()).toBe(640);

    fixture.componentRef.setInput('maxWidth', 900);
    fixture.detectChanges();
    expect(fixture.componentInstance.effectiveMaxWidth()).toBe(900);
    expect(fixture.nativeElement.style.maxWidth).toBe('900px');
  });

  it('defaults to appearance=default and stays backward compatible', async () => {
    fixture.componentRef.setInput('methods', ['card', 'paypal']);
    await render(fixture);

    expect(fixture.componentInstance.appearance()).toBe('default');
    expect(fixture.nativeElement.classList.contains('ep-appearance-transparent')).toBeFalse();
    expect(fixture.nativeElement.getAttribute('data-appearance')).toBe('default');

    const shell = fixture.nativeElement.querySelector('.ep-checkout') as HTMLElement;
    expect(shell).toBeTruthy();
    const style = getComputedStyle(shell);
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.borderTopWidth).not.toBe('0px');
  });

  it('applies transparent appearance by removing outer shell chrome only', async () => {
    fixture.componentRef.setInput('methods', ['card', 'paypal']);
    fixture.componentRef.setInput('appearance', 'transparent');
    fixture.componentRef.setInput('theme', 'light');
    await render(fixture);

    expect(fixture.componentInstance.appearance()).toBe('transparent');
    expect(fixture.nativeElement.classList.contains('ep-appearance-transparent')).toBeTrue();
    expect(fixture.nativeElement.getAttribute('data-appearance')).toBe('transparent');
    expect(fixture.nativeElement.classList.contains('ep-theme-light')).toBeTrue();

    const shell = fixture.nativeElement.querySelector('.ep-checkout') as HTMLElement;
    const style = getComputedStyle(shell);
    expect(style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent').toBeTrue();
    expect(style.borderTopWidth).toBe('0px');
    expect(style.boxShadow === 'none' || style.boxShadow === '').toBeTrue();
    expect(style.paddingTop).toBe('0px');

    // Internal payment methods still render.
    expect(tileLabels(fixture).map((label) => label.replace(/,.*/, ''))).toEqual(['Card', 'PayPal']);
    expect(fixture.componentInstance.effectiveMaxWidth()).toBe(640);
  });

  it('keeps theme and appearance independent', async () => {
    fixture.componentRef.setInput('methods', ['card']);
    fixture.componentRef.setInput('theme', 'dark');
    fixture.componentRef.setInput('appearance', 'transparent');
    await render(fixture);

    expect(fixture.nativeElement.classList.contains('ep-theme-dark')).toBeTrue();
    expect(fixture.nativeElement.classList.contains('ep-appearance-transparent')).toBeTrue();
    expect(fixture.nativeElement.getAttribute('data-theme')).toBe('dark');
    expect(fixture.nativeElement.getAttribute('data-appearance')).toBe('transparent');
  });

  it('keeps selected and unselected tiles the same size', async () => {
    fixture.componentRef.setInput('methods', ['card', 'paypal']);
    await render(fixture);

    const tiles = fixture.nativeElement.querySelectorAll('button.ep-tile') as NodeListOf<HTMLButtonElement>;
    expect(tiles.length).toBe(2);
    const selected = tiles[0];
    const unselected = tiles[1];
    expect(selected.getAttribute('aria-checked')).toBe('true');
    expect(unselected.getAttribute('aria-checked')).toBe('false');
    expect(getComputedStyle(selected).height).toBe(getComputedStyle(unselected).height);
    expect(Math.abs(selected.getBoundingClientRect().width - unselected.getBoundingClientRect().width)).toBeLessThan(
      1,
    );
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

  describe('checkout view states', () => {
    it('shows success confirmation with product, total, and method after mock success', async () => {
      const successes: PaymentResult[] = [];
      fixture.componentInstance.success.subscribe((result) => successes.push(result));
      fixture.componentRef.setInput('methods', ['google-pay']);
      await render(fixture);

      payCta(fixture)!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(successes.length).toBe(1);
      expect(fixture.componentInstance.viewState()).toBe('success');
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Payment successful');
      expect(text).toContain('Premium Plan');
      expect(text).toMatch(/\$99\.99/);
      expect(text).toContain('Google Pay');
      expect(text).toContain('Continue');
      expect(text).not.toContain('Complete your purchase');
      expect(fixture.nativeElement.querySelector('easy-mock-method-panel')).toBeNull();
    });

    it('emits success exactly once and shows truncated transaction reference', async () => {
      const successes: PaymentResult[] = [];
      fixture.componentInstance.success.subscribe((result) => successes.push(result));
      fixture.componentRef.setInput('methods', ['card']);
      await render(fixture);

      payCta(fixture)!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(successes.length).toBe(1);
      const txn = successes[0].transactionId;
      expect(txn).toBeTruthy();
      if (txn && txn.length > 8) {
        expect(fixture.nativeElement.textContent).toContain(`••••${txn.slice(-4)}`);
        expect(fixture.nativeElement.textContent).not.toContain(txn);
      }
    });

    it('does not show confirmation when successBehavior is event-only', async () => {
      const successes: PaymentResult[] = [];
      fixture.componentInstance.success.subscribe((result) => successes.push(result));
      fixture.componentRef.setInput('methods', ['card']);
      fixture.componentRef.setInput('successBehavior', 'event-only');
      await render(fixture);

      payCta(fixture)!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(successes.length).toBe(1);
      expect(fixture.componentInstance.viewState()).toBe('checkout');
      expect(fixture.nativeElement.textContent).toContain('Complete your purchase');
      expect(fixture.nativeElement.textContent).not.toContain('Payment successful');
    });

    it('emits successContinue and resets checkout on Continue', async () => {
      const continues: PaymentResult[] = [];
      fixture.componentInstance.successContinue.subscribe((result) => continues.push(result));
      fixture.componentRef.setInput('methods', ['card']);
      await render(fixture);

      payCta(fixture)!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      const continueBtn = fixture.nativeElement.querySelector(
        'button.ep-outcome__action',
      ) as HTMLButtonElement;
      expect(continueBtn?.textContent?.trim()).toBe('Continue');
      continueBtn.click();
      fixture.detectChanges();

      expect(continues.length).toBe(1);
      expect(fixture.componentInstance.viewState()).toBe('checkout');
      expect(fixture.nativeElement.textContent).toContain('Complete your purchase');
      expect(payCta(fixture)).toBeTruthy();
    });

    it('shows processing state and prevents duplicate mock submits', async () => {
      TestBed.inject(MockPaymentController).setDelay(200);
      fixture.componentRef.setInput('methods', ['card']);
      await render(fixture);

      const cta = payCta(fixture)!;
      cta.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.viewState()).toBe('processing');
      expect(fixture.nativeElement.textContent).toContain('Processing payment...');
      expect(fixture.nativeElement.textContent).toContain("Please don't close this window.");
      expect(payCta(fixture)).toBeNull();

      await fixture.whenStable();
      fixture.detectChanges();
      expect(fixture.componentInstance.viewState()).toBe('success');
    });

    it('shows error screen for mock failure and Try again restores checkout', async () => {
      TestBed.inject(MockPaymentController).setOutcome('failed');
      const errors: PaymentError[] = [];
      fixture.componentInstance.error.subscribe((error) => errors.push(error));
      fixture.componentRef.setInput('methods', ['card']);
      await render(fixture);

      payCta(fixture)!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(errors.length).toBe(1);
      expect(fixture.componentInstance.viewState()).toBe('error');
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Payment failed');
      expect(text).toContain("We couldn't complete your payment.");
      expect(text).not.toContain('Your payment method was not charged');
      expect(text).not.toContain('{');

      const tryAgain = fixture.nativeElement.querySelector(
        'button.ep-outcome__action',
      ) as HTMLButtonElement;
      expect(tryAgain.textContent?.trim()).toBe('Try again');
      tryAgain.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.viewState()).toBe('checkout');
      expect(payCta(fixture)).toBeTruthy();
    });

    it('shows cancelled screen (not error) and Return to checkout works', async () => {
      TestBed.inject(MockPaymentController).setOutcome('cancelled');
      const cancellations: PaymentResult[] = [];
      fixture.componentInstance.cancel.subscribe((result) => cancellations.push(result));
      fixture.componentRef.setInput('methods', ['paypal']);
      await render(fixture);

      payCta(fixture)!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(cancellations.length).toBe(1);
      expect(fixture.componentInstance.viewState()).toBe('cancelled');
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Payment cancelled');
      expect(text).toContain('No payment was completed.');
      expect(text).not.toContain('Payment failed');

      const back = fixture.nativeElement.querySelector(
        'button.ep-outcome__action',
      ) as HTMLButtonElement;
      expect(back.textContent?.trim()).toBe('Return to checkout');
      back.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.viewState()).toBe('checkout');
      expect(fixture.nativeElement.textContent).toContain('Pay with PayPal');
    });

    it('locks method switching while processing', async () => {
      TestBed.inject(MockPaymentController).setDelay(200);
      fixture.componentRef.setInput('methods', ['card', 'paypal']);
      await render(fixture);

      expect(fixture.componentInstance.selectedMethod()).toBe('card');
      payCta(fixture)!.click();
      fixture.detectChanges();

      fixture.componentInstance.selectMethod('paypal');
      expect(fixture.componentInstance.selectedMethod()).toBe('card');

      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('keeps success/error/cancelled themed with the host theme', async () => {
      fixture.componentRef.setInput('theme', 'dark');
      fixture.componentRef.setInput('methods', ['card']);
      await render(fixture);

      payCta(fixture)!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.classList.contains('ep-theme-dark')).toBeTrue();
      expect(fixture.nativeElement.querySelector('easy-checkout-outcome')).toBeTruthy();
    });

    it('Klarna return recovery shows processing then success confirmation once', async () => {
      const successes: PaymentResult[] = [];
      fixture.componentInstance.success.subscribe((result) => successes.push(result));
      fixture.componentRef.setInput('methods', ['card', 'klarna']);
      await render(fixture);

      expect(fixture.componentInstance.selectedMethod()).toBe('card');

      fixture.componentInstance.onKlarnaReturning(true);
      fixture.detectChanges();
      expect(fixture.componentInstance.viewState()).toBe('processing');
      expect(fixture.componentInstance.selectedMethod()).toBe('klarna');
      expect(fixture.nativeElement.textContent).toContain('Processing payment...');

      fixture.componentInstance.onKlarnaSuccess({
        status: 'success',
        method: 'klarna',
        provider: 'klarna',
        transactionId: 'pi_klarna_abc12345',
      });
      fixture.componentInstance.onKlarnaReturning(false);
      fixture.detectChanges();

      expect(successes.length).toBe(1);
      expect(successes[0].method).toBe('klarna');
      expect(fixture.componentInstance.viewState()).toBe('success');
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Payment successful');
      expect(text).toContain('Premium Plan');
      expect(text).toMatch(/\$99\.99/);
      expect(text).toContain('Klarna');
      expect(text).toContain('••••2345');
    });

    it('Klarna parent-owned redirect recovery transitions Processing to Success', async () => {
      history.replaceState(
        {},
        '',
        '/?payment_intent=pi_parent&payment_intent_client_secret=sec_parent&ep_method=klarna',
      );

      const recovery = TestBed.inject(StripeRedirectRecoveryService);
      spyOn(recovery, 'consumeReturn').and.resolveTo({
        status: 'success',
        method: 'klarna',
        provider: 'klarna',
        transactionId: 'pi_parent_txn',
      });

      const successes: PaymentResult[] = [];
      const fixtureReturn = TestBed.createComponent(EasyPaymentsComponent);
      fixtureReturn.componentRef.setInput('product', { ...SAMPLE_PRODUCT });
      fixtureReturn.componentRef.setInput('methods', ['klarna', 'card']);
      fixtureReturn.componentInstance.success.subscribe((result) => successes.push(result));

      expect(fixtureReturn.componentInstance.viewState()).toBe('processing');

      fixtureReturn.detectChanges();
      await fixtureReturn.whenStable();
      await Promise.resolve();
      await Promise.resolve();
      fixtureReturn.detectChanges();

      expect(recovery.consumeReturn).toHaveBeenCalled();
      expect(successes.length).toBe(1);
      expect(successes[0].method).toBe('klarna');
      expect(successes[0].transactionId).toBe('pi_parent_txn');
      expect(fixtureReturn.componentInstance.viewState()).toBe('success');
      expect(fixtureReturn.nativeElement.textContent).toContain('Payment successful');
      expect(fixtureReturn.nativeElement.textContent).toContain('Klarna');

      history.replaceState({}, '', '/');
      fixtureReturn.destroy();
    });

    it('Klarna parent-owned redirect recovery maps retrieve failure to Error', async () => {
      history.replaceState({}, '', '/?ep_method=klarna&payment_intent_client_secret=bad');

      const recovery = TestBed.inject(StripeRedirectRecoveryService);
      spyOn(recovery, 'consumeReturn').and.rejectWith(
        new PaymentError({
          code: 'PAYMENT_FAILED',
          message: 'Stripe retrieve failed',
          method: 'klarna',
          provider: 'klarna',
        }),
      );

      const errors: PaymentError[] = [];
      const fixtureReturn = TestBed.createComponent(EasyPaymentsComponent);
      fixtureReturn.componentRef.setInput('product', { ...SAMPLE_PRODUCT });
      fixtureReturn.componentRef.setInput('methods', ['klarna']);
      fixtureReturn.componentInstance.error.subscribe((error) => errors.push(error));

      fixtureReturn.detectChanges();
      await fixtureReturn.whenStable();
      await Promise.resolve();
      await Promise.resolve();
      fixtureReturn.detectChanges();

      expect(errors.length).toBe(1);
      expect(fixtureReturn.componentInstance.viewState()).toBe('error');
      expect(fixtureReturn.nativeElement.textContent).toContain('Payment failed');

      history.replaceState({}, '', '/');
      fixtureReturn.destroy();
    });

    it('Affirm parent-owned redirect recovery transitions Processing to Success', async () => {
      history.replaceState(
        {},
        '',
        '/?payment_intent=pi_aff&payment_intent_client_secret=sec_aff&ep_method=affirm',
      );

      const recovery = TestBed.inject(StripeRedirectRecoveryService);
      spyOn(recovery, 'consumeReturn').and.resolveTo({
        status: 'success',
        method: 'affirm',
        provider: 'affirm',
        transactionId: 'pi_aff_txn',
      });

      const successes: PaymentResult[] = [];
      const fixtureReturn = TestBed.createComponent(EasyPaymentsComponent);
      fixtureReturn.componentRef.setInput('product', { ...SAMPLE_PRODUCT });
      fixtureReturn.componentRef.setInput('methods', ['affirm', 'card']);
      fixtureReturn.componentInstance.success.subscribe((result) => successes.push(result));

      expect(fixtureReturn.componentInstance.viewState()).toBe('processing');
      expect(fixtureReturn.componentInstance.selectedMethod()).toBe('affirm');

      fixtureReturn.detectChanges();
      await fixtureReturn.whenStable();
      await Promise.resolve();
      await Promise.resolve();
      fixtureReturn.detectChanges();

      expect(recovery.consumeReturn).toHaveBeenCalled();
      expect(successes.length).toBe(1);
      expect(successes[0].method).toBe('affirm');
      expect(fixtureReturn.componentInstance.viewState()).toBe('success');
      expect(fixtureReturn.nativeElement.textContent).toContain('Affirm');

      history.replaceState({}, '', '/');
      fixtureReturn.destroy();
    });

    it('Klarna return respects successBehavior=event-only', async () => {
      const successes: PaymentResult[] = [];
      fixture.componentInstance.success.subscribe((result) => successes.push(result));
      fixture.componentRef.setInput('methods', ['klarna']);
      fixture.componentRef.setInput('successBehavior', 'event-only');
      await render(fixture);

      fixture.componentInstance.onKlarnaReturning(true);
      fixture.componentInstance.onKlarnaSuccess({
        status: 'success',
        method: 'klarna',
        provider: 'klarna',
        transactionId: 'pi_event_only',
      });
      fixture.componentInstance.onKlarnaReturning(false);
      fixture.detectChanges();

      expect(successes.length).toBe(1);
      expect(fixture.componentInstance.viewState()).toBe('checkout');
      expect(fixture.nativeElement.textContent).not.toContain('Payment successful');
    });

    it('Klarna Continue after success resets to fresh checkout', async () => {
      const continues: PaymentResult[] = [];
      fixture.componentInstance.successContinue.subscribe((result) => continues.push(result));
      fixture.componentRef.setInput('methods', ['klarna']);
      await render(fixture);

      fixture.componentInstance.onKlarnaSuccess({
        status: 'success',
        method: 'klarna',
        provider: 'klarna',
        transactionId: 'pi_continue',
      });
      fixture.detectChanges();

      const continueBtn = fixture.nativeElement.querySelector(
        'button.ep-outcome__action',
      ) as HTMLButtonElement;
      continueBtn.click();
      fixture.detectChanges();

      expect(continues.length).toBe(1);
      expect(fixture.componentInstance.viewState()).toBe('checkout');
      expect(fixture.nativeElement.textContent).toContain('Complete your purchase');
    });

    it('Klarna cancelled/failed returns map to cancelled and error states', async () => {
      fixture.componentRef.setInput('methods', ['klarna']);
      await render(fixture);

      fixture.componentInstance.onKlarnaCancel({
        status: 'cancelled',
        method: 'klarna',
        provider: 'klarna',
      });
      fixture.detectChanges();
      expect(fixture.componentInstance.viewState()).toBe('cancelled');

      fixture.componentInstance.resetCheckoutView();
      fixture.componentInstance.onKlarnaError(
        new PaymentError({
          code: 'PAYMENT_FAILED',
          message: 'Klarna failed',
          method: 'klarna',
          provider: 'klarna',
        }),
      );
      fixture.detectChanges();
      expect(fixture.componentInstance.viewState()).toBe('error');
    });
  });
});
