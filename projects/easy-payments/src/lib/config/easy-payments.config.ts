export interface StripeProviderConfig {
  /**
   * Stripe publishable key only (pk_test_... / pk_live_...).
   * Never put a secret key (sk_...) here.
   */
  publishableKey: string;
}

export interface PayPalProviderConfig {
  clientId: string;
  currency?: string;
  intent?: 'capture' | 'authorize';
}

export interface ApplePayProviderConfig {
  merchantId: string;
  merchantName?: string;
  countryCode?: string;
}

export interface GooglePayProviderConfig {
  /**
   * Google Pay merchant ID from Google Pay & Wallet Console.
   * Optional in TEST (Easy Payments defaults to Google's documented TEST merchantId).
   * Required for PRODUCTION.
   */
  merchantId?: string;
  /** User-visible merchant name shown in the Google Pay sheet. */
  merchantName?: string;
  /** Defaults to TEST. Do not use PRODUCTION until merchant approval is complete. */
  environment?: 'TEST' | 'PRODUCTION';
  /** ISO 3166-1 alpha-2 country for transactionInfo (default US). */
  countryCode?: string;
}

export interface KlarnaProviderConfig {
  /** ISO country for Klarna purchase context (default US). */
  purchaseCountry?: string;
  /** Locale hint for Klarna/Stripe (default en-US). */
  locale?: string;
}

export interface AffirmProviderConfig {
  publicKey: string;
  scriptUrl?: string;
}

export interface EasyPaymentsBackendConfig {
  /** Merchant endpoint that creates a Stripe PaymentIntent and returns clientSecret. */
  createPaymentUrl?: string;
  /**
   * PayPal Orders API: create order (returns { provider: 'paypal', orderId }).
   * Required for real PayPal checkout.
   */
  paypalCreateOrderUrl?: string;
  /**
   * PayPal Orders API: capture approved order
   * (returns { provider: 'paypal', orderId, captureId, status? }).
   * Required for real PayPal checkout.
   */
  paypalCaptureOrderUrl?: string;
  /** Creates a Klarna-only Stripe PaymentIntent. Returns clientSecret. */
  klarnaCreatePaymentUrl?: string;
  /**
   * Optional. Not required for the standard Stripe Payment Element + PaymentIntent flow.
   * Reserved for future provider flows that need an explicit server confirm step.
   */
  confirmPaymentUrl?: string;
}

export interface EasyPaymentsProviderConfig {
  stripe?: StripeProviderConfig;
  paypal?: PayPalProviderConfig;
  applePay?: ApplePayProviderConfig;
  googlePay?: GooglePayProviderConfig;
  klarna?: KlarnaProviderConfig;
  affirm?: AffirmProviderConfig;
}

export interface EasyPaymentsConfig {
  providers: EasyPaymentsProviderConfig;
  backend?: EasyPaymentsBackendConfig;
  /**
   * When true, every provider uses a mock adapter.
   * Mock mode never processes a real payment and must not be used in production.
   */
  enableMockMode?: boolean;
}

export const PROVIDER_DISPLAY_NAMES: Record<keyof EasyPaymentsProviderConfig, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  applePay: 'Apple Pay',
  googlePay: 'Google Pay',
  klarna: 'Klarna',
  affirm: 'Affirm',
};

export const PROVIDER_REQUIRED_FIELD_LABEL: Record<keyof EasyPaymentsProviderConfig, string> = {
  stripe: 'publishableKey missing',
  paypal: 'clientId missing',
  applePay: 'merchantId missing',
  googlePay: 'configuration missing (requires Stripe publishableKey for gateway)',
  klarna: 'configuration missing (requires Stripe publishableKey + klarnaCreatePaymentUrl)',
  affirm: 'publicKey missing',
};

export type ProviderConfigStatus =
  | 'configured'
  | 'missing'
  | 'invalid'
  | 'not_requested';

export interface ProviderValidationResult {
  provider: keyof EasyPaymentsProviderConfig;
  status: ProviderConfigStatus;
  message?: string;
}
