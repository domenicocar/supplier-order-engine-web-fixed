export interface SupplierDefinition {
  active?: boolean;
  code?: string | null;
  id: string;
  latestUpload?: {
    extension?: string | null;
    originalFileName: string;
    storedPath?: string | null;
    uploadedAt: string | null;
  } | null;
  name: string;
  slug?: string;
}

export interface SupplierStoredFile {
  supplierId: string;
  originalFileName: string;
  uploadedAt: string | null;
}

export interface SupplierCreatePayload {
  name: string;
}
