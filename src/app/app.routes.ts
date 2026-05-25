import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { AppShellComponent } from './core/layout/app-shell.component';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login-page.component').then(
        (m) => m.LoginPageComponent
      )
  },
  {
    path: 'landing',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'app',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'orders'
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/orders/pages/orders-list-page.component').then(
            (m) => m.OrdersListPageComponent
          )
      },
      {
        path: 'orders/:id',
        loadComponent: () =>
          import('./features/orders/pages/order-detail-page.component').then(
            (m) => m.OrderDetailPageComponent
          )
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
