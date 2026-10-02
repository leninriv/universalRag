import { Routes } from '@angular/router';

export const OPEN_WA_ROUTES: Routes = [
  {
    path: '',
    title: 'OpenWa · Universal RAG',
    loadComponent: () => import('./pages/open-wa-page/open-wa-page.component').then((m) => m.OpenWaPageComponent),
  },
];
