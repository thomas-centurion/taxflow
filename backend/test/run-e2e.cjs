const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const backendRoot = path.resolve(__dirname, '..');
const developmentDatabase = process.env.DATABASE_NAME || 'taxflow';
const testDatabase = process.env.E2E_DATABASE_NAME || `${developmentDatabase}_test`;
const port = process.env.E2E_PORT || '3100';
const loginThrottleLimit = '20';

// nunca se corre contra la base de desarrollo
if (!/^[a-z0-9_]+_test$/.test(testDatabase) || testDatabase === developmentDatabase) {
  throw new Error(`Refusing to run E2E against "${testDatabase}": the database name must end with "_test" and differ from DATABASE_NAME.`);
}
if (String(port) === String(process.env.PORT)) throw new Error('E2E_PORT must differ from the development PORT.');
const databaseHost = process.env.DATABASE_HOST || 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost) && process.env.E2E_ALLOW_REMOTE_DB !== '1') {
  throw new Error(`Refusing to run E2E against remote DATABASE_HOST "${databaseHost}": only localhost, 127.0.0.1 or ::1 are allowed unless E2E_ALLOW_REMOTE_DB=1.`);
}

const storagePath = fs.mkdtempSync(path.join(os.tmpdir(), 'taxflow-e2e-storage-'));
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_NAME: testDatabase,
  PORT: String(port),
  STORAGE_LOCAL_PATH: storagePath,
  LOGIN_THROTTLE_LIMIT: loginThrottleLimit,
  LOGIN_THROTTLE_TTL_SECONDS: '60',
  TAXFLOW_API_URL: `http://localhost:${port}/api`,
  DEMO_READ_ONLY_EMAILS: ' Demo.ReadOnly@TaxFlow.test , unused-demo@taxflow.test ',
};

async function recreateTestDatabase() {
  const client = new Client({
    host: databaseHost, port: Number(process.env.DATABASE_PORT || 5432),
    user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD, database: 'postgres',
  });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${testDatabase}"`);
  } finally {
    await client.end();
  }
}

function run(args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: backendRoot, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited with code ${code}`))));
  });
}

async function waitForHealth(server, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`E2E backend exited early:\n${output.join('')}`);
    try {
      if ((await fetch(`${env.TAXFLOW_API_URL}/health`)).ok) return;
    } catch { /* todavía no está escuchando */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`E2E backend did not become healthy:\n${output.join('')}`);
}

async function main() {
  console.log(`[e2e] database=${testDatabase} port=${port}`);
  await recreateTestDatabase();
  await run(['dist/database/seed.js'], 'seed');

  const output = [];
  const server = spawn(process.execPath, ['dist/main.js'], { cwd: backendRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (chunk) => output.push(chunk.toString()));
  server.stderr.on('data', (chunk) => output.push(chunk.toString()));
  try {
    await waitForHealth(server, output);
    const files = fs.readdirSync(__dirname).filter((file) => file.endsWith('.e2e.cjs')).sort().map((file) => path.join('test', file));
    await run(['--test', '--test-concurrency=1', ...files], 'E2E tests');
  } catch (error) {
    if (output.length) console.error(`[e2e] backend output:\n${output.join('').slice(-4000)}`);
    throw error;
  } finally {
    server.kill();
    fs.rmSync(storagePath, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[e2e] ${error.message}`);
  process.exitCode = 1;
});
