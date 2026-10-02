import { MenuItem } from 'primeng/api';

/** Módulos de la aplicación que se muestran en el menú lateral. */
export const NAV_ITEMS: MenuItem[] = [
  {
    label: 'Módulos',
    items: [
      { label: 'Agent', icon: 'pi pi-comments', routerLink: '/agent' },
      { label: 'FileManager', icon: 'pi pi-folder', routerLink: '/file-manager' },
      { label: 'OpenWa', icon: 'pi pi-whatsapp', routerLink: '/open-wa' },
    ],
  },
];
