import { SupplierDefinition } from './supplier.models';

export interface OrderItem {
  ean: string;
  quantity: number | null;
  status: string;
  description?: string;
  supplierId?: string;
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

export interface ExportGeneratedFile {
  supplierName?: string;
  fileName: string;
}

export interface OrderExportResult {
  filesExported: ExportedFile[];
  reviewItems: ReviewItem[];
  canCompleteExport: boolean;
  erroriExport: string[];
}

export interface SupplierComparisonOffer {
  supplierId: string;
  supplierName: string;
  price: number | null;
}

export interface SupplierComparisonRow {
  ean: string;
  description: string;
  quantity: number | null;
  bestOffer: SupplierComparisonOffer | null;
  selectedOffer: SupplierComparisonOffer | null;
  availableSuppliers: SupplierComparisonOffer[];
}

export interface SupplierUploadResult {
  supplierId: string;
  fileName: string;
  uploadedAt: string;
  message?: string;
  files: ExportedFile[];
  products: SupplierUploadProduct[];
}

export interface SupplierUploadProduct {
  ean: string;
  description?: string;
  quantity: number | null;
  price: number | null;
}

export interface SessionOrder {
  id: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
  reviewItems: ReviewItem[];
  importPdfStatus?: PdfImportJobStatus;
  importPdfItemsCount?: number | null;
  importPdfError?: string | null;
  suppliers?: SupplierDefinition[];
  supplierComparisonRows?: SupplierComparisonRow[];
  importResult?: OrderImportResult;
  exportResult?: OrderExportResult;
  supplierUploads: Record<string, SupplierUploadResult[]>;
}

export interface CreateOrderResponse {
  order: SessionOrder;
}

export interface GetOrderResponse {
  order: SessionOrder;
}

export interface SupplierComparisonResponse {
  rows: SupplierComparisonRow[];
}

export interface ImportOrderResponse {
  success?: boolean;
  status?: string;
  items: OrderItem[];
  reviewItems: ReviewItem[];
  importResult?: OrderImportResult;
}

export interface ExportOrderResponse {
  status?: string;
  reviewItems: ReviewItem[];
  files?: ExportGeneratedFile[];
  exportResult: OrderExportResult;
}

export type PdfImportJobStatus = 'idle' | 'processing' | 'completed' | 'failed';

export interface PdfImportStatusResponse {
  status: PdfImportJobStatus;
  itemsCount: number;
  error: string | null;
}
