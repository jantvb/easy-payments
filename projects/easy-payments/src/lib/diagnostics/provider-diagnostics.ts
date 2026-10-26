import { isDevMode } from '@angular/core';
import { PaymentError } from '../errors/payment-error';

/** Internal readiness for a checkout method. Compatible with a future diagnostics API. */
export type MethodReadinessState = 'loading' | 'ready' | 'unavailable' | 'misconfigured';

export interface ProviderInitFailure {
  code: string;
  readiness: MethodReadinessState;
}

const warned = new Set<string>();

/**
 * Redact secrets and credential-bearing URLs before any developer diagnostic output.
 */
export function sanitizeDiagnosticText(value: string | undefined | null): string {
  if (!value) {
    return '';
  }
  return value
    .replace(/\b(sk|pk|rk)_(test|live)_[A-Za-z0-9]+/gi, '$1_$2_[redacted]')
    .replace(/\b(?:pi|seti)_[A-Za-z0-9]+_secret_[A-Za-z0-9]+/gi, '[redacted-client-secret]')
    .replace(/client-id=[^&\s]+/gi, 'client-id=[redacted]')
    .replace(/client_secret=[^&\s]+/gi, 'client_secret=[redacted]')
    .replace(/payment_intent_client_secret=[^&\s]+/gi, 'payment_intent_client_secret=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]');
}

export function resetProviderDiagnosticsForTests(): void {
  warned.clear();
}

/**
 * One development-console warning per provider+code.
 * Never logs customer cancellations or raw secrets.
 */
export function warnProviderDiagnostic(
  providerLabel: string,
  code: string,
  detail?: string,
): void {
  if (!isDevMode()) {
    return;
  }
  if (code === 'PAYMENT_CANCELLED') {
    return;
  }
  const key = `${providerLabel}:${code}`;
  if (warned.has(key)) {
    return;
  }
  warned.add(key);
  const safeDetail = sanitizeDiagnosticText(detail).trim();
  const extra = safeDetail ? `\n${safeDetail}` : '';
  console.warn(
    `[Easy Payments] ${providerLabel} initialization failed.\nCode: ${code}\nOther independent payment methods remain available.${extra}`,
  );
}

export function describeInitFailure(error: unknown): ProviderInitFailure {
  if (error instanceof PaymentError) {
    const config =
      error.code === 'CONFIG_MISSING' ||
      error.code === 'CONFIG_INVALID' ||
      error.code === 'PROVIDER_NOT_CONFIGURED';
    return {
      code: error.code,
      readiness: config ? 'misconfigured' : 'unavailable',
    };
  }
  return { code: 'SDK_LOAD_FAILED', readiness: 'unavailable' };
}

/** Failures that must not replace the whole checkout with the terminal error screen. */
export function isIsolatedProviderFailure(code: string | undefined): boolean {
  return (
    code === 'SDK_LOAD_FAILED' ||
    code === 'CONFIG_MISSING' ||
    code === 'CONFIG_INVALID' ||
    code === 'PROVIDER_NOT_CONFIGURED' ||
    code === 'PROVIDER_UNAVAILABLE' ||
    code === 'BACKEND_ERROR'
  );
}
