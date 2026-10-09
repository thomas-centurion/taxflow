const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isOverdue, shouldBecomeOverdue, statusChangeError, todayKey, ALLOWED_STATUS_TRANSITIONS } = require('../dist/tax-obligations/tax-obligation-rules');
const { TaxObligation } = require('../dist/tax-obligations/tax-obligation.entity');
const { TaxObligationsService } = require('../dist/tax-obligations/tax-obligations.service');
const { DeadlineAutomationService } = require('../dist/automation/deadline-automation.service');

const uuid = '8de3a564-f432-4b48-a98a-8b2e4ef85493';
const audit = { record: async () => undefined };
const today = '2026-10-07';
const PAST = '2000-01-01';
const FUTURE = '2099-12-31';

test('PENDING and IN_PROGRESS obligations past their due date are overdue', () => {
  assert.equal(isOverdue('PENDING', '2026-10-06', today), true);
  assert.equal(isOverdue('IN_PROGRESS', '2026-10-06', today), true);
  assert.equal(shouldBecomeOverdue('PENDING', '2026-10-06', today), true);
  assert.equal(isOverdue('OVERDUE', '2026-10-06', today), true);
});

test('obligations due today or later are not overdue', () => {
  assert.equal(isOverdue('PENDING', today, today), false);
  assert.equal(isOverdue('IN_PROGRESS', '2026-10-08', today), false);
});

test('APPROVED, CANCELLED and SUBMITTED obligations are never overdue by date', () => {
  for (const status of ['APPROVED', 'CANCELLED', 'SUBMITTED']) {
    assert.equal(isOverdue(status, PAST, today), false, status);
    assert.equal(shouldBecomeOverdue(status, PAST, today), false, status);
  }
});

