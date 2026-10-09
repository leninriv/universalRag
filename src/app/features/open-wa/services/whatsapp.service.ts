import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api.config';
import { OutgoingMessage, SendResult } from '../models/broadcast.model';

/** Envío masivo por WhatsApp (ver el contrato en `mocks/whatsapp-mock.interceptor.ts`). */
export const WHATSAPP_MESSAGES_URL = `${API_CONFIG.baseUrl}/whatsapp/messages`;

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private readonly http = inject(HttpClient);

  /** Encola los mensajes ya personalizados; el backend los envía. */
  send(messages: OutgoingMessage[]): Observable<SendResult> {
    return this.http.post<SendResult>(WHATSAPP_MESSAGES_URL, { messages });
  }
}
