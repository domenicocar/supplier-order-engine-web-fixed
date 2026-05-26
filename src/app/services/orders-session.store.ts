import { computed, Injectable, signal } from '@angular/core';

import {
  OrderItem,
  OrderExportResult,
  OrderImportResult,
  SessionOrder,
  SupplierUploadResult
} from '../models/order.models';

@Injectable({
  providedIn: 'root'
})
export class OrdersSessionStore {
  private readonly ordersState = signal<SessionOrder[]>([]);

  readonly orders = computed(() => this.ordersState());

  replaceOrders(orders: SessionOrder[]): void {
    this.ordersState.set(orders.map((order) => this.cloneOrder(order)));
  }

  orderById(id: string): SessionOrder | undefined {
    return this.ordersState().find((order) => order.id === id);
  }

  upsertOrder(order: SessionOrder): void {
    this.ordersState.update((orders) => {
      const index = orders.findIndex((current) => current.id === order.id);

      if (index === -1) {
        return [this.cloneOrder(order), ...orders];
      }

      const next = [...orders];
      next[index] = {
        ...orders[index],
        ...order,
        createdAt: order.createdAt || orders[index].createdAt,
        suppliers: order.suppliers ?? orders[index].suppliers,
        supplierComparisonRows:
          order.supplierComparisonRows ?? orders[index].supplierComparisonRows,
        importResult: order.importResult ?? orders[index].importResult,
        exportResult: order.exportResult ?? orders[index].exportResult,
        supplierUploads: this.mergeSupplierUploads(
          orders[index].supplierUploads,
          order.supplierUploads
        )
      };

      return next;
    });
  }

  setImportResult(orderId: string, payload: { status?: string; items: SessionOrder['items']; reviewItems: SessionOrder['reviewItems']; importResult: OrderImportResult }): void {
    this.ordersState.update((orders) =>
      orders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: payload.status ?? order.status,
              items: payload.items,
              reviewItems: payload.reviewItems,
              importResult: payload.importResult
            }
          : order
      )
    );
  }

  setExportResult(orderId: string, payload: { status?: string; reviewItems: SessionOrder['reviewItems']; exportResult: OrderExportResult }): void {
    this.ordersState.update((orders) =>
      orders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: payload.status ?? order.status,
              reviewItems: payload.reviewItems,
              exportResult: payload.exportResult
            }
          : order
      )
    );
  }

  setSupplierComparisonRows(orderId: string, rows: NonNullable<SessionOrder['supplierComparisonRows']>): void {
    this.ordersState.update((orders) =>
      orders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              supplierComparisonRows: rows
            }
          : order
      )
    );
  }

  setOrderItems(orderId: string, items: OrderItem[]): void {
    this.ordersState.update((orders) =>
      orders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              items: items.map((item) => ({ ...item }))
            }
          : order
      )
    );
  }

  appendSupplierUpload(orderId: string, upload: SupplierUploadResult): void {
    this.ordersState.update((orders) =>
      orders.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        const currentUploads = order.supplierUploads[upload.supplierId] ?? [];

        return {
          ...order,
          supplierUploads: {
            ...order.supplierUploads,
            [upload.supplierId]: [...currentUploads, upload]
          }
        };
      })
    );
  }

  private cloneOrder(order: SessionOrder): SessionOrder {
    return {
      ...order,
      items: [...order.items],
      reviewItems: [...order.reviewItems],
      suppliers: order.suppliers ? [...order.suppliers] : undefined,
      supplierComparisonRows: order.supplierComparisonRows
        ? [...order.supplierComparisonRows]
        : undefined,
      supplierUploads: { ...order.supplierUploads }
    };
  }

  private mergeSupplierUploads(
    currentUploads: SessionOrder['supplierUploads'],
    incomingUploads: SessionOrder['supplierUploads']
  ): SessionOrder['supplierUploads'] {
    const mergedUploads: SessionOrder['supplierUploads'] = {
      ...currentUploads
    };

    for (const [supplierId, uploads] of Object.entries(incomingUploads)) {
      const existingUploads = currentUploads[supplierId] ?? [];

      mergedUploads[supplierId] = uploads.map((upload, index) => {
        const matchingExistingUpload =
          existingUploads.find((existingUpload) =>
            existingUpload.fileName === upload.fileName &&
            existingUpload.storedPath === upload.storedPath
          ) ??
          existingUploads[index] ??
          existingUploads.at(-1);

        if ((upload.products?.length ?? 0) > 0 || !matchingExistingUpload) {
          return upload;
        }

        return {
          ...upload,
          products: matchingExistingUpload.products,
          files:
            upload.files.length > 0 ? upload.files : matchingExistingUpload.files
        };
      });
    }

    return mergedUploads;
  }
}
