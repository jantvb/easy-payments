import { isDevMode } from '@angular/core';
import {
  evaluateVisualStyleContrast,
  resolveEffectiveVisualColors,
  VisualStyleContrastWarningTracker,
} from './visual-style-contrast';

describe('visual-style-contrast', () => {
  it('keeps default light theme pairs above AA normal text', () => {
    const report = evaluateVisualStyleContrast({
      theme: 'light',
      appearance: 'default',
      style: null,
    });
    expect(report.failures.filter((f) => f.kind === 'normal-text')).toEqual([]);
  });

  it('keeps default dark theme pairs above AA normal text', () => {
    const report = evaluateVisualStyleContrast({
      theme: 'dark',
      appearance: 'default',
      style: null,
    });
    expect(report.failures.filter((f) => f.kind === 'normal-text')).toEqual([]);
  });

  it('flags poor normal-text contrast against an opaque surface', () => {
    const report = evaluateVisualStyleContrast({
      theme: 'light',
      appearance: 'default',
      style: {
        textColor: '#bbbbbb',
        surfaceColor: '#ffffff',
      },
    });
    const textFailure = report.failures.find((f) => f.id === 'text-on-shell');
    expect(textFailure).toBeTruthy();
    expect(textFailure!.minimum).toBe(4.5);
    expect(textFailure!.ratio).toBeLessThan(4.5);
    expect(textFailure!.foregroundCss).toBe('#bbbbbb');
    expect(textFailure!.backgroundCss).toBe('#ffffff');
  });

  it('does not invent a host page color for transparent backgrounds', () => {
    const report = evaluateVisualStyleContrast({
      theme: 'light',
      appearance: 'transparent',
      style: {
        textColor: '#000000',
        backgroundColor: 'transparent',
      },
    });
    expect(report.failures.some((f) => f.id === 'text-on-shell')).toBeFalse();
    expect(
      report.skips.some(
        (s) => s.reason === 'transparent-background' && s.propertyPair.includes('backgroundColor'),
      ),
    ).toBeTrue();
  });

  it('evaluates text against an opaque host background when appearance is transparent', () => {
    const report = evaluateVisualStyleContrast({
      theme: 'light',
      appearance: 'transparent',
      style: {
        textColor: '#cccccc',
        backgroundColor: '#ffffff',
      },
    });
    expect(report.failures.some((f) => f.id === 'text-on-shell')).toBeTrue();
    expect(report.skips.some((s) => s.reason === 'transparent-background')).toBeFalse();
  });

  it('uses the 3:1 threshold for focus / non-text UI checks', () => {
    const report = evaluateVisualStyleContrast({
      theme: 'light',
      appearance: 'default',
      style: {
        // Very light blue on white — fails 3:1 UI.
        accentColor: '#dbeafe',
        surfaceColor: '#ffffff',
        textColor: '#0f172a',
      },
    });
    const focusFailure = report.failures.find((f) => f.id === 'focus-on-shell');
    expect(focusFailure).toBeTruthy();
    expect(focusFailure!.kind).toBe('ui-non-text');
    expect(focusFailure!.minimum).toBe(3);
  });

  it('merges theme defaults with visualStyle overrides', () => {
    const colors = resolveEffectiveVisualColors('dark', {
      textColor: '#eeeeee',
      accentColor: '#00ff00',
    });
    expect(colors.text).toBe('#eeeeee');
    expect(colors.surface).toBe('#111827');
    expect(colors.accent).toBe('#00ff00');
    expect(colors.focus).toBe('#00ff00');
  });

  it('dedupes console warnings per tracker instance and isolates instances', () => {
    if (!isDevMode()) {
      pending('development diagnostics are disabled outside dev mode');
      return;
    }

    const warn = spyOn(console, 'warn');
    const info = spyOn(console, 'info');
    const report = evaluateVisualStyleContrast({
      theme: 'light',
      appearance: 'default',
      style: { textColor: '#cccccc', surfaceColor: '#ffffff' },
    });

    const a = new VisualStyleContrastWarningTracker();
    const b = new VisualStyleContrastWarningTracker();
    a.report(report);
    a.report(report);
    b.report(report);

    expect(warn.calls.count()).toBeGreaterThan(0);
    const firstPass = warn.calls.count();
    a.report(report);
    expect(warn.calls.count()).toBe(firstPass);
    // Second instance still emits its own warnings.
    expect(b.warnedKeys().size).toBeGreaterThan(0);
    expect(info).not.toHaveBeenCalled();
  });

  it('re-emits after a failing configuration returns following a fix', () => {
    if (!isDevMode()) {
      pending('development diagnostics are disabled outside dev mode');
      return;
    }

    const warn = spyOn(console, 'warn');
    const tracker = new VisualStyleContrastWarningTracker();
    const bad = evaluateVisualStyleContrast({
      theme: 'light',
      appearance: 'default',
      style: { textColor: '#cccccc', surfaceColor: '#ffffff' },
    });
    const good = evaluateVisualStyleContrast({
      theme: 'light',
      appearance: 'default',
      style: { textColor: '#111111', surfaceColor: '#ffffff' },
    });

    tracker.report(bad);
    const afterBad = warn.calls.count();
    expect(afterBad).toBeGreaterThan(0);
    tracker.report(good);
    expect(tracker.warnedKeys().size).toBe(0);
    tracker.report(bad);
    expect(warn.calls.count()).toBeGreaterThan(afterBad);
  });

  it('logs a transparent-background skip via console.info once', () => {
    if (!isDevMode()) {
      pending('development diagnostics are disabled outside dev mode');
      return;
    }
    const info = spyOn(console, 'info');
    const tracker = new VisualStyleContrastWarningTracker();
    const report = evaluateVisualStyleContrast({
      theme: 'light',
      appearance: 'transparent',
      style: { backgroundColor: 'transparent', textColor: '#000' },
    });
    tracker.report(report);
    tracker.report(report);
    expect(info.calls.count()).toBe(1);
    expect(String(info.calls.mostRecent().args[0])).toContain('Contrast check skipped');
  });
});
