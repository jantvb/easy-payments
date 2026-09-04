import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideEasyPayments } from '../../config/provide-easy-payments';
import { PaymentProduct, ResolvedPaymentTheme } from '../../models';
import { PayPalAdapter } from '../../adapters/paypal/paypal.adapter';
import { PayPalPaymentComponent } from './paypal-payment.component';

@Component({
  standalone: true,
  imports: [PayPalPaymentComponent],
  template: `
    <easy-paypal-payment
      [product]="product()"
      [resolvedTheme]="theme()"
      (success)="successes.push($event)"
      (cancel)="cancels.push($event)"
      (error)="errors.push($event)"
    />
  `,
})
class HostComponent {
  readonly product = signal<PaymentProduct>({
    id: 'premium-plan',
    name: 'Premium Plan',
    amount: 99.99,
    currency: 'USD',
    quantity: 1,
  });
  readonly theme = signal<ResolvedPaymentTheme>('light');
  successes: unknown[] = [];
  cancels: unknown[] = [];
  errors: unknown[] = [];
}

describe('PayPalPaymentComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let adapter: jasmine.SpyObj<PayPalAdapter>;

  beforeEach(async () => {
    adapter = jasmine.createSpyObj<PayPalAdapter>('PayPalAdapter', [
      'ensureSdkLoaded',
      'renderButtons',
      'destroy',
      'createOrder',
      'captureOrder',
      'isBusy',
      'getActiveOrderId',
    ]);
    adapter.ensureSdkLoaded.and.resolveTo({} as never);
    adapter.renderButtons.and.resolveTo();
    adapter.destroy.and.resolveTo();
    adapter.isBusy.and.returnValue(false);
    adapter.getActiveOrderId.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideEasyPayments({
          enableMockMode: false,
          providers: { paypal: { clientId: 'sb' } },
          backend: {
            paypalCreateOrderUrl: '/paypal/create',
            paypalCaptureOrderUrl: '/paypal/capture',
          },
        }),
        { provide: PayPalAdapter, useValue: adapter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders PayPal Buttons once on mount', async () => {
    expect(adapter.ensureSdkLoaded).toHaveBeenCalledTimes(1);
    expect(adapter.renderButtons).toHaveBeenCalledTimes(1);
  });

  it('does not recreate buttons on theme change', async () => {
    adapter.renderButtons.calls.reset();
    adapter.ensureSdkLoaded.calls.reset();

    host.theme.set('dark');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(adapter.renderButtons).not.toHaveBeenCalled();
    expect(adapter.ensureSdkLoaded).not.toHaveBeenCalled();
  });

  it('re-renders when product identity changes', async () => {
    adapter.renderButtons.calls.reset();

    host.product.set({
      id: 'premium-plan',
      name: 'Premium Plan',
      amount: 99.99,
      currency: 'USD',
      quantity: 2,
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(adapter.renderButtons).toHaveBeenCalledTimes(1);
  });

  it('cleans up on destroy', () => {
    fixture.destroy();
    expect(adapter.destroy).toHaveBeenCalled();
  });

  it('wires createOrder / onApprove / onCancel callbacks', async () => {
    const options = adapter.renderButtons.calls.mostRecent().args[1];
    expect(options.createOrder).toBeTruthy();
    expect(options.onApprove).toBeTruthy();
    expect(options.onCancel).toBeTruthy();

    adapter.createOrder.and.resolveTo('ORDER-1');
    await options.createOrder();
    expect(adapter.createOrder).toHaveBeenCalled();

    adapter.captureOrder.and.resolveTo({
      status: 'success',
      method: 'paypal',
      provider: 'paypal',
      transactionId: 'CAPTURE-1',
      sessionId: 'ORDER-1',
    });
    await options.onApprove({ orderID: 'ORDER-1' });
    expect(host.successes.length).toBe(1);

    options.onCancel?.();
    fixture.detectChanges();
    expect(host.cancels.length).toBe(1);
  });

  it('exposes the buttons host for official PayPal UI', () => {
    const component = fixture.debugElement.query(By.directive(PayPalPaymentComponent));
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="PayPal official checkout"]')).toBeTruthy();
  });

  it('does not mention Stripe in the PayPal security helper text', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Secure checkout powered by PayPal');
    expect(text.toLowerCase()).not.toContain('stripe');
  });
});
