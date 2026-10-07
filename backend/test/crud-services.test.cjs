const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { UsersService } = require('../dist/users/users.service');
const { CompaniesService } = require('../dist/companies/companies.service');
const { TaxObligationsService } = require('../dist/tax-obligations/tax-obligations.service');
const { UserRole } = require('../dist/users/user-role.enum');
const { TaxObligationType } = require('../dist/tax-obligations/tax-obligation-type.enum');
const { TaxObligationStatus } = require('../dist/tax-obligations/tax-obligation-status.enum');

const uuid = '8de3a564-f432-4b48-a98a-8b2e4ef85493';
const audit = { record: async () => undefined };
const dataSource = (repos) => ({ transaction: (callback) => callback({ getRepository: (entity) => repos[entity.name] }) });

test('UsersService hashes credentials and never returns the hash', async () => {
  let saved;
  const repo = {
    create: (record) => record,
    save: async (record) => { saved = { id: uuid, ...record }; return saved; },
    findOneBy: async ({ id }) => ({ id, firstName: 'Test', lastName: 'User', email: 'test@example.local', role: UserRole.ANALYST, isActive: true }),
  };
  const service = new UsersService(repo, dataSource({ User: repo }), audit);
  const result = await service.create({ firstName: 'Test', lastName: 'User', email: ' TEST@example.local ', password: 'ValidPassword123!', role: UserRole.ANALYST });
  assert.equal(await bcrypt.compare('ValidPassword123!', saved.passwordHash), true);
  assert.equal(result.email, 'test@example.local');
  assert.equal('passwordHash' in result, false);
  assert.equal('password' in result, false);
});

test('CompaniesService rejects a missing country before persistence', async () => {
  let saved = false;
  const companies = { save: async () => { saved = true; }, create: (record) => record };
  const countries = { existsBy: async () => false };
  const service = new CompaniesService(companies, countries);
  await assert.rejects(() => service.create({ name: 'Company', taxId: 'T-1', countryId: uuid }), { status: 404 });
  assert.equal(saved, false);
});

test('TaxObligationsService rejects mismatched company and country', async () => {
  let saved = false;
  const obligations = { create: (record) => record, save: async () => { saved = true; } };
  const companies = { findOne: async () => ({ id: uuid, countryId: uuid }) };
  const users = { findOneBy: async () => ({ id: uuid, isActive: true }) };
  const documents = { countBy: async () => 0 };
  const service = new TaxObligationsService(obligations, companies, users, documents);
  await assert.rejects(() => service.create({
    companyId: uuid,
    countryId: 'e75f1f9e-3963-4b0d-a70e-c2bd98cf4c3f',
    name: 'IVA test', type: TaxObligationType.VAT, status: TaxObligationStatus.PENDING,
    dueDate: '2027-10-10', responsibleUserId: uuid,
  }), { status: 400 });
  assert.equal(saved, false);
});

test('TaxObligationsService notifies the responsible user only when status changes', async () => {
  const existing = { id: uuid, companyId: uuid, countryId: uuid, responsibleUserId: uuid, name: 'VAT', type: 'VAT', status: 'PENDING', dueDate: '2027-10-10', updatedAt: new Date('2026-01-01T00:00:00Z') };
  const updated = { ...existing, status: 'IN_PROGRESS', updatedAt: new Date('2026-01-02T00:00:00Z') };
  const rows = [existing, existing, updated];
  let notification;
  const obligations = { findOne: async () => rows.shift(), save: async (record) => ({ ...record, ...updated }) };
  const companies = { findOne: async () => ({ id: uuid, countryId: uuid }) };
  const users = { findOneBy: async () => ({ id: uuid, isActive: true }) };
  const documents = { countBy: async () => 0 };
  const notifications = { notifyStatusChanged: async (record, previousStatus) => { notification = { record, previousStatus }; } };
  const manager = { getRepository: () => obligations };
  const service = new TaxObligationsService(obligations, companies, users, documents, notifications, { transaction: (callback) => callback(manager) }, audit);
  await service.update(uuid, { status: 'IN_PROGRESS' });
  assert.equal(notification.previousStatus, 'PENDING');
  assert.equal(notification.record.status, 'IN_PROGRESS');
});

test('TaxObligationsService.update persists reassigned FKs without stale relation objects and returns reloaded relations', async () => {
  const oldId = '11111111-1111-4111-8111-111111111111';
  const newId = '22222222-2222-4222-8222-222222222222';
  const current = {
    id: uuid, companyId: oldId, countryId: oldId, responsibleUserId: oldId, name: 'VAT', type: 'VAT', status: 'PENDING', dueDate: '2099-10-10', updatedAt: new Date(),
    company: { id: oldId, name: 'Old company' }, country: { id: oldId, code: 'AR' }, responsibleUser: { id: oldId, email: 'old@example.local' },
  };
  const reloaded = { ...current, companyId: newId, countryId: newId, responsibleUserId: newId, company: { id: newId, name: 'New company' }, country: { id: newId, code: 'BR' }, responsibleUser: { id: newId, email: 'new@example.local' } };
  const rows = [current, current, reloaded];
  let savedRecord;
  const obligations = { findOne: async () => rows.shift(), save: async (record) => { savedRecord = record; return record; } };
  const companies = { findOne: async () => ({ id: newId, countryId: newId }) };
  const users = { findOneBy: async () => ({ id: newId, isActive: true }) };
  const notifications = { notifyStatusChanged: async () => undefined };
  const service = new TaxObligationsService(obligations, companies, users, {}, notifications, { transaction: (callback) => callback({ getRepository: () => obligations }) }, audit);

  const result = await service.update(uuid, { companyId: newId, countryId: newId, responsibleUserId: newId }, { id: uuid });

  assert.equal(savedRecord.companyId, newId);
  assert.equal(savedRecord.countryId, newId);
  assert.equal(savedRecord.responsibleUserId, newId);
  for (const relation of ['company', 'country', 'responsibleUser']) assert.equal(relation in savedRecord, false, `${relation} must not be saved`);
  assert.equal(result.company.name, 'New company');
  assert.equal(result.responsibleUser.email, 'new@example.local');
});
