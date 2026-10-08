/**
 * Configuración de la API (backend InsForge, proyecto universalRag).
 * La URL es pública; las keys del proyecto nunca van en el frontend.
 * El login ya usa el backend real; `useMocks` solo activa el backend falso
 * `documentsMockInterceptor` (features/file-manager/mocks) mientras no exista la API de documentos.
 */
export const API_CONFIG = {
  baseUrl: 'https://fkk6yt6n.us-east.insforge.app',
  useMocks: true,
} as const;
