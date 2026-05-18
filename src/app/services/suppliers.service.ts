import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { SupplierDefinition, SupplierStoredFile } from '../models/supplier.models';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class SuppliersService {
  private readonly api = inject(ApiService);

  getSuppliers(): Observable<SupplierDefinition[]> {
    return this.api.get<unknown>('/suppliers').pipe(
      map((payload) => this.normalizeSuppliers(payload))
    );
  }

  getSupplierFiles(): Observable<SupplierStoredFile[]> {
    return this.api.get<unknown>('/suppliers/files').pipe(
      map((payload) => this.normalizeSupplierFiles(payload))
    );
  }

  private normalizeSuppliers(payload: unknown): SupplierDefinition[] {
    const source = this.unwrap(payload);
    const items =
      (Array.isArray(payload) && payload) ||
      this.pickValue(source, ['suppliers', 'items', 'data', 'results']) ||
      payload;

    const seen = new Set<string>();

    return this.asArray(items).flatMap((entry): SupplierDefinition[] => {
      if (!this.isRecord(entry)) {
        return [];
      }

      const id = this.pickString(entry, ['id', 'supplierId', 'supplier_id', 'code']);
      const name =
        this.pickString(entry, ['name', 'supplierName', 'supplier_name', 'description']) ?? id;

      if (!id || !name || seen.has(id)) {
        return [];
      }

      seen.add(id);

      return [{ id, name }];
    });
  }

  private normalizeSupplierFiles(payload: unknown): SupplierStoredFile[] {
    const source = this.unwrap(payload);
    const items =
      (Array.isArray(payload) && payload) ||
      this.pickValue(source, ['files', 'items', 'data', 'results']) ||
      payload;

    return this.asArray(items).flatMap((entry): SupplierStoredFile[] => {
      if (!this.isRecord(entry)) {
        return [];
      }

      const supplierId = this.pickString(entry, ['supplierId', 'supplier_id', 'id', 'code']);
      const originalFileName = this.pickString(entry, [
        'originalFileName',
        'original_file_name',
        'fileName',
        'filename',
        'name'
      ]);

      if (!supplierId || !originalFileName) {
        return [];
      }

      return [
        {
          supplierId,
          originalFileName,
          uploadedAt:
            this.pickString(entry, ['uploadedAt', 'uploaded_at', 'createdAt', 'created_at']) ??
            null
        }
      ];
    });
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

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
