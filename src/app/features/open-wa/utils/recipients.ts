import { OutgoingMessage, Recipient, RecipientList, SheetData } from '../models/broadcast.model';

const VARIABLE_PATTERN = /\{\{\s*(.+?)\s*\}\}/g;

/**
 * Destinatarios a partir de la columna de teléfono. El teléfono se envía tal cual (solo sin espacios en los
 * extremos); para detectar duplicados se ignoran espacios, guiones, puntos y paréntesis. Gana la primera fila.
 */
export function buildRecipients(sheet: SheetData, phoneColumn: string): RecipientList {
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  let emptyCount = 0;
  let duplicateCount = 0;

  sheet.rows.forEach((row, index) => {
    const phone = (row[phoneColumn] ?? '').trim();
    if (!phone) {
      emptyCount++;
      return;
    }
    const key = phone.replace(/[\s\-.()]/g, '');
    if (seen.has(key)) {
      duplicateCount++;
      return;
    }
    seen.add(key);
    recipients.push({ id: String(index), phone, data: row });
  });

  return { recipients, emptyCount, duplicateCount };
}

/** Reemplaza `{{Columna}}` por el valor del destinatario (vacío si la celda está vacía). */
export function renderMessage(template: string, data: Record<string, string>): string {
  return template.replace(VARIABLE_PATTERN, (_, name: string) => data[name] ?? '');
}

/** Variables usadas en el mensaje que no son columnas del archivo. */
export function unknownVariables(template: string, headers: string[]): string[] {
  const known = new Set(headers);
  const names = [...template.matchAll(VARIABLE_PATTERN)].map((match) => match[1]);
  return [...new Set(names)].filter((name) => !known.has(name));
}

export function buildMessages(template: string, recipients: Recipient[]): OutgoingMessage[] {
  return recipients.map((recipient) => ({ phone: recipient.phone, text: renderMessage(template, recipient.data) }));
}
