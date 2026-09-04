const VALID_CURRENCY = /^[A-Z]{3}$/;

export interface ProductValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePaymentProduct(product: unknown): ProductValidationResult {
  const errors: string[] = [];

  if (!product || typeof product !== 'object') {
    return { valid: false, errors: ['Product is required.'] };
  }

  const p = product as Record<string, unknown>;

  if (!p['id'] || typeof p['id'] !== 'string' || p['id'].trim() === '') {
    errors.push('Product ID is required.');
  }

  if (!p['name'] || typeof p['name'] !== 'string' || p['name'].trim() === '') {
    errors.push('Product name is required.');
  }

  if (typeof p['amount'] !== 'number' || !Number.isFinite(p['amount']) || p['amount'] <= 0) {
    errors.push('Product amount must be a number greater than 0.');
  }

  if (!p['currency'] || typeof p['currency'] !== 'string' || !VALID_CURRENCY.test(p['currency'])) {
    errors.push('Product currency must be a valid 3-letter ISO code (e.g. USD).');
  }

  if (p['quantity'] !== undefined) {
    if (typeof p['quantity'] !== 'number' || !Number.isInteger(p['quantity']) || p['quantity'] < 1) {
      errors.push('Product quantity must be a positive integer when provided.');
    }
  }

  return { valid: errors.length === 0, errors };
}
