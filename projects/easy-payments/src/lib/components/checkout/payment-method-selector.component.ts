import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  computed,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PaymentMethod, ResolvedPaymentTheme } from '../../models';
import { AvailablePaymentMethod } from '../../services/payment-orchestrator.service';
import { PaymentMethodTileComponent } from './payment-method-tile.component';

@Component({
  selector: 'easy-payment-method-selector',
  standalone: true,
  imports: [PaymentMethodTileComponent, NgTemplateOutlet],
  template: `
    <div class="ep-selector">
      <p class="ep-selector__label" id="ep-payment-methods-label">Payment methods</p>
      <div
        class="ep-selector__grid"
        role="radiogroup"
        aria-labelledby="ep-payment-methods-label"
        (keydown)="onKeydown($event)"
      >
        @for (entry of methods(); track entry.method) {
          @if (expressTemplates()[entry.method]; as expressTemplate) {
            <div class="ep-selector__express">
              <ng-container [ngTemplateOutlet]="expressTemplate" />
            </div>
          } @else {
            <easy-payment-method-tile
              [method]="entry.method"
              [theme]="theme()"
              [isMock]="entry.isMock"
              [selected]="entry.method === selected()"
              [disabled]="disabled()"
              (select)="onTileSelect(entry.method)"
            />
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .ep-selector__label {
        margin: 0 0 10px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ep-text-secondary, #64748b);
      }

      .ep-selector__grid {
        display: grid;
        gap: 10px;
        width: 100%;
        /*
          Columns follow the <easy-payments> container width (container queries),
          not the browser viewport — so sidebars / modals / CMS embeds layout correctly.
          Skip 4-column layouts for the common 6-method set to avoid awkward 4+2 rows.
        */
        grid-template-columns: minmax(0, 1fr);
      }

      /*
        Express slot (Apple Pay ECE): same cell footprint as a tile so the method
        keeps list proportions, but renders Stripe's own button (not a fake tile).
      */
      .ep-selector__express {
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        height: 88px;
        min-height: 88px;
        padding: 12px 10px;
        border-radius: var(--ep-radius-md, 10px);
        border: 1px solid var(--ep-border, #e2e8f0);
        background: var(--ep-surface, #ffffff);
      }

      .ep-selector__express > * {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        max-width: 100%;
      }

      /* ~2 usable tiles (≥ ~112px each + gap + padding) */
      @container ep-checkout (min-width: 360px) {
        .ep-selector__grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      /* Default polished layout at ~640px max-width → 3 × 2 */
      @container ep-checkout (min-width: 520px) {
        .ep-selector__grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      /* Comfortable single row for six methods (~112px tiles + gaps) */
      @container ep-checkout (min-width: 880px) {
        .ep-selector__grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodSelectorComponent {
  readonly methods = input.required<AvailablePaymentMethod[]>();
  readonly selected = input<PaymentMethod | null>(null);
  readonly theme = input<ResolvedPaymentTheme>('light');
  readonly disabled = input(false);
  /** Methods that render their own provider button in place of a selectable tile. */
  readonly expressTemplates = input<Partial<Record<PaymentMethod, TemplateRef<unknown>>>>({});
  readonly methodSelect = output<PaymentMethod>();

  private readonly tiles = viewChildren(PaymentMethodTileComponent, { read: ElementRef });

  /** Express slots are not radio options, so they stay out of keyboard navigation. */
  private readonly selectableMethods = computed(() => {
    const express = this.expressTemplates();
    return this.methods().filter((entry) => !express[entry.method]);
  });

  onTileSelect(method: PaymentMethod): void {
    if (this.disabled()) {
      return;
    }
    this.methodSelect.emit(method);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) {
      return;
    }
    const items = this.selectableMethods();
    if (items.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      0,
      items.findIndex((entry) => entry.method === this.selected()),
    );

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    this.methodSelect.emit(items[nextIndex].method);
    queueMicrotask(() => {
      const button = this.tiles()
        .at(nextIndex)
        ?.nativeElement?.querySelector('button') as HTMLButtonElement | null;
      button?.focus();
    });
  }
}
