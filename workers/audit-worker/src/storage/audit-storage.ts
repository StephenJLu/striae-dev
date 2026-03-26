import {
  DATA_AT_REST_ENCRYPTION_ALGORITHM,
  DATA_AT_REST_ENCRYPTION_VERSION
} from '../config';
import {
  decryptAuditJsonWithRegistry,
  encryptJsonForStorage,
  extractDataAtRestEnvelope,
  isDataAtRestEncryptionEnabled
} from '../crypto/data-at-rest';
import type { AuditEntry, Env } from '../types';

export function generateAuditFileName(userId: string, date: Date = new Date()): string {
  const isoDate = date.toISOString().split('T')[0];
  return `audit-trails/${userId}/${isoDate}.json`;
}

export function isValidAuditEntry(entry: unknown): entry is AuditEntry {
  const candidate = entry as Partial<AuditEntry> | null;

  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.timestamp === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.action === 'string'
  );
}

export async function readAuditEntriesFromObject(file: R2ObjectBody, env: Env): Promise<AuditEntry[]> {
  const atRestEnvelope = extractDataAtRestEnvelope(file);
  if (!atRestEnvelope) {
    const fileText = await file.text();
    return JSON.parse(fileText) as AuditEntry[];
  }

  if (atRestEnvelope.algorithm !== DATA_AT_REST_ENCRYPTION_ALGORITHM) {
    throw new Error('Unsupported data-at-rest encryption algorithm');
  }

  if (atRestEnvelope.encryptionVersion !== DATA_AT_REST_ENCRYPTION_VERSION) {
    throw new Error('Unsupported data-at-rest encryption version');
  }

  const encryptedData = await file.arrayBuffer();
  const plaintext = await decryptAuditJsonWithRegistry(encryptedData, atRestEnvelope, env);

  return JSON.parse(plaintext) as AuditEntry[];
}

export async function writeAuditEntriesToObject(
  bucket: R2Bucket,
  filename: string,
  entries: AuditEntry[],
  env: Env
): Promise<void> {
  const serializedData = JSON.stringify(entries);

  if (!isDataAtRestEncryptionEnabled(env)) {
    await bucket.put(filename, serializedData);
    return;
  }

  if (!env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY || !env.DATA_AT_REST_ENCRYPTION_KEY_ID) {
    throw new Error('Data-at-rest encryption is enabled but not fully configured');
  }

  const encryptedPayload = await encryptJsonForStorage(
    serializedData,
    env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY,
    env.DATA_AT_REST_ENCRYPTION_KEY_ID
  );

  await bucket.put(filename, encryptedPayload.ciphertext, {
    customMetadata: {
      algorithm: encryptedPayload.envelope.algorithm,
      encryptionVersion: encryptedPayload.envelope.encryptionVersion,
      keyId: encryptedPayload.envelope.keyId,
      dataIv: encryptedPayload.envelope.dataIv,
      wrappedKey: encryptedPayload.envelope.wrappedKey
    }
  });
}

export async function appendAuditEntry(
  bucket: R2Bucket,
  filename: string,
  newEntry: AuditEntry,
  env: Env
): Promise<number> {
  try {
    const existingFile = await bucket.get(filename);
    let entries: AuditEntry[] = [];

    if (existingFile) {
      entries = await readAuditEntriesFromObject(existingFile, env);
    }

    entries.push(newEntry);
    await writeAuditEntriesToObject(bucket, filename, entries, env);
    return entries.length;
  } catch (error) {
    console.error('Error appending audit entry:', error);
    throw error;
  }
}