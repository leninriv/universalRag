/** Hoja leída del archivo: cabeceras (primera fila) y filas como texto. */
export interface SheetData {
  headers: string[];
  /** Cada fila indexada por cabecera. */
  rows: Record<string, string>[];
}

/** Destinatario del envío: teléfono tal como viene en la celda + el resto de la fila (para variables y tabla). */
export interface Recipient {
  id: string;
  phone: string;
  data: Record<string, string>;
}

export interface RecipientList {
  recipients: Recipient[];
  /** Filas sin teléfono (omitidas). */
  emptyCount: number;
  /** Filas con un teléfono repetido (omitidas; gana la primera). */
  duplicateCount: number;
}

/** Mensaje ya personalizado para un destinatario. */
export interface OutgoingMessage {
  phone: string;
  text: string;
}

/** Respuesta de `POST /whatsapp/messages` (202). */
export interface SendResult {
  jobId: string;
  queued: number;
}
