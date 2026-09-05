/**
 * Server-side product catalog for the Easy Payments demo backend.
 *
 * The catalog is the default source of pricing. This demo server additionally lets
 * the playground override the unit amount so any provider can be exercised at an
 * arbitrary price; it is safe only because StripeService refuses anything other than
 * an `sk_test_` key and PayPal runs against sandbox credentials. A production backend
 * must delete `resolveUnitAmount` and always charge `product.unitAmount`.
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
    unitAmount: 99,
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

/** Smallest and largest unit price the demo playground may request. */
export const MIN_DEMO_UNIT_AMOUNT = 0.5;
export const MAX_DEMO_UNIT_AMOUNT = 999_999;

/**
 * DEMO ONLY — resolves the unit price to charge, honouring a playground override.
 * Production backends must charge `product.unitAmount` and ignore the request.
 */
export function resolveUnitAmount(product: CatalogProduct, requestedAmount?: number): number {
  if (typeof requestedAmount !== 'number' || !Number.isFinite(requestedAmount)) {
    return product.unitAmount;
  }

  const rounded = Math.round(requestedAmount * 100) / 100;
  if (rounded < MIN_DEMO_UNIT_AMOUNT || rounded > MAX_DEMO_UNIT_AMOUNT) {
    return product.unitAmount;
  }

  return rounded;
}

/** Format a major-unit amount as a PayPal-compatible decimal string. */
export function formatMajorAmount(amount: number): string {
  return amount.toFixed(2);
}
