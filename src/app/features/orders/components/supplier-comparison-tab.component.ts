import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

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
    <section class="surface-panel p-8">
      <p class="section-eyebrow">1. Confronto prodotti</p>
      <h2 class="section-title">Confronto prodotti fornitori</h2>
      <p class="section-copy">
        Ogni riga rappresenta un EAN trovato nei listini caricati. Puoi scegliere il
        fornitore piu conveniente o quello piu adatto.
      </p>

      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          pButton
          type="button"
          class="justify-center !rounded-2xl !bg-slate-950 !px-5 !py-3 !text-sm !font-semibold !text-white"
          [disabled]="!hasSupplierUploads() || loading()"
          (click)="loadRequested.emit()"
        >
          {{ loading() ? 'Confronto in corso...' : 'Confronta fornitori' }}
        </button>

        @if (loading()) {
          <p class="text-sm text-slate-500">Confronto fornitori in corso...</p>
        }
      </div>

      <div class="mt-4">
        <input
          type="search"
          placeholder="Cerca per EAN, descrizione o fornitore..."
          class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
          [value]="searchTerm()"
          (input)="onSearchChange($event)"
        />
      </div>

      @if (error()) {
        <div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {{ error() }}
        </div>
      }

      @if (!requested() && rows().length === 0) {
        <p class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
          Carica i file fornitori, poi clicca Confronta per visualizzare la tabella prezzi.
        </p>
      } @else if (filteredRows().length === 0 && !loading()) {
        <p class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
          Non sono stati trovati prodotti confrontabili nei file caricati.
        </p>
      } @else {
        <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <p-table [value]="paginatedRows()" responsiveLayout="scroll">
            <ng-template pTemplate="header">
              <tr>
                <th>EAN</th>
                <th>Descrizione</th>
                <th>Quantita</th>
                <th>Prezzo scelto (miglior prezzo)</th>
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
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                    [value]="row.quantity ?? ''"
                    (input)="onQuantityChange(row.ean, $event)"
                  />
                </td>
                <td class="min-w-56">
                  <span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                    {{ row.selectedSupplierName || 'Nessun fornitore' }}
                    @if (row.selectedSupplierName || row.selectedPrice !== null) {
                      {{ ' · ' + formatPrice(row.selectedPrice) + ' cad. · conf. ' + row.selectedPackageSize }}
                    }
                  </span>
                </td>
                <td class="min-w-56">
                  <div class="flex flex-col gap-2">
                    <select
                      class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
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
                    <p class="px-1 text-xs text-slate-500">
                      {{ supplierAvailabilityLabel(row.availableSuppliers.length) }}
                    </p>
                  </div>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="5" class="px-4 py-5 text-sm text-slate-500">
                  Nessun prodotto corrisponde alla ricerca corrente.
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>

        <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-slate-500">{{ rangeLabel() }}</p>

          <div class="flex items-center gap-2">
            <button
              pButton
              type="button"
              class="justify-center !rounded-2xl !border !border-slate-300 !bg-white !px-4 !py-2 !text-sm !font-semibold !text-slate-700"
              [disabled]="currentPage() === 1"
              (click)="goToPreviousPage()"
            >
              Precedente
            </button>
            <span class="text-sm text-slate-500">
              Pagina {{ displayPage() }} di {{ totalPages() }}
            </span>
            <button
              pButton
              type="button"
              class="justify-center !rounded-2xl !border !border-slate-300 !bg-white !px-4 !py-2 !text-sm !font-semibold !text-slate-700"
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
  readonly loading = input(false);
  readonly requested = input(false);
  readonly error = input<string | null>(null);
  readonly hasSupplierUploads = input(false);

  readonly loadRequested = output<void>();
  readonly selectionChanged = output<{ ean: string; supplierId: string }>();
  readonly quantityChanged = output<{ ean: string; quantity: number | null }>();

  readonly searchTerm = signal('');
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

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / SUPPLIER_COMPARISON_PAGE_SIZE))
  );

  readonly displayPage = computed(() =>
    Math.min(Math.max(this.currentPage(), 1), this.totalPages())
  );

  readonly paginatedRows = computed(() => {
    const startIndex = (this.displayPage() - 1) * SUPPLIER_COMPARISON_PAGE_SIZE;

    return this.filteredRows().slice(startIndex, startIndex + SUPPLIER_COMPARISON_PAGE_SIZE);
  });

  readonly rangeLabel = computed(() => {
    const total = this.filteredRows().length;

    if (total === 0) {
      return 'Mostrati 0-0 di 0 prodotti';
    }

    const start = (this.displayPage() - 1) * SUPPLIER_COMPARISON_PAGE_SIZE + 1;
    const end = Math.min(start + this.paginatedRows().length - 1, total);

    return `Mostrati ${start}-${end} di ${total} prodotti`;
  });

  readonly formatPrice = formatPrice;
  readonly formatSupplierOption = formatSupplierOption;
  readonly supplierAvailabilityLabel = supplierAvailabilityLabel;

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
