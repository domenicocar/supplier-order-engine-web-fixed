import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  CreateOrderResponse,
  ExportGeneratedFile,
  ExportOrderResponse,
  ExportedFile,
  GetOrderResponse,
  ImportOrderFileResponse,
  OrderFilePreviewResult,
  OrderImportColumnMapping,
  ImportOrderResponse,
  OrderExportResult,
  OrderImportResult,
  OrderItem,
  PdfImportJobStatus,
  PdfImportStatusResponse,
  ReviewItem,
  SupplierUploadPreview,
  SupplierColumnMapping,
  SessionOrder,
  SupplierComparisonOffer,
  SupplierComparisonResponse,
  SupplierComparisonRow,
  SupplierUploadResult
} from '../models/order.models';
import { SupplierDefinition } from '../models/supplier.models';
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

  listOrders(): Observable<SessionOrder[]> {
    return this.api.get<unknown>('/orders').pipe(
      map((payload) => {
        const source = this.unwrap(payload);
        const items =
          Array.isArray(payload) ? payload : this.pickValue(source, ['data', 'orders', 'items']);

        return this.asArray(items).map((entry) => this.normalizeSessionOrder(entry));
      })
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

  previewOrderFile(orderId: string, file: File): Observable<OrderFilePreviewResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api
      .postFormData<unknown>(`/orders/${orderId}/import-file/preview`, formData)
      .pipe(map((payload) => this.normalizeOrderFilePreview(payload)));
  }

  importOrderFile(
    orderId: string,
    file: File,
    mapping?: OrderImportColumnMapping | null
  ): Observable<ImportOrderFileResponse> {
    const formData = new FormData();
    formData.append('file', file);

    if (mapping) {
      formData.append('mapping', JSON.stringify(mapping));
    }

    return this.api
      .postFormData<unknown>(`/orders/${orderId}/import-file`, formData)
      .pipe(map((payload) => this.normalizeImportOrderFileResponse(payload)));
  }

  getSupplierComparison(orderId: string): Observable<SupplierComparisonResponse> {
    return this.api.get<unknown>(`/orders/${orderId}/supplier-comparison`).pipe(
      map((payload) => this.normalizeSupplierComparisonResponse(payload))
    );
  }

  createOrderSupplier(
    orderId: string,
    payload: SupplierDefinition | { name: string; code?: string | null; active?: boolean }
  ): Observable<SupplierDefinition> {
    return this.api.post<unknown>(`/orders/${orderId}/suppliers`, payload).pipe(
      map((response) => {
        const supplier = this.normalizeSupplierDefinition(response);
        return supplier ?? {
          id: payload.name,
          name: payload.name,
          code: payload.code ?? null
        };
      })
    );
  }

  syncOrderItems(
    orderId: string,
    items: Array<{ ean: string; quantity: number; supplierId?: string }>
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

  uploadSupplierFile(
    orderId: string,
    supplierId: string,
    file: File,
    options?: {
      mapping?: SupplierColumnMapping | null;
      persistMapping?: boolean;
    }
  ): Observable<SupplierUploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    if (options?.mapping) {
      formData.append('mapping', JSON.stringify(options.mapping));
    }

    if (typeof options?.persistMapping === 'boolean') {
      formData.append('persistMapping', String(options.persistMapping));
    }

    return this.api
      .postFormData<unknown>(`/orders/${orderId}/suppliers/${supplierId}/file`, formData)
      .pipe(
        map((payload) => {
          const source = this.unwrap(payload);
          const preview = this.normalizeSupplierUploadPreview(
            this.pickValue(source, ['preview'])
          );
          const status = this.pickString(source, ['status']);
          const mappingSaved = !!preview?.savedMapping;
          const requiresConfirmation = !!preview && !mappingSaved;

          return {
            supplierId,
            fileName:
              this.pickString(source, ['originalFileName', 'fileName', 'filename']) ?? file.name,
            uploadedAt: new Date().toISOString(),
            extension: this.pickString(source, ['extension']) ?? null,
            storedPath: this.pickString(source, ['storedPath', 'stored_path']) ?? null,
            message:
              requiresConfirmation
                ? 'File caricato. Conferma le colonne per salvare il mapping.'
                : mappingSaved || status === 'uploaded'
                  ? 'Upload completato'
                  : this.pickString(source, ['message', 'status', 'result']) ?? 'Upload completato',
            preview,
            files: [],
            products: []
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
    const importedItemDetails = this.normalizeItems(
      this.pickValue(orderSource, ['importedItemDetails', 'imported_item_details'])
    );

    return {
      id,
      status,
      createdAt:
        this.pickString(orderSource, ['createdAt', 'created_at']) ??
        this.pickString(source, ['createdAt', 'created_at']) ??
        '',
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
      suppliers: this.normalizeSuppliers(
        this.pickValue(orderSource, ['suppliers', 'supplierList', 'vendors', 'providers', 'fornitori']) ??
          this.pickValue(source, ['suppliers', 'supplierList', 'vendors', 'providers', 'fornitori'])
      ),
      supplierComparisonRows: this.normalizeSupplierComparisonRows(
        this.pickValue(orderSource, ['supplierComparisonRows', 'supplier_comparison_rows'])
      ),
      importResult:
      importedItemDetails.length > 0
          ? {
              importedItems: importedItemDetails,
              rejectedItems: [],
              importSuccessRate: null,
              firstImportedItems: importedItemDetails.slice(0, 5)
            }
          : undefined,
      supplierUploads: this.normalizeSupplierUploadsFromSuppliers(
        this.normalizeSuppliers(
          this.pickValue(orderSource, [
            'suppliers',
            'supplierList',
            'vendors',
            'providers',
            'fornitori'
          ]) ??
            this.pickValue(source, ['suppliers', 'supplierList', 'vendors', 'providers', 'fornitori'])
        )
      )
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

  private normalizeOrderFilePreview(payload: unknown): OrderFilePreviewResult {
    const source = this.unwrap(payload);

    return {
      columns: this.normalizeWorksheetColumns(this.pickValue(source, ['columns'])),
      detectedMapping: this.normalizeOrderImportColumnMapping(
        this.pickValue(source, ['detectedMapping', 'detected_mapping'])
      ),
      fileType:
        this.pickString(source, ['fileType', 'file_type']) === 'pdf'
          ? 'pdf'
          : 'spreadsheet',
      headerRowIndex: this.pickNumber(source, ['headerRowIndex', 'header_row_index']),
      itemsCount: this.pickNumber(source, ['itemsCount', 'items_count']) ?? 0,
      previewItems: this.normalizeItems(this.pickValue(source, ['previewItems', 'preview_items'])),
      requiresMapping: this.pickBoolean(source, ['requiresMapping', 'requires_mapping']) ?? true
    };
  }

  private normalizeImportOrderFileResponse(payload: unknown): ImportOrderFileResponse {
    const source = this.unwrap(payload);

    return {
      importedItems: this.pickNumber(source, ['importedItems', 'imported_items']) ?? 0,
      itemsPreview: this.normalizeItems(
        this.pickValue(source, ['itemsPreview', 'items_preview', 'previewItems'])
      ),
      status: 'completed'
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
          status: this.pickString(entry, ['status', 'itemStatus']) ?? 'PENDING',
          supplierId: this.pickString(entry, ['supplierId', 'supplier_id'])
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

  private normalizeSupplierUploadPreview(value: unknown): SupplierUploadResult['preview'] {
    if (!this.isRecord(value)) {
      return null;
    }

    return {
      columns: this.normalizeWorksheetColumns(this.pickValue(value, ['columns'])),
      detectedMapping: this.normalizeSupplierColumnMapping(
        this.pickValue(value, ['detectedMapping', 'detected_mapping'])
      ),
      headerRowIndex: this.pickNumber(value, ['headerRowIndex', 'header_row_index']),
      importedProductsCount:
        this.pickNumber(value, ['importedProductsCount', 'imported_products_count']) ?? 0,
      previewRow: this.normalizeSupplierPreviewRow(this.pickValue(value, ['previewRow', 'preview_row'])),
      savedMapping: this.normalizeSupplierColumnMapping(
        this.pickValue(value, ['savedMapping', 'saved_mapping'])
      )
    };
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
        this.normalizeSupplierComparisonOffer(this.pickValue(entry, ['bestOffer', 'lowestOffer'])) ??
        sortedSuppliers[0] ??
        null;
      const selectedOffer =
        this.normalizeSupplierComparisonOffer(this.pickValue(entry, ['selectedOffer'])) ??
        bestOffer;

      return [
        {
          ean,
          description:
            this.pickString(entry, ['description', 'descrizione', 'productName', 'name']) ??
            'Descrizione non disponibile',
          quantity: this.pickNumber(entry, ['quantity', 'qty', 'orderedQuantity']),
          bestOffer,
          selectedOffer,
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
      packageSize:
        this.pickNumber(value, ['packageSize', 'package_size', 'packSize', 'cf', 'conf']) ?? 1,
      netPrice: this.pickNumber(value, ['netPrice', 'net_price']),
      grossPrice: this.pickNumber(value, ['grossPrice', 'gross_price']),
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

  private normalizeSuppliers(value: unknown): SupplierDefinition[] {
    const singleSupplier = this.normalizeSupplierDefinition(value);

    if (singleSupplier) {
      return [singleSupplier];
    }

    const seen = new Set<string>();

    return this.asArray(value).flatMap((entry): SupplierDefinition[] => {
      const supplier = this.normalizeSupplierDefinition(entry);

      if (!supplier || seen.has(supplier.id)) {
        return [];
      }

      seen.add(supplier.id);

      return [supplier];
    });
  }

  private normalizeSupplierDefinition(value: unknown): SupplierDefinition | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const source = this.unwrap(value);
    const candidate =
      this.isRecord(this.pickValue(source, ['supplier', 'item', 'data']))
        ? this.unwrap(this.pickValue(source, ['supplier', 'item', 'data']))
        : source;
    const id = this.pickString(candidate, ['id', 'supplierId', 'supplier_id', 'code']);
    const name =
      this.pickString(candidate, ['name', 'supplierName', 'supplier_name', 'description']) ?? id;

    if (!id || !name) {
      return null;
    }

    return {
      id,
      name,
      code: this.pickString(candidate, ['code']),
      active: this.pickBoolean(candidate, ['active']) ?? true,
      latestUpload: this.normalizeSupplierLatestUpload(
        this.pickValue(candidate, ['latestUpload', 'latest_upload', 'upload'])
      ),
      slug: this.pickString(candidate, ['slug'])
    };
  }

  private normalizeSupplierLatestUpload(value: unknown): SupplierDefinition['latestUpload'] {
    if (!this.isRecord(value)) {
      return null;
    }

    const originalFileName = this.pickString(value, [
      'originalFileName',
      'original_file_name',
      'fileName',
      'filename',
      'name'
    ]);

    if (!originalFileName) {
      return null;
    }

    return {
      extension: this.pickString(value, ['extension']) ?? null,
      originalFileName,
      storedPath: this.pickString(value, ['storedPath', 'stored_path']) ?? null,
      uploadedAt:
        this.pickString(value, ['uploadedAt', 'uploaded_at', 'createdAt', 'created_at']) ?? null
    };
  }

  private normalizeSupplierUploadsFromSuppliers(
    suppliers: SupplierDefinition[]
  ): Record<string, SupplierUploadResult[]> {
    return suppliers.reduce<Record<string, SupplierUploadResult[]>>((accumulator, supplier) => {
      if (!supplier.latestUpload) {
        return accumulator;
      }

      accumulator[supplier.id] = [
        {
          supplierId: supplier.id,
          fileName: supplier.latestUpload.originalFileName,
          uploadedAt: supplier.latestUpload.uploadedAt,
          extension: supplier.latestUpload.extension ?? null,
          storedPath: supplier.latestUpload.storedPath ?? null,
          message: 'Ultimo listino salvato',
          preview: null,
          files: [],
          products: []
        }
      ];

      return accumulator;
    }, {});
  }

  private normalizeWorksheetColumns(value: unknown): OrderFilePreviewResult['columns'] {
    return this.asArray(value).flatMap((entry) => {
      if (!this.isRecord(entry)) {
        return [];
      }

      const columnIndex = this.pickNumber(entry, ['columnIndex', 'column_index']);
      const columnLetter = this.pickString(entry, ['columnLetter', 'column_letter']);

      if (columnIndex === null || !columnLetter) {
        return [];
      }

      return [
        {
          columnIndex,
          columnLetter,
          label: this.pickString(entry, ['label']) ?? ''
        }
      ];
    });
  }

  private normalizeOrderImportColumnMapping(value: unknown): OrderImportColumnMapping | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const headerRowIndex = this.pickNumber(value, ['headerRowIndex', 'header_row_index']);
    const eanColumnIndex = this.pickNumber(value, ['eanColumnIndex', 'ean_column_index']);
    const quantityColumnIndex = this.pickNumber(value, [
      'quantityColumnIndex',
      'quantity_column_index'
    ]);

    if (headerRowIndex === null || eanColumnIndex === null || quantityColumnIndex === null) {
      return null;
    }

    return {
      headerRowIndex,
      eanColumnIndex,
      descriptionColumnIndex: this.pickNumber(value, [
        'descriptionColumnIndex',
        'description_column_index'
      ]),
      quantityColumnIndex
    };
  }

  private normalizeSupplierColumnMapping(value: unknown): SupplierColumnMapping | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const headerRowIndex = this.pickNumber(value, ['headerRowIndex', 'header_row_index']);
    const eanColumnIndex = this.pickNumber(value, ['eanColumnIndex', 'ean_column_index']);
    const descriptionColumnIndex = this.pickNumber(value, [
      'descriptionColumnIndex',
      'description_column_index'
    ]);
    const netPriceColumnIndex = this.pickNumber(value, [
      'netPriceColumnIndex',
      'net_price_column_index'
    ]);

    if (
      headerRowIndex === null ||
      eanColumnIndex === null ||
      descriptionColumnIndex === null ||
      netPriceColumnIndex === null
    ) {
      return null;
    }

    return {
      supplierId:
        this.pickString(value, ['supplierId', 'supplier_id']) ??
        '',
      headerRowIndex,
      eanColumnIndex,
      descriptionColumnIndex,
      packageSizeColumnIndex: this.pickNumber(value, [
        'packageSizeColumnIndex',
        'package_size_column_index'
      ]),
      netPriceColumnIndex,
      grossPriceColumnIndex: this.pickNumber(value, [
        'grossPriceColumnIndex',
        'gross_price_column_index'
      ]),
      availabilityColumnIndex: this.pickNumber(value, [
        'availabilityColumnIndex',
        'availability_column_index'
      ]),
      orderQuantityColumnIndex: this.pickNumber(value, [
        'orderQuantityColumnIndex',
        'order_quantity_column_index'
      ])
    };
  }

  private normalizeSupplierPreviewRow(
    value: unknown
  ): SupplierUploadPreview['previewRow'] {
    if (!this.isRecord(value)) {
      return null;
    }

    const ean = this.pickString(value, ['ean']);
    const description = this.pickString(value, ['description', 'descrizione']);
    const packageSize = this.pickNumber(value, ['packageSize', 'package_size']);
    const netPrice = this.pickNumber(value, ['netPrice', 'net_price']);
    const grossPrice = this.pickNumber(value, ['grossPrice', 'gross_price']);

    if (
      !ean ||
      !description ||
      packageSize === null ||
      netPrice === null ||
      grossPrice === null
    ) {
      return null;
    }

    return {
      ean,
      description,
      packageSize,
      netPrice,
      grossPrice
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
