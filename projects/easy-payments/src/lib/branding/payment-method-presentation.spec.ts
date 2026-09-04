import {
  getPaymentMethodPresentation,
  listPaymentMethodPresentations,
} from './payment-method-presentation';
import { APPLE_PAY_MARK_DATA_URI, GOOGLE_PAY_MARK_DATA_URI } from './official-mark-data';

describe('payment method presentation', () => {
  it('uses a generic card icon (not a network brand)', () => {
    const card = getPaymentMethodPresentation('card', 'light');
    expect(card.source).toBe('generic');
    expect(card.markUrl).toBeNull();
    expect(card.markIncludesName).toBeFalse();
    expect(card.label).toBe('Card');
  });

  it('uses the official bundled Apple Pay mark', () => {
    const apple = getPaymentMethodPresentation('apple-pay', 'light');
    expect(apple.source).toBe('official-bundled');
    expect(apple.markUrl).toBe(APPLE_PAY_MARK_DATA_URI);
    expect(apple.markIncludesName).toBeTrue();
    expect(apple.markUrl?.startsWith('data:image/svg+xml')).toBeTrue();
  });

  it('uses the official bundled Google Pay mark', () => {
    const google = getPaymentMethodPresentation('google-pay', 'dark');
    expect(google.source).toBe('official-bundled');
    expect(google.markUrl).toBe(GOOGLE_PAY_MARK_DATA_URI);
  });

  it('uses PayPal CDN assets on light and dark', () => {
    const light = getPaymentMethodPresentation('paypal', 'light');
    const dark = getPaymentMethodPresentation('paypal', 'dark');
    expect(light.source).toBe('official-cdn');
    expect(light.markUrl).toContain('paypalobjects.com');
    expect(dark.markUrl).toBe(light.markUrl);
  });

  it('uses the official Klarna CDN badge', () => {
    const klarna = getPaymentMethodPresentation('klarna', 'light');
    expect(klarna.source).toBe('official-cdn');
    expect(klarna.markUrl).toContain('klarnacdn.net');
    expect(klarna.markIncludesName).toBeTrue();
  });

  it('uses Affirm CDN assets with a dark variant', () => {
    const light = getPaymentMethodPresentation('affirm', 'light');
    const dark = getPaymentMethodPresentation('affirm', 'dark');
    expect(light.markUrl).toContain('cdn-assets.affirm.com');
    expect(dark.markUrl).toContain('cdn-assets.affirm.com');
    expect(dark.markUrl).not.toBe(light.markUrl);
  });

  it('falls back to text for Samsung Pay', () => {
    const samsung = getPaymentMethodPresentation('samsung-pay', 'light');
    expect(samsung.source).toBe('text-fallback');
    expect(samsung.markUrl).toBeNull();
    expect(samsung.label).toBe('Samsung Pay');
  });

  it('lists presentations for every supported method', () => {
    const list = listPaymentMethodPresentations('light');
    expect(list.map((entry) => entry.method)).toEqual([
      'card',
      'apple-pay',
      'google-pay',
      'samsung-pay',
      'paypal',
      'klarna',
      'affirm',
    ]);
  });
});
