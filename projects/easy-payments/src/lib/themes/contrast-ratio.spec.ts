import {
  compositeOver,
  contrastRatio,
  formatContrastRatio,
  isEffectivelyTransparent,
  parseCssColor,
  relativeLuminance,
  WCAG_AA_NORMAL_TEXT,
  WCAG_AA_UI_OR_LARGE_TEXT,
} from './contrast-ratio';

describe('contrast-ratio', () => {
  it('parses common CSS color formats', () => {
    expect(parseCssColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parseCssColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseCssColor('#112233aa')?.a).toBeCloseTo(170 / 255, 3);
    expect(parseCssColor('rgb(17, 34, 51)')).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(parseCssColor('rgba(17, 34, 51, 0.5)')?.a).toBeCloseTo(0.5, 5);
    expect(parseCssColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor('transparent')?.a).toBe(0);
    expect(parseCssColor('rebeccapurple')).toEqual({ r: 102, g: 51, b: 153, a: 1 });
  });

  it('returns null for unresolved or unsupported colors', () => {
    expect(parseCssColor('')).toBeNull();
    expect(parseCssColor('var(--ep-text)')).toBeNull();
    expect(parseCssColor('color-mix(in srgb, red 50%, blue)')).toBeNull();
    expect(parseCssColor('not-a-color')).toBeNull();
  });

  it('computes known WCAG contrast ratios', () => {
    const black = parseCssColor('#000000')!;
    const white = parseCssColor('#ffffff')!;
    expect(contrastRatio(black, white)).toBeCloseTo(21, 2);
    expect(relativeLuminance(black)).toBeCloseTo(0, 5);
    expect(relativeLuminance(white)).toBeCloseTo(1, 5);

    // Near-boundary: #767676 on white ≈ 4.54:1 (passes AA normal).
    const gray = parseCssColor('#767676')!;
    expect(contrastRatio(gray, white)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);

    // #777777 on white ≈ 4.48:1 (fails AA normal, passes 3:1 UI).
    const lighterGray = parseCssColor('#777777')!;
    const ratio = contrastRatio(lighterGray, white);
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_UI_OR_LARGE_TEXT);
  });

  it('composites translucent colors and detects transparency', () => {
    const tint = { r: 0, g: 0, b: 255, a: 0.14 };
    const surface = { r: 255, g: 255, b: 255, a: 1 };
    const mixed = compositeOver(tint, surface);
    expect(mixed.a).toBeCloseTo(1, 5);
    expect(mixed.b).toBeGreaterThan(mixed.r);
    expect(isEffectivelyTransparent(parseCssColor('transparent')!)).toBeTrue();
    expect(formatContrastRatio(4.5)).toBe('4.5:1');
  });
});
