import { formatTransactionReference } from './checkout-view-state';

describe('formatTransactionReference', () => {
  it('returns null for empty values', () => {
    expect(formatTransactionReference(undefined)).toBeNull();
    expect(formatTransactionReference('')).toBeNull();
    expect(formatTransactionReference('   ')).toBeNull();
  });

  it('keeps short ids intact', () => {
    expect(formatTransactionReference('ABC123')).toBe('ABC123');
  });

  it('truncates long ids safely', () => {
    expect(formatTransactionReference('pi_3OxYzABCDEFGHA82F')).toBe('••••A82F');
  });
});
