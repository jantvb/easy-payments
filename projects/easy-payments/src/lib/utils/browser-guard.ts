import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class BrowserGuard {
  private readonly platformId = inject(PLATFORM_ID);

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  getWindow(): Window | null {
    return this.isBrowser ? window : null;
  }

  getDocument(): Document | null {
    return this.isBrowser ? document : null;
  }

  getNavigator(): Navigator | null {
    return this.isBrowser ? navigator : null;
  }

  matchMedia(query: string): MediaQueryList | null {
    const win = this.getWindow();
    return win?.matchMedia?.(query) ?? null;
  }

  getLocalStorage(): Storage | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      return localStorage;
    } catch {
      return null;
    }
  }
}

export function isBrowserPlatform(platformId: object): boolean {
  return isPlatformBrowser(platformId);
}
