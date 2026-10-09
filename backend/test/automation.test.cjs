const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConflictException } = require('@nestjs/common');
const { AutomationRunsService, AutomationError } = require('../dist/automation/automation-runs.service');
const { DeadlineAutomationService } = require('../dist/automation/deadline-automation.service');
const { DeadlineSchedulerService } = require('../dist/automation/deadline-scheduler.service');
const { NotificationsService } = require('../dist/notifications/notifications.service');

const OBLIGATION_ID = '11111111-1111-4111-8111-111111111111';
const REQUESTER_ID = '22222222-2222-4222-8222-222222222222';
const RESPONSIBLE_ID = '33333333-3333-4333-8333-333333333333';
const requester = { id: REQUESTER_ID, firstName: 'Taylor', lastName: 'Manager', email: 'manager@example.local', role: 'TAX_MANAGER', isActive: true };
const NOW = new Date(2026, 9, 8, 12);

function runsHarness({ duplicate = false, stale = [] } = {}) {
  const rows = new Map();
  const calls = { audit: [], notifications: [] };
  const repository = {
    create: (data) => ({ ...data }),
    save: async (run) => {
      if (duplicate && !run.id) throw Object.assign(new Error('duplicate key'), { driverError: { code: '23505' } });
      const stored = Object.assign(run, { id: run.id ?? `run-${rows.size + 1}`, createdAt: run.createdAt ?? new Date(), startedAt: run.startedAt ?? null, finishedAt: run.finishedAt ?? null, errorCode: run.errorCode ?? null, errorMessage: run.errorMessage ?? null, result: run.result ?? null });
      rows.set(stored.id, { ...stored });
      return stored;
    },
    find: async () => stale,
    findOne: async ({ where }) => (rows.has(where.id) ? { ...rows.get(where.id), requestedBy: null } : null),
  };
  const notifications = { notifyAutomationResult: async (input) => { calls.notifications.push(input); } };
  const audit = { record: async (event) => { calls.audit.push(event); } };
  return { service: new AutomationRunsService(repository, notifications, audit), rows, calls };
}

const obligation = (overrides = {}) => ({
  id: OBLIGATION_ID, name: 'IVA mensual', status: 'PENDING', dueDate: '2026-10-05', responsibleUserId: RESPONSIBLE_ID,
  company: { name: 'ACME Argentina' }, ...overrides,
});

test('a run is recorded as PENDING, moved to RUNNING and audited with its trigger and actor', async () => {
  const { service, rows, calls } = runsHarness();
  const statuses = [];
  const save = service.runs.save;
  service.runs.save = async (run) => { statuses.push(run.status); return save(run); };

  const manual = await service.begin(OBLIGATION_ID, 'MANUAL', requester);
  assert.deepEqual(statuses, ['PENDING', 'RUNNING']);
  assert.equal(rows.get(manual.id).status, 'RUNNING');
  assert.ok(manual.startedAt instanceof Date);
  assert.equal(calls.audit[0].action, 'AUTOMATION_STARTED');
  assert.equal(calls.audit[0].actor, requester);
  assert.deepEqual(calls.audit[0].metadata, { taxObligationId: OBLIGATION_ID, trigger: 'MANUAL' });

  await service.begin(OBLIGATION_ID, 'SCHEDULED', null);
  assert.equal(calls.audit[1].actorType, 'SYSTEM');
  assert.equal(rows.get('run-2').requestedById, null);
});

test('a second active run for the same obligation is rejected with 409 (partial unique index)', async () => {
  const { service } = runsHarness({ duplicate: true });
  await assert.rejects(() => service.begin(OBLIGATION_ID, 'MANUAL', requester), ConflictException);
});

test('a successful manual run stores the result, audits and confirms to the requester only', async () => {
  const { service, rows, calls } = runsHarness();
  const run = await service.begin(OBLIGATION_ID, 'MANUAL', requester);
  await service.succeed(run, obligation(), { previousStatus: 'PENDING', status: 'OVERDUE', overdueMarked: true, notificationsCreated: 1, withoutResponsible: false }, requester);
  const stored = rows.get(run.id);
  assert.equal(stored.status, 'SUCCEEDED');
  assert.ok(stored.finishedAt instanceof Date);
  assert.equal(typeof stored.result.durationMs, 'number');
  assert.equal(stored.result.overdueMarked, true);
  assert.equal(calls.audit.at(-1).action, 'AUTOMATION_SUCCEEDED');
  assert.equal(calls.notifications.length, 1);
  assert.deepEqual(calls.notifications[0].userIds, [REQUESTER_ID]);
  assert.match(calls.notifications[0].message, /se marcó como vencida, 1 alerta de vencimiento enviada/);
});

