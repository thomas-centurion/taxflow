import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from './auth-user';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global guard that makes read-only demo accounts unable to write: any method other than GET, HEAD or
 * OPTIONS is rejected before pipes, interceptors (uploads included) and controllers run. It does not
 * depend on @Roles, so routes added later without role metadata are covered as well. Public routes such
 * as POST /auth/login have no authenticated user and are not affected.
 */
@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ method: string; user?: AuthUser }>();
    if (!request.user?.readOnly || SAFE_METHODS.has(request.method.toUpperCase())) return true;
    throw new ForbiddenException('This demo account is read-only.');
  }
}
