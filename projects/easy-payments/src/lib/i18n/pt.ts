import type { EasyPaymentsTranslations } from './translations.types';

/** Brazilian Portuguese for v1.1.0. Provider trademarks stay untranslated. */
export const PT_TRANSLATIONS: EasyPaymentsTranslations = {
  checkoutAriaLabel: 'Pagamento',
  paymentMethodsLabel: 'Formas de pagamento',
  paymentMethodSelectionAria: 'Seleção da forma de pagamento',
  demoBadge: 'Demo',
  demoModeAria: 'modo demo',

  methodCard: 'Cartão',

  orderTotal: 'Total do pedido',
  quantityPrefix: 'Qtd.',
  eachSuffix: 'cada',

  processingTitle: 'Processando pagamento...',
  processingHint: 'Por favor, não feche esta janela.',
  successTitle: 'Pagamento concluído',
  successBody: 'Seu pagamento foi concluído com sucesso.',
  successContinue: 'Continuar',
  successProduct: 'Produto',
  successTotal: 'Total',
  successPaidWith: 'Pago com',
  successTransaction: 'Transação',
  errorTitle: 'Falha no pagamento',
  errorBody: 'Não foi possível concluir seu pagamento.',
  errorTryAgain: 'Tentar novamente',
  cancelledTitle: 'Pagamento cancelado',
  cancelledBody: 'Nenhum pagamento foi concluído.',
  cancelledReturn: 'Voltar ao checkout',

  payWithMethod: 'Pagar com {{method}}',
  demoCheckoutHint: 'Checkout de demonstração — nenhum pagamento real é processado.',
  continuePaymentHint: 'Continue para concluir seu pagamento.',
  processingPayment: 'Processando pagamento…',
  payAmount: 'Pagar {{amount}}',
  payAmountWithMethodAria: 'Pagar {{amount}} com {{method}}',

  payWithCard: 'Pagar com cartão',
  secureCardPaymentStripe: 'Pagamento com cartão seguro com tecnologia Stripe',
  preparingSecureCardForm: 'Preparando o formulário seguro de cartão…',
  stripeCardFormAria: 'Formulário seguro de cartão da Stripe',
  acceptedCardsAria: 'Cartões comumente aceitos',
  cardsAcceptedViaStripe:
    'Cartões aceitos via Stripe (Visa, Mastercard, American Express e mais)',
  paymentCompleted: 'Pagamento concluído.',
  defaultSecureCheckout:
    'Checkout seguro — seus dados de pagamento permanecem com o provedor de pagamento.',

  payWithPayPal: 'Pagar com PayPal',
  secureCheckoutPayPal: 'Checkout seguro com tecnologia PayPal',
  preparingPayPal: 'Preparando o checkout do PayPal…',
  creatingPayPalOrder: 'Criando o pedido do PayPal…',
  waitingPayPalApproval: 'Aguardando aprovação do PayPal…',
  capturingPayPal: 'Capturando o pagamento do PayPal…',
  paypalCheckoutAria: 'Checkout oficial do PayPal',
  paypalCancelled: 'Checkout do PayPal cancelado.',

  payWithGooglePay: 'Pagar com Google Pay',
  secureCheckoutGooglePay: 'Checkout seguro com Google Pay',
  preparingGooglePay: 'Preparando o Google Pay…',
  googlePayUnavailable: 'O Google Pay não está disponível neste navegador ou conta Google.',
  preparingSecurePayment: 'Preparando o pagamento seguro…',
  waitingGooglePay: 'Aguardando o Google Pay…',
  processingGooglePay: 'Processando o pagamento com Google Pay…',
  googlePayCheckoutAria: 'Checkout oficial do Google Pay',
  totalAmount: 'Total {{amount}}',

  payWithApplePay: 'Pagar com Apple Pay',
  secureCheckoutApplePay: 'Checkout seguro com Apple Pay',
  preparingApplePay: 'Preparando o Apple Pay…',
  applePayUnavailable: 'O Apple Pay não está disponível neste navegador ou Wallet.',
  processingApplePay: 'Processando o pagamento com Apple Pay…',
  applePayCheckoutAria: 'Checkout oficial do Apple Pay',

  payWithKlarna: 'Pagar com Klarna',
  secureCheckoutKlarna: 'Checkout seguro com Klarna via Stripe',
  preparingKlarna: 'Preparando a Klarna…',
  klarnaFormAria: 'Formulário seguro de pagamento da Klarna',

  payWithAffirm: 'Pagar com Affirm',
  secureCheckoutAffirm: 'Checkout seguro com Affirm via Stripe',
  preparingAffirm: 'Preparando a Affirm…',
  affirmFormAria: 'Formulário seguro de pagamento da Affirm',
};
