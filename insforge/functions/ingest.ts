/**
 * Edge function `ingest` (Deno, InsForge).
 *
 * POST /functions/ingest
 * Authorization: Bearer <token de un usuario con sesión iniciada>
 * Body: { "text": string, "source": string, "chunk_tokens"?: number, "overlap_tokens"?: number }
 *
 * Parte el texto en chunks de hasta 500 tokens con overlap, genera sus embeddings con
 * openai/text-embedding-3-small (model gateway / OpenRouter) y los guarda en public.documents.
 * Volver a ingestar el mismo `source` reemplaza sus chunks anteriores.
 */
import { createAdminClient, createClient } from 'npm:@insforge/sdk@1.5.2';
import { Tiktoken } from 'npm:js-tiktoken@1.0.21/lite';
import cl100k_base from 'npm:js-tiktoken@1.0.21/ranks/cl100k_base';

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_CHUNK_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 100;
const MAX_TEXT_CHARS = 200_000;
const MAX_SOURCE_CHARS = 300;
const EMBEDDING_BATCH_SIZE = 64;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// cl100k_base es el tokenizer de text-embedding-3-small: los conteos coinciden con los del modelo.
const tokenizer = new Tiktoken(cl100k_base);
const countTokens = (text: string): number => tokenizer.encode(text).length;

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
  if (!apiKey || !baseUrl) {
    return json({ error: 'Faltan los secrets API_KEY o INSFORGE_BASE_URL.' }, 500);
  }
  if (!(await isLoggedIn(req, baseUrl))) {
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

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const source = typeof body.source === 'string' ? body.source.trim() : '';
  if (!text) {
    return json({ error: '`text` es obligatorio.' }, 400);
  }
  if (text.length > MAX_TEXT_CHARS) {
    return json({ error: `\`text\` supera el máximo de ${MAX_TEXT_CHARS} caracteres.` }, 413);
  }
  if (!source || source.length > MAX_SOURCE_CHARS) {
    return json({ error: `\`source\` es obligatorio (máx. ${MAX_SOURCE_CHARS} caracteres).` }, 400);
  }

  const chunkTokens = clampInt(body.chunk_tokens, 50, 2000, DEFAULT_CHUNK_TOKENS);
  const overlapTokens = clampInt(body.overlap_tokens, 0, Math.floor(chunkTokens / 2), DEFAULT_OVERLAP_TOKENS);

  try {
    const chunks = chunkText(text, chunkTokens, overlapTokens);
    // Primero los embeddings (lo que más puede fallar), luego se reemplazan los chunks.
    const embeddings = await createEmbeddings(chunks.map((chunk) => chunk.content), openRouterKey);

    const db = createAdminClient({ baseUrl, apiKey });
    const { error: deleteError } = await db.database.from('documents').delete().eq('source', source);
    if (deleteError) {
      throw new Error(`No se pudieron borrar los chunks anteriores: ${deleteError.message}`);
    }

    const rows = chunks.map((chunk, index) => ({
      source,
      chunk_index: index,
      content: chunk.content,
      token_count: chunk.tokenCount,
      embedding: embeddings[index],
      embedding_model: EMBEDDING_MODEL,
    }));
    const { data, error: insertError } = await db.database
      .from('documents')
      .insert(rows)
      .select('id, chunk_index, token_count');
    if (insertError) {
      throw new Error(`No se pudieron guardar los chunks: ${insertError.message}`);
    }

    return json(
      {
        source,
        embedding_model: EMBEDDING_MODEL,
        chunk_tokens: chunkTokens,
        overlap_tokens: overlapTokens,
        total_tokens: countTokens(text),
        chunks: data,
      },
      201,
    );
  } catch (error) {
    console.error('ingest failed', error);
    return json({ error: error instanceof Error ? error.message : 'Error inesperado.' }, 502);
  }
}

// ---------------------------------------------------------------------------
// Chunking por tokens respetando oraciones
// ---------------------------------------------------------------------------

interface Unit {
  text: string;
  tokens: number;
  /** Primera oración de un párrafo: se une con salto de párrafo en vez de espacio. */
  paragraphStart: boolean;
}

interface Chunk {
  content: string;
  tokenCount: number;
}

/**
 * Agrupa oraciones en chunks de hasta `maxTokens`. Cada chunk empieza con el final del anterior
 * (hasta `overlapTokens`) para no perder contexto en los cortes.
 */
