const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { UsersService } = require('../dist/users/users.service');
const { UsersController } = require('../dist/users/users.controller');
const { UserRole } = require('../dist/users/user-role.enum');
const { ROLES_KEY } = require('../dist/auth/roles.decorator');
const { AuthService } = require('../dist/auth/auth.service');
const { LoginThrottlerGuard } = require('../dist/auth/login-throttler.guard');
const { AuditLogService, startOfLocalDay } = require('../dist/audit/audit-log.service');
const { CompaniesService } = require('../dist/companies/companies.service');

const audit = { record: async () => undefined };
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const actor = { id: ADMIN_ID, email: 'admin@example.local', role: UserRole.ADMIN };

function usersService({ target, activeAdmins }) {
  const calls = { saved: false, removed: false, locked: false };
  const builder = {
    addSelect() { return this; }, where() { return this; },
    setLock(mode) { calls.locked = mode === 'pessimistic_write'; return this; },
    getOne: async () => ({ ...target, passwordHash: 'hash' }),
    getMany: async () => activeAdmins,
  };
  const repository = {
    createQueryBuilder: () => builder,
    findOneBy: async () => ({ ...target }),
    save: async (record) => { calls.saved = true; return record; },
    remove: async () => { calls.removed = true; },
  };
  const service = new UsersService(repository, { transaction: (callback) => callback({ getRepository: () => repository }) }, audit);
  return { service, calls };
}

const lastAdmin = { id: ADMIN_ID, role: UserRole.ADMIN, isActive: true, firstName: 'A', lastName: 'B', email: 'admin@example.local' };

test('the last active ADMIN cannot be demoted, deactivated or deleted, including by itself', async () => {
  for (const input of [{ role: UserRole.ANALYST }, { role: UserRole.TAX_MANAGER }, { isActive: false }, { role: UserRole.ANALYST, isActive: false }]) {
    const { service, calls } = usersService({ target: lastAdmin, activeAdmins: [lastAdmin] });
    await assert.rejects(() => service.update(ADMIN_ID, input, actor), { status: 409 }, JSON.stringify(input));
    assert.equal(calls.saved, false);
    assert.equal(calls.locked, true, 'active admins are locked while checking');
  }
  const { service, calls } = usersService({ target: lastAdmin, activeAdmins: [lastAdmin] });
  await assert.rejects(() => service.remove(ADMIN_ID, { ...actor, id: OTHER_ADMIN_ID }), { status: 409 });
  assert.equal(calls.removed, false);
});

test('ADMIN changes are allowed while another active ADMIN remains', async () => {
  const other = { ...lastAdmin, id: OTHER_ADMIN_ID };
  const demote = usersService({ target: lastAdmin, activeAdmins: [lastAdmin, other] });
  await demote.service.update(ADMIN_ID, { role: UserRole.ANALYST }, actor);
  assert.equal(demote.calls.saved, true);
  const remove = usersService({ target: lastAdmin, activeAdmins: [lastAdmin, other] });
  await remove.service.remove(ADMIN_ID, { ...actor, id: OTHER_ADMIN_ID });
  assert.equal(remove.calls.removed, true);
});

test('changes that keep the ADMIN active, or target non-admins and inactive admins, skip the admin check', async () => {
  const rename = usersService({ target: lastAdmin, activeAdmins: [lastAdmin] });
  await rename.service.update(ADMIN_ID, { firstName: 'Renamed' }, actor);
  assert.equal(rename.calls.saved, true);
  assert.equal(rename.calls.locked, false);
  const analyst = usersService({ target: { ...lastAdmin, role: UserRole.ANALYST }, activeAdmins: [] });
  await analyst.service.update(ADMIN_ID, { isActive: false }, actor);
  assert.equal(analyst.calls.saved, true);
  const inactiveAdmin = usersService({ target: { ...lastAdmin, isActive: false }, activeAdmins: [] });
  await inactiveAdmin.service.update(ADMIN_ID, { role: UserRole.ANALYST }, actor);
  assert.equal(inactiveAdmin.calls.saved, true);
});

