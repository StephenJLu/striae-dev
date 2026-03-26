import { encryptJsonForStorage } from '../encryption-utils';
import { hasDataAtRestMetadata } from '../registry/key-registry';
import type { CreateResponse, Env } from '../types';

function clampBackfillBatchSize(size: number | undefined): number {
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    return 100;
  }

  const normalized = Math.floor(size);
  if (normalized < 1) {
    return 1;
  }

  if (normalized > 1000) {
    return 1000;
  }

  return normalized;
}

export async function handleDataAtRestBackfill(
  request: Request,
  env: Env,
  respond: CreateResponse
): Promise<Response> {
  if (!env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY || !env.DATA_AT_REST_ENCRYPTION_KEY_ID) {
    return respond(
      { error: 'Data-at-rest encryption is not configured for backfill writes' },
      400
    );
  }

  const requestBody = await request.json().catch(() => ({})) as {
    dryRun?: boolean;
    prefix?: string;
    cursor?: string;
    batchSize?: number;
  };

  const dryRun = requestBody.dryRun === true;
  const prefix = typeof requestBody.prefix === 'string' ? requestBody.prefix : '';
  const cursor = typeof requestBody.cursor === 'string' && requestBody.cursor.length > 0
    ? requestBody.cursor
    : undefined;
  const batchSize = clampBackfillBatchSize(requestBody.batchSize);

  const bucket = env.STRIAE_DATA;
  const listed = await bucket.list({
    prefix: prefix.length > 0 ? prefix : undefined,
    cursor,
    limit: batchSize
  });

  let scanned = 0;
  let eligible = 0;
  let encrypted = 0;
  let skippedEncrypted = 0;
  let skippedNonJson = 0;
  let failed = 0;
  const failures: Array<{ key: string; error: string }> = [];

  for (const object of listed.objects) {
    scanned += 1;
    const key = object.key;

    if (!key.endsWith('.json')) {
      skippedNonJson += 1;
      continue;
    }

    const objectHead = await bucket.head(key);
    if (!objectHead) {
      failed += 1;
      if (failures.length < 20) {
        failures.push({ key, error: 'Object not found during metadata check' });
      }
      continue;
    }

    if (hasDataAtRestMetadata(objectHead.customMetadata)) {
      skippedEncrypted += 1;
      continue;
    }

    eligible += 1;

    if (dryRun) {
      continue;
    }

    try {
      const existingObject = await bucket.get(key);
      if (!existingObject) {
        failed += 1;
        if (failures.length < 20) {
          failures.push({ key, error: 'Object disappeared before processing' });
        }
        continue;
      }

      const plaintext = await existingObject.text();
      const encryptedPayload = await encryptJsonForStorage(
        plaintext,
        env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY,
        env.DATA_AT_REST_ENCRYPTION_KEY_ID
      );

      await bucket.put(key, encryptedPayload.ciphertext, {
        customMetadata: {
          algorithm: encryptedPayload.envelope.algorithm,
          encryptionVersion: encryptedPayload.envelope.encryptionVersion,
          keyId: encryptedPayload.envelope.keyId,
          dataIv: encryptedPayload.envelope.dataIv,
          wrappedKey: encryptedPayload.envelope.wrappedKey
        }
      });

      encrypted += 1;
    } catch (error) {
      failed += 1;
      if (failures.length < 20) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown backfill failure';
        failures.push({ key, error: errorMessage });
      }
    }
  }

  return respond({
    success: failed === 0,
    dryRun,
    prefix: prefix.length > 0 ? prefix : null,
    batchSize,
    scanned,
    eligible,
    encrypted,
    skippedEncrypted,
    skippedNonJson,
    failed,
    failures,
    hasMore: listed.truncated,
    nextCursor: listed.truncated ? listed.cursor : null
  });
}