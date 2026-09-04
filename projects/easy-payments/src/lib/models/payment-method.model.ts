export type PaymentMethod =
  | 'apple-pay'
  | 'google-pay'
  | 'samsung-pay'
  | 'paypal'
  | 'klarna'
  | 'affirm'
  | 'card';

export type PaymentProviderName =
  | 'stripe'
  | 'paypal'
  | 'applePay'
  | 'googlePay'
  | 'samsungPay'
  | 'klarna'
  | 'affirm';

export const PAYMENT_METHOD_PROVIDER_MAP: Record<PaymentMethod, PaymentProviderName> = {
  'apple-pay': 'applePay',
  'google-pay': 'googlePay',
  'samsung-pay': 'samsungPay',
  paypal: 'paypal',
  klarna: 'klarna',
  affirm: 'affirm',
  card: 'stripe',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  'apple-pay': 'Apple Pay',
  'google-pay': 'Google Pay',
  'samsung-pay': 'Samsung Pay',
  paypal: 'PayPal',
  klarna: 'Klarna',
  affirm: 'Affirm',
  card: 'Card',
};
