/**
 * Server-side trusted product catalog for the Easy Payments demo backend.
 *
 * The browser may send productId + quantity, but charge amounts are ALWAYS
 * resolved here. Never trust client-supplied amounts for Stripe or PayPal.
 */

export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  /** Unit price in major currency units (e.g. 99.99). */
  unitAmount: number;
  currency: string;
}

const CATALOG: Record<string, CatalogProduct> = {
  'premium-plan': {
    id: 'premium-plan',
    name: 'Premium Plan',
    description: 'One year subscription',
    unitAmount: 99.99,
    currency: 'USD',
  },
  'basic-plan': {
    id: 'basic-plan',
    name: 'Basic Plan',
    description: 'Monthly subscription',
    unitAmount: 29.99,
    currency: 'USD',
  },
};

export function getCatalogProduct(productId: string): CatalogProduct | null {
  const id = productId?.trim();
  if (!id) {
    return null;
  }
  return CATALOG[id] ?? null;
}

export function listCatalogProducts(): CatalogProduct[] {
  return Object.values(CATALOG);
}

/** Format a major-unit amount as a PayPal-compatible decimal string. */
export function formatMajorAmount(amount: number): string {
  return amount.toFixed(2);
}
