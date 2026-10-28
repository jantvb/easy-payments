import { isDevMode } from '@angular/core';
import type { EasyPaymentsAppearance } from '../models/easy-payments-appearance.model';
import type { EasyPaymentsVisualStyle } from '../models/easy-payments-visual-style.model';
import type { ResolvedPaymentTheme } from '../models/payment-theme.model';
import {
  compositeOver,
  contrastRatio,
  formatContrastRatio,
  formatRgb,
  isEffectivelyTransparent,
  isOpaqueEnoughForTextBackdrop,
  parseCssColor,
  type RgbColor,
  WCAG_AA_NORMAL_TEXT,
  WCAG_AA_UI_OR_LARGE_TEXT,
} from './contrast-ratio';
import { resolveVisualStyleCssVars } from './resolve-visual-style';

/** Theme token defaults mirroring easy-payments.component.scss (light / dark). */
export interface ThemeColorTokens {
  readonly text: string;
  readonly textSecondary: string;
  readonly background: string;
  readonly surface: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly focus: string;
}

export const LIGHT_THEME_COLORS: ThemeColorTokens = {
  text: '#0f172a',
  textSecondary: '#64748b',
  background: 'transparent',
  surface: '#ffffff',
  accent: '#2563eb',
  accentSoft: '#eff6ff',
  focus: '#2563eb',
};

export const DARK_THEME_COLORS: ThemeColorTokens = {
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  background: 'transparent',
  surface: '#111827',
  accent: '#60a5fa',
  accentSoft: 'rgba(96, 165, 250, 0.12)',
  focus: '#93c5fd',
};

export type ContrastCheckKind = 'normal-text' | 'ui-non-text';

export interface ContrastFailure {
  readonly id: string;
  readonly kind: ContrastCheckKind;
  readonly propertyPair: string;
  readonly foregroundCss: string;
  readonly backgroundCss: string;
  readonly ratio: number;
  readonly minimum: number;
}

export interface ContrastSkip {
  readonly id: string;
  readonly propertyPair: string;
  readonly reason: 'transparent-background' | 'unresolved-color';
  readonly detail: string;
}

export interface VisualStyleContrastReport {
  readonly failures: readonly ContrastFailure[];
  readonly skips: readonly ContrastSkip[];
}

export interface EffectiveVisualColors {
  readonly text: string;
  readonly textSecondary: string;
  readonly background: string;
  readonly surface: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly focus: string;
}

export function themeColorsFor(theme: ResolvedPaymentTheme): ThemeColorTokens {
  return theme === 'dark' ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;
}

/**
 * Merge theme defaults with sanitized visualStyle overrides (same effective
 * colors the host CSS variables would use).
 */
export function resolveEffectiveVisualColors(
  theme: ResolvedPaymentTheme,
  style: EasyPaymentsVisualStyle | null | undefined,
): EffectiveVisualColors {
  const base = themeColorsFor(theme);
  const overrides = resolveVisualStyleCssVars(style);
  return {
    text: overrides.textColor ?? base.text,
    textSecondary: overrides.textSecondaryColor ?? base.textSecondary,
    background: overrides.backgroundColor ?? base.background,
    surface: overrides.surfaceColor ?? base.surface,
    accent: overrides.accentColor ?? base.accent,
    accentSoft: overrides.accentSoft ?? base.accentSoft,
    focus: overrides.accentColor ?? base.focus,
  };
}

function pushFailure(
  failures: ContrastFailure[],
  id: string,
  kind: ContrastCheckKind,
  propertyPair: string,
  foregroundCss: string,
  backgroundCss: string,
  fg: RgbColor,
  bg: RgbColor,
): void {
  const minimum = kind === 'normal-text' ? WCAG_AA_NORMAL_TEXT : WCAG_AA_UI_OR_LARGE_TEXT;
  const ratio = contrastRatio(fg, bg);
  if (ratio + 1e-9 >= minimum) {
    return;
  }
  failures.push({
    id,
    kind,
    propertyPair,
    foregroundCss,
    backgroundCss,
    ratio,
    minimum,
  });
}

