import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DELETE_DOCUMENT_URL, DocumentService, INGEST_URL, LIST_DOCUMENTS_URL } from './document.service';

/** `File.text()` es asíncrono: se espera a que la petición de ingesta salga. */
const fileRead = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('DocumentService', () => {
  let service: DocumentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DocumentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga el listado desde list_documents', () => {
    service.load();
    expect(service.loading()).toBeTrue();

    http
      .expectOne({ method: 'POST', url: LIST_DOCUMENTS_URL })
      .flush([{ source: 'manual.txt', uploaded_at: '2026-10-05T10:00:00Z' }]);

    expect(service.loading()).toBeFalse();
    expect(service.documents()).toEqual([{ name: 'manual.txt', uploadedAt: '2026-10-05T10:00:00Z' }]);
  });

  it('informa el error si no se puede cargar el listado', () => {
    service.load();
    http.expectOne(LIST_DOCUMENTS_URL).flush({ error: 'No autorizado' }, { status: 401, statusText: 'Unauthorized' });

    expect(service.loadError()).toBe('No autorizado');
    expect(service.loading()).toBeFalse();
  });

  it('deja en la cola con error los archivos inválidos sin llamar a la API', () => {
    service.upload([new File(['x'], 'programa.exe')]);

    http.expectNone(INGEST_URL);
    expect(service.uploads()[0].state).toBe('error');
    expect(service.uploads()[0].errorMessage).toBe('Tipo de archivo no permitido.');
  });

  it('ingesta el texto del archivo y lo agrega al listado', async () => {
    service.upload([new File(['hola'], 'notas.txt')]);
    await fileRead();

    const req = http.expectOne({ method: 'POST', url: INGEST_URL });
    expect(req.request.body).toEqual({ text: 'hola', source: 'notas.txt' });
    req.event({ type: HttpEventType.UploadProgress, loaded: 2, total: 4 });
    expect(service.uploads()[0].progress).toBe(50);

    req.flush({ source: 'notas.txt' }, { status: 201, statusText: 'Created' });
    expect(service.uploads()).toEqual([]);
    expect(service.documents().map((doc) => doc.name)).toEqual(['notas.txt']);
  });

  it('re-ingestar un documento lo reemplaza en el listado', async () => {
    service.upload([new File(['a'], 'notas.txt')]);
    await fileRead();
    http.expectOne(INGEST_URL).flush({}, { status: 201, statusText: 'Created' });
    service.upload([new File(['b'], 'notas.txt')]);
    await fileRead();
    http.expectOne(INGEST_URL).flush({}, { status: 201, statusText: 'Created' });

    expect(service.documents().length).toBe(1);
  });

  it('muestra el error de ingest cuando la subida falla', async () => {
    service.upload([new File(['hola'], 'notas.txt')]);
    await fileRead();
    http.expectOne(INGEST_URL).flush({ error: 'Falló el embedding' }, { status: 502, statusText: 'Bad Gateway' });

    expect(service.uploads()[0].state).toBe('error');
    expect(service.uploads()[0].errorMessage).toBe('Falló el embedding');
  });

  it('cancelar una subida la quita de la cola', async () => {
    service.upload([new File(['hola'], 'notas.txt')]);
    await fileRead();
    const req = http.expectOne(INGEST_URL);

    service.cancelUpload(service.uploads()[0].id);

    expect(req.cancelled).toBeTrue();
    expect(service.uploads()).toEqual([]);
  });

  it('elimina un documento llamando a delete-document y lo quita del listado', () => {
    service.load();
    http.expectOne(LIST_DOCUMENTS_URL).flush([
      { source: 'a.txt', uploaded_at: '2026-10-05T10:00:00Z' },
      { source: 'b.txt', uploaded_at: '2026-10-04T10:00:00Z' },
    ]);

    service.remove(service.documents()[0]).subscribe();

    const req = http.expectOne({ method: 'POST', url: DELETE_DOCUMENT_URL });
    expect(req.request.body).toEqual({ source: 'a.txt' });
    req.flush({ source: 'a.txt', deleted_chunks: 3 });
    expect(service.documents().map((doc) => doc.name)).toEqual(['b.txt']);
  });
});
