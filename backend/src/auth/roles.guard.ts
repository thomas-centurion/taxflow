import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from './auth-user';
import { ALLOW_READ_ONLY_DEMO_KEY } from './read-only-accounts';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from '../users/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) return false;
    if (requiredRoles.includes(user.role)) return true;
    // Read-only demo accounts may also use routes explicitly opened to them; DemoReadOnlyGuard blocks their writes.
    return !!user.readOnly && this.reflector.getAllAndOverride<boolean>(ALLOW_READ_ONLY_DEMO_KEY, [context.getHandler(), context.getClass()]) === true;
  }
}