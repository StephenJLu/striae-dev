import { decryptJsonFromUserKv, type UserKvEncryptedRecord } from '../encryption-utils';
import type {
  DecryptionTelemetryOutcome,
  Env,
  KeyRegistryPayload,
  PrivateKeyRegistry
} from '../types';

function normalizePrivateKeyPem(rawValue: string): string {
  return rawValue.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n');
}

function getNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function parseUserKvPrivateKeyRegistry(env: Env): PrivateKeyRegistry {
  const keys: Record<string, string> = {};
  const configuredActiveKeyId = getNonEmptyString(env.USER_KV_ENCRYPTION_ACTIVE_KEY_ID);

  if (getNonEmptyString(env.USER_KV_ENCRYPTION_KEYS_JSON)) {
    let parsedRegistry: unknown;
    try {
      parsedRegistry = JSON.parse(env.USER_KV_ENCRYPTION_KEYS_JSON as string) as unknown;
    } catch {
      throw new Error('USER_KV_ENCRYPTION_KEYS_JSON is not valid JSON');
    }

    if (!parsedRegistry || typeof parsedRegistry !== 'object') {
      throw new Error('USER_KV_ENCRYPTION_KEYS_JSON must be an object');
    }

    const payload = parsedRegistry as KeyRegistryPayload;
    if (!payload.keys || typeof payload.keys !== 'object') {
      throw new Error('USER_KV_ENCRYPTION_KEYS_JSON must include a keys object');
    }

    for (const [keyId, pemValue] of Object.entries(payload.keys as Record<string, unknown>)) {
      const normalizedKeyId = getNonEmptyString(keyId);
      const normalizedPem = getNonEmptyString(pemValue);
      if (!normalizedKeyId || !normalizedPem) {
        continue;
      }

      keys[normalizedKeyId] = normalizePrivateKeyPem(normalizedPem);
    }

    const payloadActiveKeyId = getNonEmptyString(payload.activeKeyId);
    const activeKeyId = configuredActiveKeyId ?? payloadActiveKeyId;

    if (Object.keys(keys).length === 0) {
      throw new Error('USER_KV_ENCRYPTION_KEYS_JSON does not contain any usable keys');
    }

    if (activeKeyId && !keys[activeKeyId]) {
      throw new Error('USER_KV active key ID is not present in USER_KV_ENCRYPTION_KEYS_JSON');
    }

    return {
      activeKeyId: activeKeyId ?? null,
      keys
    };
  }

  const legacyKeyId = getNonEmptyString(env.USER_KV_ENCRYPTION_KEY_ID);
  const legacyPrivateKey = getNonEmptyString(env.USER_KV_ENCRYPTION_PRIVATE_KEY);
  if (!legacyKeyId || !legacyPrivateKey) {
    throw new Error('User KV encryption private key registry is not configured');
  }

  keys[legacyKeyId] = normalizePrivateKeyPem(legacyPrivateKey);

  return {
    activeKeyId: configuredActiveKeyId ?? legacyKeyId,
    keys
  };
}

function buildPrivateKeyCandidates(
  recordKeyId: string,
  registry: PrivateKeyRegistry
): Array<{ keyId: string; privateKeyPem: string }> {
  const candidates: Array<{ keyId: string; privateKeyPem: string }> = [];
  const seen = new Set<string>();

  const appendCandidate = (candidateKeyId: string | null): void => {
    if (!candidateKeyId || seen.has(candidateKeyId)) {
      return;
    }

    const privateKeyPem = registry.keys[candidateKeyId];
    if (!privateKeyPem) {
      return;
    }

    seen.add(candidateKeyId);
    candidates.push({ keyId: candidateKeyId, privateKeyPem });
  };

  appendCandidate(getNonEmptyString(recordKeyId));
  appendCandidate(registry.activeKeyId);

  for (const keyId of Object.keys(registry.keys)) {
    appendCandidate(keyId);
  }

  return candidates;
}

function logUserKvDecryptionTelemetry(input: {
  recordKeyId: string;
  selectedKeyId: string | null;
  attemptCount: number;
  outcome: DecryptionTelemetryOutcome;
  reason?: string;
}): void {
  const details = {
    scope: 'user-kv',
    recordKeyId: input.recordKeyId,
    selectedKeyId: input.selectedKeyId,
    attemptCount: input.attemptCount,
    fallbackUsed: input.outcome === 'fallback-hit',
    outcome: input.outcome,
    reason: input.reason ?? null
  };

  if (input.outcome === 'all-failed') {
    console.warn('Key registry decryption failed', details);
    return;
  }

  console.info('Key registry decryption resolved', details);
}

export async function decryptUserKvRecord(
  encryptedRecord: UserKvEncryptedRecord,
  registry: PrivateKeyRegistry
): Promise<string> {
  const candidates = buildPrivateKeyCandidates(encryptedRecord.keyId, registry);
  const primaryKeyId = candidates[0]?.keyId ?? null;
  let lastError: unknown;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      const decryptedJson = await decryptJsonFromUserKv(encryptedRecord, candidate.privateKeyPem);
      logUserKvDecryptionTelemetry({
        recordKeyId: encryptedRecord.keyId,
        selectedKeyId: candidate.keyId,
        attemptCount: index + 1,
        outcome: candidate.keyId === primaryKeyId ? 'primary-hit' : 'fallback-hit'
      });
      return decryptedJson;
    } catch (error) {
      lastError = error;
    }
  }

  logUserKvDecryptionTelemetry({
    recordKeyId: encryptedRecord.keyId,
    selectedKeyId: null,
    attemptCount: candidates.length,
    outcome: 'all-failed',
    reason: lastError instanceof Error ? lastError.message : 'unknown decryption error'
  });

  throw new Error(
    `Failed to decrypt user KV record after ${candidates.length} key attempt(s): ${
      lastError instanceof Error ? lastError.message : 'unknown decryption error'
    }`
  );
}