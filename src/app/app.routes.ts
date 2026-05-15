import { Routes } from '@angular/router';

import { AppShellComponent } from './core/layout/app-shell.component';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'landing'
  },
  {
    path: 'landing',
    loadComponent: () =>
      import('./features/landing/pages/landing-page.component').then(
        (m) => m.LandingPageComponent
      )
  },
  {
    path: 'app',
    component: AppShellComponent,
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
    redirectTo: 'landing'
  }
];
