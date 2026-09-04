/*
 * Public API Surface of easy-payments
 */

export { EasyPaymentsComponent } from './lib/components/payments/easy-payments.component';

export { provideEasyPayments } from './lib/config/provide-easy-payments';
export { EasyPaymentsConfigService } from './lib/config/easy-payments-config.service';
export type {
  AffirmProviderConfig,
  ApplePayProviderConfig,
  EasyPaymentsBackendConfig,
  EasyPaymentsConfig,
  EasyPaymentsProviderConfig,
  GooglePayProviderConfig,
  KlarnaProviderConfig,
  PayPalProviderConfig,
  ProviderConfigStatus,
  ProviderValidationResult,
  StripeProviderConfig,
} from './lib/config/easy-payments.config';

export type { PaymentProduct } from './lib/models/payment-product.model';
export type { PaymentMethod, PaymentProviderName } from './lib/models/payment-method.model';
export { PAYMENT_METHOD_LABELS } from './lib/models/payment-method.model';
export type { PaymentTheme, ResolvedPaymentTheme } from './lib/models/payment-theme.model';
export type { PaymentResult, PaymentStatus } from './lib/models/payment-result.model';
export { normalizePaymentResult } from './lib/models/payment-result.model';
export type { CheckoutOptions, CheckoutSuccessBehavior } from './lib/models/checkout-options.model';
export type { CheckoutViewState } from './lib/components/checkout/checkout-view-state';
export { formatTransactionReference } from './lib/components/checkout/checkout-view-state';
export {
  DEFAULT_CHECKOUT_MAX_WIDTH,
  MAX_CHECKOUT_WIDTH,
  MIN_CHECKOUT_WIDTH,
  resolveCheckoutMaxWidth,
} from './lib/layout/checkout-layout';
export type {
  CapturePayPalOrderResponse,
  CreateKlarnaPaymentResponse,
  CreatePaymentRequest,
  CreatePaymentResponse,
  CreatePayPalOrderResponse,
  CreateStripePaymentResponse,
  KlarnaCreatePaymentRequest,
  PayPalCreateOrderRequest,
} from './lib/models/create-payment.model';
export {
  toKlarnaCreatePaymentRequest,
  toPayPalCreateOrderRequest,
} from './lib/models/create-payment.model';

export { PaymentError, normalizeError } from './lib/errors/payment-error';
export type { PaymentErrorCode } from './lib/errors/payment-error';

export { MockPaymentController } from './lib/adapters/mock/mock-payment.controller';
export type { MockPaymentOutcome } from './lib/adapters/mock/mock-payment.controller';

export {
  isKlarnaReturnAttempt,
  isKlarnaStripeReturn,
} from './lib/adapters/klarna/klarna-return';

export { EasyPaymentsConfigValidator } from './lib/validators/config.validator';
export { validatePaymentProduct } from './lib/validators/product.validator';
export type { ProductValidationResult } from './lib/validators/product.validator';

export { PaymentOrchestratorService } from './lib/services/payment-orchestrator.service';
export type { AvailablePaymentMethod } from './lib/services/payment-orchestrator.service';
