import { Injectable, TemplateRef, effect, signal } from '@angular/core';

const SIDEBAR_COLLAPSED_KEY = 'app-sidebar-collapsed';
/** Breakpoint `lg` de PrimeFlex: desde aquí el menú lateral es fijo; por debajo es un drawer. */
const DESKTOP_MEDIA_QUERY = '(min-width: 992px)';

/** Estado compartido del shell: menú lateral y contenido que cada página proyecta en la barra superior. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  /** Menú lateral reducido a íconos (solo desktop). Se recuerda entre sesiones. */
  readonly sidebarCollapsed = signal(readStoredFlag(SIDEBAR_COLLAPSED_KEY));
  /** Drawer de navegación abierto (solo mobile). */
  readonly mobileNavVisible = signal(false);
  /** Contenido de la página activa para la barra superior (ver `TopbarContentDirective`). */
  readonly topbarContent = signal<TemplateRef<unknown> | null>(null);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(this.sidebarCollapsed()));
      } catch {
        // Sin acceso a localStorage: el estado solo dura la sesión.
      }
    });
  }

  /** En desktop colapsa/expande el menú lateral; en mobile abre el drawer. */
  toggleSidebar(): void {
    if (matchMedia(DESKTOP_MEDIA_QUERY).matches) {
      this.sidebarCollapsed.update((collapsed) => !collapsed);
    } else {
      this.mobileNavVisible.set(true);
    }
  }
}

function readStoredFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}
