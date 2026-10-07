import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lstat, mkdir, open, readFile, realpath, rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { StorageObjectNotFoundError, StorageService } from './storage.service';

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    super();
    const backendRoot = resolve(__dirname, '..', '..');
    const configuredPath = config.get<string>('STORAGE_LOCAL_PATH', './storage');
    this.root = isAbsolute(configuredPath) ? resolve(configuredPath) : resolve(backendRoot, configuredPath);
  }

  async save(storageKey: string, content: Buffer): Promise<void> {
    const target = await this.resolveTarget(storageKey, true);
    const handle = await open(target, 'wx', 0o600);
    try { await handle.writeFile(content); }
    catch (error) { await handle.close(); await rm(target, { force: true }); throw error; }
    await handle.close();
  }

  async get(storageKey: string): Promise<Buffer> {
    const target = await this.resolveTarget(storageKey, false);
    try {
      const info = await lstat(target);
      if (!info.isFile() || info.isSymbolicLink()) throw new StorageObjectNotFoundError();
      return await readFile(target);
    } catch (error) {
      if (isMissing(error)) throw new StorageObjectNotFoundError();
      throw error;
    }
  }

  async delete(storageKey: string): Promise<void> {
    let target: string;
    try { target = await this.resolveTarget(storageKey, false); }
    catch (error) { if (error instanceof StorageObjectNotFoundError) return; throw error; }
    await rm(target, { force: true });
  }

  async exists(storageKey: string): Promise<boolean> {
    try { const target = await this.resolveTarget(storageKey, false); const info = await lstat(target); return info.isFile() && !info.isSymbolicLink(); }
    catch (error) { if (isMissing(error)) return false; throw error; }
  }

  private async resolveTarget(storageKey: string, createDirectories: boolean): Promise<string> {
    if (!storageKey || storageKey.includes('\\') || storageKey.includes('\0')) throw new Error('Invalid storage key.');
    const segments = storageKey.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes(':'))) {
      throw new Error('Invalid storage key escaped the storage root.');
    }
    const target = resolve(this.root, ...segments);
    const pathFromRoot = relative(this.root, target);
    if (!pathFromRoot || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..' || isAbsolute(pathFromRoot)) {
      throw new Error('Storage key escaped the storage root.');
    }
    if (createDirectories) {
      await mkdir(resolve(this.root, 'documents'), { recursive: true });
      const [realRoot, realParent] = await Promise.all([realpath(this.root), realpath(resolve(this.root, 'documents'))]);
      if (!isWithin(realRoot, realParent)) throw new Error('Storage directory is outside its configured root.');
    } else {
      const parent = resolve(target, '..');
      try {
        const [realRoot, realParent] = await Promise.all([realpath(this.root), realpath(parent)]);
        if (!isWithin(realRoot, realParent)) throw new Error('Storage directory is outside its configured root.');
      } catch (error) { if (isMissing(error)) throw new StorageObjectNotFoundError(); throw error; }
    }
    return target;
  }
}

function isWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot));
}

function isMissing(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
}
