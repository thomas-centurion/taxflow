import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: { token: string | null; clearSession: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    session = { token: 'jwt-token', clearSession: vi.fn() };
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: session },
        { provide: Router, useValue: { navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('sends the access token as a Bearer header', () => {
    http.get('/api/companies').subscribe();
    expect(backend.expectOne('/api/companies').request.headers.get('Authorization')).toBe('Bearer jwt-token');
  });

  it('sends no Authorization header without a session', () => {
    session.token = null;
    http.get('/api/health').subscribe();
    expect(backend.expectOne('/api/health').request.headers.has('Authorization')).toBe(false);
  });

  it('ends the session and redirects to login when the API answers 401', async () => {
    const request = firstValueFrom(http.get('/api/companies'));
    backend.expectOne('/api/companies').flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    await expect(request).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(session.clearSession).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('keeps the login page in charge of its own 401 (wrong credentials)', async () => {
    const request = firstValueFrom(http.post('/api/auth/login', {}));
    backend.expectOne('/api/auth/login').flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    await expect(request).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(session.clearSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not end the session on other errors', async () => {
    const request = firstValueFrom(http.get('/api/companies'));
    backend.expectOne('/api/companies').flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await expect(request).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(session.clearSession).not.toHaveBeenCalled();
  });
});
