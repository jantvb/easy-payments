import { isDevMode } from '@angular/core';
import {
  resetProviderDiagnosticsForTests,
  sanitizeDiagnosticText,
  warnProviderDiagnostic,
} from './provider-diagnostics';

describe('provider diagnostics', () => {
  beforeEach(() => {
    resetProviderDiagnosticsForTests();
  });

  it('redacts secrets and credential query parameters', () => {
    // Assembled at runtime so the source file has no contiguous credential literals.
    const stripeSecretKey = ['sk', '_test_', 'example'].join('');
    const stripePublishableKey = ['pk', '_live_', 'example'].join('');
    const paypalClientId = 'example-paypal-client';
    const bearerToken = 'example.token';
    const paymentIntentSecret = ['pi', '_example_', 'secret', '_example'].join('');
    const raw = [
      'Failed to load SDK: https://example.test/sdk/js?client-id=',
      paypalClientId,
      '&currency=USD ',
      stripeSecretKey,
      ' ',
      stripePublishableKey,
      ' Bearer ',
      bearerToken,
      ' ',
      paymentIntentSecret,
      ' payment_intent_client_secret=',
      paymentIntentSecret,
    ].join('');

    const safe = sanitizeDiagnosticText(raw);

    expect(safe).not.toContain(paypalClientId);
    expect(safe).not.toContain(stripeSecretKey);
    expect(safe).not.toContain(stripePublishableKey);
    expect(safe).not.toContain(bearerToken);
    expect(safe).not.toContain(paymentIntentSecret);
    expect(safe).toContain('client-id=[redacted]');
    expect(safe).toContain(`${['sk', 'test'].join('_')}_[redacted]`);
    expect(safe).toContain(`${['pk', 'live'].join('_')}_[redacted]`);
    expect(safe).toContain('Bearer [redacted]');
    expect(safe).toContain('[redacted-client-secret]');
    expect(safe).toContain('payment_intent_client_secret=[redacted]');
  });

  it('warns once in development and never for cancellations', () => {
    if (!isDevMode()) {
      pending('development diagnostics are disabled outside dev mode');
      return;
    }
    const warn = spyOn(console, 'warn');
    const paypalClientId = 'example-paypal-client';
    warnProviderDiagnostic(
      'PayPal',
      'PAYPAL_SDK_INITIALIZATION_FAILED',
      `client-id=${paypalClientId}`,
    );
    warnProviderDiagnostic(
      'PayPal',
      'PAYPAL_SDK_INITIALIZATION_FAILED',
      `client-id=${paypalClientId}`,
    );
    warnProviderDiagnostic('PayPal', 'PAYMENT_CANCELLED', 'customer closed the sheet');

    expect(warn).toHaveBeenCalledTimes(1);
    const text = String(warn.calls.mostRecent().args[0]);
    expect(text).toContain('Code: PAYPAL_SDK_INITIALIZATION_FAILED');
    expect(text).toContain('Other independent payment methods remain available.');
    expect(text).toContain('client-id=[redacted]');
    expect(text).not.toContain(paypalClientId);
    expect(text).not.toContain('PAYMENT_CANCELLED');
  });
});
