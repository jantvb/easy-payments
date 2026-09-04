import { inject, Injectable } from '@angular/core';
import { PaymentProviderName } from '../models';
import { PaymentProviderAdapter } from './payment-provider.adapter';

@Injectable({ providedIn: 'root' })
export class AdapterRegistry {
  private readonly adapters = new Map<PaymentProviderName, PaymentProviderAdapter>();

  register(adapter: PaymentProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: PaymentProviderName): PaymentProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  getAll(): PaymentProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  clear(): void {
    this.adapters.clear();
  }
}

export function injectAdapterRegistry(): AdapterRegistry {
  return inject(AdapterRegistry);
}
