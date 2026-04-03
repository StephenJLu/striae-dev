import {
  decryptBinaryFromStorage,
  type DataAtRestEnvelope
} from '../encryption-utils';
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

export function requireEncryptionUploadConfig(env: Env): void {
  if (!env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY || !env.DATA_AT_REST_ENCRYPTION_KEY_ID) {
    throw new Error('Data-at-rest encryption is not configured for image uploads');
  }
}

export function requireEncryptionRetrievalConfig(env: Env): void {
  const hasLegacyPrivateKey = typeof env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY === 'string' && env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY.trim().length > 0;
  const hasRegistry = typeof env.DATA_AT_REST_ENCRYPTION_KEYS_JSON === 'string' && env.DATA_AT_REST_ENCRYPTION_KEYS_JSON.trim().length > 0;

  if (!hasLegacyPrivateKey && !hasRegistry) {
    throw new Error('Data-at-rest decryption registry is not configured for image retrieval');
  }
}

function parseDataAtRestPrivateKeyRegistry(env: Env): PrivateKeyRegistry {
  const keys: Record<string, string> = {};
  const configuredActiveKeyId = getNonEmptyString(env.DATA_AT_REST_ENCRYPTION_ACTIVE_KEY_ID);
  const registryJson = getNonEmptyString(env.DATA_AT_REST_ENCRYPTION_KEYS_JSON);

  if (registryJson) {
    let parsedRegistry: unknown;
    try {
      parsedRegistry = JSON.parse(registryJson) as unknown;
    } catch {
      throw new Error('DATA_AT_REST_ENCRYPTION_KEYS_JSON is not valid JSON');
    }

    if (!parsedRegistry || typeof parsedRegistry !== 'object') {
      throw new Error('DATA_AT_REST_ENCRYPTION_KEYS_JSON must be an object');
    }

    const payload = parsedRegistry as KeyRegistryPayload;
    if (!payload.keys || typeof payload.keys !== 'object') {
      throw new Error('DATA_AT_REST_ENCRYPTION_KEYS_JSON must include a keys object');
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
    const resolvedActiveKeyId = configuredActiveKeyId ?? payloadActiveKeyId;

    if (Object.keys(keys).length === 0) {
      throw new Error('DATA_AT_REST_ENCRYPTION_KEYS_JSON does not contain any usable keys');
    }

    if (resolvedActiveKeyId && !keys[resolvedActiveKeyId]) {
      throw new Error('DATA_AT_REST active key ID is not present in DATA_AT_REST_ENCRYPTION_KEYS_JSON');
    }

    return {
      activeKeyId: resolvedActiveKeyId ?? null,
      keys
    };
  }

  const legacyKeyId = getNonEmptyString(env.DATA_AT_REST_ENCRYPTION_KEY_ID);
  const legacyPrivateKey = getNonEmptyString(env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY);
  if (!legacyKeyId || !legacyPrivateKey) {
    throw new Error('Data-at-rest decryption key registry is not configured');
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

function logFileDecryptionTelemetry(input: {
  recordKeyId: string;
  selectedKeyId: string | null;
  attemptCount: number;
  outcome: DecryptionTelemetryOutcome;
  reason?: string;
}): void {
  const details = {
    scope: 'file-at-rest',
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

export async function decryptBinaryWithRegistry(
  ciphertext: ArrayBuffer,
  envelope: DataAtRestEnvelope,
  env: Env
): Promise<ArrayBuffer> {
  const keyRegistry = parseDataAtRestPrivateKeyRegistry(env);
  const candidates = buildPrivateKeyCandidates(envelope.keyId, keyRegistry);
  const primaryKeyId = candidates[0]?.keyId ?? null;
  let lastError: unknown;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      const plaintext = await decryptBinaryFromStorage(ciphertext, envelope, candidate.privateKeyPem);
      logFileDecryptionTelemetry({
        recordKeyId: envelope.keyId,
        selectedKeyId: candidate.keyId,
        attemptCount: index + 1,
        outcome: candidate.keyId === primaryKeyId ? 'primary-hit' : 'fallback-hit'
      });
      return plaintext;
    } catch (error) {
      lastError = error;
    }
  }

  logFileDecryptionTelemetry({
    recordKeyId: envelope.keyId,
    selectedKeyId: null,
    attemptCount: candidates.length,
    outcome: 'all-failed',
    reason: lastError instanceof Error ? lastError.message : 'unknown decryption error'
  });

  throw new Error(
    `Failed to decrypt stored file after ${candidates.length} key attempt(s): ${
      lastError instanceof Error ? lastError.message : 'unknown decryption error'
    }`
  );
}