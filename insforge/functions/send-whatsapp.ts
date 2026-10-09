/**
 * Edge function `send-whatsapp` (Deno, InsForge).
 *
 * POST /functions/send-whatsapp
 * Authorization: Bearer <token de un usuario con sesión iniciada>
 * Body: { "phone": string, "text": string }
 *
 * `phone` va con código de país (ej. "593998129299" o "+593 99 812 9299"); la función deja solo los
 * dígitos, cambia el 0 inicial por 593 (Ecuador: "0998129299" → "593998129299") y le agrega "@c.us". Envía el texto por la API externa de OpenWA.
 *
 * La API externa a veces responde 500 aunque el mensaje sí se envía: un 5xx se registra en el log y se
 * responde 202 `{ status: 'sent', confirmed: false }` (sin error para la pantalla). Un 4xx o un fallo de
 * red sí es un error real (502).
 */
import { createClient } from 'npm:@insforge/sdk@1.5.2';

const OPENWA_URL = 'https://openwa-dashboard.lab.octagonsolutionserver.com/api/sessions';
const MAX_TEXT_CHARS = 4096;

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
  const sessionId = Deno.env.get('WHATSAPP_SESSION_ID');
  const whatsappKey = Deno.env.get('WHATSAPP_API_KEY');
  if (!baseUrl || !sessionId || !whatsappKey) {
    return json({ error: 'Faltan los secrets INSFORGE_BASE_URL, WHATSAPP_SESSION_ID o WHATSAPP_API_KEY.' }, 500);
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

  const rawPhone = typeof body.phone === 'string' || typeof body.phone === 'number' ? String(body.phone).replace(/\D/g, '') : '';
  // Número local de Ecuador (0998129299) → con código de país (593998129299).
  const phone = rawPhone.startsWith('0') ? `593${rawPhone.slice(1)}` : rawPhone;
  if (phone.length < 8 || phone.length > 15) {
    return json({ error: '`phone` es obligatorio: número con código de país (8 a 15 dígitos).' }, 400);
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > MAX_TEXT_CHARS) {
    return json({ error: `\`text\` es obligatorio (máx. ${MAX_TEXT_CHARS} caracteres).` }, 400);
  }

  let response: Response;
  try {
    response = await fetch(`${OPENWA_URL}/${encodeURIComponent(sessionId)}/messages/send-text`, {
      method: 'POST',
      headers: { 'x-api-key': whatsappKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: `${phone}@c.us`, text }),
    });
  } catch (error) {
    console.error('send-whatsapp: no se pudo contactar la API externa', error);
    return json({ error: 'No se pudo contactar el servicio de WhatsApp.' }, 502);
  }

  if (response.ok) {
    return json({ status: 'sent', confirmed: true, phone }, 202);
  }

  const detail = await response.text().catch(() => '');
  console.error(`send-whatsapp: la API externa respondió ${response.status}`, detail.slice(0, 500));
  if (response.status >= 500) {
    // La API externa responde 500 aunque el mensaje se envía: no se propaga como error.
    return json({ status: 'sent', confirmed: false, phone }, 202);
  }
  return json({ error: 'El servicio de WhatsApp rechazó el mensaje.' }, 502);
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
