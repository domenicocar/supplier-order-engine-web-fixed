import {
  HttpErrorResponse,
} from '@angular/common/http';
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
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TabsModule } from 'primeng/tabs';

import {
  ImportOrderFileResponse,
  OrderFilePreviewResult,
  OrderImportColumnMapping,
  OrderItem,
  ProductMappingResponse,
  ReviewItem,
  SessionOrder,
  SupplierColumnMapping,
  SupplierComparisonOffer,
  SupplierComparisonRow
} from '../../../models/order.models';
import { SupplierCreatePayload, SupplierDefinition } from '../../../models/supplier.models';
import {
  PaymentRequiredAction,
  PaymentRequiredDialogComponent
} from '../../../shared/components/payment-required-dialog.component';
import { OrdersSessionStore } from '../../../services/orders-session.store';
import { OrdersService } from '../../../services/orders.service';
import { AuthStore } from '../../auth/stores/auth.store';
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
  supplierAvailabilityLabel,
  sumRoundedCurrency
} from '../components/order-detail-view.utils';
import { OrderImportTabComponent } from '../components/order-import-tab.component';
import { SupplierComparisonTabComponent } from '../components/supplier-comparison-tab.component';

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    ButtonModule,
    OrderExportTabComponent,
    OrderImportTabComponent,
    RouterLink,
    SupplierComparisonTabComponent,
    DialogModule,
    TabsModule,
    PaymentRequiredDialogComponent
  ],
  template: `
    @if (orderLoading()) {
      <section class="flex flex-col gap-6">
        <div class="order-header surface-panel">
          <div class="order-header__main">
            <a
              routerLink="/app/orders"
              class="order-header__back app-link-muted inline-flex items-center gap-2 text-sm font-medium no-underline transition"
            >
              <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
              <span>Torna agli ordini</span>
            </a>

            <div class="flex flex-col gap-3">
              <div class="h-10 w-56 animate-pulse rounded-2xl bg-slate-200/80"></div>
              <div class="h-5 w-72 animate-pulse rounded-full bg-slate-100"></div>
            </div>
          </div>

          <div class="order-header__metrics">
            @for (placeholder of [1, 2, 3]; track placeholder) {
              <div class="order-metric-pill">
                <div class="h-5 w-5 animate-pulse rounded-full bg-slate-200/80"></div>
                <div class="h-5 w-12 animate-pulse rounded-full bg-slate-200/80"></div>
                <div class="h-4 w-20 animate-pulse rounded-full bg-slate-100"></div>
              </div>
            }
          </div>
        </div>

        <p-tabs [value]="'import'" [lazy]="true" class="flex flex-col gap-6">
          <p-tablist>
            <p-tab value="import">Import</p-tab>
            <p-tab value="comparison" [disabled]="true">Confronto fornitori</p-tab>
            <p-tab value="export" [disabled]="true">Riepilogo e Export</p-tab>
          </p-tablist>

          <p-tabpanels>
            <p-tabpanel value="import">
              <section class="surface-panel p-8">
                <div class="mb-6">
                  <div class="h-4 w-28 animate-pulse rounded-full bg-slate-100"></div>
                  <div class="mt-4 h-8 w-72 animate-pulse rounded-2xl bg-slate-200/80"></div>
                  <div class="mt-3 h-4 w-full max-w-3xl animate-pulse rounded-full bg-slate-100"></div>
                  <div class="mt-2 h-4 w-4/5 max-w-2xl animate-pulse rounded-full bg-slate-100"></div>
                </div>

                <div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                  <div class="flex flex-col items-center text-center">
                    <div class="mb-5 h-20 w-20 animate-pulse rounded-full bg-slate-100"></div>
                    <div class="h-7 w-40 animate-pulse rounded-2xl bg-slate-200/80"></div>
                    <div class="mt-3 h-4 w-full max-w-md animate-pulse rounded-full bg-slate-100"></div>
                    <div class="mt-2 h-4 w-3/4 max-w-sm animate-pulse rounded-full bg-slate-100"></div>
                    <div class="mt-6 h-10 w-56 animate-pulse rounded-full bg-slate-100"></div>
                  </div>
                </div>
              </section>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      </section>
    } @else {
      @if (order(); as currentOrder) {
        <section class="flex flex-col gap-6">
          @if (successToastMessage()) {
            <div class="pointer-events-none fixed bottom-4 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 sm:bottom-6">
              <div class="pointer-events-auto app-alert-success flex items-start gap-3 rounded-3xl px-4 py-4 shadow-[0_18px_45px_rgba(6,95,70,0.18)]">
                <div class="app-icon-circle mt-0.5">
                  <i class="pi pi-check" aria-hidden="true"></i>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold">Prodotto associato</p>
                  <p class="mt-1 text-sm">
                    {{ successToastMessage() }}
                  </p>
                </div>
                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200/80 bg-white/70 text-emerald-900 transition hover:bg-white"
                  aria-label="Chiudi notifica"
                  (click)="dismissSuccessToast()"
                >
                  <i class="pi pi-times text-xs" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          }

          <div class="order-header surface-panel">
            <div class="order-header__main">
              <a
                routerLink="/app/orders"
                class="order-header__back app-link-muted inline-flex items-center gap-2 text-sm font-medium no-underline transition"
              >
                <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
                <span>Torna agli ordini</span>
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

          @if (pageNotice()) {
            <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              {{ pageNotice() }}
            </div>
          }

          @if (isReadOnlyOrder()) {
            <div class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-[var(--app-text)]">
              Questo ordine e stato chiuso definitivamente ed e ora disponibile solo in modalita storica.
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
              <p-tab value="comparison" [disabled]="orderLoading()">Confronto fornitori</p-tab>
              <p-tab value="export" [disabled]="orderLoading()">Riepilogo e Export</p-tab>
            </p-tablist>

            <p-tabpanels>
              <p-tabpanel value="import">
                <div
                  [class.pointer-events-none]="isReadOnlyOrder()"
                  [class.opacity-60]="isReadOnlyOrder()"
                >
                  <app-order-import-tab
                    [order]="currentOrder"
                    [suppliers]="suppliers()"
                    [orderImportPreviewState]="orderImportPreviewState()"
                    [orderFileUploading]="orderFileUploading()"
                    [orderFileImporting]="orderFileImporting()"
                    [orderFileMessage]="orderFileMessage()"
                    [supplierUploadState]="supplierUploadState()"
                    [pendingSupplierDraftState]="pendingSupplierDraftState()"
                    [supplierPreviewState]="supplierPreviewState()"
                    [supplierCreating]="supplierCreating()"
                    [supplierPreferenceUpdatingId]="supplierPreferenceUpdatingId()"
                    [supplierComparisonLoading]="supplierComparisonLoading()"
                    [hasSupplierUploads]="hasSupplierUploads()"
                    (orderFileSelected)="onOrderFileSelected($event)"
                    (orderImportConfirmed)="onOrderImportConfirmed($event)"
                    (supplierDraftFileSelected)="onSupplierDraftFileSelected($event)"
                    (supplierFileSelected)="onSupplierFileSelected($event)"
                    (supplierPreferredChanged)="onSupplierPreferredChanged($event)"
                    (supplierMappingPreviewRequested)="onSupplierMappingPreviewRequested($event)"
                    (supplierMappingConfirmed)="onSupplierMappingConfirmed($event)"
                    (supplierComparisonRequested)="loadSupplierComparison()"
                  />
                </div>
              </p-tabpanel>

              <p-tabpanel value="comparison">
                <div
                  [class.pointer-events-none]="isReadOnlyOrder()"
                  [class.opacity-60]="isReadOnlyOrder()"
                >
                  <app-supplier-comparison-tab
                    [rows]="supplierComparisonRows()"
                    [loading]="supplierComparisonLoading()"
                    [requested]="supplierComparisonRequested()"
                    [error]="supplierComparisonError()"
                    [hasSupplierUploads]="hasSupplierUploads()"
                    (loadRequested)="loadSupplierComparison()"
                    (selectionChanged)="onSupplierComparisonSelectionChange($event)"
                    (quantityChanged)="onSupplierComparisonQuantityChange($event)"
                    (splitRequested)="onSupplierComparisonSplitRequested($event)"
                  />
                </div>
              </p-tabpanel>

              <p-tabpanel value="export">
                <app-order-export-tab
                  [exporting]="exporting()"
                  [closing]="closing()"
                  [readOnly]="isReadOnlyOrder()"
                  [overview]="exportOverview()"
                  [supplierSummary]="supplierExportSummary()"
                  [summaryRows]="orderExportSummaryRows()"
                  [missingRows]="missingOrderSummaryRows()"
                  [exportResult]="currentOrder.exportResult"
                  (exportRequested)="generateExport()"
                  (missingProductsExportRequested)="exportMissingProducts()"
                  (closeRequested)="closeOrder()"
                  (associateToCatalogRequested)="onAssociateToCatalogRequested($event)"
                />
              </p-tabpanel>
            </p-tabpanels>
          </p-tabs>

          <p-dialog
            [visible]="closeDialogVisible()"
            (visibleChange)="closeDialogVisible.set($event)"
            [modal]="true"
            [draggable]="false"
            [resizable]="false"
            [dismissableMask]="true"
            [style]="{ width: 'min(560px, 96vw)' }"
            header="Chiudi ordine"
          >
            <div class="flex flex-col gap-4">
              <p class="text-sm leading-7 text-[var(--app-text-muted)]">
                Stai per chiudere definitivamente
                <span class="font-semibold text-[var(--app-text)]">
                  {{ orderDisplayLabel(currentOrder.createdAt) }}
                </span>.
                Dopo la chiusura l'ordine diventera storico e non sara piu modificabile.
              </p>

              <div class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-[var(--app-text)]">
                Verranno salvati snapshot analytics e il backend provera anche a pulire PDF, file supplier e output export non piu necessari.
              </div>

              <div class="flex justify-end gap-3">
                <button
                  pButton
                  type="button"
                  class="btn-secondary justify-center !rounded-2xl !px-4 !py-2.5 !text-sm !font-semibold"
                  (click)="closeDialogVisible.set(false)"
                >
                  Annulla
                </button>
                <button
                  pButton
                  type="button"
                  class="justify-center !rounded-2xl !bg-emerald-600 !px-4 !py-2.5 !text-sm !font-semibold !text-white"
                  [disabled]="closing()"
                  (click)="confirmCloseOrder()"
                >
                  {{ closing() ? 'Chiusura in corso...' : 'Conferma chiusura' }}
                </button>
              </div>
            </div>
          </p-dialog>

          <p-dialog
            [visible]="catalogAssociationDialogVisible()"
            (visibleChange)="onCatalogAssociationDialogVisibilityChange($event)"
            [modal]="true"
            [draggable]="false"
            [resizable]="false"
            [dismissableMask]="!catalogAssociationSaving()"
            [style]="{ width: 'min(920px, 96vw)' }"
            header="Associa prodotto a catalogo"
          >
            @if (catalogAssociationSourceRow(); as sourceRow) {
              <div class="flex flex-col gap-5">
                <div class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                    Prodotto ordine
                  </p>
                  <div class="mt-3 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div>
                      <p class="text-xs text-[var(--app-text-muted)]">EAN</p>
                      <p class="text-sm font-semibold text-[var(--app-text)]">
                        {{ sourceRow.ean }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-[var(--app-text-muted)]">Descrizione</p>
                      <p class="text-sm text-[var(--app-text)]">
                        {{ sourceRow.description }}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div class="w-full lg:max-w-xl">
                    <label
                      for="catalog-association-search"
                      class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]"
                    >
                      Cerca nel catalogo
                    </label>
                    <input
                      id="catalog-association-search"
                      type="search"
                      class="app-input w-full"
                      placeholder="Cerca per EAN o descrizione..."
                      [value]="catalogAssociationQuery()"
                      (input)="onCatalogAssociationSearchInput($event)"
                    />
                  </div>

                  <p class="text-sm text-[var(--app-text-muted)]">
                    {{ catalogAssociationResultsCountLabel() }}
                  </p>
                </div>

                @if (catalogAssociationError()) {
                  <div class="app-alert-error">
                    {{ catalogAssociationError() }}
                  </div>
                }

                @if (catalogAssociationSaving()) {
                  <div class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                    <div class="flex items-center gap-3">
                      <div class="h-10 w-10 animate-pulse rounded-2xl bg-emerald-100"></div>
                      <div class="flex-1 space-y-2">
                        <div class="h-4 w-40 animate-pulse rounded-full bg-slate-200"></div>
                        <div class="h-3 w-64 max-w-full animate-pulse rounded-full bg-slate-100"></div>
                      </div>
                    </div>

                    <div class="mt-4 space-y-3">
                      @for (placeholder of [1, 2, 3]; track placeholder) {
                        <div class="grid gap-3 rounded-2xl border border-[rgba(148,163,184,0.14)] bg-white px-4 py-4 md:grid-cols-[180px_minmax(0,1fr)_180px]">
                          <div class="h-4 animate-pulse rounded-full bg-slate-200"></div>
                          <div class="h-4 animate-pulse rounded-full bg-slate-100"></div>
                          <div class="h-10 animate-pulse rounded-2xl bg-slate-100"></div>
                        </div>
                      }
                    </div>

                    <p class="mt-4 text-sm text-[var(--app-text-muted)]">
                      Associazione prodotto in corso...
                    </p>
                  </div>
                } @else if (catalogAssociationLoading()) {
                  <p class="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-[var(--app-text-muted)]">
                    Ricerca catalogo in corso...
                  </p>
                } @else if (catalogAssociationResults().length === 0) {
                  <p class="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-[var(--app-text-muted)]">
                    Nessun prodotto trovato nel catalogo per la ricerca corrente.
                  </p>
                } @else {
                  <div class="overflow-hidden rounded-2xl border border-[var(--app-border)]">
                    <div class="max-h-[420px] overflow-auto">
                      <table class="min-w-full border-separate border-spacing-0">
                        <thead class="bg-[var(--app-surface-muted)]">
                          <tr>
                            <th class="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                              EAN
                            </th>
                            <th class="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                              Descrizione
                            </th>
                            <th class="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                              Disponibilita
                            </th>
                            <th class="px-4 py-3 text-right text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                              Azione
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (candidate of catalogAssociationResults(); track candidate.ean) {
                            <tr class="transition hover:bg-[rgba(148,163,184,0.04)]">
                              <td class="border-t border-[rgba(148,163,184,0.14)] px-4 py-4 align-top text-sm font-semibold text-[var(--app-text)]">
                                {{ candidate.ean }}
                              </td>
                              <td class="border-t border-[rgba(148,163,184,0.14)] px-4 py-4 align-top text-sm text-[var(--app-text)]">
                                {{ candidate.description }}
                              </td>
                              <td class="border-t border-[rgba(148,163,184,0.14)] px-4 py-4 align-top text-sm text-[var(--app-text-muted)]">
                                {{
                                  candidate.availableSuppliers.length > 0
                                    ? supplierAvailabilityLabel(candidate.availableSuppliers.length)
                                    : 'Prodotto di catalogo senza offerte caricate'
                                }}
                              </td>
                              <td class="border-t border-[rgba(148,163,184,0.14)] px-4 py-4 text-right align-top">
                                <button
                                  type="button"
                                  class="btn-primary inline-flex justify-center !rounded-2xl !px-4 !py-2.5 !text-sm !font-semibold"
                                  [disabled]="catalogAssociationSaving()"
                                  (click)="confirmCatalogAssociation(candidate)"
                                >
                                  {{
                                    catalogAssociationSaving()
                                      ? 'Salvataggio...'
                                      : 'Associa questo prodotto'
                                  }}
                                </button>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                }

                <div class="flex justify-end gap-3">
                  <button
                    type="button"
                    class="btn-secondary justify-center !rounded-2xl !px-4 !py-2.5 !text-sm !font-semibold"
                    [disabled]="catalogAssociationSaving()"
                    (click)="closeCatalogAssociationDialog()"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            }
          </p-dialog>

          <app-payment-required-dialog
            [visible]="paymentRequiredDialogVisible()"
            [action]="paymentRequiredAction()"
            (visibleChange)="paymentRequiredDialogVisible.set($event)"
          />
        </section>
      } @else {
        <section class="surface-panel flex flex-col gap-4 p-8">
          <a
            routerLink="/app/orders"
            class="app-link-muted inline-flex items-center gap-2 text-sm font-medium no-underline transition"
          >
            <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
            <span>Torna agli ordini</span>
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
  styles: [
    `
      :host ::ng-deep .p-tabpanels {
        background: transparent;
        padding: 0;
      }
    `
  ],
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
  private catalogSearchTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private successToastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private catalogSearchRequestSequence = 0;
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authStore = inject(AuthStore);
  private readonly ordersStore = inject(OrdersSessionStore);
  private readonly ordersService = inject(OrdersService);

  readonly activeTab = signal<'import' | 'comparison' | 'export'>('import');
  readonly orderLoading = signal(false);
  readonly orderImportPreviewState = signal<OrderImportPreviewState | null>(null);
  readonly orderFileUploading = signal(false);
  readonly orderFileImporting = signal(false);
  readonly orderFileMessage = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly closing = signal(false);
  readonly closeDialogVisible = signal(false);
  readonly paymentRequiredDialogVisible = signal(false);
  readonly paymentRequiredAction = signal<PaymentRequiredAction>('export-order');
  readonly catalogAssociationDialogVisible = signal(false);
  readonly catalogAssociationSourceRow = signal<OrderExportSummaryRow | null>(null);
  readonly catalogAssociationQuery = signal('');
  readonly catalogAssociationResults = signal<SupplierComparisonRow[]>([]);
  readonly catalogAssociationLoading = signal(false);
  readonly catalogAssociationSaving = signal(false);
  readonly catalogAssociationError = signal<string | null>(null);
  readonly pageError = signal<string | null>(null);
  readonly pageNotice = signal<string | null>(null);
  readonly successToastMessage = signal<string | null>(null);
  readonly supplierComparisonRequested = signal(false);
  readonly supplierComparisonLoading = signal(false);
  readonly supplierComparisonError = signal<string | null>(null);
  readonly supplierComparisonSelections = signal<Record<string, SupplierComparisonSelection>>({});
  readonly supplierComparisonQuantities = signal<Record<string, number | null>>({});
  readonly supplierLoadingState = signal<Record<string, boolean>>({});
  readonly pendingSupplierDraftState = signal<Record<string, UploadCardState>>({});
  readonly supplierUploadState = signal<Record<string, UploadCardState>>({});
  readonly supplierPreviewState = signal<Record<string, SupplierUploadPreviewState>>({});
  readonly supplierCreating = signal(false);
  readonly supplierPreferenceUpdatingId = signal<string | null>(null);
  readonly fetchedOrderIds = signal<Record<string, boolean>>({});
  readonly autoComparisonAttemptedOrderIds = signal<Record<string, boolean>>({});
  readonly supplierAvailabilityLabel = supplierAvailabilityLabel;

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

    if (normalized === 'closed') {
      return 'Chiuso';
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

    return `${this.capitalize(this.italianMetaDateFormatter.format(date))} - ${this.italianTimeFormatter.format(date)}`;
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
  readonly isReadOnlyOrder = computed(
    () => (this.order()?.status ?? '').trim().toLowerCase() === 'closed'
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearDraftSyncTimeout();
      this.clearCatalogSearchTimeout();
      this.clearSuccessToastTimeout();
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
        const comparisonRequested = this.supplierComparisonRequested();
        const comparisonLoading = this.supplierComparisonLoading();
        const autoAttempted = orderId ? this.autoComparisonAttemptedOrderIds()[orderId] ?? false : false;

        if (!orderId || !currentOrder) {
          return;
        }

        if (!this.shouldAutoLoadSupplierComparison(currentOrder)) {
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
    if (this.isReadOnlyOrder()) {
      return;
    }

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
    if (this.isReadOnlyOrder()) {
      return;
    }

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
    if (this.isReadOnlyOrder()) {
      return;
    }

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
    if (this.isReadOnlyOrder()) {
      return;
    }

    void this.previewSupplierFile(payload.supplierId, payload.file);
  }

  async onSupplierDraftFileSelected(payload: {
    draftId: string;
    name: string;
    file: File;
    preferred: boolean;
  }): Promise<void> {
    if (this.isReadOnlyOrder()) {
      return;
    }

    const orderId = this.orderId();
    const supplierName = payload.name.trim();

    if (!orderId || !supplierName) {
      return;
    }

    this.supplierCreating.set(true);
    this.pageError.set(null);
    this.setPendingSupplierDraftState(payload.draftId, {
      status: 'uploading',
      fileName: payload.file.name,
      message: `Creazione fornitore ${supplierName}...`,
      updatedAt: new Date().toISOString()
    });

    try {
      const createdSupplier = await firstValueFrom(
        this.ordersService.createOrderSupplier(orderId, {
          name: supplierName,
          preferred: payload.preferred
        })
      );
      this.upsertSupplier(orderId, createdSupplier);
      this.setPendingSupplierDraftState(payload.draftId, {
        status: 'completed',
        fileName: payload.file.name,
        message: `${supplierName} creato correttamente.`,
        updatedAt: new Date().toISOString()
      });

      await this.previewSupplierFile(createdSupplier.id, payload.file);
    } catch (error: unknown) {
      const message = this.toMessage(error, 'Creazione fornitore non riuscita.');
      this.pageError.set(message);
      this.setPendingSupplierDraftState(payload.draftId, {
        status: 'failed',
        fileName: payload.file.name,
        message,
        updatedAt: new Date().toISOString()
      });
    } finally {
      this.supplierCreating.set(false);
    }
  }

  async onSupplierPreferredChanged(payload: {
    supplierId: string;
    preferred: boolean;
  }): Promise<void> {
    if (this.isReadOnlyOrder()) {
      return;
    }

    const orderId = this.orderId();

    if (!orderId) {
      return;
    }

    this.supplierPreferenceUpdatingId.set(payload.supplierId);
    this.pageError.set(null);

    try {
      await firstValueFrom(
        this.ordersService.setPreferredOrderSupplier(
          orderId,
          payload.supplierId,
          payload.preferred
        )
      );
      const refreshedOrder = await firstValueFrom(this.ordersService.getOrderById(orderId));
      this.ordersStore.upsertOrder(refreshedOrder.order);
      await this.loadSupplierComparison();
    } catch (error: unknown) {
      this.pageError.set(
        this.toMessage(error, 'Non sono riuscito ad aggiornare il fornitore favorito.')
      );
    } finally {
      this.supplierPreferenceUpdatingId.set(null);
    }
  }

  async onSupplierMappingConfirmed(payload: {
    supplierId: string;
    file: File;
    mapping: SupplierColumnMapping | null;
  }): Promise<void> {
    if (this.isReadOnlyOrder()) {
      return;
    }

    await this.uploadSupplierFile(payload.supplierId, payload.file, {
      mapping: payload.mapping,
      persistMapping: true
    });
  }

  async onSupplierMappingPreviewRequested(payload: {
    supplierId: string;
    file: File;
    mapping: SupplierColumnMapping;
  }): Promise<void> {
    if (this.isReadOnlyOrder()) {
      return;
    }

    await this.uploadSupplierFile(payload.supplierId, payload.file, {
      mapping: payload.mapping,
      persistMapping: false
    });
  }

  async onSupplierCreateRequested(payload: SupplierCreatePayload): Promise<void> {
    if (this.isReadOnlyOrder()) {
      return;
    }

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
      this.upsertSupplier(orderId, createdSupplier);
    } catch (error: unknown) {
      this.pageError.set(this.toMessage(error, 'Creazione fornitore non riuscita.'));
    } finally {
      this.supplierCreating.set(false);
    }
  }

  async previewSupplierFile(supplierId: string, file: File): Promise<void> {
    if (this.isReadOnlyOrder()) {
      return;
    }

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
      preview:
        options?.mapping || options?.persistMapping
          ? this.supplierPreviewState()[supplierId]?.preview ?? null
          : null,
      mapping:
        options?.persistMapping
          ? options.mapping ?? this.supplierPreviewState()[supplierId]?.mapping ?? null
          : this.supplierPreviewState()[supplierId]?.mapping ?? null,
      confirming: !!options?.persistMapping,
      previewing: !!options?.mapping && !options?.persistMapping,
      error: null
    });

    try {
      const response = await firstValueFrom(
        this.ordersService.uploadSupplierFile(orderId, supplierId, file, options)
      );

      if (options?.persistMapping) {
        const refreshedOrder = await firstValueFrom(this.ordersService.getOrderById(orderId));
        this.ordersStore.upsertOrder(refreshedOrder.order);
        if (response.products.length > 0) {
          this.ordersStore.appendSupplierUpload(orderId, response);
        }
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
          mapping: options?.mapping ?? response.preview?.detectedMapping ?? null,
          confirming: false,
          previewing: false,
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
        mapping: this.supplierPreviewState()[supplierId]?.mapping ?? null,
        confirming: false,
        previewing: false,
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

  onSupplierComparisonSelectionChange(payload: { lineId: string; supplierId: string }): void {
    if (this.isReadOnlyOrder()) {
      return;
    }

    const row = this.supplierComparisonRows().find(
      (currentRow) => currentRow.lineId === payload.lineId
    );
    const option = row?.availableSuppliers.find(
      (currentOption) => currentOption.supplierId === payload.supplierId
    );

    if (!option) {
      return;
    }

    this.supplierComparisonSelections.update((selections) => ({
      ...selections,
      [payload.lineId]: {
        selectedSupplierId: option.supplierId,
        selectedSupplierName: option.supplierName,
        selectedPrice: option.netPrice ?? option.price,
        selectedPackageSize: option.packageSize
      }
    }));
    this.scheduleDraftSync();
  }

  onSupplierComparisonQuantityChange(payload: { lineId: string; quantity: number | null }): void {
    if (this.isReadOnlyOrder()) {
      return;
    }

    this.supplierComparisonQuantities.update((quantities) => ({
      ...quantities,
      [payload.lineId]: payload.quantity
    }));
    this.scheduleDraftSync();
  }

  onSupplierComparisonSplitRequested(payload: { lineId: string }): void {
    if (this.isReadOnlyOrder()) {
      return;
    }

    const orderId = this.orderId();

    if (!orderId) {
      return;
    }

    const draftItems = this.buildDraftOrderItems();
    const index = draftItems.findIndex((item) => item.lineId === payload.lineId);

    if (index === -1) {
      return;
    }

    const currentItem = draftItems[index];

    if (currentItem.quantity <= 1) {
      return;
    }

    const duplicatedItem = {
      ...currentItem,
      lineId: this.createClientLineId(),
      quantity: 1
    };

    const nextItems = [...draftItems];
    nextItems[index] = {
      ...currentItem,
      quantity: currentItem.quantity - 1
    };
    nextItems.splice(index + 1, 0, duplicatedItem);

    this.supplierComparisonQuantities.update((quantities) => ({
      ...quantities,
      [currentItem.lineId]: currentItem.quantity - 1,
      [duplicatedItem.lineId]: 1
    }));

    this.supplierComparisonSelections.update((selections) => {
      const currentSelection = selections[currentItem.lineId];

      if (!currentSelection) {
        return selections;
      }

      return {
        ...selections,
        [duplicatedItem.lineId]: { ...currentSelection }
      };
    });

    this.runWithScrollLock(() => {
      this.ordersStore.setOrderItems(orderId, this.buildLocalDraftItems(nextItems));
    });

    this.scheduleDraftSync();
  }

  onActiveTabChange(value: string | number): void {
    if (this.orderLoading() && value !== 'import') {
      return;
    }

    if (
      value === 'import' ||
      value === 'comparison' ||
      value === 'export'
    ) {
      this.activeTab.set(value);
    }
  }

  async loadSupplierComparison(): Promise<void> {
    if (this.isReadOnlyOrder()) {
      return;
    }

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
    if (this.isReadOnlyOrder()) {
      return;
    }

    if (this.openPaymentRequiredDialogIfNeeded('export-order')) {
      return;
    }

    const orderId = this.orderId();

    if (!orderId) {
      return;
    }

    this.exporting.set(true);
    this.pageError.set(null);

    try {
      const draftItems = this.buildDraftOrderItems();
      const exportItems = this.buildPersistedOrderItemPayload(draftItems);

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
      if (this.handlePaymentRequiredError(error, 'export-order')) {
        return;
      }

      this.pageError.set(this.toMessage(error, 'Export ordine non riuscito.'));
    } finally {
      this.exporting.set(false);
    }
  }

  exportMissingProducts(): void {
    if (this.openPaymentRequiredDialogIfNeeded('export-order')) {
      return;
    }

    const rows = this.missingOrderSummaryRows();

    if (rows.length === 0) {
      return;
    }

    const currentOrder = this.order();
    const fileName = this.buildMissingProductsFileName(currentOrder?.createdAt ?? '');
    const csvContent = this.buildMissingProductsCsv(rows);
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: 'text/csv;charset=utf-8;'
    });

    this.downloadClientFile(blob, fileName);
  }

  async closeOrder(): Promise<void> {
    if (this.isReadOnlyOrder()) {
      return;
    }

    this.closeDialogVisible.set(true);
  }

  async confirmCloseOrder(): Promise<void> {
    const orderId = this.orderId();

    if (!orderId) {
      return;
    }

    this.closing.set(true);
    this.pageError.set(null);
    this.pageNotice.set(null);

    try {
      const draftItems = this.buildDraftOrderItems();
      const exportItems = this.buildPersistedOrderItemPayload(draftItems);
      await firstValueFrom(this.ordersService.syncOrderItems(orderId, exportItems));
      const response = await firstValueFrom(this.ordersService.closeOrder(orderId));
      const currentOrder = this.order();

      this.ordersStore.upsertOrder({
        ...(currentOrder ?? {
          id: orderId,
          status: 'closed',
          createdAt: new Date().toISOString(),
          items: [],
          reviewItems: [],
          supplierUploads: {}
        }),
        status: 'closed',
        estimatedTotal: response.closure?.grandTotalNet ?? currentOrder?.estimatedTotal ?? null,
        currency: response.closure?.currency ?? currentOrder?.currency ?? 'EUR',
        productsCount: response.closure?.productsCount ?? currentOrder?.productsCount ?? null,
        suppliersCount: response.closure?.suppliersCount ?? currentOrder?.suppliersCount ?? null,
        totalQuantity: response.closure?.totalQuantity ?? currentOrder?.totalQuantity ?? null,
        totalsCalculatedAt: response.closure?.closedAt ?? currentOrder?.totalsCalculatedAt ?? null,
        closure: response.closure
      });
      this.activeTab.set('export');
      this.closeDialogVisible.set(false);

      if (response.cleanupWarnings.length > 0) {
        this.pageNotice.set(
          `Ordine chiuso. Avvisi pulizia asset: ${response.cleanupWarnings.join(' ')}`
        );
      } else {
        this.pageNotice.set('Ordine chiuso correttamente e disponibile come storico.');
      }
    } catch (error: unknown) {
      this.pageError.set(this.toMessage(error, 'Chiusura ordine non riuscita.'));
    } finally {
      this.closing.set(false);
    }
  }

  onAssociateToCatalogRequested(item: OrderExportSummaryRow): void {
    if (this.isReadOnlyOrder()) {
      return;
    }

    this.catalogAssociationSourceRow.set(item);
    this.catalogAssociationDialogVisible.set(true);
    this.catalogAssociationQuery.set('');
    this.catalogAssociationResults.set([]);
    this.catalogAssociationError.set(null);
    this.catalogAssociationLoading.set(false);
    this.catalogAssociationSaving.set(false);

    const cachedCatalogRows = this.getCachedCatalogRows();

    if (cachedCatalogRows.length > 0) {
      this.catalogAssociationResults.set(this.deduplicateCatalogRows(cachedCatalogRows));
      return;
    }

    void this.loadCatalogAssociationResults('');
  }

  onCatalogAssociationDialogVisibilityChange(visible: boolean): void {
    if (!visible) {
      this.closeCatalogAssociationDialog();
    }
  }

  closeCatalogAssociationDialog(): void {
    this.clearCatalogSearchTimeout();
    this.catalogSearchRequestSequence += 1;
    this.catalogAssociationDialogVisible.set(false);
    this.catalogAssociationSourceRow.set(null);
    this.catalogAssociationQuery.set('');
    this.catalogAssociationResults.set([]);
    this.catalogAssociationLoading.set(false);
    this.catalogAssociationError.set(null);
    this.catalogAssociationSaving.set(false);
  }

  onCatalogAssociationSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.catalogAssociationQuery.set(value);
    this.scheduleCatalogSearch();
  }

  catalogAssociationResultsCountLabel(): string {
    if (this.catalogAssociationLoading()) {
      return 'Ricerca in corso...';
    }

    const count = this.catalogAssociationResults().length;
    const query = this.catalogAssociationQuery().trim();

    if (query.length > 0) {
      return `${count} risultati per "${query}"`;
    }

    return `${count} prodotti disponibili nel catalogo`;
  }

  async confirmCatalogAssociation(candidate: SupplierComparisonRow): Promise<void> {
    const orderId = this.orderId();
    const sourceRow = this.catalogAssociationSourceRow();

    if (!orderId || !sourceRow) {
      return;
    }

    this.catalogAssociationSaving.set(true);
    this.catalogAssociationError.set(null);
    this.pageError.set(null);

    try {
      const mapping = await firstValueFrom(
        this.ordersService.createProductMapping(orderId, {
          sourceEan: sourceRow.ean,
          sourceDescription: sourceRow.description,
          targetEan: candidate.ean
        })
      );

      this.upsertProductMapping(orderId, mapping);
      this.pageNotice.set(null);
      this.showSuccessToast(
        `Il prodotto ${sourceRow.ean} e stato mappato al catalogo e aggiunto all'ordine.`
      );

      this.closeCatalogAssociationDialog();

      const orderReloaded = await this.reloadOrderSnapshot(orderId);
      const catalogReloaded = await this.refreshSupplierComparison(
        orderId,
        'Associazione salvata, ma non sono riuscito ad aggiornare il catalogo.'
      );

      this.activeTab.set('export');

      if (orderReloaded && catalogReloaded) {
        this.pageNotice.set(null);
      } else if (orderReloaded) {
        this.pageNotice.set(
          `Associazione salvata per ${sourceRow.ean}. Il catalogo non si e aggiornato completamente.`
        );
      } else {
        this.pageNotice.set(
          `Associazione salvata per ${sourceRow.ean}, ma il dettaglio ordine non e stato ricaricato.`
        );
      }
    } catch (error: unknown) {
      this.catalogAssociationError.set(
        this.toMessage(error, 'Associazione prodotto a catalogo non riuscita.')
      );
    } finally {
      this.catalogAssociationSaving.set(false);
    }
  }

  private async loadOrder(orderId: string): Promise<void> {
    this.orderLoading.set(true);
    this.pageError.set(null);
    this.pageNotice.set(null);
    this.markOrderAsFetched(orderId);

    try {
      const response = await firstValueFrom(this.ordersService.getOrderById(orderId));
      const shouldAutoLoadComparison = this.shouldAutoLoadSupplierComparison(response.order);

      if (shouldAutoLoadComparison) {
        this.markAutoComparisonAsAttempted(orderId);
      }

      this.ordersStore.upsertOrder(response.order);

      if (shouldAutoLoadComparison) {
        await this.autoLoadSupplierComparison(orderId);
      }
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

  private shouldAutoLoadSupplierComparison(order: SessionOrder | null | undefined): boolean {
    if (!order) {
      return false;
    }

    if ((order.status ?? '').trim().toLowerCase() === 'closed') {
      return false;
    }

    const hasUploads = Object.values(order.supplierUploads ?? {}).some((uploads) => uploads.length > 0);
    const hasComparisonRows = (order.supplierComparisonRows?.length ?? 0) > 0;

    return hasUploads && !hasComparisonRows;
  }

  private buildOrderExportSummaryRows(): OrderExportSummaryRow[] {
    const currentOrder = this.order();

    if (!currentOrder) {
      return [];
    }

    const comparisonRows = this.supplierComparisonRows();
    const orderRowEans = new Set(
      comparisonRows
        .filter((row) => row.lineType === 'order')
        .map((row) => row.ean.trim())
        .filter((ean) => ean.length > 0)
    );

    return comparisonRows
      .filter((row) => {
        if (row.lineType === 'order') {
          return true;
        }

        return (
          !orderRowEans.has(row.ean.trim()) &&
          typeof row.quantity === 'number' &&
          Number.isFinite(row.quantity) &&
          row.quantity > 0
        );
      })
      .map((row) => {
        const normalizedQuantity =
          typeof row.quantity === 'number' && Number.isFinite(row.quantity)
            ? Math.max(0, row.quantity)
            : null;
        const foundInSuppliers = row.availableSuppliers.length > 0;
        const selectedPrice = row.selectedPrice ?? null;
        const packageSize = row.selectedPackageSize ?? 1;
        const packPrice = selectedPrice !== null ? selectedPrice * packageSize : null;
        const totalPieces =
          normalizedQuantity !== null ? normalizedQuantity * packageSize : null;
        const lineTotal = calculateRoundedLineTotal(selectedPrice, totalPieces);

        return {
          lineId: row.lineId,
          ean: row.ean,
          description: row.description,
          quantity: normalizedQuantity,
          packageSize,
          totalPieces,
          supplierId: row.selectedSupplierId,
          supplierName: row.selectedSupplierName,
          unitPrice: selectedPrice,
          packPrice,
          lineTotal,
          foundInSuppliers,
          availableSuppliersCount: row.availableSuppliers.length,
          selectedBecausePreferredTie: this.isPreferredTieSelection(row),
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

  private resolveExportRowDescription(params: {
    ean: string;
    itemDescription?: string;
    comparisonDescription?: string;
    importedDescription?: string;
    reviewDescription?: string;
    fallbackIndex: number;
  }): string {
    const candidates = [
      params.itemDescription,
      params.comparisonDescription,
      params.importedDescription,
      params.reviewDescription
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    if (params.ean.trim().length > 0) {
      return `Descrizione non disponibile (EAN ${params.ean})`;
    }

    return `Descrizione non disponibile (prodotto ${params.fallbackIndex + 1})`;
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

  private setPendingSupplierDraftState(draftId: string, state: UploadCardState): void {
    this.pendingSupplierDraftState.update((currentState) => ({
      ...currentState,
      [draftId]: state
    }));
  }

  private upsertSupplier(orderId: string, supplier: SupplierDefinition): void {
    const currentOrder = this.order();
    const otherSuppliers = (currentOrder?.suppliers ?? [])
      .filter((currentSupplier) => currentSupplier.id !== supplier.id)
      .map((currentSupplier) =>
        supplier.preferred ? { ...currentSupplier, preferred: false } : currentSupplier
      );
    const nextSuppliers = [
      supplier,
      ...otherSuppliers
    ];

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

    return Array.from(resolvedSuppliers.values());
  }

  private buildSupplierComparisonTableRows(): SupplierComparisonTableRow[] {
    const currentOrder = this.order();
    const comparisonSourceRows = currentOrder?.supplierComparisonRows ?? [];

    if (!currentOrder) {
      return [];
    }

    const selections = this.supplierComparisonSelections();
    const quantityOverrides = this.supplierComparisonQuantities();
    const comparisonRowsByLookupKey = this.buildComparisonRowLookup(comparisonSourceRows);
    const mappedTargetBySourceEan = this.buildProductMappingLookup(currentOrder);

    const orderRows = currentOrder.items.map((item, index) => {
      const lineId = this.resolveOrderItemLineId(item, index);
      const comparisonRow = this.findComparisonRowForOrderItem(
        item,
        comparisonRowsByLookupKey,
        mappedTargetBySourceEan
      );
      const manualSelection = selections[lineId];
      const selectedOption = comparisonRow
        ? resolveSelectedSupplierComparisonOffer(
            comparisonRow,
            manualSelection ??
              (item.supplierId
                ? {
                    selectedSupplierId: item.supplierId,
                    selectedSupplierName:
                      this.resolveSupplierName(currentOrder, item.supplierId) ?? '',
                    selectedPrice: null,
                    selectedPackageSize: 1
                  }
                : undefined)
          )
        : null;
      const selectedSupplierId =
        manualSelection?.selectedSupplierId ?? selectedOption?.supplierId ?? item.supplierId ?? '';
      const selectedSupplierName =
        manualSelection?.selectedSupplierName ||
        selectedOption?.supplierName ||
        this.resolveSupplierName(currentOrder, item.supplierId) ||
        '';
      const selectedPrice =
        manualSelection?.selectedPrice ?? selectedOption?.netPrice ?? selectedOption?.price ?? null;
      const selectedPackageSize =
        manualSelection?.selectedPackageSize ?? selectedOption?.packageSize ?? 1;
      const effectiveEan = comparisonRow?.ean ?? this.resolveMappedTargetEan(item, mappedTargetBySourceEan) ?? item.ean;
      const preferredDescription =
        comparisonRow && effectiveEan !== item.ean
          ? comparisonRow.description
          : item.description ?? comparisonRow?.description;
      const comparisonDescription =
        comparisonRow && effectiveEan !== item.ean
          ? item.description
          : comparisonRow?.description;

      return {
        lineId,
        lineType: 'order' as const,
        ean: effectiveEan,
        description: this.resolveLineDescription(
          currentOrder,
          item.ean,
          preferredDescription,
          index,
          comparisonDescription
        ),
        quantity: quantityOverrides[lineId] ?? item.quantity,
        bestOffer: comparisonRow?.bestOffer ?? null,
        selectedSupplierId,
        selectedSupplierName,
        selectedPrice,
        selectedPackageSize,
        availableSuppliers: comparisonRow?.availableSuppliers ?? []
      };
    });

    const catalogRows = comparisonSourceRows.map((row, index) => {
        const lineId = `catalog:${row.ean}`;
        const manualSelection = selections[lineId];
        const selectedOption = resolveSelectedSupplierComparisonOffer(row, manualSelection);

        return {
          lineId,
          lineType: 'catalog' as const,
          ean: row.ean,
          description: this.resolveLineDescription(
            currentOrder,
            row.ean,
            row.description,
            currentOrder.items.length + index
          ),
          quantity: quantityOverrides[lineId] ?? row.quantity,
          bestOffer: row.bestOffer,
          selectedSupplierId: selectedOption?.supplierId ?? '',
          selectedSupplierName: selectedOption?.supplierName ?? '',
          selectedPrice: selectedOption?.netPrice ?? selectedOption?.price ?? null,
          selectedPackageSize: selectedOption?.packageSize ?? 1,
          availableSuppliers: row.availableSuppliers
        };
      });

    return [...orderRows, ...catalogRows];
  }

  private buildComparisonRowLookup(
    rows: SupplierComparisonRow[]
  ): Map<string, SupplierComparisonRow> {
    const lookup = new Map<string, SupplierComparisonRow>();

    for (const row of rows) {
      const ean = row.ean.trim();

      if (ean) {
        lookup.set(ean, row);
      }

      const sourceEan = row.sourceEan?.trim();

      if (sourceEan) {
        lookup.set(sourceEan, row);
      }
    }

    return lookup;
  }

  private buildProductMappingLookup(order: SessionOrder): Map<string, string> {
    const lookup = new Map<string, string>();

    for (const mapping of order.productMappings ?? []) {
      const sourceEan = mapping.sourceEan.trim();
      const targetEan = mapping.targetEan.trim();

      if (!sourceEan || !targetEan) {
        continue;
      }

      lookup.set(sourceEan, targetEan);
    }

    return lookup;
  }

  private findComparisonRowForOrderItem(
    item: OrderItem,
    lookup: Map<string, SupplierComparisonRow>,
    mappedTargetBySourceEan: Map<string, string>
  ): SupplierComparisonRow | undefined {
    for (const key of this.resolveComparisonLookupKeys(item, mappedTargetBySourceEan)) {
      const row = lookup.get(key);

      if (row) {
        return row;
      }
    }

    return undefined;
  }

  private resolveComparisonLookupKeys(
    item: OrderItem,
    mappedTargetBySourceEan: Map<string, string>
  ): string[] {
    const keys = [
      item.targetEan,
      item.catalogEan,
      item.mappedEan,
      item.sourceEan ? mappedTargetBySourceEan.get(item.sourceEan) : undefined,
      mappedTargetBySourceEan.get(item.ean),
      item.sourceEan,
      item.ean
    ];

    return keys.flatMap((key) => {
      const normalizedKey = key?.trim();
      return normalizedKey ? [normalizedKey] : [];
    }).filter((key, index, collection) => collection.indexOf(key) === index);
  }

  private resolveMappedTargetEan(
    item: OrderItem,
    mappedTargetBySourceEan: Map<string, string>
  ): string | null {
    const candidates = [
      item.targetEan,
      item.catalogEan,
      item.mappedEan,
      item.sourceEan ? mappedTargetBySourceEan.get(item.sourceEan) : undefined,
      mappedTargetBySourceEan.get(item.ean)
    ];

    for (const candidate of candidates) {
      const normalizedCandidate = candidate?.trim();

      if (normalizedCandidate) {
        return normalizedCandidate;
      }
    }

    return null;
  }

  private resolveLineDescription(
    order: SessionOrder,
    ean: string,
    preferredDescription: string | undefined,
    fallbackIndex: number,
    comparisonDescription?: string
  ): string {
    const importedDescription = order.importResult?.importedItems.find(
      (item) => item.ean === ean && item.description?.trim()
    )?.description;
    const reviewDescription = order.reviewItems.find(
      (item) => item.ean === ean && item.description?.trim()
    )?.description;

    return this.resolveExportRowDescription({
      ean,
      itemDescription: preferredDescription,
      comparisonDescription,
      importedDescription,
      reviewDescription,
      fallbackIndex
    });
  }

  private resolveSupplierName(order: SessionOrder, supplierId: string | undefined): string | null {
    if (!supplierId) {
      return null;
    }

    const supplier = (order.suppliers ?? []).find((currentSupplier) => currentSupplier.id === supplierId);

    if (supplier?.name?.trim()) {
      return supplier.name.trim();
    }

    for (const row of order.supplierComparisonRows ?? []) {
      const matchingSupplier = row.availableSuppliers.find(
        (currentSupplier) => currentSupplier.supplierId === supplierId
      );

      if (matchingSupplier?.supplierName?.trim()) {
        return matchingSupplier.supplierName.trim();
      }
    }

    return supplierId;
  }

  private resolveOrderItemLineId(item: OrderItem, index: number): string {
    const normalizedLineId = item.lineId?.trim();

    if (normalizedLineId) {
      return normalizedLineId;
    }

    return `line-${index + 1}-${item.ean || 'item'}-${item.supplierId || 'unassigned'}`;
  }

  private createClientLineId(): string {
    return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private upsertProductMapping(orderId: string, mapping: ProductMappingResponse): void {
    const currentOrder = this.order();
    const currentMappings = currentOrder?.productMappings ?? [];
    const nextMappings = [
      ...currentMappings.filter(
        (currentMapping) => currentMapping.sourceEan !== mapping.sourceEan
      ),
      mapping
    ];

    this.ordersStore.upsertOrder({
      ...(currentOrder ?? {
        id: orderId,
        status: 'draft',
        createdAt: new Date().toISOString(),
        items: [],
        reviewItems: [],
        supplierUploads: {}
      }),
      productMappings: nextMappings
    });
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

  private scheduleCatalogSearch(): void {
    this.clearCatalogSearchTimeout();
    this.catalogSearchTimeoutId = setTimeout(() => {
      this.catalogSearchTimeoutId = null;
      void this.loadCatalogAssociationResults(this.catalogAssociationQuery());
    }, 250);
  }

  private clearCatalogSearchTimeout(): void {
    if (this.catalogSearchTimeoutId === null) {
      return;
    }

    clearTimeout(this.catalogSearchTimeoutId);
    this.catalogSearchTimeoutId = null;
  }

  dismissSuccessToast(): void {
    this.clearSuccessToastTimeout();
    this.successToastMessage.set(null);
  }

  private showSuccessToast(message: string): void {
    this.clearSuccessToastTimeout();
    this.successToastMessage.set(message);
    this.successToastTimeoutId = setTimeout(() => {
      this.successToastTimeoutId = null;
      this.successToastMessage.set(null);
    }, 8000);
  }

  private clearSuccessToastTimeout(): void {
    if (this.successToastTimeoutId === null) {
      return;
    }

    clearTimeout(this.successToastTimeoutId);
    this.successToastTimeoutId = null;
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

  private async refreshSupplierComparison(
    orderId: string,
    fallbackMessage = 'Non sono riuscito a caricare il confronto fornitori.'
  ): Promise<boolean> {
    try {
      const response = await firstValueFrom(this.ordersService.getOrderCatalog(orderId));
      this.ordersStore.setSupplierComparisonRows(orderId, response.rows);
      this.supplierComparisonRequested.set(true);
      return true;
    } catch (error: unknown) {
      this.supplierComparisonError.set(
        this.toMessage(error, fallbackMessage)
      );
      return false;
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

  private async loadCatalogAssociationResults(query: string): Promise<void> {
    const orderId = this.orderId();

    if (!orderId || !this.catalogAssociationDialogVisible()) {
      return;
    }

    const normalizedQuery = query.trim();
    const cachedCatalogRows = this.getCachedCatalogRows();

    if (cachedCatalogRows.length > 0) {
      this.catalogAssociationLoading.set(false);
      this.catalogAssociationError.set(null);
      this.catalogAssociationResults.set(
        this.filterCatalogRows(this.deduplicateCatalogRows(cachedCatalogRows), normalizedQuery)
      );
      return;
    }

    const requestSequence = ++this.catalogSearchRequestSequence;
    this.catalogAssociationLoading.set(true);
    this.catalogAssociationError.set(null);

    try {
      const response = await firstValueFrom(this.ordersService.getOrderCatalog(orderId));

      if (requestSequence !== this.catalogSearchRequestSequence) {
        return;
      }

      const catalogRows = this.deduplicateCatalogRows(response.rows);
      this.ordersStore.setSupplierComparisonRows(orderId, catalogRows);
      this.catalogAssociationResults.set(this.filterCatalogRows(catalogRows, normalizedQuery));
    } catch (error: unknown) {
      if (requestSequence !== this.catalogSearchRequestSequence) {
        return;
      }

      this.catalogAssociationResults.set([]);
      this.catalogAssociationError.set(
        this.toMessage(error, 'Non sono riuscito a cercare nel catalogo.')
      );
    } finally {
      if (requestSequence === this.catalogSearchRequestSequence) {
        this.catalogAssociationLoading.set(false);
      }
    }
  }

  private async reloadOrderSnapshot(orderId: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(this.ordersService.getOrderById(orderId));
      this.ordersStore.upsertOrder(response.order);
      return true;
    } catch (error: unknown) {
      this.pageError.set(
        this.toMessage(
          error,
          'Associazione salvata, ma non sono riuscito a ricaricare il dettaglio ordine.'
        )
      );
      return false;
    }
  }

  private getCachedCatalogRows(): SupplierComparisonRow[] {
    return this.order()?.supplierComparisonRows ?? [];
  }

  private deduplicateCatalogRows(rows: SupplierComparisonRow[]): SupplierComparisonRow[] {
    const uniqueRows = new Map<string, SupplierComparisonRow>();

    for (const row of rows) {
      const normalizedEan = row.ean.trim();

      if (!normalizedEan || uniqueRows.has(normalizedEan)) {
        continue;
      }

      uniqueRows.set(normalizedEan, row);
    }

    return Array.from(uniqueRows.values());
  }

  private filterCatalogRows(
    rows: SupplierComparisonRow[],
    query: string
  ): SupplierComparisonRow[] {
    const normalizedQuery = this.normalizeCatalogSearchValue(query);

    if (!normalizedQuery) {
      return rows;
    }

    const queryTerms = normalizedQuery.split(' ').filter((term) => term.length > 0);

    return rows.filter((row) => {
      const searchableContent = this.normalizeCatalogSearchValue([
        row.ean,
        row.description,
        row.sourceEan,
        row.sourceDescription,
        ...row.availableSuppliers.map((supplier) => supplier.supplierName)
      ].filter((value): value is string => Boolean(value)).join(' '));

      return queryTerms.every((term) => searchableContent.includes(term));
    });
  }

  private normalizeCatalogSearchValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('it-IT')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async syncDraftItems(): Promise<void> {
    if (this.isReadOnlyOrder()) {
      return;
    }

    const orderId = this.orderId();

    if (!orderId) {
      return;
    }

    const draftItems = this.buildDraftOrderItems();
    const items = this.buildPersistedOrderItemPayload(draftItems);

    this.runWithScrollLock(() => {
      this.ordersStore.setOrderItems(orderId, this.buildLocalDraftItems(draftItems));
    });

    try {
      await firstValueFrom(this.ordersService.syncOrderItems(orderId, items));
    } catch (error: unknown) {
      this.pageError.set(
        this.toMessage(error, 'Non sono riuscito a salvare le modifiche del draft ordine.')
      );
    }
  }

  private buildDraftOrderItems(): Array<{
    lineId: string;
    ean: string;
    quantity: number;
    description?: string;
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
        lineId: row.lineId,
        ean: row.ean,
        quantity: row.quantity as number,
        description: row.description,
        ...(row.supplierId ? { supplierId: row.supplierId } : {})
      }));
  }

  private buildPersistedOrderItemPayload(items: Array<{
    lineId: string;
    ean: string;
    quantity: number;
    description?: string;
    supplierId?: string;
  }>): Array<{
    ean: string;
    quantity: number;
    supplierId?: string;
  }> {
    return items.map(({ ean, quantity, supplierId }) => ({
      ean,
      quantity,
      ...(supplierId ? { supplierId } : {})
    }));
  }

  private buildLocalDraftItems(
    items: Array<{
      lineId: string;
      ean: string;
      quantity: number;
      description?: string;
      supplierId?: string;
    }>
  ): OrderItem[] {
    return items.map((item) => ({
      ...item,
      status: 'PENDING'
    }));
  }

  private toMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage =
        (typeof error.error === 'string' && error.error) ||
        (typeof error.error?.message === 'string' && error.error.message) ||
        '';

      if (apiMessage.trim().length > 0) {
        return apiMessage;
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }

  private buildMissingProductsCsv(rows: OrderExportSummaryRow[]): string {
    const header = ['EAN', 'Descrizione', 'Quantita', 'Motivo', 'Fornitori disponibili'];
    const csvRows = rows.map((row) => [
      this.formatSpreadsheetTextCell(row.ean),
      row.description,
      row.quantity === null ? '' : String(row.quantity),
      row.missingReason ?? 'Prodotto non trovato nei fornitori caricati.',
      String(row.availableSuppliersCount)
    ]);

    return [header, ...csvRows]
      .map((columns) => columns.map((value) => this.escapeCsvValue(value)).join(';'))
      .join('\r\n');
  }

  private isPreferredTieSelection(row: SupplierComparisonTableRow): boolean {
    const selectedSupplierId = row.selectedSupplierId?.trim();

    if (!selectedSupplierId) {
      return false;
    }

    const selectedSupplier = row.availableSuppliers.find(
      (supplier) => supplier.supplierId === selectedSupplierId
    );

    if (!selectedSupplier?.preferred) {
      return false;
    }

    const selectedPrice = this.resolveComparableOfferPrice(selectedSupplier);

    if (selectedPrice === null) {
      return false;
    }

    return row.availableSuppliers.some((supplier) => {
      if (supplier.supplierId === selectedSupplierId) {
        return false;
      }

      const supplierPrice = this.resolveComparableOfferPrice(supplier);

      return supplierPrice !== null && Math.abs(supplierPrice - selectedPrice) < 0.0001;
    });
  }

  private resolveComparableOfferPrice(supplier: SupplierComparisonOffer): number | null {
    if (typeof supplier.netPrice === 'number' && Number.isFinite(supplier.netPrice)) {
      return supplier.netPrice;
    }

    if (typeof supplier.price === 'number' && Number.isFinite(supplier.price)) {
      return supplier.price;
    }

    return null;
  }

  private buildMissingProductsFileName(createdAt: string): string {
    const date = this.parseDate(createdAt);

    if (!date) {
      return 'prodotti-mancanti.csv';
    }

    const dateLabel = new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
      .format(date)
      .replace(/\//g, '-');

    return `prodotti-mancanti-${dateLabel}.csv`;
  }

  private escapeCsvValue(value: string): string {
    const normalizedValue = value.replace(/"/g, '""');
    return `"${normalizedValue}"`;
  }

  private formatSpreadsheetTextCell(value: string): string {
    const normalizedValue = value.replace(/"/g, '""');
    return `="${normalizedValue}"`;
  }

  private downloadClientFile(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  private openPaymentRequiredDialogIfNeeded(action: PaymentRequiredAction): boolean {
    if (this.authStore.accessProfile()?.isPaying !== false) {
      return false;
    }

    this.paymentRequiredAction.set(action);
    this.paymentRequiredDialogVisible.set(true);
    this.pageError.set(null);
    return true;
  }

  private handlePaymentRequiredError(error: unknown, action: PaymentRequiredAction): boolean {
    if (!this.isPaymentRequiredError(error)) {
      return false;
    }

    this.paymentRequiredAction.set(action);
    this.paymentRequiredDialogVisible.set(true);
    this.pageError.set(null);
    return true;
  }

  private isPaymentRequiredError(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 403) {
      return false;
    }

    const message = this.toMessage(error, '').toLowerCase();
    return (
      message.includes('utenti non paganti') ||
      message.includes('account pagante') ||
      message.includes('utenti paganti')
    );
  }

  private runWithScrollLock(action: () => void): void {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const focusState = this.captureComparisonFocusState();

    action();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.restoreComparisonViewport(scrollX, scrollY, focusState);
      });
    });
  }

  private captureComparisonFocusState():
    | {
        lineId: string;
        field: 'quantity' | 'supplier';
        selectionStart: number | null;
        selectionEnd: number | null;
      }
    | null {
    const activeElement = document.activeElement;

    if (
      !(activeElement instanceof HTMLInputElement) &&
      !(activeElement instanceof HTMLSelectElement)
    ) {
      return null;
    }

    const lineId = activeElement.dataset['comparisonLineId']?.trim();
    const field = activeElement.dataset['comparisonField'];

    if (!lineId || (field !== 'quantity' && field !== 'supplier')) {
      return null;
    }

    return {
      lineId,
      field,
      selectionStart:
        activeElement instanceof HTMLInputElement ? activeElement.selectionStart : null,
      selectionEnd: activeElement instanceof HTMLInputElement ? activeElement.selectionEnd : null
    };
  }

  private restoreComparisonViewport(
    scrollX: number,
    scrollY: number,
    focusState:
      | {
          lineId: string;
          field: 'quantity' | 'supplier';
          selectionStart: number | null;
          selectionEnd: number | null;
        }
      | null
  ): void {
    window.scrollTo({
      left: scrollX,
      top: scrollY,
      behavior: 'auto'
    });

    if (!focusState) {
      return;
    }

    const selector = `[data-comparison-field="${focusState.field}"][data-comparison-line-id="${CSS.escape(focusState.lineId)}"]`;
    const target = document.querySelector(selector);

    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement)
    ) {
      return;
    }

    target.focus({ preventScroll: true });

    if (
      target instanceof HTMLInputElement &&
      focusState.selectionStart !== null &&
      focusState.selectionEnd !== null
    ) {
      target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    }

    window.scrollTo({
      left: scrollX,
      top: scrollY,
      behavior: 'auto'
    });
  }
}


