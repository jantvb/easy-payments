/**
 * Klarna (via Stripe Payment Element) redirect return helpers.
 *
 * Stripe appends `payment_intent` and `payment_intent_client_secret` to return_url.
 * We also stamp `ep_method=klarna` and a light sessionStorage marker (no secrets)
 * so Easy Payments can resume as Klarna after the page remounts.
 */

export const KLARNA_RETURN_METHOD_PARAM = 'ep_method';
export const KLARNA_PENDING_STORAGE_KEY = 'ep.klarna.pending';

/** Finite poll when Stripe reports PaymentIntent status `processing` after Klarna return. */
export const KLARNA_PROCESSING_MAX_ATTEMPTS = 6;
export const KLARNA_PROCESSING_DELAY_MS = 750;

export interface KlarnaPendingReturn {
  productId: string;
  at: number;
}

export interface StripeReturnParams {
  paymentIntentId: string | null;
  clientSecret: string | null;
  redirectStatus: string | null;
}

function canUseSessionStorage(storage?: Storage): storage is Storage {
  return !!storage && typeof storage.getItem === 'function';
}

function currentSearch(search?: string): string {
  return search ?? (typeof window !== 'undefined' ? window.location.search : '');
}

/** Build a return_url that preserves merchant params and marks the flow as Klarna. */
export function buildKlarnaReturnUrl(baseUrl?: string, locationHref?: string): string {
  const href =
    locationHref ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}${window.location.search}`
      : 'http://localhost/');
  const url = new URL(baseUrl || href, href);
  url.searchParams.set(KLARNA_RETURN_METHOD_PARAM, 'klarna');
  return url.href;
}

export function readStripeReturnParams(search?: string): StripeReturnParams {
  const params = new URLSearchParams(currentSearch(search));
  return {
    paymentIntentId: params.get('payment_intent'),
    clientSecret: params.get('payment_intent_client_secret'),
    redirectStatus: params.get('redirect_status'),
  };
}

export function markKlarnaPendingReturn(productId: string, storage?: Storage): void {
  const store =
    storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  if (!canUseSessionStorage(store)) {
    return;
  }
  const payload: KlarnaPendingReturn = { productId, at: Date.now() };
  store.setItem(KLARNA_PENDING_STORAGE_KEY, JSON.stringify(payload));
}

export function readKlarnaPendingReturn(storage?: Storage): KlarnaPendingReturn | null {
  const store =
    storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  if (!canUseSessionStorage(store)) {
    return null;
  }
  try {
    const raw = store.getItem(KLARNA_PENDING_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as KlarnaPendingReturn;
    if (!parsed || typeof parsed.productId !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearKlarnaPendingReturn(storage?: Storage): void {
  const store =
    storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  if (!canUseSessionStorage(store)) {
    return;
  }
  store.removeItem(KLARNA_PENDING_STORAGE_KEY);
}

/**
 * True when the URL/session indicates a Klarna provider return attempt
 * (even if payment_intent_client_secret is missing/malformed).
 */
export function isKlarnaReturnAttempt(search?: string, storage?: Storage): boolean {
  const params = new URLSearchParams(currentSearch(search));
  if (params.get(KLARNA_RETURN_METHOD_PARAM) === 'klarna') {
    return true;
  }
  const { clientSecret, paymentIntentId } = readStripeReturnParams(search);
  if (!(clientSecret || paymentIntentId)) {
    return false;
  }
  return readKlarnaPendingReturn(storage) !== null;
}

/**
 * True when Stripe return params include a client secret and the flow is Klarna.
 * Prefer `isKlarnaReturnAttempt` for UI/processing detection.
 */
export function isKlarnaStripeReturn(search?: string, storage?: Storage): boolean {
  const { clientSecret } = readStripeReturnParams(search);
  if (!clientSecret) {
    return false;
  }
  return isKlarnaReturnAttempt(search, storage);
}

/** Remove Stripe + Easy Payments return query params without a full reload. */
export function clearStripeReturnParamsFromUrl(href?: string): string | null {
  if (typeof window === 'undefined' && !href) {
    return null;
  }
  const url = new URL(href ?? window.location.href);
  url.searchParams.delete('payment_intent');
  url.searchParams.delete('payment_intent_client_secret');
  url.searchParams.delete('redirect_status');
  url.searchParams.delete(KLARNA_RETURN_METHOD_PARAM);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (typeof window !== 'undefined' && typeof window.history?.replaceState === 'function') {
    window.history.replaceState({}, '', next);
  }
  return next;
}
