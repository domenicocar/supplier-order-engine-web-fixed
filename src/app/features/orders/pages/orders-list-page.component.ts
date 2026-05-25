import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';

import { OrdersSessionStore } from '../../../services/orders-session.store';
import { OrdersService } from '../../../services/orders.service';
import { StatusTagComponent } from '../../../shared/components/status-tag.component';

@Component({
  selector: 'app-orders-list-page',
  standalone: true,
  imports: [ButtonModule, RouterLink, DatePipe, StatusTagComponent],
  template: `
    <section class="flex flex-col gap-8">
      <div class="surface-panel flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between">
        <div class="max-w-2xl">
          <p class="text-sm font-medium uppercase tracking-[0.2em] text-[var(--brand-secondary)]">
            API orders
          </p>
          <h1 class="mt-3 font-heading text-3xl font-semibold tracking-tight text-[var(--app-text)]">
            Ordini del tenant corrente
          </h1>
          <p class="mt-3 text-sm leading-7 text-[var(--app-text-muted)] sm:text-base">
            Questa vista legge gli ordini dal backend ufficiale autenticato: puoi creare un draft,
            riaprirlo in seguito e continuare il flusso di import, confronto ed export.
          </p>
        </div>

        <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button
            pButton
            type="button"
            class="btn-primary justify-center !rounded-2xl !px-6 !py-3 !text-sm !font-semibold"
            (click)="createOrder()"
            [disabled]="creating()"
          >
            {{ creating() ? 'Creazione in corso...' : 'Nuovo Ordine' }}
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="app-alert-error">
          {{ error() }}
        </div>
      }

      @if (loading()) {
        <section class="surface-panel flex flex-col items-start gap-4 p-8">
          <p class="font-heading text-2xl font-semibold text-[var(--app-text)]">
            Caricamento ordini...
          </p>
          <p class="max-w-xl text-sm leading-7 text-[var(--app-text-muted)]">
            Sto leggendo gli ordini disponibili tramite
            <code class="app-code">GET /orders</code>.
          </p>
        </section>
      } @else if (orders().length === 0) {
        <section class="surface-panel flex flex-col items-start gap-4 p-8">
          <p class="font-heading text-2xl font-semibold text-[var(--app-text)]">
            Nessun ordine creato
          </p>
          <p class="max-w-xl text-sm leading-7 text-[var(--app-text-muted)]">
            Il primo passo e aprire un draft ordine dal backend con
            <code class="app-code">POST /orders/create</code>,
            poi potrai importare PDF, caricare file fornitore ed esportare.
          </p>
        </section>
      } @else {
        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (order of orders(); track order.id) {
            <a
              [routerLink]="['/app/orders', order.id]"
              class="surface-panel group block rounded-[28px] p-6 no-underline transition duration-200 hover:-translate-y-1"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-xs font-medium uppercase tracking-[0.2em] text-[var(--brand-secondary)]">
                    Order ID
                  </p>
                  <p class="mt-2 break-all font-heading text-xl font-semibold text-[var(--app-text)]">
                    {{ order.id }}
                  </p>
                </div>

                <app-status-tag [label]="order.status" />
              </div>

              <div class="mt-8 grid grid-cols-2 gap-3 text-sm text-[var(--app-text-muted)]">
                <div class="surface-card px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.18em] text-[var(--brand-secondary)]">Creato</p>
                  <p class="mt-2 font-medium text-[var(--app-text)]">
                    {{ order.createdAt | date: 'dd/MM HH:mm' }}
                  </p>
                </div>
                <div class="surface-card px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.18em] text-[var(--brand-secondary)]">Prodotti</p>
                  <p class="mt-2 font-medium text-[var(--app-text)]">{{ order.items.length }}</p>
                </div>
              </div>

              <div class="mt-6 flex items-center justify-between text-sm font-medium text-[var(--brand-secondary)]">
                <span>Apri dettaglio</span>
                <span class="transition group-hover:translate-x-1">-></span>
              </div>
            </a>
          }
        </section>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersListPageComponent {
  private readonly ordersService = inject(OrdersService);
  private readonly ordersStore = inject(OrdersSessionStore);

  readonly orders = this.ordersStore.orders;
  readonly creating = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.loadOrders();
  }

  async createOrder(): Promise<void> {
    this.creating.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.ordersService.createOrder());
      this.ordersStore.upsertOrder(response.order);
    } catch (error: unknown) {
      this.error.set(this.toMessage(error, 'Creazione ordine non riuscita.'));
    } finally {
      this.creating.set(false);
    }
  }

  private async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const orders = await firstValueFrom(this.ordersService.listOrders());
      this.ordersStore.replaceOrders(orders);
    } catch (error: unknown) {
      this.error.set(this.toMessage(error, 'Caricamento ordini non riuscito.'));
    } finally {
      this.loading.set(false);
    }
  }

  private toMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
