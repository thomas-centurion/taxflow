const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DeadlineAutomationService } = require('../dist/automation/deadline-automation.service');
const { NotificationsService } = require('../dist/notifications/notifications.service');

const obligationId = '8de3a564-f432-4b48-a98a-8b2e4ef85493';
const managerId = 'e75f1f9e-3963-4b0d-a70e-c2bd98cf4c3f';
const audit = { record: async () => undefined };

test('deadline automation marks past obligations overdue and sends only actionable deadline notifications', async () => {
  const savedUpdates = [];
  const notifications = [];
  const records = [
    { id: 'past', dueDate: '2026-10-05', status: 'PENDING', responsibleUserId: managerId, name: 'Past tax', company: { name: 'Acme' } },
    { id: 'soon', dueDate: '2026-10-09', status: 'PENDING', responsibleUserId: managerId, name: 'Soon tax', company: { name: 'Acme' } },
    { id: 'unassigned', dueDate: '2026-10-08', status: 'IN_PROGRESS', responsibleUserId: null, name: 'Unassigned tax', company: { name: 'Acme' } },
    { id: 'later', dueDate: '2026-10-20', status: 'PENDING', responsibleUserId: managerId, name: 'Later tax', company: { name: 'Acme' } },
  ];
  const repository = { find: async () => records.filter((record) => record.dueDate <= '2026-10-13'), findOne: async ({ where }) => records.find((record) => record.id === where.id), update: async (where, values) => { savedUpdates.push({ where, values }); } };
  const notifier = { notifyDeadline: async (obligation, days) => { notifications.push({ id: obligation.id, days }); return 1; } };
  const dataSource = { transaction: (callback) => callback({ getRepository: () => repository }) };
  const service = new DeadlineAutomationService(repository, notifier, dataSource, audit);
  const result = await service.checkDeadlines(new Date(2026, 9, 6, 12));
  assert.deepEqual(result, { checked: 3, notificationsCreated: 2, overdueMarked: 1, skippedWithoutResponsible: 1 });
  assert.equal(savedUpdates[0].values.status, 'OVERDUE');
  assert.deepEqual(notifications, [{ id: 'past', days: -1 }, { id: 'soon', days: 3 }]);
});

test('notification marking is scoped to its recipient and missing/foreign ids are indistinguishable', async () => {
  const calls = [];
  const notifications = {
    update: async (criteria, values) => { calls.push({ criteria, values }); return { affected: criteria.id === obligationId ? 1 : 0 }; },
    findOne: async ({ where }) => where.id === obligationId ? ({ id: where.id, userId: where.userId, title: 'Private', message: 'Private text', type: 'DEADLINE', isRead: false, createdAt: new Date(), taxObligation: null }) : null,
  };
  const auditRepo = { create: (record) => record, save: async (record) => record };
  const dataSource = { transaction: (callback) => callback({ getRepository: () => notifications }) };
  const service = new NotificationsService(notifications, dataSource, audit);
  const view = await service.markRead({ id: managerId }, obligationId);
  assert.equal(view.title, 'Private');
  assert.deepEqual(calls[0].criteria, { id: obligationId, userId: managerId, isRead: false });
  await assert.rejects(() => service.markRead({ id: managerId }, '00000000-0000-4000-8000-000000000000'), { status: 404 });
});

test('status changes are delivered to the assigned user and not duplicated when no assignee exists', async () => {
  const inserts = [];
  const builder = {
    insert() { return this; }, into() { return this; }, values(value) { inserts.push(value); return this; },
    orIgnore() { return this; }, execute: async () => ({ identifiers: [{ id: 'new-id' }] }),
  };
  const notificationRepo = { createQueryBuilder: () => builder };
  const dataSource = { transaction: (callback) => callback({ getRepository: (entity) => entity.name === 'AuditLog' ? { create: (record) => record, save: async (record) => record } : notificationRepo }) };
  const service = new NotificationsService(notificationRepo, dataSource, audit);
  const obligation = { id: obligationId, name: 'VAT', status: 'IN_PROGRESS', responsibleUserId: managerId, updatedAt: new Date('2026-10-06T12:00:00Z') };
  await service.notifyStatusChanged(obligation, 'PENDING');
  await service.notifyStatusChanged({ ...obligation, responsibleUserId: null }, 'PENDING');
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].userId, managerId);
  assert.match(inserts[0].dedupeKey, /^status:/);
});

test('deadline notification thresholds use separate stable idempotency keys', async () => {
  const inserts = [];
  const builder = {
    insert() { return this; }, into() { return this; }, values(value) { inserts.push(value); return this; },
    orIgnore() { return this; }, execute: async () => ({ identifiers: [{ id: 'new-id' }] }),
  };
  const notificationRepo = { createQueryBuilder: () => builder };
  const dataSource = { transaction: (callback) => callback({ getRepository: (entity) => entity.name === 'AuditLog' ? { create: (record) => record, save: async (record) => record } : notificationRepo }) };
  const service = new NotificationsService(notificationRepo, dataSource, audit);
  const obligation = { id: obligationId, name: 'VAT', dueDate: '2026-10-09', responsibleUserId: managerId, company: { name: 'ACME' } };
  assert.equal(await service.notifyDeadline(obligation, 3), 2);
  assert.deepEqual(inserts.map((item) => item.dedupeKey), [
    `deadline:7:${obligationId}:2026-10-09`, `deadline:3:${obligationId}:2026-10-09`,
  ]);
  assert.match(inserts[1].title, /urgente/);
});
