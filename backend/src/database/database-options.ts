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


    // Managed PostgreSQL uses TLS; certificate verification is disabled for the
    // shared Supabase pooler because its CA is not available in the container trust store.
    ssl: isEnabled(environment.DATABASE_SSL)
      ? { rejectUnauthorized: false }
      : false,
  };
}

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}
