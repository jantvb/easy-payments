import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { EasyPaymentsConfig } from './easy-payments.config';

export const EASY_PAYMENTS_CONFIG = new InjectionToken<EasyPaymentsConfig>('EASY_PAYMENTS_CONFIG');

export function provideEasyPayments(config: EasyPaymentsConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: EASY_PAYMENTS_CONFIG,
      useValue: config,
    },
  ]);
}
