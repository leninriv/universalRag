import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { API_CONFIG } from '../config/api.config';
import { AuthService, LOGIN_URL } from '../services/auth.service';

/** Envía el token de sesión (`Authorization: Bearer`) en las peticiones a la API, salvo en el login. */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_CONFIG.baseUrl) || req.url === LOGIN_URL) {
    return next(req);
  }
  const token = inject(AuthService).getToken();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};
