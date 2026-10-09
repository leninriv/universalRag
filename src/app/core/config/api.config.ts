/**
 * Configuración de la API.
 * Mientras no exista backend, `useMocks` activa los backends falsos `authMockInterceptor` (core/mocks),
 * `documentsMockInterceptor` (features/file-manager/mocks)
 * y `whatsappMockInterceptor` (features/open-wa/mocks); ponerlo en `false` cuando existan los endpoints reales.
 */
export const API_CONFIG = {
  baseUrl: '/api',
  useMocks: true,
} as const;
