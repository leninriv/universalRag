import {
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, concat, delay, interval, map, mergeMap, of, take, throwError, timer } from 'rxjs';

import { StoredDocument } from '../models/document.model';
import { DOCUMENTS_URL } from '../services/document.service';
import { UPLOAD_RULES, fileExtension, validateFile } from '../utils/file-rules';

/** Un archivo cuyo nombre contiene este texto falla al indexarse la primera vez (para probar "Reprocesar"). */
export const MOCK_FAILING_NAME = 'error';

const MOCK_LATENCY_MS = 500;
const PROCESSING_MS = 5000;
const UPLOAD_STEPS = 10;
const UPLOAD_BYTES_PER_MS = 2000;
const BYTES_PER_CHUNK = 4000;
const DAY_MS = 24 * 60 * 60 * 1000;
const INDEX_ERROR = 'No se pudo extraer el texto del documento.';

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

interface MockEntry {
  doc: StoredDocument;
  /** Contenido que devuelve la descarga. */
  blob: Blob;
  /** Momento en que termina la indexación simulada. */
  readyAt: number;
  /** Si la indexación en curso termina en error. */
  failNext: boolean;
}

// Se crea con la primera petición para que el documento "procesando" de ejemplo se vea avanzar.
let store: MockEntry[] | null = null;

/**
 * Backend falso de `/documents` hasta que exista la API real (se activa con `API_CONFIG.useMocks`).
 * Va al final de la cadena de interceptores, igual que `authMockInterceptor`. Contrato:
 *
 * - `GET    /documents`               → `StoredDocument[]` (más recientes primero)
 * - `POST   /documents`               → multipart con `file`; 201 `StoredDocument` en `processing` (con eventos de progreso).
 *                                       400/413 si el archivo no es válido. Un archivo con el mismo nombre reemplaza
 *                                       al anterior, como `source` en la función `ingest`.
 * - `DELETE /documents/:id`           → 204
 * - `GET    /documents/:id/download`  → `Blob` con el archivo original
 * - `POST   /documents/:id/reprocess` → `StoredDocument` en `processing`; 409 si ya se está procesando
 *
 * La indexación se simula sin timers: cada documento queda en `processing` unos segundos y, al consultarlo
 * después, pasa a `indexed` (o a `error` si su nombre contiene `MOCK_FAILING_NAME`, solo el primer intento).
 */
export const documentsMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url !== DOCUMENTS_URL && !req.url.startsWith(`${DOCUMENTS_URL}/`)) {
    return next(req);
  }

  const [id, action] = req.url.slice(DOCUMENTS_URL.length).split('/').filter(Boolean);
  if (!id) {
    if (req.method === 'GET') {
      return respond(listDocuments());
    }
    if (req.method === 'POST') {
      return upload(req);
    }
    return fail(req, 405, 'Método no permitido.');
  }

  const entry = entries().find((current) => current.doc.id === id);
  if (!entry) {
    return fail(req, 404, 'El documento no existe.');
  }
  resolveStatus(entry);

  if (req.method === 'DELETE' && !action) {
    store = entries().filter((current) => current !== entry);
    return respond(null, 204);
  }
  if (req.method === 'GET' && action === 'download') {
    return respond(entry.blob);
  }
  if (req.method === 'POST' && action === 'reprocess') {
    if (entry.doc.status === 'processing') {
      return fail(req, 409, 'El documento ya se está procesando.');
    }
    entry.doc = { ...entry.doc, status: 'processing', chunkCount: null, errorMessage: null };
    entry.readyAt = Date.now() + PROCESSING_MS;
    return respond(entry.doc);
  }
  return fail(req, 404, 'Ruta no encontrada.');
};

function entries(): MockEntry[] {
  return (store ??= createSeedEntries());
}

