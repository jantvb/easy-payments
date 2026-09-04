import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PaymentMethodButtonComponent } from './payment-method-button.component';

@Component({
  selector: 'easy-samsung-pay-button',
  standalone: true,
  imports: [PaymentMethodButtonComponent],
  template: `
    <easy-payment-method-button
      method="samsung-pay"
      [isMock]="isMock()"
      [disabled]="disabled()"
      [loading]="loading()"
      customLabel="Samsung Pay"
      (clicked)="pay.emit()"
    >
      Samsung Pay
    </easy-payment-method-button>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      easy-payment-method-button ::ng-deep .ep-button {
        background: #1428a0;
        color: #fff;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SamsungPayButtonComponent {
  readonly isMock = input(false);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly pay = output<void>();
}
