import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { PaymentTheme, ResolvedPaymentTheme } from '../models';
import { BrowserGuard } from '../utils/browser-guard';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly browser = inject(BrowserGuard);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _theme = signal<PaymentTheme>('system');
  private readonly _resolvedTheme = signal<ResolvedPaymentTheme>('light');

  readonly theme = this._theme.asReadonly();
  readonly resolvedTheme = this._resolvedTheme.asReadonly();

  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((event: MediaQueryListEvent) => void) | null = null;
  private destroyHookRegistered = false;

  constructor() {
    this.updateResolvedTheme();
    this.setupSystemListener();
    this.registerDestroyHook();
  }

  setTheme(theme: PaymentTheme): void {
    this._theme.set(theme);
    this.updateResolvedTheme();
    this.setupSystemListener();
  }

  private updateResolvedTheme(): void {
    const theme = this._theme();

    if (theme === 'system') {
      const prefersDark = this.browser.matchMedia('(prefers-color-scheme: dark)')?.matches ?? false;
      this._resolvedTheme.set(prefersDark ? 'dark' : 'light');
      return;
    }

    this._resolvedTheme.set(theme);
  }

  private setupSystemListener(): void {
    this.teardownSystemListener();

    if (this._theme() !== 'system' || !this.browser.isBrowser) {
      return;
    }

    this.mediaQuery = this.browser.matchMedia('(prefers-color-scheme: dark)');
    if (!this.mediaQuery) {
      return;
    }

    this.mediaListener = () => this.updateResolvedTheme();
    this.mediaQuery.addEventListener('change', this.mediaListener);
  }

  private registerDestroyHook(): void {
    if (this.destroyHookRegistered) {
      return;
    }
    this.destroyHookRegistered = true;
    this.destroyRef.onDestroy(() => this.teardownSystemListener());
  }

  private teardownSystemListener(): void {
    if (this.mediaQuery && this.mediaListener) {
      this.mediaQuery.removeEventListener('change', this.mediaListener);
    }
    this.mediaQuery = null;
    this.mediaListener = null;
  }
}
