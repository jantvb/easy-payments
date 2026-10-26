import { isDevMode } from '@angular/core';
import { resetProviderDiagnosticsForTests } from '../diagnostics/provider-diagnostics';
import { backendEndpointUrl, resolveBackendUrl } from './resolve-backend-url';

describe('resolveBackendUrl', () => {
  const endpoint = '/api/payments/create';

  it('A keeps a root-relative endpoint when baseUrl is omitted', () => {
    expect(resolveBackendUrl(undefined, endpoint)).toEqual({
      ok: true,
      url: '/api/payments/create',
    });
  });

  it('B joins an absolute http(s) baseUrl with a root-relative endpoint', () => {
    expect(resolveBackendUrl('https://api.example.com', endpoint)).toEqual({
      ok: true,
      url: 'https://api.example.com/api/payments/create',
    });
  });

  it('C ignores a trailing slash on baseUrl', () => {
    expect(resolveBackendUrl('https://api.example.com/', endpoint)).toEqual({
      ok: true,
      url: 'https://api.example.com/api/payments/create',
    });
  });

  it('D adds a single slash when the endpoint has no leading slash', () => {
    expect(resolveBackendUrl('https://api.example.com', 'api/payments/create')).toEqual({
      ok: true,
      url: 'https://api.example.com/api/payments/create',
    });
  });

  it('E lets an absolute http(s) endpoint override baseUrl', () => {
    expect(
      resolveBackendUrl('https://api.example.com', 'https://payments.other-provider.com/create'),
    ).toEqual({
      ok: true,
      url: 'https://payments.other-provider.com/create',
    });
  });

  it('F leaves a relative endpoint unchanged when baseUrl is omitted', () => {
    expect(resolveBackendUrl(undefined, 'api/payments/create')).toEqual({
      ok: true,
      url: 'api/payments/create',
    });
  });

  it('G keeps a path prefix on baseUrl', () => {
    expect(resolveBackendUrl('https://api.example.com/v1/', '/payments/create')).toEqual({
      ok: true,
      url: 'https://api.example.com/v1/payments/create',
    });
  });

  it('H preserves endpoint query parameters and fragments', () => {
    expect(
      resolveBackendUrl(
        'https://api.example.com/v1/',
        '/payments/create?product=premium&currency=USD#confirm',
      ),
    ).toEqual({
      ok: true,
      url: 'https://api.example.com/v1/payments/create?product=premium&currency=USD#confirm',
    });
  });

  it('I does not double-encode an already encoded endpoint', () => {
    const encoded = '/payments/create?q=a%20b&path=a%2Fb';
    const result = resolveBackendUrl('https://api.example.com', encoded);
    expect(result).toEqual({
      ok: true,
      url: 'https://api.example.com/payments/create?q=a%20b&path=a%2Fb',
    });
    if (result.ok) {
      expect(result.url).not.toContain('%2520');
      expect(result.url).not.toContain('%252F');
    }
  });

  it('J rejects javascript and data URL schemes', () => {
    expect(resolveBackendUrl(undefined, 'javascript:example')).toEqual({
      ok: false,
      code: 'invalid-endpoint',
    });
    expect(resolveBackendUrl('https://api.example.com', 'data:example')).toEqual({
      ok: false,
      code: 'invalid-endpoint',
    });
    expect(resolveBackendUrl('javascript:example', endpoint)).toEqual({
      ok: false,
      code: 'invalid-base-url',
    });
    expect(resolveBackendUrl('data:example', endpoint)).toEqual({
      ok: false,
      code: 'invalid-base-url',
    });
  });

  it('K rejects protocol-relative URLs instead of treating them as local paths', () => {
    expect(resolveBackendUrl(undefined, '//example.com/path')).toEqual({
      ok: false,
      code: 'invalid-endpoint',
    });
    expect(resolveBackendUrl('https://api.example.com', '//example.com/path')).toEqual({
      ok: false,
      code: 'invalid-endpoint',
    });
    expect(resolveBackendUrl('//example.com', endpoint)).toEqual({
      ok: false,
      code: 'invalid-base-url',
    });
  });

  it('L still rejects an unsafe absolute endpoint when baseUrl is valid', () => {
    const result = resolveBackendUrl('https://api.example.com', 'javascript:example');
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.code).toBe('invalid-endpoint');
    }
  });

  it('M does not rewrite existing endpoints when baseUrl is omitted', () => {
    expect(resolveBackendUrl(undefined, '/api/payments/create')).toEqual({
      ok: true,
      url: '/api/payments/create',
    });
    expect(resolveBackendUrl(null, 'https://api.example.com/api/payments/create')).toEqual({
      ok: true,
      url: 'https://api.example.com/api/payments/create',
    });
    expect(resolveBackendUrl('   ', 'api/payments/paypal/capture')).toEqual({
      ok: true,
      url: 'api/payments/paypal/capture',
    });
  });

  it('resolves every configured merchant endpoint', () => {
    const base = 'https://api.example.com';
    expect(resolveBackendUrl(base, '/api/payments/create').ok && resolveBackendUrl(base, '/api/payments/create')).toEqual({
      ok: true,
      url: 'https://api.example.com/api/payments/create',
    });
    expect(resolveBackendUrl(base, '/api/payments/paypal/create')).toEqual({
      ok: true,
      url: 'https://api.example.com/api/payments/paypal/create',
    });
    expect(resolveBackendUrl(base, '/api/payments/paypal/capture')).toEqual({
      ok: true,
      url: 'https://api.example.com/api/payments/paypal/capture',
    });
    expect(resolveBackendUrl(base, '/api/payments/klarna/create')).toEqual({
      ok: true,
      url: 'https://api.example.com/api/payments/klarna/create',
    });
    expect(resolveBackendUrl(base, '/api/payments/affirm/create')).toEqual({
      ok: true,
      url: 'https://api.example.com/api/payments/affirm/create',
    });
    expect(resolveBackendUrl(base, '/api/payments/confirm')).toEqual({
      ok: true,
      url: 'https://api.example.com/api/payments/confirm',
    });
  });

  it('does not read window, document, or location', () => {
    const source = resolveBackendUrl.toString();
    expect(source).not.toMatch(/\bwindow\b/);
    expect(source).not.toMatch(/\bdocument\b/);
    expect(source).not.toMatch(/\blocation\b/);
    expect(resolveBackendUrl(undefined, '/api/payments/create')).toEqual({
      ok: true,
      url: '/api/payments/create',
    });
  });
});

