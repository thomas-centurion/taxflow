const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const baseUrl = process.env.TAXFLOW_API_URL;
if (!baseUrl) throw new Error('TAXFLOW_API_URL is not set: run E2E tests with "npm run test:e2e".');
const password = process.env.SEED_USER_PASSWORD;

async function request(method, route, token, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, response };
}
async function json(result) { return result.response.json(); }

test('deadline notifications are idempotent and notification access stays private per user', async () => {
  const login = async (email) => {
    const response = await request('POST', '/auth/login', null, { email, password });
    assert.equal(response.status, 200);
    return (await json(response)).accessToken;
  };
  const admin = await login('admin@taxflow.local');
  const manager = await login('manager@taxflow.local');
  const analyst = await login('analyst@taxflow.local');

  assert.equal((await request('GET', '/notifications', null)).status, 401);
  assert.equal((await request('POST', '/automation/check-deadlines', analyst)).status, 403);
  assert.equal((await request('POST', '/automation/check-deadlines', manager)).status, 201);

  const managerPage = await request('GET', '/notifications?limit=50', manager);
  assert.equal(managerPage.status, 200);
  const managerNotifications = await json(managerPage);
  assert.ok(managerNotifications.data.some((notification) => notification.type === 'DEADLINE'));
  assert.ok(managerNotifications.data.every((notification) => notification.taxObligation === null || typeof notification.taxObligation.id === 'string'));
  const managerCount = managerNotifications.meta.total;
  assert.ok(managerNotifications.data.some((notification) => notification.type === 'DEADLINE'));

  const analystPage = await request('GET', '/notifications?limit=50', analyst);
  assert.equal(analystPage.status, 200);
  const analystNotifications = await json(analystPage);
  assert.ok(analystNotifications.data.some((notification) => notification.type === 'DEADLINE'));
  const privateId = managerNotifications.data[0].id;
  assert.equal((await request('PATCH', `/notifications/${privateId}/read`, admin)).status, 404);
  assert.equal((await request('PATCH', `/notifications/${privateId}/read`, manager)).status, 200);
  const readAudit = await json(await request('GET', `/audit-logs?action=MARK_READ&entityType=Notification&entityId=${privateId}`, admin));
  assert.ok(readAudit.data.some((event) => event.actorEmail === 'manager@taxflow.local'));

  await request('POST', '/automation/check-deadlines', manager);
  const afterRepeatPage = await json(await request('GET', '/notifications?limit=50', manager));
  const afterRepeatCount = afterRepeatPage.meta.total;
  assert.equal(afterRepeatCount, managerCount, 'a repeated deadline scan does not duplicate alerts');
  const marked = await request('PATCH', '/notifications/read-all', manager);
  assert.equal(marked.status, 200);
  assert.equal(await json(await request('GET', '/notifications/unread-count', manager)), 0);
  assert.ok(await json(await request('GET', '/notifications/unread-count', analyst)) > 0, 'mark-all-read only changes the caller notifications');
});

test('status changes and document uploads notify only the assigned user', async (t) => {
  const login = async (email) => {
    const response = await request('POST', '/auth/login', null, { email, password });
    assert.equal(response.status, 200);
    return (await json(response)).accessToken;
  };
  const manager = await login('manager@taxflow.local');
  const analyst = await login('analyst@taxflow.local');
  const analystUser = await json(await request('GET', '/auth/me', analyst));
  const companies = await json(await request('GET', '/companies?limit=1', manager));
  const company = companies.data[0];
  assert.ok(company?.countryId);

  let obligationId;
  let documentId;
  await t.after(async () => {
    if (documentId) await request('DELETE', `/documents/${documentId}`, manager);
    if (obligationId) await request('DELETE', `/tax-obligations/${obligationId}`, manager);
  });

  const create = await request('POST', '/tax-obligations', manager, {
    companyId: company.id, countryId: company.countryId, name: `Notification test ${Date.now()}`,
    type: 'OTHER', status: 'PENDING', dueDate: '2099-01-01', responsibleUserId: analystUser.id,
  });
  assert.equal(create.status, 201);
  const obligation = await json(create);
  obligationId = obligation.id;
  const statusUpdate = await request('PATCH', `/tax-obligations/${obligationId}`, manager, { status: 'IN_PROGRESS' });
  assert.equal(statusUpdate.status, 200);
  assert.equal((await json(statusUpdate)).status, 'IN_PROGRESS');
  const statusAudit = await json(await request('GET', `/audit-logs?entityType=TaxObligation&entityId=${obligationId}&action=UPDATE`, manager));
  const statusEvent = statusAudit.data.find((event) => event.actorEmail === 'manager@taxflow.local');
  assert.deepEqual(statusEvent.metadata.changes.status, { before: 'PENDING', after: 'IN_PROGRESS' });

  const file = new FormData();
  file.append('file', new Blob([Buffer.from('%PDF-1.7\nTaxFlow notification test\n%%EOF\n')], { type: 'application/pdf' }), 'notification-test.pdf');
  const upload = await request('POST', `/tax-obligations/${obligationId}/documents`, manager, file);
  assert.equal(upload.status, 201);
  documentId = (await json(upload)).id;

  const analystPage = await json(await request('GET', '/notifications?limit=50', analyst));
  const related = analystPage.data.filter((item) => item.taxObligation?.id === obligationId);
  assert.ok(related.some((item) => item.type === 'SYSTEM' && item.message.includes('IN_PROGRESS')), JSON.stringify(analystPage.data));
  assert.ok(related.some((item) => item.type === 'DOCUMENT' && item.message.includes('notification-test.pdf')));
  const notificationAudit = await json(await request('GET', '/audit-logs?action=NOTIFICATION_CREATED&entityType=Notification', manager));
  const notificationIds = new Set(related.map((item) => item.id));
  assert.ok(notificationAudit.data.some((event) => notificationIds.has(event.entityId) && event.actorType === 'SYSTEM'));
  const privateNotification = related[0];
  assert.equal((await request('PATCH', `/notifications/${privateNotification.id}/read`, manager)).status, 404);

  const managerPage = await json(await request('GET', '/notifications?limit=50', manager));
  assert.equal(managerPage.data.some((item) => item.taxObligation?.id === obligationId), false);
});