test('a successful scheduled run does not add an automation notification', async () => {
  const { service, calls } = runsHarness();
  const run = await service.begin(OBLIGATION_ID, 'SCHEDULED', null);
  await service.succeed(run, obligation(), { overdueMarked: false, notificationsCreated: 0 }, null);
  assert.equal(calls.notifications.length, 0);
  assert.equal(calls.audit.at(-1).actorType, 'SYSTEM');
});

test('a failed run keeps a stable code, never the raw message of unexpected errors, and notifies requester and responsible', async () => {
  const { service, rows, calls } = runsHarness();
  const run = await service.begin(OBLIGATION_ID, 'MANUAL', requester);
  await service.fail(run, obligation(), new Error('connection to 10.0.0.5 failed: internal detail'), requester);
  const stored = rows.get(run.id);
  assert.equal(stored.status, 'FAILED');
  assert.equal(stored.errorCode, 'INTERNAL_ERROR');
  assert.equal(stored.errorMessage.includes('10.0.0.5'), false);
  assert.equal(calls.audit.at(-1).action, 'AUTOMATION_FAILED');
  assert.equal(JSON.stringify(calls.audit).includes('10.0.0.5'), false);
  assert.deepEqual(calls.notifications[0].userIds, [REQUESTER_ID, RESPONSIBLE_ID]);
  assert.equal(calls.notifications[0].title, 'Procesamiento fallido');

  const second = await service.begin(OBLIGATION_ID, 'SCHEDULED', null);
  await service.fail(second, obligation(), new AutomationError('NOT_PROCESSABLE', 'The obligation is SUBMITTED.'), null);
  assert.equal(rows.get(second.id).errorCode, 'NOT_PROCESSABLE');
  assert.equal(rows.get(second.id).errorMessage, 'The obligation is SUBMITTED.');
});

test('runs left PENDING or RUNNING by a restart are marked FAILED (INTERRUPTED) on startup', async () => {
  const stale = [
    { id: 'stale-1', taxObligationId: OBLIGATION_ID, trigger: 'SCHEDULED', status: 'RUNNING', startedAt: new Date(Date.now() - 1000), requestedById: null, taxObligation: obligation() },
    { id: 'stale-2', taxObligationId: OBLIGATION_ID, trigger: 'MANUAL', status: 'PENDING', startedAt: null, requestedById: REQUESTER_ID, taxObligation: obligation() },
  ];
  const { service, rows, calls } = runsHarness({ stale });
  await service.onApplicationBootstrap();
  assert.deepEqual([...rows.values()].map((run) => [run.id, run.status, run.errorCode]), [['stale-1', 'FAILED', 'INTERRUPTED'], ['stale-2', 'FAILED', 'INTERRUPTED']]);
  assert.ok(calls.audit.every((event) => event.actorType === 'SYSTEM' && event.action === 'AUTOMATION_FAILED'));
});

function processingHarness(records, { begin } = {}) {
  const updates = [];
  const audit = [];
  const runCalls = [];
  const repository = {
    find: async () => records,
    findOne: async ({ where }) => { const record = records.find((item) => item.id === where.id); return record ? { ...record } : null; },
    findOneBy: async ({ id }) => records.find((item) => item.id === id) ?? null,
    update: async (where, values) => { updates.push({ id: where.id, values }); return { affected: where.id === 'raced' ? 0 : 1 }; },
  };
  const runs = {
    begin: begin ?? (async (id, trigger, actor) => { runCalls.push(['begin', id, trigger, actor?.id ?? null]); return { id: `run-${id}`, taxObligationId: id, trigger, status: 'RUNNING' }; }),
    succeed: async (run, _obligation, result) => { runCalls.push(['succeed', run.taxObligationId]); run.status = 'SUCCEEDED'; run.result = result; },
    fail: async (run, _obligation, error) => { runCalls.push(['fail', run.taxObligationId, error.code]); run.status = 'FAILED'; },
    findOne: async (id) => ({ id, status: 'SUCCEEDED' }),
  };
  const notifier = { notifyDeadline: async () => 1 };
  const dataSource = { transaction: (callback) => callback({ getRepository: () => repository }) };
  const service = new DeadlineAutomationService(repository, notifier, dataSource, { record: async (event) => { audit.push(event); } }, runs);
  return { service, updates, audit, runCalls };
}

