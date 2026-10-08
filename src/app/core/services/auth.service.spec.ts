import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { API_CONFIG } from '../config/api.config';
import { authGuard } from '../guards/auth.guard';
import { authTokenInterceptor } from '../interceptors/auth-token.interceptor';
import { sessionInterceptor } from '../interceptors/session.interceptor';
import { AuthService, LOGIN_URL } from './auth.service';

const CREDENTIALS = { email: 'ana@example.com', password: 'secreto1' };

/** JWT de prueba que vence dentro de una hora. */
function fakeToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `h.${btoa(JSON.stringify({ exp }))}.s`;
}

const LOGIN_RESPONSE = {
  accessToken: fakeToken(),
  user: { id: 'u1', email: CREDENTIALS.email, emailVerified: true, profile: { name: 'Ana' } },
};

describe('Autenticación (InsForge)', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authTokenInterceptor, sessionInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('rechaza credenciales incorrectas sin crear sesión', () => {
    let status: number | undefined;
    auth.login(CREDENTIALS).subscribe({ error: (e) => (status = e.status) });
    http.expectOne(LOGIN_URL).flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('envía método y credenciales a /api/auth/sessions y guarda la sesión', () => {
    auth.login(CREDENTIALS).subscribe();
    const req = http.expectOne(`${API_CONFIG.baseUrl}/api/auth/sessions`);
    expect(req.request.body).toEqual({ method: 'password', ...CREDENTIALS });
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush(LOGIN_RESPONSE);

    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.user()).toEqual({ id: 'u1', email: CREDENTIALS.email, name: 'Ana' });
  });

  it('envía el token en las peticiones siguientes a la API', () => {
    auth.login(CREDENTIALS).subscribe();
    http.expectOne(LOGIN_URL).flush(LOGIN_RESPONSE);

    TestBed.inject(HttpClient).get(`${API_CONFIG.baseUrl}/functions/ask`).subscribe();
    const req = http.expectOne(`${API_CONFIG.baseUrl}/functions/ask`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${LOGIN_RESPONSE.accessToken}`);
    req.flush({});
  });

  it('cierra la sesión ante un 401 en otra petición de la API', () => {
    auth.login(CREDENTIALS).subscribe();
    http.expectOne(LOGIN_URL).flush(LOGIN_RESPONSE);

    TestBed.inject(HttpClient).get(`${API_CONFIG.baseUrl}/functions/ask`).subscribe({ error: () => undefined });
    http.expectOne(`${API_CONFIG.baseUrl}/functions/ask`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('authGuard redirige a /login con returnUrl si no hay sesión', () => {
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/agent/1' } as never));
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/login?returnUrl=%2Fagent%2F1');
  });

  it('authGuard deja pasar con sesión iniciada', () => {
    auth.login(CREDENTIALS).subscribe();
    http.expectOne(LOGIN_URL).flush(LOGIN_RESPONSE);
    expect(TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/' } as never))).toBeTrue();
  });
});
