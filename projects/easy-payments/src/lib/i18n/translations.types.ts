/**
 * Full Easy Payments-owned UI dictionary.
 * English is canonical; es/pt must implement the same shape.
 */
export interface EasyPaymentsTranslations {
  checkoutAriaLabel: string;
  paymentMethodsLabel: string;
  paymentMethodSelectionAria: string;
  checkoutTitle: string;
  checkoutSubtitle: string;
  noPaymentMethodsAvailable: string;
  demoBadge: string;
  demoModeAria: string;

  methodCard: string;

  orderTotal: string;
  quantityPrefix: string;
  eachSuffix: string;

  processingTitle: string;
  processingHint: string;
  successTitle: string;
  successBody: string;
  successContinue: string;
  successProduct: string;
  successTotal: string;
  successPaidWith: string;
  successTransaction: string;
  errorTitle: string;
  errorBody: string;
  errorTryAgain: string;
  errorDetailCardDeclined: string;
  errorDetailNetwork: string;
  errorDetailConfig: string;
  errorDetailUnavailable: string;
  errorDetailAuthRequired: string;
  errorDetailAuthFailed: string;
  errorDetailSdkLoad: string;
  errorDetailBackend: string;
  errorDetailProductInvalid: string;
  errorDetailCancelled: string;
  cancelledTitle: string;
  cancelledBody: string;
  cancelledReturn: string;

  payWithMethod: string;
  demoCheckoutHint: string;
  continuePaymentHint: string;
  processingPayment: string;
  payAmount: string;
  payAmountWithMethodAria: string;

  payWithCard: string;
  secureCardPaymentStripe: string;
  preparingSecureCardForm: string;
  stripeCardFormAria: string;
  acceptedCardsAria: string;
  cardsAcceptedViaStripe: string;
  paymentCompleted: string;
  defaultSecureCheckout: string;

  payWithPayPal: string;
  secureCheckoutPayPal: string;
  preparingPayPal: string;
  creatingPayPalOrder: string;
  waitingPayPalApproval: string;
  capturingPayPal: string;
  paypalCheckoutAria: string;
  paypalCancelled: string;

  payWithGooglePay: string;
  secureCheckoutGooglePay: string;
  preparingGooglePay: string;
  googlePayUnavailable: string;
  preparingSecurePayment: string;
  waitingGooglePay: string;
  processingGooglePay: string;
  googlePayCheckoutAria: string;
  totalAmount: string;

  payWithApplePay: string;
  secureCheckoutApplePay: string;
  preparingApplePay: string;
  applePayUnavailable: string;
  processingApplePay: string;
  applePayCheckoutAria: string;

  payWithKlarna: string;
  secureCheckoutKlarna: string;
  preparingKlarna: string;
  klarnaFormAria: string;

  payWithAffirm: string;
  secureCheckoutAffirm: string;
  preparingAffirm: string;
  affirmFormAria: string;
}

/** Partial overrides supplied by the consuming app. */
export type EasyPaymentsTranslationOverrides = Partial<EasyPaymentsTranslations>;

export type EasyPaymentsTranslationKey = keyof EasyPaymentsTranslations;

/**
 * Replace `{{token}}` placeholders in a translation string.
 */
export function interpolate(
  template: string,
  params: Record<string, string | number | undefined | null> = {},
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = params[key];
    return value == null ? '' : String(value);
  });
}
