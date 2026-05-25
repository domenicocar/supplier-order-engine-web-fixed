import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { AuthStore } from '../stores/auth.store';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="app-page-shell">
      <div class="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        <div class="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div class="surface-panel rounded-[2rem] p-8 sm:p-10">
            <span class="app-pill">Supplier Order Engine</span>

            <h1 class="mt-6 text-4xl font-bold tracking-tight text-[var(--app-text)]">
              Accedi con Supabase Auth
            </h1>

            <p class="mt-4 max-w-2xl text-base leading-7 text-[var(--app-text-muted)]">
              Il token Supabase viene inviato automaticamente al backend NestJS multi-tenant come
              <code class="app-code">Authorization: Bearer &lt;jwt&gt;</code>.
            </p>

            @if (authStore.suspendedMessage(); as suspendedMessage) {
              <div class="app-alert-warning mt-6">
                {{ suspendedMessage }}
              </div>
            }
          </div>

          <div class="surface-panel rounded-[2rem] p-8 sm:p-10">
            <form class="flex flex-col gap-5" (ngSubmit)="submit()">
              <div>
                <label for="email" class="mb-2 block text-sm font-medium text-[var(--brand-secondary)]">Email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  [(ngModel)]="email"
                  class="app-input w-full"
                  autocomplete="email"
                  required
                />
              </div>

              <div>
                <label for="password" class="mb-2 block text-sm font-medium text-[var(--brand-secondary)]">Password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  [(ngModel)]="password"
                  class="app-input w-full"
                  autocomplete="current-password"
                  required
                />
              </div>

              @if (error(); as currentError) {
                <div class="app-alert-error">
                  {{ currentError }}
                </div>
              }

              <button
                type="submit"
                class="btn-primary mt-2 rounded-2xl disabled:cursor-not-allowed disabled:opacity-60"
                [disabled]="submitting() || authStore.loading()"
              >
                {{ submitting() ? 'Accesso in corso...' : 'Accedi' }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.authStore.isAuthenticated()) {
        void this.router.navigate(['/app/orders']);
      }
    });
  }

  async submit(): Promise<void> {
    this.submitting.set(true);
    this.error.set(null);
    this.authStore.setSuspendedMessage(null);

    try {
      const response = await this.authService.signIn(this.email, this.password);

      if (response.error) {
        this.error.set(response.error.message || 'Login non riuscito.');
        return;
      }

      await this.authStore.initialize();
      await this.router.navigate(['/app/orders']);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : 'Login non riuscito.');
    } finally {
      this.submitting.set(false);
    }
  }
}