test('user listing is restricted to ADMIN/TAX_MANAGER; options are open to every authenticated role', () => {
  const roles = (method) => Reflect.getMetadata(ROLES_KEY, UsersController.prototype[method]);
  assert.deepEqual(roles('findAll'), [UserRole.ADMIN, UserRole.TAX_MANAGER]);
  assert.deepEqual(roles('findOne'), [UserRole.ADMIN, UserRole.TAX_MANAGER]);
  assert.equal(roles('findOptions'), undefined);
});

test('user options expose only active users identity fields', async () => {
  let where;
  const repository = { find: async (options) => { where = options.where; return [{ id: ADMIN_ID, firstName: 'A', lastName: 'B', email: 'a@example.local', role: 'ADMIN', isActive: true, createdAt: new Date() }]; } };
  const options = await new UsersService(repository, {}, audit).findOptions();
  assert.deepEqual(where, { isActive: true });
  assert.deepEqual(options, [{ id: ADMIN_ID, firstName: 'A', lastName: 'B', email: 'a@example.local' }]);
});

test('login throttling is keyed by IP and normalized email', async () => {
  const tracker = (req) => LoginThrottlerGuard.prototype.getTracker.call({}, req);
  assert.equal(await tracker({ ip: '10.0.0.1', body: { email: ' User@Example.local ' } }), '10.0.0.1:user@example.local');
  assert.equal(await tracker({ ip: '10.0.0.1', body: { email: 42 } }), '10.0.0.1:');
  assert.equal(await tracker({ ip: '10.0.0.1' }), '10.0.0.1:');
});

function authService(user) {
  const events = [];
  let compared = 0;
  const builder = { addSelect() { return this; }, where() { return this; }, getOne: async () => user };
  const service = new AuthService({ createQueryBuilder: () => builder }, { signAsync: async () => 'token' }, { record: async (event) => { events.push(event); } });
  const originalCompare = bcrypt.compare;
  return { service, events, run: async (fn) => { bcrypt.compare = async (...args) => { compared += 1; return originalCompare(...args); }; try { return await fn(); } finally { bcrypt.compare = originalCompare; } }, compared: () => compared };
}

test('failed logins are audited without passwords or unknown emails and always run bcrypt', async () => {
  const unknown = authService(null);
  await unknown.run(() => assert.rejects(() => unknown.service.login({ email: 'Secret-Typed-In-Email', password: 'Wrong123!' }), { status: 401, message: 'Invalid credentials' }));
  assert.equal(unknown.compared(), 1, 'unknown accounts still pay the bcrypt cost');
  assert.deepEqual(unknown.events.map((event) => event.action), ['LOGIN_FAILED']);
  assert.equal(JSON.stringify(unknown.events).includes('Secret-Typed-In-Email'), false);
  assert.equal(JSON.stringify(unknown.events).includes('Wrong123!'), false);

  const passwordHash = await bcrypt.hash('Correct123!', 4);
  const inactive = authService({ id: ADMIN_ID, email: 'inactive@example.local', isActive: false, role: 'ANALYST', passwordHash });
  await inactive.run(() => assert.rejects(() => inactive.service.login({ email: 'inactive@example.local', password: 'Correct123!' }), { status: 401, message: 'Invalid credentials' }));
  assert.equal(inactive.compared(), 1);
  assert.deepEqual(inactive.events[0].metadata, { email: 'inactive@example.local' });
});

test('audit date filters use local calendar days and reject inverted ranges', async () => {
  assert.equal(startOfLocalDay('2026-10-07').getTime(), new Date(2026, 9, 7).getTime());
  assert.equal(startOfLocalDay('2026-12-31', 1).getTime(), new Date(2027, 0, 1).getTime());
  assert.equal(startOfLocalDay('2028-02-28', 1).getTime(), new Date(2028, 1, 29).getTime());
  const builder = { leftJoinAndSelect() { return this; }, andWhere() { return this; }, orderBy() { return this; }, addOrderBy() { return this; }, skip() { return this; }, take() { return this; }, getManyAndCount: async () => [[], 0] };
  const service = new AuditLogService({ createQueryBuilder: () => builder });
  await assert.rejects(() => service.findAll({ page: 1, limit: 20, dateFrom: '2026-10-08', dateTo: '2026-10-01' }, UserRole.ADMIN), { status: 400 });
  await service.findAll({ page: 1, limit: 20, dateFrom: '2026-10-07', dateTo: '2026-10-07' }, UserRole.ADMIN);
});

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
