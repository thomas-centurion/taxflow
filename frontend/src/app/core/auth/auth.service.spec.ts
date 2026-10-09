import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { aUser } from '../../../testing/fixtures';
import { API_BASE_URL } from '../config/api.config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: { navigate } }],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('stores the token and the user after a successful login', async () => {
    const user = aUser({ role: 'ADMIN' });
    const login = firstValueFrom(auth.login({ email: user.email, password: 'secret' }));
    const request = http.expectOne(`${API_BASE_URL}/auth/login`);
    expect(request.request.method).toBe('POST');
    request.flush({ accessToken: 'jwt-token', tokenType: 'Bearer', user });
    await login;

    expect(auth.token).toBe('jwt-token');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.currentUser).toEqual(user);
    expect(auth.hasRole('ADMIN', 'TAX_MANAGER')).toBe(true);
    expect(auth.hasRole('ANALYST')).toBe(false);
  });

  it('reports no session without a token and never calls the API', async () => {
    expect(await firstValueFrom(auth.checkSession())).toBe(false);
    http.expectNone(`${API_BASE_URL}/auth/me`);
  });

  it('restores the session from a stored token', async () => {
    localStorage.setItem('taxflow.accessToken', 'stored-token');
    const session = firstValueFrom(auth.checkSession());
    http.expectOne(`${API_BASE_URL}/auth/me`).flush(aUser());
    expect(await session).toBe(true);
    expect(auth.currentUser?.email).toBe('manager@taxflow.local');

    // The user is cached: a second check does not hit the API again.
    expect(await firstValueFrom(auth.checkSession())).toBe(true);
    http.expectNone(`${API_BASE_URL}/auth/me`);
  });

  it('clears an invalid stored session', async () => {
    localStorage.setItem('taxflow.accessToken', 'expired-token');
    const session = firstValueFrom(auth.checkSession());
    http.expectOne(`${API_BASE_URL}/auth/me`).flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    expect(await session).toBe(false);
    expect(auth.token).toBeNull();
    expect(auth.currentUser).toBeNull();
  });

  it('logs out locally and goes to the login page even when the API call fails', () => {
    localStorage.setItem('taxflow.accessToken', 'jwt-token');
    auth.logout();
    http.expectOne(`${API_BASE_URL}/auth/logout`).flush(null, { status: 500, statusText: 'Server Error' });
    expect(auth.token).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('logs out locally when the backend answers 403', () => {
    localStorage.setItem('taxflow.accessToken', 'jwt-token');
    auth.logout();
    http.expectOne(`${API_BASE_URL}/auth/logout`).flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    expect(auth.token).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  async function signIn(user: ReturnType<typeof aUser>): Promise<void> {
    const login = firstValueFrom(auth.login({ email: user.email, password: 'secret' }));
    http.expectOne(`${API_BASE_URL}/auth/login`).flush({ accessToken: 'jwt-token', tokenType: 'Bearer', user });
    await login;
  }

  it('flags read-only demo accounts and never grants them write actions', async () => {
    await signIn(aUser({ role: 'TAX_MANAGER', readOnly: true }));
    expect(auth.isReadOnly).toBe(true);
    expect(auth.hasRole('TAX_MANAGER')).toBe(true);
    expect(auth.canWrite('ADMIN', 'TAX_MANAGER')).toBe(false);
  });

  it('keeps write actions for regular accounts', async () => {
    await signIn(aUser({ role: 'TAX_MANAGER', readOnly: false }));
    expect(auth.isReadOnly).toBe(false);
    expect(auth.canWrite('ADMIN', 'TAX_MANAGER')).toBe(true);
    expect(auth.canWrite('ADMIN')).toBe(false);
  });

  it('ends a read-only session locally without calling the logout endpoint', async () => {
    await signIn(aUser({ role: 'ANALYST', readOnly: true }));
    auth.logout();
    http.expectNone(`${API_BASE_URL}/auth/logout`);
    expect(auth.token).toBeNull();
    expect(auth.currentUser).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
