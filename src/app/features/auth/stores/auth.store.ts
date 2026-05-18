import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';

import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthStore {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private initialized = false;
  private initializePromise: Promise<void> | null = null;

  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly loading = signal(true);
  readonly suspendedMessage = signal<string | null>(null);
  readonly isAuthenticated = computed(() => !!this.session());
  private authStateSubscribed = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.loading.set(true);
    this.initializePromise = (async () => {
      console.log('[AuthStore] initialize:start');

      try {
        const session = await this.authService.getSession();
        console.log('[AuthStore] initialize:getSession resolved', !!session);
        this.setSession(session);
      } catch (error) {
        console.error('[AuthStore] initialize:getSession failed', error);
        this.setSession(null);
      } finally {
        this.ensureAuthStateSubscription();
        this.initialized = true;
        this.loading.set(false);
        console.log('[AuthStore] initialize:done', {
          authenticated: this.isAuthenticated()
        });
      }
    })().finally(() => {
      this.initializePromise = null;
    });

    return this.initializePromise;
  }

  setSuspendedMessage(message: string | null): void {
    this.suspendedMessage.set(message);
  }

  async handleUnauthorized(): Promise<void> {
    try {
      await this.authService.signOut();
    } catch {
      // Ignore sign-out errors so we can still clear local state and redirect.
    }
    this.session.set(null);
    this.user.set(null);
    await this.router.navigate(['/login']);
  }

  private setSession(session: Session | null): void {
    this.session.set(session);
    this.user.set(session?.user ?? null);
  }

  private ensureAuthStateSubscription(): void {
    if (this.authStateSubscribed) {
      return;
    }

    this.authService.onAuthStateChange((nextSession) => {
      console.log('[AuthStore] onAuthStateChange', !!nextSession);
      this.setSession(nextSession);
    });
    this.authStateSubscribed = true;
  }
}
