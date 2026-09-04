export interface CheckoutOptions {
  successUrl?: string;
  cancelUrl?: string;
  customer?: {
    email?: string;
    name?: string;
  };
  shipping?: {
    required?: boolean;
  };
}
