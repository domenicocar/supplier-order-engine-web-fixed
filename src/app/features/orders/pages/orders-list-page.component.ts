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
          <p class="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
            Session orders
          </p>
          <h1 class="mt-3 font-heading text-3xl font-semibold tracking-tight text-slate-950">
            Ordini creati nella sessione corrente
          </h1>
          <p class="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            La V0 mantiene lo stato lato frontend solo in memoria: crei un ordine,
            lo arricchisci con import/export e navighi nel dettaglio finché la sessione resta aperta.
          </p>
        </div>

        <div class="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button
            pButton
            type="button"
            class="justify-center !rounded-2xl !bg-slate-950 !px-6 !py-3 !text-sm !font-semibold !text-white"
            (click)="createOrder()"
            [disabled]="creating()"
          >
            {{ creating() ? 'Creazione in corso...' : 'Nuovo Ordine' }}
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {{ error() }}
        </div>
      }

      @if (orders().length === 0) {
        <section class="surface-panel flex flex-col items-start gap-4 p-8">
          <p class="font-heading text-2xl font-semibold text-slate-950">
            Nessun ordine creato
          </p>
          <p class="max-w-xl text-sm leading-7 text-slate-600">
            Il primo passo della V0 è aprire una sessione ordine dal backend con
            <code class="rounded bg-slate-900/5 px-1.5 py-0.5 text-xs text-slate-700">POST /orders/create</code>,
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
                  <p class="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    Order ID
                  </p>
                  <p class="mt-2 break-all font-heading text-xl font-semibold text-slate-950">
                    {{ order.id }}
                  </p>
                </div>

                <app-status-tag [label]="order.status" />
              </div>

              <div class="mt-8 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Creato</p>
                  <p class="mt-2 font-medium text-slate-950">
                    {{ order.createdAt | date: 'dd/MM HH:mm' }}
                  </p>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Prodotti</p>
                  <p class="mt-2 font-medium text-slate-950">{{ order.items.length }}</p>
                </div>
              </div>

              <div class="mt-6 flex items-center justify-between text-sm font-medium text-slate-500">
                <span>Apri dettaglio</span>
                <span class="transition group-hover:translate-x-1">→</span>
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
  readonly error = signal<string | null>(null);

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

  private toMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
