import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="app-page-shell">
      <div class="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <div class="space-y-10">
          <div class="surface-panel rounded-[2rem] p-8 sm:p-10">
            <div class="max-w-3xl">
              <span class="app-pill">Supplier Order Engine · V0</span>

              <h1 class="mt-6 text-4xl font-bold tracking-tight text-[var(--app-text)] sm:text-5xl">
                Ordini fornitori, senza copia e incolla
              </h1>

              <p class="mt-4 max-w-2xl text-lg text-[var(--app-text-muted)]">
                Importa un ordine, confronta i listini dei fornitori e genera i
                file finali pronti per l'invio.
              </p>

              <div class="mt-8 flex flex-col gap-3 sm:flex-row">
                <a routerLink="/app/orders" class="app-primary-action">
                  Apri applicazione
                </a>

                <a routerLink="/login" class="app-secondary-action">
                  Vai al login
                </a>
              </div>

              <p class="mt-6 max-w-2xl text-sm leading-6 text-[var(--app-text-soft)]">
                Frontend Angular collegato a backend NestJS multi-tenant con
                autenticazione Supabase Auth.
              </p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <p class="text-sm font-medium uppercase tracking-[0.18em] text-[var(--brand-secondary)]">
                Flusso V0
              </p>
              <h2 class="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-text)]">
                Dal nuovo ordine ai file finali
              </h2>
            </div>

            <div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
              @for (step of steps; track step.title) {
                <article class="surface-panel rounded-2xl p-6">
                  <span class="app-icon-circle">{{ step.index }}</span>
                  <h3 class="mt-4 text-lg font-semibold text-[var(--app-text)]">
                    {{ step.title }}
                  </h3>
                  <p class="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
                    {{ step.copy }}
                  </p>
                </article>
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPageComponent {
  readonly steps = [
    {
      index: 1,
      title: 'Crea ordine',
      copy: 'Avvia un nuovo ordine dalla sessione frontend collegata al backend.',
    },
    {
      index: 2,
      title: 'Import PDF ordine',
      copy: 'Carica il PDF e visualizza subito prodotti letti, scarti e review item.',
    },
    {
      index: 3,
      title: 'Carica file fornitori',
      copy: 'Gestisci i fornitori reali del tenant con card semplici collegate al backend.',
    },
    {
      index: 4,
      title: 'Esporta ordini',
      copy: 'Genera i file finali pronti per l’invio con l’esito restituito dal backend.',
    },
  ];
}
