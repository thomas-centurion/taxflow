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
    migrationsTableName: 'typeorm_migrations', migrationsRun: false, synchronize: false, uuidExtension: 'pgcrypto',
  };
}