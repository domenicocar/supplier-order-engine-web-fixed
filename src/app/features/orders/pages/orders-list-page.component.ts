import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import { SessionOrder } from '../../../models/order.models';
import { PaymentRequiredAction, PaymentRequiredDialogComponent } from '../../../shared/components/payment-required-dialog.component';
import { AuthStore } from '../../auth/stores/auth.store';
import { OrdersSessionStore } from '../../../services/orders-session.store';
import { OrdersService } from '../../../services/orders.service';

type PeriodView = 'month' | 'year';

@Component({
  selector: 'app-orders-list-page',
  standalone: true,
  imports: [ButtonModule, RouterLink, DialogModule, PaymentRequiredDialogComponent],
  template: `
    <section class="flex flex-col gap-8 pb-24 md:pb-0">
      <section class="surface-panel rounded-[30px] p-6 md:hidden">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-secondary)]">
          Riepilogo ordini
        </p>
        <div class="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-5">
          <div class="min-w-0">
            <p class="font-heading text-3xl font-semibold tracking-tight text-[var(--brand-primary)]">
              {{ totalEstimatedLabel() }}
            </p>
            <p class="mt-1 text-xs text-[var(--app-text-muted)]">
              Totale stimato
            </p>
          </div>
          <div class="border-l border-[var(--app-border)] pl-5 text-left">
            <p class="font-heading text-3xl font-semibold tracking-tight text-[var(--app-text)]">
              {{ ordersCount() }}
            </p>
            <p class="mt-1 text-xs text-[var(--app-text-muted)]">
              {{ draftOrdersLabel() }}
            </p>
          </div>
        </div>
      </section>

      <section class="hidden gap-4 md:grid xl:grid-cols-[1.45fr_1fr_1fr]">
        <article class="surface-panel rounded-[30px] p-7">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-secondary)]">
            Totale ordini
          </p>
          <p class="mt-4 font-heading text-4xl font-semibold tracking-tight text-[var(--brand-primary)] sm:text-5xl">
            {{ totalEstimatedLabel() }}
          </p>
          <p class="mt-3 text-sm text-[var(--app-text-muted)]">
            Somma dei totali stimati nel periodo selezionato.
          </p>
        </article>

        <article class="surface-panel rounded-[30px] p-7">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-secondary)]">
            Ordini creati
          </p>
          <p class="mt-4 font-heading text-4xl font-semibold tracking-tight text-[var(--app-text)]">
            {{ ordersCount() }}
          </p>
          <p class="mt-3 text-sm text-[var(--app-text-muted)]">
            {{ draftOrdersLabel() }}
          </p>
        </article>

        <article
          class="rounded-[30px] border border-[rgba(37,99,235,0.12)] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,245,255,0.95))] p-7 shadow-[0_18px_50px_rgba(37,99,235,0.08)]"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-secondary)]">
            Nuovo ordine
          </p>
          <p class="mt-4 max-w-xs text-sm leading-7 text-[var(--app-text-muted)]">
            Crea un nuovo draft e avvia subito il flusso di import, confronto ed export.
          </p>
          <button
            pButton
            type="button"
            class="btn-primary mt-6 justify-center !rounded-2xl !px-6 !py-3 !text-sm !font-semibold"
            (click)="createOrder()"
            [disabled]="creating()"
          >
            {{ creating() ? 'Creazione in corso...' : 'Nuovo Ordine' }}
          </button>
        </article>
      </section>

      <div
        class="fixed inset-x-0 bottom-0 z-40 flex justify-center bg-[linear-gradient(180deg,rgba(244,245,255,0),rgba(244,245,255,0.96)_35%)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 md:hidden"
      >
        <button
          pButton
          type="button"
          class="btn-primary w-full max-w-xs justify-center !rounded-2xl !px-6 !py-3.5 !text-sm !font-semibold shadow-[0_14px_35px_rgba(37,99,235,0.28)]"
          (click)="createOrder()"
          [disabled]="creating()"
        >
          {{ creating() ? 'Creazione in corso...' : 'Nuovo Ordine' }}
        </button>
      </div>

      @if (error()) {
        <div class="app-alert-error">
          {{ error() }}
        </div>
      }

      @if (loading()) {
        <section class="surface-panel flex flex-col items-start gap-4 rounded-[30px] p-8">
          <p class="font-heading text-2xl font-semibold text-[var(--app-text)]">
            Caricamento ordini...
          </p>
          <p class="max-w-xl text-sm leading-7 text-[var(--app-text-muted)]">
            Sto leggendo gli ordini disponibili tramite
            <code class="app-code">GET /orders</code>.
          </p>
        </section>
      } @else if (orders().length === 0) {
        <section class="surface-panel flex flex-col items-start gap-4 rounded-[30px] p-8">
          <p class="font-heading text-2xl font-semibold text-[var(--app-text)]">
            Nessun ordine creato
          </p>
          <p class="max-w-xl text-sm leading-7 text-[var(--app-text-muted)]">
            Il primo passo e aprire un draft ordine dal backend con
            <code class="app-code">POST /orders/create</code>, poi potrai importare PDF,
            caricare file fornitore ed esportare.
          </p>
        </section>
      } @else if (filteredOrders().length === 0) {
        <section class="surface-panel flex flex-col items-start gap-3 rounded-[30px] p-8">
          <div class="mb-3">
            <div class="inline-flex rounded-2xl bg-[var(--app-surface-muted)] p-1">
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-xs font-semibold transition"
                [class.bg-[var(--brand-primary)]]="periodView() === 'month'"
                [class.text-white]="periodView() === 'month'"
                [class.text-[var(--app-text-muted)]]="periodView() !== 'month'"
                (click)="setPeriodView('month')"
              >
                Mese corrente
              </button>
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-xs font-semibold transition"
                [class.bg-[var(--brand-primary)]]="periodView() === 'year'"
                [class.text-white]="periodView() === 'year'"
                [class.text-[var(--app-text-muted)]]="periodView() !== 'year'"
                (click)="setPeriodView('year')"
              >
                Anno in corso
              </button>
            </div>
            <p class="mt-2 text-xs text-[var(--app-text-muted)]">
              0 ordini &middot; {{ periodReferenceLabel() }}
            </p>
          </div>
          <p class="font-heading text-2xl font-semibold text-[var(--app-text)]">
            Nessun ordine nel periodo selezionato
          </p>
          <p class="text-sm leading-7 text-[var(--app-text-muted)]">
            Nessun ordine disponibile per {{ periodReferenceLabel() }}.
          </p>
        </section>
      } @else {
        <div class="px-1 md:hidden">
          <div class="inline-flex rounded-2xl bg-[var(--app-surface-muted)] p-1">
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-xs font-semibold transition"
              [class.bg-[var(--brand-primary)]]="periodView() === 'month'"
              [class.text-white]="periodView() === 'month'"
              [class.text-[var(--app-text-muted)]]="periodView() !== 'month'"
              (click)="setPeriodView('month')"
            >
              Mese corrente
            </button>
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-xs font-semibold transition"
              [class.bg-[var(--brand-primary)]]="periodView() === 'year'"
              [class.text-white]="periodView() === 'year'"
              [class.text-[var(--app-text-muted)]]="periodView() !== 'year'"
              (click)="setPeriodView('year')"
            >
              Anno in corso
            </button>
          </div>
          <p class="mt-2 text-xs text-[var(--app-text-muted)]">
            {{ filteredOrders().length }} ordini &middot; {{ periodReferenceLabel() }}
          </p>
        </div>

        <section class="grid gap-4 md:hidden">
          @for (order of filteredOrders(); track order.id) {
            <article class="surface-panel overflow-hidden rounded-[26px] p-5">
              <div>
                <span
                  class="mb-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                  [class.bg-[rgba(37,99,235,0.08)]]="!isClosedOrder(order)"
                  [class.text-[var(--brand-primary)]]="!isClosedOrder(order)"
                  [class.bg-[rgba(16,185,129,0.12)]]="isClosedOrder(order)"
                  [class.text-[var(--app-success-text)]]="isClosedOrder(order)"
                >
                  {{ orderStatusLabel(order.status) }}
                </span>
                <div class="flex items-baseline justify-between gap-4">
                  <p class="font-heading text-lg font-semibold leading-tight text-[var(--app-text)]">
                    {{ orderDisplayLabel(order.createdAt) }}
                  </p>
                  <p class="shrink-0 font-heading text-lg font-semibold text-[var(--brand-primary)]">
                    {{ estimatedTotalLabel(order) }}
                  </p>
                </div>
                <p class="mt-1 text-xs leading-5 text-[var(--app-text-muted)]">
                  {{ orderTotalsUpdatedLabel(order) }}
                </p>
              </div>

              <div class="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-y border-[rgba(148,163,184,0.14)] py-5">
                <div>
                  <p class="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
                    Data
                  </p>
                  <p class="text-sm font-semibold text-[var(--app-text)]">
                    {{ orderDateLabel(order.createdAt) }}
                  </p>
                  <p class="text-xs text-[var(--app-text-muted)]">
                    {{ orderTimeLabel(order.createdAt) }}
                  </p>
                </div>

                <div>
                  <p class="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
                    Prodotti
                  </p>
                  <p class="text-sm font-semibold text-[var(--app-text)]">
                    {{ productsLabel(order) }}
                  </p>
                </div>

                <div>
                  <p class="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
                    Fornitori
                  </p>
                  <p class="text-sm font-semibold text-[var(--app-text)]">
                    {{ suppliersLabel(order) }}
                  </p>
                </div>

                <div>
                  <p class="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
                    Mancanti
                  </p>
                  <span
                    class="block whitespace-normal break-words text-xs font-semibold"
                    [class.text-[var(--app-danger-text)]]="missingItemsCount(order) > 0"
                    [class.text-[var(--brand-success)]]="missingItemsCount(order) === 0"
                  >
                    {{ missingItemsLabel(order) }}
                  </span>
                </div>
              </div>

              <div class="mt-5 grid grid-cols-2 gap-3">
                <a
                  pButton
                  [routerLink]="['/app/orders', order.id]"
                  class="btn-primary justify-center !rounded-2xl !px-3 !py-2.5 !text-sm !font-semibold no-underline"
                >
                  Apri dettaglio
                </a>
                <button
                  pButton
                  type="button"
                  class="justify-center !rounded-2xl !border !border-[var(--app-danger-border)] !bg-white !px-3 !py-2.5 !text-sm !font-semibold !text-[var(--app-danger-text)]"
                  [disabled]="deletingOrderIds()[order.id]"
                  (click)="openDeleteDialog(order)"
                >
                  {{ deletingOrderIds()[order.id] ? 'Eliminazione...' : 'Elimina' }}
                </button>
              </div>
            </article>
          }
        </section>

        <section class="surface-panel hidden overflow-hidden rounded-[30px] p-3 md:block">
          <div class="px-5 pb-3 pt-2">
            <div class="inline-flex rounded-2xl bg-[var(--app-surface-muted)] p-1">
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-xs font-semibold transition"
                [class.bg-[var(--brand-primary)]]="periodView() === 'month'"
                [class.text-white]="periodView() === 'month'"
                [class.text-[var(--app-text-muted)]]="periodView() !== 'month'"
                (click)="setPeriodView('month')"
              >
                Mese corrente
              </button>
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-xs font-semibold transition"
                [class.bg-[var(--brand-primary)]]="periodView() === 'year'"
                [class.text-white]="periodView() === 'year'"
                [class.text-[var(--app-text-muted)]]="periodView() !== 'year'"
                (click)="setPeriodView('year')"
              >
                Anno in corso
              </button>
            </div>
            <p class="mt-2 text-xs text-[var(--app-text-muted)]">
              {{ filteredOrders().length }} ordini &middot; {{ periodReferenceLabel() }}
            </p>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th
                    class="px-5 py-4 text-left text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]"
                  >
                    Ordine
                  </th>
                  <th
                    class="px-5 py-4 text-left text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]"
                  >
                    Data
                  </th>
                  <th
                    class="px-5 py-4 text-left text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]"
                  >
                    Prodotti
                  </th>
                  <th
                    class="px-5 py-4 text-left text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]"
                  >
                    Mancanti
                  </th>
                  <th
                    class="px-5 py-4 text-left text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]"
                  >
                    Fornitori
                  </th>
                  <th
                    class="px-5 py-4 text-left text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]"
                  >
                    Stato
                  </th>
                  <th
                    class="px-5 py-4 text-left text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]"
                  >
                    Totale
                  </th>
                  <th
                    class="px-5 py-4 text-right text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]"
                  >
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (order of filteredOrders(); track order.id) {
                  <tr class="transition hover:bg-[rgba(148,163,184,0.04)]">
                    <td class="border-t border-[rgba(148,163,184,0.14)] px-5 py-5">
                      <div class="min-w-[12rem]">
                        <p class="font-heading text-base font-semibold text-[var(--app-text)] sm:text-lg">
                          {{ orderDisplayLabel(order.createdAt) }}
                        </p>
                        <p class="mt-1 text-xs text-[var(--app-text-muted)]">
                          {{ orderTotalsUpdatedLabel(order) }}
                        </p>
                      </div>
                    </td>
                    <td class="border-t border-[rgba(148,163,184,0.14)] px-5 py-5">
                      <p class="text-sm font-medium text-[var(--app-text)]">
                        {{ orderDateLabel(order.createdAt) }}
                      </p>
                      <p class="mt-1 text-xs text-[var(--app-text-muted)]">
                        {{ orderTimeLabel(order.createdAt) }}
                      </p>
                    </td>
                    <td class="border-t border-[rgba(148,163,184,0.14)] px-5 py-5">
                      <p class="text-sm font-semibold text-[var(--app-text)]">
                        {{ productsLabel(order) }}
                      </p>
                    </td>
                    <td class="border-t border-[rgba(148,163,184,0.14)] px-5 py-5">
                      <span
                        class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                        [class.bg-[rgba(244,63,94,0.08)]]="missingItemsCount(order) > 0"
                        [class.text-[var(--app-danger-text)]]="missingItemsCount(order) > 0"
                        [class.bg-[rgba(34,197,94,0.08)]]="missingItemsCount(order) === 0"
                        [class.text-[var(--brand-success)]]="missingItemsCount(order) === 0"
                      >
                        {{ missingItemsLabel(order) }}
                      </span>
                    </td>
                    <td class="border-t border-[rgba(148,163,184,0.14)] px-5 py-5">
                      <p class="text-sm font-semibold text-[var(--app-text)]">
                        {{ suppliersLabel(order) }}
                      </p>
                    </td>
                    <td class="border-t border-[rgba(148,163,184,0.14)] px-5 py-5">
                      <span
                        class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                        [class.bg-[rgba(37,99,235,0.08)]]="!isClosedOrder(order)"
                        [class.text-[var(--brand-primary)]]="!isClosedOrder(order)"
                        [class.bg-[rgba(16,185,129,0.12)]]="isClosedOrder(order)"
                        [class.text-[var(--app-success-text)]]="isClosedOrder(order)"
                      >
                        {{ orderStatusLabel(order.status) }}
                      </span>
                    </td>
                    <td class="border-t border-[rgba(148,163,184,0.14)] px-5 py-5">
                      <p class="font-heading text-lg font-semibold text-[var(--brand-secondary)]">
                        {{ estimatedTotalLabel(order) }}
                      </p>
                    </td>
                    <td class="border-t border-[rgba(148,163,184,0.14)] px-5 py-5">
                      <div class="flex justify-end gap-3">
                        <a
                          pButton
                          [routerLink]="['/app/orders', order.id]"
                          class="btn-secondary justify-center !rounded-2xl !px-4 !py-2.5 !text-sm !font-semibold no-underline"
                        >
                          Apri dettaglio
                        </a>
                        <button
                          pButton
                          type="button"
                          class="justify-center !rounded-2xl !border !border-[var(--app-danger-border)] !bg-white !px-4 !py-2.5 !text-sm !font-semibold !text-[var(--app-danger-text)]"
                          [disabled]="deletingOrderIds()[order.id]"
                          (click)="openDeleteDialog(order)"
                        >
                          {{ deletingOrderIds()[order.id] ? 'Eliminazione...' : 'Elimina' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      <p-dialog
        [visible]="!!deleteDialogOrder()"
        (visibleChange)="onDeleteDialogVisibilityChange($event)"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
        [dismissableMask]="true"
        [style]="{ width: 'min(520px, 96vw)' }"
        header="Elimina ordine"
      >
        <div class="flex flex-col gap-4">
          <p class="text-sm leading-7 text-[var(--app-text-muted)]">
            Stai per eliminare definitivamente
            <span class="font-semibold text-[var(--app-text)]">
              {{ deleteDialogOrder() ? orderDisplayLabel(deleteDialogOrder()!.createdAt) : 'questo ordine' }}
            </span>.
            L'operazione rimuove anche gli asset collegati e non puo essere annullata.
          </p>

          <div class="flex justify-end gap-3">
            <button
              pButton
              type="button"
              class="btn-secondary justify-center !rounded-2xl !px-4 !py-2.5 !text-sm !font-semibold"
              (click)="closeDeleteDialog()"
            >
              Annulla
            </button>
            <button
              pButton
              type="button"
              class="justify-center !rounded-2xl !border !border-[var(--app-danger-border)] !bg-[var(--app-danger-bg)] !px-4 !py-2.5 !text-sm !font-semibold !text-[var(--app-danger-text)]"
              [disabled]="!deleteDialogOrder() || !!(deleteDialogOrder() && deletingOrderIds()[deleteDialogOrder()!.id])"
              (click)="confirmDeleteOrder()"
            >
              {{
                deleteDialogOrder() && deletingOrderIds()[deleteDialogOrder()!.id]
                  ? 'Eliminazione...'
                  : 'Conferma eliminazione'
              }}
            </button>
          </div>
        </div>
      </p-dialog>

      <app-payment-required-dialog
        [visible]="paymentRequiredDialogVisible()"
        [action]="paymentRequiredAction()"
        (visibleChange)="paymentRequiredDialogVisible.set($event)"
      />
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersListPageComponent {
  private readonly authStore = inject(AuthStore);
  private readonly ordersService = inject(OrdersService);
  private readonly ordersStore = inject(OrdersSessionStore);
  private readonly router = inject(Router);
  private readonly italianShortDateFormatter = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short'
  });
  private readonly italianDateFormatter = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  private readonly italianTimeFormatter = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  });
  private readonly integerFormatter = new Intl.NumberFormat('it-IT');
  private readonly currentDate = new Date();
  private readonly italianMonthYearFormatter = new Intl.DateTimeFormat('it-IT', {
    month: 'long',
    year: 'numeric'
  });

  readonly orders = this.ordersStore.orders;
  readonly creating = signal(false);
  readonly deletingOrderIds = signal<Record<string, boolean>>({});
  readonly deleteDialogOrder = signal<SessionOrder | null>(null);
  readonly paymentRequiredDialogVisible = signal(false);
  readonly paymentRequiredAction = signal<PaymentRequiredAction>('create-order');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly periodView = signal<PeriodView>('month');
  readonly periodReferenceLabel = computed(() =>
    this.periodView() === 'month'
      ? this.capitalize(this.italianMonthYearFormatter.format(this.currentDate))
      : `${this.currentDate.getFullYear()}`
  );
  readonly filteredOrders = computed(() => {
    const period = this.periodView();
    const currentYear = this.currentDate.getFullYear();
    const currentMonth = this.currentDate.getMonth();

    return this.orders().filter((order) => {
      const date = this.parseDate(order.createdAt);

      if (!date) {
        return false;
      }

      return date.getFullYear() === currentYear &&
        (period === 'year' || date.getMonth() === currentMonth);
    });
  });
  readonly allOrdersCount = computed(() => this.orders().length);
  readonly ordersCount = computed(() => this.filteredOrders().length);
  readonly draftOrdersCount = computed(
    () => this.filteredOrders().filter((order) => (order.status ?? '').trim().toLowerCase() === 'draft').length
  );
  readonly totalEstimatedAmount = computed(() =>
    this.filteredOrders().reduce((sum, order) => sum + (order.estimatedTotal ?? 0), 0)
  );

  constructor() {
    void this.loadOrders();
  }

  async createOrder(): Promise<void> {
    if (this.shouldOpenPaymentRequiredDialogForCreate()) {
      return;
    }

    this.creating.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.ordersService.createOrder());
      this.ordersStore.upsertOrder(response.order);
      await this.router.navigate(['/app/orders', response.order.id]);
    } catch (error: unknown) {
      if (this.handlePaymentRequiredError(error, 'create-order')) {
        return;
      }

      this.error.set(this.toMessage(error, 'Creazione ordine non riuscita.'));
    } finally {
      this.creating.set(false);
    }
  }

  setPeriodView(period: PeriodView): void {
    this.periodView.set(period);
  }

  openDeleteDialog(order: SessionOrder): void {
    this.deleteDialogOrder.set(order);
  }

  closeDeleteDialog(): void {
    this.deleteDialogOrder.set(null);
  }

  onDeleteDialogVisibilityChange(visible: boolean): void {
    if (!visible) {
      this.closeDeleteDialog();
    }
  }

  async confirmDeleteOrder(): Promise<void> {
    const order = this.deleteDialogOrder();

    if (!order) {
      return;
    }

    await this.deleteOrder(order);
  }

  private async deleteOrder(order: SessionOrder): Promise<void> {
    if (!order.id) {
      return;
    }

    this.deletingOrderIds.update((state) => ({
      ...state,
      [order.id]: true
    }));
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.ordersService.deleteOrder(order.id));
      this.ordersStore.removeOrder(order.id);
      this.closeDeleteDialog();

      if (response.cleanupWarnings.length > 0) {
        this.error.set(response.cleanupWarnings.join(' '));
      }
    } catch (error: unknown) {
      this.error.set(this.toMessage(error, 'Eliminazione ordine non riuscita.'));
    } finally {
      this.deletingOrderIds.update((state) => {
        const nextState = { ...state };
        delete nextState[order.id];
        return nextState;
      });
    }
  }

  totalEstimatedLabel(): string {
    return this.formatCurrency(this.totalEstimatedAmount(), 'EUR');
  }

  draftOrdersLabel(): string {
    const count = this.draftOrdersCount();
    return count === 1 ? '1 ordine in bozza' : `${count} ordini in bozza`;
  }

  orderStatusLabel(status: string | undefined): string {
    const normalized = (status ?? '').trim().toLowerCase();

    if (normalized === 'draft') {
      return 'Bozza';
    }

    if (normalized === 'closed') {
      return 'Chiuso';
    }

    if (!normalized) {
      return 'Ordine';
    }

    return this.capitalize(normalized);
  }

  orderDisplayLabel(createdAt: string): string {
    const date = this.parseDate(createdAt);

    if (!date) {
      return 'Ordine';
    }

    return `Ordine ${this.capitalize(this.italianShortDateFormatter.format(date))}`;
  }

  orderDateLabel(createdAt: string): string {
    const date = this.parseDate(createdAt);

    if (!date) {
      return 'Data non disponibile';
    }

    return this.capitalize(this.italianDateFormatter.format(date));
  }

  orderTimeLabel(createdAt: string): string {
    const date = this.parseDate(createdAt);

    if (!date) {
      return '-';
    }

    return this.italianTimeFormatter.format(date);
  }

  orderTotalsUpdatedLabel(order: SessionOrder): string {
    const date = this.parseDate(order.totalsCalculatedAt ?? '');

    if (!date) {
      return 'Totale non ancora ricalcolato';
    }

    return `Ricalcolato alle ${this.italianTimeFormatter.format(date)}`;
  }

  productsLabel(order: SessionOrder): string {
    const count = order.productsCount ?? order.items.length;
    const formattedCount = this.integerFormatter.format(count);
    return count === 1 ? `${formattedCount} articolo` : `${formattedCount} articoli`;
  }

  suppliersLabel(order: SessionOrder): string {
    const count = order.suppliersCount ?? order.suppliers?.length ?? 0;
    const formattedCount = this.integerFormatter.format(count);
    return count === 1 ? `${formattedCount} fornitore` : `${formattedCount} fornitori`;
  }

  missingItemsCount(order: SessionOrder): number {
    return order.missingItemsCount ?? 0;
  }

  missingItemsLabel(order: SessionOrder): string {
    const count = this.missingItemsCount(order);
    const formattedCount = this.integerFormatter.format(count);
    return count === 1 ? `${formattedCount} mancante` : `${formattedCount} mancanti`;
  }

  estimatedTotalLabel(order: SessionOrder): string {
    if (order.estimatedTotal === null || order.estimatedTotal === undefined) {
      return '-';
    }

    return this.formatCurrency(order.estimatedTotal, order.currency ?? 'EUR');
  }

  isClosedOrder(order: SessionOrder): boolean {
    return (order.status ?? '').trim().toLowerCase() === 'closed';
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

  private formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  private toMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage =
        (typeof error.error === 'string' && error.error) ||
        (typeof error.error?.message === 'string' && error.error.message) ||
        '';

      if (apiMessage.trim().length > 0) {
        return apiMessage;
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }

  private shouldOpenPaymentRequiredDialogForCreate(): boolean {
    return this.allOrdersCount() >= 1 && this.openPaymentRequiredDialogIfNeeded('create-order');
  }

  private openPaymentRequiredDialogIfNeeded(action: PaymentRequiredAction): boolean {
    if (this.authStore.accessProfile()?.isPaying !== false) {
      return false;
    }

    this.paymentRequiredAction.set(action);
    this.paymentRequiredDialogVisible.set(true);
    this.error.set(null);
    return true;
  }

  private handlePaymentRequiredError(error: unknown, action: PaymentRequiredAction): boolean {
    if (!this.isPaymentRequiredError(error)) {
      return false;
    }

    this.paymentRequiredAction.set(action);
    this.paymentRequiredDialogVisible.set(true);
    this.error.set(null);
    return true;
  }

  private isPaymentRequiredError(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 403) {
      return false;
    }

    const message = this.toMessage(error, '').toLowerCase();
    return (
      message.includes('utenti non paganti') ||
      message.includes('account pagante') ||
      message.includes('utenti paganti')
    );
  }

  private parseDate(value: string): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private capitalize(value: string): string {
    if (!value) {
      return value;
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
