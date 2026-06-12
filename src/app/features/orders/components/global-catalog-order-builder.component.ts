import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { GlobalCatalogProduct, OrderItem } from '../../../models/order.models';
import { BarcodeScannerComponent } from './barcode-scanner.component';

@Component({
  selector: 'app-global-catalog-order-builder',
  standalone: true,
  imports: [BarcodeScannerComponent, FormsModule],
  template: `
    <div class="min-w-0 rounded-3xl border border-[var(--app-border)] bg-white p-4 shadow-sm sm:p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-base font-semibold text-[var(--app-text)]">Catalogo prodotti</h3>
        </div>
        <button
          type="button"
          class="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] px-4 py-3 text-sm font-semibold text-[var(--brand-primary)] transition hover:brightness-95 sm:hidden"
          (click)="scannerOpen.set(true)"
        >
          <i class="pi pi-camera" aria-hidden="true"></i>
          Scansiona barcode
        </button>
      </div>

      <div class="mt-5">
        <input
          type="search"
          class="app-input w-full"
          placeholder="Cerca EAN o descrizione..."
          [ngModel]="query()"
          (ngModelChange)="onQueryChange($event)"
        />
      </div>

      @if (error()) {
        <div class="app-alert-error mt-4">{{ error() }}</div>
      }

      @if (!loading() && searched() && products().length === 0 && !error()) {
        <p class="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
          Nessun prodotto trovato.
        </p>
      }

      @if (products().length > 0) {
        <div class="mt-5 space-y-3 md:hidden">
          @if (saving()) {
            @for (row of skeletonRows; track row) {
              <article class="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                <div class="h-3 w-16 rounded bg-slate-200"></div>
                <div class="mt-2 h-4 w-32 rounded bg-slate-200"></div>
                <div class="mt-5 h-3 w-24 rounded bg-slate-200"></div>
                <div class="mt-2 h-4 w-4/5 rounded bg-slate-200"></div>
                <div class="mt-5 flex items-center justify-between">
                  <div class="h-3 w-20 rounded bg-slate-200"></div>
                  <div class="h-12 w-20 rounded-2xl bg-slate-200"></div>
                </div>
              </article>
            }
          } @else {
            @for (product of products(); track product.ean) {
              <article
                class="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
              >
                <div class="flex min-w-0 items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
                      EAN {{ product.ean }}
                    </p>
                    <h4 class="mt-1 text-sm font-semibold leading-5 text-slate-800">
                      {{ product.description }}
                    </h4>
                  </div>
                  @if (quantityFor(product.ean) > 0) {
                    <span
                      class="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700"
                    >
                      Nel riordino
                    </span>
                  }
                </div>

                <div class="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <p class="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Quantità
                    </p>
                    <p class="mt-1 text-xs text-slate-500">Pezzi da ordinare</p>
                  </div>
                  <div
                    class="flex shrink-0 items-center overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white"
                    [attr.aria-label]="'Quantità per ' + product.description"
                  >
                    <button
                      type="button"
                      class="flex h-12 w-11 items-center justify-center text-lg font-semibold text-slate-600 transition hover:bg-slate-50 disabled:text-slate-300"
                      aria-label="Rimuovi un pezzo"
                      [disabled]="quantityFor(product.ean) === 0"
                      (click)="changeQuantity(product.ean, -1)"
                    >
                      <i class="pi pi-minus text-xs" aria-hidden="true"></i>
                    </button>
                    <span
                      class="flex h-12 min-w-12 items-center justify-center border-x border-[var(--app-border)] px-2 text-base font-bold text-slate-900"
                      aria-live="polite"
                    >
                      {{ quantityFor(product.ean) }}
                    </span>
                    <button
                      type="button"
                      class="flex h-12 w-11 items-center justify-center text-lg font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary-soft)]"
                      aria-label="Aggiungi un pezzo"
                      (click)="changeQuantity(product.ean, 1)"
                    >
                      <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </article>
            }
          }
        </div>

        <div class="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
          <div class="max-h-[28rem] overflow-auto">
            <table class="w-full border-collapse text-left text-sm">
              <thead class="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th class="px-4 py-3">EAN</th>
                  <th class="px-4 py-3">Descrizione</th>
                  <th class="w-24 px-4 py-3 text-center">QTA</th>
                </tr>
              </thead>
              <tbody>
                @if (saving()) {
                  @for (row of skeletonRows; track row) {
                    <tr class="border-t border-slate-100">
                      <td class="px-4 py-4">
                        <div class="h-4 w-32 animate-pulse rounded bg-slate-200"></div>
                      </td>
                      <td class="px-4 py-4">
                        <div class="h-4 w-3/4 animate-pulse rounded bg-slate-200"></div>
                      </td>
                      <td class="px-4 py-4">
                        <div class="mx-auto h-11 w-14 animate-pulse rounded-xl bg-slate-200"></div>
                      </td>
                    </tr>
                  }
                } @else {
                  @for (product of products(); track product.ean) {
                    <tr class="border-t border-slate-100">
                      <td class="px-4 py-3 font-medium text-slate-800">{{ product.ean }}</td>
                      <td class="px-4 py-3 text-slate-700">{{ product.description }}</td>
                      <td class="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          class="app-input h-11 w-14 rounded-xl p-0 text-center"
                          [ngModel]="quantityFor(product.ean)"
                          (ngModelChange)="setQuantity(product.ean, $event)"
                        />
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>

    @if (scannerOpen()) {
      <app-barcode-scanner
        (scanned)="onBarcodeScanned($event)"
        (closed)="scannerOpen.set(false)"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GlobalCatalogOrderBuilderComponent {
  readonly products = input<GlobalCatalogProduct[]>([]);
  readonly existingItems = input<OrderItem[]>([]);
  readonly loading = input(false);
  readonly saving = input(false);
  readonly searched = input(false);
  readonly error = input<string | null>(null);
  readonly searchRequested = output<string>();
  readonly productsAdded = output<Array<GlobalCatalogProduct & { quantity: number }>>();

  readonly query = signal('');
  readonly quantities = signal<Record<string, number>>({});
  readonly scannerOpen = signal(false);
  readonly skeletonRows = [1, 2, 3];
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingProducts = new Map<
    string,
    GlobalCatalogProduct & { quantity: number }
  >();
  private saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.saveTimeoutId !== null) {
        clearTimeout(this.saveTimeoutId);
      }
    });
  }

  onQueryChange(value: string): void {
    this.query.set(value);

    if (value.trim().length >= 2) {
      this.searchRequested.emit(value);
    }
  }

  onBarcodeScanned(ean: string): void {
    this.scannerOpen.set(false);
    this.query.set(ean);
    this.searchRequested.emit(ean);
  }

  quantityFor(ean: string): number {
    const editedQuantity = this.quantities()[ean];
    if (editedQuantity !== undefined) {
      return editedQuantity;
    }

    const existingQuantity = this.existingItems().find((item) => item.ean === ean)?.quantity;
    return typeof existingQuantity === 'number' ? existingQuantity : 0;
  }

  changeQuantity(ean: string, delta: number): void {
    this.setQuantity(ean, this.quantityFor(ean) + delta);
  }

  setQuantity(ean: string, rawValue: number | string): void {
    const numericValue = Number(rawValue);
    const quantity = Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : 0;
    this.quantities.update((quantities) => ({ ...quantities, [ean]: quantity }));

    const product = this.products().find((candidate) => candidate.ean === ean);
    if (!product) {
      return;
    }

    this.pendingProducts.set(ean, { ...product, quantity });

    if (this.saveTimeoutId !== null) {
      clearTimeout(this.saveTimeoutId);
    }

    this.saveTimeoutId = setTimeout(() => {
      this.saveTimeoutId = null;
      const productsToSave = [...this.pendingProducts.values()];
      this.pendingProducts.clear();
      this.productsAdded.emit(productsToSave);
    }, 400);
  }
}
