import { Injectable, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Normalizes a comma-separated email list: trimmed, lower-cased, empty entries ignored. */
export function parseEmailList(value: string | undefined): ReadonlySet<string> {
  return new Set((value ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}

/**
 * Accounts configured in DEMO_READ_ONLY_EMAILS (public portfolio demo). They can read everything their
 * role allows but every write is rejected by DemoReadOnlyGuard. Empty or unset means no such accounts.
 */
@Injectable()
export class ReadOnlyAccounts {
  private readonly emails: ReadonlySet<string>;

  constructor(config: ConfigService) {
    this.emails = parseEmailList(config.get<string>('DEMO_READ_ONLY_EMAILS'));
  }

  isReadOnly(email: string): boolean {
    return this.emails.has(email.trim().toLowerCase());
  }
}

export const ALLOW_READ_ONLY_DEMO_KEY = 'allowReadOnlyDemo';
/**
 * Lets read-only demo accounts use a route their role would not reach (e.g. audit logs), in addition to
 * the roles in @Roles. Writes stay blocked for them by DemoReadOnlyGuard.
 */
export const AllowReadOnlyDemo = (): MethodDecorator & ClassDecorator => SetMetadata(ALLOW_READ_ONLY_DEMO_KEY, true);
