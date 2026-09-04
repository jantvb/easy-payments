import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  PaymentMethod,
  PAYMENT_METHOD_LABELS,
  PaymentProduct,
  ResolvedPaymentTheme,
} from '../../models';
import { formatMoney } from '../../utils/format-money';
import { PaymentMethodIconComponent } from './payment-method-icon.component';

/**
 * Detail panel for mock / non-Stripe payment methods after selection.
 */
@Component({
  selector: 'easy-mock-method-panel',
  standalone: true,
  imports: [PaymentMethodIconComponent],
  template: `
    <div class="ep-mock-panel">
      <div class="ep-mock-panel__header">
        <easy-payment-method-icon [method]="method()" [theme]="theme()" />
        <div>
          <h3 class="ep-mock-panel__title">Pay with {{ label() }}</h3>
          @if (isMock()) {
            <p class="ep-mock-panel__hint">Demo checkout — no real payment is processed.</p>
          } @else {
            <p class="ep-mock-panel__hint">Continue to complete your payment.</p>
          }
        </div>
      </div>

      <button
        type="button"
        class="ep-mock-panel__cta"
        [disabled]="loading()"
        [attr.aria-busy]="loading()"
        [attr.aria-label]="ctaAriaLabel()"
        (click)="pay.emit()"
      >
        @if (loading()) {
          <span class="ep-mock-panel__spinner" aria-hidden="true"></span>
          Processing payment…
        } @else {
          Pay {{ amountLabel() }}
        }
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .ep-mock-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .ep-mock-panel__header {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .ep-mock-panel__title {
        margin: 0;
        font-size: 1rem;
        font-weight: 650;
        color: var(--ep-text, #0f172a);
      }

      .ep-mock-panel__hint {
        margin: 4px 0 0;
        font-size: 13px;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-mock-panel__cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 48px;
        width: 100%;
        border: 0;
        border-radius: var(--ep-radius-md, 10px);
        background: var(--ep-cta-bg, #0f172a);
        color: var(--ep-cta-text, #f8fafc);
        font: inherit;
        font-size: 15px;
        font-weight: 650;
        cursor: pointer;
      }

      .ep-mock-panel__cta:hover:not(:disabled) {
        background: var(--ep-cta-bg-hover, #1e293b);
      }

      .ep-mock-panel__cta:focus-visible {
        outline: 2px solid var(--ep-focus, #2563eb);
        outline-offset: 2px;
      }

      .ep-mock-panel__cta:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .ep-mock-panel__spinner {
        width: 16px;
        height: 16px;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: ep-spin 0.6s linear infinite;
      }

      @keyframes ep-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .ep-mock-panel__spinner {
          animation: none;
          border-right-color: currentColor;
          opacity: 0.7;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockMethodPanelComponent {
  readonly method = input.required<PaymentMethod>();
  readonly product = input.required<PaymentProduct>();
  readonly theme = input<ResolvedPaymentTheme>('light');
  readonly isMock = input(false);
  readonly loading = input(false);

  readonly pay = output<void>();

  readonly label = computed(() => PAYMENT_METHOD_LABELS[this.method()]);
  readonly amountLabel = computed(() =>
    formatMoney(this.product().amount, this.product().currency, this.product().quantity ?? 1),
  );

  ctaAriaLabel(): string {
    return `Pay ${this.amountLabel()} with ${this.label()}`;
  }
}
