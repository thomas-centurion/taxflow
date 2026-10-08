const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// Set by test/run-e2e.cjs, which runs an isolated backend against the taxflow_test database.
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

function dateFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function createObligation(t, token, { dueDate, responsibleUserId }) {
  const country = (await api('GET', '/countries?limit=100', token)).data.data.find((entry) => entry.code === 'AR');
  const suffix = crypto.randomUUID().slice(0, 8);
  const company = await api('POST', '/companies', token, { name: `Automation ${suffix}`, taxId: `30-${suffix}`, countryId: country.id });
  assert.equal(company.status, 201);
  const obligation = await api('POST', '/tax-obligations', token, {
    companyId: company.data.id, countryId: country.id, name: `IVA automatización ${suffix}`, type: 'VAT', status: 'PENDING', dueDate, responsibleUserId,
  });
  assert.equal(obligation.status, 201);
  t.after(async () => {
    await api('DELETE', `/tax-obligations/${obligation.data.id}`, token);
    await api('DELETE', `/companies/${company.data.id}`, token);
  });
  return obligation.data;
}

const forObligation = (items, id) => items.filter((item) => item.taxObligation?.id === id);

test('manual processing marks an overdue obligation, audits, notifies and is idempotent', async (t) => {
  const admin = await login('admin@taxflow.local');
  const manager = await login('manager@taxflow.local');
  const analyst = await login('analyst@taxflow.local');
  const obligation = await createObligation(t, manager.accessToken, { dueDate: dateFromToday(-3), responsibleUserId: analyst.user.id });
  const route = `/tax-obligations/${obligation.id}/automation-runs`;

  assert.equal((await api('POST', route)).status, 401, 'automation is never public');
  assert.equal((await api('POST', route, analyst.accessToken)).status, 403, 'analysts cannot run automations');

  const first = await api('POST', route, manager.accessToken);
  assert.equal(first.status, 201, JSON.stringify(first.data));
  const run = first.data;
  assert.equal(run.status, 'SUCCEEDED');
  assert.equal(run.trigger, 'MANUAL');
  assert.equal(run.requestedBy.id, manager.user.id);
  assert.ok(run.startedAt && run.finishedAt);
  assert.equal(run.errorCode, null);
  assert.equal(run.result.previousStatus, 'PENDING');
  assert.equal(run.result.status, 'OVERDUE');
  assert.equal(run.result.overdueMarked, true);
  assert.equal(run.result.daysUntilDue, -3);
  assert.equal(run.result.notificationsCreated, 1);
  assert.equal((await api('GET', `/tax-obligations/${obligation.id}`, manager.accessToken)).data.status, 'OVERDUE');

  // Audit: the run is attributed to the requester; the status change to the system rule, linked to the run.
  const runEvents = (await api('GET', `/audit-logs?entityType=AutomationRun&entityId=${run.id}`, manager.accessToken)).data.data;
  assert.deepEqual(runEvents.map((event) => event.action).sort(), ['AUTOMATION_STARTED', 'AUTOMATION_SUCCEEDED']);
  assert.ok(runEvents.every((event) => event.actorEmail === 'manager@taxflow.local'), 'tax managers can see automation audit events');
  const statusEvents = (await api('GET', `/audit-logs?entityType=TaxObligation&entityId=${obligation.id}&action=UPDATE`, admin.accessToken)).data.data;
  assert.equal(statusEvents.length, 1);
  assert.equal(statusEvents[0].actorType, 'SYSTEM');
  assert.equal(statusEvents[0].metadata.automationRunId, run.id);
  assert.deepEqual(statusEvents[0].metadata.changes.status, { before: 'PENDING', after: 'OVERDUE' });

  // Notifications: the overdue alert goes to the responsible user, the confirmation to the requester.
  const analystAlerts = forObligation((await api('GET', '/notifications?limit=100', analyst.accessToken)).data.data, obligation.id);
  assert.deepEqual(analystAlerts.map((item) => [item.type, item.title]), [['DEADLINE', 'Obligación vencida']]);
  const managerNotices = forObligation((await api('GET', '/notifications?limit=100', manager.accessToken)).data.data, obligation.id);
  assert.deepEqual(managerNotices.map((item) => [item.type, item.title]), [['AUTOMATION', 'Procesamiento completado']]);
  assert.match(managerNotices[0].message, /se marcó como vencida/);

  // Idempotency: running again records a new run but changes nothing and duplicates nothing.
  const second = await api('POST', route, manager.accessToken);
  assert.equal(second.status, 201);
  assert.equal(second.data.status, 'SUCCEEDED');
  assert.equal(second.data.result.overdueMarked, false);
  assert.equal(second.data.result.notificationsCreated, 0);
  assert.equal(forObligation((await api('GET', '/notifications?limit=100', analyst.accessToken)).data.data, obligation.id).length, 1);
  assert.equal((await api('GET', `/audit-logs?entityType=TaxObligation&entityId=${obligation.id}&action=UPDATE`, admin.accessToken)).data.meta.total, 1);

  // History, newest first, readable by every authenticated role.
  const history = await api('GET', route, analyst.accessToken);
  assert.equal(history.status, 200);
  assert.deepEqual(history.data.map((item) => item.id), [second.data.id, run.id]);
  const detail = await api('GET', `/automation-runs/${run.id}`, analyst.accessToken);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.result.overdueMarked, true);

  // Obligations that no longer need follow-up are rejected without recording a run.
  assert.equal((await api('PATCH', `/tax-obligations/${obligation.id}`, manager.accessToken, { status: 'SUBMITTED' })).status, 200);
  const closed = await api('POST', route, manager.accessToken);
  assert.equal(closed.status, 409);
  assert.equal((await api('GET', route, manager.accessToken)).data.length, 2);
});

