import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

import { PdfImportJobStatus, SessionOrder, SupplierUploadResult } from '../../../models/order.models';
import { SupplierDefinition } from '../../../models/supplier.models';
import { StatusTagComponent } from '../../../shared/components/status-tag.component';
import { formatRate, severityTone } from './order-detail-view.utils';

@Component({
  selector: 'app-order-import-tab',
  standalone: true,
  imports: [ButtonModule, DatePipe, StatusTagComponent, TableModule],
  template: `
    <div class="flex flex-col gap-6">
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
              (change)="onPdfFileChange($event)"
            />
            <button
              pButton
              type="button"
              class="justify-center !rounded-2xl !bg-slate-950 !px-5 !py-3 !text-sm !font-semibold !text-white"
              [disabled]="!selectedPdfFile() || pdfUploading() || pdfImportStatus() === 'processing'"
              (click)="pdfUploadRequested.emit()"
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
            <p class="mt-1">Puoi continuare a lavorare: i prodotti verranno aggiunti appena pronti.</p>
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

        @if (order().importResult; as importResult) {
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
                      <th>Quantita</th>
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
        <p class="section-eyebrow">2. Upload file fornitori</p>
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
          @for (supplier of suppliers(); track supplier.id) {
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
                  (change)="onSupplierFileChange(supplier.id, $event)"
                />

                <button
                  pButton
                  type="button"
                  class="justify-center !rounded-2xl !border !border-slate-300 !bg-white !px-5 !py-3 !text-sm !font-semibold !text-slate-700"
                  [disabled]="!selectedSupplierFile(supplier.id) || supplierUploading(supplier.id)"
                  (click)="supplierUploadRequested.emit(supplier.id)"
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
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderImportTabComponent {
  readonly order = input.required<SessionOrder>();
  readonly suppliers = input.required<SupplierDefinition[]>();
  readonly selectedPdfFile = input<File | null>(null);
  readonly pdfUploading = input(false);
  readonly pdfImportStatus = input<PdfImportJobStatus>('idle');
  readonly pdfImportMessage = input<string | null>(null);
  readonly pdfImportRefreshWarning = input<string | null>(null);
  readonly supplierFiles = input<Record<string, File | null>>({});
  readonly supplierLoadingState = input<Record<string, boolean>>({});

  readonly pdfFileSelected = output<File | null>();
  readonly pdfUploadRequested = output<void>();
  readonly supplierFileSelected = output<{ supplierId: string; file: File | null }>();
  readonly supplierUploadRequested = output<string>();

  readonly formatRate = formatRate;
  readonly severityTone = severityTone;

  onPdfFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.pdfFileSelected.emit(input.files?.[0] ?? null);
  }

  onSupplierFileChange(supplierId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.supplierFileSelected.emit({
      supplierId,
      file: input.files?.[0] ?? null
    });
  }

  selectedSupplierFile(supplierId: string): File | null {
    return this.supplierFiles()[supplierId] ?? null;
  }

  supplierUploading(supplierId: string): boolean {
    return this.supplierLoadingState()[supplierId] ?? false;
  }

  latestSupplierUpload(supplierId: string): SupplierUploadResult | undefined {
    const uploads = this.order().supplierUploads[supplierId] ?? [];
    return uploads.at(-1);
  }
}
