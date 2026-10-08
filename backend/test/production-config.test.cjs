const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loggerLevels, trustProxySetting } = require('../dist/common/runtime-options');
const { createDatabaseOptions } = require('../dist/database/database-options');

const credentials = { DATABASE_USER: 'taxflow', DATABASE_PASSWORD: 'secret' };

test('production logs drop debug and verbose output', () => {
  assert.deepEqual(loggerLevels('production'), ['log', 'warn', 'error', 'fatal']);
  assert.ok(loggerLevels('development').includes('debug'));
  assert.ok(loggerLevels(undefined).includes('verbose'));
});

test('trust proxy is disabled unless TRUST_PROXY is set', () => {
  assert.equal(trustProxySetting(undefined), false);
  assert.equal(trustProxySetting(''), false);
  assert.equal(trustProxySetting(' FALSE '), false);
  assert.equal(trustProxySetting('true'), true);
  assert.equal(trustProxySetting('1'), 1);
  assert.equal(trustProxySetting('loopback, 10.0.0.0/8'), 'loopback, 10.0.0.0/8');
});

test('migrations on startup and TLS are opt-in, and the schema is never synchronized', () => {
  const defaults = createDatabaseOptions(credentials, [], []);
  assert.equal(defaults.migrationsRun, false);
  assert.equal(defaults.ssl, false);
  assert.equal(defaults.synchronize, false);
  const production = createDatabaseOptions({ ...credentials, DATABASE_MIGRATIONS_RUN: 'true', DATABASE_SSL: 'TRUE' }, [], []);
  assert.equal(production.migrationsRun, true);
  assert.equal(production.ssl, true);
  assert.throws(() => createDatabaseOptions({ DATABASE_USER: 'taxflow' }, [], []), /DATABASE_USER and DATABASE_PASSWORD/);
});
