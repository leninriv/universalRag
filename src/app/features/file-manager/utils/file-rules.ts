/** Tipos de archivo que se pueden cargar (texto plano: `ingest` recibe texto, aún no extrae PDF/DOCX/XLSX), con su etiqueta e ícono (Material Symbols). */
const FILE_TYPES: Record<string, { label: string; icon: string }> = {
  txt: { label: 'TXT', icon: 'article' },
  md: { label: 'MD', icon: 'article' },
  csv: { label: 'CSV', icon: 'table_chart' },
};

const UNKNOWN_TYPE = { label: 'Archivo', icon: 'draft' };

export const UPLOAD_RULES = {
  extensions: Object.keys(FILE_TYPES),
  maxSizeBytes: 200_000,
} as const;

/** Valor del atributo `accept` del `<input type="file">`. */
export const ACCEPT_ATTR = UPLOAD_RULES.extensions.map((extension) => `.${extension}`).join(',');

/** Texto de ayuda con los tipos y el tamaño permitidos. */
export const UPLOAD_HINT = `${UPLOAD_RULES.extensions.map((extension) => extension.toUpperCase()).join(', ')} · máx. ${UPLOAD_RULES.maxSizeBytes / 1000} KB`;

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function fileTypeOf(name: string): { label: string; icon: string } {
  return FILE_TYPES[fileExtension(name)] ?? UNKNOWN_TYPE;
}

/** Devuelve el motivo por el que no se puede cargar el archivo, o `null` si es válido. Se valida por extensión: el MIME de md/csv no es confiable. */
export function validateFile(file: Pick<File, 'name' | 'size'>): string | null {
  if (!UPLOAD_RULES.extensions.includes(fileExtension(file.name))) {
    return 'Tipo de archivo no permitido.';
  }
  if (file.size > UPLOAD_RULES.maxSizeBytes) {
    return `Supera el máximo de ${UPLOAD_RULES.maxSizeBytes / 1000} KB.`;
  }
  if (file.size === 0) {
    return 'El archivo está vacío.';
  }
  return null;
}
