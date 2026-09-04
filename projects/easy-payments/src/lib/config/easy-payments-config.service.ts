import { inject, Injectable } from '@angular/core';
import { EasyPaymentsConfig } from './easy-payments.config';
import { EASY_PAYMENTS_CONFIG } from './provide-easy-payments';

/**
 * Mutable runtime config so demos (and hosts) can switch mock ↔ real Stripe
 * without rebuilding the injector tree.
 */
@Injectable({ providedIn: 'root' })
export class EasyPaymentsConfigService {
  private config: EasyPaymentsConfig;

  constructor() {
    const initial = inject(EASY_PAYMENTS_CONFIG, { optional: true });
    this.config = initial
      ? structuredClone(initial)
      : { providers: {}, enableMockMode: true };
  }

  getSnapshot(): EasyPaymentsConfig {
    return this.config;
  }

  update(partial: Partial<EasyPaymentsConfig>): EasyPaymentsConfig {
    this.config = {
      ...this.config,
      ...partial,
      providers: {
        ...this.config.providers,
        ...(partial.providers ?? {}),
      },
      backend: partial.backend
        ? { ...this.config.backend, ...partial.backend }
        : this.config.backend,
    };
    return this.config;
  }

  replace(config: EasyPaymentsConfig): EasyPaymentsConfig {
    this.config = structuredClone(config);
    return this.config;
  }
}
