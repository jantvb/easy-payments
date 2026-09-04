import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PaymentMethodButtonComponent } from './payment-method-button.component';

@Component({
  selector: 'easy-card-payment',
  standalone: true,
  imports: [PaymentMethodButtonComponent],
  template: `
    <easy-payment-method-button
      method="card"
      [isMock]="isMock()"
      [disabled]="disabled()"
      [loading]="loading()"
      customLabel="Card"
      (clicked)="pay.emit()"
    >
      Card
    </easy-payment-method-button>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      easy-payment-method-button ::ng-deep .ep-button {
        background: var(--ep-card-bg, #1e293b);
        color: var(--ep-card-text, #f8fafc);
        border: 1px solid var(--ep-card-border, #334155);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardPaymentComponent {
  readonly isMock = input(false);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly pay = output<void>();
}