function resolveBackdrop(
  appearance: EasyPaymentsAppearance,
  colors: EffectiveVisualColors,
  skips: ContrastSkip[],
  checkId: string,
  propertyPair: string,
): { css: string; rgb: RgbColor } | null {
  // Default shell paints text on --ep-surface.
  // Transparent shell paints text on the host --ep-background (often transparent).
  const css = appearance === 'transparent' ? colors.background : colors.surface;
  const parsed = parseCssColor(css);
  if (!parsed) {
    skips.push({
      id: `${checkId}:unresolved`,
      propertyPair,
      reason: 'unresolved-color',
      detail: `Could not parse background color "${css}". Contrast was not estimated.`,
    });
    return null;
  }
  if (isEffectivelyTransparent(parsed) || !isOpaqueEnoughForTextBackdrop(parsed)) {
    skips.push({
      id: `${checkId}:transparent`,
      propertyPair,
      reason: 'transparent-background',
      detail:
        appearance === 'transparent'
          ? 'appearance="transparent" (or a transparent host background) leaves the underlying page color unknown. Contrast was not estimated.'
          : `Background "${css}" is transparent or translucent; the underlying page color is unknown. Contrast was not estimated.`,
    });
    return null;
  }
  return { css, rgb: parsed };
}

/**
 * Soft accent fill as used for selected tiles: accent at ~14% over the surface.
 * Prefer compositing over parsing color-mix() strings.
 */
export function resolveAccentSoftAgainstSurface(
  accentCss: string,
  surfaceCss: string,
): { css: string; rgb: RgbColor } | null {
  const accent = parseCssColor(accentCss);
  const surface = parseCssColor(surfaceCss);
  if (!accent || !surface || isEffectivelyTransparent(surface)) {
    return null;
  }
  const tint: RgbColor = { ...accent, a: 0.14 };
  const rgb = compositeOver(tint, { ...surface, a: 1 });
  return {
    css: `color-mix(in srgb, ${accentCss} 14%, ${surfaceCss})`,
    rgb,
  };
}

/**
 * Evaluate Easy Payments–owned text / surface / accent / focus pairs.
 * Does not inspect provider SDK chrome. Never mutates colors.
 */
export function evaluateVisualStyleContrast(options: {
  theme: ResolvedPaymentTheme;
  appearance: EasyPaymentsAppearance;
  style?: EasyPaymentsVisualStyle | null;
}): VisualStyleContrastReport {
  const colors = resolveEffectiveVisualColors(options.theme, options.style);
  const failures: ContrastFailure[] = [];
  const skips: ContrastSkip[] = [];

  const shellBackdrop = resolveBackdrop(
    options.appearance,
    colors,
    skips,
    'shell-backdrop',
    options.appearance === 'transparent'
      ? 'textColor / backgroundColor'
      : 'textColor / surfaceColor',
  );

  if (shellBackdrop) {
    const text = parseCssColor(colors.text);
    const textSecondary = parseCssColor(colors.textSecondary);
    const accent = parseCssColor(colors.accent);
    const focus = parseCssColor(colors.focus);

    if (text) {
      pushFailure(
        failures,
        'text-on-shell',
        'normal-text',
        options.appearance === 'transparent'
          ? 'visualStyle.textColor vs host background'
          : 'visualStyle.textColor vs surface',
        colors.text,
        shellBackdrop.css,
        text,
        shellBackdrop.rgb,
      );
    } else {
      skips.push({
        id: 'text:unresolved',
        propertyPair: 'textColor',
        reason: 'unresolved-color',
        detail: `Could not parse text color "${colors.text}".`,
      });
    }

    if (textSecondary) {
      pushFailure(
        failures,
        'text-secondary-on-shell',
        'normal-text',
        options.appearance === 'transparent'
          ? 'visualStyle.textSecondaryColor vs host background'
          : 'visualStyle.textSecondaryColor vs surface',
        colors.textSecondary,
        shellBackdrop.css,
        textSecondary,
        shellBackdrop.rgb,
      );
    }

    // Accent used as link / emphasis text on the shell surface.
    if (accent && options.appearance === 'default') {
      pushFailure(
        failures,
        'accent-text-on-surface',
        'normal-text',
        'visualStyle.accentColor (as text) vs surface',
        colors.accent,
        shellBackdrop.css,
        accent,
        shellBackdrop.rgb,
      );
    }

    // Focus ring against the shell surface (non-text UI → 3:1).
    if (focus) {
      pushFailure(
        failures,
        'focus-on-shell',
        'ui-non-text',
        'visualStyle.accentColor / focus vs surface or host background',
        colors.focus,
        shellBackdrop.css,
        focus,
        shellBackdrop.rgb,
      );
    }
  }

  // Selected method tile: primary text on soft accent over surface.
  const soft = resolveAccentSoftAgainstSurface(colors.accent, colors.surface);
  const textOnSoft = parseCssColor(colors.text);
  if (soft && textOnSoft) {
    pushFailure(
      failures,
      'text-on-accent-soft',
      'normal-text',
      'visualStyle.textColor vs selected-tile accent soft fill',
      colors.text,
      soft.css,
      textOnSoft,
      soft.rgb,
    );
  } else if (!soft) {
    skips.push({
      id: 'accent-soft:unresolved',
      propertyPair: 'accentColor / surfaceColor',
      reason: 'unresolved-color',
      detail:
        'Selected-tile accent soft fill could not be resolved against a known opaque surface; that pair was skipped.',
    });
  }

  return { failures, skips };
}

