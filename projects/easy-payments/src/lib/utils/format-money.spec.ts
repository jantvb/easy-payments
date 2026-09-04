import { formatMoney, formatUnitAmount } from './format-money';

describe('formatMoney', () => {
  it('formats a USD amount with quantity', () => {
    const formatted = formatMoney(99.99, 'USD', 1);
    expect(formatted).toMatch(/99\.99/);
    expect(formatted).toMatch(/\$|USD/);
  });

  it('multiplies by quantity for presentation totals', () => {
    const formatted = formatMoney(10, 'USD', 3);
    expect(formatted).toMatch(/30/);
  });

  it('formats a unit amount', () => {
    expect(formatUnitAmount(12.5, 'usd')).toMatch(/12\.50|12\.5/);
  });
});
