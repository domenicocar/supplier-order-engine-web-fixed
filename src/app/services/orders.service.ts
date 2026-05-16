import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  CreateOrderResponse,
  ExportGeneratedFile,
  ExportOrderResponse,
  ExportedFile,
  GetOrderResponse,
  ImportOrderResponse,
  OrderExportResult,
  OrderImportResult,
  OrderItem,
  PdfImportJobStatus,
  PdfImportStatusResponse,
  ReviewItem,
  SessionOrder,
  SupplierComparisonOffer,
  SupplierComparisonResponse,
  SupplierComparisonRow,
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
        order: this.normalizeSessionOrder(payload)
      }))
    );
  }

  getOrderById(orderId: string): Observable<GetOrderResponse> {
    return this.api.get<unknown>(`/orders/${orderId}`).pipe(
      map((payload) => ({
        order: this.normalizeSessionOrder(payload)
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

  getImportPdfStatus(orderId: string): Observable<PdfImportStatusResponse> {
    return this.api.get<unknown>(`/orders/${orderId}/import-pdf/status`).pipe(
      map((payload) => this.normalizeImportPdfStatusResponse(payload))
    );
  }

  getSupplierComparison(orderId: string): Observable<SupplierComparisonResponse> {
    return this.api.get<unknown>(`/orders/${orderId}/supplier-comparison`).pipe(
      map((payload) => this.normalizeSupplierComparisonResponse(payload))
    );
  }

  syncOrderItems(
    orderId: string,
    items: Array<{ ean: string; quantity: number; supplierId: string }>
  ): Observable<{ orderId?: string; status?: string; itemsCount?: number | null }> {
    return this.api
      .post<unknown>(`/orders/${orderId}/items`, { items })
      .pipe(
        map((payload) => {
          const source = this.unwrap(payload);
          return {
            orderId: this.pickString(source, ['orderId', 'id']),
            status: this.pickString(source, ['status']),
            itemsCount: this.pickNumber(source, ['itemsCount', 'items_count'])
          };
        })
      );
  }

  exportOrder(orderId: string): Observable<ExportOrderResponse> {
    return this.api.post<unknown>(`/orders/${orderId}/export`, {}).pipe(
      map((payload) => this.normalizeExportOrderResponse(payload))
    );
  }

  downloadExportedFile(orderId: string, fileName: string): Observable<Blob> {
    return this.api.getBlob(
      `/orders/${orderId}/export/files/${encodeURIComponent(fileName)}`
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
            ),
            products: this.normalizeSupplierUploadProducts(
              this.pickValue(source, [
                'products',
                'items',
                'articles',
                'articoli',
                'rows',
                'priceList',
                'listino',
                'results'
              ])
            )
          };
        })
      );
  }

  private normalizeSessionOrder(payload: unknown): SessionOrder {
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
      createdAt:
        this.pickString(orderSource, ['createdAt', 'created_at']) ?? new Date().toISOString(),
      items: this.normalizeItems(this.pickValue(orderSource, ['items'])),
      reviewItems: this.normalizeReviewItems(this.pickValue(orderSource, ['reviewItems'])),
      importPdfStatus: this.pickPdfImportStatus(
        orderSource,
        ['importPdfStatus', 'import_pdf_status']
      ),
      importPdfItemsCount: this.pickNumber(orderSource, [
        'importPdfItemsCount',
        'import_pdf_items_count'
      ]),
      importPdfError:
        this.pickString(orderSource, ['importPdfError', 'import_pdf_error']) ?? null,
      supplierComparisonRows: this.normalizeSupplierComparisonRows(
        this.pickValue(orderSource, ['supplierComparisonRows', 'supplier_comparison_rows'])
      ),
      supplierUploads: {}
    };
  }

  private normalizeImportOrderResponse(payload: unknown): ImportOrderResponse {
    const source = this.unwrap(payload);
    const orderSource = this.unwrap(this.pickValue(source, ['order']) ?? source);
    const status =
      this.pickString(orderSource, ['status']) ??
      this.pickString(source, ['status']);

    if (status === 'processing') {
      return {
        success: this.pickBoolean(source, ['success']) ?? undefined,
        status,
        items: [],
        reviewItems: []
      };
    }

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
      success: this.pickBoolean(source, ['success']) ?? undefined,
      status,
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
      files: this.normalizeExportGeneratedFiles(this.pickValue(source, ['files'])),
      exportResult
    };
  }

  private normalizeImportPdfStatusResponse(payload: unknown): PdfImportStatusResponse {
    const source = this.unwrap(payload);

    return {
      status: this.pickPdfImportStatus(source, ['status']) ?? 'idle',
      itemsCount: this.pickNumber(source, ['itemsCount', 'items_count']) ?? 0,
      error: this.pickString(source, ['error', 'message']) ?? null
    };
  }

  private normalizeSupplierComparisonResponse(payload: unknown): SupplierComparisonResponse {
    if (Array.isArray(payload)) {
      return {
        rows: this.normalizeSupplierComparisonRows(payload)
      };
    }

    const source = this.unwrap(payload);

    return {
      rows: this.normalizeSupplierComparisonRows(
        this.pickValue(source, ['rows', 'items', 'comparisons', 'supplierComparisonRows']) ?? source
      )
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

  private normalizeExportGeneratedFiles(value: unknown): ExportGeneratedFile[] {
    return this.asArray(value).flatMap((entry, index): ExportGeneratedFile[] => {
      if (!this.isRecord(entry)) {
        return [];
      }

      const fileName =
        this.pickString(entry, ['fileName', 'filename', 'name']) ??
        `file-${index + 1}`;

      return [
        {
          supplierName: this.pickString(entry, ['supplierName', 'supplier_name', 'supplierId']),
          fileName
        }
      ];
    });
  }

  private normalizeSupplierUploadProducts(value: unknown): SupplierUploadResult['products'] {
    return this.asArray(value).flatMap((entry, index) => {
      if (!this.isRecord(entry)) {
        return [];
      }

      const ean = this.pickString(entry, ['ean', 'EAN', 'barcode', 'code']);
      const price = this.pickNumber(entry, [
        'price',
        'prezzo',
        'unitPrice',
        'unit_price',
        'netPrice',
        'net_price',
        'cost'
      ]);

      if (!ean) {
        return [];
      }

      return [
        {
          ean,
          description:
            this.pickString(entry, ['description', 'descrizione', 'productName', 'name']) ??
            `Prodotto ${index + 1}`,
          quantity: this.pickNumber(entry, ['quantity', 'qty', 'orderedQuantity']),
          price
        }
      ];
    });
  }

  private normalizeSupplierComparisonRows(value: unknown): SupplierComparisonRow[] {
    return this.asArray(value).flatMap((entry): SupplierComparisonRow[] => {
      if (!this.isRecord(entry)) {
        return [];
      }

      const ean = this.pickString(entry, ['ean', 'EAN', 'barcode', 'code']);

      if (!ean) {
        return [];
      }

      const availableSuppliers = this.normalizeSupplierComparisonOffers(
        this.pickValue(entry, ['availableSuppliers', 'suppliers', 'offers', 'options'])
      );
      const sortedSuppliers = [...availableSuppliers].sort((left, right) => {
        if (left.price === null && right.price === null) {
          return left.supplierName.localeCompare(right.supplierName);
        }

        if (left.price === null) {
          return 1;
        }

        if (right.price === null) {
          return -1;
        }

        return left.price - right.price;
      });
      const bestOffer =
        this.normalizeSupplierComparisonOffer(
          this.pickValue(entry, ['bestOffer', 'selectedOffer', 'lowestOffer'])
        ) ??
        sortedSuppliers[0] ??
        null;

      return [
        {
          ean,
          description:
            this.pickString(entry, ['description', 'descrizione', 'productName', 'name']) ??
            'Descrizione non disponibile',
          quantity: this.pickNumber(entry, ['quantity', 'qty', 'orderedQuantity']),
          bestOffer,
          availableSuppliers: sortedSuppliers
        }
      ];
    });
  }

  private normalizeSupplierComparisonOffers(value: unknown): SupplierComparisonOffer[] {
    return this.asArray(value).flatMap((entry) => {
      const offer = this.normalizeSupplierComparisonOffer(entry);
      return offer ? [offer] : [];
    });
  }

  private normalizeSupplierComparisonOffer(value: unknown): SupplierComparisonOffer | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const supplierId = this.pickString(value, ['supplierId', 'supplier_id', 'id']);
    const supplierName =
      this.pickString(value, ['supplierName', 'supplier_name', 'name']) ??
      supplierId;

    if (!supplierId || !supplierName) {
      return null;
    }

    return {
      supplierId,
      supplierName,
      price: this.pickNumber(value, [
        'price',
        'prezzo',
        'unitPrice',
        'unit_price',
        'netPrice',
        'net_price',
        'cost'
      ])
    };
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
      const normalizedValue = value.trim().replace(',', '.');
      const parsed = Number(normalizedValue);

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

  private pickPdfImportStatus(
    source: Record<string, unknown>,
    keys: string[]
  ): PdfImportJobStatus | undefined {
    const status = this.pickString(source, keys);

    if (
      status === 'idle' ||
      status === 'processing' ||
      status === 'completed' ||
      status === 'failed'
    ) {
      return status;
    }

    return undefined;
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