test('concurrent manual requests never run twice at the same time nor duplicate effects', async (t) => {
  const manager = await login('manager@taxflow.local');
  const analyst = await login('analyst@taxflow.local');
  const obligation = await createObligation(t, manager.accessToken, { dueDate: dateFromToday(-1), responsibleUserId: analyst.user.id });
  const route = `/tax-obligations/${obligation.id}/automation-runs`;

  const responses = await Promise.all(Array.from({ length: 5 }, () => api('POST', route, manager.accessToken)));
  const statuses = responses.map((response) => response.status);
  assert.ok(statuses.every((status) => status === 201 || status === 409), JSON.stringify(statuses));
  const runs = (await api('GET', route, manager.accessToken)).data;
  assert.equal(runs.length, statuses.filter((status) => status === 201).length);
  assert.ok(runs.every((run) => run.status === 'SUCCEEDED'));
  assert.equal(runs.filter((run) => run.result.overdueMarked).length, 1, 'the obligation is marked overdue exactly once');
  assert.equal(forObligation((await api('GET', '/notifications?limit=100', analyst.accessToken)).data.data, obligation.id).length, 1);
});

test('the scheduled deadline check processes each obligation in its own SYSTEM run', async (t) => {
  const manager = await login('manager@taxflow.local');
  const analyst = await login('analyst@taxflow.local');
  const obligation = await createObligation(t, manager.accessToken, { dueDate: dateFromToday(1), responsibleUserId: analyst.user.id });
  const route = `/tax-obligations/${obligation.id}/automation-runs`;

  const check = await api('POST', '/automation/check-deadlines', manager.accessToken);
  assert.equal(check.status, 201);
  assert.ok(check.data.checked >= 1);
  assert.equal(check.data.failed, 0);
  assert.equal(check.data.skippedActiveRun, 0);

  const [run] = (await api('GET', route, manager.accessToken)).data;
  assert.equal(run.trigger, 'SCHEDULED');
  assert.equal(run.status, 'SUCCEEDED');
  assert.equal(run.requestedBy, null);
  assert.equal(run.result.status, 'PENDING');
  assert.equal(run.result.daysUntilDue, 1);
  assert.equal(run.result.notificationsCreated, 3, '7, 3 and 1 day thresholds');
  const started = (await api('GET', `/audit-logs?entityType=AutomationRun&entityId=${run.id}&action=AUTOMATION_STARTED`, manager.accessToken)).data.data;
  assert.equal(started[0].actorType, 'SYSTEM');

  await api('POST', '/automation/check-deadlines', manager.accessToken);
  const runs = (await api('GET', route, manager.accessToken)).data;
  assert.equal(runs.length, 2);
  assert.equal(runs[0].result.notificationsCreated, 0, 'a repeated scan does not resend alerts');
  const alerts = forObligation((await api('GET', '/notifications?limit=100', analyst.accessToken)).data.data, obligation.id);
  assert.equal(alerts.length, 3);
  assert.ok(alerts.every((item) => item.type === 'DEADLINE'), 'successful scheduled runs add no automation notification');
});

test('automation run endpoints validate ids and report missing resources', async () => {
  const manager = await login('manager@taxflow.local');
  const missing = crypto.randomUUID();
  assert.equal((await api('POST', `/tax-obligations/${missing}/automation-runs`, manager.accessToken)).status, 404);
  assert.equal((await api('GET', `/tax-obligations/${missing}/automation-runs`, manager.accessToken)).status, 404);
  assert.equal((await api('GET', `/automation-runs/${missing}`, manager.accessToken)).status, 404);
  assert.equal((await api('GET', '/automation-runs/not-a-uuid', manager.accessToken)).status, 400);
  assert.equal((await api('GET', `/automation-runs/${missing}`)).status, 401);
});
