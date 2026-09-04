import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { PaymentMethod, PAYMENT_METHOD_LABELS } from '../../models';

@Component({
  selector: 'easy-payment-method-button',
  standalone: true,
  template: `
    <button
      type="button"
      class="ep-button"
      [class.ep-button--mock]="isMock()"
      [disabled]="disabled() || loading()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-busy]="loading()"
      (click)="clicked.emit()"
    >
      @if (isMock()) {
        <span class="ep-mock-badge" aria-hidden="true">Demo</span>
      }
      @if (loading()) {
        <span class="ep-loading" aria-hidden="true"></span>
        <span class="visually-hidden">Processing payment</span>
      } @else {
        <ng-content />
      }
    </button>
  `,
  styleUrl: './_payment-button.shared.scss',
  styles: [
    `
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodButtonComponent {
  readonly method = input.required<PaymentMethod>();
  readonly isMock = input(false);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly customLabel = input<string>();

  readonly clicked = output<void>();

  ariaLabel(): string {
    const methodLabel = this.customLabel() ?? PAYMENT_METHOD_LABELS[this.method()];
    return this.isMock() ? `${methodLabel} (Demo mode)` : `Pay with ${methodLabel}`;
  }
}
