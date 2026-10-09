const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// Set by test/run-e2e.cjs, which runs an isolated backend against the taxflow_test database with
// DEMO_READ_ONLY_EMAILS including DEMO_EMAIL (in another case and with spaces).
const baseUrl = process.env.TAXFLOW_API_URL;
if (!baseUrl) throw new Error('TAXFLOW_API_URL is not set: run E2E tests with "npm run test:e2e".');
const password = process.env.SEED_USER_PASSWORD;
const DEMO_EMAIL = 'demo.readonly@taxflow.test';
const READ_ONLY_MESSAGE = 'This demo account is read-only.';

async function api(method, route, token, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: payload });
  const buffer = Buffer.from(await response.arrayBuffer());
  const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
  return { status: response.status, data: isJson && buffer.length ? JSON.parse(buffer.toString('utf8')) : undefined, buffer };
}

async function login(email, secret = password) {
  const result = await api('POST', '/auth/login', undefined, { email, password: secret });
  assert.equal(result.status, 200, `login ${email}`);
  return result.data;
}

function pdf(name) {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(`%PDF-1.7\n${name}\n%%EOF\n`)], { type: 'application/pdf' }), name);
  return form;
}

/** Creates the demo user (an ANALYST listed in DEMO_READ_ONLY_EMAILS), a document and an automation run to read. */
async function setup(t) {
  const admin = await login('admin@taxflow.local');
  const manager = await login('manager@taxflow.local');
  const demoPassword = `Demo-${crypto.randomUUID()}`;
  let demoUser = (await api('GET', '/users?search=demo.readonly&limit=5', admin.accessToken)).data.data.find((user) => user.email === DEMO_EMAIL);
  if (!demoUser) {
    const created = await api('POST', '/users', admin.accessToken, { firstName: 'Demo', lastName: 'Visitor', email: DEMO_EMAIL, password: demoPassword, role: 'ANALYST' });
    assert.equal(created.status, 201);
    demoUser = created.data;
  } else {
    assert.equal((await api('PATCH', `/users/${demoUser.id}`, admin.accessToken, { password: demoPassword })).status, 200);
  }
  const demo = await login(DEMO_EMAIL.toUpperCase(), demoPassword);

  const obligations = (await api('GET', '/tax-obligations?limit=50', admin.accessToken)).data.data;
  const obligation = obligations.find((item) => ['PENDING', 'IN_PROGRESS', 'OVERDUE'].includes(item.status));
  const company = obligation.company;
  const upload = await api('POST', `/tax-obligations/${obligation.id}/documents`, manager.accessToken, pdf('demo-readable.pdf'));
  assert.equal(upload.status, 201);
  const run = await api('POST', `/tax-obligations/${obligation.id}/automation-runs`, manager.accessToken);
  assert.equal(run.status, 201);
  t.after(() => api('DELETE', `/documents/${upload.data.id}`, manager.accessToken));
  return { admin, manager, demo, demoUser, obligation, company, document: upload.data, run: run.data };
}

test('a read-only demo account can read every business area, including audit logs', async (t) => {
  const { admin, demo, obligation, company, document, run } = await setup(t);
  assert.equal(demo.user.readOnly, true, 'the login response flags the demo account');
  assert.equal(admin.user.readOnly, false);
  const me = await api('GET', '/auth/me', demo.accessToken);
  assert.equal(me.status, 200);
  assert.equal(me.data.readOnly, true);

  const token = demo.accessToken;
  for (const route of [
    '/companies', `/companies/${company.id}`, '/countries', '/users/options',
    '/tax-obligations?status=PENDING', `/tax-obligations/${obligation.id}`,
    `/tax-obligations/${obligation.id}/documents`, `/tax-obligations/${obligation.id}/automation-runs`, `/automation-runs/${run.id}`,
    '/notifications', '/notifications/unread-count', '/audit-logs?limit=50',
  ]) {
    assert.equal((await api('GET', route, token)).status, 200, `GET ${route}`);
  }

  const download = await api('GET', `/documents/${document.id}/download`, token);
  assert.equal(download.status, 200, 'existing documents can be downloaded');
  assert.match(download.buffer.toString('utf8'), /demo-readable\.pdf/);

  // Audit logs are visible with the business scope of a TAX_MANAGER: no user/login events.
  const audit = await api('GET', '/audit-logs?limit=100', token);
  assert.ok(audit.data.data.length > 0);
  assert.ok(audit.data.data.every((event) => ['Company', 'TaxObligation', 'Document', 'Notification', 'AutomationRun'].includes(event.entity)));
  assert.equal((await api('GET', '/audit-logs?entityType=User', token)).data.meta.total, 0);
  assert.ok((await api('GET', '/audit-logs?entityType=User', admin.accessToken)).data.meta.total > 0, 'ADMIN keeps the full audit scope');
  const changes = (await api('GET', `/audit-logs?entityType=AutomationRun&entityId=${run.id}`, token)).data.data;
  assert.ok(changes.some((event) => event.action === 'AUTOMATION_SUCCEEDED'), 'automation history is traceable');
});

