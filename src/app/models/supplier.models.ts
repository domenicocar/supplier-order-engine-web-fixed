import type { SupplierColumnMapping, SupplierUploadPreview } from './order.models';

export interface SupplierDefinition {
  active?: boolean;
  code?: string | null;
  id: string;
  latestUpload?: {
    columnMapping?: SupplierColumnMapping | null;
    extension?: string | null;
    originalFileName: string;
    preview?: SupplierUploadPreview | null;
    storedPath?: string | null;
    uploadedAt: string | null;
  } | null;
  name: string;
  preferred?: boolean;
  slug?: string;
}

export interface SupplierStoredFile {
  supplierId: string;
  originalFileName: string;
  uploadedAt: string | null;
}

export interface SupplierCreatePayload {
  name: string;
  preferred?: boolean;
}
