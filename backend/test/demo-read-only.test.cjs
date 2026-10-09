const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { DemoReadOnlyGuard } = require('../dist/auth/demo-read-only.guard');
const { ALLOW_READ_ONLY_DEMO_KEY, ReadOnlyAccounts, parseEmailList } = require('../dist/auth/read-only-accounts');
const { RolesGuard } = require('../dist/auth/roles.guard');
const { ROLES_KEY } = require('../dist/auth/roles.decorator');

const demo = { id: 'demo', email: 'demo@example.local', role: 'ANALYST', readOnly: true };
const analyst = { id: 'analyst', email: 'analyst@example.local', role: 'ANALYST', readOnly: false };

function context(method, user) {
  return { switchToHttp: () => ({ getRequest: () => ({ method, user }) }), getHandler: () => undefined, getClass: () => undefined };
}

test('DEMO_READ_ONLY_EMAILS accepts a trimmed, case-insensitive comma-separated list and tolerates empty values', () => {
  assert.deepEqual([...parseEmailList(' Demo@Example.local , other@example.local,, ')], ['demo@example.local', 'other@example.local']);
  assert.equal(parseEmailList('').size, 0);
  assert.equal(parseEmailList(undefined).size, 0);

  const accounts = new ReadOnlyAccounts({ get: () => ' Demo@Example.local ,other@example.local ' });
  assert.equal(accounts.isReadOnly('demo@example.local'), true);
  assert.equal(accounts.isReadOnly(' DEMO@EXAMPLE.LOCAL '), true);
  assert.equal(accounts.isReadOnly('admin@example.local'), false);
  assert.equal(new ReadOnlyAccounts({ get: () => undefined }).isReadOnly('demo@example.local'), false);
});

test('read-only accounts are rejected on every write method, before any route-specific check', () => {
  const guard = new DemoReadOnlyGuard();
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
    assert.throws(() => guard.canActivate(context(method, demo)), (error) => error instanceof ForbiddenException && error.message === 'This demo account is read-only.', method);
  }
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(guard.canActivate(context(method, demo)), true, method);
});

test('the read-only guard leaves regular users and public requests alone', () => {
  const guard = new DemoReadOnlyGuard();
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(guard.canActivate(context(method, analyst)), true, `regular user ${method}`);
    assert.equal(guard.canActivate(context(method, undefined)), true, `public ${method} (e.g. login)`);
  }
});

test('demo accounts reach routes explicitly opened to them; regular users keep their role checks', () => {
  const metadata = (values) => ({ getAllAndOverride: (key) => values[key] });
  const auditRoute = new RolesGuard(metadata({ [ROLES_KEY]: ['ADMIN', 'TAX_MANAGER'], [ALLOW_READ_ONLY_DEMO_KEY]: true }));
  assert.equal(auditRoute.canActivate(context('GET', demo)), true, 'demo can read audit logs');
  assert.equal(auditRoute.canActivate(context('GET', analyst)), false, 'a regular analyst still cannot');
  assert.equal(auditRoute.canActivate(context('GET', { ...demo, role: 'TAX_MANAGER' })), true);

  const adminRoute = new RolesGuard(metadata({ [ROLES_KEY]: ['ADMIN'] }));
  assert.equal(adminRoute.canActivate(context('GET', demo)), false, 'other role-restricted routes stay closed to demo accounts');
});
