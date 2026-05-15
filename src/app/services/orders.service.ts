import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  CreateOrderResponse,
  ExportOrderResponse,
  ExportedFile,
  ImportOrderResponse,
  OrderExportResult,
  OrderImportResult,
  OrderItem,
  ReviewItem,
  SessionOrder,
  SupplierUploadResult
} from '../models/order.models';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private readonly api = inject(ApiService);

  createOrder(): Observable<CreateOrderResponse> {
    return this.api.post<unknown>('/orders/create', {}).pipe(
      map((payload) => ({
        order: this.normalizeCreatedOrder(payload)
      }))
    );
  }

  importPdf(orderId: string, file: File): Observable<ImportOrderResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api
      .postFormData<unknown>(`/orders/${orderId}/import-pdf`, formData)
      .pipe(map((payload) => this.normalizeImportOrderResponse(payload)));
  }

  exportOrder(orderId: string): Observable<ExportOrderResponse> {
    return this.api.post<unknown>(`/orders/${orderId}/export`, {}).pipe(
      map((payload) => this.normalizeExportOrderResponse(payload))
    );
  }

  uploadSupplierFile(supplierId: string, file: File): Observable<SupplierUploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api
      .postFormData<unknown>(`/suppliers/${supplierId}/files`, formData)
      .pipe(
        map((payload) => {
          const source = this.unwrap(payload);

          return {
            supplierId,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            message: this.pickString(source, ['message', 'status', 'result']) ?? 'Upload completato',
            files: this.normalizeExportedFiles(
              this.pickValue(source, ['files', 'uploadedFiles', 'results'])
            )
          };
        })
      );
  }

  private normalizeCreatedOrder(payload: unknown): SessionOrder {
    const source = this.unwrap(payload);
    const orderSource = this.unwrap(this.pickValue(source, ['order']) ?? source);
    const id = this.pickString(orderSource, ['id', 'orderId']) ?? `session-${Date.now()}`;
    const status =
      this.pickString(orderSource, ['status']) ??
      this.pickString(source, ['status']) ??
      'CREATED';

    return {
      id,
      status,
      createdAt: new Date().toISOString(),
      items: this.normalizeItems(this.pickValue(orderSource, ['items'])),
      reviewItems: this.normalizeReviewItems(this.pickValue(orderSource, ['reviewItems'])),
      supplierUploads: {}
    };
  }

  private normalizeImportOrderResponse(payload: unknown): ImportOrderResponse {
    const source = this.unwrap(payload);
    const orderSource = this.unwrap(this.pickValue(source, ['order']) ?? source);
    const importedItems = this.normalizeItems(
      this.pickValue(source, ['importedItems', 'itemsImported', 'items']) ??
        this.pickValue(orderSource, ['items'])
    );
    const rejectedItems = this.normalizeReviewItems(
      this.pickValue(source, ['rejectedItems', 'rejected', 'errors'])
    );
    const explicitReviewItems = this.normalizeReviewItems(
      this.pickValue(source, ['reviewItems', 'itemsToReview'])
    );
    const reviewItems = explicitReviewItems.length > 0 ? explicitReviewItems : rejectedItems;
    const importResult: OrderImportResult = {
      importedItems,
      rejectedItems,
      importSuccessRate: this.pickNumber(source, ['importSuccessRate', 'successRate']),
      firstImportedItems:
        this.normalizeItems(this.pickValue(source, ['firstImportedItems'])) ||
        importedItems.slice(0, 5)
    };

    return {
      status:
        this.pickString(orderSource, ['status']) ??
        this.pickString(source, ['status']),
      items: importedItems,
      reviewItems,
      importResult: {
        ...importResult,
        firstImportedItems:
          importResult.firstImportedItems.length > 0
            ? importResult.firstImportedItems
            : importedItems.slice(0, 5)
      }
    };
  }

  private normalizeExportOrderResponse(payload: unknown): ExportOrderResponse {
    const source = this.unwrap(payload);
    const orderSource = this.unwrap(this.pickValue(source, ['order']) ?? source);
    const reviewItems = this.normalizeReviewItems(
      this.pickValue(source, ['reviewItems', 'itemsToReview'])
    );
    const exportResult: OrderExportResult = {
      filesExported: this.normalizeExportedFiles(
        this.pickValue(source, ['filesExported', 'exportedFiles', 'files'])
      ),
      reviewItems,
      canCompleteExport:
        this.pickBoolean(source, ['canCompleteExport', 'canExport']) ??
        reviewItems.length === 0,
      erroriExport: this.normalizeStringArray(
        this.pickValue(source, ['erroriExport', 'exportErrors', 'errors'])
      )
    };

    return {
      status:
        this.pickString(orderSource, ['status']) ??
        this.pickString(source, ['status']),
      reviewItems,
      exportResult
    };
  }

  private normalizeItems(value: unknown): OrderItem[] {
    return this.asArray(value).flatMap((entry, index): OrderItem[] => {
      if (!this.isRecord(entry)) {
        return [];
      }

      return [
        {
          ean: this.pickString(entry, ['ean', 'EAN', 'barcode', 'code']) ?? `item-${index + 1}`,
          description:
            this.pickString(entry, ['description', 'descrizione', 'productName', 'name']) ??
            undefined,
          quantity: this.pickNumber(entry, ['quantity', 'qty', 'orderedQuantity']),
          status: this.pickString(entry, ['status', 'itemStatus']) ?? 'PENDING'
        }
      ];
    });
  }

  private normalizeReviewItems(value: unknown): ReviewItem[] {
    return this.asArray(value).flatMap((entry, index): ReviewItem[] => {
      if (!this.isRecord(entry)) {
        return [];
      }

      return [
        {
          ean: this.pickString(entry, ['ean', 'EAN', 'barcode', 'code']) ?? `review-${index + 1}`,
          description:
            this.pickString(entry, ['description', 'descrizione', 'productName', 'name']) ??
            undefined,
          quantity: this.pickNumber(entry, ['quantity', 'qty', 'orderedQuantity']),
          reason: this.pickString(entry, ['reason', 'message', 'error']),
          possibleReason: this.pickString(entry, ['possibleReason', 'hint', 'possible_reason']),
          severity: this.pickString(entry, ['severity', 'level']) ?? 'warning'
        }
      ];
    });
  }

  private normalizeExportedFiles(value: unknown): ExportedFile[] {
    return this.asArray(value).flatMap((entry, index): ExportedFile[] => {
      if (typeof entry === 'string') {
        return [{ name: entry }];
      }

      if (!this.isRecord(entry)) {
        return [];
      }

      return [
        {
          name:
            this.pickString(entry, ['name', 'fileName', 'filename']) ??
            `file-${index + 1}`,
          supplierId: this.pickString(entry, ['supplierId']),
          status: this.pickString(entry, ['status']),
          url: this.pickString(entry, ['url', 'downloadUrl'])
        }
      ];
    });
  }

  private normalizeStringArray(value: unknown): string[] {
    return this.asArray(value)
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }

        if (this.isRecord(entry)) {
          return (
            this.pickString(entry, ['message', 'reason', 'error']) ??
            JSON.stringify(entry)
          );
        }

        return String(entry);
      })
      .filter((entry) => entry.trim().length > 0);
  }

  private unwrap(value: unknown): Record<string, unknown> {
    if (!this.isRecord(value)) {
      return {};
    }

    const data = value['data'];

    if (this.isRecord(data)) {
      return data;
    }

    return value;
  }

  private pickValue(source: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      const candidate = source[key];

      if (candidate !== undefined && candidate !== null) {
        return candidate;
      }
    }

    return undefined;
  }

  private pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
    const value = this.pickValue(source, keys);

    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return undefined;
  }

  private pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
    const value = this.pickValue(source, keys);

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);

      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private pickBoolean(source: Record<string, unknown>, keys: string[]): boolean | null {
    const value = this.pickValue(source, keys);

    if (typeof value === 'boolean') {
      return value;
    }

    return null;
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
