import { LogLevel } from '@nestjs/common';

export function loggerLevels(nodeEnv: string | undefined): LogLevel[] {
  return nodeEnv === 'production' ? ['log', 'warn', 'error', 'fatal'] : ['log', 'warn', 'error', 'fatal', 'debug', 'verbose'];
}

export function trustProxySetting(value: string | undefined): boolean | number | string {
  const normalized = value?.trim() ?? '';
  if (!normalized || normalized.toLowerCase() === 'false') return false;
  if (normalized.toLowerCase() === 'true') return true;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return normalized;
}
