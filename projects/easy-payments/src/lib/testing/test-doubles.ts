export class FakeBrowserGuard {
  isBrowser = true;
  prefersDark = false;
  private readonly listeners = new Set<(event: MediaQueryListEvent) => void>();

  matchMedia(query: string): MediaQueryList {
    const guard = this;
    return {
      get matches() {
        return guard.prefersDark;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: EventListener) => {
        guard.listeners.add(listener as (event: MediaQueryListEvent) => void);
      },
      removeEventListener: (_type: string, listener: EventListener) => {
        guard.listeners.delete(listener as (event: MediaQueryListEvent) => void);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    } as MediaQueryList;
  }

  setPrefersDark(value: boolean): void {
    this.prefersDark = value;
    const event = { matches: value } as MediaQueryListEvent;
    this.listeners.forEach((listener) => listener(event));
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

  getLocalStorage(): Storage | null {
    return this.isBrowser ? localStorage : null;
  }
}

export const SAMPLE_PRODUCT = {
  id: 'premium-plan',
  name: 'Premium Plan',
  description: 'One year subscription',
  amount: 99.99,
  currency: 'USD',
  quantity: 1,
} as const;
