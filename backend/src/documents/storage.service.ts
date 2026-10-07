export abstract class StorageService {
  abstract save(storageKey: string, content: Buffer): Promise<void>;
  abstract get(storageKey: string): Promise<Buffer>;
  abstract delete(storageKey: string): Promise<void>;
  abstract exists(storageKey: string): Promise<boolean>;
}

export class StorageObjectNotFoundError extends Error {
  constructor() { super('Stored object not found.'); }
}
