import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TableModule } from 'primeng/table';

import { OrderItem, ReviewItem } from '../../../models/order.models';
import { StatusTagComponent } from '../../../shared/components/status-tag.component';
import { reviewReason, severityTone } from './order-detail-view.utils';

@Component({
  selector: 'app-order-products-tab',
  standalone: true,
  imports: [StatusTagComponent, TableModule],
  template: `
    <div class="flex flex-col gap-6">
      <section class="surface-panel p-8">
        <p class="section-eyebrow">1. Lista prodotti ordine</p>
        <h2 class="section-title">Tabella prodotti</h2>
        <p class="section-copy">
          Vista sintetica degli item dell'ordine gia associati all'ordine corrente.
        </p>

        <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <p-table
            [value]="items()"
            [paginator]="items().length > pageSize"
            [rows]="pageSize"
            [rowsPerPageOptions]="[10, 25, 50]"
            responsiveLayout="scroll"
          >
            <ng-template pTemplate="header">
              <tr>
                <th>EAN</th>
                <th>Descrizione</th>
                <th>Quantita</th>
                <th>Stato</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-item>
              <tr>
                <td>{{ item.ean }}</td>
                <td>{{ item.description || '-' }}</td>
                <td>{{ item.quantity ?? '-' }}</td>
                <td><app-status-tag [label]="item.status" /></td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="4" class="px-4 py-5 text-sm text-slate-500">
                  Nessun prodotto presente. Importa un PDF per popolare la tabella.
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      </section>

      @if (reviewItems().length > 0) {
        <section class="surface-panel p-8">
          <p class="section-eyebrow">2. Review Items</p>
          <h2 class="section-title">Elementi da rivedere</h2>
          <p class="section-copy">
            La sezione appare solo se il backend segnala
            <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">reviewItems.length &gt; 0</code>.
          </p>

          <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <p-table [value]="reviewItems()" responsiveLayout="scroll">
              <ng-template pTemplate="header">
                <tr>
                  <th>EAN</th>
                  <th>Descrizione</th>
                  <th>Quantita</th>
                  <th>Reason / possibleReason</th>
                  <th>Severity</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-item>
                <tr>
                  <td>{{ item.ean }}</td>
                  <td>{{ item.description || '-' }}</td>
                  <td>{{ item.quantity ?? '-' }}</td>
                  <td>{{ reviewReason(item) }}</td>
                  <td>
                    <app-status-tag
                      [label]="item.severity || 'warning'"
                      [tone]="severityTone(item.severity)"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>
        </section>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderProductsTabComponent {
  readonly items = input<OrderItem[]>([]);
  readonly reviewItems = input<ReviewItem[]>([]);

  readonly pageSize = 10;
  readonly reviewReason = reviewReason;
  readonly severityTone = severityTone;
}
