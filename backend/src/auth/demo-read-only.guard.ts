import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from './auth-user';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ method: string; user?: AuthUser }>();
    // corre antes que pipes y controllers, así que también cubre rutas sin roles declarados
    if (!request.user?.readOnly || SAFE_METHODS.has(request.method.toUpperCase())) return true;
    throw new ForbiddenException('This demo account is read-only.');
  }
}
