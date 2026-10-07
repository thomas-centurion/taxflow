const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const baseUrl = process.env.TAXFLOW_API_URL || 'http://localhost:' + (process.env.PORT || '3000') + '/api';
const password = process.env.SEED_USER_PASSWORD || 'Admin123!';

async function api(method, route, token, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, response };
}
async function json(result) { return result.response.json(); }
async function login(email) {
  const result = await api('POST', '/auth/login', undefined, { email, password });
  assert.equal(result.status, 200, `login ${email}`);
  return (await json(result)).accessToken;
}

test('audit logs are persisted, filtered, sanitized, append-only and role-protected', async (t) => {
  const adminToken = await login('admin@taxflow.local');
  const managerToken = await login('manager@taxflow.local');
  const analystToken = await login('analyst@taxflow.local');
  const admin = await json(await api('GET', '/auth/me', adminToken));
  const manager = await json(await api('GET', '/auth/me', managerToken));
  const analyst = await json(await api('GET', '/auth/me', analystToken));
  const countries = await json(await api('GET', '/countries?limit=10', managerToken));
  const country = countries.data[0];
  assert.ok(country?.id);

  let companyId;
  let obligationId;
  let createdUserId;
  await t.after(async () => {
    if (obligationId) await api('DELETE', `/tax-obligations/${obligationId}`, managerToken);
    if (companyId) await api('DELETE', `/companies/${companyId}`, managerToken);
    if (createdUserId) await api('DELETE', `/users/${createdUserId}`, adminToken);
  });

  assert.equal((await api('GET', '/audit-logs', undefined)).status, 401);
  assert.equal((await api('GET', '/audit-logs', analystToken)).status, 403);
  assert.equal((await api('POST', '/audit-logs', adminToken, {})).status, 404);
  assert.equal((await api('PATCH', '/audit-logs/00000000-0000-4000-8000-000000000000', adminToken, {})).status, 404);
  assert.equal((await api('DELETE', '/audit-logs/00000000-0000-4000-8000-000000000000', adminToken)).status, 404);

  const invalid = await api('POST', '/companies', managerToken, {
    name: `Audit test ${Date.now()}`, taxId: `AUDIT-${Date.now()}`, countryId: country.id,
    userId: admin.id, actorType: 'SYSTEM',
  });
  assert.equal(invalid.status, 400, 'clients cannot supply audit actor fields');

  const name = `Audit test ${Date.now()}`;
  const created = await api('POST', '/companies', managerToken, { name, taxId: `AUDIT-${Date.now()}`, countryId: country.id, email: 'audit@example.local' });
  assert.equal(created.status, 201);
  const company = await json(created);
  companyId = company.id;
  assert.equal((await api('GET', `/companies/${companyId}`, managerToken)).status, 200);

  const updated = await api('PATCH', `/companies/${companyId}`, managerToken, { name: `${name} edited` });
  assert.equal(updated.status, 200);
  assert.equal((await api('PATCH', `/companies/${companyId}`, managerToken, { name: `${name} edited` })).status, 200);

  const page = await api('GET', `/audit-logs?entityType=Company&entityId=${companyId}&limit=20`, managerToken);
  assert.equal(page.status, 200);
  const events = (await json(page)).data;
  assert.deepEqual(new Set(events.map((event) => event.action)), new Set(['UPDATE', 'CREATE']));
  assert.ok(events.every((event) => event.actorType === 'USER' && event.actorEmail === 'manager@taxflow.local'));
  const updateEvent = events.find((event) => event.action === 'UPDATE');
  assert.deepEqual(updateEvent.metadata.changes.name, { before: name, after: `${name} edited` });
  assert.equal(JSON.stringify(events).includes('passwordHash'), false);
  assert.equal(JSON.stringify(events).includes('JWT'), false);
  assert.equal(JSON.stringify(events).includes(admin.id), false, 'spoofed request actor is not recorded');

  const overdueCreate = await api('POST', '/tax-obligations', managerToken, {
    companyId, countryId: country.id, name: `Audit overdue ${Date.now()}`, type: 'OTHER', status: 'PENDING',
    dueDate: '2026-10-05', responsibleUserId: analyst.id,
  });
  assert.equal(overdueCreate.status, 201);
  const overdue = await json(overdueCreate);
  obligationId = overdue.id;
  assert.equal((await api('POST', '/automation/check-deadlines', managerToken, {})).status, 201);
  const systemChanges = await json(await api('GET', `/audit-logs?entityType=TaxObligation&entityId=${obligationId}&action=UPDATE`, adminToken));
  const systemUpdate = systemChanges.data.find((event) => event.actorType === 'SYSTEM');
  assert.ok(systemUpdate, 'deadline automation is attributed to SYSTEM');
  assert.deepEqual(systemUpdate.metadata.changes.status, { before: 'PENDING', after: 'OVERDUE' });
  await api('DELETE', `/tax-obligations/${obligationId}`, managerToken);
  obligationId = undefined;

  const managerUserLogs = await json(await api('GET', `/audit-logs?entityType=User&actor=${admin.id}`, managerToken));
  assert.equal(managerUserLogs.meta.total, 0, 'tax managers only see business entity logs');
  const adminUserLogs = await json(await api('GET', `/audit-logs?entityType=User&action=LOGIN&actor=${admin.id}&limit=100`, adminToken));
  assert.ok(adminUserLogs.data.some((event) => event.actorEmail === 'admin@taxflow.local' && event.actorType === 'USER'));
  assert.ok(adminUserLogs.meta.total >= 1);

  const uniqueEmail = `audit-${Date.now()}@example.local`;
  const createdUserResult = await api('POST', '/users', adminToken, {
    firstName: 'Audit', lastName: 'Subject', email: uniqueEmail, password: 'Temporary123!', role: 'ANALYST',
  });
  assert.equal(createdUserResult.status, 201);
  const createdUser = await json(createdUserResult);
  createdUserId = createdUser.id;
  assert.equal('passwordHash' in createdUser, false);
  assert.equal((await api('PATCH', `/users/${createdUserId}`, adminToken, { password: 'Replacement123!' })).status, 200);
  const userAudit = await json(await api('GET', `/audit-logs?entityType=User&entityId=${createdUserId}`, adminToken));
  const passwordEvent = userAudit.data.find((event) => event.action === 'UPDATE');
  assert.equal(passwordEvent.metadata.passwordChanged, true);
  assert.equal(JSON.stringify(userAudit.data).includes('Replacement123!'), false);
  assert.equal(JSON.stringify(userAudit.data).includes('passwordHash'), false);
  assert.equal((await api('DELETE', `/users/${createdUserId}`, adminToken)).status, 200);
  createdUserId = undefined;
  const deletedUser = await json(await api('GET', `/audit-logs?entityType=User&entityId=${createdUser.id}&action=DELETE`, adminToken));
  assert.equal(deletedUser.data.length, 1);
  assert.equal('passwordHash' in deletedUser.data[0].metadata.values, false);

  assert.equal((await api('DELETE', `/companies/${companyId}`, managerToken)).status, 200);
  companyId = undefined;
  const deleted = await json(await api('GET', `/audit-logs?entityType=Company&entityId=${company.id}&action=DELETE`, adminToken));
  assert.equal(deleted.data.length, 1);
  assert.equal(deleted.data[0].metadata.values.name, `${name} edited`);

  const logout = await api('POST', '/auth/logout', managerToken, {});
  assert.equal(logout.status, 200);
  const logoutEvents = await json(await api('GET', `/audit-logs?action=LOGOUT&actor=${manager.id}`, adminToken));
  assert.ok(logoutEvents.data.some((event) => event.actorEmail === 'manager@taxflow.local'));

  const invalidFilter = await api('GET', '/audit-logs?action=NOT_AN_ACTION', adminToken);
  assert.equal(invalidFilter.status, 400);
  const paged = await api('GET', '/audit-logs?page=1&limit=2&dateFrom=2020-01-01&dateTo=2099-12-31', adminToken);
  assert.equal(paged.status, 200);
  assert.ok((await json(paged)).data.length <= 2);
});
