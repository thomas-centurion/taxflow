const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

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

const base64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

function signJwt(payload, secret, header = { alg: 'HS256', typ: 'JWT' }) {
  const unsigned = `${base64url(header)}.${base64url(payload)}`;
  const signature = header.alg === 'none' ? '' : crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

test('protected routes reject missing, malformed, forged, unsigned and expired tokens', async () => {
  const login = await api('POST', '/auth/login', undefined, { email: 'admin@taxflow.local', password });
  assert.equal(login.status, 200);
  const user = login.data.user;
  const now = Math.floor(Date.now() / 1000);
  const claims = { sub: user.id, email: user.email, role: 'ADMIN', iat: now };

  assert.equal((await api('GET', '/auth/me', login.data.accessToken)).status, 200);
  assert.equal((await api('GET', '/auth/me')).status, 401);
  assert.equal((await api('GET', '/auth/me', 'not-a-jwt')).status, 401);
  assert.equal((await api('GET', '/auth/me', signJwt({ ...claims, exp: now + 3600 }, 'a-different-secret-of-sufficient-length'))).status, 401, 'forged signature');
  assert.equal((await api('GET', '/auth/me', signJwt({ ...claims, exp: now + 3600 }, '', { alg: 'none', typ: 'JWT' }))).status, 401, 'unsigned token');
  assert.equal((await api('GET', '/auth/me', signJwt({ ...claims, iat: now - 7200, exp: now - 3600 }, process.env.JWT_SECRET))).status, 401, 'expired token');

  const [header, , signature] = login.data.accessToken.split('.');
  const tampered = `${header}.${base64url({ ...claims, role: 'ADMIN', sub: crypto.randomUUID(), exp: now + 3600 })}.${signature}`;
  assert.equal((await api('GET', '/auth/me', tampered)).status, 401, 'tampered payload');
});

test('deactivating a user revokes its existing tokens immediately and blocks new logins', async (t) => {
  const admin = (await api('POST', '/auth/login', undefined, { email: 'admin@taxflow.local', password })).data.accessToken;
  const email = `auth-${crypto.randomUUID().slice(0, 8)}@example.local`;
  const userPassword = `Pw-${crypto.randomUUID()}`;
  const created = await api('POST', '/users', admin, { firstName: 'Token', lastName: 'Holder', email, password: userPassword, role: 'ANALYST' });
  assert.equal(created.status, 201);
  t.after(() => api('DELETE', `/users/${created.data.id}`, admin));

  const session = await api('POST', '/auth/login', undefined, { email, password: userPassword });
  assert.equal(session.status, 200);
  assert.equal((await api('GET', '/auth/me', session.data.accessToken)).status, 200);

  assert.equal((await api('PATCH', `/users/${created.data.id}`, admin, { isActive: false })).status, 200);
  assert.equal((await api('GET', '/auth/me', session.data.accessToken)).status, 401, 'a still-valid JWT of a deactivated user is rejected');
  assert.equal((await api('POST', '/auth/login', undefined, { email, password: userPassword })).status, 401);
});
