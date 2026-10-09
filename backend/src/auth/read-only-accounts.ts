import { Injectable, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function parseEmailList(value: string | undefined): ReadonlySet<string> {
  return new Set((value ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}

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
export const AllowReadOnlyDemo = (): MethodDecorator & ClassDecorator => SetMetadata(ALLOW_READ_ONLY_DEMO_KEY, true);
