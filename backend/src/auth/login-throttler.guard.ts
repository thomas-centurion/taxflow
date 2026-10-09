import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  // la clave combina ip y email para no bloquear a otros usuarios de la misma red
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const rawEmail: unknown = req.body?.email;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    return `${req.ip}:${email}`;
  }
}
