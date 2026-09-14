import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { PaymentMethod, PAYMENT_METHOD_LABELS } from '../../models';
import { EasyPaymentsI18nService, EN_TRANSLATIONS, interpolate } from '../../i18n';

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
        <span class="ep-mock-badge" aria-hidden="true">{{ msgs().demoBadge }}</span>
      }
      @if (loading()) {
        <span class="ep-loading" aria-hidden="true"></span>
        <span class="visually-hidden">{{ msgs().processingPayment }}</span>
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
  private readonly i18n = inject(EasyPaymentsI18nService, { optional: true });

  readonly method = input.required<PaymentMethod>();
  readonly isMock = input(false);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly customLabel = input<string>();

  readonly clicked = output<void>();

  readonly msgs = computed(() => this.i18n?.messages() ?? EN_TRANSLATIONS);

  ariaLabel(): string {
    const methodLabel =
      this.customLabel() ??
      (this.method() === 'card' ? this.msgs().methodCard : PAYMENT_METHOD_LABELS[this.method()]);
    if (this.isMock()) {
      return `${methodLabel} (${this.msgs().demoModeAria})`;
    }
    return interpolate(this.msgs().payWithMethod, { method: methodLabel });
  }
}
