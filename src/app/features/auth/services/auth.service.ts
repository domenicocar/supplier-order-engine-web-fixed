import { Injectable } from '@angular/core';
import { AuthResponse, Session, User } from '@supabase/supabase-js';

import { supabase } from '../../../core/supabase/supabase.client';

export interface UserAccessProfile {
  id: string;
  role: string | null;
  isPaying: boolean;
  subscriptionPlan: 'basic' | 'plus';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  async signIn(email: string, password: string): Promise<AuthResponse> {
    return supabase.auth.signInWithPassword({
      email,
      password
    });
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  }

  async getAccessToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.access_token ?? null;
  }

  async getCurrentUser(): Promise<User | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  }

  async getAccessProfile(userId: string): Promise<UserAccessProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data || typeof data !== 'object') {
      return null;
    }

    const profile = data as Record<string, unknown>;

    return {
      id: typeof profile['id'] === 'string' ? profile['id'] : userId,
      role: typeof profile['role'] === 'string' ? profile['role'] : null,
      isPaying: profile['is_paying'] === true,
      subscriptionPlan: this.normalizeSubscriptionPlan(profile['subscription_plan'], profile['is_paying'] === true)
    };
  }

  private normalizeSubscriptionPlan(value: unknown, isPaying: boolean): 'basic' | 'plus' {
    if (value === 'basic' || value === 'plus') {
      return value;
    }

    return isPaying ? 'plus' : 'basic';
  }

  onAuthStateChange(
    callback: (session: Session | null) => void
  ): { unsubscribe: () => void } {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });

    return {
      unsubscribe: () => data.subscription.unsubscribe()
    };
  }
}
