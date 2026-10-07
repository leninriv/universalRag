import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of, throwError, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { LoginCredentials, LoginResponse } from '../models/auth.model';
import { LOGIN_URL } from '../services/auth.service';

/** Credenciales del usuario de prueba (solo mientras `API_CONFIG.useMocks` sea `true`). */
export const MOCK_CREDENTIALS: LoginCredentials = { email: 'demo@universalragco.com', password: 'test123' };

const MOCK_USER = { id: 'mock-user-1', name: 'Usuario Demo', email: MOCK_CREDENTIALS.email };
const MOCK_TOKEN_TTL_SECONDS = 60 * 60;
const MOCK_LATENCY_MS = 600;

/**
 * Hace de backend falso para `POST /auth/login` hasta que exista la API real.
 * Va al final de la cadena de interceptores: responde sin llamar a la red, pero su respuesta
 * pasa igualmente por `sessionInterceptor` como si viniera del servidor.
 */
export const authMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'POST' || req.url !== LOGIN_URL) {
    return next(req);
  }

  const { email, password } = (req.body ?? {}) as Partial<LoginCredentials>;
  if (email?.trim().toLowerCase() !== MOCK_CREDENTIALS.email || password !== MOCK_CREDENTIALS.password) {
    return timer(MOCK_LATENCY_MS).pipe(
      mergeMap(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 401,
              statusText: 'Unauthorized',
              url: req.url,
              error: { message: 'Correo o contraseña incorrectos.' },
            }),
        ),
      ),
    );
  }

  const body: LoginResponse = {
    accessToken: `mock-token-${crypto.randomUUID()}`,
    expiresIn: MOCK_TOKEN_TTL_SECONDS,
    user: MOCK_USER,
  };
  return of(new HttpResponse({ status: 200, url: req.url, body })).pipe(delay(MOCK_LATENCY_MS));
};
