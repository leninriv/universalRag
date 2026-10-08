import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { StoredDocument } from '../models/document.model';
import { DOCUMENTS_URL, DocumentService } from './document.service';

function storedDocument(changes: Partial<StoredDocument> = {}): StoredDocument {
  return {
    id: crypto.randomUUID(),
    name: 'manual.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    status: 'indexed',
    uploadedAt: new Date().toISOString(),
    chunkCount: 1,
    errorMessage: null,
    ...changes,
  };
}

describe('DocumentService', () => {
  let service: DocumentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DocumentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deja en la cola con error los archivos inválidos sin llamar a la API', () => {
    service.upload([new File(['x'], 'programa.exe')]);

    http.expectNone(DOCUMENTS_URL);
    expect(service.uploads().length).toBe(1);
    expect(service.uploads()[0].state).toBe('error');
    expect(service.uploads()[0].errorMessage).toBe('Tipo de archivo no permitido.');
  });

  it('sube un archivo informando el progreso y lo agrega al listado', () => {
    service.upload([new File(['hola'], 'notas.txt')]);

    const req = http.expectOne({ method: 'POST', url: DOCUMENTS_URL });
    expect((req.request.body as FormData).get('file')).toEqual(jasmine.any(File));
    req.event({ type: HttpEventType.UploadProgress, loaded: 2, total: 4 });
    expect(service.uploads()[0].progress).toBe(50);

    req.flush(storedDocument({ name: 'notas.txt', status: 'processing' }), { status: 201, statusText: 'Created' });
    expect(service.uploads()).toEqual([]);
    expect(service.documents().map((doc) => doc.name)).toEqual(['notas.txt']);
  });

  it('cancelar una subida la quita de la cola y aborta la petición', () => {
    service.upload([new File(['hola'], 'notas.txt')]);
    const req = http.expectOne(DOCUMENTS_URL);

    service.cancelUpload(service.uploads()[0].id);

    expect(req.cancelled).toBeTrue();
    expect(service.uploads()).toEqual([]);
  });

  it('remove quita el documento del listado', () => {
    service.load();
    http.expectOne(DOCUMENTS_URL).flush([storedDocument({ id: 'a' }), storedDocument({ id: 'b' })]);

    service.remove('a').subscribe();
    http.expectOne({ method: 'DELETE', url: `${DOCUMENTS_URL}/a` }).flush(null, { status: 204, statusText: 'No Content' });

    expect(service.documents().map((doc) => doc.id)).toEqual(['b']);
  });

  it('refresca el listado solo mientras haya documentos procesando', fakeAsync(() => {
    service.load();
    http.expectOne(DOCUMENTS_URL).flush([storedDocument({ status: 'processing' })]);
    TestBed.tick();

    tick(3000);
    const polls = http.match(DOCUMENTS_URL);
    expect(polls.length).toBe(1);
    polls[0].flush([storedDocument({ status: 'indexed' })]);
    TestBed.tick();

    tick(10_000);
    expect(http.match(DOCUMENTS_URL).length).toBe(0);
  }));
});
