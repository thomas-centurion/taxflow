const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DocumentsService } = require('../dist/documents/documents.service');
const { LocalStorageService } = require('../dist/documents/local-storage.service');
const { StorageObjectNotFoundError } = require('../dist/documents/storage.service');
const { MAX_DOCUMENT_SIZE, validateDocumentFile } = require('../dist/documents/file-validation');

const id = '8de3a564-f432-4b48-a98a-8b2e4ef85493';
const user = { id, firstName: 'Test', lastName: 'Uploader' };
const pdf = Buffer.from('%PDF-1.7\nTax document fixture');
const audit = { record: async () => undefined };

test('document validator accepts a PDF with matching extension, MIME type, and content', () => {
  const validated = validateDocumentFile({ originalname: 'tax.pdf', mimetype: 'application/pdf', buffer: pdf, size: pdf.length });
  assert.equal(validated.mimeType, 'application/pdf');
  assert.equal(validated.size, pdf.length);
});

test('document validator rejects oversized, mismatched, executable, and path traversal files', () => {
  assert.throws(() => validateDocumentFile({ originalname: 'huge.pdf', mimetype: 'application/pdf', buffer: Buffer.alloc(MAX_DOCUMENT_SIZE + 1), size: MAX_DOCUMENT_SIZE + 1 }), { status: 413 });
  assert.throws(() => validateDocumentFile({ originalname: 'wrong.pdf', mimetype: 'image/png', buffer: pdf, size: pdf.length }), { status: 400 });
  assert.throws(() => validateDocumentFile({ originalname: 'program.exe', mimetype: 'application/octet-stream', buffer: pdf, size: pdf.length }), { status: 400 });
  assert.throws(() => validateDocumentFile({ originalname: '../tax.pdf', mimetype: 'application/pdf', buffer: pdf, size: pdf.length }), { status: 400 });
});

test('local storage rejects traversal keys before touching the filesystem', async () => {
  const storage = new LocalStorageService({ get: (_key, fallback) => fallback } );
  await assert.rejects(() => storage.get('../outside.pdf'), /escaped the storage root/);
  await assert.rejects(() => storage.save('documents/../../outside.pdf', pdf), /escaped the storage root/);
  await assert.doesNotReject(() => storage.delete('documents/missing-object.pdf'));
});

test('upload removes the stored file if metadata persistence fails', async () => {
  const savedKeys = [];
  const deletedKeys = [];
  const storage = {
    save: async (key) => savedKeys.push(key),
    delete: async (key) => deletedKeys.push(key),
    get: async () => pdf,
    exists: async () => true,
  };
  const documents = { create: (record) => record, save: async () => { throw new Error('database unavailable'); } };
  const obligations = { findOne: async () => ({ id, companyId: id, company: { name: 'Test Company' } }) };
  const users = {};
  const dataSource = { transaction: (callback) => callback({ getRepository: () => documents }) };
  const service = new DocumentsService(documents, obligations, users, storage, { notifyDocumentUploaded: async () => undefined }, dataSource, audit);

  await assert.rejects(() => service.upload(id, user, { originalname: 'tax.pdf', mimetype: 'application/pdf', buffer: pdf, size: pdf.length }), { status: 500 });
  assert.equal(savedKeys.length, 1);
  assert.deepEqual(deletedKeys, savedKeys);
});

test('document upload returns 404 before storing when the obligation does not exist', async () => {
  let stored = false;
  const service = new DocumentsService({}, { findOne: async () => null }, {}, { save: async () => { stored = true; } }, {});
  await assert.rejects(() => service.upload(id, user, { originalname: 'tax.pdf', mimetype: 'application/pdf', buffer: pdf, size: pdf.length }), { status: 404 });
  assert.equal(stored, false);
});

test('deleting metadata succeeds when its physical file is already missing', async () => {
  let metadataDeleted = false;
  let storageDeleteCalled = false;
  const record = { id, filePath: 'documents/example.pdf', fileName: 'example.pdf', uploadedBy: user };
  const documents = {
    findOne: async () => record,
    remove: async () => { metadataDeleted = true; },
  };
  const storage = {
    exists: async () => false,
    delete: async () => { storageDeleteCalled = true; },
  };
  const dataSource = { transaction: (callback) => callback({ getRepository: () => documents }) };
  const service = new DocumentsService(documents, {}, {}, storage, {}, dataSource, audit);
  await service.remove(id);
  assert.equal(storageDeleteCalled, true);
  assert.equal(metadataDeleted, true);
});

test('download returns 404 when the physical object is missing', async () => {
  const record = { id, filePath: 'documents/missing.pdf', fileName: 'missing.pdf', mimeType: 'application/pdf', uploadedBy: user };
  const documents = { findOne: async () => record };
  const storage = { get: async () => { throw new StorageObjectNotFoundError(); } };
  const service = new DocumentsService(documents, {}, {}, storage, {});
  await assert.rejects(() => service.download(id, user), { status: 404 });
});
