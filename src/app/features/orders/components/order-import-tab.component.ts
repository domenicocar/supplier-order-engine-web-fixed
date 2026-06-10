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
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';

import {
  OrderImportColumnMapping,
  SessionOrder,
  SupplierColumnMapping,
  WorksheetColumnOption,
} from '../../../models/order.models';
import { SupplierDefinition } from '../../../models/supplier.models';
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

type DraftSupplierCard = {
  id: string;
  name: string;
  error: string | null;
  preferred: boolean;
};

@Component({
  selector: 'app-order-import-tab',
  standalone: true,
  imports: [DatePipe, DialogModule, FormsModule, TableModule],
  template: `
    <div class="flex flex-col gap-6">
      <section class="surface-panel p-6 md:p-7">
        <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="section-eyebrow">1. Import ordine</p>
            <h2 class="section-title">Importazione ordine da PDF, Excel o CSV</h2>
            <p class="section-copy">
              Carica un file ordine. Per i file tabellari mostriamo un'anteprima e
              ti lasciamo confermare le colonne per EAN, descrizione e quantita
              prima dell'import definitivo.
            </p>
          </div>

          <button
            type="button"
            class="shrink-0 self-start rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
            (click)="openOrderProductsDialog()"
          >
            Vedi ordine
          </button>
        </div>

        <div class="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
          <div class="flex items-start gap-3">
            <div
              [class]="iconWrapClass(orderFileCardState().status)"
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            >
              <i class="pi pi-file-import text-lg"></i>
            </div>
            <div class="min-w-0">
              <h3 class="text-base font-semibold text-[var(--app-text)]">File ordine</h3>
              <p class="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">
                Excel, CSV o PDF. Colonne attese: EAN, descrizione, quantita.
              </p>
            </div>
          </div>

          <label
            [for]="orderFileInputId"
            [class]="uploadDropzoneClass(orderFileCardState().status)"
            class="mt-5 block cursor-pointer rounded-2xl border border-dashed px-4 py-4 transition duration-200"
          >
            <input
              [id]="orderFileInputId"
              type="file"
              accept=".pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              class="sr-only"
              [disabled]="orderFileUploading() || orderFileImporting()"
              (change)="onOrderFileChange($event)"
            />

            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-surface-muted)] text-[var(--brand-secondary)]">
                <i class="pi pi-upload text-base"></i>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-[var(--app-text)]">Clicca per caricare un file</p>
                <p class="text-xs text-[var(--app-text-muted)]">Formati: .xlsx, .xls, .csv, .pdf</p>
              </div>
            </div>
          </label>

          <div class="mt-4 flex flex-wrap items-center gap-3">
                @if (shouldShowStatusBadge(orderFileCardState().status)) {
                  <span
                    [class]="statusBadgeClass(orderFileCardState().status)"
                    class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]"
                  >
                    {{ statusLabel(orderFileCardState().status) }}
                  </span>
                }
            @if (orderFileCardState().fileName) {
              <span
                class="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--app-text-muted)]"
              >
                {{ orderFileCardState().fileName }}
              </span>
            }
            @if (
              order().importResult &&
              orderFileCardState().status === 'completed'
            ) {
              <span
                class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              >
                <i class="pi pi-check-circle text-[0.7rem]" aria-hidden="true"></i>
                <span>{{ draftItemsCount() }} prodotti nel draft</span>
              </span>
            }
          </div>

          <p
            class="mt-3 text-sm font-medium"
            [class]="statusMessageClass(orderFileCardState().status)"
          >
            {{ orderFileCardState().message }}
          </p>
        </div>

        <p-dialog
          [visible]="orderProductsDialogVisible"
          (visibleChange)="orderProductsDialogVisible = $event"
          [modal]="true"
          [draggable]="false"
          [resizable]="false"
          [dismissableMask]="true"
          [style]="{ width: 'min(960px, 96vw)' }"
          header="Prodotti ordine"
        >
          <div class="flex flex-col gap-4">
            <p class="text-sm leading-6 text-slate-500">
              Elenco dei prodotti attualmente presenti nel draft ordine.
            </p>

            <div class="overflow-hidden rounded-2xl border border-slate-200">
              <p-table
                [value]="order().items"
                [paginator]="order().items.length > orderItemsPageSize"
                [rows]="orderItemsPageSize"
                [rowsPerPageOptions]="[10, 25, 50]"
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
                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td colspan="3" class="px-4 py-5 text-sm text-slate-500">
                      Nessun prodotto presente. Importa un file ordine per popolare la tabella.
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </div>
        </p-dialog>

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
                  class="app-primary-action text-sm disabled:cursor-not-allowed disabled:opacity-50"
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

      <section class="surface-panel p-6 md:p-7">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="section-eyebrow">2. Fornitori</p>
            <h2 class="section-title">Fornitori e listini</h2>
            <p class="section-copy">
              Crea un fornitore al momento del primo upload e poi conferma il mapping di EAN,
              descrizione, prezzo netto, pack size, disponibilita e colonna ordine.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="inline-flex shrink-0 items-center gap-2 self-start rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--app-text)] shadow-sm transition hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]"
              (click)="createSupplier()"
            >
              <i class="pi pi-plus text-xs" aria-hidden="true"></i>
              <span>Aggiungi fornitore</span>
            </button>

            <button
              type="button"
              class="app-primary-action shrink-0 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              [disabled]="!hasSupplierUploads() || supplierComparisonLoading()"
              (click)="supplierComparisonRequested.emit()"
            >
              {{ supplierComparisonLoading() ? 'Confronto in corso...' : 'Confronta fornitori' }}
            </button>
          </div>
        </div>

        @if (suppliers().length === 0 && draftSuppliers().length === 0) {
          <div
            class="mt-6 rounded-3xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-6 py-8 text-center text-sm text-[var(--app-text-muted)]"
          >
            Nessun fornitore configurato. Aggiungine uno e carica il primo listino.
          </div>
        } @else {
          <div class="mt-6 grid gap-5 xl:grid-cols-2">
            @for (draftSupplier of draftSuppliers(); track draftSupplier.id) {
              <div class="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                      <i class="pi pi-file-edit text-sm" aria-hidden="true"></i>
                    </div>
                    <div class="min-w-0">
                      <h3 class="text-base font-semibold text-[var(--app-text)]">Nuovo fornitore</h3>
                      <p class="text-xs text-[var(--app-text-muted)]">
                        Inserisci il nome e carica il primo listino.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50"
                    [class]="draftSupplier.preferred
                      ? 'border-[var(--app-success-border)] bg-[var(--app-success-bg)] text-[var(--app-success-text)]'
                      : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-[var(--app-success-border)] hover:text-[var(--app-success-text)]'"
                    [disabled]="isDraftSupplierBusy(draftSupplier.id)"
                    title="A parita di prezzo viene scelto il fornitore favorito. Una scelta manuale mantiene sempre la priorita."
                    [attr.aria-label]="draftSupplier.preferred ? 'Rimuovi fornitore favorito' : 'Imposta fornitore favorito'"
                    (click)="onDraftSupplierPreferredChange(draftSupplier.id, !draftSupplier.preferred)"
                  >
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path
                        [attr.fill]="draftSupplier.preferred ? 'currentColor' : 'none'"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.1 5.36a.56.56 0 0 0 .47.35l5.74.43a.56.56 0 0 1 .32.98l-4.37 3.74a.56.56 0 0 0-.18.56l1.33 5.6a.56.56 0 0 1-.84.61L12.3 18.2a.56.56 0 0 0-.6 0l-4.88 2.93a.56.56 0 0 1-.84-.61l1.33-5.6a.56.56 0 0 0-.18-.56L2.76 10.6a.56.56 0 0 1 .32-.98l5.74-.43a.56.56 0 0 0 .47-.35z"
                      />
                    </svg>
                  </button>
                </div>

                <div class="mt-4">
                  <label class="mb-2 block text-sm font-medium text-[var(--app-text)]">
                    Nome fornitore
                  </label>
                  <input
                    type="text"
                    class="app-input w-full"
                    [ngModel]="draftSupplier.name"
                    [disabled]="isDraftSupplierBusy(draftSupplier.id)"
                    placeholder="Es. Fornitore Alpha"
                    (ngModelChange)="onDraftSupplierNameChange(draftSupplier.id, $event)"
                  />
                </div>

                <label
                  [for]="draftSupplierInputId(draftSupplier.id)"
                  [class]="uploadDropzoneClass(draftSupplierCardState(draftSupplier.id).status)"
                  class="mt-4 block cursor-pointer rounded-2xl border border-dashed px-4 py-4 transition duration-200"
                >
                  <input
                    [id]="draftSupplierInputId(draftSupplier.id)"
                    type="file"
                    accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    class="sr-only"
                    [disabled]="isDraftSupplierBusy(draftSupplier.id)"
                    (change)="onDraftSupplierFileChange(draftSupplier.id, $event)"
                  />

                  <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-surface-muted)] text-[var(--brand-secondary)]">
                      <i class="pi pi-upload text-base"></i>
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-[var(--app-text)]">Clicca per caricare un file</p>
                      <p class="text-xs text-[var(--app-text-muted)]">Formati: .xlsx, .xls, .csv</p>
                    </div>
                  </div>
                </label>

                <div class="mt-3 flex flex-wrap items-center gap-2">
                  @if (shouldShowStatusBadge(draftSupplierCardState(draftSupplier.id).status)) {
                    <span
                      [class]="statusBadgeClass(draftSupplierCardState(draftSupplier.id).status)"
                      class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]"
                    >
                      {{ statusLabel(draftSupplierCardState(draftSupplier.id).status) }}
                    </span>
                  }
                  @if (draftSupplierCardState(draftSupplier.id).fileName) {
                    <span class="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--app-text-muted)]">
                      {{ draftSupplierCardState(draftSupplier.id).fileName }}
                    </span>
                  }
                </div>

                @if (draftSupplier.error) {
                  <div class="app-alert-error mt-3">
                    {{ draftSupplier.error }}
                  </div>
                }

                @if (draftSupplierCardState(draftSupplier.id).message) {
                  <p
                    class="mt-3 text-sm font-medium"
                    [class]="statusMessageClass(draftSupplierCardState(draftSupplier.id).status)"
                  >
                    {{ draftSupplierCardState(draftSupplier.id).message }}
                  </p>
                }
              </div>
            }

            @for (supplier of suppliers(); track supplier.id) {
              <div class="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-tertiary-soft)] text-[#1f6a46]">
                      <i class="pi pi-shop text-sm" aria-hidden="true"></i>
                    </div>
                    <div class="min-w-0">
                      <h3 class="text-base font-semibold text-[var(--app-text)]">
                        {{ supplier.name }}
                      </h3>
                      @if (supplier.code) {
                        <p class="text-xs uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
                          {{ supplier.code }}
                        </p>
                      } @else {
                        <p class="text-xs text-[var(--app-text-muted)]">
                          Carica o aggiorna il listino del fornitore.
                        </p>
                      }
                    </div>
                  </div>
                  <button
                    type="button"
                    class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50"
                    [class]="(supplier.preferred ?? false)
                      ? 'border-[var(--app-success-border)] bg-[var(--app-success-bg)] text-[var(--app-success-text)]'
                      : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-[var(--app-success-border)] hover:text-[var(--app-success-text)]'"
                    [disabled]="supplierPreferenceUpdatingId() !== null"
                    title="A parita di prezzo viene scelto il fornitore favorito. Una scelta manuale mantiene sempre la priorita."
                    [attr.aria-label]="(supplier.preferred ?? false) ? 'Rimuovi fornitore favorito' : 'Imposta fornitore favorito'"
                    (click)="supplierPreferredChanged.emit({ supplierId: supplier.id, preferred: !(supplier.preferred ?? false) })"
                  >
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path
                        [attr.fill]="(supplier.preferred ?? false) ? 'currentColor' : 'none'"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.1 5.36a.56.56 0 0 0 .47.35l5.74.43a.56.56 0 0 1 .32.98l-4.37 3.74a.56.56 0 0 0-.18.56l1.33 5.6a.56.56 0 0 1-.84.61L12.3 18.2a.56.56 0 0 0-.6 0l-4.88 2.93a.56.56 0 0 1-.84-.61l1.33-5.6a.56.56 0 0 0-.18-.56L2.76 10.6a.56.56 0 0 1 .32-.98l5.74-.43a.56.56 0 0 0 .47-.35z"
                      />
                    </svg>
                  </button>
                </div>

                <div class="mt-4">
                  <label class="mb-2 block text-sm font-medium text-[var(--app-text)]">
                    Nome fornitore
                  </label>
                  <input
                    type="text"
                    class="app-input w-full"
                    [value]="supplier.name"
                    readonly
                  />
                </div>

                <label
                  [for]="supplierInputId(supplier.id)"
                  [class]="uploadDropzoneClass(supplierCardState(supplier.id).status)"
                  class="mt-4 block cursor-pointer rounded-2xl border border-dashed px-4 py-4 transition duration-200"
                >
                  <input
                    [id]="supplierInputId(supplier.id)"
                    type="file"
                    accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    class="sr-only"
                    [disabled]="supplierCardState(supplier.id).status === 'uploading'"
                    (change)="onSupplierFileChange(supplier.id, $event)"
                  />

                  <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-surface-muted)] text-[var(--brand-secondary)]">
                      <i class="pi pi-upload text-base"></i>
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-[var(--app-text)]">Clicca per caricare un file</p>
                      <p class="text-xs text-[var(--app-text-muted)]">Formati: .xlsx, .xls, .csv</p>
                    </div>
                  </div>
                </label>

                <div class="mt-3 flex flex-wrap items-center gap-2">
                  @if (shouldShowStatusBadge(supplierCardState(supplier.id).status)) {
                    <span
                      [class]="statusBadgeClass(supplierCardState(supplier.id).status)"
                      class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]"
                    >
                      {{ statusLabel(supplierCardState(supplier.id).status) }}
                    </span>
                  }
                  @if (supplierCardState(supplier.id).fileName) {
                    <span class="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--app-text-muted)]">
                      {{ supplierCardState(supplier.id).fileName }}
                    </span>
                  }
                </div>

                <p
                  class="mt-3 text-sm font-medium"
                  [class]="statusMessageClass(supplierCardState(supplier.id).status)"
                >
                  {{ supplierCardMessage(supplier.id) }}
                </p>

                @if (supplierCardState(supplier.id).updatedAt) {
                  <p class="mt-2 text-xs text-[var(--app-text-muted)]">
                    Ultimo aggiornamento
                    {{ supplierCardState(supplier.id).updatedAt | date: 'dd/MM/yyyy HH:mm' }}
                  </p>
                }

                @if (supplierPreviewState()[supplier.id]; as previewState) {
                  @if (previewState.preview; as preview) {
                    <div class="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                      <h4 class="text-sm font-semibold text-[var(--app-text)]">
                        Conferma colonne
                      </h4>
                      <div class="mt-4 grid gap-3">
                        <div class="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label class="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--app-text-muted)]">EAN</label>
                            <select
                              class="app-input w-full rounded-xl px-3 py-2"
                              [ngModel]="supplierDraftMapping(supplier.id)?.eanColumnIndex ?? -1"
                              (ngModelChange)="onSupplierMappingChange(supplier.id, 'eanColumnIndex', $event)"
                            >
                              @for (option of preview.columns; track option.columnIndex) {
                                <option [ngValue]="option.columnIndex">
                                  {{ columnLabel(option) }}
                                </option>
                              }
                            </select>
                          </div>
                          <div>
                            <label class="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Descrizione</label>
                            <select
                              class="app-input w-full rounded-xl px-3 py-2"
                              [ngModel]="supplierDraftMapping(supplier.id)?.descriptionColumnIndex ?? -1"
                              (ngModelChange)="onSupplierMappingChange(supplier.id, 'descriptionColumnIndex', $event)"
                            >
                              @for (option of preview.columns; track option.columnIndex) {
                                <option [ngValue]="option.columnIndex">
                                  {{ columnLabel(option) }}
                                </option>
                              }
                            </select>
                          </div>
                          <div>
                            <label class="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Prezzo netto</label>
                            <select
                              class="app-input w-full rounded-xl px-3 py-2"
                              [ngModel]="supplierDraftMapping(supplier.id)?.netPriceColumnIndex ?? -1"
                              (ngModelChange)="onSupplierMappingChange(supplier.id, 'netPriceColumnIndex', $event)"
                            >
                              @for (option of preview.columns; track option.columnIndex) {
                                <option [ngValue]="option.columnIndex">
                                  {{ columnLabel(option) }}
                                </option>
                              }
                            </select>
                          </div>
                          <div>
                            <label class="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Pack size</label>
                            <select
                              class="app-input w-full rounded-xl px-3 py-2"
                              [ngModel]="supplierDraftMapping(supplier.id)?.packageSizeColumnIndex ?? -1"
                              (ngModelChange)="onSupplierMappingChange(supplier.id, 'packageSizeColumnIndex', $event)"
                            >
                              <option [ngValue]="-1">Nessuna</option>
                              @for (option of preview.columns; track option.columnIndex) {
                                <option [ngValue]="option.columnIndex">
                                  {{ columnLabel(option) }}
                                </option>
                              }
                            </select>
                          </div>
                          <div>
                            <label class="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Qta / Ordine</label>
                            <select
                              class="app-input w-full rounded-xl px-3 py-2"
                              [ngModel]="sharedQuantityColumnIndex(supplier.id)"
                              (ngModelChange)="onSupplierMappingChange(supplier.id, 'sharedQuantityColumnIndex', $event)"
                            >
                              <option [ngValue]="-1">Nessuna</option>
                              @for (option of preview.columns; track option.columnIndex) {
                                <option [ngValue]="option.columnIndex">
                                  {{ columnLabel(option) }}
                                </option>
                              }
                            </select>
                          </div>
                        </div>

                        @if (previewState.previewing) {
                          <div class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text-muted)]">
                            <div class="animate-pulse space-y-3" aria-label="Verifica anteprima in corso">
                              <div class="h-4 w-2/5 rounded-full bg-slate-200"></div>
                              <div class="h-4 w-4/5 rounded-full bg-slate-200"></div>
                              <div class="h-4 w-1/3 rounded-full bg-slate-200"></div>
                              <div class="h-4 w-1/4 rounded-full bg-slate-200"></div>
                              <div class="mt-4 h-3 w-1/3 rounded-full bg-slate-100"></div>
                            </div>
                          </div>
                        } @else if (preview.previewRow && preview.importedProductsCount > 0) {
                          <div class="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text-muted)]">
                              <p><strong>EAN:</strong> {{ preview.previewRow.ean }}</p>
                              <p><strong>Descrizione:</strong> {{ preview.previewRow.description }}</p>
                              <p><strong>Pack size:</strong> {{ preview.previewRow.packageSize }}</p>
                              <p><strong>Prezzo netto:</strong> {{ preview.previewRow.netPrice }}</p>
                              <p class="mt-2 text-xs text-[var(--app-text-muted)]">
                                {{ preview.importedProductsCount }} prodotti letti.
                              </p>
                          </div>
                        } @else {
                          <div class="app-alert-error">
                            <p>Nessuna riga leggibile con il mapping attuale.</p>
                            <p class="mt-1 text-xs">0 prodotti letti.</p>
                          </div>
                        }

                        @if (!previewState.previewing) {
                          @if (previewState.error) {
                            <div class="app-alert-error">
                              {{ previewState.error }}
                            </div>
                          }
                        }

                        <div class="flex flex-wrap justify-end gap-3">
                          <button
                            type="button"
                            class="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                            [disabled]="!hasValidSupplierMapping(supplier.id) || previewState.previewing || previewState.confirming"
                            (click)="previewSupplierMapping(supplier.id)"
                          >
                            {{ previewState.previewing ? 'Verifica mapping in corso...' : 'Verifica mapping' }}
                          </button>
                          <button
                            type="button"
                            class="app-primary-action px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                            [disabled]="!canConfirmSupplierMapping(supplier.id) || previewState.previewing || previewState.confirming"
                            (click)="confirmSupplierMapping(supplier.id)"
                          >
                            {{ previewState.confirming ? 'Salvataggio...' : 'Conferma mapping' }}
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
  readonly pendingSupplierDraftState = input<Record<string, UploadCardState>>({});
  readonly supplierUploadState = input<Record<string, UploadCardState>>({});
  readonly supplierPreviewState = input<
    Record<string, SupplierUploadPreviewState>
  >({});
  readonly supplierCreating = input(false);
  readonly supplierPreferenceUpdatingId = input<string | null>(null);
  readonly supplierComparisonLoading = input(false);
  readonly hasSupplierUploads = input(false);

  readonly orderFileSelected = output<File>();
  readonly orderImportConfirmed = output<{
    file: File;
    mapping: OrderImportColumnMapping | null;
  }>();
  readonly supplierDraftFileSelected = output<{
    draftId: string;
    name: string;
    file: File;
    preferred: boolean;
  }>();
  readonly supplierFileSelected = output<{ supplierId: string; file: File }>();
  readonly supplierPreferredChanged = output<{ supplierId: string; preferred: boolean }>();
  readonly supplierMappingPreviewRequested = output<{
    supplierId: string;
    file: File;
    mapping: SupplierColumnMapping;
  }>();
  readonly supplierMappingConfirmed = output<{
    supplierId: string;
    file: File;
    mapping: SupplierColumnMapping | null;
  }>();
  readonly supplierComparisonRequested = output<void>();

  readonly orderFileInputId = 'order-import-upload-input';

  readonly orderDraftMapping = signal<OrderImportColumnMapping | null>(null);
  readonly supplierDraftMappings = signal<
    Record<string, SupplierColumnMapping | null>
  >({});
  readonly draftSuppliers = signal<DraftSupplierCard[]>([]);

  readonly orderItemsPageSize = 10;
  orderProductsDialogVisible = false;
  readonly draftItemsCount = computed(() => this.order().items.length);

  readonly orderFileCardState = computed<UploadCardState>(() => {
    const previewState = this.orderImportPreviewState();
    const fileName = previewState?.file?.name ?? null;
    const importResult = this.order().importResult;

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

    if (importResult) {
      return {
        status: 'completed',
        fileName,
        message:
          this.orderFileMessage() ||
          `${this.draftItemsCount()} prodotti gi\u00E0 importati nel draft.`,
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

    effect(
      () => {
        const pendingDraftStates = this.pendingSupplierDraftState();

        this.draftSuppliers.update((draftSuppliers) =>
          draftSuppliers.filter(
            (draftSupplier) =>
              pendingDraftStates[draftSupplier.id]?.status !== 'completed',
          ),
        );
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

  openOrderProductsDialog(): void {
    this.orderProductsDialogVisible = true;
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
    this.draftSuppliers.update((draftSuppliers) => [
      ...draftSuppliers,
      {
        id: this.nextDraftSupplierId(),
        name: '',
        error: null,
        preferred: false,
      },
    ]);
  }

  onDraftSupplierNameChange(draftSupplierId: string, value: string): void {
    this.draftSuppliers.update((draftSuppliers) =>
      draftSuppliers.map((draftSupplier) =>
        draftSupplier.id === draftSupplierId
          ? {
              ...draftSupplier,
              name: value,
              error: null,
            }
          : draftSupplier,
      ),
    );
  }

  onDraftSupplierPreferredChange(draftSupplierId: string, preferred: boolean): void {
    this.draftSuppliers.update((draftSuppliers) =>
      draftSuppliers.map((draftSupplier) => ({
        ...draftSupplier,
        preferred:
          draftSupplier.id === draftSupplierId
            ? preferred
            : preferred
              ? false
              : draftSupplier.preferred,
      }))
    );
  }

  onDraftSupplierFileChange(draftSupplierId: string, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0] ?? null;
    const draftSupplier = this.draftSuppliers().find(
      (currentDraftSupplier) => currentDraftSupplier.id === draftSupplierId,
    );

    if (!file || !draftSupplier) {
      inputElement.value = '';
      return;
    }

    const supplierName = draftSupplier.name.trim();

    if (!supplierName) {
      this.draftSuppliers.update((draftSuppliers) =>
        draftSuppliers.map((currentDraftSupplier) =>
          currentDraftSupplier.id === draftSupplierId
            ? {
                ...currentDraftSupplier,
                error: 'Inserisci prima il nome del fornitore.',
              }
            : currentDraftSupplier,
        ),
      );
      inputElement.value = '';
      return;
    }

    this.draftSuppliers.update((draftSuppliers) =>
      draftSuppliers.map((currentDraftSupplier) =>
        currentDraftSupplier.id === draftSupplierId
          ? {
              ...currentDraftSupplier,
              error: null,
            }
          : currentDraftSupplier,
      ),
    );
    this.supplierDraftFileSelected.emit({
      draftId: draftSupplierId,
      name: supplierName,
      file,
      preferred: draftSupplier.preferred,
    });
    inputElement.value = '';
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

  previewSupplierMapping(supplierId: string): void {
    const previewState = this.supplierPreviewState()[supplierId];
    const mapping = this.supplierDraftMapping(supplierId);

    if (!previewState?.file || !mapping) {
      return;
    }

    this.supplierMappingPreviewRequested.emit({
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
    const previewState = this.supplierPreviewState()[supplierId];

    return !!(
      this.hasValidSupplierMapping(supplierId) &&
      previewState?.preview &&
      previewState.preview.importedProductsCount > 0 &&
      this.isSupplierMappingVerified(supplierId)
    );
  }

  isSupplierMappingVerified(supplierId: string): boolean {
    const previewState = this.supplierPreviewState()[supplierId];
    const mapping = this.supplierDraftMapping(supplierId);

    return !!(
      mapping &&
      previewState?.mapping &&
      this.areSupplierMappingsEqual(mapping, previewState.mapping)
    );
  }

  hasValidSupplierMapping(supplierId: string): boolean {
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

  draftSupplierInputId(draftSupplierId: string): string {
    return `draft-supplier-upload-${draftSupplierId}`;
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

  draftSupplierCardState(draftSupplierId: string): UploadCardState {
    const pendingDraftState = this.pendingSupplierDraftState()[draftSupplierId];

    if (pendingDraftState) {
      return pendingDraftState;
    }

    return {
      status: 'idle',
      fileName: null,
      message: 'Inserisci il nome e carica il primo listino.',
    };
  }

  isDraftSupplierBusy(draftSupplierId: string): boolean {
    const status = this.draftSupplierCardState(draftSupplierId).status;
    return status === 'uploading' || status === 'processing';
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

  private areSupplierMappingsEqual(
    left: SupplierColumnMapping,
    right: SupplierColumnMapping,
  ): boolean {
    return (
      left.headerRowIndex === right.headerRowIndex &&
      left.eanColumnIndex === right.eanColumnIndex &&
      left.descriptionColumnIndex === right.descriptionColumnIndex &&
      left.packageSizeColumnIndex === right.packageSizeColumnIndex &&
      left.netPriceColumnIndex === right.netPriceColumnIndex &&
      left.grossPriceColumnIndex === right.grossPriceColumnIndex
    );
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

  uploadDropzoneClass(status: UploadCardStatus): string {
    if (status === 'uploading' || status === 'processing') {
      return 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]';
    }

    if (status === 'completed') {
      return 'border-emerald-300 bg-emerald-50';
    }

    if (status === 'failed') {
      return 'border-rose-300 bg-rose-50';
    }

    return 'border-[var(--app-border)] bg-[var(--app-surface)] hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]';
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

  shouldShowStatusBadge(status: UploadCardStatus): boolean {
    return status !== 'idle';
  }

  private latestSupplierUpload(supplierId: string) {
    const uploads = this.order().supplierUploads[supplierId] ?? [];
    return uploads.at(-1);
  }

  private nextDraftSupplierId(): string {
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

