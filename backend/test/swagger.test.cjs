const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isSwaggerEnabled } = require('../dist/common/swagger/swagger');

test('Swagger is served outside production unless disabled, and in production only when explicitly enabled', () => {
  assert.equal(isSwaggerEnabled({ NODE_ENV: 'development' }), true);
  assert.equal(isSwaggerEnabled({ NODE_ENV: 'test' }), true);
  assert.equal(isSwaggerEnabled({}), true);
  assert.equal(isSwaggerEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }), true);
  assert.equal(isSwaggerEnabled({ NODE_ENV: 'development', SWAGGER_ENABLED: ' FALSE ' }), false);
});
