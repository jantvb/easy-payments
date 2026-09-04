import { PaymentMethod } from './payment-method.model';
import { PaymentContext } from './payment-context.model';

export interface PaymentRequest {
  method: PaymentMethod;
  context: PaymentContext;
}
