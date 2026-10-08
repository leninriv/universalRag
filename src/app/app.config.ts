import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { API_CONFIG } from './core/config/api.config';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { sessionInterceptor } from './core/interceptors/session.interceptor';
import { authMockInterceptor } from './core/mocks/auth-mock.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // Orden: envía el token → captura sesión/401 → (mock) hace de backend. La respuesta recorre la cadena en sentido inverso.
    provideHttpClient(
      withInterceptors([authTokenInterceptor, sessionInterceptor, ...(API_CONFIG.useMocks ? [authMockInterceptor] : [])]),
    ),
    // <mat-icon>nombre</mat-icon> usa Material Symbols (fuente cargada en index.html).
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
};
