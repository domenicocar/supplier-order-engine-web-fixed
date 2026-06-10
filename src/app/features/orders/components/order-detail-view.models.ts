import {
  OrderFilePreviewResult,
  OrderImportColumnMapping,
  SupplierColumnMapping,
  SupplierComparisonOffer,
  SupplierUploadPreview
} from '../../../models/order.models';

export interface SupplierComparisonSelection {
  selectedSupplierId: string;
  selectedSupplierName: string;
  selectedPrice: number | null;
  selectedPackageSize: number;
}

export interface SupplierComparisonTableRow extends SupplierComparisonSelection {
  lineId: string;
  lineType: 'order' | 'catalog';
  ean: string;
  description: string;
  quantity: number | null;
  bestOffer: SupplierComparisonOffer | null;
  availableSuppliers: SupplierComparisonOffer[];
}

export interface OrderExportSummaryRow {
  lineId: string;
  ean: string;
  description: string;
  quantity: number | null;
  packageSize: number;
  totalPieces: number | null;
  supplierId: string;
  supplierName: string;
  unitPrice: number | null;
  packPrice: number | null;
  lineTotal: number | null;
  foundInSuppliers: boolean;
  availableSuppliersCount: number;
  selectedBecausePreferredTie: boolean;
  missingReason?: string;
}

export interface SupplierExportSummary {
  supplierId: string;
  supplierName: string;
  lineCount: number;
  totalQuantity: number;
  subtotal: number | null;
  missingPricesCount: number;
  missingQuantitiesCount: number;
  items: OrderExportSummaryRow[];
}

export interface OrderExportOverview {
  estimatedTotal: number | null;
  productsCount: number;
  suppliersCount: number;
  totalQuantity: number;
  missingItemsCount: number;
  assignedItemsCount: number;
  missingPricesCount: number;
  missingQuantitiesCount: number;
}

export type UploadCardStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

export interface UploadCardState {
  status: UploadCardStatus;
  fileName: string | null;
  message: string | null;
  updatedAt?: string | null;
}

export interface OrderImportPreviewState {
  file: File | null;
  preview: OrderFilePreviewResult | null;
  mapping: OrderImportColumnMapping | null;
}

export interface SupplierUploadPreviewState {
  file: File | null;
  preview: SupplierUploadPreview | null;
  mapping: SupplierColumnMapping | null;
  confirming: boolean;
  previewing: boolean;
  error?: string | null;
}
