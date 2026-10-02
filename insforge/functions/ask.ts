/**
 * Edge function `ask` (Deno, InsForge).
 *
 * POST /functions/ask
 * Authorization: Bearer <token de un usuario autenticado | API_KEY del proyecto>
 * Body: { "question": string }
 *
 * Genera el embedding de la pregunta, recupera los 5 chunks más similares con match_documents y
 * le pide a un LLM del model gateway que responda solo con ese contexto. Devuelve la respuesta y
 * las fuentes usadas.
 */
import { createAdminClient, createClient } from 'npm:@insforge/sdk@1.5.2';

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const DEFAULT_CHAT_MODEL = 'openai/gpt-4o-mini';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const MATCH_COUNT = 5;
const MAX_QUESTION_CHARS = 2000;
const EXCERPT_CHARS = 240;
const NOT_FOUND_ANSWER = 'No tengo esa información en mis documentos';

const SYSTEM_PROMPT = `Eres un asistente que responde preguntas usando ÚNICAMENTE la información del contexto.
Reglas:
- Usa solo los fragmentos del contexto. No uses conocimiento propio ni inventes datos.
- Si la respuesta no está en el contexto, responde exactamente: "${NOT_FOUND_ANSWER}" y nada más.
- Responde en español, de forma clara y concisa.`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface Match {
  id: number;
  source: string;
  chunk_index: number;
  content: string;
  score: number;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido. Usa POST.' }, 405);
  }

  const apiKey = Deno.env.get('API_KEY');
  const baseUrl = Deno.env.get('INSFORGE_BASE_URL');
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  const chatModel = Deno.env.get('OPENROUTER_CHAT_MODEL') || DEFAULT_CHAT_MODEL;
  if (!apiKey || !baseUrl) {
    return json({ error: 'Faltan los secrets API_KEY o INSFORGE_BASE_URL.' }, 500);
  }

  // Cada pregunta consume créditos del model gateway: solo usuarios autenticados o la API key.
  if (!(await isAuthorized(req, baseUrl, apiKey))) {
    return json({ error: 'No autorizado: envía el token de un usuario autenticado o la API key.' }, 401);
  }
  if (!openRouterKey) {
    return json({ error: 'Falta el secret OPENROUTER_API_KEY (model gateway).' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'El cuerpo debe ser JSON.' }, 400);
  }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > MAX_QUESTION_CHARS) {
    return json({ error: `\`question\` es obligatoria (máx. ${MAX_QUESTION_CHARS} caracteres).` }, 400);
  }

  try {
    const queryEmbedding = await createEmbedding(question, openRouterKey);

    const db = createAdminClient({ baseUrl, apiKey });
    const { data, error } = await db.database.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: MATCH_COUNT,
    });
    if (error) {
      throw new Error(`Falló la búsqueda de documentos: ${error.message}`);
    }
    const matches = (data ?? []) as Match[];

    if (matches.length === 0) {
      return json({ answer: NOT_FOUND_ANSWER, found: false, model: null, sources: [] });
    }

    const answer = await createAnswer(question, matches, chatModel, openRouterKey);
    const found = !normalize(answer).includes(normalize(NOT_FOUND_ANSWER));

    return json({
      answer,
      found,
      model: chatModel,
      sources: found
        ? matches.map((match) => ({
            id: match.id,
            source: match.source,
            chunk_index: match.chunk_index,
            score: Number(match.score.toFixed(4)),
            excerpt: excerpt(match.content),
          }))
        : [],
    });
  } catch (error) {
    console.error('ask failed', error);
    return json({ error: error instanceof Error ? error.message : 'Error inesperado.' }, 502);
  }
}

async function isAuthorized(req: Request, baseUrl: string, apiKey: string): Promise<boolean> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) {
    return false;
  }
  if (safeEqual(token, apiKey)) {
    return true;
  }
  // El anon key no tiene usuario asociado, así que no pasa esta verificación.
  const client = createClient({ baseUrl, accessToken: token });
  const { data } = await client.auth.getCurrentUser();
  return Boolean(data?.user?.id);
}

async function createEmbedding(input: string, openRouterKey: string): Promise<number[]> {
  const payload = await openRouter<{ data: { embedding: number[] }[] }>(
    '/embeddings',
    { model: EMBEDDING_MODEL, input },
    openRouterKey,
  );
  return payload.data[0].embedding;
}

async function createAnswer(
  question: string,
  matches: Match[],
  model: string,
  openRouterKey: string,
): Promise<string> {
  const context = matches
    .map((match, index) => `[${index + 1}] (fuente: ${match.source}, fragmento ${match.chunk_index})\n${match.content}`)
    .join('\n\n');

  const payload = await openRouter<{ choices: { message: { content: string | null } }[] }>(
    '/chat/completions',
    {
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Contexto:\n${context}\n\nPregunta: ${question}` },
      ],
    },
    openRouterKey,
  );
  return payload.choices[0]?.message?.content?.trim() || NOT_FOUND_ANSWER;
}

async function openRouter<T>(path: string, body: unknown, openRouterKey: string): Promise<T> {
  const response = await fetch(`${OPENROUTER_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Model gateway respondió ${response.status} en ${path}: ${await response.text()}`);
  }
  return response.json();
}

/** Minúsculas, sin acentos ni puntuación, para comparar la respuesta "no encontrada". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function excerpt(content: string): string {
  return content.length > EXCERPT_CHARS ? `${content.slice(0, EXCERPT_CHARS).trimEnd()}…` : content;
}

/** Comparación en tiempo constante para no filtrar la API key por timing. */
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
