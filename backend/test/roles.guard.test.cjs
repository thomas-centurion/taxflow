const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Reflector } = require('@nestjs/core');
const { RolesGuard } = require('../dist/auth/roles.guard');
const { ROLES_KEY } = require('../dist/auth/roles.decorator');
const { UserRole } = require('../dist/users/user-role.enum');

function contextFor(handler, role) {
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  };
}

test('RolesGuard allows matching roles and rejects others', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  for (const requiredRole of Object.values(UserRole)) {
    const handler = () => undefined;
    Reflect.defineMetadata(ROLES_KEY, [requiredRole], handler);
    assert.equal(guard.canActivate(contextFor(handler, requiredRole)), true);
    const otherRole = Object.values(UserRole).find((role) => role !== requiredRole);
    assert.equal(guard.canActivate(contextFor(handler, otherRole)), false);
    assert.equal(guard.canActivate(contextFor(handler, undefined)), false);
  }
  assert.equal(guard.canActivate(contextFor(() => undefined, UserRole.ANALYST)), true);
});