test('processing an obligation marks it overdue through the existing rule, links the audit to the run and alerts the responsible', async () => {
  const { service, updates, audit, runCalls } = processingHarness([obligation({ id: 'past' })]);
  const result = await service.checkDeadlines(NOW);
  assert.deepEqual(updates, [{ id: 'past', values: { status: 'OVERDUE' } }]);
  assert.equal(audit[0].actorType, 'SYSTEM');
  assert.equal(audit[0].metadata.automationRunId, 'run-past');
  assert.deepEqual(runCalls, [['begin', 'past', 'SCHEDULED', null], ['succeed', 'past']]);
  assert.deepEqual(result, { checked: 1, notificationsCreated: 1, overdueMarked: 1, skippedWithoutResponsible: 0, skippedActiveRun: 0, failed: 0 });
});

test('a status change that races the overdue update fails the run instead of auditing a change that did not happen', async () => {
  const { service, audit, runCalls } = processingHarness([obligation({ id: 'raced' })]);
  const result = await service.checkDeadlines(NOW);
  assert.equal(audit.length, 0);
  assert.deepEqual(runCalls.at(-1), ['fail', 'raced', 'NOT_PROCESSABLE']);
  assert.equal(result.overdueMarked, 0);
  assert.equal(result.failed, 1);
});

test('the scheduled batch skips obligations already being processed and keeps going after a failure', async () => {
  const records = [obligation({ id: 'busy' }), obligation({ id: 'broken' }), obligation({ id: 'submitted', status: 'SUBMITTED' }), obligation({ id: 'ok', dueDate: '2026-10-10' })];
  const begin = async (id, trigger) => {
    if (id === 'busy') throw new ConflictException('already running');
    if (id === 'broken') throw new Error('database unavailable');
    return { id: `run-${id}`, taxObligationId: id, trigger, status: 'RUNNING' };
  };
  const { service, runCalls } = processingHarness(records, { begin });
  const result = await service.checkDeadlines(NOW);
  assert.equal(result.skippedActiveRun, 1);
  assert.equal(result.failed, 2, 'the crash and the obligation that is no longer processable');
  assert.deepEqual(runCalls, [['fail', 'submitted', 'NOT_PROCESSABLE'], ['succeed', 'ok']]);
});

test('manual processing validates the obligation and runs as the requesting user', async () => {
  const { service, runCalls } = processingHarness([obligation({ id: OBLIGATION_ID, dueDate: '2026-10-20' }), obligation({ id: 'done', status: 'APPROVED' })]);
  await assert.rejects(() => service.processObligation('missing', requester, NOW), { status: 404 });
  await assert.rejects(() => service.processObligation('done', requester, NOW), { status: 409 });
  assert.equal(runCalls.length, 0, 'no run is recorded for rejected requests');
  const view = await service.processObligation(OBLIGATION_ID, requester, NOW);
  assert.equal(view.id, `run-${OBLIGATION_ID}`);
  assert.deepEqual(runCalls, [['begin', OBLIGATION_ID, 'MANUAL', REQUESTER_ID], ['succeed', OBLIGATION_ID]]);
});

test('the daily scheduler runs the deadline processing and never throws', async () => {
  let calls = 0;
  await new DeadlineSchedulerService({ checkDeadlines: async () => { calls += 1; } }).runDailyCheck();
  const failing = new DeadlineSchedulerService({ checkDeadlines: async () => { calls += 1; throw new Error('boom'); } });
  failing.logger.error = () => undefined;
  await failing.runDailyCheck();
  assert.equal(calls, 2);
});

test('automation notifications go once to each distinct recipient', async () => {
  const created = [];
  const service = new NotificationsService({}, {}, {});
  service.createOnce = async (input) => { created.push(input); return true; };
  await service.notifyAutomationResult({ runId: 'run-1', taxObligationId: OBLIGATION_ID, userIds: [REQUESTER_ID, REQUESTER_ID, null], title: 'T', message: 'M' });
  assert.equal(created.length, 1);
  assert.equal(created[0].type, 'AUTOMATION');
  assert.equal(created[0].dedupeKey, `automation:run-1:${REQUESTER_ID}`);
});
