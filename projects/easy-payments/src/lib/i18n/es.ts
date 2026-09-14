import type { EasyPaymentsTranslations } from './translations.types';

/** Neutral international Spanish. Provider trademarks stay untranslated. */
export const ES_TRANSLATIONS: EasyPaymentsTranslations = {
  checkoutAriaLabel: 'Pago',
  paymentMethodsLabel: 'Métodos de pago',
  paymentMethodSelectionAria: 'Selección de método de pago',
  checkoutTitle: 'Completa tu compra',
  checkoutSubtitle: 'Elige tu método de pago preferido',
  noPaymentMethodsAvailable: 'No hay métodos de pago disponibles para esta configuración.',
  demoBadge: 'Demo',
  demoModeAria: 'modo demo',

  methodCard: 'Tarjeta',

  orderTotal: 'Total del pedido',
  quantityPrefix: 'Cant.',
  eachSuffix: 'c/u',

  processingTitle: 'Procesando el pago...',
  processingHint: 'Por favor, no cierre esta ventana.',
  successTitle: 'Pago realizado',
  successBody: 'Su pago se completó correctamente.',
  successContinue: 'Continuar',
  successProduct: 'Producto',
  successTotal: 'Total',
  successPaidWith: 'Pagado con',
  successTransaction: 'Transacción',
  errorTitle: 'Pago fallido',
  errorBody: 'No pudimos completar su pago.',
  errorTryAgain: 'Intentar de nuevo',
  cancelledTitle: 'Pago cancelado',
  cancelledBody: 'No se completó ningún pago.',
  cancelledReturn: 'Volver al checkout',

  payWithMethod: 'Pagar con {{method}}',
  demoCheckoutHint: 'Checkout de demostración — no se procesa un pago real.',
  continuePaymentHint: 'Continúe para completar su pago.',
  processingPayment: 'Procesando el pago…',
  payAmount: 'Pagar {{amount}}',
  payAmountWithMethodAria: 'Pagar {{amount}} con {{method}}',

  payWithCard: 'Pagar con tarjeta',
  secureCardPaymentStripe: 'Pago con tarjeta seguro impulsado por Stripe',
  preparingSecureCardForm: 'Preparando el formulario seguro de tarjeta…',
  stripeCardFormAria: 'Formulario seguro de tarjeta de Stripe',
  acceptedCardsAria: 'Tarjetas comúnmente aceptadas',
  cardsAcceptedViaStripe:
    'Tarjetas aceptadas a través de Stripe (Visa, Mastercard, American Express y más)',
  paymentCompleted: 'Pago completado.',
  defaultSecureCheckout:
    'Checkout seguro — sus datos de pago permanecen con el proveedor de pagos.',

  payWithPayPal: 'Pagar con PayPal',
  secureCheckoutPayPal: 'Checkout seguro impulsado por PayPal',
  preparingPayPal: 'Preparando el checkout de PayPal…',
  creatingPayPalOrder: 'Creando el pedido de PayPal…',
  waitingPayPalApproval: 'Esperando la aprobación de PayPal…',
  capturingPayPal: 'Capturando el pago de PayPal…',
  paypalCheckoutAria: 'Checkout oficial de PayPal',
  paypalCancelled: 'Checkout de PayPal cancelado.',

  payWithGooglePay: 'Pagar con Google Pay',
  secureCheckoutGooglePay: 'Checkout seguro con Google Pay',
  preparingGooglePay: 'Preparando Google Pay…',
  googlePayUnavailable: 'Google Pay no está disponible en este navegador o cuenta de Google.',
  preparingSecurePayment: 'Preparando el pago seguro…',
  waitingGooglePay: 'Esperando Google Pay…',
  processingGooglePay: 'Procesando el pago con Google Pay…',
  googlePayCheckoutAria: 'Checkout oficial de Google Pay',
  totalAmount: 'Total {{amount}}',

  payWithApplePay: 'Pagar con Apple Pay',
  secureCheckoutApplePay: 'Checkout seguro con Apple Pay',
  preparingApplePay: 'Preparando Apple Pay…',
  applePayUnavailable: 'Apple Pay no está disponible en este navegador o Wallet.',
  processingApplePay: 'Procesando el pago con Apple Pay…',
  applePayCheckoutAria: 'Checkout oficial de Apple Pay',

  payWithKlarna: 'Pagar con Klarna',
  secureCheckoutKlarna: 'Checkout seguro impulsado por Klarna a través de Stripe',
  preparingKlarna: 'Preparando Klarna…',
  klarnaFormAria: 'Formulario seguro de pago de Klarna',

  payWithAffirm: 'Pagar con Affirm',
  secureCheckoutAffirm: 'Checkout seguro impulsado por Affirm a través de Stripe',
  preparingAffirm: 'Preparando Affirm…',
  affirmFormAria: 'Formulario seguro de pago de Affirm',
};
