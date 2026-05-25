import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';

import {
  OrderImportColumnMapping,
  SessionOrder,
  SupplierColumnMapping,
  WorksheetColumnOption,
} from '../../../models/order.models';
import { SupplierDefinition } from '../../../models/supplier.models';
import { StatusTagComponent } from '../../../shared/components/status-tag.component';
import {
  OrderImportPreviewState,
  SupplierUploadPreviewState,
  UploadCardState,
  UploadCardStatus,
} from './order-detail-view.models';

type SupplierMappingField =
  | 'eanColumnIndex'
  | 'descriptionColumnIndex'
  | 'packageSizeColumnIndex'
  | 'netPriceColumnIndex'
  | 'sharedQuantityColumnIndex';

@Component({
  selector: 'app-order-import-tab',
  standalone: true,
  imports: [DatePipe, FormsModule, StatusTagComponent, TableModule],
  template: `
    <div class="flex flex-col gap-6">
      <section class="surface-panel p-8">
        <div class="mb-6">
          <p class="section-eyebrow">1. Import ordine</p>
          <h2 class="section-title">Importazione ordine da PDF, Excel o CSV</h2>
          <p class="section-copy">
            Carica un file ordine. Per i file tabellari mostriamo un'anteprima e
            ti lasciamo confermare le colonne per EAN, descrizione e quantita
            prima dell'import definitivo.
          </p>
        </div>

        <div>
          <label
            [for]="orderFileInputId"
            [class]="uploadCardClass(orderFileCardState().status)"
            class="group block cursor-pointer rounded-3xl border bg-white p-8 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <input
              [id]="orderFileInputId"
              type="file"
              accept=".pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              class="sr-only"
              [disabled]="orderFileUploading() || orderFileImporting()"
              (change)="onOrderFileChange($event)"
            />

            <div
              class="flex h-full flex-col items-center justify-center text-center"
            >
              <div
                [class]="iconWrapClass(orderFileCardState().status)"
                class="mb-5 flex h-20 w-20 items-center justify-center rounded-full"
              >
                <i class="pi pi-file-import text-3xl"></i>
              </div>

              <h3 class="text-xl font-semibold text-slate-950">File ordine</h3>
              <p class="mt-3 max-w-md text-sm leading-6 text-slate-500">
                PDF, Excel o CSV. Se il file contiene colonne, potrai confermare
                il mapping prima di importare.
              </p>

              <div
                class="mt-6 flex flex-wrap items-center justify-center gap-3"
              >
                <span
                  [class]="statusBadgeClass(orderFileCardState().status)"
                  class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]"
                >
                  {{ statusLabel(orderFileCardState().status) }}
                </span>
                @if (orderFileCardState().fileName) {
                  <span
                    class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {{ orderFileCardState().fileName }}
                  </span>
                }
              </div>

              <p
                class="mt-4 text-sm font-medium"
                [class]="statusMessageClass(orderFileCardState().status)"
              >
                {{ orderFileCardState().message }}
              </p>
            </div>
          </label>
        </div>

        @if (orderImportPreviewState(); as importState) {
          @if (importState.preview; as preview) {
            <div
              class="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div
                class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <h3 class="text-base font-semibold text-slate-950">
                    Conferma colonne
                  </h3>
                  <p class="mt-1 text-sm text-slate-500">
                    {{
                      preview.fileType === 'pdf'
                        ? 'Anteprima import PDF. Conferma per salvare i prodotti nel draft.'
                        : 'Controlla il mapping delle colonne prima di importare.'
                    }}
                  </p>
                </div>
                <div class="text-sm text-slate-500">
                  {{ preview.itemsCount }} prodotti leggibili
                </div>
              </div>

              @if (preview.fileType === 'spreadsheet') {
                <div class="mt-6 grid gap-4 lg:grid-cols-3">
                  <div>
                    <label class="mb-2 block text-sm font-medium text-slate-700"
                      >EAN</label
                    >
                    <select
                      class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
                      [ngModel]="orderDraftMapping()?.eanColumnIndex ?? -1"
                      (ngModelChange)="
                        onOrderMappingChange('eanColumnIndex', $event)
                      "
                    >
                      @for (
                        option of preview.columns;
                        track option.columnIndex
                      ) {
                        <option [ngValue]="option.columnIndex">
                          {{ columnLabel(option) }}
                        </option>
                      }
                    </select>
                  </div>

                  <div>
                    <label class="mb-2 block text-sm font-medium text-slate-700"
                      >Descrizione</label
                    >
                    <select
                      class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
                      [ngModel]="
                        orderDraftMapping()?.descriptionColumnIndex ?? -1
                      "
                      (ngModelChange)="
                        onOrderMappingChange('descriptionColumnIndex', $event)
                      "
                    >
                      <option [ngValue]="-1">Nessuna</option>
                      @for (
                        option of preview.columns;
                        track option.columnIndex
                      ) {
                        <option [ngValue]="option.columnIndex">
                          {{ columnLabel(option) }}
                        </option>
                      }
                    </select>
                  </div>

                  <div>
                    <label class="mb-2 block text-sm font-medium text-slate-700"
                      >Quantita</label
                    >
                    <select
                      class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
                      [ngModel]="orderDraftMapping()?.quantityColumnIndex ?? -1"
                      (ngModelChange)="
                        onOrderMappingChange('quantityColumnIndex', $event)
                      "
                    >
                      @for (
                        option of preview.columns;
                        track option.columnIndex
                      ) {
                        <option [ngValue]="option.columnIndex">
                          {{ columnLabel(option) }}
                        </option>
                      }
                    </select>
                  </div>
                </div>
              }

              <div
                class="mt-6 overflow-hidden rounded-2xl border border-slate-200"
              >
                <p-table
                  [value]="preview.previewItems"
                  responsiveLayout="scroll"
                >
                  <ng-template pTemplate="header">
                    <tr>
                      <th>EAN</th>
                      <th>Descrizione</th>
                      <th>Quantita</th>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="body" let-item>
                    <tr>
                      <td>{{ item.ean }}</td>
                      <td>{{ item.description || '-' }}</td>
                      <td>{{ item.quantity ?? '-' }}</td>
                    </tr>
                  </ng-template>
                </p-table>
              </div>

              <div
                class="mt-6 flex flex-wrap items-center justify-between gap-3"
              >
                <p class="text-sm text-slate-500">
                  @if (preview.fileType === 'pdf') {
                    Nessuna colonna da mappare: puoi confermare direttamente
                    l'import.
                  } @else {
                    Puoi modificare il mapping se il rilevamento automatico non
                    e corretto.
                  }
                </p>
                <button
                  type="button"
                  class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  [disabled]="!canConfirmOrderImport() || orderFileImporting()"
                  (click)="confirmOrderImport()"
                >
                  {{
                    orderFileImporting()
                      ? 'Import in corso...'
                      : 'Conferma import'
                  }}
                </button>
              </div>
            </div>
          }
        }

        <!-- @if (order().importResult; as importResult) {
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
        } -->
      </section>

      <section class="surface-panel p-8">
        <div class="mb-6">
          <p class="section-eyebrow">2. Fornitori</p>
          <h2 class="section-title">Fornitori dinamici e listini</h2>
          <p class="section-copy">
            Puoi aggiungere fornitori al volo e, per ogni file caricato,
            confermare il mapping di EAN, descrizione, prezzo netto, pack size,
            disponibilita e colonna ordine.
          </p>
        </div>

        <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div
            class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_auto]"
          >
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700"
                >Nome fornitore</label
              >
              <input
                type="text"
                [(ngModel)]="newSupplierName"
                placeholder="Es. Pagano"
                class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
              />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700"
                >Codice</label
              >
              <input
                type="text"
                [(ngModel)]="newSupplierCode"
                placeholder="Es. PAGANO"
                class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700"
              />
            </div>
            <div class="flex items-end">
              <button
                type="button"
                class="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                [disabled]="
                  supplierCreating() || newSupplierName.trim().length === 0
                "
                (click)="createSupplier()"
              >
                {{ supplierCreating() ? 'Creazione...' : 'Aggiungi fornitore' }}
              </button>
            </div>
          </div>
        </div>

        @if (suppliers().length === 0) {
          <div
            class="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500"
          >
            Nessun fornitore configurato. Aggiungine uno per caricare il primo
            listino.
          </div>
        } @else {
          <div class="mt-6 grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            @for (supplier of suppliers(); track supplier.id) {
              <div
                class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <label
                  [for]="supplierInputId(supplier.id)"
                  [class]="
                    uploadCardClass(supplierCardState(supplier.id).status)
                  "
                  class="group block cursor-pointer rounded-3xl border bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <input
                    [id]="supplierInputId(supplier.id)"
                    type="file"
                    accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    class="sr-only"
                    [disabled]="
                      supplierCardState(supplier.id).status === 'uploading'
                    "
                    (change)="onSupplierFileChange(supplier.id, $event)"
                  />

                  <div class="flex h-full flex-col items-center text-center">
                    <div
                      [class]="
                        iconWrapClass(supplierCardState(supplier.id).status)
                      "
                      class="mb-5 flex h-20 w-20 items-center justify-center rounded-full"
                    >
                      <i class="pi pi-upload text-3xl"></i>
                    </div>

                    <h3 class="text-xl font-semibold text-slate-950">
                      {{ supplier.name }}
                    </h3>
                    <p
                      class="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400"
                    >
                      {{ supplier.code || supplier.id }}
                    </p>
                    <p class="mt-3 text-sm leading-6 text-slate-500">
                      Carica il file fornitore e conferma le colonne prima di
                      usarlo nei confronti.
                    </p>

                    <div
                      class="mt-6 flex flex-wrap items-center justify-center gap-3"
                    >
                      <span
                        [class]="
                          statusBadgeClass(
                            supplierCardState(supplier.id).status
                          )
                        "
                        class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]"
                      >
                        {{ statusLabel(supplierCardState(supplier.id).status) }}
                      </span>
                      @if (supplierCardState(supplier.id).fileName) {
                        <span
                          class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                        >
                          {{ supplierCardState(supplier.id).fileName }}
                        </span>
                      }
                    </div>

                    <p
                      class="mt-4 text-sm font-medium"
                      [class]="
                        statusMessageClass(
                          supplierCardState(supplier.id).status
                        )
                      "
                    >
                      {{ supplierCardMessage(supplier.id) }}
                    </p>

                    @if (supplierCardState(supplier.id).updatedAt) {
                      <p class="mt-2 text-xs text-slate-400">
                        Ultimo aggiornamento
                        {{
                          supplierCardState(supplier.id).updatedAt
                            | date: 'dd/MM/yyyy HH:mm'
                        }}
                      </p>
                    }
                  </div>
                </label>

                @if (supplierPreviewState()[supplier.id]; as previewState) {
                  @if (previewState.preview; as preview) {
                    <div
                      class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <h4 class="text-sm font-semibold text-slate-950">
                        Conferma colonne
                      </h4>
                      <div class="mt-4 grid gap-3">
                        <div class="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label
                              class="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
                              >EAN</label
                            >
                            <select
                              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                              [ngModel]="
                                supplierDraftMapping(supplier.id)
                                  ?.eanColumnIndex ?? -1
                              "
                              (ngModelChange)="
                                onSupplierMappingChange(
                                  supplier.id,
                                  'eanColumnIndex',
                                  $event
                                )
                              "
                            >
                              @for (
                                option of preview.columns;
                                track option.columnIndex
                              ) {
                                <option [ngValue]="option.columnIndex">
                                  {{ columnLabel(option) }}
                                </option>
                              }
                            </select>
                          </div>
                          <div>
                            <label
                              class="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
                              >Descrizione</label
                            >
                            <select
                              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                              [ngModel]="
                                supplierDraftMapping(supplier.id)
                                  ?.descriptionColumnIndex ?? -1
                              "
                              (ngModelChange)="
                                onSupplierMappingChange(
                                  supplier.id,
                                  'descriptionColumnIndex',
                                  $event
                                )
                              "
                            >
                              @for (
                                option of preview.columns;
                                track option.columnIndex
                              ) {
                                <option [ngValue]="option.columnIndex">
                                  {{ columnLabel(option) }}
                                </option>
                              }
                            </select>
                          </div>
                          <div>
                            <label
                              class="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
                              >Prezzo netto</label
                            >
                            <select
                              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                              [ngModel]="
                                supplierDraftMapping(supplier.id)
                                  ?.netPriceColumnIndex ?? -1
                              "
                              (ngModelChange)="
                                onSupplierMappingChange(
                                  supplier.id,
                                  'netPriceColumnIndex',
                                  $event
                                )
                              "
                            >
                              @for (
                                option of preview.columns;
                                track option.columnIndex
                              ) {
                                <option [ngValue]="option.columnIndex">
                                  {{ columnLabel(option) }}
                                </option>
                              }
                            </select>
                          </div>
                          <div>
                            <label
                              class="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
                              >Pack size</label
                            >
                            <select
                              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                              [ngModel]="
                                supplierDraftMapping(supplier.id)
                                  ?.packageSizeColumnIndex ?? -1
                              "
                              (ngModelChange)="
                                onSupplierMappingChange(
                                  supplier.id,
                                  'packageSizeColumnIndex',
                                  $event
                                )
                              "
                            >
                              <option [ngValue]="-1">Nessuna</option>
                              @for (
                                option of preview.columns;
                                track option.columnIndex
                              ) {
                                <option [ngValue]="option.columnIndex">
                                  {{ columnLabel(option) }}
                                </option>
                              }
                            </select>
                          </div>
                          <div>
                            <label
                              class="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
                              >Qta / Ordine</label
                            >
                            <select
                              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                              [ngModel]="sharedQuantityColumnIndex(supplier.id)"
                              (ngModelChange)="
                                onSupplierMappingChange(
                                  supplier.id,
                                  'sharedQuantityColumnIndex',
                                  $event
                                )
                              "
                            >
                              <option [ngValue]="-1">Nessuna</option>
                              @for (
                                option of preview.columns;
                                track option.columnIndex
                              ) {
                                <option [ngValue]="option.columnIndex">
                                  {{ columnLabel(option) }}
                                </option>
                              }
                            </select>
                          </div>
                        </div>

                        <div
                          class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                        >
                          @if (preview.previewRow) {
                            <p>
                              <strong>EAN:</strong> {{ preview.previewRow.ean }}
                            </p>
                            <p>
                              <strong>Descrizione:</strong>
                              {{ preview.previewRow.description }}
                            </p>
                            <p>
                              <strong>Prezzo netto:</strong>
                              {{ preview.previewRow.netPrice }}
                            </p>
                          } @else {
                            <p>
                              Nessuna riga leggibile con il mapping attuale.
                            </p>
                          }
                          <p class="mt-2 text-xs text-slate-500">
                            {{ preview.importedProductsCount }} prodotti letti.
                          </p>
                        </div>

                        @if (previewState.error) {
                          <div
                            class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                          >
                            {{ previewState.error }}
                          </div>
                        }

                        <div class="flex justify-end">
                          <button
                            type="button"
                            class="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            [disabled]="
                              !canConfirmSupplierMapping(supplier.id) ||
                              previewState.confirming
                            "
                            (click)="confirmSupplierMapping(supplier.id)"
                          >
                            {{
                              previewState.confirming
                                ? 'Salvataggio...'
                                : 'Conferma mapping'
                            }}
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                }
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderImportTabComponent {
  readonly order = input.required<SessionOrder>();
  readonly suppliers = input.required<SupplierDefinition[]>();
  readonly orderImportPreviewState = input<OrderImportPreviewState | null>(
    null,
  );
  readonly orderFileUploading = input(false);
  readonly orderFileImporting = input(false);
  readonly orderFileMessage = input<string | null>(null);
  readonly supplierUploadState = input<Record<string, UploadCardState>>({});
  readonly supplierPreviewState = input<
    Record<string, SupplierUploadPreviewState>
  >({});
  readonly supplierCreating = input(false);

  readonly orderFileSelected = output<File>();
  readonly orderImportConfirmed = output<{
    file: File;
    mapping: OrderImportColumnMapping | null;
  }>();
  readonly supplierFileSelected = output<{ supplierId: string; file: File }>();
  readonly supplierMappingConfirmed = output<{
    supplierId: string;
    file: File;
    mapping: SupplierColumnMapping | null;
  }>();
  readonly supplierCreateRequested = output<{
    name: string;
    code?: string | null;
  }>();

  readonly orderFileInputId = 'order-import-upload-input';

  readonly orderDraftMapping = signal<OrderImportColumnMapping | null>(null);
  readonly supplierDraftMappings = signal<
    Record<string, SupplierColumnMapping | null>
  >({});

  newSupplierName = '';
  newSupplierCode = '';

  readonly orderFileCardState = computed<UploadCardState>(() => {
    const previewState = this.orderImportPreviewState();
    const fileName = previewState?.file?.name ?? null;

    if (this.orderFileUploading()) {
      return {
        status: 'uploading',
        fileName,
        message: 'Analisi del file in corso...',
      };
    }

    if (this.orderFileImporting()) {
      return {
        status: 'processing',
        fileName,
        message: this.orderFileMessage() || 'Importazione in corso...',
      };
    }

    if (previewState?.preview) {
      return {
        status: 'processing',
        fileName,
        message:
          this.orderFileMessage() ||
          (previewState.preview.requiresMapping
            ? "Conferma il mapping delle colonne per completare l'import."
            : 'Anteprima pronta. Conferma per importare.'),
      };
    }

    return {
      status: 'idle',
      fileName,
      message:
        this.orderFileMessage() || 'Seleziona un file ordine per iniziare.',
    };
  });

  constructor() {
    effect(
      () => {
        const previewState = this.orderImportPreviewState();
        const preview = previewState?.preview;

        if (!preview) {
          this.orderDraftMapping.set(null);
          return;
        }

        this.orderDraftMapping.set(
          preview.detectedMapping
            ? { ...preview.detectedMapping }
            : {
                headerRowIndex: preview.headerRowIndex ?? 0,
                eanColumnIndex: preview.columns[0]?.columnIndex ?? 0,
                descriptionColumnIndex: preview.columns[1]?.columnIndex ?? null,
                quantityColumnIndex: preview.columns[2]?.columnIndex ?? 0,
              },
        );
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const previewState = this.supplierPreviewState();
        const nextMappings: Record<string, SupplierColumnMapping | null> = {};

        for (const [supplierId, state] of Object.entries(previewState)) {
          const preview = state.preview;

          if (!preview) {
            nextMappings[supplierId] = null;
            continue;
          }

          nextMappings[supplierId] = state.mapping ??
            preview.detectedMapping ?? {
              supplierId,
              headerRowIndex: preview.headerRowIndex ?? 0,
              eanColumnIndex: preview.columns[0]?.columnIndex ?? 0,
              descriptionColumnIndex: preview.columns[1]?.columnIndex ?? 0,
              packageSizeColumnIndex: null,
              netPriceColumnIndex: preview.columns[2]?.columnIndex ?? 0,
              grossPriceColumnIndex: null,
              availabilityColumnIndex: null,
              orderQuantityColumnIndex: null,
            };
        }

        this.supplierDraftMappings.set(nextMappings);
      },
      { allowSignalWrites: true },
    );
  }

  onOrderFileChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0] ?? null;

    if (file) {
      this.orderFileSelected.emit(file);
    }

    inputElement.value = '';
  }

  onSupplierFileChange(supplierId: string, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0] ?? null;

    if (file) {
      this.supplierFileSelected.emit({ supplierId, file });
    }

    inputElement.value = '';
  }

  createSupplier(): void {
    const name = this.newSupplierName.trim();
    const code = this.newSupplierCode.trim();

    if (!name) {
      return;
    }

    this.supplierCreateRequested.emit({
      name,
      code: code.length > 0 ? code : null,
    });
    this.newSupplierName = '';
    this.newSupplierCode = '';
  }

  onOrderMappingChange(
    field: 'eanColumnIndex' | 'descriptionColumnIndex' | 'quantityColumnIndex',
    rawValue: number,
  ): void {
    const currentMapping = this.orderDraftMapping();

    if (!currentMapping) {
      return;
    }

    this.orderDraftMapping.set({
      ...currentMapping,
      [field]:
        field === 'descriptionColumnIndex' && rawValue < 0
          ? null
          : Number(rawValue),
    });
  }

  confirmOrderImport(): void {
    const previewState = this.orderImportPreviewState();

    if (!previewState?.file) {
      return;
    }

    this.orderImportConfirmed.emit({
      file: previewState.file,
      mapping: previewState.preview?.requiresMapping
        ? this.orderDraftMapping()
        : null,
    });
  }

  onSupplierMappingChange(
    supplierId: string,
    field: SupplierMappingField,
    rawValue: number,
  ): void {
    const currentMapping = this.supplierDraftMapping(supplierId);

    if (!currentMapping) {
      return;
    }

    const value = rawValue < 0 ? null : Number(rawValue);
    this.supplierDraftMappings.update((state) => ({
      ...state,
      [supplierId]:
        field === 'sharedQuantityColumnIndex'
          ? {
              ...currentMapping,
              availabilityColumnIndex: value,
              orderQuantityColumnIndex: value,
            }
          : {
              ...currentMapping,
              [field]: value,
            },
    }));
  }

  confirmSupplierMapping(supplierId: string): void {
    const previewState = this.supplierPreviewState()[supplierId];
    const mapping = this.supplierDraftMapping(supplierId);

    if (!previewState?.file || !mapping) {
      return;
    }

    this.supplierMappingConfirmed.emit({
      supplierId,
      file: previewState.file,
      mapping: {
        ...mapping,
        supplierId,
      },
    });
  }

  canConfirmOrderImport(): boolean {
    const preview = this.orderImportPreviewState()?.preview;

    if (!preview) {
      return false;
    }

    if (preview.fileType === 'pdf') {
      return true;
    }

    const mapping = this.orderDraftMapping();
    return (
      !!mapping &&
      mapping.eanColumnIndex >= 0 &&
      mapping.quantityColumnIndex >= 0
    );
  }

  canConfirmSupplierMapping(supplierId: string): boolean {
    const mapping = this.supplierDraftMapping(supplierId);

    return !!(
      mapping &&
      mapping.eanColumnIndex >= 0 &&
      mapping.descriptionColumnIndex >= 0 &&
      mapping.netPriceColumnIndex >= 0
    );
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
        updatedAt: latestUpload.uploadedAt,
      };
    }

    return {
      status: 'idle',
      fileName: null,
      message: 'Seleziona un file per caricare il listino di questo fornitore.',
    };
  }

  supplierCardMessage(supplierId: string): string {
    return (
      this.supplierCardState(supplierId).message ||
      'Seleziona un file per iniziare.'
    );
  }

  supplierDraftMapping(supplierId: string): SupplierColumnMapping | null {
    return this.supplierDraftMappings()[supplierId] ?? null;
  }

  sharedQuantityColumnIndex(supplierId: string): number {
    const mapping = this.supplierDraftMapping(supplierId);
    return (
      mapping?.orderQuantityColumnIndex ??
      mapping?.availabilityColumnIndex ??
      -1
    );
  }

  columnLabel(option: WorksheetColumnOption): string {
    const label =
      option.label.trim().length > 0 ? option.label : 'Colonna senza nome';
    return `${option.columnLetter} - ${label}`;
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
        return 'preview';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'idle';
    }
  }

  private latestSupplierUpload(supplierId: string) {
    const uploads = this.order().supplierUploads[supplierId] ?? [];
    return uploads.at(-1);
  }
}
