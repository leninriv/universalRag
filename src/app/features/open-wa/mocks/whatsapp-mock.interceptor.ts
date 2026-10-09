import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, mergeMap, of, throwError, timer } from 'rxjs';

import { OutgoingMessage, SendResult } from '../models/broadcast.model';
import { WHATSAPP_MESSAGES_URL } from '../services/whatsapp.service';
import { MAX_MESSAGE_LENGTH, MAX_RECIPIENTS } from '../utils/limits';

const MOCK_LATENCY_MS = 1200;

/**
 * Backend falso del envío por WhatsApp hasta que exista la API real (se activa con `API_CONFIG.useMocks`).
 * Contrato:
 *
 * - `POST /whatsapp/messages` con `{ messages: [{ phone, text }] }` (texto ya personalizado, máx. 5.000 mensajes
 *   de hasta 4.096 caracteres) → 202 `{ jobId, queued }`: los mensajes quedan en cola y el backend los envía.
 * - 400 `{ message }` si la lista está vacía, supera el máximo o algún mensaje no es válido.
 */
export const whatsappMockInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url !== WHATSAPP_MESSAGES_URL || req.method !== 'POST') {
    return next(req);
  }

  const messages = (req.body as { messages?: OutgoingMessage[] } | null)?.messages;
  const invalid = validate(messages);
  if (invalid) {
    return timer(MOCK_LATENCY_MS).pipe(
      mergeMap(() =>
        throwError(() => new HttpErrorResponse({ status: 400, url: req.url, error: { message: invalid } })),
      ),
    );
  }

  const body: SendResult = { jobId: crypto.randomUUID(), queued: messages!.length };
  return of(new HttpResponse({ status: 202, url: req.url, body })).pipe(delay(MOCK_LATENCY_MS));
};

function validate(messages: OutgoingMessage[] | undefined): string | null {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'No hay mensajes para enviar.';
  }
  if (messages.length > MAX_RECIPIENTS) {
    return `El máximo es ${MAX_RECIPIENTS} mensajes por envío.`;
  }
  const bad = messages.find(
    (message) => !message.phone?.trim() || !message.text?.trim() || message.text.length > MAX_MESSAGE_LENGTH,
  );
  return bad ? `Mensaje no válido para ${bad.phone || '(sin teléfono)'}.` : null;
}
