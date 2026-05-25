import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { AuthService } from '../../features/auth/services/auth.service';
import { AuthStore } from '../../features/auth/stores/auth.store';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="app-page-shell">
      <header class="border-b border-[color:var(--app-border)]/70 bg-white/80 backdrop-blur">
        <div class="mx-auto flex max-w-[95rem] items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
          @if (authStore.user(); as user) {
            <span class="app-brand-meta text-sm">{{ user.email }}</span>
          }
          <button
            type="button"
            class="btn-secondary rounded-full px-4 py-2 text-sm"
            (click)="signOut()"
          >
            Logout
          </button>
        </div>
      </header>

      <main class="mx-auto max-w-[95rem] px-4 py-8 sm:px-6 lg:px-8">
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
