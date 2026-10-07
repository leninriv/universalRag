import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';

import { API_CONFIG } from '../config/api.config';
import { LoginResponse } from '../models/auth.model';
import { AuthService, LOGIN_URL } from '../services/auth.service';

/**
 * Recibe el token de sesión: al responder el login lo guarda en `AuthService`.
 * Si la API responde 401 en cualquier otra petición, la sesión ya no es válida: la cierra y lleva al login.
 */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    tap((event) => {
      if (req.url === LOGIN_URL && event.type === HttpEventType.Response) {
        auth.startSession(event.body as LoginResponse);
      }
    }),
    catchError((error: unknown) => {
      const isApiCall = req.url.startsWith(API_CONFIG.baseUrl) && req.url !== LOGIN_URL;
      if (isApiCall && error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout(router.url);
      }
      return throwError(() => error);
    }),
  );
};
