/**
 * Centralized customer-facing checkout copy.
 * Kept in one place to ease future localization without a full i18n system yet.
 */
export const CHECKOUT_COPY = {
  processingTitle: 'Processing payment...',
  processingHint: "Please don't close this window.",

  successTitle: 'Payment successful',
  successBody: 'Your payment has been completed successfully.',
  successContinue: 'Continue',
  successProduct: 'Product',
  successTotal: 'Total',
  successPaidWith: 'Paid with',
  successTransaction: 'Transaction',

  errorTitle: 'Payment failed',
  errorBody: "We couldn't complete your payment.",
  errorTryAgain: 'Try again',

  cancelledTitle: 'Payment cancelled',
  cancelledBody: 'No payment was completed.',
  cancelledReturn: 'Return to checkout',
} as const;

export type CheckoutCopyKey = keyof typeof CHECKOUT_COPY;
