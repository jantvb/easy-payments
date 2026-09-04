import { inject, Injectable } from '@angular/core';
import { BrowserGuard } from '../utils/browser-guard';

export interface SdkLoadOptions {
  id: string;
  src: string;
  async?: boolean;
  defer?: boolean;
  attributes?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class SdkLoaderService {
  private readonly browser = inject(BrowserGuard);
  private readonly loadedScripts = new Map<string, Promise<void>>();

  loadScript(options: SdkLoadOptions): Promise<void> {
    if (!this.browser.isBrowser) {
      return Promise.reject(new Error('SDK loading is only available in the browser.'));
    }

    const existing = this.loadedScripts.get(options.id);
    if (existing) {
      return existing;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const doc = this.browser.getDocument();
      if (!doc) {
        reject(new Error('Document is not available.'));
        return;
      }

      const existingScript = doc.getElementById(options.id);
      if (existingScript) {
        resolve();
        return;
      }

      const script = doc.createElement('script');
      script.id = options.id;
      script.src = options.src;
      script.async = options.async ?? true;
      script.defer = options.defer ?? false;

      if (options.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
          script.setAttribute(key, value);
        }
      }

      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load SDK: ${options.src}`));

      doc.head.appendChild(script);
    });

    this.loadedScripts.set(options.id, promise);
    return promise;
  }

  isLoaded(id: string): boolean {
    return this.loadedScripts.has(id);
  }
}
