import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { PaymentError } from '../../errors/payment-error';
import { PaymentMethod, PAYMENT_METHOD_LABELS, PaymentProduct, PaymentResult } from '../../models';
import { formatMoney } from '../../utils/format-money';
import { CHECKOUT_COPY } from './checkout-copy';
import { CheckoutViewState, formatTransactionReference } from './checkout-view-state';

@Component({
  selector: 'easy-checkout-outcome',
  standalone: true,
  template: `
    <div
      class="ep-outcome"
      [attr.data-state]="state()"
      [attr.aria-live]="state() === 'processing' ? 'assertive' : 'polite'"
      role="status"
    >
      <div class="ep-outcome__icon" aria-hidden="true">
        @switch (state()) {
          @case ('processing') {
            <span class="ep-outcome__spinner"></span>
          }
          @case ('success') {
            <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2" />
              <path
                d="M14 24.5 20.5 31 34 17"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          }
          @case ('error') {
            <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2" />
              <path
                d="M24 14v14M24 34h.01"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
          }
          @case ('cancelled') {
            <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2" />
              <path
                d="M16 24h16"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
          }
        }
      </div>

      <h2 #heading class="ep-outcome__title" tabindex="-1">{{ title() }}</h2>
      <p class="ep-outcome__body">{{ body() }}</p>

      @if (state() === 'success' && product(); as item) {
        <p class="ep-outcome__product">{{ item.name }}</p>
        <dl class="ep-outcome__details">
          <div class="ep-outcome__row">
            <dt>{{ copy.successTotal }}</dt>
            <dd>{{ totalLabel() }}</dd>
          </div>
          @if (methodLabel()) {
            <div class="ep-outcome__row">
              <dt>{{ copy.successPaidWith }}</dt>
              <dd>{{ methodLabel() }}</dd>
            </div>
          }
          @if (transactionRef()) {
            <div class="ep-outcome__row">
              <dt>{{ copy.successTransaction }}</dt>
              <dd class="ep-outcome__mono">{{ transactionRef() }}</dd>
            </div>
          }
        </dl>
      }

      @if (state() === 'error' && safeErrorMessage()) {
        <p class="ep-outcome__detail-message">{{ safeErrorMessage() }}</p>
      }

      @if (state() !== 'processing') {
        <button type="button" class="ep-outcome__action" (click)="onAction()">
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .ep-outcome {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;
        padding: 12px 4px 4px;
        animation: ep-outcome-in 180ms ease-out;
      }

      .ep-outcome__icon {
        display: inline-flex;
        color: var(--ep-text-secondary, #64748b);
        margin-bottom: 4px;
      }

      .ep-outcome[data-state='success'] .ep-outcome__icon {
        color: var(--ep-success, #15803d);
      }

      .ep-outcome[data-state='error'] .ep-outcome__icon {
        color: var(--ep-danger, #b91c1c);
      }

      .ep-outcome[data-state='cancelled'] .ep-outcome__icon {
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-outcome[data-state='processing'] .ep-outcome__icon {
        color: var(--ep-accent, #2563eb);
      }

      .ep-outcome__spinner {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 3px solid var(--ep-border, #e2e8f0);
        border-top-color: var(--ep-accent, #2563eb);
        animation: ep-spin 0.8s linear infinite;
      }

      .ep-outcome__title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--ep-text, #0f172a);
      }

      .ep-outcome__title:focus {
        outline: none;
      }

      .ep-outcome__title:focus-visible {
        outline: 2px solid var(--ep-focus, #2563eb);
        outline-offset: 2px;
      }

      .ep-outcome__body {
        margin: 0;
        max-width: 28rem;
        font-size: 14px;
        line-height: 1.45;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-outcome__product {
        margin: 4px 0 0;
        font-size: 15px;
        font-weight: 650;
        color: var(--ep-text, #0f172a);
      }

      .ep-outcome__details {
        width: 100%;
        margin: 8px 0 0;
        padding: 12px 14px;
        border: 1px solid var(--ep-border, #e2e8f0);
        border-radius: var(--ep-radius-md, 10px);
        background: var(--ep-surface-muted, #f8fafc);
        text-align: left;
      }

      .ep-outcome__row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 0;
      }

      .ep-outcome__row + .ep-outcome__row {
        border-top: 1px solid var(--ep-border, #e2e8f0);
      }

      .ep-outcome__row dt {
        margin: 0;
        font-size: 13px;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-outcome__row dd {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--ep-text, #0f172a);
        text-align: right;
        overflow-wrap: anywhere;
      }

      .ep-outcome__mono {
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
      }

      .ep-outcome__detail-message {
        margin: 0;
        max-width: 28rem;
        font-size: 13px;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-outcome__action {
        margin-top: 8px;
        min-height: 48px;
        min-width: 160px;
        padding: 0 20px;
        border: 0;
        border-radius: var(--ep-radius-md, 10px);
        background: var(--ep-cta-bg, #0f172a);
        color: var(--ep-cta-text, #f8fafc);
        font: inherit;
        font-size: 15px;
        font-weight: 650;
        cursor: pointer;
      }

      .ep-outcome__action:hover {
        background: var(--ep-cta-bg-hover, #1e293b);
      }

      .ep-outcome__action:focus-visible {
        outline: 2px solid var(--ep-focus, #2563eb);
        outline-offset: 2px;
      }

      @keyframes ep-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes ep-outcome-in {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .ep-outcome,
        .ep-outcome__spinner {
          animation: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutOutcomeComponent {
  readonly copy = CHECKOUT_COPY;

  readonly state = input.required<Exclude<CheckoutViewState, 'checkout'>>();
  readonly product = input<PaymentProduct | null>(null);
  readonly result = input<PaymentResult | null>(null);
  readonly paymentError = input<PaymentError | null>(null);

  readonly action = output<void>();

  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');

  constructor() {
    effect(() => {
      // Re-focus the heading whenever the outcome state changes.
      void this.state();
      queueMicrotask(() => this.heading()?.nativeElement.focus());
    });
  }

  readonly title = computed(() => {
    switch (this.state()) {
      case 'processing':
        return CHECKOUT_COPY.processingTitle;
      case 'success':
        return CHECKOUT_COPY.successTitle;
      case 'error':
        return CHECKOUT_COPY.errorTitle;
      case 'cancelled':
        return CHECKOUT_COPY.cancelledTitle;
    }
  });

  readonly body = computed(() => {
    switch (this.state()) {
      case 'processing':
        return CHECKOUT_COPY.processingHint;
      case 'success':
        return CHECKOUT_COPY.successBody;
      case 'error':
        return CHECKOUT_COPY.errorBody;
      case 'cancelled':
        return CHECKOUT_COPY.cancelledBody;
    }
  });

  readonly actionLabel = computed(() => {
    switch (this.state()) {
      case 'success':
        return CHECKOUT_COPY.successContinue;
      case 'error':
        return CHECKOUT_COPY.errorTryAgain;
      case 'cancelled':
        return CHECKOUT_COPY.cancelledReturn;
      default:
        return '';
    }
  });

  readonly methodLabel = computed(() => {
    const method = this.result()?.method as PaymentMethod | undefined;
    return method ? PAYMENT_METHOD_LABELS[method] : null;
  });

  readonly transactionRef = computed(() =>
    formatTransactionReference(this.result()?.transactionId),
  );

  readonly totalLabel = computed(() => {
    const item = this.product();
    if (!item) {
      return '';
    }
    return `${formatMoney(item.amount, item.currency, item.quantity ?? 1)} ${item.currency
      .trim()
      .toUpperCase()}`;
  });

  readonly safeErrorMessage = computed(() => {
    const message = this.paymentError()?.message?.trim();
    if (!message) {
      return null;
    }
    // Avoid dumping raw JSON-looking / overly technical payloads into customer UI.
    if (message.startsWith('{') || message.startsWith('[') || message.length > 180) {
      return null;
    }
    if (message === CHECKOUT_COPY.errorBody) {
      return null;
    }
    return message;
  });

  onAction(): void {
    this.action.emit();
  }
}