test('a read-only demo account cannot write anything, even on routes without @Roles', async (t) => {
  const { admin, demo, demoUser, obligation, company, document, run } = await setup(t);
  const token = demo.accessToken;
  const randomId = crypto.randomUUID();
  const auditBefore = (await api('GET', `/audit-logs?actor=${demoUser.id}&limit=1`, admin.accessToken)).data.meta.total;

  const blocked = [
    ['POST', '/companies', { name: 'Demo Co', taxId: 'DEMO-1', countryId: company.countryId }],
    ['PATCH', `/companies/${company.id}`, { name: 'Changed by demo' }],
    ['DELETE', `/companies/${company.id}`],
    ['POST', '/countries', { name: 'Demoland', code: 'DQ' }],
    ['PATCH', `/countries/${company.countryId}`, { name: 'Changed by demo' }],
    ['DELETE', `/countries/${company.countryId}`],
    ['POST', '/tax-obligations', { companyId: company.id, countryId: company.countryId, name: 'Demo', type: 'VAT', dueDate: '2099-01-01' }],
    ['PATCH', `/tax-obligations/${obligation.id}`, { name: 'Changed by demo' }],
    ['DELETE', `/tax-obligations/${obligation.id}`],
    ['POST', `/tax-obligations/${obligation.id}/documents`, pdf('demo-upload.pdf')],
    ['DELETE', `/documents/${document.id}`],
    ['POST', '/users', { firstName: 'X', lastName: 'Y', email: 'x@example.local', password: 'Password123!', role: 'ADMIN' }],
    ['PATCH', `/users/${demoUser.id}`, { role: 'ADMIN' }],
    ['DELETE', `/users/${demoUser.id}`],
    ['POST', `/tax-obligations/${obligation.id}/automation-runs`],
    ['POST', '/automation/check-deadlines'],
    // No @Roles on these: blocked by the global read-only guard alone.
    ['PATCH', '/notifications/read-all'],
    ['PATCH', `/notifications/${randomId}/read`],
    ['POST', '/auth/logout'],
  ];
  for (const [method, route, body] of blocked) {
    const response = await api(method, route, token, body);
    assert.equal(response.status, 403, `${method} ${route}`);
    assert.equal(response.data.message, READ_ONLY_MESSAGE, `${method} ${route} message`);
  }

  // Nothing changed and nothing was recorded on behalf of the demo account by the blocked calls.
  assert.equal((await api('GET', `/companies/${company.id}`, admin.accessToken)).data.name, company.name);
  assert.equal((await api('GET', `/tax-obligations/${obligation.id}`, admin.accessToken)).data.name, obligation.name);
  assert.equal((await api('GET', `/documents/${document.id}/download`, admin.accessToken)).status, 200);
  assert.equal((await api('GET', `/users/${demoUser.id}`, admin.accessToken)).data.role, 'ANALYST');
  assert.equal((await api('GET', `/tax-obligations/${obligation.id}/automation-runs`, admin.accessToken)).data[0].id, run.id, 'no automation run was started');
  assert.equal((await api('GET', `/audit-logs?actor=${demoUser.id}&limit=1`, admin.accessToken)).data.meta.total, auditBefore);

  // The token keeps working: a blocked logout does not end the session server-side.
  assert.equal((await api('GET', '/auth/me', token)).status, 200);
});

test('regular accounts keep their permissions while demo mode is configured', async (t) => {
  const { admin, manager, obligation } = await setup(t);
  const analyst = await login('analyst@taxflow.local');
  assert.equal(analyst.user.readOnly, false, 'an ANALYST outside DEMO_READ_ONLY_EMAILS is not read-only');
  assert.equal((await api('GET', '/audit-logs', analyst.accessToken)).status, 403, 'regular analysts still cannot read audit logs');
  // Reaches the controller (404 for an unknown id) instead of the read-only 403, without consuming seeded notifications.
  assert.equal((await api('PATCH', `/notifications/${crypto.randomUUID()}/read`, analyst.accessToken)).status, 404, 'regular analysts can mark notifications as read');
  assert.equal((await api('POST', '/tax-obligations', analyst.accessToken, {})).status, 403, 'and still cannot write business data');

  const country = (await api('GET', '/countries?limit=100', admin.accessToken)).data.data[0];
  const created = await api('POST', '/companies', manager.accessToken, { name: `Manager Co ${crypto.randomUUID().slice(0, 6)}`, taxId: `M-${crypto.randomUUID().slice(0, 8)}`, countryId: country.id });
  assert.equal(created.status, 201, 'TAX_MANAGER can still create companies');
  t.after(() => api('DELETE', `/companies/${created.data.id}`, admin.accessToken));
  assert.equal((await api('PATCH', `/companies/${created.data.id}`, admin.accessToken, { phone: '+54 11 0000 0000' })).status, 200, 'ADMIN can still update');
  assert.equal((await api('GET', '/audit-logs?limit=1', manager.accessToken)).status, 200);
  assert.equal((await api('POST', `/tax-obligations/${obligation.id}/automation-runs`, admin.accessToken)).status, 201, 'ADMIN can still run automations');
  assert.equal((await api('POST', '/auth/logout', manager.accessToken)).status, 200, 'regular logout still works');
});
