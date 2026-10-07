/**
 * Configuración de la API.
 * Mientras no exista backend de autenticación, `useMocks` activa `authMockInterceptor`
 * (ver core/mocks); ponerlo en `false` cuando exista el endpoint real.
 */
export const API_CONFIG = {
  baseUrl: '/api',
  useMocks: true,
} as const;
