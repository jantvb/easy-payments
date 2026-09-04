import { PaymentContext, PaymentProviderName, PaymentRequest, PaymentResult } from '../models';

export interface PaymentProviderAdapter {
  readonly provider: PaymentProviderName;
  readonly isMock: boolean;

  initialize(): Promise<void>;

  isAvailable(context: PaymentContext): Promise<boolean>;

  createPayment(request: PaymentRequest): Promise<PaymentResult>;

  destroy?(): Promise<void> | void;
}
