export interface SupplierDefinition {
  id: string;
  name: string;
}

export interface SupplierStoredFile {
  supplierId: string;
  originalFileName: string;
  uploadedAt: string | null;
}
