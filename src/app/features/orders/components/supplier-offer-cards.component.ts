import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { SupplierComparisonOffer } from '../../../models/order.models';
import {
  sortSupplierOffersByPackPrice,
  supplierOfferPackageSize,
  supplierOfferPackPrice,
  supplierOfferUnitPrice
} from './order-detail-view.utils';

interface PricedSupplierOffer {
  offer: SupplierComparisonOffer;
  packPrice: number | null;
  unitPrice: number | null;
}

const COLLAPSED_OFFERS_LIMIT = 4;

@Component({
  selector: 'app-supplier-offer-cards',
  standalone: true,
  template: `
    @if (sortedOffers().length === 0) {
      <p class="rounded-2xl border border-dashed border-[var(--app-border)] px-3 py-3 text-xs text-[var(--app-text-muted)]">
        Nessun fornitore disponibile
      </p>
    } @else {
      <div class="supplier-offers">
        @for (pricedOffer of visibleOffers(); track pricedOffer.offer.supplierId) {
          <button
            type="button"
            class="supplier-offer-card"
            [class.supplier-offer-card--best]="isBest(pricedOffer)"
            [class.supplier-offer-card--selected]="isSelected(pricedOffer)"
            [attr.aria-pressed]="isSelected(pricedOffer)"
            (click)="selectOffer(pricedOffer)"
          >
            <span class="supplier-offer-card__header">
              <span class="supplier-offer-card__name">
                {{ pricedOffer.offer.supplierName }}
              </span>
              @if (isSelected(pricedOffer)) {
                <span class="supplier-offer-card__check">
                  <i class="pi pi-check" aria-hidden="true"></i>
                </span>
              }
            </span>

            <span class="supplier-offer-card__price">
              {{ formatCurrency(pricedOffer.unitPrice) }}
              <small>cad.</small>
            </span>
            <span class="supplier-offer-card__pack">
              {{ formatCurrency(pricedOffer.packPrice) }}
              <small>conf. {{ normalizedPackageSize(pricedOffer.offer) }}</small>
            </span>

            <span class="supplier-offer-card__footer">
              @if (isBest(pricedOffer)) {
                <span class="supplier-offer-card__best-label">
                  <i class="pi pi-star-fill" aria-hidden="true"></i>
                  Best price
                </span>
              } @else {
                <span class="supplier-offer-card__delta">
                  {{ formatDelta(pricedOffer) }}
                </span>
              }
            </span>
          </button>
        }
      </div>

      @if (hiddenOffersCount() > 0 || expanded()) {
        <button
          type="button"
          class="supplier-offers__toggle"
          (click)="expanded.set(!expanded())"
        >
          @if (expanded()) {
            Mostra meno
            <i class="pi pi-chevron-up" aria-hidden="true"></i>
          } @else {
            +{{ hiddenOffersCount() }}
            {{ hiddenOffersCount() === 1 ? 'alternativa' : 'alternative' }}
            <i class="pi pi-chevron-down" aria-hidden="true"></i>
          }
        </button>
      }
    }
  `,
  styles: [
    `
      .supplier-offers {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(7.75rem, 1fr));
        gap: 0.55rem;
        min-width: 34rem;
        width: 100%;
      }

      .supplier-offer-card {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 0.15rem;
        padding: 0.65rem 0.75rem;
        border: 1px solid #d7deea;
        border-radius: 0.85rem;
        background: #fff;
        color: #16213d;
        text-align: left;
        transition: 160ms ease;
      }

      .supplier-offer-card:hover {
        border-color: #9aa7bd;
        transform: translateY(-1px);
      }

      .supplier-offer-card--best {
        border-color: #8fc7a4;
        background: #f2faf5;
      }

      .supplier-offer-card--selected {
        border-width: 2px;
        border-color: #5b5ce2;
        background: #f4f4ff;
      }

      .supplier-offer-card--best.supplier-offer-card--selected {
        border-color: #357a50;
        background: #edf8f1;
      }

      .supplier-offer-card__header,
      .supplier-offer-card__footer {
        display: flex;
        min-height: 1.1rem;
        align-items: center;
        justify-content: space-between;
        gap: 0.4rem;
      }

      .supplier-offer-card__name {
        overflow: hidden;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.035em;
        text-overflow: ellipsis;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .supplier-offer-card__check {
        display: inline-flex;
        width: 1.1rem;
        height: 1.1rem;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: #5b5ce2;
        color: #fff;
        font-size: 0.58rem;
      }

      .supplier-offer-card--best .supplier-offer-card__check {
        background: #357a50;
      }

      .supplier-offer-card__price,
      .supplier-offer-card__pack {
        font-size: 0.78rem;
        font-weight: 750;
        line-height: 1.25;
      }

      .supplier-offer-card__pack {
        font-weight: 650;
      }

      .supplier-offer-card small {
        color: #64748b;
        font-size: 0.65rem;
        font-weight: 500;
      }

      .supplier-offer-card__best-label {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        color: #357a50;
        font-size: 0.62rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      .supplier-offer-card__best-label .pi {
        color: #d2a514;
        font-size: 0.6rem;
      }

      .supplier-offer-card__delta {
        margin-left: auto;
        color: #d35d35;
        font-size: 0.68rem;
        font-weight: 800;
      }

      .supplier-offers__toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.5rem;
        padding: 0.2rem 0.25rem;
        border: 0;
        background: transparent;
        color: #4456b8;
        font-size: 0.72rem;
        font-weight: 750;
      }

    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplierOfferCardsComponent {
  readonly offers = input<SupplierComparisonOffer[]>([]);
  readonly selectedSupplierId = input('');
  readonly selectionChanged = output<string>();
  readonly expanded = signal(false);

  readonly sortedOffers = computed<PricedSupplierOffer[]>(() =>
    sortSupplierOffersByPackPrice(this.offers()).map((offer) => ({
      offer,
      unitPrice: supplierOfferUnitPrice(offer),
      packPrice: supplierOfferPackPrice(offer)
    }))
  );

  readonly visibleOffers = computed(() =>
    this.expanded()
      ? this.sortedOffers()
      : this.sortedOffers().slice(0, COLLAPSED_OFFERS_LIMIT)
  );

  readonly hiddenOffersCount = computed(() =>
    Math.max(0, this.sortedOffers().length - COLLAPSED_OFFERS_LIMIT)
  );

  private readonly euroFormatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  normalizedPackageSize(offer: SupplierComparisonOffer): number {
    return supplierOfferPackageSize(offer);
  }

  isBest(pricedOffer: PricedSupplierOffer): boolean {
    return pricedOffer.offer.supplierId === this.sortedOffers()[0]?.offer.supplierId;
  }

  isSelected(pricedOffer: PricedSupplierOffer): boolean {
    const selectedId =
      this.selectedSupplierId() || this.sortedOffers()[0]?.offer.supplierId || '';
    return pricedOffer.offer.supplierId === selectedId;
  }

  priceDelta(pricedOffer: PricedSupplierOffer): number | null {
    const bestPrice = this.sortedOffers()[0]?.packPrice ?? null;

    if (bestPrice === null || pricedOffer.packPrice === null) {
      return null;
    }

    return Math.max(0, pricedOffer.packPrice - bestPrice);
  }

  formatDelta(pricedOffer: PricedSupplierOffer): string {
    const delta = this.priceDelta(pricedOffer);
    return delta === null ? 'Prezzo n/d' : `+${this.formatCurrency(delta)}`;
  }

  formatCurrency(value: number | null): string {
    return value === null ? '€ -' : this.euroFormatter.format(value);
  }

  selectOffer(pricedOffer: PricedSupplierOffer): void {
    if (pricedOffer.offer.supplierId !== this.selectedSupplierId()) {
      this.selectionChanged.emit(pricedOffer.offer.supplierId);
    }
  }
}
