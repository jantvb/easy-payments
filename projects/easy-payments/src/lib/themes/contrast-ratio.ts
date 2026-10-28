/**
 * WCAG 2.x relative luminance and contrast-ratio helpers for Easy Payments
 * developer diagnostics. No runtime dependency.
 *
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

/** WCAG AA minimum contrast for normal text. */
export const WCAG_AA_NORMAL_TEXT = 4.5;

/** WCAG AA minimum for large text and non-text UI components (e.g. focus rings). */
export const WCAG_AA_UI_OR_LARGE_TEXT = 3;

export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** 0–1; missing alpha is treated as opaque. */
  readonly a: number;
}

const NAMED_COLORS: Record<string, RgbColor> = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 },
  green: { r: 0, g: 128, b: 0, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 },
  yellow: { r: 255, g: 255, b: 0, a: 1 },
  orange: { r: 255, g: 165, b: 0, a: 1 },
  purple: { r: 128, g: 0, b: 128, a: 1 },
  gray: { r: 128, g: 128, b: 128, a: 1 },
  grey: { r: 128, g: 128, b: 128, a: 1 },
  silver: { r: 192, g: 192, b: 192, a: 1 },
  navy: { r: 0, g: 0, b: 128, a: 1 },
  teal: { r: 0, g: 128, b: 128, a: 1 },
  maroon: { r: 128, g: 0, b: 0, a: 1 },
  olive: { r: 128, g: 128, b: 0, a: 1 },
  lime: { r: 0, g: 255, b: 0, a: 1 },
  aqua: { r: 0, g: 255, b: 255, a: 1 },
  cyan: { r: 0, g: 255, b: 255, a: 1 },
  fuchsia: { r: 255, g: 0, b: 255, a: 1 },
  magenta: { r: 255, g: 0, b: 255, a: 1 },
  rebeccapurple: { r: 102, g: 51, b: 153, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

function channelToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance in 0–1 (WCAG). Alpha is ignored; composite first if needed. */
export function relativeLuminance(rgb: RgbColor): number {
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio ≥ 1 (WCAG). */
export function contrastRatio(foreground: RgbColor, background: RgbColor): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Source-over alpha composite of fg onto bg. */
export function compositeOver(fg: RgbColor, bg: RgbColor): RgbColor {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  return {
    r: clampByte((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
    g: clampByte((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
    b: clampByte((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
    a,
  };
}

export function isEffectivelyTransparent(color: RgbColor, epsilon = 0.01): boolean {
  return color.a <= epsilon;
}

export function isOpaqueEnoughForTextBackdrop(color: RgbColor, minAlpha = 0.98): boolean {
  return color.a >= minAlpha;
}

function parseHex(raw: string): RgbColor | null {
  const hex = raw.slice(1);
  if (!/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  if (hex.length === 3 || hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
    return { r, g, b, a };
  }
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  return null;
}

function parseRgbFunction(raw: string): RgbColor | null {
  const match = raw.match(/^rgba?\(\s*([\d.%\s,/+-]+)\s*\)$/i);
  if (!match) {
    return null;
  }
  const body = match[1].trim();
  const parts = body.includes(',')
    ? body.split(',').map((p) => p.trim())
    : body.split(/\s+/).filter(Boolean);
  // Modern "r g b / a"
  let alpha = 1;
  if (parts.length >= 4 && parts[3].startsWith('/')) {
    // unlikely
  }
  const slashIdx = parts.findIndex((p) => p === '/');
  let channels = parts;
  if (slashIdx >= 0) {
    channels = parts.slice(0, slashIdx);
    alpha = parseCssNumber(parts[slashIdx + 1] ?? '1', true) ?? 1;
  } else if (parts.length === 4) {
    channels = parts.slice(0, 3);
    alpha = parseCssNumber(parts[3], true) ?? 1;
  } else if (parts.length !== 3) {
    return null;
  }

  const r = parseRgbChannel(channels[0]);
  const g = parseRgbChannel(channels[1]);
  const b = parseRgbChannel(channels[2]);
  if (r == null || g == null || b == null) {
    return null;
  }
  return { r, g, b, a: alpha };
}

function parseRgbChannel(token: string | undefined): number | null {
  if (!token) {
    return null;
  }
  if (token.endsWith('%')) {
    const pct = Number.parseFloat(token);
    if (!Number.isFinite(pct)) {
      return null;
    }
    return clampByte((pct / 100) * 255);
  }
  const n = Number.parseFloat(token);
  if (!Number.isFinite(n)) {
    return null;
  }
  return clampByte(n);
}

function parseCssNumber(token: string, allowPercent: boolean): number | null {
  if (allowPercent && token.endsWith('%')) {
    const pct = Number.parseFloat(token);
    return Number.isFinite(pct) ? Math.min(1, Math.max(0, pct / 100)) : null;
  }
  const n = Number.parseFloat(token);
  return Number.isFinite(n) ? n : null;
}

function parseHslFunction(raw: string): RgbColor | null {
  const match = raw.match(/^hsla?\(\s*([\d.%a-z\s,/+-]+)\s*\)$/i);
  if (!match) {
    return null;
  }
  const body = match[1].trim();
  const normalized = body.replace(/\s*\/\s*/g, ' / ');
  const parts = normalized.includes(',')
    ? normalized.split(',').map((p) => p.trim())
    : normalized.split(/\s+/).filter(Boolean);

  let hTok: string;
  let sTok: string;
  let lTok: string;
  let a = 1;
  if (parts.includes('/')) {
    const idx = parts.indexOf('/');
    if (idx !== 3 || parts.length < 5) {
      return null;
    }
    [hTok, sTok, lTok] = parts;
    a = parseCssNumber(parts[4], true) ?? 1;
  } else if (parts.length === 4) {
    [hTok, sTok, lTok] = parts;
    a = parseCssNumber(parts[3], true) ?? 1;
  } else if (parts.length === 3) {
    [hTok, sTok, lTok] = parts;
  } else {
    return null;
  }

  const h = Number.parseFloat(hTok);
  const s = parseCssNumber(sTok.endsWith('%') ? sTok : `${sTok}%`, true);
  const l = parseCssNumber(lTok.endsWith('%') ? lTok : `${lTok}%`, true);
  if (!Number.isFinite(h) || s == null || l == null) {
    return null;
  }
  return { ...hslToRgb(h, s, l), a };
}

function hslToRgb(h: number, s: number, l: number): Omit<RgbColor, 'a'> {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hue < 60) {
    rp = c;
    gp = x;
  } else if (hue < 120) {
    rp = x;
    gp = c;
  } else if (hue < 180) {
    gp = c;
    bp = x;
  } else if (hue < 240) {
    gp = x;
    bp = c;
  } else if (hue < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return {
    r: clampByte((rp + m) * 255),
    g: clampByte((gp + m) * 255),
    b: clampByte((bp + m) * 255),
  };
}

/**
 * Parse a CSS color used by Easy Payments tokens / visualStyle.
 * Returns null for unresolved values (empty, var(), color-mix, unknown).
 * `'transparent'` parses to alpha 0.
 */
export function parseCssColor(value: string | null | undefined): RgbColor | null {
  if (value == null) {
    return null;
  }
  const raw = value.trim();
  if (!raw) {
    return null;
  }
  const lower = raw.toLowerCase();
  if (lower.startsWith('var(') || lower.includes('color-mix(') || lower.includes('oklch(')) {
    return null;
  }
  if (NAMED_COLORS[lower]) {
    return { ...NAMED_COLORS[lower] };
  }
  if (raw.startsWith('#')) {
    return parseHex(raw);
  }
  if (/^rgba?\(/i.test(raw)) {
    return parseRgbFunction(raw);
  }
  if (/^hsla?\(/i.test(raw)) {
    return parseHslFunction(raw);
  }
  return null;
}

/** Format RGB for diagnostic messages. */
export function formatRgb(rgb: RgbColor): string {
  if (rgb.a < 1) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Number(rgb.a.toFixed(3))})`;
  }
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/** Round contrast ratio for stable messages / tests. */
export function formatContrastRatio(ratio: number): string {
  return `${Math.round(ratio * 100) / 100}:1`;
}
