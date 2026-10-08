import { HttpClient, HttpEventType, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { StoredDocument } from '../models/document.model';
import { DOCUMENTS_URL } from '../services/document.service';
import { MOCK_FAILING_NAME, documentsMockInterceptor } from './documents-mock.interceptor';

describe('documentsMockInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([documentsMockInterceptor]))],
    });
    http = TestBed.inject(HttpClient);
  });

  function list(): StoredDocument[] {
    let docs: StoredDocument[] = [];
    http.get<StoredDocument[]>(DOCUMENTS_URL).subscribe((result) => (docs = result));
    tick(1000);
    return docs;
  }

  function upload(file: File): { progress: number[]; doc?: StoredDocument } {
    const result: { progress: number[]; doc?: StoredDocument } = { progress: [] };
    const body = new FormData();
    body.append('file', file);
    http.post<StoredDocument>(DOCUMENTS_URL, body, { reportProgress: true, observe: 'events' }).subscribe((event) => {
      if (event.type === HttpEventType.UploadProgress) {
        result.progress.push(event.loaded);
      } else if (event.type === HttpEventType.Response) {
        result.doc = event.body ?? undefined;
      }
    });
    tick(5000);
    return result;
  }

  it('sube con progreso y el documento pasa de procesando a indexado', fakeAsync(() => {
    const { progress, doc } = upload(new File(['contenido'], 'notas-mock.txt'));

    expect(progress.length).toBeGreaterThan(1);
    expect(doc?.status).toBe('processing');

    tick(5000);
    const indexed = list().find((current) => current.id === doc?.id);
    expect(indexed?.status).toBe('indexed');
    expect(indexed?.chunkCount).toBeGreaterThan(0);
  }));

  it(`un archivo con "${MOCK_FAILING_NAME}" en el nombre falla y al reprocesarlo se indexa`, fakeAsync(() => {
    const { doc } = upload(new File(['contenido'], `reporte-${MOCK_FAILING_NAME}.md`));
    tick(5000);
    expect(list().find((current) => current.id === doc?.id)?.status).toBe('error');

    http.post<StoredDocument>(`${DOCUMENTS_URL}/${doc?.id}/reprocess`, null).subscribe();
    tick(6000);
    expect(list().find((current) => current.id === doc?.id)?.status).toBe('indexed');
  }));

  it('rechaza tipos no permitidos con 400', fakeAsync(() => {
    let status: number | undefined;
    const body = new FormData();
    body.append('file', new File(['x'], 'programa.exe'));
    http.post(DOCUMENTS_URL, body).subscribe({ error: (error) => (status = error.status) });
    tick(1000);

    expect(status).toBe(400);
  }));
});
