export interface PaymentProduct {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  quantity?: number;
  imageUrl?: string;
  metadata?: Record<string, string>;
}
