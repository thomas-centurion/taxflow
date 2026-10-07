const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UserRole } = require('../dist/users/user-role.enum');
const { CompaniesService } = require('../dist/companies/companies.service');

const audit = { record: async () => undefined };
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const actor = { id: ADMIN_ID, email: 'admin@example.local', role: UserRole.ADMIN };

function companiesService({ hasObligations }) {
  const existing = { id: ADMIN_ID, name: 'ACME', taxId: 'T-1', countryId: 'old-country', email: null, phone: null, isActive: true, country: { id: 'old-country', code: 'AR' } };
  let saved;
  const companies = { findOne: async () => ({ ...existing }), save: async (record) => { saved = record; return record; } };
  const obligations = { existsBy: async () => hasObligations };
  const manager = { getRepository: (entity) => (entity.name === 'TaxObligation' ? obligations : companies) };
  const service = new CompaniesService(companies, { existsBy: async () => true }, { transaction: (callback) => callback(manager) }, audit);
  return { service, saved: () => saved };
}

test('company country changes persist without the stale relation and are blocked when obligations exist', async () => {
  const free = companiesService({ hasObligations: false });
  await free.service.update(ADMIN_ID, { countryId: 'new-country' }, actor);
  assert.equal(free.saved().countryId, 'new-country');
  assert.equal('country' in free.saved(), false);

  const used = companiesService({ hasObligations: true });
  await assert.rejects(() => used.service.update(ADMIN_ID, { countryId: 'new-country' }, actor), { status: 409 });
  assert.equal(used.saved(), undefined);
  await used.service.update(ADMIN_ID, { name: 'ACME renamed' }, actor);
  assert.equal(used.saved().name, 'ACME renamed', 'other fields remain editable');
});
