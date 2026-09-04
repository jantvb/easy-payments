import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PaymentProduct } from '../../models';
import { formatMoney, formatUnitAmount } from '../../utils/format-money';

@Component({
  selector: 'easy-checkout-product-summary',
  standalone: true,
  template: `
    <div class="ep-summary">
      @if (product().imageUrl) {
        <img
          class="ep-summary__image"
          [src]="product().imageUrl"
          [alt]="product().name"
          width="56"
          height="56"
        />
      }
      <div class="ep-summary__body">
        <div class="ep-summary__row">
          <h3 class="ep-summary__name">{{ product().name }}</h3>
          <p class="ep-summary__amount">{{ totalLabel() }}</p>
        </div>
        <div class="ep-summary__row ep-summary__row--meta">
          <p class="ep-summary__description">
            @if (product().description) {
              {{ product().description }}
            } @else {
              Order total
            }
            @if (quantity() > 1) {
              <span> · Qty {{ quantity() }}</span>
            }
          </p>
          <p class="ep-summary__currency">{{ currency() }}</p>
        </div>
        @if (quantity() > 1) {
          <p class="ep-summary__unit">{{ unitLabel() }} each</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .ep-summary {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        padding: 14px;
        border: 1px solid var(--ep-border, #e2e8f0);
        border-radius: var(--ep-radius-md, 10px);
        background: var(--ep-surface-muted, #f8fafc);
      }

      .ep-summary__image {
        width: 56px;
        height: 56px;
        object-fit: cover;
        border-radius: 8px;
        background: var(--ep-surface, #fff);
        flex-shrink: 0;
      }

      .ep-summary__body {
        flex: 1;
        min-width: 0;
      }

      .ep-summary__row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: baseline;
      }

      .ep-summary__row--meta {
        margin-top: 4px;
      }

      .ep-summary__name {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 650;
        letter-spacing: -0.01em;
        color: var(--ep-text, #0f172a);
        overflow-wrap: anywhere;
        min-width: 0;
      }

      .ep-summary__amount {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--ep-text, #0f172a);
        white-space: nowrap;
        flex-shrink: 0;
      }

      .ep-summary__description,
      .ep-summary__currency,
      .ep-summary__unit {
        margin: 0;
        font-size: 13px;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-summary__description {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .ep-summary__currency {
        text-transform: uppercase;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .ep-summary__unit {
        margin-top: 4px;
      }

      @container ep-checkout (max-width: 380px) {
        .ep-summary__row {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .ep-summary__amount,
        .ep-summary__currency {
          white-space: normal;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutProductSummaryComponent {
  readonly product = input.required<PaymentProduct>();

  readonly quantity = computed(() => this.product().quantity ?? 1);
  readonly currency = computed(() => (this.product().currency || 'USD').toUpperCase());
  readonly totalLabel = computed(() =>
    formatMoney(this.product().amount, this.product().currency, this.quantity()),
  );
  readonly unitLabel = computed(() => formatUnitAmount(this.product().amount, this.product().currency));
}
