
import { Injectable, computed, effect, inject, signal, DOCUMENT } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

// Debe coincidir con el script de src/index.html, que aplica el tema antes de arrancar Angular.
const STORAGE_KEY = 'app-theme';
const DARK_CLASS = 'app-dark';

/**
 * Tema claro/oscuro. Alterna la clase `app-dark` en `<html>` (darkModeSelector de PrimeNG, ver app.config.ts). Sin preferencia guardada se usa la del sistema operativo.
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
    this.document.documentElement.classList.toggle(DARK_CLASS, mode === 'dark');
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
