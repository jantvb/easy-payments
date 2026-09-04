import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PaymentMethodButtonComponent } from './payment-method-button.component';

@Component({
  selector: 'easy-paypal-button',
  standalone: true,
  imports: [PaymentMethodButtonComponent],
  template: `
    <easy-payment-method-button
      method="paypal"
      [isMock]="isMock()"
      [disabled]="disabled()"
      [loading]="loading()"
      customLabel="PayPal"
      (clicked)="pay.emit()"
    >
      PayPal
    </easy-payment-method-button>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      easy-payment-method-button ::ng-deep .ep-button {
        background: #ffc439;
        color: #003087;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayPalButtonComponent {
  readonly isMock = input(false);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly pay = output<void>();
}
