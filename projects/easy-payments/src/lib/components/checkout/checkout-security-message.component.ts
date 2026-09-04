import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'easy-checkout-security-message',
  standalone: true,
  template: `
    <p class="ep-security" role="note">
      <span class="ep-security__icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <path
            d="M8 1.5 3 3.5v4.2c0 3 2 5.2 5 6.3 3-1.1 5-3.3 5-6.3V3.5L8 1.5Z"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
          <path
            d="M6 8.1 7.3 9.4 10.2 6.4"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span>{{ message() }}</span>
    </p>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .ep-security {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 12px;
        line-height: 1.4;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-security__icon {
        display: inline-flex;
        color: var(--ep-accent, #2563eb);
        flex-shrink: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutSecurityMessageComponent {
  /**
   * Provider-aware security copy. Defaults to a neutral message (never Stripe-specific).
   */
  readonly message = input('Secure checkout — your payment details stay with the payment provider.');
}
