import { EasyPaymentsBackendConfig } from './easy-payments.config';
import { warnProviderDiagnostic } from '../diagnostics/provider-diagnostics';

export type BackendUrlFailureCode = 'missing-endpoint' | 'invalid-base-url' | 'invalid-endpoint';

export type BackendUrlResolution =
  | { ok: true; url: string }
  | { ok: false; code: BackendUrlFailureCode };

const HTTP_SCHEME = /^https?:$/i;

/**
 * Resolve a merchant backend endpoint against an optional baseUrl.
 * Uses the standard URL parser only. Does not read window, document, or location.
 */
export function resolveBackendUrl(
  baseUrl: string | undefined | null,
  endpoint: string | undefined | null,
): BackendUrlResolution {
  const endpointValue = endpoint?.trim() ?? '';
  if (!endpointValue) {
    return { ok: false, code: 'missing-endpoint' };
  }

  if (isProtocolRelative(endpointValue) || !isAllowedEndpoint(endpointValue)) {
    return { ok: false, code: 'invalid-endpoint' };
  }

  if (isAbsoluteHttpUrl(endpointValue)) {
    return { ok: true, url: endpointValue };
  }

  const baseValue = baseUrl?.trim() ?? '';
  if (!baseValue) {
    return { ok: true, url: endpointValue };
  }

  if (isProtocolRelative(baseValue) || !isAbsoluteHttpUrl(baseValue)) {
    return { ok: false, code: 'invalid-base-url' };
  }

  return { ok: true, url: joinBaseAndEndpoint(baseValue, endpointValue) };
}

/**
 * Resolved URL for availability checks and HTTP calls.
 * Invalid values warn once in development and return undefined.
 * An omitted baseUrl does not warn.
 */
export function backendEndpointUrl(
  backend: EasyPaymentsBackendConfig | undefined,
  endpoint: string | undefined,
): string | undefined {
  const result = resolveBackendUrl(backend?.baseUrl, endpoint);
  if (result.ok) {
    return result.url;
  }
  warnBackendUrlIssue(result.code);
  return undefined;
}

export function warnBackendUrlIssue(code: BackendUrlFailureCode): void {
  if (code === 'missing-endpoint') {
    return;
  }
  if (code === 'invalid-base-url') {
    warnProviderDiagnostic(
      'Backend',
      'BACKEND_BASE_URL_INVALID',
      'backend.baseUrl must be an absolute http or https URL.',
    );
    return;
  }
  warnProviderDiagnostic(
    'Backend',
    'BACKEND_ENDPOINT_INVALID',
    'A backend endpoint must be a relative path or an absolute http(s) URL.',
  );
}

function isProtocolRelative(value: string): boolean {
  return value.startsWith('//');
}

function isAllowedEndpoint(value: string): boolean {
  const scheme = readScheme(value);
  if (!scheme) {
    return true;
  }
  return scheme === 'http' || scheme === 'https';
}

function isAbsoluteHttpUrl(value: string): boolean {
  if (isProtocolRelative(value)) {
    return false;
  }
  const scheme = readScheme(value);
  if (!scheme || !HTTP_SCHEME.test(`${scheme}:`)) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function readScheme(value: string): string | undefined {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  return match?.[1].toLowerCase();
}

function joinBaseAndEndpoint(base: string, endpoint: string): string {
  const parsed = new URL(base);
  const path = parsed.pathname.replace(/\/+$/, '');
  const relative = endpoint.replace(/^\/+/, '');
  return `${parsed.origin}${path}/${relative}`;
}
