import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'agent' },
      {
        path: 'agent',
        loadChildren: () => import('./features/agent/agent.routes').then((m) => m.AGENT_ROUTES),
      },
      {
        path: 'file-manager',
        loadChildren: () =>
          import('./features/file-manager/file-manager.routes').then((m) => m.FILE_MANAGER_ROUTES),
      },
      {
        path: 'open-wa',
        loadChildren: () => import('./features/open-wa/open-wa.routes').then((m) => m.OPEN_WA_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
