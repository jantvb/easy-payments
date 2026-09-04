import { PaymentMethod, PaymentProviderName } from './payment-method.model';

export type PaymentStatus = 'success' | 'cancelled' | 'failed';

export interface PaymentResult {
  status: PaymentStatus;
  method: PaymentMethod;
  provider: PaymentProviderName;
  transactionId?: string;
  sessionId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export function normalizePaymentResult(result: PaymentResult): PaymentResult {
  return {
    status: result.status,
    method: result.method,
    provider: result.provider,
    ...(result.transactionId !== undefined ? { transactionId: result.transactionId } : {}),
    ...(result.sessionId !== undefined ? { sessionId: result.sessionId } : {}),
    ...(result.message !== undefined ? { message: result.message } : {}),
    ...(result.metadata !== undefined ? { metadata: { ...result.metadata } } : {}),
  };
}
