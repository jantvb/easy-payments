import { TestBed } from '@angular/core/testing';
import { BrowserGuard } from '../utils/browser-guard';
import { ThemeService } from './theme.service';
import { FakeBrowserGuard } from '../testing/test-doubles';

describe('ThemeService', () => {
  let browser: FakeBrowserGuard;
  let theme: ThemeService;

  beforeEach(() => {
    browser = new FakeBrowserGuard();
    TestBed.configureTestingModule({
      providers: [{ provide: BrowserGuard, useValue: browser }],
    });
    theme = TestBed.inject(ThemeService);
  });

  it('resolves light theme', () => {
    theme.setTheme('light');
    expect(theme.theme()).toBe('light');
    expect(theme.resolvedTheme()).toBe('light');
  });

  it('resolves dark theme', () => {
    theme.setTheme('dark');
    expect(theme.theme()).toBe('dark');
    expect(theme.resolvedTheme()).toBe('dark');
  });

  it('resolves system theme from prefers-color-scheme', () => {
    browser.prefersDark = true;
    theme.setTheme('system');
    expect(theme.resolvedTheme()).toBe('dark');

    browser.prefersDark = false;
    theme.setTheme('system');
    expect(theme.resolvedTheme()).toBe('light');
  });

  it('updates when the system color scheme changes', () => {
    browser.prefersDark = false;
    theme.setTheme('system');
    expect(theme.resolvedTheme()).toBe('light');

    browser.setPrefersDark(true);
    expect(theme.resolvedTheme()).toBe('dark');
  });
});
