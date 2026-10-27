import {
  DEFAULT_EP_FONT_FAMILY,
  resolveVisualStyleCssVars,
} from './resolve-visual-style';

describe('resolveVisualStyleCssVars', () => {
  it('returns all nulls when style is absent', () => {
    expect(resolveVisualStyleCssVars(null)).toEqual({
      fontFamily: null,
      textColor: null,
      textSecondaryColor: null,
      backgroundColor: null,
      surfaceColor: null,
      accentColor: null,
      borderRadius: null,
      spacing: null,
    });
    expect(resolveVisualStyleCssVars(undefined)).toEqual(resolveVisualStyleCssVars(null));
    expect(resolveVisualStyleCssVars({})).toEqual(resolveVisualStyleCssVars(null));
  });

  it('maps valid explicit overrides', () => {
    const resolved = resolveVisualStyleCssVars({
      fontFamily: "'Roboto', sans-serif",
      textColor: '#112233',
      textSecondaryColor: 'rgb(100, 110, 120)',
      backgroundColor: 'transparent',
      surfaceColor: '#ffffff',
      accentColor: 'hsl(210, 80%, 45%)',
      borderRadius: '12px',
      spacing: '1.25rem',
    });

    expect(resolved).toEqual({
      fontFamily: "'Roboto', sans-serif",
      textColor: '#112233',
      textSecondaryColor: 'rgb(100, 110, 120)',
      backgroundColor: 'transparent',
      surfaceColor: '#ffffff',
      accentColor: 'hsl(210, 80%, 45%)',
      borderRadius: '12px',
      spacing: '1.25rem',
    });
  });

  it('supports fontFamily inherit as an explicit opt-in', () => {
    expect(resolveVisualStyleCssVars({ fontFamily: 'inherit' }).fontFamily).toBe('inherit');
    expect(resolveVisualStyleCssVars({ fontFamily: ' Inherit ' }).fontFamily).toBe('inherit');
  });

  it('exposes the default font stack constant for SCSS parity', () => {
    expect(DEFAULT_EP_FONT_FAMILY).toContain('Segoe UI');
    expect(DEFAULT_EP_FONT_FAMILY).toContain('system-ui');
    expect(DEFAULT_EP_FONT_FAMILY).toContain('sans-serif');
  });

  it('ignores invalid colors, lengths, and unsafe payloads', () => {
    const resolved = resolveVisualStyleCssVars({
      fontFamily: "Arial; background: url(javascript:alert(1))",
      textColor: 'red; color: blue',
      textSecondaryColor: 'expression(alert(1))',
      backgroundColor: 'url(https://evil.example/x.png)',
      surfaceColor: '',
      accentColor: '#gg0000',
      borderRadius: '12',
      spacing: 'calc(100vh)',
    });

    expect(resolved.fontFamily).toBeNull();
    expect(resolved.textColor).toBeNull();
    expect(resolved.textSecondaryColor).toBeNull();
    expect(resolved.backgroundColor).toBeNull();
    expect(resolved.surfaceColor).toBeNull();
    expect(resolved.accentColor).toBeNull();
    expect(resolved.borderRadius).toBeNull();
    expect(resolved.spacing).toBeNull();
  });

  it('accepts partial objects and keeps other fields null', () => {
    const resolved = resolveVisualStyleCssVars({
      textColor: '#0f172a',
      borderRadius: '0',
    });
    expect(resolved.textColor).toBe('#0f172a');
    expect(resolved.borderRadius).toBe('0');
    expect(resolved.fontFamily).toBeNull();
    expect(resolved.accentColor).toBeNull();
  });
});
