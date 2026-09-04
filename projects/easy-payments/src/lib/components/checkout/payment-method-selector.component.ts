import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { PaymentMethod, ResolvedPaymentTheme } from '../../models';
import { AvailablePaymentMethod } from '../../services/payment-orchestrator.service';
import { PaymentMethodTileComponent } from './payment-method-tile.component';

@Component({
  selector: 'easy-payment-method-selector',
  standalone: true,
  imports: [PaymentMethodTileComponent],
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
          <easy-payment-method-tile
            [method]="entry.method"
            [theme]="theme()"
            [isMock]="entry.isMock"
            [selected]="entry.method === selected()"
            [disabled]="disabled()"
            (select)="onTileSelect(entry.method)"
          />
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
  readonly methodSelect = output<PaymentMethod>();

  private readonly tiles = viewChildren(PaymentMethodTileComponent, { read: ElementRef });

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
    const items = this.methods();
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
