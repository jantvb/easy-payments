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
  merchantId: string;
  merchantName?: string;
  environment?: 'TEST' | 'PRODUCTION';
  gateway?: string;
  gatewayMerchantId?: string;
}

export interface SamsungPayProviderConfig {
  merchantId: string;
  serviceId?: string;
  countryCode?: string;
}

export interface KlarnaProviderConfig {
  clientId: string;
  environment?: 'playground' | 'production';
}

export interface AffirmProviderConfig {
  publicKey: string;
  scriptUrl?: string;
}

export interface EasyPaymentsBackendConfig {
  /** Merchant endpoint that creates a Stripe PaymentIntent and returns clientSecret. */
  createPaymentUrl?: string;
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
  samsungPay?: SamsungPayProviderConfig;
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
  samsungPay: 'Samsung Pay',
  klarna: 'Klarna',
  affirm: 'Affirm',
};

export const PROVIDER_REQUIRED_FIELD_LABEL: Record<keyof EasyPaymentsProviderConfig, string> = {
  stripe: 'publishableKey missing',
  paypal: 'clientId missing',
  applePay: 'merchantId missing',
  googlePay: 'merchantId missing',
  samsungPay: 'merchantId missing',
  klarna: 'clientId missing',
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
