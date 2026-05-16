import { SupplierComparisonOffer } from '../../../models/order.models';

export interface SupplierComparisonSelection {
  selectedSupplierId: string;
  selectedSupplierName: string;
  selectedPrice: number | null;
}

export interface SupplierComparisonTableRow extends SupplierComparisonSelection {
  ean: string;
  description: string;
  quantity: number | null;
  bestOffer: SupplierComparisonOffer | null;
  availableSuppliers: SupplierComparisonOffer[];
}

export interface OrderExportSummaryRow {
  ean: string;
  description: string;
  quantity: number | null;
  supplierId: string;
  supplierName: string;
  unitPrice: number | null;
  lineTotal: number | null;
  foundInSuppliers: boolean;
  availableSuppliersCount: number;
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
