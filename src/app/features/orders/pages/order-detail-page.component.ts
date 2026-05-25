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
  ImportOrderFileResponse,
  OrderFilePreviewResult,
  OrderImportColumnMapping,
  OrderItem,
  ReviewItem,
  SupplierColumnMapping,
  SupplierComparisonRow
} from '../../../models/order.models';
import { SupplierCreatePayload, SupplierDefinition } from '../../../models/supplier.models';
import { OrdersSessionStore } from '../../../services/orders-session.store';
import { OrdersService } from '../../../services/orders.service';
import { OrderExportTabComponent } from '../components/order-export-tab.component';
import {
  OrderExportOverview,
  OrderImportPreviewState,
  OrderExportSummaryRow,
  SupplierComparisonSelection,
  SupplierComparisonTableRow,
  SupplierExportSummary,
  SupplierUploadPreviewState,
  UploadCardState
} from '../components/order-detail-view.models';
import {
  calculateRoundedLineTotal,
  resolveSelectedSupplierComparisonOffer,
  roundToCents,
  sumRoundedCurrency
} from '../components/order-detail-view.utils';
import { OrderImportTabComponent } from '../components/order-import-tab.component';
import { OrderProductsTabComponent } from '../components/order-products-tab.component';
import { SupplierComparisonTabComponent } from '../components/supplier-comparison-tab.component';

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    OrderExportTabComponent,
    OrderImportTabComponent,
    OrderProductsTabComponent,
    RouterLink,
    SupplierComparisonTabComponent,
    TabsModule
  ],
  template: `
    @if (orderLoading()) {
      <section class="surface-panel flex flex-col gap-4 p-8">
        <a
          routerLink="/app/orders"
          class="app-link-muted inline-flex items-center gap-2 text-sm font-medium no-underline transition"
        >
          Ã¢â€ Â Torna agli ordini
        </a>
        <h1 class="font-heading text-3xl font-semibold text-[var(--app-text)]">Caricamento ordine...</h1>
        <p class="max-w-2xl text-sm leading-7 text-[var(--app-text-muted)]">
          Sto recuperando il dettaglio ordine e preparando i dati dei tab.
        </p>
      </section>
    } @else {
      @if (order(); as currentOrder) {
        <section class="flex flex-col gap-6">
          <div class="order-header surface-panel">
            <div class="order-header__main">
              <a
                routerLink="/app/orders"
                class="order-header__back app-link-muted inline-flex items-center gap-2 text-sm font-medium no-underline transition"
              >
                Ã¢â€ Â Torna agli ordini
              </a>

              <div class="order-header__title-row">
                <h1 class="order-header__title">
                  {{ orderDisplayLabel(currentOrder.createdAt) }}
                </h1>
                <span class="order-header__status-pill">
                  {{ orderStatusLabel(currentOrder.status) }}
                </span>
              </div>

              <p class="order-header__subtitle">
                {{ orderMetaLine(currentOrder.createdAt, currentOrder.items.length, suppliers().length) }}
              </p>
            </div>

            <div class="order-header__metrics">
              <div class="order-metric-pill">
                <i class="pi pi-box order-metric-pill__icon" aria-hidden="true"></i>
                <span class="order-metric-pill__value">{{ currentOrder.items.length }}</span>
                <span class="order-metric-pill__label">prodotti</span>
              </div>
              <div class="order-metric-pill">
                <i class="pi pi-shop order-metric-pill__icon" aria-hidden="true"></i>
                <span class="order-metric-pill__value">{{ suppliers().length }}</span>
                <span class="order-metric-pill__label">fornitori</span>
              </div>
              @if (exportOverview(); as overview) {
                @if (overview.estimatedTotal !== null) {
                  <div class="order-metric-pill order-metric-pill--accent">
                    <i class="pi pi-wallet order-metric-pill__icon" aria-hidden="true"></i>
                    <span class="order-metric-pill__value">{{ formatCompactPrice(overview.estimatedTotal) }}</span>
                    <span class="order-metric-pill__label">totale stimato</span>
                  </div>
                }
              }
            </div>
          </div>

          @if (pageError()) {
            <div class="app-alert-error">
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
                  [suppliers]="suppliers()"
                  [orderImportPreviewState]="orderImportPreviewState()"
                  [orderFileUploading]="orderFileUploading()"
                  [orderFileImporting]="orderFileImporting()"
                  [orderFileMessage]="orderFileMessage()"
                  [supplierUploadState]="supplierUploadState()"
                  [supplierPreviewState]="supplierPreviewState()"
                  [supplierCreating]="supplierCreating()"
                  (orderFileSelected)="onOrderFileSelected($event)"
                  (orderImportConfirmed)="onOrderImportConfirmed($event)"
                  (supplierFileSelected)="onSupplierFileSelected($event)"
                  (supplierMappingConfirmed)="onSupplierMappingConfirmed($event)"
                  (supplierCreateRequested)="onSupplierCreateRequested($event)"
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
            class="app-link-muted inline-flex items-center gap-2 text-sm font-medium no-underline transition"
          >
            Ã¢â€ Â Torna agli ordini
          </a>
          <h1 class="font-heading text-3xl font-semibold text-[var(--app-text)]">Ordine non trovato</h1>
          <p class="max-w-2xl text-sm leading-7 text-[var(--app-text-muted)]">
            Non sono riuscito a trovare questo ordine nel backend o non hai accesso al tenant
            corretto.
            Riaprilo da
            <code class="app-code">/app/orders</code>
            e riprova.
          </p>
        </section>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailPageComponent {
  private readonly italianShortDateFormatter = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short'
  });
  private readonly italianMetaDateFormatter = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  private readonly italianTimeFormatter = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });
  private readonly compactCurrencyFormatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  private draftSyncTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ordersStore = inject(OrdersSessionStore);
  private readonly ordersService = inject(OrdersService);

  readonly activeTab = signal<'import' | 'products' | 'comparison' | 'export'>('import');
  readonly orderLoading = signal(false);
  readonly orderImportPreviewState = signal<OrderImportPreviewState | null>(null);
  readonly orderFileUploading = signal(false);
  readonly orderFileImporting = signal(false);
  readonly orderFileMessage = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly pageError = signal<string | null>(null);
  readonly supplierComparisonRequested = signal(false);
  readonly supplierComparisonLoading = signal(false);
  readonly supplierComparisonError = signal<string | null>(null);
  readonly supplierComparisonSelections = signal<Record<string, SupplierComparisonSelection>>({});
  readonly supplierComparisonQuantities = signal<Record<string, number | null>>({});
  readonly supplierLoadingState = signal<Record<string, boolean>>({});
  readonly supplierUploadState = signal<Record<string, UploadCardState>>({});
  readonly supplierPreviewState = signal<Record<string, SupplierUploadPreviewState>>({});
  readonly supplierCreating = signal(false);
  readonly fetchedOrderIds = signal<Record<string, boolean>>({});
  readonly autoComparisonAttemptedOrderIds = signal<Record<string, boolean>>({});

  orderDisplayLabel(createdAt: string): string {
    const date = this.parseDate(createdAt);

    if (!date) {
      return 'Ordine';
    }

    const formatted = this.italianShortDateFormatter.format(date);
    return `Ordine ${this.capitalize(formatted)}`;
  }

  orderStatusLabel(status: string | undefined): string {
    const normalized = (status ?? '').trim().toLowerCase();

    if (normalized === 'draft') {
      return 'Bozza';
    }

    if (!normalized) {
      return 'Ordine';
    }

    return this.capitalize(normalized);
  }

  orderMetaLine(createdAt: string, productsCount: number, suppliersCount: number): string {
    const date = this.parseDate(createdAt);

    if (!date) {
      return '';
    }

    return `${this.capitalize(this.italianMetaDateFormatter.format(date))} â€¢ ${this.italianTimeFormatter.format(date)}`;
  }

  formatCompactPrice(value: number): string {
    return this.compactCurrencyFormatter.format(value);
  }

  readonly orderId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' }
  );

  readonly order = computed(() => this.ordersStore.orderById(this.orderId()));
  readonly suppliers = computed(() => this.resolveSuppliers());
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
    this.destroyRef.onDestroy(() => {
      this.clearDraftSyncTimeout();
    });

    effect(
      () => {
        const orderId = this.orderId();
        const currentOrder = this.order();

        if (!orderId) {
          return;
        }

        this.supplierComparisonRequested.set(
          (currentOrder?.supplierComparisonRows?.length ?? 0) > 0
        );

        if (!this.fetchedOrderIds()[orderId] && !this.orderLoading()) {
          void this.loadOrder(orderId);
        }
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const orderId = this.orderId();
        const currentOrder = this.order();
        const hasUploads = this.hasSupplierUploads();
        const hasComparisonRows = (currentOrder?.supplierComparisonRows?.length ?? 0) > 0;
        const hasOrderItems = (currentOrder?.items?.length ?? 0) > 0;
        const comparisonRequested = this.supplierComparisonRequested();
        const comparisonLoading = this.supplierComparisonLoading();
        const autoAttempted = orderId ? this.autoComparisonAttemptedOrderIds()[orderId] ?? false : false;

        if (!orderId || !currentOrder) {
          return;
        }

        if (!hasOrderItems || !hasUploads || hasComparisonRows) {
          return;
        }

        if (comparisonRequested || comparisonLoading || autoAttempted) {
          return;
        }

        this.markAutoComparisonAsAttempted(orderId);
        void this.autoLoadSupplierComparison(orderId);
      },
      { allowSignalWrites: true }
    );
  }

  onOrderFileSelected(file: File): void {
    void this.previewOrderImportFile(file);
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private capitalize(value: string): string {
    if (!value) {
      return value;
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  async onOrderImportConfirmed(payload: {
    file: File;
    mapping: OrderImportColumnMapping | null;
  }): Promise<void> {
    const orderId = this.orderId();

    if (!orderId) {
      return;
    }

    this.orderFileImporting.set(true);
    this.orderFileMessage.set('Importazione in corso...');
    this.pageError.set(null);

    try {
      const response = await firstValueFrom(
        this.ordersService.importOrderFile(orderId, payload.file, payload.mapping)
      );
      await this.refreshOrderAfterGenericImport(orderId, response);
      this.orderImportPreviewState.set(null);
      this.orderFileMessage.set(
        `Importazione completata: ${response.importedItems} prodotti aggiunti al draft.`
      );
    } catch (error: unknown) {
      this.orderFileMessage.set(this.toMessage(error, 'Import ordine non riuscito.'));
    } finally {
      this.orderFileImporting.set(false);
    }
  }

  async previewOrderImportFile(file: File): Promise<void> {
    const orderId = this.orderId();

    if (!orderId) {
      return;
    }

    this.orderFileUploading.set(true);
    this.pageError.set(null);
    this.orderFileMessage.set('Analisi file in corso...');
    this.orderImportPreviewState.set({
      file,
      preview: null,
      mapping: null
    });

    try {
      const preview = await firstValueFrom(this.ordersService.previewOrderFile(orderId, file));
      this.orderImportPreviewState.set({
        file,
        preview,
        mapping: preview.detectedMapping
      });
      this.orderFileMessage.set(
        preview.requiresMapping
          ? 'Preview pronta. Conferma il mapping delle colonne.'
          : 'Preview pronta. Puoi confermare l\'import.'
      );
    } catch (error: unknown) {
      this.orderImportPreviewState.set(null);
      this.orderFileMessage.set(this.toMessage(error, 'Analisi file ordine non riuscita.'));
    } finally {
      this.orderFileUploading.set(false);
    }
  }

  supplierUploading(supplierId: string): boolean {
    return this.supplierLoadingState()[supplierId] ?? false;
  }

  onSupplierFileSelected(payload: { supplierId: string; file: File }): void {
    void this.previewSupplierFile(payload.supplierId, payload.file);
  }

  async onSupplierMappingConfirmed(payload: {
    supplierId: string;
    file: File;
    mapping: SupplierColumnMapping | null;
  }): Promise<void> {
    await this.uploadSupplierFile(payload.supplierId, payload.file, {
      mapping: payload.mapping,
      persistMapping: true
    });
  }

  async onSupplierCreateRequested(payload: SupplierCreatePayload): Promise<void> {
    const orderId = this.orderId();

    if (!orderId) {
      return;
    }

    this.supplierCreating.set(true);
    this.pageError.set(null);

    try {
      const createdSupplier = await firstValueFrom(
        this.ordersService.createOrderSupplier(orderId, payload)
      );
      const currentOrder = this.order();
      const nextSuppliers = [
        ...(currentOrder?.suppliers ?? []).filter((supplier) => supplier.id !== createdSupplier.id),
        createdSupplier
      ].sort((left, right) => left.name.localeCompare(right.name));
      this.ordersStore.upsertOrder({
        ...(currentOrder ?? {
          id: orderId,
          status: 'draft',
          createdAt: new Date().toISOString(),
          items: [],
          reviewItems: [],
          supplierUploads: {}
        }),
        suppliers: nextSuppliers
      });
    } catch (error: unknown) {
      this.pageError.set(this.toMessage(error, 'Creazione fornitore non riuscita.'));
    } finally {
      this.supplierCreating.set(false);
    }
  }

  async previewSupplierFile(supplierId: string, file: File): Promise<void> {
    await this.uploadSupplierFile(supplierId, file, {
      persistMapping: false
    });
  }

  async uploadSupplierFile(
    supplierId: string,
    fileFromEvent?: File,
    options?: {
      mapping?: SupplierColumnMapping | null;
      persistMapping?: boolean;
    }
  ): Promise<void> {
    const orderId = this.orderId();
    const file = fileFromEvent;

    if (!orderId || !file) {
      return;
    }

    this.setSupplierLoading(supplierId, true);
    this.setSupplierUploadState(supplierId, {
      status: 'uploading',
      fileName: file.name,
      message:
        options?.persistMapping
          ? `Salvataggio mapping per ${file.name}...`
          : `Analisi file fornitore ${file.name}...`,
      updatedAt: new Date().toISOString()
    });
    this.pageError.set(null);
    this.setSupplierPreviewState(supplierId, {
      file,
      preview: options?.persistMapping ? this.supplierPreviewState()[supplierId]?.preview ?? null : null,
      mapping: options?.mapping ?? this.supplierPreviewState()[supplierId]?.mapping ?? null,
      confirming: !!options?.persistMapping,
      error: null
    });

    try {
      const response = await firstValueFrom(
        this.ordersService.uploadSupplierFile(orderId, supplierId, file, options)
      );

      if (options?.persistMapping) {
        const refreshedOrder = await firstValueFrom(this.ordersService.getOrderById(orderId));
        this.ordersStore.upsertOrder(refreshedOrder.order);
        this.supplierComparisonRequested.set(false);
        this.supplierComparisonError.set(null);
        this.ordersStore.setSupplierComparisonRows(orderId, []);
        this.clearSupplierPreviewState(supplierId);
        this.setSupplierUploadState(supplierId, {
          status: 'completed',
          fileName: response.fileName,
          message: response.message || 'Upload completato.',
          updatedAt: response.uploadedAt
        });
      } else {
        this.setSupplierPreviewState(supplierId, {
          file,
          preview: response.preview ?? null,
          mapping: response.preview?.detectedMapping ?? null,
          confirming: false,
          error: null
        });
        this.setSupplierUploadState(supplierId, {
          status: 'processing',
          fileName: response.fileName,
          message:
            response.message || 'Preview pronta. Conferma le colonne per salvare il mapping.',
          updatedAt: response.uploadedAt
        });
      }
    } catch (error: unknown) {
      const message = this.toMessage(error, `Upload file fornitore ${supplierId} non riuscito.`);
      this.setSupplierPreviewState(supplierId, {
        file,
        preview: this.supplierPreviewState()[supplierId]?.preview ?? null,
        mapping: options?.mapping ?? this.supplierPreviewState()[supplierId]?.mapping ?? null,
        confirming: false,
        error: message
      });
      this.setSupplierUploadState(supplierId, {
        status: 'failed',
        fileName: file.name,
        message,
        updatedAt: new Date().toISOString()
      });
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
        selectedPrice: option.netPrice ?? option.price,
        selectedPackageSize: option.packageSize
      }
    }));
    this.scheduleDraftSync();
  }

  onSupplierComparisonQuantityChange(payload: { ean: string; quantity: number | null }): void {
    this.supplierComparisonQuantities.update((quantities) => ({
      ...quantities,
      [payload.ean]: payload.quantity
    }));
    this.scheduleDraftSync();
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
      const exportItems = this.buildPersistedOrderItemPayload();

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

  private markAutoComparisonAsAttempted(orderId: string): void {
    this.autoComparisonAttemptedOrderIds.update((state) => ({
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
      const packageSize = foundInSuppliers ? comparisonRow?.selectedPackageSize ?? 1 : 1;
      const packPrice =
        selectedPrice !== null ? selectedPrice * packageSize : null;
      const totalPieces =
        normalizedQuantity !== null ? normalizedQuantity * packageSize : null;
      const lineTotal = calculateRoundedLineTotal(selectedPrice, totalPieces);

      return {
        ean: item.ean,
        description: item.description ?? comparisonRow?.description ?? `Prodotto ${index + 1}`,
        quantity: normalizedQuantity,
        packageSize,
        totalPieces,
        supplierId: foundInSuppliers ? comparisonRow?.selectedSupplierId ?? '' : '',
        supplierName: foundInSuppliers ? comparisonRow?.selectedSupplierName ?? '' : '',
        unitPrice: selectedPrice,
        packPrice,
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
      current.totalQuantity += row.totalPieces ?? 0;
      current.missingPricesCount += row.unitPrice === null ? 1 : 0;
      current.missingQuantitiesCount += row.quantity === null ? 1 : 0;
      current.items.push(row);

      if (row.lineTotal !== null && current.subtotal !== null) {
        current.subtotal = roundToCents(current.subtotal + row.lineTotal);
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
      estimatedTotal: sumRoundedCurrency(rows.map((row) => row.lineTotal)),
      productsCount: rows.length,
      suppliersCount: new Set(rows.map((row) => row.supplierId).filter(Boolean)).size,
      totalQuantity: rows.reduce((sum, row) => sum + (row.totalPieces ?? 0), 0),
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

  private setSupplierUploadState(supplierId: string, state: UploadCardState): void {
    this.supplierUploadState.update((currentState) => ({
      ...currentState,
      [supplierId]: state
    }));
  }

  private setSupplierPreviewState(
    supplierId: string,
    state: SupplierUploadPreviewState
  ): void {
    this.supplierPreviewState.update((currentState) => ({
      ...currentState,
      [supplierId]: state
    }));
  }

  private clearSupplierPreviewState(supplierId: string): void {
    this.supplierPreviewState.update((currentState) => {
      const nextState = { ...currentState };
      delete nextState[supplierId];
      return nextState;
    });
  }

  private resolveSuppliers(): SupplierDefinition[] {
    const currentOrder = this.order();

    if (!currentOrder) {
      return [];
    }

    const resolvedSuppliers = new Map<string, SupplierDefinition>();

    for (const supplier of currentOrder.suppliers ?? []) {
      if (supplier.id) {
        resolvedSuppliers.set(supplier.id, supplier);
      }
    }

    for (const row of currentOrder.supplierComparisonRows ?? []) {
      for (const supplier of row.availableSuppliers) {
        if (!resolvedSuppliers.has(supplier.supplierId)) {
          resolvedSuppliers.set(supplier.supplierId, {
            id: supplier.supplierId,
            name: supplier.supplierName
          });
        }
      }
    }

    for (const [supplierId, uploads] of Object.entries(currentOrder.supplierUploads)) {
      if (!resolvedSuppliers.has(supplierId)) {
        resolvedSuppliers.set(supplierId, {
          id: supplierId,
          name: uploads.at(-1)?.supplierId ?? supplierId
        });
      }
    }

    return Array.from(resolvedSuppliers.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
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
        const manualSelection = selections[row.ean];
        const selectedOption = resolveSelectedSupplierComparisonOffer(row, manualSelection);

        return {
          ean: row.ean,
          description: row.description,
          quantity: quantityOverrides[row.ean] ?? row.quantity,
          bestOffer: row.bestOffer,
          selectedSupplierId: selectedOption?.supplierId ?? '',
          selectedSupplierName: selectedOption?.supplierName ?? '',
          selectedPrice: selectedOption?.netPrice ?? selectedOption?.price ?? null,
          selectedPackageSize: selectedOption?.packageSize ?? 1,
          availableSuppliers: row.availableSuppliers
        };
      })
      .sort((left, right) => left.ean.localeCompare(right.ean));
  }

  private scheduleDraftSync(): void {
    this.clearDraftSyncTimeout();
    this.draftSyncTimeoutId = setTimeout(() => {
      this.draftSyncTimeoutId = null;
      void this.syncDraftItems();
    }, 400);
  }

  private clearDraftSyncTimeout(): void {
    if (this.draftSyncTimeoutId === null) {
      return;
    }

    clearTimeout(this.draftSyncTimeoutId);
    this.draftSyncTimeoutId = null;
  }

  private async refreshOrderAfterGenericImport(
    orderId: string,
    importResponse: ImportOrderFileResponse
  ): Promise<void> {
    try {
      const response = await firstValueFrom(this.ordersService.getOrderById(orderId));
      this.ordersStore.upsertOrder(response.order);
    } catch (error: unknown) {
      this.ordersStore.setImportResult(orderId, {
        status: this.order()?.status,
        items: this.order()?.items ?? [],
        reviewItems: [],
        importResult: {
          importedItems: importResponse.itemsPreview.map((item) => ({
            ...item,
            status: 'IMPORTED'
          })),
          rejectedItems: [],
          importSuccessRate: null,
          firstImportedItems: importResponse.itemsPreview.slice(0, 5)
        }
      });
      this.pageError.set(
        'Import completato, ma non sono riuscito a ricaricare il dettaglio ordine. Ricarica la pagina.'
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

  private async autoLoadSupplierComparison(orderId: string): Promise<void> {
    if (this.supplierComparisonLoading()) {
      return;
    }

    this.supplierComparisonRequested.set(true);
    this.supplierComparisonLoading.set(true);
    this.supplierComparisonError.set(null);

    try {
      await this.refreshSupplierComparison(orderId);
    } finally {
      this.supplierComparisonLoading.set(false);
    }
  }

  private async syncDraftItems(): Promise<void> {
    const orderId = this.orderId();

    if (!orderId) {
      return;
    }

    const items = this.buildPersistedOrderItemPayload();

    this.ordersStore.setOrderItems(orderId, this.buildLocalDraftItems(items));

    try {
      await firstValueFrom(this.ordersService.syncOrderItems(orderId, items));
    } catch (error: unknown) {
      this.pageError.set(
        this.toMessage(error, 'Non sono riuscito a salvare le modifiche del draft ordine.')
      );
    }
  }

  private buildPersistedOrderItemPayload(): Array<{
    ean: string;
    quantity: number;
    supplierId?: string;
  }> {
    return this.orderExportSummaryRows()
      .filter(
        (row) =>
          typeof row.quantity === 'number' &&
          Number.isFinite(row.quantity) &&
          row.quantity > 0 &&
          row.ean.trim().length > 0
      )
      .map((row) => ({
        ean: row.ean,
        quantity: row.quantity as number,
        ...(row.supplierId ? { supplierId: row.supplierId } : {})
      }));
  }

  private buildLocalDraftItems(
    items: Array<{ ean: string; quantity: number; supplierId?: string }>
  ): OrderItem[] {
    return items.map((item) => ({
      ...item,
      status: 'PENDING'
    }));
  }

  private toMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}


