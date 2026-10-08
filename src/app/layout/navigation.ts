export interface NavItem {
  label: string;
  /** Nombre de un ícono de Material Symbols. */
  icon: string;
  route: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/** Módulos de la aplicación que se muestran en el menú lateral. */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Módulos',
    items: [
      { label: 'Agent', icon: 'forum', route: '/agent' },
      { label: 'FileManager', icon: 'folder', route: '/file-manager' },
      { label: 'OpenWa', icon: 'chat', route: '/open-wa' },
    ],
  },
];
