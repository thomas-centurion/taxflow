import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limits POST /auth/login per client IP and attempted email, so one account cannot be brute forced
 * and users sharing an IP do not lock each other out. Guards run before validation pipes, so the raw body
 * is normalized here the same way LoginDto normalizes the email.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const rawEmail: unknown = req.body?.email;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    return `${req.ip}:${email}`;
  }
}
