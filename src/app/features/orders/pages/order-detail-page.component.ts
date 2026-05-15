import { DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

import { ReviewItem, SupplierUploadResult } from '../../../models/order.models';
import { SESSION_SUPPLIERS } from '../../../models/supplier.models';
import { OrdersSessionStore } from '../../../services/orders-session.store';
import { OrdersService } from '../../../services/orders.service';
import { StatusTagComponent } from '../../../shared/components/status-tag.component';

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
                [disabled]="!selectedPdfFile() || pdfUploading()"
                (click)="uploadPdf()"
              >
                {{ pdfUploading() ? 'Import in corso...' : 'Importa PDF' }}
              </button>
            </div>
          </div>

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
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p class="section-eyebrow">5. Export</p>
              <h2 class="section-title">Genera ordini</h2>
              <p class="section-copy">
                Chiamata
                <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">POST /orders/:id/export</code>
                e rendering del risultato senza logica business lato client.
              </p>
            </div>

            <button
              pButton
              type="button"
              class="justify-center !rounded-2xl !bg-slate-950 !px-6 !py-3 !text-sm !font-semibold !text-white"
              [disabled]="exporting()"
              (click)="generateExport()"
            >
              {{ exporting() ? 'Export in corso...' : 'Genera ordini' }}
            </button>
          </div>

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
  private readonly route = inject(ActivatedRoute);
  private readonly ordersStore = inject(OrdersSessionStore);
  private readonly ordersService = inject(OrdersService);

  readonly suppliers = SESSION_SUPPLIERS;
  readonly selectedPdfFile = signal<File | null>(null);
  readonly pdfUploading = signal(false);
  readonly exporting = signal(false);
  readonly pageError = signal<string | null>(null);
  readonly supplierFiles = signal<Record<string, File | null>>({});
  readonly supplierLoadingState = signal<Record<string, boolean>>({});

  readonly orderId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' }
  );
  readonly order = computed(() => this.ordersStore.orderById(this.orderId()));

  onPdfFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedPdfFile.set(input.files?.[0] ?? null);
  }

  async uploadPdf(): Promise<void> {
    const file = this.selectedPdfFile();
    const orderId = this.orderId();

    if (!file || !orderId) {
      return;
    }

    this.pdfUploading.set(true);
    this.pageError.set(null);

    try {
      const response = await firstValueFrom(this.ordersService.importPdf(orderId, file));
      this.ordersStore.setImportResult(orderId, response);
      this.selectedPdfFile.set(null);
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
      this.ordersStore.appendSupplierUpload(orderId, response);
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

  private setSupplierLoading(supplierId: string, loading: boolean): void {
    this.supplierLoadingState.update((state) => ({
      ...state,
      [supplierId]: loading
    }));
  }

  private toMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
