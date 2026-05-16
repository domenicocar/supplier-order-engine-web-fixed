import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, firstValueFrom, map, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TabsModule } from 'primeng/tabs';

import {
  PdfImportJobStatus,
  PdfImportStatusResponse,
  ReviewItem,
  SupplierComparisonOffer,
  SupplierComparisonRow
} from '../../../models/order.models';
import { SESSION_SUPPLIERS } from '../../../models/supplier.models';
import { OrdersSessionStore } from '../../../services/orders-session.store';
import { OrdersService } from '../../../services/orders.service';
import { OrderExportTabComponent } from '../components/order-export-tab.component';
import {
  OrderExportOverview,
  OrderExportSummaryRow,
  SupplierComparisonSelection,
  SupplierComparisonTableRow,
  SupplierExportSummary
} from '../components/order-detail-view.models';
import { OrderImportTabComponent } from '../components/order-import-tab.component';
import { OrderProductsTabComponent } from '../components/order-products-tab.component';
import { SupplierComparisonTabComponent } from '../components/supplier-comparison-tab.component';
import { StatusTagComponent } from '../../../shared/components/status-tag.component';

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    DatePipe,
    OrderExportTabComponent,
    OrderImportTabComponent,
    OrderProductsTabComponent,
    RouterLink,
    StatusTagComponent,
    SupplierComparisonTabComponent,
    TabsModule
  ],
  template: `
    @if (orderLoading()) {
      <section class="surface-panel flex flex-col gap-4 p-8">
        <a
          routerLink="/app/orders"
          class="inline-flex items-center gap-2 text-sm font-medium text-slate-500 no-underline transition hover:text-slate-900"
        >
          ← Torna agli ordini
        </a>
        <h1 class="font-heading text-3xl font-semibold text-slate-950">Caricamento ordine...</h1>
        <p class="max-w-2xl text-sm leading-7 text-slate-600">
          Sto recuperando il dettaglio ordine e preparando i dati dei tab.
        </p>
      </section>
    } @else {
      @if (order(); as currentOrder) {
        <section class="flex flex-col gap-6">
          <div class="surface-panel flex flex-col gap-6 p-8 lg:flex-row lg:items-start lg:justify-between">
            <div class="max-w-3xl">
              <a
                routerLink="/app/orders"
                class="inline-flex items-center gap-2 text-sm font-medium text-slate-500 no-underline transition hover:text-slate-900"
              >
                ← Torna agli ordini
              </a>

              <div class="mt-4 flex flex-wrap items-center gap-3">
                <h1 class="font-heading text-3xl font-semibold tracking-tight text-slate-950">
                  Ordine {{ currentOrder.id }}
                </h1>
                <app-status-tag [label]="currentOrder.status" />
              </div>

              <p class="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Dettaglio ordine riorganizzato in tab, con import, prodotti, confronto fornitori e
                riepilogo/export separati in componenti dedicati.
              </p>
            </div>

            <div class="grid grid-cols-2 gap-3 sm:min-w-[22rem]">
              <div class="stat-tile">
                <p class="stat-label">Creato</p>
                <p class="stat-value">{{ currentOrder.createdAt | date: 'dd/MM/yyyy HH:mm' }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Prodotti</p>
                <p class="stat-value">{{ currentOrder.items.length }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Review</p>
                <p class="stat-value">{{ currentOrder.reviewItems.length }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Fornitori</p>
                <p class="stat-value">{{ suppliers.length }}</p>
              </div>
            </div>
          </div>

          @if (pageError()) {
            <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {{ pageError() }}
            </div>
          }

          <p-tabs
            [value]="activeTab()"
            (valueChange)="onActiveTabChange($event)"
            [lazy]="true"
            class="flex flex-col gap-6"
          >
            <p-tablist>
              <p-tab value="import">Import</p-tab>
              <p-tab value="products">Tabella prodotti</p-tab>
              <p-tab value="comparison">Confronto fornitori</p-tab>
              <p-tab value="export">Riepilogo e Export</p-tab>
            </p-tablist>

            <p-tabpanels>
              <p-tabpanel value="import">
                <app-order-import-tab
                  [order]="currentOrder"
                  [suppliers]="suppliers"
                  [selectedPdfFile]="selectedPdfFile()"
                  [pdfUploading]="pdfUploading()"
                  [pdfImportStatus]="pdfImportStatus()"
                  [pdfImportMessage]="pdfImportMessage()"
                  [pdfImportRefreshWarning]="pdfImportRefreshWarning()"
                  [supplierFiles]="supplierFiles()"
                  [supplierLoadingState]="supplierLoadingState()"
                  (pdfFileSelected)="onPdfFileSelected($event)"
                  (pdfUploadRequested)="uploadPdf()"
                  (supplierFileSelected)="onSupplierFileSelected($event)"
                  (supplierUploadRequested)="uploadSupplierFile($event)"
                />
              </p-tabpanel>

              <p-tabpanel value="products">
                <app-order-products-tab
                  [items]="currentOrder.items"
                  [reviewItems]="currentOrder.reviewItems"
                />
              </p-tabpanel>

              <p-tabpanel value="comparison">
                <app-supplier-comparison-tab
                  [rows]="supplierComparisonRows()"
                  [loading]="supplierComparisonLoading()"
                  [requested]="supplierComparisonRequested()"
                  [error]="supplierComparisonError()"
                  [hasSupplierUploads]="hasSupplierUploads()"
                  (loadRequested)="loadSupplierComparison()"
                  (selectionChanged)="onSupplierComparisonSelectionChange($event)"
                  (quantityChanged)="onSupplierComparisonQuantityChange($event)"
                />
              </p-tabpanel>

              <p-tabpanel value="export">
                <app-order-export-tab
                  [exporting]="exporting()"
                  [overview]="exportOverview()"
                  [supplierSummary]="supplierExportSummary()"
                  [summaryRows]="orderExportSummaryRows()"
                  [missingRows]="missingOrderSummaryRows()"
                  [exportResult]="currentOrder.exportResult"
                  (exportRequested)="generateExport()"
                />
              </p-tabpanel>
            </p-tabpanels>
          </p-tabs>
        </section>
      } @else {
        <section class="surface-panel flex flex-col gap-4 p-8">
          <a
            routerLink="/app/orders"
            class="inline-flex items-center gap-2 text-sm font-medium text-slate-500 no-underline transition hover:text-slate-900"
          >
            ← Torna agli ordini
          </a>
          <h1 class="font-heading text-3xl font-semibold text-slate-950">Ordine non trovato</h1>
          <p class="max-w-2xl text-sm leading-7 text-slate-600">
            Non sono riuscito a trovare questo ordine nello store locale o nel backend.
            Riaprilo da
            <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">/app/orders</code>
            e riprova.
          </p>
        </section>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailPageComponent {
  private pdfImportPollingSubscription: Subscription | null = null;
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ordersStore = inject(OrdersSessionStore);
  private readonly ordersService = inject(OrdersService);

  readonly suppliers = SESSION_SUPPLIERS;
  readonly activeTab = signal<'import' | 'products' | 'comparison' | 'export'>('import');
  readonly orderLoading = signal(false);
  readonly selectedPdfFile = signal<File | null>(null);
  readonly pdfUploading = signal(false);
  readonly pdfImportStatus = signal<PdfImportJobStatus>('idle');
  readonly pdfImportMessage = signal<string | null>(null);
  readonly pdfImportRefreshWarning = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly pageError = signal<string | null>(null);
  readonly supplierComparisonRequested = signal(false);
  readonly supplierComparisonLoading = signal(false);
  readonly supplierComparisonError = signal<string | null>(null);
  readonly supplierComparisonSelections = signal<Record<string, SupplierComparisonSelection>>({});
  readonly supplierComparisonQuantities = signal<Record<string, number | null>>({});
  readonly supplierFiles = signal<Record<string, File | null>>({});
  readonly supplierLoadingState = signal<Record<string, boolean>>({});
  readonly fetchedOrderIds = signal<Record<string, boolean>>({});

  readonly orderId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' }
  );

  readonly order = computed(() => this.ordersStore.orderById(this.orderId()));
  readonly hasSupplierUploads = computed(() =>
    Object.values(this.order()?.supplierUploads ?? {}).some((uploads) => uploads.length > 0)
  );
  readonly supplierComparisonRows = computed(() => this.buildSupplierComparisonTableRows());
  readonly orderExportSummaryRows = computed(() => this.buildOrderExportSummaryRows());
  readonly missingOrderSummaryRows = computed(() =>
    this.orderExportSummaryRows().filter((row) => !row.foundInSuppliers)
  );
  readonly supplierExportSummary = computed(() =>
    this.buildSupplierExportSummary(this.orderExportSummaryRows())
  );
  readonly exportOverview = computed(() => this.buildExportOverview(this.orderExportSummaryRows()));

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPdfImportPolling());

    effect(
      () => {
        const orderId = this.orderId();
        const currentOrder = this.order();

        if (!orderId) {
          return;
        }

        if (currentOrder?.supplierComparisonRows?.length) {
          this.supplierComparisonRequested.set(true);
        }

        if (!currentOrder && !this.fetchedOrderIds()[orderId] && !this.orderLoading()) {
          void this.loadOrder(orderId);
        }
      },
      { allowSignalWrites: true }
    );
  }

  onPdfFileSelected(file: File | null): void {
    this.selectedPdfFile.set(file);

    if (this.pdfImportStatus() !== 'processing') {
      this.resetPdfImportFeedback();
    }
  }

  async uploadPdf(): Promise<void> {
    const file = this.selectedPdfFile();
    const orderId = this.orderId();

    if (!file || !orderId || this.pdfImportStatus() === 'processing') {
      return;
    }

    this.pdfUploading.set(true);
    this.pageError.set(null);
    this.resetPdfImportFeedback();

    try {
      const response = await firstValueFrom(this.ordersService.importPdf(orderId, file));

      if (response.status === 'processing') {
        this.pdfImportStatus.set('processing');
        this.startPdfImportPolling(orderId);
        return;
      }

      if (response.importResult) {
        this.ordersStore.setImportResult(orderId, {
          status: response.status,
          items: response.items,
          reviewItems: response.reviewItems,
          importResult: response.importResult
        });
        this.selectedPdfFile.set(null);
      }
    } catch (error: unknown) {
      this.pageError.set(this.toMessage(error, 'Import PDF non riuscito.'));
    } finally {
      this.pdfUploading.set(false);
    }
  }

  onSupplierFileSelected(payload: { supplierId: string; file: File | null }): void {
    this.supplierFiles.update((files) => ({
      ...files,
      [payload.supplierId]: payload.file
    }));
  }

  selectedSupplierFile(supplierId: string): File | null {
    return this.supplierFiles()[supplierId] ?? null;
  }

  supplierUploading(supplierId: string): boolean {
    return this.supplierLoadingState()[supplierId] ?? false;
  }

  async uploadSupplierFile(supplierId: string): Promise<void> {
    const orderId = this.orderId();
    const file = this.selectedSupplierFile(supplierId);

    if (!orderId || !file) {
      return;
    }

    this.setSupplierLoading(supplierId, true);
    this.pageError.set(null);

    try {
      const response = await firstValueFrom(this.ordersService.uploadSupplierFile(supplierId, file));
      this.ordersStore.appendSupplierUpload(orderId, response);
      this.supplierComparisonRequested.set(false);
      this.supplierComparisonError.set(null);
      this.ordersStore.setSupplierComparisonRows(orderId, []);
      this.supplierFiles.update((files) => ({
        ...files,
        [supplierId]: null
      }));
    } catch (error: unknown) {
      this.pageError.set(this.toMessage(error, `Upload file fornitore ${supplierId} non riuscito.`));
    } finally {
      this.setSupplierLoading(supplierId, false);
    }
  }

  onSupplierComparisonSelectionChange(payload: { ean: string; supplierId: string }): void {
    const row = this.supplierComparisonRows().find((currentRow) => currentRow.ean === payload.ean);
    const option = row?.availableSuppliers.find(
      (currentOption) => currentOption.supplierId === payload.supplierId
    );

    if (!option) {
      return;
    }

    this.supplierComparisonSelections.update((selections) => ({
      ...selections,
      [payload.ean]: {
        selectedSupplierId: option.supplierId,
        selectedSupplierName: option.supplierName,
        selectedPrice: option.price
      }
    }));
  }

  onSupplierComparisonQuantityChange(payload: { ean: string; quantity: number | null }): void {
    this.supplierComparisonQuantities.update((quantities) => ({
      ...quantities,
      [payload.ean]: payload.quantity
    }));
  }

  onActiveTabChange(value: string | number): void {
    if (
      value === 'import' ||
      value === 'products' ||
      value === 'comparison' ||
      value === 'export'
    ) {
      this.activeTab.set(value);
    }
  }

  async loadSupplierComparison(): Promise<void> {
    const orderId = this.orderId();

    if (!orderId || !this.hasSupplierUploads() || this.supplierComparisonLoading()) {
      return;
    }

    this.supplierComparisonRequested.set(true);
    this.supplierComparisonLoading.set(true);
    this.supplierComparisonError.set(null);
    this.activeTab.set('comparison');

    try {
      await this.refreshSupplierComparison(orderId);
    } finally {
      this.supplierComparisonLoading.set(false);
    }
  }

  async generateExport(): Promise<void> {
    const orderId = this.orderId();

    if (!orderId) {
      return;
    }

    this.exporting.set(true);
    this.pageError.set(null);

    try {
      const exportItems = this.orderExportSummaryRows()
        .filter(
          (row) =>
            typeof row.quantity === 'number' &&
            Number.isFinite(row.quantity) &&
            row.quantity > 0 &&
            row.supplierId.trim().length > 0 &&
            row.ean.trim().length > 0
        )
        .map((row) => ({
          ean: row.ean,
          quantity: row.quantity as number,
          supplierId: row.supplierId
        }));

      await firstValueFrom(this.ordersService.syncOrderItems(orderId, exportItems));
      const response = await firstValueFrom(this.ordersService.exportOrder(orderId));
      this.ordersStore.setExportResult(orderId, response);
      this.activeTab.set('export');

      for (const file of response.files ?? []) {
        const blob = await firstValueFrom(
          this.ordersService.downloadExportedFile(orderId, file.fileName)
        );
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.fileName;
        anchor.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error: unknown) {
      this.pageError.set(this.toMessage(error, 'Export ordine non riuscito.'));
    } finally {
      this.exporting.set(false);
    }
  }

  private async loadOrder(orderId: string): Promise<void> {
    this.orderLoading.set(true);
    this.pageError.set(null);
    this.markOrderAsFetched(orderId);

    try {
      const response = await firstValueFrom(this.ordersService.getOrderById(orderId));
      this.ordersStore.upsertOrder(response.order);
    } catch (error: unknown) {
      this.pageError.set(this.toMessage(error, 'Non sono riuscito a caricare l\'ordine.'));
    } finally {
      this.orderLoading.set(false);
    }
  }

  private markOrderAsFetched(orderId: string): void {
    this.fetchedOrderIds.update((state) => ({
      ...state,
      [orderId]: true
    }));
  }

  private buildOrderExportSummaryRows(): OrderExportSummaryRow[] {
    const currentOrder = this.order();
    const comparisonRows = this.supplierComparisonRows();
    const orderItems = currentOrder?.items ?? [];

    if (orderItems.length === 0 && comparisonRows.length === 0) {
      return [];
    }

    const orderItemsByEan = new Map(orderItems.map((item) => [item.ean, item] as const));
    const comparisonRowsByEan = new Map(comparisonRows.map((row) => [row.ean, row] as const));

    const manualComparisonRows = comparisonRows.filter(
      (row) =>
        !orderItemsByEan.has(row.ean) &&
        typeof row.quantity === 'number' &&
        Number.isFinite(row.quantity) &&
        row.quantity > 0
    );

    const rowsToSummarize = [
      ...orderItems.map((item) => ({
        ean: item.ean,
        description: item.description,
        quantity: item.quantity
      })),
      ...manualComparisonRows.map((row) => ({
        ean: row.ean,
        description: row.description,
        quantity: row.quantity
      }))
    ];

    return rowsToSummarize.map((item, index) => {
      const comparisonRow = comparisonRowsByEan.get(item.ean);
      const quantitySource = comparisonRow?.quantity ?? item.quantity;
      const normalizedQuantity =
        typeof quantitySource === 'number' && Number.isFinite(quantitySource)
          ? Math.max(0, quantitySource)
          : null;
      const foundInSuppliers = (comparisonRow?.availableSuppliers.length ?? 0) > 0;
      const selectedPrice = foundInSuppliers ? comparisonRow?.selectedPrice ?? null : null;
      const lineTotal =
        normalizedQuantity !== null && selectedPrice !== null
          ? normalizedQuantity * selectedPrice
          : null;

      return {
        ean: item.ean,
        description: item.description ?? comparisonRow?.description ?? `Prodotto ${index + 1}`,
        quantity: normalizedQuantity,
        supplierId: foundInSuppliers ? comparisonRow?.selectedSupplierId ?? '' : '',
        supplierName: foundInSuppliers ? comparisonRow?.selectedSupplierName ?? '' : '',
        unitPrice: selectedPrice,
        lineTotal,
        foundInSuppliers,
        availableSuppliersCount: comparisonRow?.availableSuppliers.length ?? 0,
        missingReason: foundInSuppliers ? undefined : 'Non trovato nei listini dei fornitori caricati'
      };
    });
  }

  private buildSupplierExportSummary(rows: OrderExportSummaryRow[]): SupplierExportSummary[] {
    const grouped = new Map<string, SupplierExportSummary>();

    for (const row of rows) {
      if (!row.supplierId) {
        continue;
      }

      const current = grouped.get(row.supplierId) ?? {
        supplierId: row.supplierId,
        supplierName: row.supplierName || 'Da assegnare',
        lineCount: 0,
        totalQuantity: 0,
        subtotal: 0,
        missingPricesCount: 0,
        missingQuantitiesCount: 0,
        items: []
      };

      current.lineCount += 1;
      current.totalQuantity += row.quantity ?? 0;
      current.missingPricesCount += row.unitPrice === null ? 1 : 0;
      current.missingQuantitiesCount += row.quantity === null ? 1 : 0;
      current.items.push(row);

      if (row.lineTotal !== null && current.subtotal !== null) {
        current.subtotal += row.lineTotal;
      }

      grouped.set(row.supplierId, current);
    }

    return Array.from(grouped.values()).sort((left, right) =>
      left.supplierName.localeCompare(right.supplierName)
    );
  }

  private buildExportOverview(rows: OrderExportSummaryRow[]): OrderExportOverview | null {
    if (rows.length === 0) {
      return null;
    }

    return {
      estimatedTotal: rows.reduce((sum, row) => sum + (row.lineTotal ?? 0), 0),
      productsCount: rows.length,
      suppliersCount: new Set(rows.map((row) => row.supplierId).filter(Boolean)).size,
      totalQuantity: rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0),
      missingItemsCount: rows.filter((row) => !row.foundInSuppliers).length,
      assignedItemsCount: rows.filter((row) => !!row.supplierId).length,
      missingPricesCount: rows.filter((row) => row.foundInSuppliers && row.unitPrice === null).length,
      missingQuantitiesCount: rows.filter((row) => row.quantity === null).length
    };
  }

  private setSupplierLoading(supplierId: string, loading: boolean): void {
    this.supplierLoadingState.update((state) => ({
      ...state,
      [supplierId]: loading
    }));
  }

  private buildSupplierComparisonTableRows(): SupplierComparisonTableRow[] {
    const currentOrder = this.order();

    if (!currentOrder?.supplierComparisonRows?.length) {
      return [];
    }

    const selections = this.supplierComparisonSelections();
    const quantityOverrides = this.supplierComparisonQuantities();

    return currentOrder.supplierComparisonRows
      .map((row) => {
        const defaultOption = row.bestOffer ?? row.availableSuppliers[0] ?? null;
        const manualSelection = selections[row.ean];
        const selectedOption =
          row.availableSuppliers.find(
            (option) => option.supplierId === manualSelection?.selectedSupplierId
          ) ?? defaultOption;

        return {
          ean: row.ean,
          description: row.description,
          quantity: quantityOverrides[row.ean] ?? row.quantity,
          bestOffer: row.bestOffer,
          selectedSupplierId: selectedOption?.supplierId ?? '',
          selectedSupplierName: selectedOption?.supplierName ?? '',
          selectedPrice: selectedOption?.price ?? null,
          availableSuppliers: row.availableSuppliers
        };
      })
      .sort((left, right) => left.ean.localeCompare(right.ean));
  }

  private startPdfImportPolling(orderId: string): void {
    this.stopPdfImportPolling();

    this.pdfImportPollingSubscription = timer(2000, 2000)
      .pipe(
        switchMap(() => this.ordersService.getImportPdfStatus(orderId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (statusResponse) => this.handlePdfImportStatus(orderId, statusResponse),
        error: (error: unknown) => {
          this.pdfImportStatus.set('failed');
          this.pdfImportMessage.set(this.toMessage(error, 'Impossibile verificare lo stato import PDF.'));
          this.stopPdfImportPolling();
        }
      });
  }

  private handlePdfImportStatus(orderId: string, statusResponse: PdfImportStatusResponse): void {
    if (statusResponse.status === 'completed') {
      this.pdfImportStatus.set('completed');
      this.pdfImportMessage.set(`Import completato: ${statusResponse.itemsCount} prodotti trovati`);
      this.selectedPdfFile.set(null);
      this.stopPdfImportPolling();
      void this.refreshOrderAfterPdfImport(orderId);
      return;
    }

    if (statusResponse.status === 'failed') {
      this.pdfImportStatus.set('failed');
      this.pdfImportMessage.set(statusResponse.error?.trim() || 'Import PDF non riuscito.');
      this.stopPdfImportPolling();
    }
  }

  private stopPdfImportPolling(): void {
    if (!this.pdfImportPollingSubscription) {
      return;
    }

    this.pdfImportPollingSubscription.unsubscribe();
    this.pdfImportPollingSubscription = null;
  }

  private resetPdfImportFeedback(): void {
    this.pdfImportStatus.set('idle');
    this.pdfImportMessage.set(null);
    this.pdfImportRefreshWarning.set(null);
  }

  private async refreshOrderAfterPdfImport(orderId: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.ordersService.getOrderById(orderId));
      this.ordersStore.upsertOrder(response.order);
    } catch (error: unknown) {
      this.pdfImportRefreshWarning.set(
        'Import completato, ma non sono riuscito ad aggiornare la tabella. Ricarica la pagina.'
      );
    }
  }

  private async refreshSupplierComparison(orderId: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.ordersService.getSupplierComparison(orderId));
      this.ordersStore.setSupplierComparisonRows(orderId, response.rows);
    } catch (error: unknown) {
      this.supplierComparisonError.set(
        this.toMessage(error, 'Non sono riuscito a caricare il confronto fornitori.')
      );
    }
  }

  private toMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
