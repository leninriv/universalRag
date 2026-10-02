import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

// Debe coincidir con el script de src/index.html, que aplica el tema antes de arrancar Angular.
const STORAGE_KEY = 'app-theme';
const THEME_LINK_ID = 'app-theme';
const THEME_FILES: Record<ThemeMode, string> = {
  light: 'lara-light-indigo.css',
  dark: 'lara-dark-indigo.css',
};

/**
 * Tema claro/oscuro. Cambia la hoja de tema de PrimeNG (`<link id="app-theme">`), que se genera
 * como bundle aparte en angular.json. Sin preferencia guardada se usa la del sistema operativo.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly mode = signal<ThemeMode>(readInitialMode());
  readonly isDark = computed(() => this.mode() === 'dark');

  constructor() {
    effect(() => this.applyTheme(this.mode()));
  }

  toggle(): void {
    const mode: ThemeMode = this.isDark() ? 'light' : 'dark';
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Sin acceso a localStorage (modo privado, etc.): el tema solo dura la sesión.
    }
  }

  private applyTheme(mode: ThemeMode): void {
    const link = this.document.getElementById(THEME_LINK_ID) as HTMLLinkElement | null;
    if (link && link.getAttribute('href') !== THEME_FILES[mode]) {
      link.href = THEME_FILES[mode];
    }
    this.document.documentElement.style.colorScheme = mode;
  }
}

function readInitialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // Ignorado: se usa la preferencia del sistema.
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
