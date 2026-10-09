const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const baseUrl = process.env.TAXFLOW_API_URL;
if (!baseUrl) throw new Error('TAXFLOW_API_URL is not set: run E2E tests with "npm run test:e2e".');
const password = process.env.SEED_USER_PASSWORD;
const missingId = '00000000-0000-4000-8000-000000000000';
const validPdf = Buffer.from('%PDF-1.7\nTaxFlow document integration check\n%%EOF\n');

async function api(method, route, token, body, headers = {}) {
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body });
  return { status: response.status, response };
}

function formFile(filename, bytes = validPdf, mimeType = 'application/pdf') {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mimeType }), filename);
  return form;
}

async function json(result) { return result.response.json(); }

test('document API validates access, upload, listing, download, deletion and storage cleanup', async (t) => {
  assert.ok(password, 'SEED_USER_PASSWORD must be configured in root .env');
  const login = async (email) => {
    const result = await api('POST', '/auth/login', undefined, JSON.stringify({ email, password }), { 'content-type': 'application/json' });
    assert.equal(result.status, 200, `${email} can log in`);
    return (await json(result)).accessToken;
  };
  const admin = await login('admin@taxflow.local');
  const manager = await login('manager@taxflow.local');
  const analyst = await login('analyst@taxflow.local');
  const page = await api('GET', '/tax-obligations?limit=1', admin);
  assert.equal(page.status, 200);
  const obligation = (await json(page)).data[0];
  assert.ok(obligation?.id, 'an existing obligation is available');
  const createdDocumentIds = [];

  await t.after(async () => {
    for (const id of createdDocumentIds) await api('DELETE', `/documents/${id}`, admin);
  });

  assert.equal((await api('GET', `/tax-obligations/${obligation.id}/documents`)).status, 401, 'list requires authentication');
  assert.equal((await api('POST', `/tax-obligations/${obligation.id}/documents`, undefined, formFile('tax.pdf'))).status, 401, 'upload requires authentication');
  assert.equal((await api('POST', `/tax-obligations/${missingId}/documents`, manager, formFile('tax.pdf'))).status, 404, 'missing obligation is rejected');

  const uploaded = await api('POST', `/tax-obligations/${obligation.id}/documents`, manager, formFile('tax-report.pdf'));
  assert.equal(uploaded.status, 201, 'valid PDF uploads');
  const metadata = await json(uploaded);
  createdDocumentIds.push(metadata.id);
  assert.equal(metadata.originalFilename, 'tax-report.pdf');
  assert.equal(metadata.mimeType, 'application/pdf');
  assert.equal(metadata.size, validPdf.length);
  assert.equal(metadata.taxObligationId, obligation.id);
  assert.equal(metadata.uploadedBy.id, (await (await api('GET', '/auth/me', manager)).response.json()).id);
  assert.equal('filePath' in metadata, false, 'storage reference is private');
  assert.equal(JSON.stringify(metadata).includes('storage'), false, 'physical storage is not exposed');

  const listing = await api('GET', `/tax-obligations/${obligation.id}/documents`, analyst);
  assert.equal(listing.status, 200, 'analyst can list files');
  assert.ok((await json(listing)).some((entry) => entry.id === metadata.id));
  const download = await api('GET', `/documents/${metadata.id}/download`, analyst);
  assert.equal(download.status, 200, 'analyst can download files');
  assert.equal(download.response.headers.get('content-type'), 'application/pdf');
  assert.match(download.response.headers.get('content-disposition'), /filename\*=UTF-8''tax-report\.pdf/);
  assert.deepEqual(Buffer.from(await download.response.arrayBuffer()), validPdf, 'download bytes match uploaded bytes');
  const downloadAudit = await api('GET', `/audit-logs?entityType=Document&entityId=${metadata.id}&limit=20`, admin);
  assert.equal(downloadAudit.status, 200);
  const documentEvents = (await json(downloadAudit)).data;
  assert.ok(documentEvents.some((event) => event.action === 'UPLOAD' && event.actorEmail === 'manager@taxflow.local'));
  assert.ok(documentEvents.some((event) => event.action === 'DOWNLOAD' && event.actorEmail === 'analyst@taxflow.local'));
  assert.equal(JSON.stringify(documentEvents).includes('filePath'), false, 'storage paths never enter audit metadata');

  assert.equal((await api('DELETE', `/documents/${metadata.id}`, analyst)).status, 403, 'analyst cannot delete');
  assert.equal((await api('POST', `/tax-obligations/${obligation.id}/documents`, analyst, formFile('analyst.pdf'))).status, 403, 'analyst cannot upload');
  assert.equal((await api('DELETE', `/tax-obligations/${obligation.id}`, manager)).status, 409, 'obligation with document cannot be deleted');
  assert.equal((await api('GET', `/documents/${missingId}/download`, analyst)).status, 404, 'missing document download returns 404');
  assert.equal((await api('DELETE', `/documents/${missingId}`, manager)).status, 404, 'missing document deletion returns 404');
  assert.equal((await api('GET', `/tax-obligations/${missingId}/documents`, analyst)).status, 404, 'missing obligation list returns 404');

  const badMime = await api('POST', `/tax-obligations/${obligation.id}/documents`, manager, formFile('invalid.pdf', Buffer.from('not pdf'), 'application/pdf'));
  assert.equal(badMime.status, 400, 'spoofed PDF content is rejected');
  const executable = await api('POST', `/tax-obligations/${obligation.id}/documents`, manager, formFile('bad.exe', Buffer.from('MZ'), 'application/octet-stream'));
  assert.equal(executable.status, 400, 'executable extension is rejected');
  assert.equal((await api('POST', `/tax-obligations/${obligation.id}/documents`, manager, new FormData())).status, 400, 'upload without a selected file is rejected');
  const tooLarge = await api('POST', `/tax-obligations/${obligation.id}/documents`, manager, formFile('large.pdf', Buffer.alloc(10 * 1024 * 1024 + 1, 0x41)));
  assert.equal(tooLarge.status, 413, 'oversized upload returns 413');

  const second = await api('POST', `/tax-obligations/${obligation.id}/documents`, manager, formFile('cleanup.pdf'));
  assert.equal(second.status, 201);
  const secondMetadata = await json(second);
  createdDocumentIds.push(secondMetadata.id);
  assert.equal((await api('DELETE', `/documents/${secondMetadata.id}`, admin)).status, 204, 'admin delete succeeds');
  createdDocumentIds.splice(createdDocumentIds.indexOf(secondMetadata.id), 1);
  assert.equal((await api('GET', `/documents/${secondMetadata.id}/download`, admin)).status, 404, 'delete removes physical content');
  const listAfterDelete = await api('GET', `/tax-obligations/${obligation.id}/documents`, admin);
  assert.equal((await json(listAfterDelete)).some((entry) => entry.id === secondMetadata.id), false, 'delete removes metadata');

  assert.equal((await api('DELETE', `/documents/${metadata.id}`, manager)).status, 204, 'tax manager delete succeeds');
  createdDocumentIds.splice(createdDocumentIds.indexOf(metadata.id), 1);
  assert.equal((await api('GET', `/documents/${metadata.id}/download`, admin)).status, 404);
  const finalList = await api('GET', `/tax-obligations/${obligation.id}/documents`, admin);
  assert.equal((await json(finalList)).length, 0);
});
