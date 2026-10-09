import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api.config';

/** Edge function `send-whatsapp`: recibe `{ phone, text }` (el backend normaliza el número y agrega `@c.us`). */
export const SEND_WHATSAPP_URL = `${API_CONFIG.baseUrl}/functions/send-whatsapp`;

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private readonly http = inject(HttpClient);

  /** Envía un mensaje de WhatsApp a un número. */
  sendText(phone: string, text: string): Observable<{ status: 'sent'; confirmed: boolean; phone: string }> {
    return this.http.post<{ status: 'sent'; confirmed: boolean; phone: string }>(SEND_WHATSAPP_URL, { phone, text });
  }
}
