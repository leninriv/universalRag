/** Documento ingestado en la base de conocimiento (un elemento por `source`, de `list_documents`). */
export interface StoredDocument {
  /** Nombre del archivo, usado como `source` al ingestar. */
  name: string;
  /** Fecha de la última carga en ISO 8601. */
  uploadedAt: string;
}

/** Archivo en la cola de subida (aún no es un documento). */
export interface UploadItem {
  id: string;
  file: File;
  /** Porcentaje enviado (0–100). */
  progress: number;
  state: 'uploading' | 'error';
  errorMessage: string | null;
}