function failureKey(failure: ContrastFailure): string {
  return [
    failure.id,
    failure.foregroundCss,
    failure.backgroundCss,
    failure.minimum,
    formatContrastRatio(failure.ratio),
  ].join('|');
}

function skipKey(skip: ContrastSkip): string {
  return `${skip.id}|${skip.reason}|${skip.detail}`;
}

/**
 * Per-checkout-instance tracker: warns in development only, dedupes identical
 * messages, and drops stale keys when the visual configuration improves.
 */
export class VisualStyleContrastWarningTracker {
  private readonly warned = new Set<string>();

  /** Test helper. */
  reset(): void {
    this.warned.clear();
  }

  /** Keys currently remembered (tests). */
  warnedKeys(): ReadonlySet<string> {
    return this.warned;
  }

  report(report: VisualStyleContrastReport): void {
    if (!isDevMode()) {
      return;
    }

    const active = new Set<string>();

    for (const failure of report.failures) {
      const key = failureKey(failure);
      active.add(key);
      if (this.warned.has(key)) {
        continue;
      }
      this.warned.add(key);
      const fgParsed = parseCssColor(failure.foregroundCss);
      const fgLabel = fgParsed
        ? `${failure.foregroundCss} (${formatRgb(fgParsed)})`
        : failure.foregroundCss;
      console.warn(
        [
          '[Easy Payments] Low contrast in Easy Payments–owned UI (developer warning only).',
          `Pair: ${failure.propertyPair}`,
          `Foreground: ${fgLabel}`,
          `Background: ${failure.backgroundCss}`,
          `Contrast ratio: ${formatContrastRatio(failure.ratio)}`,
          `Recommended minimum (${failure.kind === 'normal-text' ? 'WCAG AA normal text' : 'WCAG AA non-text UI'}): ${failure.minimum}:1`,
          'Colors were not changed. Checkout was not blocked. This is not a full WCAG audit.',
        ].join('\n'),
      );
    }

    for (const skip of report.skips) {
      // Only surface transparent/unknown backdrop skips (actionable for merchants).
      if (skip.reason !== 'transparent-background') {
        continue;
      }
      const key = skipKey(skip);
      active.add(key);
      if (this.warned.has(key)) {
        continue;
      }
      this.warned.add(key);
      console.info(
        [
          '[Easy Payments] Contrast check skipped (developer notice only).',
          `Pair: ${skip.propertyPair}`,
          skip.detail,
          'Easy Payments does not guess underlying host page colors.',
        ].join('\n'),
      );
    }

    for (const key of [...this.warned]) {
      if (!active.has(key)) {
        this.warned.delete(key);
      }
    }
  }
}
