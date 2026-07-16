import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { VersionSchema, type Version, type VersionReason } from '@pnode/core';
import { writeAtomic } from './atomic-file.js';
import { DocumentStore, hashContent } from './document-store.js';
import { JsonStore } from './json-store.js';
import { resolveWorkspacePath } from './paths.js';

const VersionListSchema = z.array(VersionSchema);

export class VersionStore {
  private readonly file: JsonStore<Version[]>;

  constructor(private readonly root: string, private readonly documents: DocumentStore) {
    this.file = new JsonStore(
      join(root, '.pnode', 'versions', 'index.json'),
      VersionListSchema,
      []
    );
  }

  async snapshot(documentPath: string, content: string, reason: VersionReason): Promise<Version> {
    const id = `v-${randomUUID()}`;
    const contentFile = `.pnode/versions/content/${id}.md`;
    await writeAtomic(resolveWorkspacePath(this.root, contentFile), content);
    const version = VersionSchema.parse({
      id,
      documentPath,
      contentHash: hashContent(content),
      contentFile,
      reason,
      createdAt: new Date().toISOString()
    });
    const versions = await this.file.read();
    versions.push(version);
    await this.file.write(versions);
    return version;
  }

  async list(documentPath: string): Promise<Version[]> {
    return (await this.file.read())
      .filter((version) => version.documentPath === documentPath)
      .reverse();
  }

  async get(id: string): Promise<Version> {
    const version = (await this.file.read()).find((item) => item.id === id);
    if (!version) throw new Error('VERSION_NOT_FOUND');
    return version;
  }

  async readContent(id: string): Promise<string> {
    const version = await this.get(id);
    return (await import('node:fs/promises')).readFile(
      resolveWorkspacePath(this.root, version.contentFile),
      'utf8'
    );
  }

  async restore(documentPath: string, versionId: string): Promise<{
    recoveryVersion: Version;
    restoredVersion: Version;
  }> {
    const target = await this.get(versionId);
    if (target.documentPath !== documentPath) throw new Error('VERSION_DOCUMENT_MISMATCH');
    const current = await this.documents.read(documentPath);
    const recoveryVersion = await this.snapshot(documentPath, current.content, 'pre-restore');
    const targetContent = await this.readContent(versionId);
    await this.documents.save(documentPath, targetContent);
    const restoredVersion = await this.snapshot(documentPath, targetContent, 'manual');
    return { recoveryVersion, restoredVersion };
  }
}
