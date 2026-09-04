import {
  buildKlarnaReturnUrl,
  clearKlarnaPendingReturn,
  clearStripeReturnParamsFromUrl,
  isKlarnaReturnAttempt,
  isKlarnaStripeReturn,
  KLARNA_PENDING_STORAGE_KEY,
  KLARNA_RETURN_METHOD_PARAM,
  markKlarnaPendingReturn,
  readKlarnaPendingReturn,
  readStripeReturnParams,
} from './klarna-return';

describe('klarna-return helpers', () => {
  let memory: Record<string, string>;
  let storage: Storage;

  beforeEach(() => {
    memory = {};
    storage = {
      getItem: (key: string) => (key in memory ? memory[key] : null),
      setItem: (key: string, value: string) => {
        memory[key] = value;
      },
      removeItem: (key: string) => {
        delete memory[key];
      },
      clear: () => {
        memory = {};
      },
      key: () => null,
      length: 0,
    };
  });

  it('builds a return_url that stamps ep_method=klarna', () => {
    const url = buildKlarnaReturnUrl(
      'https://shop.example/checkout?utm=1',
      'https://shop.example/checkout?utm=1',
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get(KLARNA_RETURN_METHOD_PARAM)).toBe('klarna');
    expect(parsed.searchParams.get('utm')).toBe('1');
  });

  it('reads Stripe return query params', () => {
    const params = readStripeReturnParams(
      '?payment_intent=pi_123&payment_intent_client_secret=pi_123_secret_abc&redirect_status=succeeded&ep_method=klarna',
    );
    expect(params.paymentIntentId).toBe('pi_123');
    expect(params.clientSecret).toBe('pi_123_secret_abc');
    expect(params.redirectStatus).toBe('succeeded');
  });

  it('detects Klarna return via ep_method', () => {
    expect(
      isKlarnaStripeReturn(
        '?payment_intent_client_secret=sec&ep_method=klarna',
        storage,
      ),
    ).toBeTrue();
  });

  it('detects Klarna return attempt even without client secret', () => {
    expect(isKlarnaReturnAttempt('?ep_method=klarna', storage)).toBeTrue();
    expect(isKlarnaStripeReturn('?ep_method=klarna', storage)).toBeFalse();
  });

  it('detects Klarna return via pending session marker when ep_method is absent', () => {
    markKlarnaPendingReturn('premium-plan', storage);
    expect(isKlarnaStripeReturn('?payment_intent_client_secret=sec', storage)).toBeTrue();
    expect(readKlarnaPendingReturn(storage)?.productId).toBe('premium-plan');
  });

  it('does not treat unrelated Stripe returns as Klarna', () => {
    expect(isKlarnaStripeReturn('?payment_intent_client_secret=sec', storage)).toBeFalse();
  });

  it('clears pending marker without storing secrets', () => {
    markKlarnaPendingReturn('premium-plan', storage);
    expect(storage.getItem(KLARNA_PENDING_STORAGE_KEY)).toContain('premium-plan');
    expect(storage.getItem(KLARNA_PENDING_STORAGE_KEY)).not.toContain('secret');
    clearKlarnaPendingReturn(storage);
    expect(readKlarnaPendingReturn(storage)).toBeNull();
  });

  it('strips Stripe return params from a URL', () => {
    const next = clearStripeReturnParamsFromUrl(
      'https://shop.example/checkout?payment_intent=pi_1&payment_intent_client_secret=sec&redirect_status=succeeded&ep_method=klarna&keep=1',
    );
    expect(next).toContain('keep=1');
    expect(next).not.toContain('payment_intent=');
    expect(next).not.toContain('payment_intent_client_secret');
    expect(next).not.toContain('ep_method');
    expect(next).not.toContain('redirect_status');
  });
});
