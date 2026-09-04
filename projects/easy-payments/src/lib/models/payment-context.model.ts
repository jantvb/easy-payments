import { CheckoutOptions } from './checkout-options.model';
import { PaymentProduct } from './payment-product.model';
import { ResolvedPaymentTheme } from './payment-theme.model';

export interface PaymentContext {
  product: PaymentProduct;
  checkout?: CheckoutOptions;
  theme: ResolvedPaymentTheme;
}
