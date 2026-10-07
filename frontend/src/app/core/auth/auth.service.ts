import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, finalize, map, of, tap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthResponse, LoginCredentials } from '../../shared/models/auth.model';
import { User } from '../../shared/models/user.model';

const TOKEN_KEY = 'taxflow.accessToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly userSubject = new BehaviorSubject<User | null>(null);
  readonly user$ = this.userSubject.asObservable();

  get token(): string | null { return localStorage.getItem(TOKEN_KEY); }
  get currentUser(): User | null { return this.userSubject.value; }
  get isAuthenticated(): boolean { return !!this.token; }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    console.log('[AUTH] login() llamado');
    console.trace('[AUTH] origen de login()');

    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/auth/login`, credentials)
      .pipe(
        tap((response) => {
          console.log('[AUTH] login() respondió correctamente');
          localStorage.setItem(TOKEN_KEY, response.accessToken);
          this.userSubject.next(response.user);
        }),
      );
  }

  loadCurrentUser(refresh = false): Observable<User> {
    console.log('[AUTH] loadCurrentUser() llamado', { refresh });
    console.trace('[AUTH] origen de loadCurrentUser()');

    if (this.userSubject.value && !refresh) {
      return of(this.userSubject.value);
    }

    if (!this.token) {
      return throwError(() => new Error('No active session.'));
    }

    return this.http.get<User>(`${API_BASE_URL}/auth/me`).pipe(
      tap((user) => {
        console.log('[AUTH] /auth/me respondió correctamente');
        this.userSubject.next(user);
      }),
      catchError((error: unknown) => {
        console.error('[AUTH] /auth/me falló', error);
        this.clearSession();
        return throwError(() => error);
      }),
    );
  }

  checkSession(): Observable<boolean> {
    if (!this.token) return of(false);
    return this.loadCurrentUser().pipe(map(() => true), catchError(() => of(false)));
  }

  hasRole(...roles: User['role'][]): boolean {
    return !!this.currentUser && roles.includes(this.currentUser.role);
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.userSubject.next(null);
  }

  logout(): void {
    this.http.post(`${API_BASE_URL}/auth/logout`, {}).pipe(
      catchError(() => of(null)),
      finalize(() => { this.clearSession(); void this.router.navigate(['/login']); }),
    ).subscribe();
  }
}
