/**
 * Edge function `list-chats` (Deno, InsForge).
 *
 * POST /functions/list-chats
 * Authorization: Bearer <token de un usuario con sesión iniciada>
 * Body (opcional): { "page_size"?: number (1-100, por defecto 20), "before_cursor"?: string }
 *
 * Lista los chats del usuario en sesión, del más reciente al más antiguo. La consulta corre con el
 * token del usuario (RPC `list_chats` + RLS), así que nunca devuelve chats de otra persona.
 * Responde { chats: [{ id, title, created_at, updated_at }], has_more, next_cursor }; para la
 * página siguiente se envía `next_cursor` como `before_cursor`.
 */
import { createClient } from 'npm:@insforge/sdk@1.5.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido. Usa POST.' }, 405);
  }

  const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
  if (!baseUrl) {
    return json({ error: 'Falta el secret INSFORGE_BASE_URL.' }, 500);
  }

  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const client = createClient({ baseUrl, accessToken: token });
  const { data: session } = token ? await client.auth.getCurrentUser() : { data: null };
  if (!session?.user?.id) {
    return json({ error: 'No autorizado: inicia sesión y envía tu token de acceso.' }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return json({ error: 'El cuerpo debe ser JSON.' }, 400);
  }

  const pageSize = body.page_size ?? 20;
  if (typeof pageSize !== 'number' || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return json({ error: '`page_size` debe ser un entero entre 1 y 100.' }, 400);
  }
  const cursor = body.before_cursor ?? null;
  if (cursor !== null && typeof cursor !== 'string') {
    return json({ error: '`before_cursor` debe ser texto.' }, 400);
  }

  const { data, error } = await client.database.rpc('list_chats', { page_size: pageSize, before_cursor: cursor });
  if (error) {
    console.error('list_chats failed', error);
    const invalidCursor = /cursor/i.test(error.message);
    return json({ error: invalidCursor ? '`before_cursor` inválido.' : 'No se pudo cargar el historial.' }, invalidCursor ? 400 : 502);
  }
  return json(data);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
