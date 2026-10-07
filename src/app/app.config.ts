import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeuix/themes/lara';
import { definePreset } from '@primeuix/themes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { API_CONFIG } from './core/config/api.config';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { sessionInterceptor } from './core/interceptors/session.interceptor';
import { authMockInterceptor } from './core/mocks/auth-mock.interceptor';
import { routes } from './app.routes';

// Lara con acento indigo (como lara-*-indigo en PrimeNG 17).
const AppPreset = definePreset(Lara, {
  semantic: {
    primary: {
      50: '{indigo.50}', 100: '{indigo.100}', 200: '{indigo.200}', 300: '{indigo.300}', 400: '{indigo.400}',
      500: '{indigo.500}', 600: '{indigo.600}', 700: '{indigo.700}', 800: '{indigo.800}', 900: '{indigo.900}', 950: '{indigo.950}',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // Orden: envía el token → captura sesión/401 → (mock) hace de backend. La respuesta recorre la cadena en sentido inverso.
    provideHttpClient(
      withInterceptors([authTokenInterceptor, sessionInterceptor, ...(API_CONFIG.useMocks ? [authMockInterceptor] : [])]),
    ),
    provideAnimationsAsync(),
    providePrimeNG({ ripple: true, theme: { preset: AppPreset, options: { darkModeSelector: '.app-dark' } } }),
  ],
};
