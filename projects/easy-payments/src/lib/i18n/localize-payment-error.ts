import type { PaymentErrorCode } from '../errors/payment-error';
import type { EasyPaymentsTranslations } from './translations.types';

/**
 * Map a normalized PaymentError code to a customer-facing localized string.
 * Never returns the technical/provider English diagnostic from PaymentError.message.
 */
export function localizePaymentError(
  code: PaymentErrorCode | undefined,
  messages: EasyPaymentsTranslations,
): string {
  switch (code) {
    case 'CARD_DECLINED':
      return messages.errorDetailCardDeclined;
    case 'NETWORK_ERROR':
      return messages.errorDetailNetwork;
    case 'CONFIG_MISSING':
    case 'CONFIG_INVALID':
      return messages.errorDetailConfig;
    case 'PROVIDER_UNAVAILABLE':
    case 'PROVIDER_NOT_CONFIGURED':
    case 'PROVIDER_NOT_IMPLEMENTED':
      return messages.errorDetailUnavailable;
    case 'AUTHENTICATION_REQUIRED':
      return messages.errorDetailAuthRequired;
    case 'AUTHENTICATION_FAILED':
      return messages.errorDetailAuthFailed;
    case 'SDK_LOAD_FAILED':
      return messages.errorDetailSdkLoad;
    case 'BACKEND_ERROR':
      return messages.errorDetailBackend;
    case 'PRODUCT_INVALID':
      return messages.errorDetailProductInvalid;
    case 'PAYMENT_CANCELLED':
      return messages.errorDetailCancelled;
    case 'PAYMENT_FAILED':
    case 'UNKNOWN':
    default:
      return messages.errorBody;
  }
}
