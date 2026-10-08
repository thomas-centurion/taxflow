const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// Set by test/run-e2e.cjs, which runs an isolated backend against the taxflow_test database.
const baseUrl = process.env.TAXFLOW_API_URL;
if (!baseUrl) throw new Error('TAXFLOW_API_URL is not set: run E2E tests with "npm run test:e2e".');
const origin = baseUrl.replace(/\/api$/, '');
const password = process.env.SEED_USER_PASSWORD;
const PUBLIC_OPERATIONS = new Set(['post /api/auth/login', 'get /api/health', 'get /api/health/ready']);

async function api(method, route, token, body) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : undefined };
}

async function login(email) {
  const result = await api('POST', '/auth/login', undefined, { email, password });
  assert.equal(result.status, 200, `login ${email}`);
  return result;
}

let documentPromise;
function openApiDocument() {
  documentPromise ??= fetch(`${origin}/api/docs-json`).then(async (response) => {
    assert.equal(response.status, 200, 'the OpenAPI document is served in the test environment');
    return response.json();
  });
  return documentPromise;
}

/** Validates a JSON value against an OpenAPI 3.0 schema: types, required and undocumented properties, nullability, enums. */
function schemaErrors(document, schema, value, at = '$') {
  if (schema.$ref) return schemaErrors(document, document.components.schemas[schema.$ref.split('/').pop()], value, at);
  if (value === null) return schema.nullable ? [] : [`${at} is null but not nullable`];
  if (schema.allOf) return schema.allOf.flatMap((part) => schemaErrors(document, part, value, at));
  if (schema.oneOf) return schema.oneOf.some((option) => schemaErrors(document, option, value, at).length === 0) ? [] : [`${at} matches no oneOf option`];
  if (schema.enum && !schema.enum.includes(value)) return [`${at} = ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`];
  const type = schema.type ?? (schema.properties ? 'object' : undefined);
  switch (type) {
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) return [`${at} is not an object`];
      if (!schema.properties) return [];
      const errors = (schema.required ?? []).filter((key) => !(key in value)).map((key) => `${at}.${key} is required but missing`);
      for (const [key, item] of Object.entries(value)) {
        if (schema.properties[key]) errors.push(...schemaErrors(document, schema.properties[key], item, `${at}.${key}`));
        else if (schema.additionalProperties !== true) errors.push(`${at}.${key} is not documented`);
      }
      return errors;
    }
    case 'array':
      return Array.isArray(value) ? value.flatMap((item, index) => schemaErrors(document, schema.items, item, `${at}[${index}]`)) : [`${at} is not an array`];
    case 'integer': return Number.isInteger(value) ? [] : [`${at} is not an integer`];
    case 'number': return typeof value === 'number' ? [] : [`${at} is not a number`];
    case 'string': return typeof value === 'string' ? [] : [`${at} is not a string`];
    case 'boolean': return typeof value === 'boolean' ? [] : [`${at} is not a boolean`];
    default: return [];
  }
}

/** Asserts that a real response matches what the OpenAPI document declares for that operation and status. */
async function assertDocumented(method, template, response) {
  const document = await openApiDocument();
  const operation = document.paths[`/api${template}`]?.[method.toLowerCase()];
  assert.ok(operation, `${method} ${template} is documented`);
  const documented = operation.responses[String(response.status)];
  assert.ok(documented, `${method} ${template} documents status ${response.status}`);
  const schema = documented.content?.['application/json']?.schema;
  assert.ok(schema, `${method} ${template} ${response.status} documents a JSON body`);
  assert.deepEqual(schemaErrors(document, schema, response.data), [], `${method} ${template} ${response.status} matches its schema`);
}

