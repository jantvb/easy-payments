import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideEasyPayments } from '../../config/provide-easy-payments';
import { PaymentProduct, ResolvedPaymentTheme } from '../../models';
import { GooglePayAdapter } from '../../adapters/google-pay/google-pay.adapter';
import { GooglePayPaymentComponent } from './google-pay-payment.component';

@Component({
  standalone: true,
  imports: [GooglePayPaymentComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <easy-google-pay-payment
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

describe('GooglePayPaymentComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let adapter: jasmine.SpyObj<GooglePayAdapter>;

  beforeEach(async () => {
    adapter = jasmine.createSpyObj<GooglePayAdapter>('GooglePayAdapter', [
      'isAvailable',
      'renderOfficialButton',
      'payWithGooglePay',
      'destroy',
      'clearButtonHost',
      'isProcessing',
    ]);
    adapter.isAvailable.and.resolveTo(true);
    adapter.renderOfficialButton.and.resolveTo();
    adapter.destroy.and.resolveTo();
    adapter.isProcessing.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideEasyPayments({
          enableMockMode: false,
          providers: {
            stripe: { publishableKey: 'pk_test_123' },
            googlePay: { environment: 'TEST', merchantName: 'Demo' },
          },
          backend: { createPaymentUrl: '/api/payments/create' },
        }),
        { provide: GooglePayAdapter, useValue: adapter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the official button once on mount', async () => {
    expect(adapter.isAvailable).toHaveBeenCalled();
    expect(adapter.renderOfficialButton).toHaveBeenCalledTimes(1);
  });

  it('does not start payments when theme changes (only restyles button)', async () => {
    adapter.renderOfficialButton.calls.reset();
    adapter.isAvailable.calls.reset();

    host.theme.set('dark');
    fixture.detectChanges();
    await fixture.whenStable();

    // Theme change may rebuild the official button style, but never payWithGooglePay.
    expect(adapter.payWithGooglePay).not.toHaveBeenCalled();
  });

  it('uses Google Pay security copy without claiming Stripe branding', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Secure checkout with Google Pay');
    expect(text).toContain('Pay with Google Pay');
  });

  it('cleans up on destroy', () => {
    fixture.destroy();
    expect(adapter.destroy).toHaveBeenCalled();
  });

  it('wires the official button click into the payment flow', async () => {
    const options = adapter.renderOfficialButton.calls.mostRecent().args[1];
    adapter.payWithGooglePay.and.resolveTo({
      status: 'success',
      method: 'google-pay',
      provider: 'googlePay',
      transactionId: 'pi_1',
    });

    await options.onClick();
    expect(adapter.payWithGooglePay).toHaveBeenCalled();
    expect(host.successes.length).toBe(1);
  });
});
