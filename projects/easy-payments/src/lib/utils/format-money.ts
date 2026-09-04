/**
 * Presentational money formatting for checkout UI.
 * Not used for charge authority — backends determine trusted amounts.
 */
export function formatMoney(amount: number, currency: string, quantity = 1): string {
  const total = amount * quantity;
  const code = (currency || 'USD').trim().toUpperCase() || 'USD';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
    }).format(total);
  } catch {
    return `${code} ${total.toFixed(2)}`;
  }
}

export function formatUnitAmount(amount: number, currency: string): string {
  return formatMoney(amount, currency, 1);
}
