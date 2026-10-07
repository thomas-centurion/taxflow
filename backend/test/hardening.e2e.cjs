const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// Set by test/run-e2e.cjs, which runs an isolated backend on a dedicated test database. Never falls back to the development API.
const baseUrl = process.env.TAXFLOW_API_URL;
if (!baseUrl) throw new Error('TAXFLOW_API_URL is not set: run E2E tests with "npm run test:e2e".');
const password = process.env.SEED_USER_PASSWORD;

async function api(method, route, token, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : undefined };
}
async function login(email) {
  const result = await api('POST', '/auth/login', undefined, { email, password });
  assert.equal(result.status, 200, `login ${email}`);
  return result.data;
}

test('login is rate limited per IP and email without affecting other accounts', async () => {
  const limit = Number(process.env.LOGIN_THROTTLE_LIMIT);
  assert.ok(limit > 0, 'LOGIN_THROTTLE_LIMIT is provided by the E2E runner');
  const target = `throttle-${crypto.randomUUID()}@example.local`;
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const result = await api('POST', '/auth/login', undefined, { email: target, password: 'WrongPassword123!' });
    assert.equal(result.status, 401, `attempt ${attempt} is evaluated normally`);
    assert.equal(result.data.message, 'Invalid credentials', 'unknown accounts get the generic error');
  }
  const blocked = await api('POST', '/auth/login', undefined, { email: ` ${target.toUpperCase()} `, password: 'WrongPassword123!' });
  assert.equal(blocked.status, 429, 'email normalization cannot bypass the limit');
  assert.equal(JSON.stringify(blocked.data).includes('WrongPassword123!'), false);
  await login('manager@taxflow.local');

  const admin = await login('admin@taxflow.local');
  const failures = await api('GET', '/audit-logs?action=LOGIN_FAILED&limit=100', admin.accessToken);
  assert.equal(failures.status, 200);
  assert.ok(failures.data.data.length > 0, 'failed logins are audited');
  const serialized = JSON.stringify(failures.data.data);
  assert.equal(serialized.includes('WrongPassword123!'), false, 'passwords are never audited');
  assert.equal(serialized.includes(target), false, 'unknown emails are not stored');
});

test('user listing follows least privilege; responsible options stay available to every role', async () => {
  const analyst = await login('analyst@taxflow.local');
  const manager = await login('manager@taxflow.local');
  assert.equal((await api('GET', '/users', analyst.accessToken)).status, 403);
  assert.equal((await api('GET', `/users/${analyst.user.id}`, analyst.accessToken)).status, 403);
  assert.equal((await api('GET', '/users', manager.accessToken)).status, 200);
  const options = await api('GET', '/users/options', analyst.accessToken);
  assert.equal(options.status, 200);
  assert.ok(options.data.length >= 3);
  for (const option of options.data) assert.deepEqual(Object.keys(option).sort(), ['email', 'firstName', 'id', 'lastName']);
});

test('the system always keeps an active ADMIN', async (t) => {
  const admin = await login('admin@taxflow.local');
  const adminId = admin.user.id;
  assert.equal((await api('PATCH', `/users/${adminId}`, admin.accessToken, { role: 'ANALYST' })).status, 409, 'last admin cannot demote itself');
  assert.equal((await api('PATCH', `/users/${adminId}`, admin.accessToken, { isActive: false })).status, 409, 'last admin cannot deactivate itself');

  const email = `second-admin-${crypto.randomUUID()}@example.local`;
  const created = await api('POST', '/users', admin.accessToken, { firstName: 'Second', lastName: 'Admin', email, password: 'ValidPassword123!', role: 'ADMIN' });
  assert.equal(created.status, 201);
  const secondId = created.data.id;
  let secondToken;
  t.after(async () => {
    await api('PATCH', `/users/${adminId}`, secondToken, { role: 'ADMIN', isActive: true });
    await api('DELETE', `/users/${secondId}`, admin.accessToken);
  });
  secondToken = (await api('POST', '/auth/login', undefined, { email, password: 'ValidPassword123!' })).data.accessToken;

  assert.equal((await api('PATCH', `/users/${adminId}`, secondToken, { role: 'TAX_MANAGER' })).status, 200, 'demotion allowed while another admin remains');
  assert.equal((await api('PATCH', `/users/${secondId}`, secondToken, { role: 'ANALYST' })).status, 409, 'remaining admin cannot demote itself');
  assert.equal((await api('PATCH', `/users/${secondId}`, secondToken, { isActive: false })).status, 409, 'remaining admin cannot deactivate itself');
  assert.equal((await api('PATCH', `/users/${adminId}`, secondToken, { role: 'ADMIN' })).status, 200, 'original admin restored');
  assert.equal((await api('GET', `/users/${adminId}`, admin.accessToken)).data.role, 'ADMIN');
});

test('audit log date filters accept only valid YYYY-MM-DD ranges', async () => {
  const { accessToken } = await login('admin@taxflow.local');
  for (const query of ['dateTo=2026-10-07T10:00:00Z', 'dateFrom=2026-10-07T00:00:00.000Z', 'dateFrom=2026-02-30', 'dateTo=07-10-2026', 'dateFrom=2026-10-08&dateTo=2026-10-01']) {
    assert.equal((await api('GET', `/audit-logs?${query}`, accessToken)).status, 400, query);
  }
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const sameDay = await api('GET', `/audit-logs?action=LOGIN&dateFrom=${key}&dateTo=${key}`, accessToken);
  assert.equal(sameDay.status, 200);
  assert.ok(sameDay.data.meta.total > 0, 'a single-day range includes events from that day');
});

