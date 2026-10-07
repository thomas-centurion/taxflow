import 'reflect-metadata';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { createDatabaseOptions } from './database-options';

loadEnvironment({ path: resolve(__dirname, '..', '..', '..', '.env') });
export const AppDataSource = new DataSource(createDatabaseOptions());