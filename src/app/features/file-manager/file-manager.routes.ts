import { Routes } from '@angular/router';

export const FILE_MANAGER_ROUTES: Routes = [
  {
    path: '',
    title: 'FileManager · Universal RAG',
    loadComponent: () =>
      import('./pages/file-manager-page/file-manager-page.component').then((m) => m.FileManagerPageComponent),
  },
];
