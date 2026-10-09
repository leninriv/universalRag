/**
 * Edge function `delete-document` (Deno, InsForge).
 *
 * POST /functions/delete-document
 * Authorization: Bearer <token de un usuario con sesión iniciada>
 * Body: { "source": string }
 *
 * Elimina de public.documents todos los chunks del `source` indicado (el documento completo).
 * Responde { source, deleted_chunks }; 404 si no existía ningún chunk con ese `source`.
 */
import { createAdminClient, createClient } from 'npm:@insforge/sdk@1.5.2';

const MAX_SOURCE_CHARS = 300;

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

  const apiKey = Deno.env.get('API_KEY');
  const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
  if (!apiKey || !baseUrl) {
    return json({ error: 'Faltan los secrets API_KEY o INSFORGE_BASE_URL.' }, 500);
  }
  if (!(await isLoggedIn(req, baseUrl))) {
    return json({ error: 'No autorizado: inicia sesión y envía tu token de acceso.' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'El cuerpo debe ser JSON.' }, 400);
  }

  const source = typeof body.source === 'string' ? body.source.trim() : '';
  if (!source || source.length > MAX_SOURCE_CHARS) {
    return json({ error: `\`source\` es obligatorio (máx. ${MAX_SOURCE_CHARS} caracteres).` }, 400);
  }

  try {
    const db = createAdminClient({ baseUrl, apiKey });
    const { data, error } = await db.database.from('documents').delete().eq('source', source).select('id');
    if (error) {
      throw new Error(`No se pudo eliminar el documento: ${error.message}`);
    }
    if (!data || data.length === 0) {
      return json({ error: `No existe un documento con source «${source}».` }, 404);
    }
    return json({ source, deleted_chunks: data.length });
  } catch (error) {
    console.error('delete-document failed', error);
    return json({ error: error instanceof Error ? error.message : 'Error inesperado.' }, 502);
  }
}

async function isLoggedIn(req: Request, baseUrl: string): Promise<boolean> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) {
    return false;
  }
  const { data } = await createClient({ baseUrl, accessToken: token }).auth.getCurrentUser();
  return Boolean(data?.user?.id);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
