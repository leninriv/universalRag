/** Estado de indexación de un documento en la base de conocimiento (RAG). */
export type DocumentStatus = 'processing' | 'indexed' | 'error';

/** Documento cargado, tal como lo devuelve la API (`GET /documents`). */
export interface StoredDocument {
  id: string;
  name: string;
  mimeType: string;
  /** Tamaño en bytes. */
  size: number;
  status: DocumentStatus;
  /** Fecha de carga en ISO 8601. */
  uploadedAt: string;
  /** Cantidad de fragmentos indexados (`null` mientras no esté indexado). */
  chunkCount: number | null;
  errorMessage: string | null;
}

/** Archivo en la cola de subida (aún no es un documento). */
export interface UploadItem {
  id: string;
  file: File;
  /** Porcentaje subido (0–100). */
  progress: number;
  state: 'uploading' | 'error';
  errorMessage: string | null;
}
