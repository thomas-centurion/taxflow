import { LogLevel } from '@nestjs/common';

/** Production keeps operational logs only; development and test also show debug output. */
export function loggerLevels(nodeEnv: string | undefined): LogLevel[] {
  return nodeEnv === 'production' ? ['log', 'warn', 'error', 'fatal'] : ['log', 'warn', 'error', 'fatal', 'debug', 'verbose'];
}

/**
 * Express "trust proxy" setting from TRUST_PROXY. Behind a reverse proxy (the Docker nginx, a load
 * balancer) it must be enabled so req.ip is the client address, which the login rate limit relies on.
 * Accepts a hop count ("1"), "true", or an Express address list ("loopback, 10.0.0.0/8"). Unset or
 * "false" keeps it disabled, the right default when the API is reached directly.
 */
export function trustProxySetting(value: string | undefined): boolean | number | string {
  const normalized = value?.trim() ?? '';
  if (!normalized || normalized.toLowerCase() === 'false') return false;
  if (normalized.toLowerCase() === 'true') return true;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return normalized;
}