function chunkText(text: string, maxTokens: number, overlapTokens: number): Chunk[] {
  const chunks: Chunk[] = [];
  let window: Unit[] = [];
  let windowTokens = 0;

  const flush = () => {
    const content = window
      .map((unit, index) => (index === 0 ? '' : unit.paragraphStart ? '\n\n' : ' ') + unit.text)
      .join('');
    chunks.push({ content, tokenCount: countTokens(content) });
  };

  // Las oraciones largas se cortan a `maxTokens - overlapTokens` para que siempre quepa el overlap.
  for (const unit of splitIntoUnits(text, maxTokens - overlapTokens)) {
    if (window.length > 0 && windowTokens + unit.tokens > maxTokens) {
      flush();
      window = overlapTail(window, overlapTokens);
      windowTokens = window.reduce((sum, carried) => sum + carried.tokens, 0);
      while (window.length > 0 && windowTokens + unit.tokens > maxTokens) {
        windowTokens -= window.shift()!.tokens;
      }
    }
    window.push(unit);
    windowTokens += unit.tokens;
  }
  if (window.length > 0) {
    flush();
  }
  return chunks;
}

/**
 * Final del chunk anterior que se repite al inicio del siguiente: oraciones completas mientras
 * quepan en `overlapTokens`; si ni la última cabe entera, sus últimas palabras.
 */
function overlapTail(window: Unit[], overlapTokens: number): Unit[] {
  const tail: Unit[] = [];
  let tailTokens = 0;
  for (let i = window.length - 1; i >= 0 && tailTokens + window[i].tokens <= overlapTokens; i--) {
    tail.unshift(window[i]);
    tailTokens += window[i].tokens;
  }
  if (tail.length > 0 || overlapTokens === 0) {
    return tail;
  }

  const words = window[window.length - 1].text.split(' ');
  let text = '';
  for (let i = words.length - 1; i >= 0; i--) {
    const candidate = text ? `${words[i]} ${text}` : words[i];
    if (countTokens(candidate) > overlapTokens) {
      break;
    }
    text = candidate;
  }
  return text ? [{ text, tokens: countTokens(text), paragraphStart: false }] : [];
}

function splitIntoUnits(text: string, maxTokens: number): Unit[] {
  const units: Unit[] = [];
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    const sentences = (paragraph.match(/[^.!?…]+(?:[.!?…]+["'”’»)\]]*)?/g) ?? [paragraph])
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    sentences.forEach((sentence, sentenceIndex) => {
      splitOversized(sentence, maxTokens).forEach((piece, pieceIndex) => {
        units.push({
          text: piece,
          tokens: countTokens(piece),
          paragraphStart: sentenceIndex === 0 && pieceIndex === 0,
        });
      });
    });
  }
  return units;
}

/** Corta por palabras una oración que por sí sola supera `maxTokens`. */
function splitOversized(sentence: string, maxTokens: number): string[] {
  if (countTokens(sentence) <= maxTokens) {
    return [sentence];
  }
  const pieces: string[] = [];
  let current = '';
  for (const word of sentence.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && countTokens(candidate) > maxTokens) {
      pieces.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    pieces.push(current);
  }
  return pieces;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createEmbeddings(inputs: string[], openRouterKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let start = 0; start < inputs.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = inputs.slice(start, start + EMBEDDING_BATCH_SIZE);
    const response = await fetch(`${OPENROUTER_URL}/embeddings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${openRouterKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });
    if (!response.ok) {
      throw new Error(`Model gateway respondió ${response.status} al generar embeddings: ${await response.text()}`);
    }
    const payload: { data: { index: number; embedding: number[] }[] } = await response.json();
    const ordered = [...payload.data].sort((a, b) => a.index - b.index);
    if (ordered.length !== batch.length) {
      throw new Error('El model gateway devolvió una cantidad inesperada de embeddings.');
    }
    embeddings.push(...ordered.map((item) => item.embedding));
  }
  return embeddings;
}

/** Solo usuarios con sesión: el anon key y la API key no tienen usuario asociado. */
async function isLoggedIn(req: Request, baseUrl: string): Promise<boolean> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) {
    return false;
  }
  const { data } = await createClient({ baseUrl, accessToken: token }).auth.getCurrentUser();
  return Boolean(data?.user?.id);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(Math.max(number, min), max);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
