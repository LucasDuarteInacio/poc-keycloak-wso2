import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { moduleGuard } from './core/auth/module.guard';
import { portalEntryGuard } from './core/auth/portal-entry.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'portal', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },

  {
    path: 'callback',
    loadComponent: () =>
      import('./pages/callback/callback.component').then((m) => m.CallbackComponent),
  },

  {
    path: 'forbidden',
    loadComponent: () =>
      import('./pages/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
  },

  {
    path: '',
    loadComponent: () =>
      import('./layout/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'portal',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        runGuardsAndResolvers: 'always',
        canActivate: [portalEntryGuard],
        data: {
          tokenContext: 'portal',
          portalHome: true,
          roles: ['mod:customers', 'mod:products', 'mod:orders'],
        },
      },
      { path: 'dashboard', redirectTo: 'portal', pathMatch: 'full' },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customers.component').then((m) => m.CustomersComponent),
        canActivate: [moduleGuard, roleGuard],
        data: { tokenContext: 'module', roles: ['customers:read'] },
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/products.component').then((m) => m.ProductsComponent),
        canActivate: [moduleGuard, roleGuard],
        data: { tokenContext: 'module', roles: ['products:read'] },
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/orders/orders.component').then((m) => m.OrdersComponent),
        canActivate: [moduleGuard, roleGuard],
        data: { tokenContext: 'module', roles: ['orders:read'] },
      },
    ],
  },

  { path: '**', redirectTo: 'portal' },
];
