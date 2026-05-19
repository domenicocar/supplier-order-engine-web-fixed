import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="min-h-screen bg-slate-50">
      <div class="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <div class="space-y-10">
          <div
            class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10"
          >
            <div class="max-w-3xl">
              <span
                class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700"
              >
                Supplier Order Engine · V0 - eciao
              </span>

              <h1
                class="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl"
              >
                Ordini fornitori, senza copia e incolla
              </h1>

              <p class="mt-4 max-w-2xl text-lg text-slate-600">
                Importa un ordine, confronta i listini dei fornitori e genera i
                file finali pronti per l'invio.
              </p>

              <div class="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  routerLink="/app/orders"
                  class="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
                >
                  Apri applicazione
                </a>

                <a
                  routerLink="/login"
                  class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Vai al login
                </a>
              </div>

              <p class="mt-6 max-w-2xl text-sm leading-6 text-slate-500">
                Frontend Angular collegato a backend NestJS multi-tenant con
                autenticazione Supabase Auth.
              </p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <p
                class="text-sm font-medium uppercase tracking-[0.18em] text-slate-500"
              >
                Flusso V0
              </p>
              <h2
                class="mt-2 text-2xl font-semibold tracking-tight text-slate-950"
              >
                Dal nuovo ordine ai file finali
              </h2>
            </div>

            <div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <article
                class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700"
                >
                  1
                </span>
                <h3 class="mt-4 text-lg font-semibold text-slate-950">
                  Crea ordine
                </h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  Avvia un nuovo ordine dalla sessione frontend collegata al
                  backend.
                </p>
              </article>

              <article
                class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700"
                >
                  2
                </span>
                <h3 class="mt-4 text-lg font-semibold text-slate-950">
                  Import PDF ordine
                </h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  Carica il PDF e visualizza subito prodotti letti, scarti e
                  review item.
                </p>
              </article>

              <article
                class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700"
                >
                  3
                </span>
                <h3 class="mt-4 text-lg font-semibold text-slate-950">
                  Carica file fornitori
                </h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  Gestisci i fornitori reali del tenant con card semplici
                  collegate al backend.
                </p>
              </article>

              <article
                class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700"
                >
                  4
                </span>
                <h3 class="mt-4 text-lg font-semibold text-slate-950">
                  Esporta ordini
                </h3>
                <p class="mt-2 text-sm leading-6 text-slate-600">
                  Genera i file finali pronti per l'invio con l'esito restituito
                  dal backend.
                </p>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPageComponent {}
