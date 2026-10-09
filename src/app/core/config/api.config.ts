/**
 * Configuración de la API (backend InsForge, proyecto universalRag).
 * La URL es pública; las keys del proyecto nunca van en el frontend.
 * `useMocks` ya solo activa el backend falso del envío por WhatsApp (`whatsappMockInterceptor`,
 * features/open-wa/mocks); ponerlo en `false` cuando exista ese endpoint real.
 */
export const API_CONFIG = {
  baseUrl: 'https://fkk6yt6n.us-east.insforge.app',
  useMocks: true,
} as const;
