import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TableModule } from 'primeng/table';

import { PdfImportJobStatus, SessionOrder, SupplierUploadResult } from '../../../models/order.models';
import { SupplierDefinition } from '../../../models/supplier.models';
import { StatusTagComponent } from '../../../shared/components/status-tag.component';
import { UploadCardState, UploadCardStatus } from './order-detail-view.models';
import { formatRate, severityTone } from './order-detail-view.utils';

@Component({
  selector: 'app-order-import-tab',
  standalone: true,
  imports: [DatePipe, StatusTagComponent, TableModule],
  template: `
    <div class="flex flex-col gap-6">
      <section class="surface-panel p-8">
        <div class="mb-6">
          <p class="section-eyebrow">1. Import ordine</p>
          <h2 class="section-title">Importazione ordine da PDF</h2>
          <p class="section-copy">
            Carica il PDF dell'ordine cliente per estrarre EAN e quantita. L'import parte subito
            alla selezione del file usando
            <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">POST /orders/:id/import-pdf</code>.
          </p>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <label
            [for]="pdfInputId"
            [class]="uploadCardClass(pdfCardState().status)"
            class="group block cursor-pointer rounded-3xl border bg-white p-8 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <input
              [id]="pdfInputId"
              type="file"
              accept=".pdf,application/pdf"
              class="sr-only"
              [disabled]="pdfCardState().status === 'uploading' || pdfCardState().status === 'processing'"
              (change)="onPdfFileChange($event)"
            />

            <div class="flex h-full flex-col items-center justify-center text-center">
              <div [class]="iconWrapClass(pdfCardState().status)" class="mb-5 flex h-20 w-20 items-center justify-center rounded-full">
                <i class="pi pi-file-pdf text-3xl"></i>
              </div>

              <h3 class="text-xl font-semibold text-slate-950">Importazione ordine da PDF</h3>
              <p class="mt-3 max-w-md text-sm leading-6 text-slate-500">
                Carica il PDF dell'ordine cliente per estrarre EAN e quantita.
              </p>

              <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
                <span [class]="statusBadgeClass(pdfCardState().status)" class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                  {{ statusLabel(pdfCardState().status) }}
                </span>
                @if (pdfCardState().fileName) {
                  <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    {{ pdfCardState().fileName }}
                  </span>
                }
              </div>

              <p class="mt-4 text-sm font-medium" [class]="statusMessageClass(pdfCardState().status)">
                {{ pdfCardMessage() }}
              </p>
            </div>
          </label>

          <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex items-center justify-between gap-4">
              <h3 class="text-base font-semibold text-slate-950">Esito ultima importazione</h3>
              @if (order().importResult) {
                <span class="text-sm text-slate-500">{{ order().importResult?.importedItems?.length ?? 0 }} righe</span>
              }
            </div>

            @if (order().importResult; as importResult) {
              <div class="mt-6 grid gap-4 sm:grid-cols-2">
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
            } @else {
              <p class="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Nessun PDF importato per questo ordine nella sessione corrente.
              </p>
            }
          </div>
        </div>

        @if (order().importResult; as importResult) {
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
        }
      </section>

      <section class="surface-panel p-8">
        <div class="mb-6">
          <p class="section-eyebrow">2. Fornitori</p>
          <h2 class="section-title">Upload listini fornitori</h2>
          <p class="section-copy">
            Ogni card usa il supplier ricevuto dal parent e avvia subito
            <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">POST /suppliers/:supplierId/files</code>
            alla selezione del file.
          </p>
        </div>

        @if (suppliers().length === 0) {
          <div class="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
            Nessun fornitore configurato. Aggiungi un fornitore per caricare il listino.
          </div>
        } @else {
          <div class="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            @for (supplier of suppliers(); track supplier.id) {
              <label
                [for]="supplierInputId(supplier.id)"
                [class]="uploadCardClass(supplierCardState(supplier.id).status)"
                class="group block cursor-pointer rounded-3xl border bg-white p-8 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <input
                  [id]="supplierInputId(supplier.id)"
                  type="file"
                  accept=".xls,.xlsx,.csv,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  class="sr-only"
                  [disabled]="supplierCardState(supplier.id).status === 'uploading'"
                  (change)="onSupplierFileChange(supplier.id, $event)"
                />

                <div class="flex h-full flex-col items-center text-center">
                  <div [class]="iconWrapClass(supplierCardState(supplier.id).status)" class="mb-5 flex h-20 w-20 items-center justify-center rounded-full">
                    <i class="pi pi-upload text-3xl"></i>
                  </div>

                  <h3 class="text-xl font-semibold text-slate-950">{{ supplier.name }}</h3>
                  <p class="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {{ supplier.id }}
                  </p>
                  <p class="mt-3 max-w-md text-sm leading-6 text-slate-500">
                    Carica listino o file fornitore. L'upload e indipendente dagli altri fornitori.
                  </p>

                  <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <span [class]="statusBadgeClass(supplierCardState(supplier.id).status)" class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                      {{ statusLabel(supplierCardState(supplier.id).status) }}
                    </span>
                    @if (supplierCardState(supplier.id).fileName) {
                      <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                        {{ supplierCardState(supplier.id).fileName }}
                      </span>
                    }
                  </div>

                  <p class="mt-4 text-sm font-medium" [class]="statusMessageClass(supplierCardState(supplier.id).status)">
                    {{ supplierCardMessage(supplier.id) }}
                  </p>

                  @if (supplierCardState(supplier.id).updatedAt) {
                    <p class="mt-2 text-xs text-slate-400">
                      Ultimo aggiornamento {{ supplierCardState(supplier.id).updatedAt | date: 'dd/MM/yyyy HH:mm' }}
                    </p>
                  }
                </div>
              </label>
            }
          </div>
        }
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderImportTabComponent {
  readonly order = input.required<SessionOrder>();
  readonly suppliers = input.required<SupplierDefinition[]>();
  readonly selectedPdfFile = input<File | null>(null);
  readonly lastPdfFileName = input<string | null>(null);
  readonly pdfUploading = input(false);
  readonly pdfImportStatus = input<PdfImportJobStatus>('idle');
  readonly pdfImportMessage = input<string | null>(null);
  readonly pdfImportRefreshWarning = input<string | null>(null);
  readonly supplierUploadState = input<Record<string, UploadCardState>>({});

  readonly pdfUploadRequested = output<File>();
  readonly supplierFileSelected = output<{ supplierId: string; file: File }>();

  readonly formatRate = formatRate;
  readonly severityTone = severityTone;
  readonly pdfInputId = 'order-pdf-upload-input';

  readonly pdfCardState = computed<UploadCardState>(() => {
    if (this.pdfUploading()) {
      return {
        status: 'uploading',
        fileName: this.selectedPdfFile()?.name ?? null,
        message: 'Upload del PDF in corso...'
      };
    }

    if (this.pdfImportStatus() === 'processing') {
      return {
        status: 'processing',
        fileName: this.selectedPdfFile()?.name ?? null,
        message:
          this.pdfImportMessage() ||
          'PDF ricevuto. Elaborazione in corso, i prodotti verranno aggiornati a breve.'
      };
    }

    if (this.pdfImportStatus() === 'completed') {
      return {
        status: 'completed',
        fileName: this.selectedPdfFile()?.name ?? this.lastPdfFileName(),
        message: this.pdfImportMessage() || 'Importazione completata con successo.'
      };
    }

    if (this.pdfImportStatus() === 'failed') {
      return {
        status: 'failed',
        fileName: this.selectedPdfFile()?.name ?? this.lastPdfFileName(),
        message: this.pdfImportMessage() || 'Importazione non riuscita.'
      };
    }

    return {
      status: 'idle',
      fileName: this.selectedPdfFile()?.name ?? this.lastPdfFileName(),
      message: 'Seleziona un PDF per avviare subito l\'importazione.'
    };
  });

  readonly pdfCardMessage = computed(() =>
    this.pdfImportRefreshWarning() || this.pdfCardState().message || 'Seleziona un PDF per iniziare.'
  );

  onPdfFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (file) {
      console.log('[OrderImportTab] selected file name', file.name);
      this.pdfUploadRequested.emit(file);
    }

    input.value = '';
  }

  onSupplierFileChange(supplierId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (file) {
      this.supplierFileSelected.emit({ supplierId, file });
    }

    input.value = '';
  }

  supplierInputId(supplierId: string): string {
    return `supplier-upload-${supplierId}`;
  }

  supplierCardState(supplierId: string): UploadCardState {
    const currentState = this.supplierUploadState()[supplierId];

    if (currentState) {
      return currentState;
    }

    const latestUpload = this.latestSupplierUpload(supplierId);

    if (latestUpload) {
      return {
        status: 'completed',
        fileName: latestUpload.fileName,
        message: latestUpload.message || 'Ultimo upload completato.',
        updatedAt: latestUpload.uploadedAt
      };
    }

    return {
      status: 'idle',
      fileName: null,
      message: 'Seleziona un file per caricare subito il listino di questo fornitore.'
    };
  }

  supplierCardMessage(supplierId: string): string {
    return this.supplierCardState(supplierId).message || 'Seleziona un file per iniziare.';
  }

  uploadCardClass(status: UploadCardStatus): string {
    if (status === 'uploading' || status === 'processing') {
      return 'border-sky-200 bg-sky-50/40 ring-1 ring-sky-100';
    }

    if (status === 'completed') {
      return 'border-emerald-200 bg-emerald-50/40 ring-1 ring-emerald-100';
    }

    if (status === 'failed') {
      return 'border-rose-200 bg-rose-50/40 ring-1 ring-rose-100';
    }

    return 'border-slate-200 bg-white';
  }

  iconWrapClass(status: UploadCardStatus): string {
    if (status === 'uploading' || status === 'processing') {
      return 'bg-sky-100 text-sky-700';
    }

    if (status === 'completed') {
      return 'bg-emerald-100 text-emerald-700';
    }

    if (status === 'failed') {
      return 'bg-rose-100 text-rose-700';
    }

    return 'bg-slate-100 text-slate-600';
  }

  statusBadgeClass(status: UploadCardStatus): string {
    if (status === 'uploading' || status === 'processing') {
      return 'bg-sky-100 text-sky-800';
    }

    if (status === 'completed') {
      return 'bg-emerald-100 text-emerald-800';
    }

    if (status === 'failed') {
      return 'bg-rose-100 text-rose-800';
    }

    return 'bg-slate-100 text-slate-700';
  }

  statusMessageClass(status: UploadCardStatus): string {
    if (status === 'uploading' || status === 'processing') {
      return 'text-sky-700';
    }

    if (status === 'completed') {
      return 'text-emerald-700';
    }

    if (status === 'failed') {
      return 'text-rose-700';
    }

    return 'text-slate-500';
  }

  statusLabel(status: UploadCardStatus): string {
    switch (status) {
      case 'uploading':
        return 'uploading';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'idle';
    }
  }

  private latestSupplierUpload(supplierId: string): SupplierUploadResult | undefined {
    const uploads = this.order().supplierUploads[supplierId] ?? [];
    return uploads.at(-1);
  }
}
