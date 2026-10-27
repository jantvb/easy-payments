/**
 * Optional merchant metadata on a product.
 * Flat strings only. This is not `PaymentResult.metadata`.
 */
export type EasyPaymentsMerchantMetadata = Record<string, string>;

export interface PaymentProduct {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  quantity?: number;
  imageUrl?: string;
  metadata?: EasyPaymentsMerchantMetadata;
}
