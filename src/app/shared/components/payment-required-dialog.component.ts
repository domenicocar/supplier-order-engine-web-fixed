import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

export type PaymentRequiredAction = 'create-order' | 'export-order' | 'supplier-import';

@Component({
  selector: 'app-payment-required-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="visibleChange.emit($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [dismissableMask]="true"
      [style]="{ width: 'min(540px, 96vw)' }"
      header="Passa a un account pagante"
    >
      <div class="flex flex-col gap-5">
        <div class="space-y-2">
          <p class="text-lg font-semibold text-[var(--app-text)]">
            {{ title() }}
          </p>
          <p class="text-sm leading-7 text-[var(--app-text-muted)]">
            {{ description() }}
          </p>
        </div>

        <div class="rounded-2xl border border-[rgba(37,99,235,0.12)] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,245,255,0.95))] px-4 py-4">
          <p class="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-secondary)]">
            Cosa sblocchi
          </p>
          <ul class="mt-3 grid gap-2 text-sm text-[var(--app-text)]">
            @for (benefit of benefits(); track benefit) {
              <li class="flex items-start gap-3">
                <span class="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(37,99,235,0.12)] text-[var(--brand-primary)]">
                  <i class="pi pi-check text-[0.7rem]" aria-hidden="true"></i>
                </span>
                <span>{{ benefit }}</span>
              </li>
            }
          </ul>
        </div>

        <p class="text-sm leading-7 text-[var(--app-text-muted)]">
          Per attivare il piano pagante puoi contattare l'amministratore o completare il pagamento previsto per il tuo account.
        </p>

        <div class="flex justify-end gap-3">
          <button
            pButton
            type="button"
            class="btn-primary justify-center !rounded-2xl !px-5 !py-2.5 !text-sm !font-semibold"
            (click)="visibleChange.emit(false)"
          >
            Ho capito
          </button>
        </div>
      </div>
    </p-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentRequiredDialogComponent {
  readonly visible = input(false);
  readonly action = input<PaymentRequiredAction>('export-order');
  readonly visibleChange = output<boolean>();

  readonly title = computed(() =>
    this.action() === 'create-order'
      ? 'Hai raggiunto il limite del piano Basic'
      : this.action() === 'supplier-import'
        ? 'Hai raggiunto il limite import fornitori'
        : "L'export e disponibile nel piano Basic e Plus"
  );

  readonly description = computed(() =>
    this.action() === 'create-order'
      ? 'Con il piano Basic puoi creare massimo 3 ordini al mese. Con Plus gli ordini sono illimitati.'
      : this.action() === 'supplier-import'
        ? 'Con il piano Basic puoi salvare massimo 4 import fornitori per ordine. Con Plus gli import sono illimitati.'
        : "Se vedi questo avviso, il tuo account non risulta attivo per completare l'operazione."
  );

  readonly benefits = computed(() =>
    this.action() === 'create-order'
      ? ['Ordini mensili illimitati', 'Cronologia completa', 'Nessun blocco sui nuovi draft']
      : this.action() === 'supplier-import'
        ? ['Import fornitori illimitati', 'Confronti prezzo senza limite', 'Gestione listini piu ampia']
        : ["Esporta l'ordine in un click", 'Scarica subito i file generati per i fornitori', "Sblocca il flusso completo fino all'invio finale"]
  );
}
