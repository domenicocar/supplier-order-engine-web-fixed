export interface OrderItem {
  ean: string;
  quantity: number | null;
  status: string;
  description?: string;
}

export interface ReviewItem {
  ean: string;
  description?: string;
  quantity: number | null;
  reason?: string;
  possibleReason?: string;
  severity?: string;
}

export interface OrderImportResult {
  importedItems: OrderItem[];
  rejectedItems: ReviewItem[];
  importSuccessRate: number | null;
  firstImportedItems: OrderItem[];
}

export interface ExportedFile {
  name: string;
  supplierId?: string;
  status?: string;
  url?: string;
}

export interface OrderExportResult {
  filesExported: ExportedFile[];
  reviewItems: ReviewItem[];
  canCompleteExport: boolean;
  erroriExport: string[];
}

export interface SupplierUploadResult {
  supplierId: string;
  fileName: string;
  uploadedAt: string;
  message?: string;
  files: ExportedFile[];
}

export interface SessionOrder {
  id: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
  reviewItems: ReviewItem[];
  importResult?: OrderImportResult;
  exportResult?: OrderExportResult;
  supplierUploads: Record<string, SupplierUploadResult[]>;
}

export interface CreateOrderResponse {
  order: SessionOrder;
}

export interface ImportOrderResponse {
  status?: string;
  items: OrderItem[];
  reviewItems: ReviewItem[];
  importResult: OrderImportResult;
}

export interface ExportOrderResponse {
  status?: string;
  reviewItems: ReviewItem[];
  exportResult: OrderExportResult;
}
