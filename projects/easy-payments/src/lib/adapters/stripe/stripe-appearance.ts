import type { Appearance, StripeElementLocale, StripePaymentElementOptions } from '@stripe/stripe-js';
import { ResolvedPaymentTheme } from '../../models';

export type StripeAppearanceTheme = NonNullable<Appearance['theme']>;

export function mapResolvedThemeToStripeAppearance(
  theme: ResolvedPaymentTheme,
): Appearance {
  return {
    theme: theme === 'dark' ? 'night' : 'stripe',
    variables: {
      borderRadius: '8px',
    },
  };
}

export function stripeAppearanceThemeName(
  theme: ResolvedPaymentTheme,
): StripeAppearanceTheme {
  return theme === 'dark' ? 'night' : 'stripe';
}

/**
 * Payment Element options for Easy Payments `card`.
 * Method availability is primarily controlled by the PaymentIntent
 * (`payment_method_types: ['card']`). These options keep wallets off.
 */
export const STRIPE_PAYMENT_ELEMENT_OPTIONS: StripePaymentElementOptions = {
  layout: {
    type: 'tabs',
  },
  wallets: {
    applePay: 'never',
    googlePay: 'never',
  },
};

export const DEFAULT_STRIPE_LOCALE: StripeElementLocale = 'auto';

/**
 * Stable session identity for Stripe PaymentIntent reuse.
 * Theme is intentionally excluded — appearance updates must not recreate intents.
 */
export function buildStripeSessionKey(
  product: {
    id: string;
    amount: number;
    currency: string;
    quantity?: number;
  },
  checkout?: { customer?: { email?: string; name?: string } } | null,
): string {
  const quantity = product.quantity ?? 1;
  const email = checkout?.customer?.email ?? '';
  const name = checkout?.customer?.name ?? '';
  return [
    product.id,
    quantity,
    product.currency,
    product.amount,
    email,
    name,
  ].join('|');
}
