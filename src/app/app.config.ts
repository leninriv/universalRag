import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { API_CONFIG } from './core/config/api.config';
import { SpanishPaginatorIntl } from './core/i18n/paginator-intl';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { sessionInterceptor } from './core/interceptors/session.interceptor';
import { authMockInterceptor } from './core/mocks/auth-mock.interceptor';
import { documentsMockInterceptor } from './features/file-manager/mocks/documents-mock.interceptor';
import { whatsappMockInterceptor } from './features/open-wa/mocks/whatsapp-mock.interceptor';
import { routes } from './app.routes';

// Fechas y números (DatePipe, formatNumber…) en español.
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // Orden: envía el token → captura sesión/401 → (mocks) hacen de backend. La respuesta recorre la cadena en sentido inverso.
    provideHttpClient(
      withInterceptors([
        authTokenInterceptor,
        sessionInterceptor,
        ...(API_CONFIG.useMocks ? [authMockInterceptor, documentsMockInterceptor, whatsappMockInterceptor] : []),
      ]),
    ),
    { provide: LOCALE_ID, useValue: 'es' },
    { provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl },
    // <mat-icon>nombre</mat-icon> usa Material Symbols (fuente cargada en index.html).
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
};
