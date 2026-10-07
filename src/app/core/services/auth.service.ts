import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';

import { API_CONFIG } from '../config/api.config';
import { AuthSession, AuthUser, LoginCredentials, LoginResponse } from '../models/auth.model';

const STORAGE_KEY = 'app-session';

/** Ruta de login; los interceptores la usan para no enviar el token ni cerrar sesión por un 401 de credenciales. */
export const LOGIN_URL = `${API_CONFIG.baseUrl}/auth/login`;

/**
 * Sesión del usuario. `login()` solo llama a la API: el token de la respuesta lo captura
 * `sessionInterceptor` (que llama a `startSession()`) y `authTokenInterceptor` lo envía en cada petición.
 * La sesión se recuerda en `localStorage` hasta que expira el token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<AuthSession | null>(readStoredSession());

  readonly user = computed<AuthUser | null>(() => this.session()?.user ?? null);

  login(credentials: LoginCredentials): Observable<AuthUser> {
    return this.http.post<LoginResponse>(LOGIN_URL, credentials).pipe(map((response) => response.user));
  }

  /** Guarda la sesión recibida del backend. */
  startSession(response: LoginResponse): void {
    const session: AuthSession = {
      token: response.accessToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      user: response.user,
    };
    this.session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Sin acceso a localStorage (modo privado, etc.): la sesión solo dura mientras la pestaña esté abierta.
    }
  }

  /** Token vigente o `null` si no hay sesión o ya expiró (en ese caso la limpia). */
  getToken(): string | null {
    const session = this.session();
    if (!session) {
      return null;
    }
    if (session.expiresAt <= Date.now()) {
      this.clearSession();
      return null;
    }
    return session.token;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  /** Cierra la sesión y lleva al login; `returnUrl` hace que, tras volver a entrar, se regrese a esa ruta. */
  logout(returnUrl?: string): void {
    this.clearSession();
    void this.router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : undefined });
  }

  private clearSession(): void {
    this.session.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorado: no hay nada guardado que limpiar.
    }
  }
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const session = JSON.parse(raw) as AuthSession;
    return session.token && session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}
