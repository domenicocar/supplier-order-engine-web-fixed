import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

import { OrderItem } from '../../../models/order.models';
import { SupplierComparisonTableRow } from './order-detail-view.models';
import {
  formatPrice,
  formatSupplierOption,
  supplierAvailabilityLabel
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

      <div class="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
              Vista
            </span>
            <button
              type="button"
              class="rounded-full px-4 py-2 text-sm font-semibold transition"
              [class]="catalogViewMode() === 'all'
                ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                : 'border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'"
              (click)="setCatalogViewMode('all')"
            >
              Tutto il catalogo
            </button>
            <button
              type="button"
              class="rounded-full px-4 py-2 text-sm font-semibold transition"
              [class]="catalogViewMode() === 'ordered'
                ? 'bg-[var(--brand-primary)] text-white shadow-sm'
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

      <div class="mt-4">
        <input
          type="search"
          placeholder="Cerca per EAN, descrizione o fornitore..."
          class="app-input w-full"
          [value]="searchTerm()"
          (input)="onSearchChange($event)"
        />
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
            dataKey="ean"
            [rowTrackBy]="trackByEan"
            responsiveLayout="scroll"
          >
            <ng-template pTemplate="header">
              <tr>
                <th>EAN</th>
                <th>Descrizione</th>
                <th>Quantità</th>
                <th>Prezzo scelto</th>
                <th>Fornitori disponibili</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr>
                <td>{{ row.ean }}</td>
                <td>{{ row.description }}</td>
                <td class="min-w-32">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    class="app-input w-full rounded-xl px-3 py-2"
                    data-comparison-field="quantity"
                    [attr.data-comparison-ean]="row.ean"
                    [value]="row.quantity ?? ''"
                    (input)="onQuantityChange(row.ean, $event)"
                  />
                </td>
                <td class="min-w-56">
                  <span class="app-pill rounded-full px-3 py-2 text-xs">
                    {{ row.selectedSupplierName || 'Nessun fornitore' }}
                    @if (row.selectedSupplierName || row.selectedPrice !== null) {
                      {{ ' · ' + formatPrice(row.selectedPrice) + ' cad. · conf. ' + row.selectedPackageSize }}
                    }
                  </span>
                </td>
                <td class="min-w-56">
                  <div class="flex flex-col gap-2">
                    <select
                      class="app-input w-full rounded-xl px-3 py-2"
                      data-comparison-field="supplier"
                      [attr.data-comparison-ean]="row.ean"
                      [value]="row.selectedSupplierId"
                      [disabled]="row.availableSuppliers.length === 0"
                      (change)="onSelectionChange(row.ean, $event)"
                    >
                      @for (option of row.availableSuppliers; track option.supplierId) {
                        <option [value]="option.supplierId">
                          {{ formatSupplierOption(option) }}
                        </option>
                      }
                    </select>
                    <p class="px-1 text-xs text-[var(--app-text-muted)]">
                      {{ supplierAvailabilityLabel(row.availableSuppliers.length) }}
                    </p>
                  </div>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="5" class="px-4 py-5 text-sm text-[var(--app-text-muted)]">
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupplierComparisonTabComponent {
  readonly rows = input<SupplierComparisonTableRow[]>([]);
  readonly orderItems = input<OrderItem[]>([]);
  readonly loading = input(false);
  readonly requested = input(false);
  readonly error = input<string | null>(null);
  readonly hasSupplierUploads = input(false);

  readonly loadRequested = output<void>();
  readonly selectionChanged = output<{ ean: string; supplierId: string }>();
  readonly quantityChanged = output<{ ean: string; quantity: number | null }>();

  readonly searchTerm = signal('');
  readonly catalogViewMode = signal<'all' | 'ordered'>('all');
  readonly currentPage = signal(1);
  readonly orderedEans = computed(
    () =>
      new Set(
        this.orderItems()
          .map((item) => item.ean.trim())
          .filter((ean) => ean.length > 0)
      )
  );

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
      return this.filteredRows();
    }

    const orderedEans = this.orderedEans();
    return this.filteredRows().filter((row) => orderedEans.has(row.ean));
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
  readonly supplierAvailabilityLabel = supplierAvailabilityLabel;
  readonly trackByEan = (_index: number, row: SupplierComparisonTableRow) => row.ean;

  setCatalogViewMode(mode: 'all' | 'ordered'): void {
    this.catalogViewMode.set(mode);
    this.currentPage.set(1);
  }

  onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  onSelectionChange(ean: string, event: Event): void {
    const supplierId = (event.target as HTMLSelectElement).value;
    this.selectionChanged.emit({ ean, supplierId });
  }

  onQuantityChange(ean: string, event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value.trim();

    if (!rawValue) {
      this.quantityChanged.emit({ ean, quantity: null });
      return;
    }

    const numericValue = Number(rawValue);
    const quantity = Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : null;
    this.quantityChanged.emit({ ean, quantity });
  }

  goToPreviousPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  goToNextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
  }
}
