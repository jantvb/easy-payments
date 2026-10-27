import type { EasyPaymentsVisualStyle } from '../models/easy-payments-visual-style.model';

/**
 * Exact default stack previously hardcoded on `:host`.
 * Kept as the `--ep-font-family` default so typography does not change
 * unless `visualStyle.fontFamily` is set.
 */
export const DEFAULT_EP_FONT_FAMILY =
  "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

/** Max length for any single visualStyle string field. */
const MAX_VISUAL_STYLE_VALUE_LENGTH = 200;

/**
 * Reject CSS injection / statements. Values are applied as custom-property
 * contents on the host; they must be a single declaration value.
 */
const UNSAFE_CSS_VALUE =
  /[;{}<>]|\/\*|\*\/|url\s*\(|expression\s*\(|javascript:|@import|@charset|behavior\s*:/i;

const CSS_COLOR =
  /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*[\d.%\s,/+-]+\s*\)|hsla?\(\s*[\d.%\s,/+-]+\s*\)|transparent|currentcolor|[a-z]{1,30})$/i;

const CSS_LENGTH =
  /^(0|[-+]?(?:\d*\.\d+|\d+)(?:px|rem|em|%|ch|ex|vh|vw|vmin|vmax|cm|mm|in|pt|pc))$/i;

/**
 * Host-bound CSS custom property values derived from {@link EasyPaymentsVisualStyle}.
 * `null` means “do not set inline” so SCSS theme defaults remain in effect.
 */
export interface VisualStyleHostCssVars {
  fontFamily: string | null;
  textColor: string | null;
  textSecondaryColor: string | null;
  backgroundColor: string | null;
  surfaceColor: string | null;
  accentColor: string | null;
  borderRadius: string | null;
  spacing: string | null;
}

const EMPTY_HOST_VARS: VisualStyleHostCssVars = {
  fontFamily: null,
  textColor: null,
  textSecondaryColor: null,
  backgroundColor: null,
  surfaceColor: null,
  accentColor: null,
  borderRadius: null,
  spacing: null,
};

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isSafeCssValue(value: string): boolean {
  if (!value || value.length > MAX_VISUAL_STYLE_VALUE_LENGTH) {
    return false;
  }
  if (UNSAFE_CSS_VALUE.test(value)) {
    return false;
  }
  // Disallow control characters and unbalanced quotes noise.
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }
  return true;
}

function sanitizeColor(value: unknown): string | null {
  const raw = trimOrEmpty(value);
  if (!raw || !isSafeCssValue(raw) || !CSS_COLOR.test(raw)) {
    return null;
  }
  return raw;
}

function sanitizeLength(value: unknown): string | null {
  const raw = trimOrEmpty(value);
  if (!raw || !isSafeCssValue(raw) || !CSS_LENGTH.test(raw)) {
    return null;
  }
  return raw;
}

/**
 * Accept `'inherit'` or a conservative font-family list (names, quotes, commas,
 * weights tokens like `system-ui`). Rejects urls and multi-declaration payloads.
 */
function sanitizeFontFamily(value: unknown): string | null {
  const raw = trimOrEmpty(value);
  if (!raw || !isSafeCssValue(raw)) {
    return null;
  }
  if (raw.toLowerCase() === 'inherit') {
    return 'inherit';
  }
  // Letters, digits, spaces, commas, quotes, hyphens, and common CSS font idents.
  if (!/^[a-z0-9\s,'"_-]+$/i.test(raw)) {
    return null;
  }
  return raw;
}

/**
 * Map an optional {@link EasyPaymentsVisualStyle} to host CSS variable overrides.
 * Invalid or omitted fields become `null` (no inline override).
 */
export function resolveVisualStyleCssVars(
  style: EasyPaymentsVisualStyle | null | undefined,
): VisualStyleHostCssVars {
  if (style == null || typeof style !== 'object') {
    return { ...EMPTY_HOST_VARS };
  }

  return {
    fontFamily: sanitizeFontFamily(style.fontFamily),
    textColor: sanitizeColor(style.textColor),
    textSecondaryColor: sanitizeColor(style.textSecondaryColor),
    backgroundColor: sanitizeColor(style.backgroundColor),
    surfaceColor: sanitizeColor(style.surfaceColor),
    accentColor: sanitizeColor(style.accentColor),
    borderRadius: sanitizeLength(style.borderRadius),
    spacing: sanitizeLength(style.spacing),
  };
}
