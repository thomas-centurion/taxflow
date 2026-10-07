const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AuditLogService } = require('../dist/audit/audit-log.service');
const { AuditAction } = require('../dist/audit/audit-action.enum');

test('audit recording snapshots authenticated actors and removes credentials and document internals', async () => {
  let persisted;
  const repository = { create: (record) => record, save: async (record) => { persisted = record; return record; } };
  const service = new AuditLogService(repository);
  const actor = { id: 'user-id', firstName: 'Tax', lastName: 'Manager', email: 'manager@example.local', role: 'TAX_MANAGER', isActive: true };
  const row = await service.record({
    actor,
    action: AuditAction.UPDATE,
    entity: 'User',
    metadata: { changes: { email: { before: 'old@example.local', after: 'new@example.local' } }, passwordHash: 'hash', token: 'jwt', filePath: 'private/path', content: Buffer.from('private'), passwordChanged: true },
  });

  assert.equal(row.userId, actor.id);
  assert.equal(row.actorEmail, actor.email);
  assert.equal(row.actorType, 'USER');
  assert.deepEqual(row.metadata, { changes: { email: { before: 'old@example.local', after: 'new@example.local' } }, passwordChanged: true });
  assert.equal(persisted, row);

  const system = await service.record({ actorType: 'SYSTEM', action: AuditAction.UPDATE, entity: 'TaxObligation' });
  assert.equal(system.userId, null);
  assert.equal(system.actorEmail, null);
  assert.equal(system.actorType, 'SYSTEM');
});
