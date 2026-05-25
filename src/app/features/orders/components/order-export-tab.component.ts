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

        <button
          pButton
          type="button"
          class="justify-center !rounded-2xl !bg-[var(--brand-primary)] !px-6 !py-3 !text-sm !font-semibold !text-white"
          [disabled]="exporting()"
          (click)="exportRequested.emit()"
        >
          {{ exporting() ? 'Export in corso...' : 'Esporta ordine' }}
        </button>
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
              <p class="summary-hero__stat-value">{{ currentOverview.productsCount }}</p>
              <p class="summary-hero__stat-label">Products</p>
            </div>
            <div class="summary-hero__stat">
              <p class="summary-hero__stat-value">{{ currentOverview.totalQuantity }}</p>
              <p class="summary-hero__stat-label">Pieces</p>
            </div>
            <div class="summary-hero__stat">
              <p class="summary-hero__stat-value">{{ currentOverview.suppliersCount }}</p>
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
          <div class="rounded-3xl border border-slate-200 bg-white p-5">
            <div
              class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 class="panel-title">Per fornitore</h3>
                <span class="panel-copy">spaccato acquisti</span>
              </div>

              <input
                type="text"
                [ngModel]="searchProduct()"
                (ngModelChange)="searchProduct.set($event)"
                placeholder="Cerca prodotto per nome o EAN..."
                class="w-full sm:w-72 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--brand-primary)]"
              />
            </div>

            @if (filteredSuppliers().length === 0) {
              <p class="mt-4 text-sm text-slate-500">
                Nessun fornitore o prodotto corrispondente alla ricerca.
              </p>
            } @else {
              <ul class="mt-4 grid gap-4">
                @for (
                  supplier of filteredSuppliers();
                  track supplier.supplierId || supplier.supplierName
                ) {
                  <li
                    class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <p class="font-medium text-slate-950">
                          {{ supplier.supplierName }}
                        </p>
                        <p
                          class="mt-1 text-xs uppercase tracking-[0.15em] text-slate-400"
                        >
                          {{ supplier.supplierId || 'non assegnato' }}
                        </p>
                      </div>
                      <p class="text-lg font-semibold text-slate-950">
                        {{ formatPrice(supplier.subtotal) }}
                      </p>
                    </div>

                    <div class="mt-4 grid grid-cols-3 gap-3">
                      <div
                        class="rounded-2xl bg-white px-3 py-2 border border-slate-100"
                      >
                        <p
                          class="text-[11px] uppercase tracking-[0.14em] text-slate-400"
                        >
                          Prodotti Totali
                        </p>
                        <p class="mt-1 font-semibold text-slate-950">
                          {{ supplier.lineCount }}
                        </p>
                      </div>
                      <div
                        class="rounded-2xl bg-white px-3 py-2 border border-slate-100"
                      >
                        <p
                          class="text-[11px] uppercase tracking-[0.14em] text-slate-400"
                        >
                          Pezzi
                        </p>
                        <p class="mt-1 font-semibold text-slate-950">
                          {{ supplier.totalQuantity }}
                        </p>
                      </div>
                      <div
                        class="rounded-2xl bg-white px-3 py-2 border border-slate-100"
                      >
                        <p
                          class="text-[11px] uppercase tracking-[0.14em] text-slate-400"
                        >
                          Lacune
                        </p>
                        <p class="mt-1 font-semibold text-slate-950">
                          {{
                            supplier.missingPricesCount +
                              supplier.missingQuantitiesCount
                          }}
                        </p>
                      </div>
                    </div>

                    <div
                      class="mt-4 rounded-2xl border border-slate-200 bg-white p-3"
                    >
                      <p
                        class="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-400"
                      >
                        Cosa stai comprando da questo fornitore ({{
                          supplier.items.length
                        }})
                      </p>
                      <ul class="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
                        @for (item of supplier.items; track item.ean) {
                          <li
                            class="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 border border-slate-100"
                          >
                            <div>
                              <p class="font-medium text-slate-950">
                                {{ item.description }}
                              </p>
                              <p
                                class="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400"
                              >
                                {{ item.ean }}
                              </p>
                            </div>
                            <div class="text-right shrink-0">
                              <p class="font-medium text-slate-950">
                                x{{ item.quantity ?? '-' }} cart.
                                @if (item.packageSize > 1) {
                                  · conf. {{ item.packageSize }}
                                }
                              </p>
                              @if (item.totalPieces !== null) {
                                <p class="mt-1 text-xs text-slate-500">
                                  {{ item.totalPieces }} pezzi
                                </p>
                              }
                              <p class="mt-1 text-xs text-slate-500">
                                {{ formatPrice(item.lineTotal) }}
                              </p>
                            </div>
                          </li>
                        }
                      </ul>
                    </div>
                  </li>
                }
              </ul>
            }
          </div>
        </div>

        <div class="mt-8 rounded-3xl border border-slate-200 bg-white p-5">
          <div>
            <h3 class="panel-title">Prodotti non trovati</h3>
            <span class="panel-copy">
              sempre visibili nel riepilogo per completare l'ordine prima dell'export
            </span>
          </div>

          @if (missingRows().length === 0) {
            <div
              class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900"
            >
              Nessun prodotto mancante: tutti gli articoli dell'ordine risultano coperti dai fornitori caricati.
            </div>
          } @else {
            <div
              class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
            >
              <p class="font-semibold text-amber-950">
                {{ missingRows().length }} prodotti del tuo ordine non sono
                stati trovati tra i fornitori caricati.
              </p>
            </div>

            <div class="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <div
                class="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b border-slate-200 bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
              >
                <span>Prodotto</span>
                <span>Cartoni</span>
                <span>Pezzi</span>
              </div>
              <ul class="max-h-[420px] overflow-y-auto">
              @for (item of missingRows(); track item.ean) {
                <li
                  class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-4 border-b border-slate-200 px-4 py-3 last:border-b-0"
                >
                  <div class="min-w-0">
                    <p class="truncate font-semibold text-slate-950">{{ item.description }}</p>
                    <p class="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                      {{ item.ean }}
                    </p>
                    <p class="mt-2 text-sm text-amber-900">
                      {{ item.missingReason || 'Prodotto non trovato nei fornitori caricati.' }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-semibold text-slate-950">
                      {{ item.quantity ?? '-' }}
                    </p>
                    <p class="mt-1 text-xs text-slate-500">cartoni</p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-semibold text-slate-950">
                      {{ item.totalPieces ?? 0 }}
                    </p>
                    <p class="mt-1 text-xs text-slate-500">pezzi</p>
                  </div>
                </li>
              }
              </ul>
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
  readonly overview = input<OrderExportOverview | null>(null);
  readonly supplierSummary = input<SupplierExportSummary[]>([]);
  readonly summaryRows = input<OrderExportSummaryRow[]>([]);
  readonly missingRows = input<OrderExportSummaryRow[]>([]);
  readonly exportResult = input<OrderExportResult | undefined>(undefined);

  readonly exportRequested = output<void>();

  readonly formatPrice = formatPrice;
  readonly searchProduct = signal('');

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
