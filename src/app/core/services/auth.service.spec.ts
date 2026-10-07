import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { authGuard } from '../guards/auth.guard';
import { authTokenInterceptor } from '../interceptors/auth-token.interceptor';
import { sessionInterceptor } from '../interceptors/session.interceptor';
import { MOCK_CREDENTIALS, authMockInterceptor } from '../mocks/auth-mock.interceptor';
import { AuthService } from './auth.service';

describe('Autenticación (mock)', () => {
  let auth: AuthService;
  let captured: { authorization: string | null } | undefined;

  beforeEach(() => {
    localStorage.clear();
    captured = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(
          withInterceptors([
            authTokenInterceptor,
            sessionInterceptor,
            // Espía lo que llega a la "red" justo antes del mock.
            (req, next) => {
              captured = { authorization: req.headers.get('Authorization') };
              return next(req);
            },
            authMockInterceptor,
          ]),
        ),
      ],
    });
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => localStorage.clear());

  it('rechaza credenciales incorrectas sin crear sesión', fakeAsync(() => {
    let status: number | undefined;
    auth.login({ email: MOCK_CREDENTIALS.email, password: 'x' }).subscribe({ error: (e) => (status = e.status) });
    tick(1000);
    expect(status).toBe(401);
    expect(auth.isAuthenticated()).toBeFalse();
  }));

  it('guarda el token del login y lo envía en las peticiones siguientes', fakeAsync(() => {
    auth.login(MOCK_CREDENTIALS).subscribe();
    tick(1000);

    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.user()?.email).toBe(MOCK_CREDENTIALS.email);
    expect(captured?.authorization).toBeNull(); // el login no lleva token

    TestBed.inject(HttpClient).get('/api/ping').subscribe({ error: () => undefined });
    tick(1000);
    expect(captured?.authorization).toBe(`Bearer ${auth.getToken()}`);
  }));

  it('authGuard redirige a /login con returnUrl si no hay sesión', () => {
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/agent/1' } as never));
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/login?returnUrl=%2Fagent%2F1');
  });

  it('authGuard deja pasar con sesión iniciada', fakeAsync(() => {
    auth.login(MOCK_CREDENTIALS).subscribe();
    tick(1000);
    expect(TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/' } as never))).toBeTrue();
  }));
});
