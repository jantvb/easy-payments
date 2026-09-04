import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PaymentMethodButtonComponent } from './payment-method-button.component';

@Component({
  selector: 'easy-google-pay-button',
  standalone: true,
  imports: [PaymentMethodButtonComponent],
  template: `
    <easy-payment-method-button
      method="google-pay"
      [isMock]="isMock()"
      [disabled]="disabled()"
      [loading]="loading()"
      customLabel="Google Pay"
      (clicked)="pay.emit()"
    >
      <span style="font-family: 'Google Sans', Roboto, sans-serif; font-weight: 500;">G Pay</span>
    </easy-payment-method-button>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      easy-payment-method-button ::ng-deep .ep-button {
        background: #000;
        color: #fff;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GooglePayButtonComponent {
  readonly isMock = input(false);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly pay = output<void>();
}
