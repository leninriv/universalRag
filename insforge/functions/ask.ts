/**
 * Edge function `ask` (Deno, InsForge).
 *
 * POST /functions/ask
 * Authorization: Bearer <token de un usuario con sesión iniciada>
 * Body: { "question": string, "chat_id"?: uuid }
 *
 * Genera el embedding de la pregunta, recupera los 5 chunks más similares con match_documents y
 * le pide a un LLM del model gateway que responda solo con ese contexto. Devuelve la respuesta y
 * las fuentes usadas.
 *
 * La pregunta y la respuesta se guardan en el historial del usuario: en `chat_id` si se envía
 * (debe ser suyo) o en un chat nuevo.
 */
import { createAdminClient, createClient } from 'npm:@insforge/sdk@1.5.2';

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const DEFAULT_CHAT_MODEL = 'openai/gpt-4o-mini';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const MATCH_COUNT = 5;
const MAX_QUESTION_CHARS = 2000;
const EXCERPT_CHARS = 240;
const TITLE_CHARS = 60;
const NOT_FOUND_ANSWER = 'No tengo esa información en mis documentos';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

interface Source {
  id: number;
  source: string;
  chunk_index: number;
  score: number;
  excerpt: string;
}

interface RagAnswer {
  answer: string;
  found: boolean;
  model: string | null;
  sources: Source[];
}

interface User {
  id: string;
  token: string;
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

  const user = await currentUser(req, baseUrl);
  if (!user) {
    return json({ error: 'No autorizado: inicia sesión y envía tu token de acceso.' }, 401);
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

  const chatId = body.chat_id ?? null;
  if (chatId !== null && (typeof chatId !== 'string' || !UUID_PATTERN.test(chatId))) {
    return json({ error: '`chat_id` debe ser un UUID.' }, 400);
  }
  // Se valida antes de llamar al LLM para no gastar créditos en un chat ajeno o inexistente.
  if (chatId && !(await ownsChat(baseUrl, user.token, chatId))) {
    return json({ error: 'Chat no encontrado.' }, 404);
  }

  const db = createAdminClient({ baseUrl, apiKey });

  let rag: RagAnswer;
  try {
    rag = await answerQuestion(question, db, chatModel, openRouterKey);
  } catch (error) {
    console.error('ask failed', error);
    return json({ error: error instanceof Error ? error.message : 'Error inesperado.' }, 502);
  }

  // Pregunta y respuesta se guardan juntas (una transacción): nunca queda una sin la otra.
  const { data, error } = await db.database.rpc('save_chat_exchange', {
    p_owner_id: user.id,
    p_chat_id: chatId,
    p_question: question,
    p_answer: rag.answer,
    p_sources: rag.sources,
    p_model: rag.model,
    p_title: toTitle(question),
  });
  if (error) {
    console.error('save_chat_exchange failed', error);
    return json({ error: `No se pudo guardar el mensaje en el chat: ${error.message}`, ...rag }, 500);
  }

  return json({ ...rag, ...(data as Record<string, unknown>) }, chatId ? 200 : 201);
}

// ---------------------------------------------------------------------------
// RAG
// ---------------------------------------------------------------------------

async function answerQuestion(
  question: string,
  db: ReturnType<typeof createAdminClient>,
  chatModel: string,
  openRouterKey: string,
): Promise<RagAnswer> {
  const queryEmbedding = await createEmbedding(question, openRouterKey);

  const { data, error } = await db.database.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: MATCH_COUNT,
  });
  if (error) {
    throw new Error(`Falló la búsqueda de documentos: ${error.message}`);
  }
  const matches = (data ?? []) as Match[];

  if (matches.length === 0) {
    return { answer: NOT_FOUND_ANSWER, found: false, model: null, sources: [] };
  }

  const answer = await createAnswer(question, matches, chatModel, openRouterKey);
  const found = !normalize(answer).includes(normalize(NOT_FOUND_ANSWER));

  return {
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
  };
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

// ---------------------------------------------------------------------------
// Auth y chats
// ---------------------------------------------------------------------------

/** Solo usuarios con sesión: el anon key y la API key no tienen usuario asociado. */
async function currentUser(req: Request, baseUrl: string): Promise<User | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) {
    return null;
  }
  const { data } = await createClient({ baseUrl, accessToken: token }).auth.getCurrentUser();
  return data?.user?.id ? { id: data.user.id, token } : null;
}

/** Consulta con el token del usuario: RLS solo deja ver sus propios chats. */
async function ownsChat(baseUrl: string, token: string, chatId: string): Promise<boolean> {
  const { data, error } = await createClient({ baseUrl, accessToken: token })
    .database.from('chats')
    .select('id')
    .eq('id', chatId)
    .limit(1);
  return !error && Array.isArray(data) && data.length === 1;
}

/** Título del chat a partir de la primera pregunta, cortado en una palabra completa. */
function toTitle(question: string): string {
  const singleLine = question.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= TITLE_CHARS) {
    return singleLine;
  }
  const cut = singleLine.slice(0, TITLE_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > TITLE_CHARS / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Minúsculas, sin acentos ni puntuación, para comparar la respuesta "no encontrada". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function excerpt(content: string): string {
  return content.length > EXCERPT_CHARS ? `${content.slice(0, EXCERPT_CHARS).trimEnd()}…` : content;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
