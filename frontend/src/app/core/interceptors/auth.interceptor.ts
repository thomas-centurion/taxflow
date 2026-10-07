import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  console.log('[HTTP] →', request.method, request.url);

  const token = auth.token;

  const outgoing = token
    ? request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : request;

  console.log(
    '[HTTP] → enviado',
    outgoing.method,
    outgoing.url,
    token ? '(con JWT)' : '(sin JWT)',
  );

  return next(outgoing).pipe(
    tap({
      next: (event) => {
        if (event.type === 4) {
          console.log(
            '[HTTP] ←',
            outgoing.method,
            outgoing.url,
            event.status,
          );
        }
      },
      error: (error) => {
        console.error(
          '[HTTP] ❌',
          outgoing.method,
          outgoing.url,
          error,
        );
      },
    }),

    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !request.url.endsWith('/auth/login')
      ) {
        console.log(
          '[HTTP] 401 → limpiando sesión y navegando a /login',
        );

        auth.clearSession();
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    }),
  );
};