function listDocuments(): StoredDocument[] {
  const all = entries();
  all.forEach((entry) => resolveStatus(entry));
  return all.map((entry) => entry.doc).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** Termina la indexación simulada si ya pasó su tiempo. */
function resolveStatus(entry: MockEntry): void {
  if (entry.doc.status !== 'processing' || Date.now() < entry.readyAt) {
    return;
  }
  entry.doc = entry.failNext
    ? { ...entry.doc, status: 'error', errorMessage: INDEX_ERROR }
    : { ...entry.doc, status: 'indexed', chunkCount: chunkCountFor(entry.doc.size) };
  entry.failNext = false;
}

function upload(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
  const file = req.body instanceof FormData ? req.body.get('file') : null;
  if (!(file instanceof File)) {
    return fail(req, 400, 'Falta el archivo (campo `file`).');
  }
  const invalid = validateFile(file);
  if (invalid) {
    return fail(req, file.size > UPLOAD_RULES.maxSizeBytes ? 413 : 400, invalid);
  }

  const durationMs = Math.min(Math.max(file.size / UPLOAD_BYTES_PER_MS, 1000), 4000);
  const progress$ = interval(durationMs / UPLOAD_STEPS).pipe(
    take(UPLOAD_STEPS),
    map(
      (step): HttpEvent<unknown> => ({
        type: HttpEventType.UploadProgress,
        loaded: Math.round((file.size * (step + 1)) / UPLOAD_STEPS),
        total: file.size,
      }),
    ),
  );
  // El documento se crea al final: si se cancela la subida antes, no queda nada guardado.
  const response$ = timer(MOCK_LATENCY_MS).pipe(map(() => new HttpResponse({ status: 201, url: req.url, body: saveUpload(file) })));

  return concat(of<HttpEvent<unknown>>({ type: HttpEventType.Sent }), progress$, response$);
}

function saveUpload(file: File): StoredDocument {
  const existing = entries().find((entry) => entry.doc.name === file.name);
  const entry: MockEntry = {
    doc: {
      id: existing?.doc.id ?? crypto.randomUUID(),
      name: file.name,
      mimeType: file.type || mimeTypeOf(file.name),
      size: file.size,
      status: 'processing',
      uploadedAt: new Date().toISOString(),
      chunkCount: null,
      errorMessage: null,
    },
    blob: file,
    readyAt: Date.now() + PROCESSING_MS,
    failNext: file.name.toLowerCase().includes(MOCK_FAILING_NAME),
  };
  store = [entry, ...entries().filter((current) => current !== existing)];
  return entry.doc;
}

function respond<T>(body: T, status = 200): Observable<HttpEvent<T>> {
  return of(new HttpResponse({ status, body })).pipe(delay(MOCK_LATENCY_MS));
}

function fail(req: HttpRequest<unknown>, status: number, message: string): Observable<never> {
  return timer(MOCK_LATENCY_MS).pipe(
    mergeMap(() => throwError(() => new HttpErrorResponse({ status, url: req.url, error: { message } }))),
  );
}

function chunkCountFor(size: number): number {
  return Math.max(1, Math.ceil(size / BYTES_PER_CHUNK));
}

function mimeTypeOf(name: string): string {
  return MIME_TYPES[fileExtension(name)] ?? 'application/octet-stream';
}

function createSeedEntries(): MockEntry[] {
  const seed: [name: string, sizeKb: number, daysAgo: number, status: StoredDocument['status']][] = [
    ['Tarifas de envío 2026.csv', 42, 0, 'processing'],
    ['nebula-logistica.txt', 6, 0.2, 'indexed'],
    ['Contrato de proveedores.pdf', 1240, 0.5, 'indexed'],
    ['Política de vacaciones.docx', 340, 1, 'indexed'],
    ['Inventario de bodegas Q3.xlsx', 860, 2, 'error'],
    ['Manual de soporte técnico.pdf', 4820, 4, 'indexed'],
    ['Preguntas frecuentes de clientes.md', 18, 6, 'indexed'],
    ['Procedimiento de devoluciones.docx', 210, 9, 'indexed'],
    ['Rutas de reparto zona norte.xlsx', 1530, 15, 'indexed'],
    ['Guía de onboarding.pdf', 2760, 21, 'indexed'],
    ['Glosario logístico.md', 24, 33, 'indexed'],
    ['Reporte de incidencias septiembre.csv', 96, 40, 'indexed'],
  ];

  const now = Date.now();
  return seed.map(([name, sizeKb, daysAgo, status]) => {
    const size = sizeKb * 1024;
    return {
      doc: {
        id: crypto.randomUUID(),
        name,
        mimeType: mimeTypeOf(name),
        size,
        status,
        uploadedAt: new Date(now - daysAgo * DAY_MS).toISOString(),
        chunkCount: status === 'indexed' ? chunkCountFor(size) : null,
        errorMessage: status === 'error' ? INDEX_ERROR : null,
      },
      // Los documentos de ejemplo no tienen archivo real: la descarga devuelve un texto de muestra.
      blob: new Blob([`Documento de ejemplo (mock): ${name}\n`], { type: 'text/plain' }),
      readyAt: now + 8000,
      failNext: false,
    };
  });
}
