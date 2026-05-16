import { computed, Injectable, signal } from '@angular/core';

import {
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

  orderById(id: string): SessionOrder | undefined {
    return this.ordersState().find((order) => order.id === id);
  }

  upsertOrder(order: SessionOrder): void {
    this.ordersState.update((orders) => {
      const index = orders.findIndex((current) => current.id === order.id);

      if (index === -1) {
        return [order, ...orders];
      }

      const next = [...orders];
      next[index] = {
        ...orders[index],
        ...order,
        supplierComparisonRows:
          order.supplierComparisonRows ?? orders[index].supplierComparisonRows,
        importResult: order.importResult ?? orders[index].importResult,
        exportResult: order.exportResult ?? orders[index].exportResult,
        supplierUploads: {
          ...orders[index].supplierUploads,
          ...order.supplierUploads
        }
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
}
