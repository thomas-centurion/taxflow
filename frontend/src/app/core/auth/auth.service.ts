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
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/auth/login`, credentials)
      .pipe(
        tap((response) => {
          localStorage.setItem(TOKEN_KEY, response.accessToken);
          this.userSubject.next(response.user);
        }),
      );
  }

  loadCurrentUser(refresh = false): Observable<User> {
    if (this.userSubject.value && !refresh) {
      return of(this.userSubject.value);
    }

    if (!this.token) {
      return throwError(() => new Error('No active session.'));
    }

    return this.http.get<User>(`${API_BASE_URL}/auth/me`).pipe(
      tap((user) => {
        this.userSubject.next(user);
      }),
      catchError((error: unknown) => {
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

  get isReadOnly(): boolean { return !!this.currentUser?.readOnly; }

  canWrite(...roles: User['role'][]): boolean {
    return !this.isReadOnly && this.hasRole(...roles);
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.userSubject.next(null);
  }

  logout(): void {
    const endSession = (): void => { this.clearSession(); void this.router.navigate(['/login']); };
    // la api rechaza escrituras de solo lectura, logout incluido: se cierra la sesión local
    if (this.isReadOnly) { endSession(); return; }
    this.http.post(`${API_BASE_URL}/auth/logout`, {}).pipe(
      catchError(() => of(null)),
      finalize(endSession),
    ).subscribe();
  }
}
