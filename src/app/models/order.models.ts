import { SupplierDefinition } from './supplier.models';

export interface WorksheetColumnOption {
  columnIndex: number;
  columnLetter: string;
  label: string;
}

export interface OrderImportColumnMapping {
  headerRowIndex: number;
  eanColumnIndex: number;
  descriptionColumnIndex: number | null;
  quantityColumnIndex: number;
}

export interface SupplierColumnMapping {
  supplierId: string;
  headerRowIndex: number;
  eanColumnIndex: number;
  descriptionColumnIndex: number;
  packageSizeColumnIndex: number | null;
  netPriceColumnIndex: number;
  grossPriceColumnIndex: number | null;
  availabilityColumnIndex: number | null;
  orderQuantityColumnIndex: number | null;
}

export interface OrderFilePreviewResult {
  columns: WorksheetColumnOption[];
  detectedMapping: OrderImportColumnMapping | null;
  fileType: 'pdf' | 'spreadsheet';
  headerRowIndex: number | null;
  itemsCount: number;
  previewItems: OrderItem[];
  requiresMapping: boolean;
}

export interface SupplierUploadPreview {
  columns: WorksheetColumnOption[];
  detectedMapping: SupplierColumnMapping | null;
  headerRowIndex: number | null;
  importedProductsCount: number;
  previewRow: {
    ean: string;
    description: string;
    packageSize: number;
    netPrice: number;
    grossPrice: number;
  } | null;
  savedMapping: SupplierColumnMapping | null;
}

export interface OrderItem {
  lineId?: string;
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

export interface OrderClosureLine {
  ean: string;
  description?: string;
  quantity: number | null;
  supplierId?: string;
  supplierName?: string;
  unitNetPrice?: number | null;
  unitGrossPrice?: number | null;
  lineTotalNet?: number | null;
  lineTotalGross?: number | null;
}

export interface OrderClosure {
  id: string;
  currency: string | null;
  grandTotalNet: number | null;
  grandTotalGross: number | null;
  productsCount: number | null;
  suppliersCount: number | null;
  totalQuantity: number | null;
  closedAt: string | null;
  lines: OrderClosureLine[];
}

export interface CloseOrderResponse {
  orderId: string;
  status: 'closed';
  cleanupWarnings: string[];
  closure: OrderClosure | null;
}

export interface DeleteOrderResponse {
  orderId: string;
  status: 'deleted';
  cleanupWarnings: string[];
}

export interface SupplierComparisonOffer {
  supplierId: string;
  supplierName: string;
  packageSize: number;
  price: number | null;
  netPrice: number | null;
  grossPrice: number | null;
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
  uploadedAt: string | null;
  message?: string;
  extension?: string | null;
  preview?: SupplierUploadPreview | null;
  storedPath?: string | null;
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
  [x: string]: any;
  id: string;
  status: string;
  createdAt: string;
  estimatedTotal?: number | null;
  productsCount?: number | null;
  suppliersCount?: number | null;
  totalQuantity?: number | null;
  missingItemsCount?: number | null;
  assignedItemsCount?: number | null;
  missingPricesCount?: number | null;
  missingQuantitiesCount?: number | null;
  currency?: string | null;
  totalsCalculatedAt?: string | null;
  closure?: OrderClosure | null;
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

export interface ListOrdersResponse {
  orders: SessionOrder[];
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

export interface ImportOrderFileResponse {
  importedItems: number;
  itemsPreview: OrderItem[];
  status: 'completed';
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
