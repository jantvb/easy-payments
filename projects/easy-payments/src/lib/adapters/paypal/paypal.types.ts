import { CheckoutOptions, PaymentProduct } from '../../models';

/**
 * Stable identity for PayPal button render sessions.
 * Theme is intentionally excluded — theme changes must not recreate orders or buttons.
 */
export function buildPayPalRenderKey(
  product: PaymentProduct,
  checkout?: CheckoutOptions,
): string {
  const quantity = product.quantity ?? 1;
  const currency = product.currency.trim().toUpperCase();
  const email = checkout?.customer?.email ?? '';
  const name = checkout?.customer?.name ?? '';
  const success = checkout?.successUrl ?? '';
  const cancel = checkout?.cancelUrl ?? '';
  return `${product.id}|${quantity}|${currency}|${email}|${name}|${success}|${cancel}`;
}

export type PayPalUiState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'creating-order'
  | 'waiting-approval'
  | 'capturing'
  | 'success'
  | 'cancelled'
  | 'error';

export interface PayPalButtonsHandle {
  render(selector: string | HTMLElement): Promise<void>;
  close?: () => Promise<void>;
}

export interface PayPalButtonsOptions {
  style?: Record<string, string>;
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
  onClick?: (
    data: unknown,
    actions: { reject: () => Promise<void>; resolve: () => Promise<void> },
  ) => void | Promise<void>;
}

export interface PayPalNamespace {
  Buttons(options: PayPalButtonsOptions): PayPalButtonsHandle;
}
