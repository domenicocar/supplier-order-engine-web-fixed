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
    <section class="surface-panel !rounded-none !border-0 !bg-transparent px-0 pb-28 pt-5 !shadow-none md:!rounded-2xl md:!border md:!bg-[var(--app-surface)] md:!p-8 md:!shadow-[var(--app-shadow)]">
      @if (readOnly()) {
        <div
          class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
        >
          Ordine storico chiuso
        </div>
      } @else {
      }

      @if (overview(); as currentOverview) {
        <div class="rounded-2xl border border-[var(--app-border)] bg-white p-4 shadow-sm md:p-6">
          <div class="grid grid-cols-[minmax(0,1.15fr)_minmax(7.5rem,0.85fr)] gap-3 md:grid-cols-[minmax(0,1fr)_minmax(13rem,0.45fr)] md:gap-6">
            <div>
              <p class="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--brand-secondary)]">
                Totale stimato
              </p>
              <p class="mt-1 break-words font-heading text-[1.75rem] font-semibold leading-none tracking-tight text-[var(--brand-primary)] md:text-[2.5rem]">
                {{ formatPrice(currentOverview.estimatedTotal) }}
              </p>
              <p class="mt-1 text-[0.68rem] text-[var(--app-text-muted)]">IVA esclusa</p>
            </div>

            <div class="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 md:px-5 md:py-4">
              <p class="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                Copertura ordine
              </p>
              <p class="mt-1 font-heading text-2xl font-semibold leading-none text-emerald-800">
                {{ coverageLabel(currentOverview) }}
              </p>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                <div
                  class="h-full rounded-full bg-emerald-600"
                  [style.width]="coverageLabel(currentOverview)"
                ></div>
              </div>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-3 border-t border-[var(--app-border)] pt-4 md:mt-6 md:pt-5">
            <div class="flex items-center gap-2">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                <i class="pi pi-box text-sm" aria-hidden="true"></i>
              </span>
              <div>
                <p class="font-heading text-lg font-semibold leading-none text-[var(--app-text)]">{{ currentOverview.productsCount }}</p>
                <p class="mt-1 text-[0.65rem] text-[var(--app-text-muted)]">Prodotti</p>
              </div>
            </div>
            <div class="flex items-center gap-2 border-x border-[var(--app-border)] px-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                <i class="pi pi-tag text-sm" aria-hidden="true"></i>
              </span>
              <div>
                <p class="font-heading text-lg font-semibold leading-none text-[var(--app-text)]">{{ currentOverview.totalQuantity }}</p>
                <p class="mt-1 text-[0.65rem] text-[var(--app-text-muted)]">Pezzi</p>
              </div>
            </div>
            <div class="flex items-center gap-2 pl-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                <i class="pi pi-shop text-sm" aria-hidden="true"></i>
              </span>
              <div>
                <p class="font-heading text-lg font-semibold leading-none text-[var(--app-text)]">{{ currentOverview.suppliersCount }}</p>
                <p class="mt-1 text-[0.65rem] text-[var(--app-text-muted)]">Fornitori</p>
              </div>
            </div>
          </div>
        </div>

        @if (
          currentOverview.missingItemsCount > 0 ||
          currentOverview.missingPricesCount > 0 ||
          currentOverview.missingQuantitiesCount > 0
        ) {
          <div class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-950 md:mt-6 md:p-5">
            <div class="flex items-start gap-3">
              <i class="pi pi-exclamation-triangle mt-0.5 text-xl text-amber-500" aria-hidden="true"></i>
              <div>
                <p class="text-xs font-semibold">Riepilogo stimato e non ancora completo.</p>
                <p class="mt-1 text-[0.68rem] text-amber-800">Ci sono ancora prodotti da assegnare o trovare.</p>
              </div>
            </div>
            <div class="mt-3 overflow-hidden rounded-xl border border-amber-100 bg-white md:grid md:grid-cols-2">
              @if (currentOverview.missingItemsCount > 0) {
                <div class="flex items-center gap-3 px-3 py-2.5">
                  <i class="pi pi-search text-amber-500" aria-hidden="true"></i>
                  <strong class="w-8 text-sm text-amber-600">{{ currentOverview.missingItemsCount }}</strong>
                  <span class="text-[0.68rem] text-[var(--app-text)]">Prodotti non trovati nei fornitori</span>
                </div>
              }
              @if (currentOverview.assignedItemsCount > 0) {
                <div class="flex items-center gap-3 border-t border-amber-100 px-3 py-2.5 md:border-l md:border-t-0">
                  <i class="pi pi-shop text-amber-500" aria-hidden="true"></i>
                  <strong class="w-8 text-sm text-amber-600">{{ currentOverview.assignedItemsCount }}</strong>
                  <span class="text-[0.68rem] text-[var(--app-text)]">Prodotti assegnati a un fornitore</span>
                </div>
              }
              @if (currentOverview.missingPricesCount > 0) {
                <div class="flex items-center gap-3 border-t border-amber-100 px-3 py-2.5">
                  <i class="pi pi-tag text-amber-500" aria-hidden="true"></i>
                  <strong class="w-8 text-sm text-amber-600">{{ currentOverview.missingPricesCount }}</strong>
                  <span class="text-[0.68rem] text-[var(--app-text)]">Prodotti senza prezzo</span>
                </div>
              }
              @if (currentOverview.missingQuantitiesCount > 0) {
                <div class="flex items-center gap-3 border-t border-amber-100 px-3 py-2.5 md:border-l">
                  <i class="pi pi-box text-amber-500" aria-hidden="true"></i>
                  <strong class="w-8 text-sm text-amber-600">{{ currentOverview.missingQuantitiesCount }}</strong>
                  <span class="text-[0.68rem] text-[var(--app-text)]">Prodotti senza quantità</span>
                </div>
              }
            </div>
          </div>

        }

        <div class="mt-8">
          <div
            class="sticky top-0 z-30 -mx-5 flex justify-end border-y border-[var(--app-border)] bg-white/95 px-5 py-3 shadow-[0_10px_24px_rgba(37,99,235,0.08)] backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none"
          >
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
            <ul class="mt-3 grid gap-2 md:mt-6 md:gap-8">
              @for (
                supplier of filteredSuppliers();
                track supplier.supplierId || supplier.supplierName
              ) {
                <li class="supplier-summary !mt-0 !border-t-0 !pt-0">
                  <div
                    class="sticky top-[4.25rem] z-20 -mx-1 mb-2 border-b border-[var(--app-border)] bg-white/95 px-1 pb-3 pt-2 shadow-[0_8px_18px_rgba(37,99,235,0.05)] backdrop-blur md:hidden"
                  >
                    <button
                      type="button"
                      class="flex w-full items-start justify-between gap-4 text-left"
                      [attr.aria-expanded]="isSupplierExpanded(supplier.supplierId || supplier.supplierName)"
                      (click)="toggleSupplier(supplier.supplierId || supplier.supplierName)"
                    >
                      <div class="min-w-0">
                        <div class="flex min-w-0 items-center gap-2">
                          <h4 class="truncate text-xl font-semibold text-[var(--app-text)]">
                            {{ supplier.supplierName }}
                          </h4>
                          <i
                            class="pi shrink-0 text-xs text-[var(--app-text-muted)] transition-transform"
                            [class.pi-chevron-down]="!isSupplierExpanded(supplier.supplierId || supplier.supplierName)"
                            [class.pi-chevron-up]="isSupplierExpanded(supplier.supplierId || supplier.supplierName)"
                            aria-hidden="true"
                          ></i>
                        </div>
                        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--app-text-muted)]">
                          <span>Prodotti: <strong class="text-[var(--app-text)]">{{ supplier.lineCount }}</strong></span>
                          <span>Pezzi: <strong class="text-[var(--app-text)]">{{ formatInteger(supplier.totalQuantity) }}</strong></span>
                        </div>
                      </div>

                      <div class="shrink-0 text-right">
                        <span class="block text-[0.65rem] font-medium text-[var(--app-text-muted)]">
                          Subtotale fornitore
                        </span>
                        <strong class="mt-1 block font-heading text-xl font-semibold text-[var(--brand-primary)]">
                          {{ formatEuro(supplier.subtotal) }}
                        </strong>
                      </div>
                    </button>
                  </div>

                  <div class="supplier-summary__header hidden md:flex">
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

                  <ul
                    class="grid gap-3 md:hidden"
                    [class.hidden]="!isSupplierExpanded(supplier.supplierId || supplier.supplierName)"
                  >
                    @for (item of supplier.items; track item.lineId) {
                      <li class="min-w-0 rounded-2xl border border-[var(--app-border)] bg-white p-4 shadow-sm">
                        <div class="flex min-w-0 items-start gap-3">
                          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                            <i class="pi pi-box text-lg" aria-hidden="true"></i>
                          </div>

                          <div class="min-w-0 flex-1">
                            <p class="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[var(--app-text-muted)]">
                              EAN / SKU
                            </p>
                            <p class="break-all text-xs text-[var(--app-text-muted)]">
                              {{ item.ean }}
                            </p>
                            <p class="mt-2 break-words text-sm font-semibold leading-snug text-[var(--app-text)]">
                              {{ item.description }}
                              @if (item.selectedBecausePreferredTie) {
                                <span
                                  class="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--app-success-border)] bg-[var(--app-success-bg)] text-[var(--app-success-text)] align-middle"
                                  title="Scelto per preferenza fornitore a parita di prezzo."
                                >
                                  <i class="pi pi-star-fill text-[0.6rem]" aria-hidden="true"></i>
                                </span>
                              }
                            </p>
                            @if (item.packageSize > 1) {
                              <p class="mt-1 text-xs text-[var(--app-text-muted)]">
                                Confezione da {{ item.packageSize }}
                              </p>
                            }
                          </div>
                        </div>

                        <div class="mt-4 grid grid-cols-3 border-t border-[var(--app-border)] pt-3">
                          <div class="min-w-0 pr-2">
                            <p class="flex items-center gap-1.5 text-[0.6rem] text-[var(--app-text-muted)]">
                              <i class="pi pi-box text-[var(--brand-primary)]" aria-hidden="true"></i>
                              Quantità
                            </p>
                            <p class="mt-1 font-semibold text-[var(--app-text)]">
                              {{ formatInteger(item.totalPieces) }}
                            </p>
                          </div>

                          <div class="min-w-0 border-x border-[var(--app-border)] px-3">
                            <p class="flex items-center gap-1.5 text-[0.6rem] text-[var(--app-text-muted)]">
                              <i class="pi pi-tag text-[var(--brand-primary)]" aria-hidden="true"></i>
                              Prezzo unit.
                            </p>
                            <p class="mt-1 break-words font-semibold text-[var(--app-text)]">
                              {{ formatEuro(item.unitPrice) }}
                            </p>
                          </div>

                          <div class="min-w-0 pl-3">
                            <p class="flex items-center gap-1.5 text-[0.6rem] text-[var(--app-text-muted)]">
                              <i class="pi pi-calculator text-[var(--brand-primary)]" aria-hidden="true"></i>
                              Subtotale
                            </p>
                            <p class="mt-1 break-words font-semibold text-[var(--brand-primary)]">
                              {{ formatEuro(item.lineTotal) }}
                            </p>
                          </div>
                        </div>
                      </li>
                    }
                  </ul>

                  <div class="supplier-table-shell hidden md:block">
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
                                @if (item.selectedBecausePreferredTie) {
                                  <span
                                    class="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--app-success-border)] bg-[var(--app-success-bg)] text-[var(--app-success-text)] align-middle"
                                    title="Scelto per preferenza fornitore a parita di prezzo."
                                  >
                                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                      <path
                                        d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.1 5.36a.56.56 0 0 0 .47.35l5.74.43a.56.56 0 0 1 .32.98l-4.37 3.74a.56.56 0 0 0-.18.56l1.33 5.6a.56.56 0 0 1-.84.61L12.3 18.2a.56.56 0 0 0-.6 0l-4.88 2.93a.56.56 0 0 1-.84-.61l1.33-5.6a.56.56 0 0 0-.18-.56L2.76 10.6a.56.56 0 0 1 .32-.98l5.74-.43a.56.56 0 0 0 .47-.35z"
                                      />
                                    </svg>
                                  </span>
                                }
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

              <ul class="mt-4 grid gap-3 md:hidden">
                @for (item of missingRows(); track item.lineId) {
                  <li class="min-w-0 rounded-2xl border border-[var(--app-border)] bg-white p-4 shadow-sm">
                    <div class="flex min-w-0 items-start gap-3">
                      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                        <i class="pi pi-exclamation-triangle text-base" aria-hidden="true"></i>
                      </div>

                      <div class="min-w-0 flex-1">
                        <p class="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[var(--app-text-muted)]">
                          EAN / SKU
                        </p>
                        <p class="break-all text-xs text-[var(--app-text-muted)]">
                          {{ item.ean }}
                        </p>
                        <p class="mt-2 break-words text-sm font-semibold leading-snug text-[var(--app-text)]">
                          {{ item.description }}
                        </p>
                        <p class="mt-1 break-words text-xs leading-5 text-[var(--app-text-muted)]">
                          {{
                            item.missingReason ||
                              'Prodotto non trovato nei fornitori caricati.'
                          }}
                        </p>
                      </div>
                    </div>

                    <div class="mt-4 flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-3">
                      <div>
                        <p class="text-[0.6rem] text-[var(--app-text-muted)]">Quantità</p>
                        <p class="mt-1 font-semibold text-[var(--app-text)]">
                          {{ formatInteger(item.quantity) }}
                        </p>
                      </div>

                      <button
                        type="button"
                        class="rounded-xl border border-[var(--app-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                        [disabled]="readOnly()"
                        (click)="associateToCatalogRequested.emit(item)"
                      >
                        Associa a catalogo
                      </button>
                    </div>
                  </li>
                }
              </ul>

              <div class="supplier-table-shell mt-4 hidden md:block">
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
  readonly expandedSuppliers = signal<Record<string, boolean>>({});

  isSupplierExpanded(supplierKey: string): boolean {
    if (this.searchProduct().trim().length > 0) {
      return true;
    }

    return this.expandedSuppliers()[supplierKey] ?? false;
  }

  toggleSupplier(supplierKey: string): void {
    this.expandedSuppliers.update((state) => ({
      ...state,
      [supplierKey]: !state[supplierKey],
    }));
  }

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