test('company and obligation relation changes are persisted and audited consistently', async (t) => {
  const { accessToken, user } = await login('admin@taxflow.local');
  const countries = (await api('GET', '/countries?limit=100', accessToken)).data.data;
  const users = (await api('GET', '/users/options', accessToken)).data;
  const [first, second] = countries;
  const suffix = crypto.randomUUID().slice(0, 8);
  let companyId; let obligationId;
  t.after(async () => {
    if (obligationId) await api('DELETE', `/tax-obligations/${obligationId}`, accessToken);
    if (companyId) await api('DELETE', `/companies/${companyId}`, accessToken);
  });

  companyId = (await api('POST', '/companies', accessToken, { name: `Hardening ${suffix}`, taxId: `HARD-${suffix}`, countryId: first.id })).data.id;
  assert.equal((await api('PATCH', `/companies/${companyId}`, accessToken, { countryId: second.id })).status, 200);
  assert.equal((await api('GET', `/companies/${companyId}`, accessToken)).data.countryId, second.id, 'company country change persisted');

  const other = users.find((entry) => entry.id !== user.id);
  const created = await api('POST', '/tax-obligations', accessToken, { companyId, countryId: second.id, name: `Hardening ${suffix}`, type: 'VAT', dueDate: '2099-01-01', responsibleUserId: user.id });
  assert.equal(created.status, 201);
  obligationId = created.data.id;
  assert.equal(created.data.isOverdue, false);

  assert.equal((await api('PATCH', `/tax-obligations/${obligationId}`, accessToken, { responsibleUserId: other.id })).status, 200);
  assert.equal((await api('GET', `/tax-obligations/${obligationId}`, accessToken)).data.responsibleUserId, other.id, 'responsible change persisted');
  assert.equal((await api('PATCH', `/companies/${companyId}`, accessToken, { countryId: first.id })).status, 409, 'company with obligations cannot change country');
  assert.equal((await api('GET', `/companies/${companyId}`, accessToken)).data.countryId, second.id);

  assert.equal((await api('PATCH', `/tax-obligations/${obligationId}`, accessToken, { status: 'APPROVED' })).status, 409, 'invalid transition rejected');
  assert.equal((await api('PATCH', `/tax-obligations/${obligationId}`, accessToken, { status: 'OVERDUE' })).status, 409, 'future obligation cannot be OVERDUE');
  const audit = (await api('GET', `/audit-logs?entityType=TaxObligation&entityId=${obligationId}&action=UPDATE`, accessToken)).data.data;
  assert.equal(audit.length, 1, 'rejected updates are not audited');
  assert.deepEqual(audit[0].metadata.changes.responsibleUserId, { before: user.id, after: other.id });
});

test('seed only inserts missing data, never overwrites existing records, and only runs in development or test environments', async (t) => {
  assert.match(process.env.DATABASE_NAME, /_test$/, 'seed verification only runs against the test database');
  const client = new Client({ host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT), user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: process.env.DATABASE_NAME });
  await client.connect();
  const snapshot = async () => ({
    user: (await client.query(`SELECT password_hash, role, is_active FROM users WHERE email = 'analyst@taxflow.local'`)).rows[0],
    company: (await client.query(`SELECT name, email FROM companies WHERE tax_id = '30-00000001-9'`)).rows[0],
    country: (await client.query(`SELECT name FROM countries WHERE code = 'AR'`)).rows[0],
    obligation: (await client.query(`SELECT status, to_char(due_date, 'YYYY-MM-DD') AS due_date FROM tax_obligations WHERE name = 'IVA mensual'`)).rows[0],
    counts: (await client.query(`SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM companies) AS companies, (SELECT count(*) FROM countries) AS countries, (SELECT count(*) FROM tax_obligations) AS obligations`)).rows[0],
  });
  const original = await snapshot();
  t.after(async () => {
    await client.query(`UPDATE users SET password_hash = $1, role = $2, is_active = $3 WHERE email = 'analyst@taxflow.local'`, [original.user.password_hash, original.user.role, original.user.is_active]);
    await client.query(`UPDATE companies SET name = $1, email = $2 WHERE tax_id = '30-00000001-9'`, [original.company.name, original.company.email]);
    await client.query(`UPDATE countries SET name = $1 WHERE code = 'AR'`, [original.country.name]);
    await client.query(`UPDATE tax_obligations SET status = $1, due_date = $2 WHERE name = 'IVA mensual'`, [original.obligation.status, original.obligation.due_date]);
    await client.end();
  });

  await client.query(`UPDATE users SET password_hash = 'changed-by-user', role = 'TAX_MANAGER', is_active = false WHERE email = 'analyst@taxflow.local'`);
  await client.query(`UPDATE companies SET name = 'ACME renamed', email = 'renamed@example.local' WHERE tax_id = '30-00000001-9'`);
  await client.query(`UPDATE countries SET name = 'Argentina (renamed)' WHERE code = 'AR'`);
  await client.query(`UPDATE tax_obligations SET status = 'SUBMITTED', due_date = '2099-12-31' WHERE name = 'IVA mensual'`);
  const modified = await snapshot();

  const seed = spawnSync(process.execPath, ['dist/database/seed.js'], { cwd: path.resolve(__dirname, '..'), env: process.env, encoding: 'utf8' });
  assert.equal(seed.status, 0, seed.stderr);
  assert.deepEqual(await snapshot(), modified, 'seed did not overwrite or duplicate any existing record');

  const production = spawnSync(process.execPath, ['dist/database/seed.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' });
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /NODE_ENV=production/);
});
