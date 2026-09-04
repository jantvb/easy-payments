import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideEasyPayments } from 'easy-payments';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideEasyPayments({ enableMockMode: true, providers: {} }),
      ],
    }).compileComponents();
  });

  it('should create the demo playground', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Easy Payments demo', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Checkout playground');
    expect(compiled.textContent).toContain('Demo Mode');
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

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

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
    app.setCheckoutMaxWidth(1100);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('easy-payments') as HTMLElement;
    expect(app.checkoutMaxWidth()).toBe(1100);
    expect(host.style.maxWidth).toBe('1100px');
  });

  it('locks product pricing to trusted catalog values in Real mode', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.productAmount.set('1');
    expect(app.product().amount).toBe(1);

    app.mode.set('real');
    app.trustedCatalogProduct.set({
      id: 'premium-plan',
      name: 'Premium Plan',
      description: 'One year subscription',
      unitAmount: 99.99,
      currency: 'USD',
    });

    expect(app.productFieldsLocked()).toBeTrue();
    expect(app.product().amount).toBe(99.99);
    expect(app.product().currency).toBe('USD');
    // Browser amount edits must not affect Real mode display/charge identity.
    app.productAmount.set('0.01');
    expect(app.product().amount).toBe(99.99);
  });
});
