import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

import { SupplierComparisonTableRow } from './order-detail-view.models';
import {
  formatPrice,
  formatSupplierOption
} from './order-detail-view.utils';

const SUPPLIER_COMPARISON_PAGE_SIZE = 10;

@Component({
  selector: 'app-supplier-comparison-tab',
  standalone: true,
  imports: [ButtonModule, TableModule],
  template: `
    <section class="surface-panel p-6 md:p-7">
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div class="min-w-0">
          <p class="section-eyebrow">1. Confronto prodotti</p>
          <h2 class="section-title">Confronto prodotti fornitori</h2>
          <p class="section-copy">
            Ogni riga rappresenta un EAN trovato nei listini caricati. Puoi scegliere il
            fornitore più conveniente o quello più adatto.
          </p>
        </div>

        <div class="flex justify-start lg:justify-end">
          <button
            pButton
            type="button"
            class="app-primary-action min-w-52 justify-center !rounded-2xl !px-5 !py-3 !text-sm !font-semibold"
            [disabled]="!hasSupplierUploads() || loading()"
            (click)="loadRequested.emit()"
          >
            {{ loading() ? 'Confronto in corso...' : 'Confronta fornitori' }}
          </button>
        </div>
      </div>

      <div class="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          type="search"
          placeholder="Cerca per EAN, descrizione o fornitore..."
          class="app-input w-full lg:max-w-xl"
          [value]="searchTerm()"
          (input)="onSearchChange($event)"
        />

        <div class="flex flex-col gap-2 lg:items-end">
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-full px-4 py-2 text-sm font-semibold transition"
              [class]="catalogViewMode() === 'all'
                ? 'border border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                : 'border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'"
              (click)="setCatalogViewMode('all')"
            >
              Tutto il catalogo
            </button>
            <button
              type="button"
              class="rounded-full px-4 py-2 text-sm font-semibold transition"
              [class]="catalogViewMode() === 'ordered'
                ? 'border border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
                : 'border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'"
              (click)="setCatalogViewMode('ordered')"
            >
              Prodotti ordinati
            </button>
          </div>

          @if (loading()) {
            <p class="text-sm text-[var(--app-text-muted)]">Confronto fornitori in corso...</p>
          }
        </div>
      </div>

      @if (error()) {
        <div class="app-alert-error mt-4">
          {{ error() }}
        </div>
      }

      @if (!requested() && rows().length === 0) {
        <p class="mt-6 rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-[var(--app-text-muted)]">
          Carica i file fornitori, poi clicca Confronta per visualizzare la tabella prezzi.
        </p>
      } @else if (visibleRows().length === 0 && !loading()) {
        <p class="mt-6 rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-[var(--app-text-muted)]">
          {{ emptyStateMessage() }}
        </p>
      } @else {
        <div class="mt-6 overflow-hidden rounded-2xl border border-[var(--app-border)]">
          <p-table
            [value]="paginatedRows()"
            dataKey="lineId"
            [rowTrackBy]="trackByEan"
            responsiveLayout="scroll"
          >
            <ng-template pTemplate="header">
              <tr>
                <th>EAN</th>
                <th>Descrizione</th>
                <th>Fornitori disponibili</th>
                <th>Quantita</th>
                <th>Totale confezione</th>
                <th>Totale dovuto</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr>
                <td>
                  <div class="flex flex-col gap-1">
                    <span>{{ row.ean }}</span>
                    @if (row.lineType === 'catalog') {
                      <span class="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                        Catalogo
                      </span>
                    }
                  </div>
                </td>
                <td>{{ row.description }}</td>
                <td class="min-w-72">
                  <div class="flex flex-col gap-2">
                    <div class="comparison-supplier-select">
                      <div
                        class="comparison-supplier-select__card"
                        [class.comparison-supplier-select__card--active]="hasPositiveQuantity(row)"
                        [class.comparison-supplier-select__card--inactive]="
                          !hasPositiveQuantity(row) && row.availableSuppliers.length > 0
                        "
                        [class.comparison-supplier-select__card--with-badge]="
                          hasSupplierCountBadge(row)
                        "
                        [class.comparison-supplier-select__card--without-badge]="
                          !hasSupplierCountBadge(row)
                        "
                        [class.comparison-supplier-select__card--disabled]="
                          row.availableSuppliers.length === 0
                        "
                      >
                        <div
                          class="comparison-supplier-select__status"
                          [class.comparison-supplier-select__status--hidden]="
                            !hasPositiveQuantity(row) && row.availableSuppliers.length > 0
                          "
                        >
                          @if (hasPositiveQuantity(row)) {
                            <i class="pi pi-check"></i>
                          }
                        </div>

                        <div class="comparison-supplier-select__content">
                          <p class="comparison-supplier-select__name">
                            {{ row.selectedSupplierName || 'Nessun fornitore' }}
                          </p>
                          <p class="comparison-supplier-select__price">
                            {{ formatSupplierUnitPrice(row) }} cad.
                          </p>
                        </div>

                        @if (hasSupplierCountBadge(row)) {
                          <span class="comparison-supplier-select__badge">
                            {{ row.availableSuppliers.length }}
                          </span>
                        }
                      </div>

                      <select
                        class="comparison-supplier-select__native"
                        data-comparison-field="supplier"
                        [attr.data-comparison-line-id]="row.lineId"
                        [value]="row.selectedSupplierId"
                        [disabled]="row.availableSuppliers.length === 0"
                        (change)="onSelectionChange(row.lineId, $event)"
                      >
                        @for (option of row.availableSuppliers; track option.supplierId) {
                          <option [value]="option.supplierId">
                            {{ formatSupplierOption(option) }}
                          </option>
                        }
                      </select>
                    </div>
                  </div>
                </td>
                <td class="min-w-32">
                  <div class="comparison-quantity-cell">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      class="app-input comparison-quantity-cell__input rounded-xl px-3 py-2"
                      data-comparison-field="quantity"
                      [attr.data-comparison-line-id]="row.lineId"
                      [value]="row.quantity ?? ''"
                      (input)="onQuantityChange(row.lineId, $event)"
                    />
                    @if (canSplitRow(row)) {
                      <button
                        type="button"
                        class="comparison-availability__split-button comparison-quantity-cell__split-button"
                        aria-label="Fraziona riga"
                        title="Fraziona riga"
                        (click)="splitRequested.emit({ lineId: row.lineId })"
                      >
                        <svg
                          viewBox="0 0 311.495 311.495"
                          aria-hidden="true"
                          class="comparison-availability__split-icon"
                        >
                          <path
                            d="M303.748,0H187.251c-4.142,0-7.5,3.358-7.5,7.5v20c0,4.142,3.358,7.5,7.5,7.5h64.246l-82.301,82.302
                            c-1.407,1.406-2.197,3.314-2.197,5.303v181.39c0,4.142,3.358,7.5,7.5,7.5h20c4.142,0,7.5-3.358,7.5-7.5V133.996l74.248-74.248
                            v64.246c0,4.142,3.358,7.5,7.5,7.5h20c4.142,0,7.5-3.358,7.5-7.5V7.5C311.248,3.358,307.889,0,303.748,0z"
                            fill="currentColor"
                          />
                          <path
                            d="M59.998,35h64.246c4.142,0,7.5-3.358,7.5-7.5v-20c0-4.142-3.358-7.5-7.5-7.5H7.748
                            c-4.142,0-7.5,3.358-7.5,7.5v116.494c0,4.142,3.358,7.5,7.5,7.5h20c4.142,0,7.5-3.358,7.5-7.5V59.748l74.248,74.248v169.999
                            c0,4.142,3.358,7.5,7.5,7.5h20c4.142,0,7.5-3.358,7.5-7.5v-181.39c0-1.989-0.79-3.897-2.197-5.303L59.998,35z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    }
                  </div>
                </td>
                <td class="min-w-40">
                  <div class="comparison-pack-total">
                    {{ formatSupplierPackTotal(row) }}
                    <span class="comparison-pack-total__meta">
                      (conf. {{ row.selectedPackageSize }})
                    </span>
                  </div>
                </td>
                <td class="min-w-40">
                  <div class="comparison-total-due">
                    {{ formatSupplierTotalDue(row) }}
                  </div>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="6" class="px-4 py-5 text-sm text-[var(--app-text-muted)]">
                  Nessun prodotto corrisponde alla ricerca corrente.
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>

        <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-[var(--app-text-muted)]">{{ rangeLabel() }}</p>

          <div class="flex items-center gap-2">
            <button
              pButton
              type="button"
              class="btn-secondary justify-center !rounded-2xl !px-4 !py-2 !text-sm !font-semibold"
              [disabled]="currentPage() === 1"
              (click)="goToPreviousPage()"
            >
              Precedente
            </button>
            <span class="text-sm text-[var(--app-text-muted)]">
              Pagina {{ displayPage() }} di {{ totalPages() }}
            </span>
            <button
              pButton
              type="button"
              class="btn-secondary justify-center !rounded-2xl !px-4 !py-2 !text-sm !font-semibold"
              [disabled]="currentPage() >= totalPages()"
              (click)="goToNextPage()"
            >
              Successiva
            </button>
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .comparison-pack-total {
        color: #16213d;
        font-size: 0.95rem;
        font-weight: 600;
      }

      .comparison-total-due {
        color: #16213d;
        font-size: 0.95rem;
        font-weight: 700;
      }

      .comparison-pack-total__meta {
        color: #64748b;
        font-size: 0.8rem;
        font-weight: 400;
      }

      .comparison-supplier-select {
        position: relative;
      }

      .comparison-supplier-select__card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.6rem;
        min-height: 2.5rem;
        padding: 0.22rem 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 1.1rem;
        background: #ffffff;
        box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.08);
      }

      .comparison-supplier-select__card--active {
        border-color: #447a59;
        background: #f4f8f5;
        box-shadow: inset 0 0 0 1px rgba(68, 122, 89, 0.08);
      }

      .comparison-supplier-select__card--inactive {
        grid-template-columns: 0 minmax(0, 1fr) auto;
        gap: 0.35rem;
        border-color: #cbd5e1;
        background: #ffffff;
        box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.08);
      }

      .comparison-supplier-select__card--without-badge {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .comparison-supplier-select__card--inactive.comparison-supplier-select__card--without-badge {
        grid-template-columns: 0 minmax(0, 1fr);
      }

      .comparison-supplier-select__card--disabled {
        border-color: #cbd5e1;
        background: #f8fafc;
        box-shadow: none;
      }

      .comparison-supplier-select__status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        height: 1rem;
        border-radius: 999px;
        background: #e2e8f0;
        color: #64748b;
        font-size: 0.55rem;
      }

      .comparison-supplier-select__card--active .comparison-supplier-select__status {
        background: #447a59;
        color: #ffffff;
      }

      .comparison-supplier-select__status--hidden {
        width: 0;
        background: transparent;
        color: transparent;
      }

      .comparison-supplier-select__card--disabled .comparison-supplier-select__status {
        background: #cbd5e1;
        color: #64748b;
      }

      .comparison-supplier-select__content {
        min-width: 0;
      }

      .comparison-supplier-select__name {
        margin: 0;
        color: #16213d;
        font-size: 0.7rem;
        font-weight: 700;
        line-height: 1.1;
      }

      .comparison-supplier-select__card--active .comparison-supplier-select__name {
        color: #447a59;
      }

      .comparison-supplier-select__card--disabled .comparison-supplier-select__name {
        color: #64748b;
      }

      .comparison-supplier-select__price {
        margin: 0.02rem 0 0;
        color: #16213d;
        font-size: 0.7rem;
        font-weight: 500;
        line-height: 1.1;
      }

      .comparison-supplier-select__badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.65rem;
        height: 1.65rem;
        padding: 0 0.45rem;
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        background: #ffffff;
        color: #475569;
        font-size: 0.7rem;
        font-weight: 700;
      }

      .comparison-supplier-select__native {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
      }

      .comparison-supplier-select__native:disabled {
        cursor: not-allowed;
      }

      .comparison-availability {
        display: inline-flex;
        align-items: center;
        padding-inline: 0.25rem;
      }

      .comparison-availability__label {
        margin: 0;
        color: var(--app-text-muted);
        font-size: 0.75rem;
      }

      .comparison-availability__split-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.8rem;
        height: 1.8rem;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #5b6784;
        transition: background-color 160ms ease, color 160ms ease;
      }

      .comparison-availability__split-button:hover {
        background: rgba(91, 103, 132, 0.1);
        color: #2f3d60;
      }

      .comparison-availability__split-button:focus-visible {
        outline: 2px solid rgba(68, 122, 89, 0.28);
        outline-offset: 2px;
      }

      .comparison-availability__split-icon {
        width: 1.15rem;
        height: 1.15rem;
      }

      .comparison-quantity-cell {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }

      .comparison-quantity-cell__input {
        width: 100%;
        min-width: 0;
        max-width: 10.5rem;
      }

      .comparison-quantity-cell__split-button {
        flex: 0 0 auto;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplierComparisonTabComponent {
  readonly rows = input<SupplierComparisonTableRow[]>([]);
  readonly loading = input(false);
  readonly requested = input(false);
  readonly error = input<string | null>(null);
  readonly hasSupplierUploads = input(false);

  readonly loadRequested = output<void>();
  readonly selectionChanged = output<{ lineId: string; supplierId: string }>();
  readonly quantityChanged = output<{ lineId: string; quantity: number | null }>();
  readonly splitRequested = output<{ lineId: string }>();

  readonly searchTerm = signal('');
  readonly catalogViewMode = signal<'all' | 'ordered'>('all');
  readonly currentPage = signal(1);

  readonly filteredRows = computed(() => {
    const normalizedSearch = this.searchTerm().trim().toLowerCase();

    if (!normalizedSearch) {
      return this.rows();
    }

    return this.rows().filter((row) => {
      const eanMatch = row.ean.toLowerCase().includes(normalizedSearch);
      const descriptionMatch = row.description.toLowerCase().includes(normalizedSearch);
      const supplierMatch = row.availableSuppliers.some((option) =>
        option.supplierName.toLowerCase().includes(normalizedSearch)
      );

      return eanMatch || descriptionMatch || supplierMatch;
    });
  });

  readonly visibleRows = computed(() => {
    if (this.catalogViewMode() === 'all') {
      return this.filteredRows().filter((row) => row.lineType === 'catalog');
    }

    return this.filteredRows().filter((row) => row.lineType === 'order');
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.visibleRows().length / SUPPLIER_COMPARISON_PAGE_SIZE))
  );

  readonly displayPage = computed(() =>
    Math.min(Math.max(this.currentPage(), 1), this.totalPages())
  );

  readonly paginatedRows = computed(() => {
    const startIndex = (this.displayPage() - 1) * SUPPLIER_COMPARISON_PAGE_SIZE;

    return this.visibleRows().slice(startIndex, startIndex + SUPPLIER_COMPARISON_PAGE_SIZE);
  });

  readonly rangeLabel = computed(() => {
    const total = this.visibleRows().length;

    if (total === 0) {
      return 'Mostrati 0-0 di 0 prodotti';
    }

    const start = (this.displayPage() - 1) * SUPPLIER_COMPARISON_PAGE_SIZE + 1;
    const end = Math.min(start + this.paginatedRows().length - 1, total);

    return `Mostrati ${start}-${end} di ${total} prodotti`;
  });

  readonly emptyStateMessage = computed(() =>
    this.catalogViewMode() === 'ordered'
      ? 'Nessun prodotto ordinato è presente nel catalogo fornitori filtrato.'
      : 'Non sono stati trovati prodotti confrontabili nei file caricati.'
  );

  readonly formatPrice = formatPrice;
  readonly formatSupplierOption = formatSupplierOption;
  readonly trackByEan = (_index: number, row: SupplierComparisonTableRow) => row.lineId;
  private readonly euroFormatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  formatSupplierPackTotal(row: SupplierComparisonTableRow): string {
    if (row.selectedPrice === null) {
      return '€ -';
    }

    return this.euroFormatter.format(row.selectedPrice * row.selectedPackageSize);
  }

  formatSupplierUnitPrice(row: SupplierComparisonTableRow): string {
    if (row.selectedPrice === null) {
      return '€ -';
    }

    return this.euroFormatter.format(row.selectedPrice);
  }

  formatSupplierTotalDue(row: SupplierComparisonTableRow): string {
    if (row.selectedPrice === null || row.quantity === null) {
      return '€ -';
    }

    return this.euroFormatter.format(row.selectedPrice * row.selectedPackageSize * row.quantity);
  }

  setCatalogViewMode(mode: 'all' | 'ordered'): void {
    this.catalogViewMode.set(mode);
    this.currentPage.set(1);
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  hasPositiveQuantity(row: SupplierComparisonTableRow): boolean {
    return typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity > 0;
  }

  hasSupplierCountBadge(row: SupplierComparisonTableRow): boolean {
    return row.availableSuppliers.length > 1;
  }

  canSplitRow(row: SupplierComparisonTableRow): boolean {
    return (
      row.lineType === 'order' &&
      typeof row.quantity === 'number' &&
      row.quantity > 1 &&
      row.availableSuppliers.length >= 2
    );
  }

  onSelectionChange(lineId: string, event: Event): void {
    const supplierId = (event.target as HTMLSelectElement).value;
    this.selectionChanged.emit({ lineId, supplierId });
  }

  onQuantityChange(lineId: string, event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value.trim();

    if (!rawValue) {
      this.quantityChanged.emit({ lineId, quantity: null });
      return;
    }

    const numericValue = Number(rawValue);
    const quantity = Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : null;
    this.quantityChanged.emit({ lineId, quantity });
  }

  goToPreviousPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  goToNextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
  }
}
