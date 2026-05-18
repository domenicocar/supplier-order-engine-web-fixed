import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthStore } from '../../features/auth/stores/auth.store';

export const authGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  console.log('[authGuard] canActivate:start');
  await authStore.initialize();
  console.log('[authGuard] canActivate:initialized', {
    authenticated: authStore.isAuthenticated()
  });

  if (authStore.isAuthenticated()) {
    return true;
  }

  console.log('[authGuard] canActivate:redirect-login');
  return router.createUrlTree(['/login']);
};
