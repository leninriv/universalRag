import { CellObject, WorkBook, WorkSheet, read, utils } from 'xlsx';

import { SheetData } from '../models/broadcast.model';
import { MAX_FILE_SIZE_BYTES, MAX_RECIPIENTS } from './limits';

const EXTENSIONS = ['xlsx', 'xls', 'csv'];

export const SPREADSHEET_ACCEPT = EXTENSIONS.map((extension) => `.${extension}`).join(',');
export const SPREADSHEET_HINT = `XLSX, XLS, CSV · máx. ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB y ${MAX_RECIPIENTS.toLocaleString('es')} filas · la primera fila son las cabeceras`;

/** Error de lectura con un mensaje apto para mostrar al usuario. */
export class SpreadsheetError extends Error {}

/** Lee el archivo en el navegador (no se sube a ningún lado). */
export async function readWorkbook(file: File): Promise<WorkBook> {
  const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  if (!EXTENSIONS.includes(extension)) {
    throw new SpreadsheetError('Tipo de archivo no permitido. Usa XLSX, XLS o CSV.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new SpreadsheetError(`El archivo supera el máximo de ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`);
  }
  try {
    // En CSV `raw` evita que los teléfonos se conviertan en números (y pierdan el "+" o los ceros iniciales).
    return extension === 'csv'
      ? read(await file.text(), { type: 'string', raw: true })
      : read(await file.arrayBuffer(), { type: 'array', cellNF: true });
  } catch {
    throw new SpreadsheetError('No se pudo leer el archivo. ¿Está dañado o protegido con contraseña?');
  }
}

/** Cabeceras y filas de una hoja. Lanza `SpreadsheetError` si está vacía o supera el máximo de filas. */
export function readSheet(workbook: WorkBook, sheetName: string): SheetData {
  const sheet = workbook.Sheets[sheetName];
  const grid = sheet ? toGrid(sheet) : [];
  const [headerRow, ...dataRows] = grid;
  if (!headerRow || dataRows.length === 0) {
    throw new SpreadsheetError('La hoja no tiene datos: la primera fila deben ser las cabeceras y debajo los registros.');
  }
  if (dataRows.length > MAX_RECIPIENTS) {
    throw new SpreadsheetError(
      `La hoja tiene ${dataRows.length.toLocaleString('es')} filas; el máximo es ${MAX_RECIPIENTS.toLocaleString('es')}.`,
    );
  }

  const headers = uniqueHeaders(headerRow);
  const rows = dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
  return { headers, rows };
}

/** Columna que parece de teléfonos, para preseleccionarla. */
export function guessPhoneColumn(headers: string[]): string | null {
  return headers.find((header) => /tel|cel|m[oó]vil|phone|whats|wsp/i.test(header)) ?? null;
}

/** Celdas como texto, sin filas vacías. */
function toGrid(sheet: WorkSheet): string[][] {
  if (!sheet['!ref']) {
    return [];
  }
  const range = utils.decode_range(sheet['!ref']);
  const grid: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      row.push(cellText(sheet[utils.encode_cell({ r, c })] as CellObject | undefined));
    }
    if (row.some(Boolean)) {
      grid.push(row);
    }
  }
  return grid;
}

/**
 * Texto de una celda. Los números enteros sin formato propio se devuelven completos (no `5,69E+10`);
 * con formato propio (p. ej. `000000000`) se respeta lo que se ve en Excel.
 */
function cellText(cell: CellObject | undefined): string {
  if (!cell || cell.v == null) {
    return '';
  }
  if (cell.t === 'n' && typeof cell.v === 'number') {
    const hasOwnFormat = cell.z != null && cell.z !== 'General';
    if (!hasOwnFormat && Number.isInteger(cell.v)) {
      return String(cell.v);
    }
    return (cell.w ?? String(cell.v)).trim();
  }
  return (cell.w ?? String(cell.v)).trim();
}

/** Cabeceras vacías → "Columna C"; repetidas → "Nombre (2)". */
function uniqueHeaders(row: string[]): string[] {
  const seen = new Map<string, number>();
  return row.map((raw, index) => {
    const base = raw.trim() || `Columna ${utils.encode_col(index)}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}
