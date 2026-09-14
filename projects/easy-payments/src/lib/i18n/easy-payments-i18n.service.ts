import { Injectable, computed, signal } from '@angular/core';
import type { EasyPaymentsLocale, EasyPaymentsResolvedLocale } from './locale.types';
import { resolveEffectiveLocale } from './locale-resolver';
import { resolveMessages } from './resolve-messages';
import type {
  EasyPaymentsTranslationKey,
  EasyPaymentsTranslationOverrides,
  EasyPaymentsTranslations,
} from './translations.types';
import { interpolate } from './translations.types';
import { formatMoney as formatMoneyBase, formatUnitAmount as formatUnitAmountBase } from '../utils/format-money';

/**
 * Per-checkout i18n context. Provided by `<easy-payments>` so child panels share
 * the same requested/effective locale and merged messages.
 */
@Injectable()
export class EasyPaymentsI18nService {
  private readonly requestedLocale = signal<EasyPaymentsLocale>('auto');
  private readonly overrides = signal<EasyPaymentsTranslationOverrides>({});

  readonly effectiveLocale = computed<EasyPaymentsResolvedLocale>(() =>
    resolveEffectiveLocale(this.requestedLocale()),
  );

  readonly messages = computed<EasyPaymentsTranslations>(() =>
    resolveMessages(this.effectiveLocale(), this.overrides()),
  );

  readonly requested = this.requestedLocale.asReadonly();

  setRequestedLocale(locale: EasyPaymentsLocale): void {
    this.requestedLocale.set(locale ?? 'auto');
  }

  setOverrides(overrides: EasyPaymentsTranslationOverrides | null | undefined): void {
    this.overrides.set(overrides ?? {});
  }

  t(
    key: EasyPaymentsTranslationKey,
    params?: Record<string, string | number | undefined | null>,
  ): string {
    const template = this.messages()[key];
    return params ? interpolate(template, params) : template;
  }

  formatMoney(amount: number, currency: string, quantity = 1): string {
    return formatMoneyBase(amount, currency, quantity, this.effectiveLocale());
  }

  formatUnitAmount(amount: number, currency: string): string {
    return formatUnitAmountBase(amount, currency, this.effectiveLocale());
  }
}
