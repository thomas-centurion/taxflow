import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.checkSession().pipe(map((valid) => valid ? true : router.parseUrl('/login')));
};

export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.checkSession().pipe(
    map((valid) => valid ? router.parseUrl('/app') : true),
    catchError(() => of(true)),
  );
};

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = route.data['roles'] as string[] | undefined;
  return !roles?.length || (auth.currentUser && roles.includes(auth.currentUser.role))
    ? true
    : router.parseUrl('/app');
};