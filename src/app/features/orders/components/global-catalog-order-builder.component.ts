import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
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
    <div
      class="min-w-0 bg-white md:flex md:min-h-[30rem] md:flex-1 md:flex-col"
      [class.pb-44]="searchMode()"
    >
      @if (!searchMode()) {
        <div data-selected-list-start class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-base font-semibold text-[var(--app-text)]">La tua lista</h3>
            <p class="mt-1 text-xs text-[var(--app-text-muted)]">
              {{ selectedProductsCount() }} prodotti
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]"
              aria-label="Importa da file"
              title="Importa da file"
              (click)="importRequested.emit()"
            >
              <i class="pi pi-cloud-upload text-sm" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="app-primary-action shrink-0 px-4 py-2.5 text-sm"
              (click)="openSearch()"
            >
              Cerca prodotti
            </button>
          </div>
        </div>

        @if (selectedItems().length === 0) {
          <div class="flex flex-col items-center px-4 py-10 text-center">
            <div class="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
              <i class="pi pi-box text-3xl" aria-hidden="true"></i>
            </div>
            <p class="mt-5 text-sm font-semibold text-[var(--app-text)]">Nessun prodotto aggiunto</p>
            <p class="mt-2 max-w-56 text-xs leading-5 text-[var(--app-text-muted)]">
              Cerca un prodotto o scansionalo per iniziare a creare il riassortimento.
            </p>
          </div>
        } @else {
          <ul class="mt-4 grid gap-3 md:hidden">
            @for (item of paginatedSelectedItems(); track item.lineId || item.ean) {
              <li class="rounded-2xl border border-[var(--app-border)] bg-white p-4">
                <p class="break-all text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--app-text-muted)]">
                  EAN {{ item.ean }}
                </p>
                <p class="mt-1 break-words text-sm font-semibold text-[var(--app-text)]">
                  {{ item.description || 'Prodotto senza descrizione' }}
                </p>
                <div class="mt-3 flex items-center justify-between gap-3 border-t border-[var(--app-border)] pt-3">
                  <span class="text-xs text-[var(--app-text-muted)]">Cartoni</span>
                  @if (isProductSaving(item.ean)) {
                    <div
                      class="h-10 w-[7.5rem] shrink-0 animate-pulse rounded-xl bg-slate-200"
                      aria-label="Salvataggio quantità in corso"
                    ></div>
                  } @else {
                  <div class="flex items-center overflow-hidden rounded-xl border border-[var(--app-border)]">
                    <button
                      type="button"
                      class="flex h-10 w-10 items-center justify-center text-[var(--app-text-muted)] disabled:opacity-40"
                      [disabled]="(item.quantity ?? 0) <= 0"
                      (click)="changeExistingItemQuantity(item, -1)"
                    >
                      <i class="pi pi-minus text-xs" aria-hidden="true"></i>
                    </button>
                    <span class="flex h-10 min-w-10 items-center justify-center border-x border-[var(--app-border)] px-2 text-sm font-semibold">
                      {{ item.quantity ?? 0 }}
                    </span>
                    <button
                      type="button"
                      class="flex h-10 w-10 items-center justify-center text-[var(--brand-primary)]"
                      (click)="changeExistingItemQuantity(item, 1)"
                    >
                      <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                    </button>
                  </div>
                  }
                </div>
              </li>
            }
          </ul>

          <div class="mt-4 hidden overflow-hidden rounded-2xl border border-[var(--app-border)] md:block">
            <table class="w-full border-collapse text-left text-sm">
              <thead class="bg-slate-50 text-xs uppercase tracking-wider text-[var(--app-text-muted)]">
                <tr>
                  <th class="px-4 py-3 font-semibold">EAN</th>
                  <th class="px-4 py-3 font-semibold">Descrizione</th>
                  <th class="w-40 px-4 py-3 text-center font-semibold">Cartoni</th>
                </tr>
              </thead>
              <tbody>
                @for (item of paginatedSelectedItems(); track item.lineId || item.ean) {
                  <tr class="border-t border-[var(--app-border)]">
                    <td class="px-4 py-3 font-medium text-[var(--app-text)]">{{ item.ean }}</td>
                    <td class="px-4 py-3 text-[var(--app-text)]">
                      {{ item.description || 'Prodotto senza descrizione' }}
                    </td>
                    <td class="px-4 py-3">
                      @if (isProductSaving(item.ean)) {
                        <div class="mx-auto h-10 w-[7.5rem] animate-pulse rounded-xl bg-slate-200"></div>
                      } @else {
                      <div class="mx-auto flex w-fit items-center overflow-hidden rounded-xl border border-[var(--app-border)]">
                        <button
                          type="button"
                          class="flex h-10 w-10 items-center justify-center text-[var(--app-text-muted)] disabled:opacity-40"
                          [disabled]="(item.quantity ?? 0) <= 0"
                          (click)="changeExistingItemQuantity(item, -1)"
                        >
                          <i class="pi pi-minus text-xs" aria-hidden="true"></i>
                        </button>
                        <span class="flex h-10 min-w-10 items-center justify-center border-x border-[var(--app-border)] px-2 text-sm font-semibold">
                          {{ item.quantity ?? 0 }}
                        </span>
                        <button
                          type="button"
                          class="flex h-10 w-10 items-center justify-center text-[var(--brand-primary)]"
                          (click)="changeExistingItemQuantity(item, 1)"
                        >
                          <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                        </button>
                      </div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (selectedItemsTotalPages() > 1) {
            <div class="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-white text-[var(--app-text)] transition hover:bg-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Pagina precedente"
                [disabled]="selectedItemsDisplayPage() === 1"
                (click)="goToPreviousSelectedItemsPage()"
              >
                <i class="pi pi-chevron-left text-xs" aria-hidden="true"></i>
              </button>
              <span class="text-xs text-[var(--app-text-muted)]">
                Pagina {{ selectedItemsDisplayPage() }} di {{ selectedItemsTotalPages() }}
              </span>
              <button
                type="button"
                class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-white text-[var(--app-text)] transition hover:bg-[var(--brand-primary-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Pagina successiva"
                [disabled]="selectedItemsDisplayPage() >= selectedItemsTotalPages()"
                (click)="goToNextSelectedItemsPage()"
              >
                <i class="pi pi-chevron-right text-xs" aria-hidden="true"></i>
              </button>
            </div>
          }
        }
      } @else {
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="hidden text-base font-semibold text-[var(--app-text)] md:block">Cerca prodotti</h3>
          <p class="mt-1 text-xs text-[var(--app-text-muted)]">
            <span class="md:hidden">Cerca per EAN o descrizione, oppure usa la fotocamera.</span>
            <span class="hidden md:inline">Cerca per EAN, SKU o descrizione prodotto.</span>
          </p>
        </div>
      </div>

      <div class="relative mt-5">
        <i
          class="pi pi-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--app-text-muted)]"
          aria-hidden="true"
        ></i>
        <input
          type="search"
          class="app-input w-full !py-3.5 !pl-11"
          placeholder="Cerca per EAN, SKU o descrizione prodotto"
          [ngModel]="query()"
          (ngModelChange)="onQueryChange($event)"
        />
      </div>

      @if (searchHelpVisible()) {
        <div class="mt-4 flex items-start gap-3 rounded-2xl bg-[var(--brand-primary-soft)] px-4 py-4">
          <i class="pi pi-info-circle mt-0.5 shrink-0 text-sm text-[var(--brand-primary)]" aria-hidden="true"></i>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-[var(--app-text)]">Come funziona</p>
            <p class="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
              Cerca un prodotto e aggiungi la quantità desiderata. Puoi inserire prodotti uno alla volta.
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--app-text-muted)] transition hover:bg-white/70 hover:text-[var(--app-text)]"
            aria-label="Nascondi informazioni"
            (click)="searchHelpVisible.set(false)"
          >
            <i class="pi pi-times text-xs" aria-hidden="true"></i>
          </button>
        </div>
      }

      @if (error()) {
        <div class="app-alert-error mt-4">{{ error() }}</div>
      }

      @if (showSearchSkeleton()) {
        <div class="mt-5 grid gap-3">
          @for (row of skeletonRows; track row) {
            <article class="animate-pulse rounded-2xl border border-[var(--app-border)] bg-white p-4">
              <div class="h-3 w-28 rounded-full bg-slate-200"></div>
              <div class="mt-3 h-4 w-4/5 rounded-full bg-slate-200"></div>
              <div class="mt-2 h-4 w-2/3 rounded-full bg-slate-100"></div>
              <div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <div class="h-3 w-20 rounded-full bg-slate-100"></div>
                <div class="h-11 w-32 rounded-xl bg-slate-200"></div>
              </div>
            </article>
          }
        </div>
      }

      @if (!loading() && searched() && products().length === 0 && !error()) {
        <p class="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
          Nessun prodotto trovato.
        </p>
      }

      @if (products().length > 0 && !showSearchSkeleton()) {
        <div class="mt-5 space-y-3 md:hidden">
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
                    <p class="mt-1 text-xs text-slate-500">Cartoni</p>
                  </div>
                  @if (isProductSaving(product.ean)) {
                    <div
                      class="h-12 w-[8.25rem] shrink-0 animate-pulse rounded-2xl bg-slate-200"
                      aria-label="Salvataggio quantità in corso"
                    ></div>
                  } @else {
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
                  }
                </div>
              </article>
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
                @for (product of products(); track product.ean) {
                    <tr class="border-t border-slate-100">
                      <td class="px-4 py-3 font-medium text-slate-800">{{ product.ean }}</td>
                      <td class="px-4 py-3 text-slate-700">{{ product.description }}</td>
                      <td class="px-4 py-3 text-center">
                        @if (isProductSaving(product.ean)) {
                          <div class="mx-auto h-11 w-14 animate-pulse rounded-xl bg-slate-200"></div>
                        } @else {
                        <input
                          type="number"
                          min="0"
                          step="1"
                          class="app-input h-11 w-14 rounded-xl p-0 text-center"
                          [ngModel]="quantityFor(product.ean)"
                          (ngModelChange)="setQuantity(product.ean, $event)"
                        />
                        }
                      </td>
                    </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <div class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 items-center gap-16 border-t border-[var(--app-border)] bg-white/98 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:px-7 md:py-4">
        <button type="button" class="min-w-0 text-left" (click)="closeSearch()">
          <p class="text-xs text-[var(--app-text-muted)] md:text-sm">La tua lista</p>
          <p class="text-sm font-semibold text-[var(--app-text)] md:text-base">
            {{ selectedProductsCount() }} prodotti
          </p>
        </button>

        <button
          type="button"
          class="absolute left-1/2 top-0 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[var(--brand-primary)] text-white shadow-[0_8px_24px_rgba(37,99,235,0.3)] transition hover:brightness-95 md:hidden"
          aria-label="Scansiona barcode"
          title="Scansiona barcode"
          (click)="scannerOpen.set(true)"
        >
          <i class="pi pi-camera text-lg" aria-hidden="true"></i>
        </button>

        <button
          type="button"
          class="justify-self-end rounded-xl px-3 py-2 text-xs font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary-soft)] md:text-sm"
          (click)="closeSearch()"
        >
          Torna alla lista
        </button>
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
  readonly savingEans = input<Set<string>>(new Set());
  readonly searched = input(false);
  readonly error = input<string | null>(null);
  readonly searchRequested = output<string>();
  readonly productsAdded = output<Array<GlobalCatalogProduct & { quantity: number }>>();
  readonly searchModeChanged = output<boolean>();
  readonly importRequested = output<void>();

  readonly query = signal('');
  readonly quantities = signal<Record<string, number>>({});
  readonly scannerOpen = signal(false);
  readonly searchMode = signal(false);
  readonly searchHelpVisible = signal(true);
  readonly selectedItemsPage = signal(1);
  readonly skeletonRows = [1, 2, 3];
  readonly selectedItemsPageSize = 5;
  readonly selectedItems = computed<OrderItem[]>(() => {
    const itemsByEan = new Map(
      this.existingItems().map((item) => [item.ean, { ...item }] as const)
    );
    const productsByEan = new Map(
      this.products().map((product) => [product.ean, product] as const)
    );

    for (const [ean, quantity] of Object.entries(this.quantities())) {
      if (quantity <= 0) {
        itemsByEan.delete(ean);
        continue;
      }

      const existingItem = itemsByEan.get(ean);
      const product = productsByEan.get(ean);
      itemsByEan.set(ean, {
        ...existingItem,
        ean,
        description: existingItem?.description || product?.description || ean,
        quantity,
        status: existingItem?.status || 'PENDING'
      });
    }

    return [...itemsByEan.values()];
  });
  readonly selectedItemsTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.selectedItems().length / this.selectedItemsPageSize))
  );
  readonly selectedItemsDisplayPage = computed(() =>
    Math.min(Math.max(this.selectedItemsPage(), 1), this.selectedItemsTotalPages())
  );
  readonly paginatedSelectedItems = computed(() => {
    const startIndex = (this.selectedItemsDisplayPage() - 1) * this.selectedItemsPageSize;

    return this.selectedItems().slice(startIndex, startIndex + this.selectedItemsPageSize);
  });
  readonly showSearchSkeleton = computed(() => this.loading());
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
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

  openSearch(): void {
    this.searchHelpVisible.set(true);
    this.searchMode.set(true);
    this.searchModeChanged.emit(true);
  }

  closeSearch(): void {
    this.searchMode.set(false);
    this.searchModeChanged.emit(false);
    this.scrollToSelectedItemsStart();
  }

  selectedProductsCount(): number {
    return this.selectedItems().filter((item) => (item.quantity ?? 0) > 0).length;
  }

  selectedPiecesCount(): number {
    return this.selectedItems().reduce((total, item) => total + Math.max(0, item.quantity ?? 0), 0);
  }

  goToPreviousSelectedItemsPage(): void {
    this.selectedItemsPage.update((page) => Math.max(1, page - 1));
    this.scrollToSelectedItemsStart();
  }

  goToNextSelectedItemsPage(): void {
    this.selectedItemsPage.update((page) => Math.min(this.selectedItemsTotalPages(), page + 1));
    this.scrollToSelectedItemsStart();
  }

  changeExistingItemQuantity(item: OrderItem, delta: number): void {
    const quantity = Math.max(0, (item.quantity ?? 0) + delta);
    const product = {
      ean: item.ean,
      description: item.description || item.ean,
      quantity
    };

    this.quantities.update((quantities) => ({ ...quantities, [item.ean]: quantity }));
    this.productsAdded.emit([product]);
  }

  onQueryChange(value: string): void {
    this.query.set(value);

    if (value.trim().length >= 2) {
      this.searchHelpVisible.set(false);
      this.searchRequested.emit(value);
      return;
    }

    this.searchRequested.emit('');
  }

  onBarcodeScanned(ean: string): void {
    this.scannerOpen.set(false);
    this.query.set(ean);
    this.searchHelpVisible.set(false);
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

  isProductSaving(ean: string): boolean {
    return this.savingEans().has(ean);
  }

  private scrollToSelectedItemsStart(): void {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches) {
      return;
    }

    requestAnimationFrame(() => {
      this.elementRef.nativeElement
        .querySelector<HTMLElement>('[data-selected-list-start]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}
