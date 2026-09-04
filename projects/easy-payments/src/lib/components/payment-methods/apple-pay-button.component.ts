import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PaymentMethodButtonComponent } from './payment-method-button.component';

@Component({
  selector: 'easy-apple-pay-button',
  standalone: true,
  imports: [PaymentMethodButtonComponent],
  template: `
    <easy-payment-method-button
      method="apple-pay"
      [isMock]="isMock()"
      [disabled]="disabled()"
      [loading]="loading()"
      customLabel="Apple Pay"
      (clicked)="pay.emit()"
    >
      <svg aria-hidden="true" width="52" height="22" viewBox="0 0 52 22" fill="currentColor">
        <path d="M10.2 4.5c-.6.7-1.5 1.3-2.5 1.2-.1-1 .4-2 1-2.6.6-.7 1.7-1.2 2.5-1.3.1 1.1-.3 2.1-.9 2.7zm.9 1.4c-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.1 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.1 0 1.9-1 2.6-2.1.8-1.2 1.1-2.4 1.1-2.5-.1 0-2.2-.8-2.2-3.2 0-2 1.6-3 1.7-3.1-1-.7-2.3-1.1-2.8-1.1z"/>
        <path d="M22.5 6.5h2.7c1.6 0 2.7.9 2.7 2.3 0 1.6-1.2 2.5-3.2 2.5h-1.5v2.9h-1.7V6.5zm1.7 1.5v2.4h1.1c1.1 0 1.7-.5 1.7-1.2 0-.7-.6-1.2-1.7-1.2h-1.1zM30 6.5h3.1c2.1 0 3.4 1.1 3.4 3.1 0 2-1.3 3.2-3.4 3.2H30V6.5zm1.7 1.5v3.3h1.3c1.2 0 1.8-.6 1.8-1.7 0-1-.6-1.6-1.8-1.6H31.7z"/>
      </svg>
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
export class ApplePayButtonComponent {
  readonly isMock = input(false);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly pay = output<void>();
}
