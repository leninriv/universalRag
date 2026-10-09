import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subscription, from, map, switchMap, tap } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api.config';
import { StoredDocument, UploadItem } from '../models/document.model';
import { validateFile } from '../utils/file-rules';

/** Edge function `ingest`: recibe `{ text, source }`, genera los chunks y sus embeddings. */
export const INGEST_URL = `${API_CONFIG.baseUrl}/functions/ingest`;
/** Edge function `delete-document`: recibe `{ source }` y borra todos los chunks de ese documento. */
export const DELETE_DOCUMENT_URL = `${API_CONFIG.baseUrl}/functions/delete-document`;
/** RPC `list_documents`: un elemento por `source`, los más recientes primero. */
export const LIST_DOCUMENTS_URL = `${API_CONFIG.baseUrl}/api/database/rpc/list_documents`;

interface ListedDocument {
  source: string;
  uploaded_at: string;
}

/** Documentos de la base de conocimiento: listado y cola de subidas (ingesta). */
@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly uploadSubscriptions = new Map<string, Subscription>();

  private readonly documentsState = signal<StoredDocument[]>([]);
  private readonly uploadsState = signal<UploadItem[]>([]);

  readonly documents = this.documentsState.asReadonly();
  readonly uploads = this.uploadsState.asReadonly();
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  /** Carga el listado mostrando el estado de carga. */
  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.http.post<ListedDocument[]>(LIST_DOCUMENTS_URL, {}).subscribe({
      next: (docs) => {
        this.documentsState.set(docs.map((doc) => ({ name: doc.source, uploadedAt: doc.uploaded_at })));
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(errorMessage(error, 'No se pudieron cargar los documentos.'));
        this.loading.set(false);
      },
    });
  }

  /** Ingesta los archivos en paralelo. Los inválidos quedan en la cola con su error, sin llamar a la API. */
  upload(files: File[]): void {
    for (const file of files) {
      const item: UploadItem = { id: crypto.randomUUID(), file, progress: 0, state: 'uploading', errorMessage: null };
      const invalid = validateFile(file);
      if (invalid) {
        this.uploadsState.update((items) => [...items, { ...item, state: 'error', errorMessage: invalid }]);
        continue;
      }

      this.uploadsState.update((items) => [...items, item]);
      const subscription = from(file.text())
        .pipe(
          switchMap((text) =>
            this.http.post(INGEST_URL, { text, source: file.name }, { reportProgress: true, observe: 'events' }),
          ),
        )
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress) {
              const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
              this.patchUpload(item.id, { progress });
            } else if (event.type === HttpEventType.Response) {
              this.upsert({ name: file.name, uploadedAt: new Date().toISOString() });
              this.removeUpload(item.id);
            }
          },
          error: (error: unknown) => {
            this.uploadSubscriptions.delete(item.id);
            this.patchUpload(item.id, { state: 'error', errorMessage: errorMessage(error, 'No se pudo cargar el archivo.') });
          },
        });
      this.uploadSubscriptions.set(item.id, subscription);
    }
  }

  /** Cancela una subida en curso. */
  cancelUpload(id: string): void {
    this.removeUpload(id);
  }

  /** Quita de la cola una subida que falló. */
  dismissUpload(id: string): void {
    this.removeUpload(id);
  }

  /** Elimina el documento y todos sus fragmentos de la base de conocimiento. */
  remove(doc: StoredDocument): Observable<void> {
    return this.http.post(DELETE_DOCUMENT_URL, { source: doc.name }).pipe(
      tap(() => this.documentsState.update((docs) => docs.filter((current) => current.name !== doc.name))),
      map(() => undefined),
    );
  }

  /** Reemplaza el documento con el mismo nombre (re-ingestar lo reemplaza) o, si no existe, lo agrega al inicio. */
  private upsert(doc: StoredDocument): void {
    this.documentsState.update((docs) => [doc, ...docs.filter((current) => current.name !== doc.name)]);
  }

  private patchUpload(id: string, changes: Partial<UploadItem>): void {
    this.uploadsState.update((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  private removeUpload(id: string): void {
    this.uploadSubscriptions.get(id)?.unsubscribe();
    this.uploadSubscriptions.delete(id);
    this.uploadsState.update((items) => items.filter((item) => item.id !== id));
  }
}

function errorMessage(error: unknown, fallback: string): string {
  const body = error instanceof HttpErrorResponse ? (error.error as { error?: unknown; message?: unknown } | null) : null;
  const message = body?.error ?? body?.message;
  return typeof message === 'string' ? message : fallback;
}
