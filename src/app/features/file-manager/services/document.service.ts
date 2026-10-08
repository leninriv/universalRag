import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subscription, map, switchMap, tap, timer } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api.config';
import { StoredDocument, UploadItem } from '../models/document.model';
import { validateFile } from '../utils/file-rules';

/** Recurso de documentos de la API (ver el contrato en `mocks/documents-mock.interceptor.ts`). */
export const DOCUMENTS_URL = `${API_CONFIG.baseUrl}/documents`;

/** Cada cuánto se refresca el listado mientras haya documentos indexándose. */
const POLL_INTERVAL_MS = 3000;

/**
 * Documentos de la base de conocimiento: listado, cola de subidas y acciones.
 * Mientras algún documento esté en `processing` refresca el listado periódicamente.
 */
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

  private readonly hasProcessing = computed(() => this.documentsState().some((doc) => doc.status === 'processing'));

  constructor() {
    toObservable(this.hasProcessing)
      .pipe(
        switchMap((active) => (active ? timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.fetch(false));
  }

  /** Carga el listado mostrando el estado de carga. */
  load(): void {
    this.fetch(true);
  }

  /** Sube los archivos en paralelo. Los inválidos quedan en la cola con su error, sin llamar a la API. */
  upload(files: File[]): void {
    for (const file of files) {
      const item: UploadItem = { id: crypto.randomUUID(), file, progress: 0, state: 'uploading', errorMessage: null };
      const invalid = validateFile(file);
      if (invalid) {
        this.uploadsState.update((items) => [...items, { ...item, state: 'error', errorMessage: invalid }]);
        continue;
      }

      this.uploadsState.update((items) => [...items, item]);
      const body = new FormData();
      body.append('file', file, file.name);

      const subscription = this.http
        .post<StoredDocument>(DOCUMENTS_URL, body, { reportProgress: true, observe: 'events' })
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress) {
              const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
              this.patchUpload(item.id, { progress });
            } else if (event.type === HttpEventType.Response && event.body) {
              this.upsert(event.body);
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

  remove(id: string): Observable<void> {
    return this.http
      .delete<void>(`${DOCUMENTS_URL}/${id}`)
      .pipe(tap(() => this.documentsState.update((docs) => docs.filter((doc) => doc.id !== id))));
  }

  /** Vuelve a indexar un documento (p. ej. si falló). */
  reprocess(id: string): Observable<StoredDocument> {
    return this.http.post<StoredDocument>(`${DOCUMENTS_URL}/${id}/reprocess`, null).pipe(tap((doc) => this.upsert(doc)));
  }

  /** Descarga el archivo original. */
  download(doc: StoredDocument): Observable<void> {
    return this.http
      .get(`${DOCUMENTS_URL}/${doc.id}/download`, { responseType: 'blob' })
      .pipe(map((blob) => saveBlob(blob, doc.name)));
  }

  private fetch(showLoading: boolean): void {
    if (showLoading) {
      this.loading.set(true);
      this.loadError.set(null);
    }
    this.http.get<StoredDocument[]>(DOCUMENTS_URL).subscribe({
      next: (docs) => {
        this.documentsState.set(docs);
        this.loadError.set(null);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(errorMessage(error, 'No se pudieron cargar los documentos.'));
        this.loading.set(false);
      },
    });
  }

  /** Reemplaza el documento con el mismo id o, si no existe, lo agrega al inicio. */
  private upsert(doc: StoredDocument): void {
    this.documentsState.update((docs) =>
      docs.some((current) => current.id === doc.id)
        ? docs.map((current) => (current.id === doc.id ? doc : current))
        : [doc, ...docs],
    );
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
  const message = error instanceof HttpErrorResponse ? (error.error as { message?: unknown } | null)?.message : null;
  return typeof message === 'string' ? message : fallback;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Se libera después de que el navegador tomó la descarga.
  setTimeout(() => URL.revokeObjectURL(url));
}
