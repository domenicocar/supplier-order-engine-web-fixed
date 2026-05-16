import { DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, firstValueFrom, map, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

import {
  PdfImportJobStatus,
  PdfImportStatusResponse,
  ReviewItem,
  SupplierComparisonOffer,
  SupplierComparisonRow,
  SupplierUploadResult
} from '../../../models/order.models';
import { SESSION_SUPPLIERS } from '../../../models/supplier.models';
import { OrdersSessionStore } from '../../../services/orders-session.store';
import { OrdersService } from '../../../services/orders.service';
import { StatusTagComponent } from '../../../shared/components/status-tag.component';

type SupplierComparisonSelection = {
  selectedSupplierId: string;
  selectedSupplierName: string;
  selectedPrice: number | null;
};

type SupplierComparisonTableRow = SupplierComparisonSelection & {
  ean: string;
  description: string;
  quantity: number | null;
  bestOffer: SupplierComparisonOffer | null;
  availableSuppliers: SupplierComparisonOffer[];
};

type OrderExportSummaryRow = {
  ean: string;
  description: string;
  quantity: number | null;
  supplierId: string;
  supplierName: string;
  unitPrice: number | null;
  lineTotal: number | null;
  foundInSuppliers: boolean;
  availableSuppliersCount: number;
  missingReason?: string;
};

type SupplierExportSummary = {
  supplierId: string;
  supplierName: string;
  lineCount: number;
  totalQuantity: number;
  subtotal: number | null;
  missingPricesCount: number;
  missingQuantitiesCount: number;
  items: OrderExportSummaryRow[];
};

const SUPPLIER_COMPARISON_PAGE_SIZE = 10;

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    ButtonModule,
    DatePipe,
    DecimalPipe,
    JsonPipe,
    RouterLink,
    StatusTagComponent,
    TableModule
  ],
  template: `
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
              Orchestrazione frontend minimale del flusso ordine: import PDF, review item,
              file fornitore ed export finale.
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

        <section class="surface-panel p-8">
          <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p class="section-eyebrow">1. Upload PDF ordine</p>
              <h2 class="section-title">Importazione ordine da PDF</h2>
              <p class="section-copy">
                Carica il PDF e invia
                <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">POST /orders/:id/import-pdf</code>
                in multipart form-data.
              </p>
            </div>

            <div class="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                accept=".pdf,application/pdf"
                class="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                (change)="onPdfFileSelected($event)"
              />
              <button
                pButton
                type="button"
                class="justify-center !rounded-2xl !bg-slate-950 !px-5 !py-3 !text-sm !font-semibold !text-white"
                [disabled]="!selectedPdfFile() || pdfUploading() || pdfImportStatus() === 'processing'"
                (click)="uploadPdf()"
              >
                {{
                  pdfUploading()
                    ? 'Import in corso...'
                    : pdfImportStatus() === 'processing'
                      ? 'Import in elaborazione...'
                      : 'Importa PDF'
                }}
              </button>
            </div>
          </div>

          @if (pdfImportStatus() === 'processing') {
            <div class="mt-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-800">
              <p class="font-semibold text-sky-950">PDF ordine in elaborazione.</p>
              <p class="mt-1">
                Puoi continuare a lavorare: i prodotti verranno aggiunti appena pronti.
              </p>
            </div>
          }

          @if (pdfImportStatus() === 'completed' && pdfImportMessage(); as completedMessage) {
            <div class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              {{ completedMessage }}
            </div>
          }

          @if (pdfImportRefreshWarning(); as refreshWarning) {
            <div class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              {{ refreshWarning }}
            </div>
          }

          @if (pdfImportStatus() === 'failed' && pdfImportMessage(); as failedMessage) {
            <div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {{ failedMessage }}
            </div>
          }

          @if (currentOrder.importResult; as importResult) {
            <div class="mt-8 grid gap-4 lg:grid-cols-4">
              <div class="stat-tile">
                <p class="stat-label">Imported items</p>
                <p class="stat-value">{{ importResult.importedItems.length }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Rejected items</p>
                <p class="stat-value">{{ importResult.rejectedItems.length }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Import success rate</p>
                <p class="stat-value">{{ formatRate(importResult.importSuccessRate) }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">First imported items</p>
                <p class="stat-value">{{ importResult.firstImportedItems.length }}</p>
              </div>
            </div>

            <div class="mt-8 grid gap-6 xl:grid-cols-2">
              <div class="rounded-3xl border border-slate-200 bg-white p-5">
                <div class="flex items-center justify-between gap-4">
                  <h3 class="text-base font-semibold text-slate-950">Imported items</h3>
                  <span class="text-sm text-slate-500">{{ importResult.importedItems.length }} righe</span>
                </div>

                <div class="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <p-table [value]="importResult.importedItems" responsiveLayout="scroll">
                    <ng-template pTemplate="header">
                      <tr>
                        <th>EAN</th>
                        <th>Quantità</th>
                        <th>Stato</th>
                      </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-item>
                      <tr>
                        <td>{{ item.ean }}</td>
                        <td>{{ item.quantity ?? '-' }}</td>
                        <td><app-status-tag [label]="item.status" /></td>
                      </tr>
                    </ng-template>
                  </p-table>
                </div>
              </div>

              <div class="rounded-3xl border border-slate-200 bg-white p-5">
                <div class="flex items-center justify-between gap-4">
                  <h3 class="text-base font-semibold text-slate-950">Rejected items</h3>
                  <span class="text-sm text-slate-500">{{ importResult.rejectedItems.length }} righe</span>
                </div>

                <div class="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <p-table [value]="importResult.rejectedItems" responsiveLayout="scroll">
                    <ng-template pTemplate="header">
                      <tr>
                        <th>EAN</th>
                        <th>Motivo</th>
                        <th>Severity</th>
                      </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-item>
                      <tr>
                        <td>{{ item.ean }}</td>
                        <td>{{ item.reason || item.possibleReason || '-' }}</td>
                        <td>
                          <app-status-tag
                            [label]="item.severity || 'warning'"
                            [tone]="severityTone(item.severity)"
                          />
                        </td>
                      </tr>
                    </ng-template>
                  </p-table>
                </div>
              </div>
            </div>

            @if (importResult.firstImportedItems.length > 0) {
              <div class="mt-6 flex flex-wrap gap-2">
                @for (item of importResult.firstImportedItems; track item.ean) {
                  <span class="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800">
                    {{ item.ean }} · {{ item.quantity ?? '-' }}
                  </span>
                }
              </div>
            }
          } @else {
            <p class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Nessun PDF importato per questo ordine nella sessione corrente.
            </p>
          }
        </section>

        <section class="surface-panel p-8">
          <p class="section-eyebrow">2. Lista prodotti ordine</p>
          <h2 class="section-title">Tabella prodotti</h2>
          <p class="section-copy">
            Vista sintetica degli item dell'ordine salvati nello stato locale.
          </p>

          <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <p-table [value]="currentOrder.items" responsiveLayout="scroll">
              <ng-template pTemplate="header">
                <tr>
                  <th>EAN</th>
                  <th>Quantità</th>
                  <th>Stato</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-item>
                <tr>
                  <td>{{ item.ean }}</td>
                  <td>{{ item.quantity ?? '-' }}</td>
                  <td><app-status-tag [label]="item.status" /></td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="3" class="px-4 py-5 text-sm text-slate-500">
                    Nessun prodotto presente. Importa un PDF per popolare la tabella.
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>
        </section>

        @if (currentOrder.reviewItems.length > 0) {
          <section class="surface-panel p-8">
            <p class="section-eyebrow">3. Review Items</p>
            <h2 class="section-title">Elementi da rivedere</h2>
            <p class="section-copy">
              La sezione appare solo se il backend segnala
              <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">reviewItems.length &gt; 0</code>.
            </p>

            <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <p-table [value]="currentOrder.reviewItems" responsiveLayout="scroll">
                <ng-template pTemplate="header">
                  <tr>
                    <th>EAN</th>
                    <th>Descrizione</th>
                    <th>Quantity</th>
                    <th>Reason / possibleReason</th>
                    <th>Severity</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-item>
                  <tr>
                    <td>{{ item.ean }}</td>
                    <td>{{ item.description || '-' }}</td>
                    <td>{{ item.quantity ?? '-' }}</td>
                    <td>{{ reviewReason(item) }}</td>
                    <td>
                      <app-status-tag
                        [label]="item.severity || 'warning'"
                        [tone]="severityTone(item.severity)"
                      />
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </section>
        }

        <section class="surface-panel p-8">
          <p class="section-eyebrow">4. Upload file fornitori</p>
          <h2 class="section-title">Card dinamiche per ogni fornitore</h2>
          <p class="section-copy">
            Il template cicla
            <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">suppliers[]</code>,
            usa
            <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">supplier.id</code>
            e chiama
            <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">POST /suppliers/:supplierId/files</code>.
          </p>

          <div class="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            @for (supplier of suppliers; track supplier.id) {
              <article class="rounded-3xl border border-slate-200 bg-white p-5">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h3 class="font-heading text-xl font-semibold text-slate-950">
                      {{ supplier.name }}
                    </h3>
                    <p class="mt-1 text-sm text-slate-500">supplierId: {{ supplier.id }}</p>
                  </div>

                  <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    upload
                  </span>
                </div>

                <div class="mt-5 flex flex-col gap-3">
                  <input
                    type="file"
                    class="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    (change)="onSupplierFileSelected(supplier.id, $event)"
                  />

                  <button
                    pButton
                    type="button"
                    class="justify-center !rounded-2xl !border !border-slate-300 !bg-white !px-5 !py-3 !text-sm !font-semibold !text-slate-700"
                    [disabled]="!selectedSupplierFile(supplier.id) || supplierUploading(supplier.id)"
                    (click)="uploadSupplierFile(supplier.id)"
                  >
                    {{ supplierUploading(supplier.id) ? 'Upload in corso...' : 'Carica file' }}
                  </button>
                </div>

                @if (latestSupplierUpload(supplier.id); as upload) {
                  <div class="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p class="text-sm font-semibold text-slate-900">{{ upload.fileName }}</p>
                    <p class="mt-1 text-sm text-slate-500">
                      {{ upload.uploadedAt | date: 'dd/MM/yyyy HH:mm' }}
                    </p>
                    <p class="mt-3 text-sm text-slate-600">{{ upload.message || 'Upload completato' }}</p>

                    @if (upload.files.length > 0) {
                      <ul class="mt-3 grid gap-2 text-sm text-slate-600">
                        @for (file of upload.files; track file.name) {
                          <li class="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            {{ file.name }}
                          </li>
                        }
                      </ul>
                    }
                  </div>
                }
              </article>
            }
          </div>
        </section>

        <section class="surface-panel p-8">
          <p class="section-eyebrow">5. Confronto prodotti</p>
          <h2 class="section-title">Confronto prodotti fornitori</h2>
          <p class="section-copy">
            Ogni riga rappresenta un EAN trovato nei listini caricati. Puoi scegliere il
            fornitore più conveniente o quello più adatto.
          </p>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              pButton
              type="button"
              class="justify-center !rounded-2xl !bg-slate-950 !px-5 !py-3 !text-sm !font-semibold !text-white"
              [disabled]="!hasSupplierUploads() || supplierComparisonLoading()"
              (click)="loadSupplierComparison()"
            >
              {{ supplierComparisonLoading() ? 'Confronto in corso...' : 'Confronta fornitori' }}
            </button>

            @if (supplierComparisonLoading()) {
              <p class="text-sm text-slate-500">Confronto fornitori in corso...</p>
            }
          </div>

          <div class="mt-4">
            <input
              type="search"
              placeholder="Cerca per EAN, descrizione o fornitore..."
              class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
              [value]="supplierComparisonSearch()"
              (input)="onSupplierComparisonSearchChange($event)"
            />
          </div>

          @if (supplierComparisonError()) {
            <div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {{ supplierComparisonError() }}
            </div>
          }

          @if (!supplierComparisonRequested()) {
            <p class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Carica i file fornitori, poi clicca Confronta per visualizzare la tabella prezzi.
            </p>
          } @else if (supplierComparisonRows().length === 0 && !supplierComparisonLoading()) {
            <p class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Non sono stati trovati prodotti confrontabili nei file caricati.
            </p>
          } @else {
            <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <p-table [value]="paginatedSupplierComparisonRows()" responsiveLayout="scroll">
                <ng-template pTemplate="header">
                  <tr>
                    <th>EAN</th>
                    <th>Descrizione</th>
                    <th>Quantità</th>
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
                        (input)="onSupplierComparisonQuantityChange(row.ean, $event)"
                      />
                    </td>
                    <td class="min-w-56">
                      <span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                        {{ row.selectedSupplierName || 'Nessun fornitore' }}
                        @if (row.selectedSupplierName || row.selectedPrice !== null) {
                          {{ ' ' + formatPrice(row.selectedPrice) }}
                        }
                      </span>
                    </td>
                    <td class="min-w-56">
                      <div class="flex flex-col gap-2">
                        <select
                          class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                          [value]="row.selectedSupplierId"
                          [disabled]="row.availableSuppliers.length === 0"
                          (change)="onSupplierComparisonSelectionChange(row.ean, $event)"
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
              <p class="text-sm text-slate-500">{{ supplierComparisonRangeLabel() }}</p>

              <div class="flex items-center gap-2">
                <button
                  pButton
                  type="button"
                  class="justify-center !rounded-2xl !border !border-slate-300 !bg-white !px-4 !py-2 !text-sm !font-semibold !text-slate-700"
                  [disabled]="supplierComparisonCurrentPage() === 1"
                  (click)="goToPreviousSupplierComparisonPage()"
                >
                  Precedente
                </button>
                <span class="text-sm text-slate-500">
                  Pagina {{ supplierComparisonDisplayPage() }} di {{ supplierComparisonTotalPages() }}
                </span>
                <button
                  pButton
                  type="button"
                  class="justify-center !rounded-2xl !border !border-slate-300 !bg-white !px-4 !py-2 !text-sm !font-semibold !text-slate-700"
                  [disabled]="supplierComparisonCurrentPage() >= supplierComparisonTotalPages()"
                  (click)="goToNextSupplierComparisonPage()"
                >
                  Successiva
                </button>
              </div>
            </div>
          }
        </section>

        <section class="surface-panel p-8">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p class="section-eyebrow">6. Export</p>
              <h2 class="section-title">Riepilogo ordine ed export</h2>
              <p class="section-copy">
                Overview finale di cosa stai ordinando, quanto spenderai in modo stimato e da quali
                fornitori, con CTA finale di export su
                <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">POST /orders/:id/export</code>.
              </p>
            </div>

            <button
              pButton
              type="button"
              class="justify-center !rounded-2xl !bg-slate-950 !px-6 !py-3 !text-sm !font-semibold !text-white"
              [disabled]="exporting()"
              (click)="generateExport()"
            >
              {{ exporting() ? 'Export in corso...' : 'Esporta ordine' }}
            </button>
          </div>

          @if (exportOverview(); as overview) {
            <div class="mt-8 grid gap-4 lg:grid-cols-4">
              <div class="stat-tile">
                <p class="stat-label">Spesa stimata</p>
                <p class="stat-value">{{ formatPrice(overview.estimatedTotal) }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Prodotti</p>
                <p class="stat-value">{{ overview.productsCount }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Fornitori coinvolti</p>
                <p class="stat-value">{{ overview.suppliersCount }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Totale pezzi</p>
                <p class="stat-value">{{ overview.totalQuantity }}</p>
              </div>
            </div>

            @if (overview.missingItemsCount > 0 || overview.missingPricesCount > 0 || overview.missingQuantitiesCount > 0) {
              <div class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p class="font-semibold text-amber-950">Riepilogo stimato e non ancora completo.</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  @if (overview.missingItemsCount > 0) {
                    <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">
                      {{ overview.missingItemsCount }} prodotti non trovati nei fornitori
                    </span>
                  }
                  @if (overview.assignedItemsCount > 0) {
                    <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">
                      {{ overview.assignedItemsCount }} prodotti assegnati a un fornitore
                    </span>
                  }
                  @if (overview.missingPricesCount > 0) {
                    <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">
                      {{ overview.missingPricesCount }} prodotti senza prezzo
                    </span>
                  }
                  @if (overview.missingQuantitiesCount > 0) {
                    <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900">
                      {{ overview.missingQuantitiesCount }} prodotti senza quantita
                    </span>
                  }
                </div>
              </div>
            }

            <div class="mt-8 grid gap-6 xl:grid-cols-2">
              <div class="rounded-3xl border border-slate-200 bg-white p-5">
                <div class="flex items-center justify-between gap-4">
                  <h3 class="text-base font-semibold text-slate-950">Per fornitore</h3>
                  <span class="text-sm text-slate-500">spaccato acquisti</span>
                </div>

                @if (supplierExportSummary().length === 0) {
                  <p class="mt-4 text-sm text-slate-500">
                    Nessun prodotto del tuo ordine e ancora assegnato a un fornitore.
                  </p>
                } @else {
                  <ul class="mt-4 grid gap-3">
                    @for (supplier of supplierExportSummary(); track supplier.supplierId || supplier.supplierName) {
                      <li class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                        <div class="flex items-start justify-between gap-4">
                          <div>
                            <p class="font-medium text-slate-950">{{ supplier.supplierName }}</p>
                            <p class="mt-1 text-xs uppercase tracking-[0.15em] text-slate-400">
                              {{ supplier.supplierId || 'non assegnato' }}
                            </p>
                          </div>
                          <p class="text-sm font-semibold text-slate-950">
                            {{ formatPrice(supplier.subtotal) }}
                          </p>
                        </div>

                        <div class="mt-4 grid grid-cols-3 gap-3">
                          <div class="rounded-2xl bg-white px-3 py-2">
                            <p class="text-[11px] uppercase tracking-[0.14em] text-slate-400">Prodotti</p>
                            <p class="mt-1 font-semibold text-slate-950">{{ supplier.lineCount }}</p>
                          </div>
                          <div class="rounded-2xl bg-white px-3 py-2">
                            <p class="text-[11px] uppercase tracking-[0.14em] text-slate-400">Pezzi</p>
                            <p class="mt-1 font-semibold text-slate-950">{{ supplier.totalQuantity }}</p>
                          </div>
                          <div class="rounded-2xl bg-white px-3 py-2">
                            <p class="text-[11px] uppercase tracking-[0.14em] text-slate-400">Lacune</p>
                            <p class="mt-1 font-semibold text-slate-950">
                              {{ supplier.missingPricesCount + supplier.missingQuantitiesCount }}
                            </p>
                          </div>
                        </div>

                        <div class="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                          <p class="text-[11px] uppercase tracking-[0.14em] text-slate-400">Cosa stai comprando da questo fornitore</p>
                          <ul class="mt-3 grid gap-2">
                            @for (item of supplier.items; track item.ean) {
                              <li class="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                                <div>
                                  <p class="font-medium text-slate-950">{{ item.description }}</p>
                                  <p class="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                                    {{ item.ean }}
                                  </p>
                                </div>
                                <div class="text-right">
                                  <p class="font-medium text-slate-950">x{{ item.quantity ?? '-' }}</p>
                                  <p class="mt-1 text-xs text-slate-500">{{ formatPrice(item.lineTotal) }}</p>
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

              <div class="rounded-3xl border border-slate-200 bg-white p-5">
                <div class="flex items-center justify-between gap-4">
                  <h3 class="text-base font-semibold text-slate-950">Dettaglio ordine</h3>
                  <span class="text-sm text-slate-500">copertura del tuo ordine</span>
                </div>

                @if (missingOrderSummaryRows().length > 0) {
                  <div class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                    <p class="font-semibold text-amber-950">
                      {{ missingOrderSummaryRows().length }} prodotti del tuo ordine non sono stati trovati tra i fornitori caricati.
                    </p>
                  </div>
                }

                <div class="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <p-table [value]="orderExportSummaryRows()" responsiveLayout="scroll">
                    <ng-template pTemplate="header">
                      <tr>
                        <th>EAN</th>
                        <th>Prodotto</th>
                        <th>Qta</th>
                        <th>Copertura</th>
                        <th>Fornitore</th>
                        <th>Prezzo</th>
                        <th>Totale</th>
                      </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-item>
                      <tr>
                        <td>{{ item.ean }}</td>
                        <td>{{ item.description }}</td>
                        <td>{{ item.quantity ?? '-' }}</td>
                        <td>
                          @if (item.foundInSuppliers) {
                            <div class="flex flex-col">
                              <span class="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Trovato
                              </span>
                              <span class="mt-1 text-xs text-slate-500">
                                {{ item.availableSuppliersCount }} fornitori disponibili
                              </span>
                            </div>
                          } @else {
                            <div class="flex flex-col">
                              <span class="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                Non trovato
                              </span>
                              <span class="mt-1 text-xs text-amber-800">
                                {{ item.missingReason }}
                              </span>
                            </div>
                          }
                        </td>
                        <td>
                          <div class="flex flex-col">
                            <span class="font-medium text-slate-950">
                              {{ item.supplierName || 'Non assegnato' }}
                            </span>
                            @if (item.supplierId) {
                              <span class="text-xs uppercase tracking-[0.14em] text-slate-400">
                                {{ item.supplierId }}
                              </span>
                            }
                          </div>
                        </td>
                        <td>{{ formatPrice(item.unitPrice) }}</td>
                        <td>{{ formatPrice(item.lineTotal) }}</td>
                      </tr>
                    </ng-template>
                  </p-table>
                </div>
              </div>
            </div>
          } @else {
            <p class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Il riepilogo ordine si popola quando hai i prodotti confrontati con i fornitori:
              qui vedrai spesa stimata, cosa stai prendendo e da chi prima dell'export.
            </p>
          }

          @if (currentOrder.exportResult; as exportResult) {
            <div class="mt-8 grid gap-4 lg:grid-cols-4">
              <div class="stat-tile">
                <p class="stat-label">File esportati</p>
                <p class="stat-value">{{ exportResult.filesExported.length }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Review items</p>
                <p class="stat-value">{{ exportResult.reviewItems.length }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Can complete export</p>
                <p class="stat-value">{{ exportResult.canCompleteExport ? 'Sì' : 'No' }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Errori export</p>
                <p class="stat-value">{{ exportResult.erroriExport.length }}</p>
              </div>
            </div>

            <div class="mt-8 grid gap-6 xl:grid-cols-2">
              <div class="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 class="text-base font-semibold text-slate-950">File esportati</h3>

                @if (exportResult.filesExported.length === 0) {
                  <p class="mt-4 text-sm text-slate-500">Nessun file esportato restituito dal backend.</p>
                } @else {
                  <ul class="mt-4 grid gap-3">
                    @for (file of exportResult.filesExported; track file.name) {
                      <li class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <div class="flex items-center justify-between gap-3">
                          <span class="font-medium text-slate-950">{{ file.name }}</span>
                          @if (file.status) {
                            <app-status-tag [label]="file.status" />
                          }
                        </div>
                        @if (file.supplierId) {
                          <p class="mt-1 text-xs uppercase tracking-[0.15em] text-slate-400">
                            {{ file.supplierId }}
                          </p>
                        }
                      </li>
                    }
                  </ul>
                }
              </div>

              <div class="rounded-3xl border border-slate-200 bg-white p-5">
                <h3 class="text-base font-semibold text-slate-950">Errori export</h3>

                @if (exportResult.erroriExport.length === 0) {
                  <p class="mt-4 text-sm text-slate-500">Nessun errore export segnalato.</p>
                } @else {
                  <ul class="mt-4 grid gap-3">
                    @for (item of exportResult.erroriExport; track item) {
                      <li class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {{ item }}
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>

            @if (exportResult.reviewItems.length > 0) {
              <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                <p-table [value]="exportResult.reviewItems" responsiveLayout="scroll">
                  <ng-template pTemplate="header">
                    <tr>
                      <th>EAN</th>
                      <th>Descrizione</th>
                      <th>Reason / possibleReason</th>
                      <th>Severity</th>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="body" let-item>
                    <tr>
                      <td>{{ item.ean }}</td>
                      <td>{{ item.description || '-' }}</td>
                      <td>{{ reviewReason(item) }}</td>
                      <td>
                        <app-status-tag
                          [label]="item.severity || 'warning'"
                          [tone]="severityTone(item.severity)"
                        />
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
              </div>
            }
          } @else {
            <p class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Nessun export eseguito per questo ordine nella sessione corrente.
            </p>
          }
        </section>
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
          Questo frontend non carica ordini da una GET dedicata: lavora sugli ordini creati
          nella sessione corrente. Crea o riapri un ordine da
          <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">/app/orders</code>.
        </p>
      </section>
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
  readonly supplierComparisonSearch = signal('');
  readonly supplierComparisonCurrentPage = signal(1);
  readonly supplierComparisonSelections = signal<Record<string, SupplierComparisonSelection>>({});
  readonly supplierComparisonQuantities = signal<Record<string, number | null>>({});
  readonly supplierFiles = signal<Record<string, File | null>>({});
  readonly supplierLoadingState = signal<Record<string, boolean>>({});

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
  readonly filteredSupplierComparisonRows = computed(() =>
    this.filterSupplierComparisonRows(this.supplierComparisonRows(), this.supplierComparisonSearch())
  );
  readonly supplierComparisonTotalPages = computed(() =>
    Math.max(
      1,
      Math.ceil(this.filteredSupplierComparisonRows().length / SUPPLIER_COMPARISON_PAGE_SIZE)
    )
  );
  readonly supplierComparisonDisplayPage = computed(() =>
    Math.min(
      Math.max(this.supplierComparisonCurrentPage(), 1),
      this.supplierComparisonTotalPages()
    )
  );
  readonly paginatedSupplierComparisonRows = computed(() => {
    const currentPage = this.supplierComparisonDisplayPage();
    const startIndex = (currentPage - 1) * SUPPLIER_COMPARISON_PAGE_SIZE;
    return this.filteredSupplierComparisonRows().slice(
      startIndex,
      startIndex + SUPPLIER_COMPARISON_PAGE_SIZE
    );
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPdfImportPolling());
  }

  onPdfFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedPdfFile.set(input.files?.[0] ?? null);

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

    console.log('[pdf-import] import start', { orderId, fileName: file.name });

    this.pdfUploading.set(true);
    this.pageError.set(null);
    this.resetPdfImportFeedback();
    this.stopPdfImportPolling();

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

  onSupplierFileSelected(supplierId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.supplierFiles.update((files) => ({
      ...files,
      [supplierId]: file
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
      console.log('[supplier-upload] success', {
        orderId,
        supplierId,
        fileName: file.name
      });
      this.ordersStore.appendSupplierUpload(orderId, response);
      this.supplierComparisonRequested.set(false);
      this.supplierComparisonError.set(null);
      this.supplierComparisonCurrentPage.set(1);
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

  latestSupplierUpload(supplierId: string): SupplierUploadResult | undefined {
    const uploads = this.order()?.supplierUploads[supplierId] ?? [];
    return uploads.at(-1);
  }

  onSupplierComparisonSelectionChange(ean: string, event: Event): void {
    const supplierId = (event.target as HTMLSelectElement).value;
    const row = this.supplierComparisonRows().find((currentRow) => currentRow.ean === ean);
    const option = row?.availableSuppliers.find((currentOption) => currentOption.supplierId === supplierId);

    if (!option) {
      return;
    }

    this.supplierComparisonSelections.update((selections) => ({
      ...selections,
      [ean]: {
        selectedSupplierId: option.supplierId,
        selectedSupplierName: option.supplierName,
        selectedPrice: option.price
      }
    }));
  }

  onSupplierComparisonQuantityChange(ean: string, event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value.trim();

    if (!rawValue) {
      this.supplierComparisonQuantities.update((quantities) => ({
        ...quantities,
        [ean]: null
      }));
      return;
    }

    const numericValue = Number(rawValue);
    const nextQuantity = Number.isFinite(numericValue)
      ? Math.max(0, Math.round(numericValue))
      : null;

    this.supplierComparisonQuantities.update((quantities) => ({
      ...quantities,
      [ean]: nextQuantity
    }));
  }

  onSupplierComparisonSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.supplierComparisonSearch.set(value);
    this.supplierComparisonCurrentPage.set(1);
  }

  goToPreviousSupplierComparisonPage(): void {
    this.supplierComparisonCurrentPage.update((page) => Math.max(1, page - 1));
  }

  goToNextSupplierComparisonPage(): void {
    this.supplierComparisonCurrentPage.update((page) =>
      Math.min(this.supplierComparisonTotalPages(), page + 1)
    );
  }

  async loadSupplierComparison(): Promise<void> {
    const orderId = this.orderId();

    if (!orderId || !this.hasSupplierUploads() || this.supplierComparisonLoading()) {
      return;
    }

    console.log('[supplier-comparison] requested by user', { orderId });
    this.supplierComparisonRequested.set(true);
    this.supplierComparisonLoading.set(true);
    this.supplierComparisonError.set(null);
    this.supplierComparisonCurrentPage.set(1);

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
      const response = await firstValueFrom(this.ordersService.exportOrder(orderId));
      this.ordersStore.setExportResult(orderId, response);
    } catch (error: unknown) {
      this.pageError.set(this.toMessage(error, 'Export ordine non riuscito.'));
    } finally {
      this.exporting.set(false);
    }
  }

  reviewReason(item: ReviewItem): string {
    return item.reason || item.possibleReason || '-';
  }

  severityTone(severity?: string): 'danger' | 'warn' | 'info' {
    const normalized = severity?.toLowerCase() ?? '';

    if (normalized.includes('error')) {
      return 'danger';
    }

    if (normalized.includes('warn')) {
      return 'warn';
    }

    return 'info';
  }

  formatRate(value: number | null): string {
    if (value === null) {
      return '-';
    }

    if (value <= 1) {
      return `${Math.round(value * 100)}%`;
    }

    return `${Math.round(value)}%`;
  }

  formatPrice(value: number | null): string {
    if (value === null) {
      return '€ -';
    }

    return `€ ${value.toFixed(2).replace('.', ',')}`;
  }

  formatSupplierOption(option: SupplierComparisonOffer): string {
    return `${option.supplierName}: ${this.formatPrice(option.price)}`;
  }

  supplierAvailabilityLabel(count: number): string {
    if (count === 1) {
      return '1 fornitore disponibile';
    }

    return `${count} fornitori disponibili`;
  }

  supplierComparisonRangeLabel(): string {
    const total = this.filteredSupplierComparisonRows().length;

    if (total === 0) {
      return 'Mostrati 0-0 di 0 prodotti';
    }

    const currentPage = this.supplierComparisonDisplayPage();
    const start = (currentPage - 1) * SUPPLIER_COMPARISON_PAGE_SIZE + 1;
    const end = Math.min(
      start + this.paginatedSupplierComparisonRows().length - 1,
      total
    );

    return `Mostrati ${start}-${end} di ${total} prodotti`;
  }

  private buildOrderExportSummaryRows(): OrderExportSummaryRow[] {
    const currentOrder = this.order();

    if (!currentOrder?.items.length) {
      return [];
    }

    const comparisonRowsByEan = new Map(
      this.supplierComparisonRows().map((row) => [row.ean, row] as const)
    );

    return currentOrder.items.map((item, index) => {
      const comparisonRow = comparisonRowsByEan.get(item.ean);
      const normalizedQuantity =
        typeof (comparisonRow?.quantity ?? item.quantity) === 'number' &&
        Number.isFinite(comparisonRow?.quantity ?? item.quantity)
          ? Math.max(0, comparisonRow?.quantity ?? item.quantity ?? 0)
          : null;
      const foundInSuppliers = (comparisonRow?.availableSuppliers.length ?? 0) > 0;
      const selectedPrice = foundInSuppliers ? comparisonRow?.selectedPrice ?? null : null;
      const lineTotal =
        normalizedQuantity !== null && selectedPrice !== null
          ? normalizedQuantity * selectedPrice
          : null;

      let missingReason: string | undefined;

      if (!comparisonRow || !foundInSuppliers) {
        missingReason = 'Non trovato nei listini dei fornitori caricati';
      }

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
        missingReason
      };
    });
  }

  private buildSupplierExportSummary(rows: OrderExportSummaryRow[]): SupplierExportSummary[] {
    const grouped = new Map<string, SupplierExportSummary>();

    for (const row of rows) {
      if (!row.supplierId) {
        continue;
      }

      const key = row.supplierId;
      const current = grouped.get(key) ?? {
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

      grouped.set(key, current);
    }

    return Array.from(grouped.values()).sort((left, right) =>
      left.supplierName.localeCompare(right.supplierName)
    );
  }

  private buildExportOverview(rows: OrderExportSummaryRow[]): {
    estimatedTotal: number | null;
    productsCount: number;
    suppliersCount: number;
    totalQuantity: number;
    missingItemsCount: number;
    assignedItemsCount: number;
    missingPricesCount: number;
    missingQuantitiesCount: number;
  } | null {
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
          ) ??
          defaultOption;

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

  private filterSupplierComparisonRows(
    rows: SupplierComparisonTableRow[],
    searchTerm: string
  ): SupplierComparisonTableRow[] {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) => {
      const eanMatch = row.ean.toLowerCase().includes(normalizedSearch);
      const descriptionMatch = row.description.toLowerCase().includes(normalizedSearch);
      const supplierMatch = row.availableSuppliers.some((option) =>
        option.supplierName.toLowerCase().includes(normalizedSearch)
      );

      return eanMatch || descriptionMatch || supplierMatch;
    });
  }

  private startPdfImportPolling(orderId: string): void {
    this.stopPdfImportPolling();
    console.log('[pdf-import] poll start', { orderId });

    this.pdfImportPollingSubscription = timer(2000, 2000)
      .pipe(
        switchMap(() => this.ordersService.getImportPdfStatus(orderId)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (statusResponse) => this.handlePdfImportStatus(orderId, statusResponse),
        error: (error: unknown) => {
          console.log('[pdf-import] poll failed', {
            orderId,
            error
          });
          this.pdfImportStatus.set('failed');
          this.pdfImportMessage.set(this.toMessage(error, 'Impossibile verificare lo stato import PDF.'));
          this.stopPdfImportPolling();
        }
      });
  }

  private handlePdfImportStatus(orderId: string, statusResponse: PdfImportStatusResponse): void {
    if (statusResponse.status === 'completed') {
      console.log('[pdf-import] poll completed', {
        orderId,
        itemsCount: statusResponse.itemsCount
      });
      this.pdfImportStatus.set('completed');
      this.pdfImportMessage.set(
        `Import completato: ${statusResponse.itemsCount} prodotti trovati`
      );
      this.selectedPdfFile.set(null);
      this.stopPdfImportPolling();
      void this.refreshOrderAfterPdfImport(orderId);
      return;
    }

    if (statusResponse.status === 'failed') {
      console.log('[pdf-import] poll failed', {
        orderId,
        error: statusResponse.error
      });
      this.pdfImportStatus.set('failed');
      this.pdfImportMessage.set(
        statusResponse.error?.trim() || 'Import PDF non riuscito.'
      );
      this.stopPdfImportPolling();
    }
  }

  private stopPdfImportPolling(): void {
    if (!this.pdfImportPollingSubscription) {
      return;
    }

    this.pdfImportPollingSubscription.unsubscribe();
    this.pdfImportPollingSubscription = null;
    console.log('[pdf-import] poll stop');
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
      console.log('[pdf-import] refresh failed', {
        orderId,
        error
      });
      this.pdfImportRefreshWarning.set(
        'Import completato, ma non sono riuscito ad aggiornare la tabella. Ricarica la pagina.'
      );
    }
  }

  private async refreshSupplierComparison(orderId: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.ordersService.getSupplierComparison(orderId));
      console.log('[supplier-comparison] loaded', {
        orderId,
        rows: response.rows.length
      });
      this.ordersStore.setSupplierComparisonRows(orderId, response.rows);
    } catch (error: unknown) {
      console.log('[supplier-comparison] refresh failed', {
        orderId,
        error
      });
      console.log('[supplier-comparison] failed', {
        orderId,
        error
      });
      this.supplierComparisonError.set(
        this.toMessage(
          error,
          'Non sono riuscito a caricare il confronto fornitori.'
        )
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
