const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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

test('TLS always verifies the server certificate, against a configured private CA when given', (t) => {
  const pem = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n';
  const tls = { ...credentials, DATABASE_SSL: 'true' };

  const inline = createDatabaseOptions({ ...tls, DATABASE_SSL_CA: pem.replace(/\n/g, '\\n') }, [], []);
  assert.deepEqual(inline.ssl, { ca: pem, rejectUnauthorized: true }, 'escaped line breaks are restored');
  assert.deepEqual(createDatabaseOptions({ ...tls, DATABASE_SSL_CA: pem }, [], []).ssl, { ca: pem.trim(), rejectUnauthorized: true });

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'taxflow-ca-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'ca.crt');
  fs.writeFileSync(file, pem);
  assert.deepEqual(createDatabaseOptions({ ...tls, DATABASE_SSL_CA_FILE: file }, [], []).ssl, { ca: pem, rejectUnauthorized: true });

  assert.throws(() => createDatabaseOptions({ ...tls, DATABASE_SSL_CA_FILE: path.join(directory, 'missing.crt') }, [], []), /DATABASE_SSL_CA_FILE could not be read/);
  assert.throws(() => createDatabaseOptions({ ...tls, DATABASE_SSL_CA: 'not a certificate' }, [], []), /PEM certificate/);
  assert.throws(() => createDatabaseOptions({ ...tls, DATABASE_SSL_CA: pem, DATABASE_SSL_CA_FILE: file }, [], []), /only one/);
  assert.throws(() => createDatabaseOptions({ ...credentials, DATABASE_SSL_CA: pem }, [], []), /require DATABASE_SSL=true/, 'a CA never silently means a plain-text connection');
});
