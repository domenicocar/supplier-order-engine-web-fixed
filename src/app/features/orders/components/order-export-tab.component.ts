import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';

import { OrderExportResult } from '../../../models/order.models';
import {
  OrderExportOverview,
  OrderExportSummaryRow,
  SupplierExportSummary,
} from './order-detail-view.models';
import { formatPrice } from './order-detail-view.utils';

@Component({
  selector: 'app-order-export-tab',
  standalone: true,
  imports: [ButtonModule, FormsModule],
  template: `
    <section class="surface-panel p-8">
      <div
        class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
      >
        <div>
          <p class="section-eyebrow">1. Export</p>
          <h2 class="section-title">Riepilogo ordine</h2>
          <p class="section-copy">
            Vista finale dell'ordine con totale stimato, copertura fornitori e
            prodotti da completare prima dell'export.
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          @if (readOnly()) {
            <div
              class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
            >
              Ordine storico chiuso
            </div>
          } @else {
            <button
              pButton
              type="button"
              class="justify-center !rounded-2xl !bg-[var(--brand-primary)] !px-6 !py-3 !text-sm !font-semibold !text-white"
              [disabled]="exporting() || closing()"
              (click)="exportRequested.emit()"
            >
              {{ exporting() ? 'Export in corso...' : 'Esporta ordine' }}
            </button>

            <button
              pButton
              type="button"
              class="justify-center !rounded-2xl !bg-emerald-600 !px-6 !py-3 !text-sm !font-semibold !text-white"
              [disabled]="exporting() || closing()"
              (click)="closeRequested.emit()"
            >
              {{ closing() ? 'Chiusura in corso...' : 'Chiudi ordine' }}
            </button>
          }
        </div>
      </div>

      @if (overview(); as currentOverview) {
        <div class="summary-hero mt-8">
          <div class="summary-hero__primary">
            <p class="summary-hero__eyebrow">Estimated total</p>
            <div class="summary-hero__primary-row">
              <p class="summary-hero__amount">
                {{ formatPrice(currentOverview.estimatedTotal) }}
              </p>
              <span class="summary-hero__caption">VAT excl.</span>
            </div>
          </div>

          <div class="summary-hero__divider" aria-hidden="true"></div>

          <div class="summary-hero__stats">
            <div class="summary-hero__stat">
              <p class="summary-hero__stat-value">
                {{ currentOverview.productsCount }}
              </p>
              <p class="summary-hero__stat-label">Products</p>
            </div>
            <div class="summary-hero__stat">
              <p class="summary-hero__stat-value">
                {{ currentOverview.totalQuantity }}
              </p>
              <p class="summary-hero__stat-label">Pieces</p>
            </div>
            <div class="summary-hero__stat">
              <p class="summary-hero__stat-value">
                {{ currentOverview.suppliersCount }}
              </p>
              <p class="summary-hero__stat-label">Suppliers</p>
            </div>
          </div>

          <div class="summary-hero__divider" aria-hidden="true"></div>

          <div class="summary-hero__highlight">
            <p class="summary-hero__highlight-label">Copertura ordine</p>
            <p class="summary-hero__highlight-value">
              {{ coverageLabel(currentOverview) }}
            </p>
          </div>
        </div>

        @if (
          currentOverview.missingItemsCount > 0 ||
          currentOverview.missingPricesCount > 0 ||
          currentOverview.missingQuantitiesCount > 0
        ) {
          <div
            class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
          >
            <p class="font-semibold text-amber-950">
              Riepilogo stimato e non ancora completo.
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              @if (currentOverview.missingItemsCount > 0) {
                <span
                  class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900"
                >
                  {{ currentOverview.missingItemsCount }} prodotti non trovati
                  nei fornitori
                </span>
              }
              @if (currentOverview.assignedItemsCount > 0) {
                <span
                  class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900"
                >
                  {{ currentOverview.assignedItemsCount }} prodotti assegnati a
                  un fornitore
                </span>
              }
              @if (currentOverview.missingPricesCount > 0) {
                <span
                  class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900"
                >
                  {{ currentOverview.missingPricesCount }} prodotti senza prezzo
                </span>
              }
              @if (currentOverview.missingQuantitiesCount > 0) {
                <span
                  class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900"
                >
                  {{ currentOverview.missingQuantitiesCount }} prodotti senza
                  quantita
                </span>
              }
            </div>
          </div>
        }

        <div class="mt-8">
          <div class="flex justify-end">
            <input
              type="text"
              [ngModel]="searchProduct()"
              (ngModelChange)="searchProduct.set($event)"
              placeholder="Cerca prodotto per nome o EAN..."
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--brand-primary)] sm:w-72"
            />
          </div>

          @if (filteredSuppliers().length === 0) {
            <p class="mt-4 text-sm text-slate-500">
              Nessun fornitore o prodotto corrispondente alla ricerca.
            </p>
          } @else {
            <ul class="mt-6 grid gap-8">
              @for (
                supplier of filteredSuppliers();
                track supplier.supplierId || supplier.supplierName
              ) {
                <li class="supplier-summary">
                  <div class="supplier-summary__header">
                    <div class="supplier-summary__meta">
                      <h4 class="supplier-summary__title">
                        {{ supplier.supplierName }}
                      </h4>
                      <p class="supplier-summary__stats">
                        <span>Prodotti: {{ supplier.lineCount }}</span>
                        <span
                          >Pezzi: {{ formatInteger(supplier.totalQuantity) }}</span
                        >
                      </p>
                    </div>

                    <div class="supplier-summary__subtotal">
                      <span class="supplier-summary__subtotal-label"
                        >Subtotale Fornitore</span
                      >
                      <strong class="supplier-summary__subtotal-value">
                        {{ formatEuro(supplier.subtotal) }}
                      </strong>
                    </div>
                  </div>

                  <div class="supplier-table-shell">
                    <div class="supplier-table supplier-table--supplier">
                      <div class="supplier-table__head">
                        <span>EAN / SKU</span>
                        <span>Descrizione prodotto</span>
                        <span class="text-right">Quantita</span>
                        <span class="text-right">Prezzo unit.</span>
                        <span class="text-right">Subtotale</span>
                      </div>

                      <ul class="supplier-table__body">
                        @for (item of supplier.items; track item.lineId) {
                          <li class="supplier-table__row">
                            <div
                              class="supplier-table__cell supplier-table__cell--ean"
                            >
                              {{ item.ean }}
                            </div>

                            <div
                              class="supplier-table__cell supplier-table__cell--description"
                            >
                              <p class="supplier-table__product-name">
                                {{ item.description }}
                              </p>
                              @if (item.packageSize > 1) {
                                <p class="supplier-table__product-meta">
                                  Confezione da {{ item.packageSize }}
                                </p>
                              }
                            </div>

                            <div
                              class="supplier-table__cell supplier-table__cell--number"
                            >
                              {{ formatInteger(item.totalPieces) }}
                            </div>

                            <div
                              class="supplier-table__cell supplier-table__cell--currency"
                            >
                              {{ formatEuro(item.unitPrice) }}
                            </div>

                            <div
                              class="supplier-table__cell supplier-table__cell--subtotal"
                            >
                              {{ formatEuro(item.lineTotal) }}
                            </div>
                          </li>
                        }
                      </ul>
                    </div>
                  </div>
                </li>
              }
            </ul>
          }
        </div>

        <div class="mt-8">
          @if (missingRows().length === 0) {
            <div
              class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900"
            >
              Nessun prodotto mancante: tutti gli articoli dell'ordine
              risultano coperti dai fornitori caricati.
            </div>
          } @else {
            <div class="missing-summary">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div class="missing-summary__intro">
                  <i
                    class="pi pi-exclamation-triangle missing-summary__icon"
                    aria-hidden="true"
                  ></i>
                  <div>
                    <p class="missing-summary__title">
                      Prodotti non trovati ({{ missingRows().length }})
                    </p>
                    <p class="missing-summary__copy">
                      Questi articoli non sono stati associati ad alcun fornitore.
                    </p>
                  </div>
                </div>

                <button
                  pButton
                  type="button"
                  class="btn-secondary justify-center self-start !rounded-2xl !px-4 !py-2.5 !text-sm !font-semibold"
                  (click)="missingProductsExportRequested.emit()"
                >
                  Esporta mancanti (.csv)
                </button>
              </div>

              <div class="supplier-table-shell mt-4">
                <div class="supplier-table supplier-table--missing">
                  <div class="supplier-table__head">
                    <span>EAN / SKU</span>
                    <span>Descrizione prodotto</span>
                    <span class="text-right">Quantita</span>
                    <span class="text-right">Azioni</span>
                  </div>

                  <ul class="supplier-table__body">
                    @for (item of missingRows(); track item.lineId) {
                      <li class="supplier-table__row supplier-table__row--missing">
                        <div
                          class="supplier-table__cell supplier-table__cell--ean"
                        >
                          {{ item.ean }}
                        </div>

                        <div
                          class="supplier-table__cell supplier-table__cell--description"
                        >
                          <p class="supplier-table__product-name">
                            {{ item.description }}
                          </p>
                          <p class="supplier-table__product-meta">
                            {{
                              item.missingReason ||
                                'Prodotto non trovato nei fornitori caricati.'
                            }}
                          </p>
                        </div>

                        <div
                          class="supplier-table__cell supplier-table__cell--number"
                        >
                          {{ formatInteger(item.quantity) }}
                        </div>

                        <div
                          class="supplier-table__cell supplier-table__cell--action"
                        >
                          <button
                            type="button"
                            class="supplier-table__action-button"
                            [disabled]="readOnly()"
                            (click)="associateToCatalogRequested.emit(item)"
                          >
                            Associa a catalogo
                          </button>
                        </div>
                      </li>
                    }
                  </ul>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <p
          class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500"
        >
          Il riepilogo ordine si popola quando hai i prodotti confrontati con i
          fornitori: qui vedrai spesa stimata, cosa stai prendendo e da chi
          prima dell'export.
        </p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderExportTabComponent {
  readonly exporting = input(false);
  readonly closing = input(false);
  readonly readOnly = input(false);
  readonly overview = input<OrderExportOverview | null>(null);
  readonly supplierSummary = input<SupplierExportSummary[]>([]);
  readonly summaryRows = input<OrderExportSummaryRow[]>([]);
  readonly missingRows = input<OrderExportSummaryRow[]>([]);
  readonly exportResult = input<OrderExportResult | undefined>(undefined);

  readonly exportRequested = output<void>();
  readonly missingProductsExportRequested = output<void>();
  readonly closeRequested = output<void>();
  readonly associateToCatalogRequested = output<OrderExportSummaryRow>();

  readonly formatPrice = formatPrice;
  readonly searchProduct = signal('');

  private readonly euroFormatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  private readonly integerFormatter = new Intl.NumberFormat('it-IT', {
    maximumFractionDigits: 0,
  });

  formatEuro(value: number | null): string {
    if (value === null) {
      return '€ -';
    }

    return this.euroFormatter.format(value);
  }

  formatInteger(value: number | null): string {
    if (value === null) {
      return '-';
    }

    return this.integerFormatter.format(value);
  }

  coverageLabel(overview: OrderExportOverview): string {
    if (overview.productsCount <= 0) {
      return '0%';
    }

    return `${Math.round((overview.assignedItemsCount / overview.productsCount) * 100)}%`;
  }

  readonly filteredSuppliers = computed(() => {
    const term = this.searchProduct().toLowerCase().trim();
    const suppliers = this.supplierSummary();

    if (!term) {
      return suppliers;
    }

    return suppliers
      .map((supplier) => ({
        ...supplier,
        items: supplier.items.filter(
          (item) =>
            item.description?.toLowerCase().includes(term) ||
            item.ean?.toLowerCase().includes(term),
        ),
      }))
      .filter((supplier) => supplier.items.length > 0);
  });
}