describe('backendEndpointUrl diagnostics', () => {
  beforeEach(() => {
    resetProviderDiagnosticsForTests();
  });

  it('does not warn when baseUrl is omitted', () => {
    if (!isDevMode()) {
      pending('development diagnostics are disabled outside dev mode');
      return;
    }
    const warn = spyOn(console, 'warn');
    expect(
      backendEndpointUrl({ createPaymentUrl: '/api/payments/create' }, '/api/payments/create'),
    ).toBe('/api/payments/create');
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns for an invalid baseUrl without including the value', () => {
    if (!isDevMode()) {
      pending('development diagnostics are disabled outside dev mode');
      return;
    }
    const warn = spyOn(console, 'warn');
    const unsafeBase = 'javascript:example';
    expect(
      backendEndpointUrl(
        { baseUrl: unsafeBase, createPaymentUrl: '/api/payments/create' },
        '/api/payments/create',
      ),
    ).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    const text = String(warn.calls.mostRecent().args[0]);
    expect(text).toContain('BACKEND_BASE_URL_INVALID');
    expect(text).not.toContain(unsafeBase);
  });

  it('warns for an invalid endpoint without including the value', () => {
    if (!isDevMode()) {
      pending('development diagnostics are disabled outside dev mode');
      return;
    }
    const warn = spyOn(console, 'warn');
    const unsafeEndpoint = 'data:example';
    expect(backendEndpointUrl({ createPaymentUrl: unsafeEndpoint }, unsafeEndpoint)).toBeUndefined();
    const text = String(warn.calls.mostRecent().args[0]);
    expect(text).toContain('BACKEND_ENDPOINT_INVALID');
    expect(text).not.toContain(unsafeEndpoint);
  });
});