test('the OpenAPI document covers every route with tags, JWT security and error responses, and exposes no secrets', async () => {
  const document = await openApiDocument();
  assert.match(document.openapi, /^3\./);
  assert.deepEqual(document.components.securitySchemes.bearer, { scheme: 'bearer', bearerFormat: 'JWT', type: 'http', description: 'Access token returned by POST /api/auth/login.' });
  const ui = await fetch(`${origin}/api/docs`);
  assert.equal(ui.status, 200);
  assert.match(await ui.text(), /swagger-ui/i);

  const operations = Object.entries(document.paths).flatMap(([route, methods]) => Object.entries(methods).map(([method, operation]) => ({ key: `${method} ${route}`, operation })));
  assert.ok(operations.length >= 38, `all API operations are documented (${operations.length})`);
  for (const { key, operation } of operations) {
    assert.ok(operation.tags?.length === 1, `${key} has a tag`);
    assert.ok(operation.summary, `${key} has a summary`);
    assert.ok(Object.keys(operation.responses).some((status) => status.startsWith('2')), `${key} documents a success response`);
    if (PUBLIC_OPERATIONS.has(key)) {
      assert.equal(operation.security, undefined, `${key} is public`);
    } else {
      assert.deepEqual(operation.security, [{ bearer: [] }], `${key} requires the JWT`);
      assert.ok(operation.responses['401'], `${key} documents 401`);
    }
  }
  assert.ok(Object.keys(document.components.schemas).every((name) => !['User', 'Company', 'TaxObligation', 'Document', 'Object'].includes(name)), 'entities are not exposed as schemas');

  const serialized = JSON.stringify(document);
  for (const name of ['JWT_SECRET', 'DATABASE_PASSWORD', 'SEED_USER_PASSWORD']) {
    if (process.env[name]) assert.equal(serialized.includes(process.env[name]), false, `${name} does not leak into the OpenAPI document`);
  }
});

test('real API responses match their documented schemas', async () => {
  const adminLogin = await login('admin@taxflow.local');
  await assertDocumented('POST', '/auth/login', adminLogin);
  const admin = adminLogin.data.accessToken;

  await assertDocumented('GET', '/health', await api('GET', '/health'));
  await assertDocumented('GET', '/health/ready', await api('GET', '/health/ready'));
  await assertDocumented('GET', '/auth/me', await api('GET', '/auth/me', admin));
  await assertDocumented('GET', '/users', await api('GET', '/users?limit=5', admin));
  await assertDocumented('GET', '/users/options', await api('GET', '/users/options', admin));
  await assertDocumented('GET', '/countries', await api('GET', '/countries?limit=5', admin));

  const companies = await api('GET', '/companies?limit=5', admin);
  await assertDocumented('GET', '/companies', companies);
  await assertDocumented('GET', '/companies/{id}', await api('GET', `/companies/${companies.data.data[0].id}`, admin));

  const obligations = await api('GET', '/tax-obligations?limit=10', admin);
  await assertDocumented('GET', '/tax-obligations', obligations);
  assert.ok(obligations.data.data.some((item) => item.responsibleUser), 'the seed exercises the nested responsible user schema');
  const obligationId = obligations.data.data[0].id;
  await assertDocumented('GET', '/tax-obligations/{id}', await api('GET', `/tax-obligations/${obligationId}`, admin));
  await assertDocumented('GET', '/tax-obligations/{taxObligationId}/documents', await api('GET', `/tax-obligations/${obligationId}/documents`, admin));

  await assertDocumented('POST', '/automation/check-deadlines', await api('POST', '/automation/check-deadlines', admin));
  const runs = await api('GET', `/tax-obligations/${obligationId}/automation-runs`, admin);
  await assertDocumented('GET', '/tax-obligations/{id}/automation-runs', runs);
  if (runs.data.length) await assertDocumented('GET', '/automation-runs/{id}', await api('GET', `/automation-runs/${runs.data[0].id}`, admin));

  await assertDocumented('GET', '/notifications', await api('GET', '/notifications?limit=20', admin));
  await assertDocumented('GET', '/notifications/unread-count', await api('GET', '/notifications/unread-count', admin));
  await assertDocumented('GET', '/audit-logs', await api('GET', '/audit-logs?limit=20', admin));

  // Errors keep the documented NestJS body.
  await assertDocumented('GET', '/companies/{id}', await api('GET', `/companies/${crypto.randomUUID()}`, admin));
  await assertDocumented('POST', '/companies', await api('POST', '/companies', admin, {}));
  await assertDocumented('GET', '/auth/me', await api('GET', '/auth/me'));
  const analyst = (await login('analyst@taxflow.local')).data.accessToken;
  await assertDocumented('POST', '/countries', await api('POST', '/countries', analyst, { name: 'Nowhere', code: 'NW' }));
});
