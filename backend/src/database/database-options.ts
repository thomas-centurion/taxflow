import { readFileSync } from 'node:fs';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { entities } from './entities';
import { migrations } from './migrations';

export function createDatabaseOptions(
  environment: NodeJS.ProcessEnv = process.env,
  registeredEntities = entities,
  registeredMigrations = migrations,
): PostgresConnectionOptions {
  const port = Number(environment.DATABASE_PORT ?? '5432');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DATABASE_PORT must be an integer between 1 and 65535.');
  const username = environment.DATABASE_USER;
  const password = environment.DATABASE_PASSWORD;
  if (!username || !password) throw new Error('DATABASE_USER and DATABASE_PASSWORD must be set.');
  return {
    type: 'postgres', host: environment.DATABASE_HOST || 'localhost', port, username, password,
    database: environment.DATABASE_NAME || 'taxflow', entities: registeredEntities, migrations: registeredMigrations,
    migrationsTableName: 'typeorm_migrations', synchronize: false, uuidExtension: 'pgcrypto',
    // Production images have no ts-node: the app applies pending migrations on startup when enabled.
    migrationsRun: isEnabled(environment.DATABASE_MIGRATIONS_RUN),
    ssl: sslOptions(environment),
  };
}

/**
 * TLS for managed PostgreSQL. The server certificate and host name are always verified: against the
 * CA in DATABASE_SSL_CA / DATABASE_SSL_CA_FILE when set (providers with a private CA, such as Supabase),
 * otherwise against the public CAs trusted by Node.js. There is deliberately no option to skip verification.
 */
function sslOptions(environment: NodeJS.ProcessEnv): PostgresConnectionOptions['ssl'] {
  const ca = certificateAuthority(environment);
  if (!isEnabled(environment.DATABASE_SSL)) {
    if (ca) throw new Error('DATABASE_SSL_CA / DATABASE_SSL_CA_FILE require DATABASE_SSL=true.');
    return false;
  }
  return ca ? { ca, rejectUnauthorized: true } : true;
}

function certificateAuthority(environment: NodeJS.ProcessEnv): string | undefined {
  const inline = environment.DATABASE_SSL_CA?.trim();
  const file = environment.DATABASE_SSL_CA_FILE?.trim();
  if (inline && file) throw new Error('Set only one of DATABASE_SSL_CA and DATABASE_SSL_CA_FILE.');
  let pem: string;
  if (inline) {
    // Single-line environment values may carry the PEM line breaks as a literal backslash-n.
    pem = inline.replace(/\\n/g, '\n');
  } else if (file) {
    try {
      pem = readFileSync(file, 'utf8');
    } catch {
      throw new Error('DATABASE_SSL_CA_FILE could not be read.');
    }
  } else {
    return undefined;
  }
  if (!pem.includes('-----BEGIN CERTIFICATE-----')) throw new Error('The database CA must be a PEM certificate (-----BEGIN CERTIFICATE-----).');
  return pem;
}

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}
