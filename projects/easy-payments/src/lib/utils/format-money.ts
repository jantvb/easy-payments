/**
 * Presentational money formatting for checkout UI.
 * Not used for charge authority — backends determine trusted amounts.
 * Locale affects formatting only; amount and currency code are unchanged.
 */
export function formatMoney(
  amount: number,
  currency: string,
  quantity = 1,
  locale?: string | null,
): string {
  const total = amount * quantity;
  const code = (currency || 'USD').trim().toUpperCase() || 'USD';
  const localeTag = locale && locale.trim() ? locale.trim() : undefined;

  try {
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
    }).format(total);
  } catch {
    return `${code} ${total.toFixed(2)}`;
  }
}

export function formatUnitAmount(
  amount: number,
  currency: string,
  locale?: string | null,
): string {
  return formatMoney(amount, currency, 1, locale);
}
