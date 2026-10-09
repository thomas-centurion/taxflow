import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, isObservable, of } from 'rxjs';
import { aUser } from '../../../testing/fixtures';
import { User } from '../../shared/models/user.model';
import { AuthService } from '../auth/auth.service';
import { authGuard, loginGuard, roleGuard } from './auth.guard';

type GuardResult = boolean | UrlTree;

describe('route guards', () => {
  let session: { checkSession: () => Observable<boolean>; currentUser: User | null };
  let router: Router;

  beforeEach(() => {
    session = { checkSession: () => of(true), currentUser: aUser({ role: 'TAX_MANAGER' }) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: session }] });
    router = TestBed.inject(Router);
  });

  async function run(guard: typeof authGuard, data: Record<string, unknown> = {}): Promise<GuardResult> {
    const route = { data } as unknown as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => guard(route, {} as RouterStateSnapshot));
    return (isObservable(result) ? await firstValueFrom(result) : result) as GuardResult;
  }

  const url = (result: GuardResult) => (result instanceof UrlTree ? router.serializeUrl(result) : result);

  it('authGuard lets valid sessions in and sends everyone else to /login', async () => {
    expect(await run(authGuard)).toBe(true);
    session.checkSession = () => of(false);
    expect(url(await run(authGuard))).toBe('/login');
  });

  it('loginGuard sends authenticated users to the app', async () => {
    expect(url(await run(loginGuard))).toBe('/app');
    session.checkSession = () => of(false);
    expect(await run(loginGuard)).toBe(true);
  });

  it('roleGuard only lets the configured roles in', async () => {
    expect(await run(roleGuard, { roles: ['ADMIN', 'TAX_MANAGER'] })).toBe(true);
    expect(url(await run(roleGuard, { roles: ['ADMIN'] }))).toBe('/app');
    expect(await run(roleGuard)).toBe(true);
    session.currentUser = null;
    expect(url(await run(roleGuard, { roles: ['ADMIN'] }))).toBe('/app');
  });

  it('roleGuard admits read-only demo accounts only on routes opened to them', async () => {
    const auditRoute = { roles: ['ADMIN', 'TAX_MANAGER'], allowReadOnly: true };
    session.currentUser = aUser({ role: 'ANALYST', readOnly: true });
    expect(await run(roleGuard, auditRoute)).toBe(true);
    expect(url(await run(roleGuard, { roles: ['ADMIN'] }))).toBe('/app');

    session.currentUser = aUser({ role: 'ANALYST', readOnly: false });
    expect(url(await run(roleGuard, auditRoute))).toBe('/app');
  });
});
