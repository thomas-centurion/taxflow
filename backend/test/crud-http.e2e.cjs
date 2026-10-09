const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const baseUrl = process.env.TAXFLOW_API_URL;
if (!baseUrl) throw new Error('TAXFLOW_API_URL is not set: run E2E tests with "npm run test:e2e".');
const password = process.env.SEED_USER_PASSWORD;
const nobodyId = '00000000-0000-4000-8000-000000000000';
let companyId;
let obligationId;
let createdUserId;

async function api(method, route, body, token) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;
  const response = await fetch(baseUrl + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  return { status: response.status, data };
}

async function expectStatus(result, expected, label) {
  assert.equal(result.status, expected, label + ': expected HTTP ' + expected + ', got ' + result.status + '; response=' + JSON.stringify(result.data));
  return result.data;
}

test('CRUD REST integration: users, countries, companies and tax obligations', async (t) => {
  assert.ok(password, 'SEED_USER_PASSWORD must be configured in root .env');
  const admin = await expectStatus(await api('POST', '/auth/login', { email: 'admin@taxflow.local', password }), 200, 'admin login');
  const analyst = await expectStatus(await api('POST', '/auth/login', { email: 'analyst@taxflow.local', password }), 200, 'analyst login');
  const manager = await expectStatus(await api('POST', '/auth/login', { email: 'manager@taxflow.local', password }), 200, 'manager login');
  await expectStatus(await api('GET', '/companies'), 401, 'unauthenticated access');
  await expectStatus(await api('POST', '/users', { firstName: '', lastName: '', email: 'bad-email', password: 'short', role: 'INVALID' }, admin.accessToken), 400, 'user validation');
  await expectStatus(await api('POST', '/users', { firstName: 'Long', lastName: 'Password', email: 'long-' + crypto.randomUUID() + '@example.local', password: 'é'.repeat(37), role: 'ANALYST' }, admin.accessToken), 400, 'bcrypt byte limit');
  await expectStatus(await api('POST', '/users', { firstName: 'Blocked', lastName: 'Analyst', email: 'blocked-' + crypto.randomUUID() + '@example.local', password: 'ValidPassword123!', role: 'ANALYST' }, analyst.accessToken), 403, 'user role restriction');
  const userList = await expectStatus(await api('GET', '/users', undefined, admin.accessToken), 200, 'list users');
  assert.ok(userList.data.every((user) => !('passwordHash' in user) && !('password' in user)));

  const existingCountries = await expectStatus(await api('GET', '/countries', undefined, admin.accessToken), 200, 'list countries before test');
  const usedCodes = new Set(existingCountries.data.map((entry) => entry.code));
  const countryCode = Array.from({ length: 26 * 26 }, (_, index) => String.fromCharCode(65 + Math.floor(index / 26)) + String.fromCharCode(65 + index % 26)).find((code) => !usedCodes.has(code));
  assert.ok(countryCode, 'a free two-letter country code is available for the integration test');
  const country = await expectStatus(await api('POST', '/countries', { name: 'CRUD test country', code: countryCode }, admin.accessToken), 201, 'create country');
  t.after(async () => {
    if (obligationId) await api('DELETE', '/tax-obligations/' + obligationId, undefined, admin.accessToken);
    if (companyId) await api('DELETE', '/companies/' + companyId, undefined, admin.accessToken);
    if (createdUserId) await api('DELETE', '/users/' + createdUserId, undefined, admin.accessToken);
    if (country?.id) await api('DELETE', '/countries/' + country.id, undefined, admin.accessToken);
  });
  assert.equal((await expectStatus(await api('GET', '/countries/' + country.id, undefined, admin.accessToken), 200, 'read country')).code, countryCode);
  await expectStatus(await api('PATCH', '/countries/' + country.id, { code: null }, admin.accessToken), 400, 'null required country field');
  assert.equal((await expectStatus(await api('PATCH', '/countries/' + country.id, { name: 'CRUD country updated' }, admin.accessToken), 200, 'update country')).name, 'CRUD country updated');
  await expectStatus(await api('POST', '/countries', { name: 'Duplicate', code: countryCode }, admin.accessToken), 409, 'country unique constraint');
  await expectStatus(await api('POST', '/countries', { name: '', code: 'abc' }, admin.accessToken), 400, 'country validation');
  await expectStatus(await api('POST', '/countries', { name: 'Forbidden', code: 'ZY' }, analyst.accessToken), 403, 'country authorization');

  const suffix = crypto.randomUUID().slice(0, 8);
  const createdUser = await expectStatus(await api('POST', '/users', { firstName: 'CRUD', lastName: 'Tester', email: 'crud-' + suffix + '@example.local', password: 'ValidPassword123!', role: 'ANALYST' }, admin.accessToken), 201, 'create user');
  createdUserId = createdUser.id;
  assert.ok(!('passwordHash' in createdUser) && !('password' in createdUser));
  await expectStatus(await api('POST', '/users', { firstName: 'Duplicate', lastName: 'User', email: createdUser.email, password: 'ValidPassword123!', role: 'ANALYST' }, admin.accessToken), 409, 'user unique constraint');
  await expectStatus(await api('GET', '/users/' + createdUserId, undefined, admin.accessToken), 200, 'read user');
  await expectStatus(await api('PATCH', '/users/' + createdUserId, { email: null }, admin.accessToken), 400, 'null required user field');
  assert.equal((await expectStatus(await api('PATCH', '/users/' + createdUserId, { firstName: 'Updated' }, admin.accessToken), 200, 'update user')).firstName, 'Updated');

  const companyBody = { name: 'CRUD Company ' + suffix, taxId: 'CRUD-' + suffix, countryId: country.id, email: 'crud@example.local', phone: '+1 555 0100' };
  const company = await expectStatus(await api('POST', '/companies', companyBody, manager.accessToken), 201, 'manager creates company');
  companyId = company.id;
  assert.equal(company.country.id, country.id);
  await expectStatus(await api('GET', '/companies/' + companyId, undefined, admin.accessToken), 200, 'read company');
  await expectStatus(await api('POST', '/companies', companyBody, admin.accessToken), 409, 'company unique constraint');
  const companies = await expectStatus(await api('GET', '/companies?search=' + suffix + '&page=1&limit=5', undefined, admin.accessToken), 200, 'search companies');
  assert.ok(companies.data.some((entry) => entry.id === companyId));
  assert.ok((await expectStatus(await api('PATCH', '/companies/' + companyId, { name: 'CRUD Company updated ' + suffix }, manager.accessToken), 200, 'update company')).name.includes('updated'));
  await expectStatus(await api('POST', '/companies', { ...companyBody, taxId: 'BAD-' + suffix, countryId: nobodyId }, admin.accessToken), 404, 'missing company country');
  await expectStatus(await api('POST', '/companies', { name: '', taxId: 'BAD', countryId: country.id }, admin.accessToken), 400, 'company validation');

  const dueDate = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  const obligationBody = { companyId, countryId: country.id, name: 'CRUD VAT ' + suffix, type: 'VAT', status: 'PENDING', dueDate, responsibleUserId: manager.user.id, description: 'Integration CRUD test' };
  const obligation = await expectStatus(await api('POST', '/tax-obligations', obligationBody, manager.accessToken), 201, 'create obligation');
  obligationId = obligation.id;
  assert.equal(obligation.company.id, companyId);
  assert.equal(obligation.country.id, country.id);
  assert.equal(obligation.responsibleUser.id, manager.user.id);
  await expectStatus(await api('GET', '/tax-obligations/' + obligationId, undefined, admin.accessToken), 200, 'read obligation');
  await expectStatus(await api('PATCH', '/tax-obligations/' + obligationId, { status: null }, manager.accessToken), 400, 'null required obligation field');
  await expectStatus(await api('POST', '/tax-obligations', obligationBody, manager.accessToken), 409, 'obligation unique constraint');
  assert.equal((await expectStatus(await api('PATCH', '/tax-obligations/' + obligationId, { status: 'IN_PROGRESS' }, manager.accessToken), 200, 'update obligation')).status, 'IN_PROGRESS');
  for (const filter of ['company=' + companyId, 'country=' + country.id, 'status=IN_PROGRESS', 'type=VAT', 'responsibleUser=' + manager.user.id, 'dueDate=' + dueDate]) {
    const result = await expectStatus(await api('GET', '/tax-obligations?' + filter, undefined, analyst.accessToken), 200, 'filter ' + filter);
    assert.ok(result.data.some((entry) => entry.id === obligationId), 'filter omitted record: ' + filter);
  }
  await expectStatus(await api('POST', '/tax-obligations', { ...obligationBody, countryId: 'e75f1f9e-3963-4b0d-a70e-c2bd98cf4c3f' }, manager.accessToken), 400, 'company-country mismatch');
  await expectStatus(await api('POST', '/tax-obligations', { ...obligationBody, companyId: nobodyId }, manager.accessToken), 404, 'missing company relation');
  await expectStatus(await api('POST', '/tax-obligations', { ...obligationBody, responsibleUserId: nobodyId }, manager.accessToken), 404, 'missing responsible user');
  await expectStatus(await api('POST', '/tax-obligations', { ...obligationBody, dueDate: 'not-a-date' }, manager.accessToken), 400, 'obligation validation');
  await expectStatus(await api('POST', '/tax-obligations', obligationBody, analyst.accessToken), 403, 'analyst write restriction');
  await expectStatus(await api('DELETE', '/companies/' + companyId, undefined, admin.accessToken), 409, 'company foreign key restriction');
  await expectStatus(await api('DELETE', '/users/' + admin.user.id, undefined, admin.accessToken), 409, 'self-delete restriction');
  await expectStatus(await api('PATCH', '/companies/' + nobodyId, { name: 'Missing' }, admin.accessToken), 404, 'update missing company');
  await expectStatus(await api('DELETE', '/tax-obligations/' + nobodyId, undefined, admin.accessToken), 404, 'delete missing obligation');

  await expectStatus(await api('DELETE', '/tax-obligations/' + obligationId, undefined, manager.accessToken), 200, 'delete obligation');
  obligationId = undefined;
  await expectStatus(await api('DELETE', '/companies/' + companyId, undefined, manager.accessToken), 200, 'delete company');
  companyId = undefined;
  await expectStatus(await api('DELETE', '/users/' + createdUserId, undefined, admin.accessToken), 200, 'delete user');
  createdUserId = undefined;
  await expectStatus(await api('DELETE', '/countries/' + country.id, undefined, admin.accessToken), 200, 'delete country');
  country.id = undefined;
  await expectStatus(await api('PATCH', '/countries/' + nobodyId, { name: 'Missing' }, admin.accessToken), 404, 'update missing country');
  await expectStatus(await api('GET', '/companies/' + nobodyId, undefined, admin.accessToken), 404, 'read missing company');
  await expectStatus(await api('GET', '/tax-obligations/not-a-uuid', undefined, admin.accessToken), 400, 'malformed UUID');
});