test('todayKey uses the local calendar date', () => {
  assert.equal(todayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('entity exposes the derived isOverdue flag after load', () => {
  const overdue = Object.assign(new TaxObligation(), { status: 'PENDING', dueDate: PAST });
  const approved = Object.assign(new TaxObligation(), { status: 'APPROVED', dueDate: PAST });
  overdue.computeOverdue();
  approved.computeOverdue();
  assert.equal(overdue.isOverdue, true);
  assert.equal(approved.isOverdue, false);
});

test('valid status transitions are accepted', () => {
  const valid = [
    ['PENDING', 'IN_PROGRESS', FUTURE], ['PENDING', 'SUBMITTED', FUTURE], ['PENDING', 'CANCELLED', FUTURE],
    ['IN_PROGRESS', 'PENDING', FUTURE], ['IN_PROGRESS', 'SUBMITTED', FUTURE], ['IN_PROGRESS', 'CANCELLED', FUTURE],
    ['SUBMITTED', 'APPROVED', FUTURE], ['SUBMITTED', 'IN_PROGRESS', FUTURE],
    ['PENDING', 'OVERDUE', PAST], ['IN_PROGRESS', 'OVERDUE', PAST],
    ['OVERDUE', 'SUBMITTED', PAST], ['OVERDUE', 'CANCELLED', PAST], ['OVERDUE', 'IN_PROGRESS', FUTURE], ['OVERDUE', 'PENDING', FUTURE],
    ['APPROVED', 'APPROVED', PAST], ['CANCELLED', 'CANCELLED', PAST],
  ];
  for (const [from, to, dueDate] of valid) assert.equal(statusChangeError(from, to, dueDate, today), null, `${from} -> ${to}`);
});

test('invalid status transitions are rejected', () => {
  const invalid = [
    ['APPROVED', 'PENDING', FUTURE], ['APPROVED', 'OVERDUE', PAST], ['CANCELLED', 'IN_PROGRESS', FUTURE],
    ['SUBMITTED', 'PENDING', FUTURE], ['SUBMITTED', 'OVERDUE', PAST], ['PENDING', 'APPROVED', FUTURE],
    ['IN_PROGRESS', 'APPROVED', FUTURE],
  ];
  for (const [from, to, dueDate] of invalid) assert.match(statusChangeError(from, to, dueDate, today), /Invalid status transition/, `${from} -> ${to}`);
  for (const status of ['APPROVED', 'CANCELLED']) assert.deepEqual(ALLOWED_STATUS_TRANSITIONS[status], []);
});

test('OVERDUE must stay coherent with the due date', () => {
  assert.match(statusChangeError('PENDING', 'OVERDUE', FUTURE, today), /past due date/);
  assert.match(statusChangeError('PENDING', 'OVERDUE', today, today), /past due date/);
  assert.match(statusChangeError(null, 'OVERDUE', FUTURE, today), /past due date/);
  assert.match(statusChangeError('OVERDUE', 'OVERDUE', FUTURE, today), /past due date/);
  assert.match(statusChangeError('OVERDUE', 'PENDING', PAST, today), /reopened/);
  assert.equal(statusChangeError(null, 'OVERDUE', PAST, today), null);
});

function obligationsService(existing) {
  let saved = false;
  const obligations = { findOne: async () => ({ ...existing }), save: async (record) => { saved = true; return record; }, create: (record) => record };
  const companies = { findOne: async () => ({ id: uuid, countryId: uuid }) };
  const users = { findOneBy: async () => ({ id: uuid, isActive: true }) };
  const notifications = { notifyStatusChanged: async () => undefined };
  const manager = { getRepository: () => obligations };
  const service = new TaxObligationsService(obligations, companies, users, {}, notifications, { transaction: (callback) => callback(manager) }, audit);
  return { service, wasSaved: () => saved };
}

const baseObligation = { id: uuid, companyId: uuid, countryId: uuid, responsibleUserId: uuid, name: 'VAT', type: 'VAT', dueDate: FUTURE, updatedAt: new Date() };

test('TaxObligationsService rejects invalid transitions with 409 and does not persist', async () => {
  const { service, wasSaved } = obligationsService({ ...baseObligation, status: 'APPROVED' });
  await assert.rejects(() => service.update(uuid, { status: 'PENDING' }, { id: uuid }), { status: 409 });
  assert.equal(wasSaved(), false);
});

test('TaxObligationsService rejects manual OVERDUE with a future due date', async () => {
  const { service, wasSaved } = obligationsService({ ...baseObligation, status: 'PENDING' });
  await assert.rejects(() => service.update(uuid, { status: 'OVERDUE' }, { id: uuid }), { status: 409 });
  assert.equal(wasSaved(), false);
  await assert.rejects(() => service.create({ ...baseObligation, status: 'OVERDUE' }, { id: uuid }), { status: 409 });
});

test('TaxObligationsService rejects moving an OVERDUE obligation to a future date without changing its status', async () => {
  const { service } = obligationsService({ ...baseObligation, status: 'OVERDUE', dueDate: PAST });
  await assert.rejects(() => service.update(uuid, { status: 'OVERDUE', dueDate: FUTURE }, { id: uuid }), { status: 409 });
});

test('TaxObligationsService accepts valid transitions and unchanged final statuses', async () => {
  const submitted = obligationsService({ ...baseObligation, status: 'SUBMITTED' });
  await submitted.service.update(uuid, { status: 'APPROVED' }, { id: uuid });
  assert.equal(submitted.wasSaved(), true);

  const approved = obligationsService({ ...baseObligation, status: 'APPROVED' });
  await approved.service.update(uuid, { status: 'APPROVED', name: 'VAT renamed' }, { id: uuid });
  assert.equal(approved.wasSaved(), true);
});

test('deadline automation marks only PENDING/IN_PROGRESS as OVERDUE and never SUBMITTED, APPROVED or CANCELLED', async () => {
  const updates = [];
  const records = [
    { id: 'pending', dueDate: '2026-10-01', status: 'PENDING', responsibleUserId: null, company: { name: 'Acme' } },
    { id: 'in-progress', dueDate: '2026-10-01', status: 'IN_PROGRESS', responsibleUserId: null, company: { name: 'Acme' } },
    { id: 'submitted', dueDate: '2026-10-01', status: 'SUBMITTED', responsibleUserId: null, company: { name: 'Acme' } },
    { id: 'approved', dueDate: '2026-10-01', status: 'APPROVED', responsibleUserId: null, company: { name: 'Acme' } },
    { id: 'cancelled', dueDate: '2026-10-01', status: 'CANCELLED', responsibleUserId: null, company: { name: 'Acme' } },
  ];
  let queriedStatuses;
  const repository = {
    find: async ({ where }) => { queriedStatuses = where.status.value; return records; },
    findOne: async ({ where }) => ({ ...records.find((record) => record.id === where.id) }),
    update: async (where, values) => { updates.push({ id: where.id, values }); return { affected: 1 }; },
  };
  const dataSource = { transaction: (callback) => callback({ getRepository: () => repository }) };
  const service = new DeadlineAutomationService(repository, { notifyDeadline: async () => 0 }, dataSource, audit, { begin: async (id, trigger) => ({ id: `run-${id}`, taxObligationId: id, trigger }), succeed: async (run, _obligation, result) => { run.status = 'SUCCEEDED'; run.result = result; }, fail: async (run) => { run.status = 'FAILED'; } });
  const result = await service.checkDeadlines(new Date(2026, 9, 7, 12));
  assert.deepEqual([...queriedStatuses].sort(), ['IN_PROGRESS', 'OVERDUE', 'PENDING']);
  assert.deepEqual(updates.map((update) => update.id), ['pending', 'in-progress']);
  assert.ok(updates.every((update) => update.values.status === 'OVERDUE'));
  assert.equal(result.overdueMarked, 2);
});
