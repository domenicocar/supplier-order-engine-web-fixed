import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../features/auth/services/auth.service';
import { AuthStore } from '../../features/auth/stores/auth.store';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="app-page-shell">
      <header class="app-topbar sticky top-0 z-20">
        <div class="mx-auto flex max-w-[95rem] items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <div class="flex items-center gap-4">
            <a
              routerLink="/landing"
              class="flex items-center gap-3 no-underline"
            >
              <span class="app-logo-badge flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold">
                SO
              </span>
              <div>
                <p class="font-heading text-lg font-semibold tracking-tight">
                  Supplier Order Engine
                </p>
                <p class="app-brand-meta text-sm">Frontend V0</p>
              </div>
            </a>
          </div>

          <nav class="app-glass-nav flex items-center gap-2 rounded-full p-1">
            <a
              routerLink="/landing"
              routerLinkActive="app-nav-link--active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="app-nav-link rounded-full px-4 py-2 text-sm font-medium transition"
            >
              Landing
            </a>
            <a
              routerLink="/app/orders"
              routerLinkActive="app-nav-link--active"
              class="app-nav-link rounded-full px-4 py-2 text-sm font-medium transition"
            >
              Ordini
            </a>
          </nav>

          <div class="flex items-center gap-3">
            @if (authStore.user(); as user) {
              <span class="app-brand-meta text-sm">{{ user.email }}</span>
            }
            <button
              type="button"
              class="btn-secondary rounded-full px-4 py-2"
              (click)="signOut()"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-[95rem] px-4 py-8 sm:px-6 lg:px-8">
        @if (authStore.suspendedMessage(); as suspendedMessage) {
          <div class="app-alert-warning mb-6">
            {{ suspendedMessage }}
          </div>
        }
        <router-outlet />
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate(['/login']);
  }
}
