import { signPayload as signWithWorkerKey } from './signature-utils';
import {
  decryptExportData,
  decryptImageBlob,
  decryptJsonFromStorage,
  encryptJsonForStorage,
  type DataAtRestEnvelope
} from './encryption-utils';
import {
  AUDIT_EXPORT_SIGNATURE_VERSION,
  CONFIRMATION_SIGNATURE_VERSION,
  FORENSIC_MANIFEST_SIGNATURE_ALGORITHM,
  FORENSIC_MANIFEST_VERSION,
  type AuditExportSigningPayload,
  type ConfirmationSigningPayload,
  type ForensicManifestPayload,
  createAuditExportSigningPayload,
  createConfirmationSigningPayload,
  createManifestSigningPayload,
  isValidAuditExportPayload,
  isValidConfirmationPayload,
  isValidManifestPayload
} from './signing-payload-utils';

interface Env {
  R2_KEY_SECRET: string;
  STRIAE_DATA: R2Bucket;
  MANIFEST_SIGNING_PRIVATE_KEY: string;
  MANIFEST_SIGNING_KEY_ID: string;
  EXPORT_ENCRYPTION_PRIVATE_KEY?: string;
  EXPORT_ENCRYPTION_KEY_ID?: string;
  DATA_AT_REST_ENCRYPTION_ENABLED?: string;
  DATA_AT_REST_ENCRYPTION_PRIVATE_KEY?: string;
  DATA_AT_REST_ENCRYPTION_PUBLIC_KEY?: string;
  DATA_AT_REST_ENCRYPTION_KEY_ID?: string;
}

interface SuccessResponse {
  success: boolean;
}

interface ErrorResponse {
  error: string;
}

type APIResponse = SuccessResponse | ErrorResponse | unknown[] | Record<string, unknown>;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': 'PAGES_CUSTOM_DOMAIN',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Custom-Auth-Key',
  'Content-Type': 'application/json'
};

const createResponse = (data: APIResponse, status: number = 200): Response => new Response(
  JSON.stringify(data),
  { status, headers: corsHeaders }
);

const hasValidHeader = (request: Request, env: Env): boolean =>
  request.headers.get('X-Custom-Auth-Key') === env.R2_KEY_SECRET;

const SIGN_MANIFEST_PATH = '/api/forensic/sign-manifest';
const SIGN_CONFIRMATION_PATH = '/api/forensic/sign-confirmation';
const SIGN_AUDIT_EXPORT_PATH = '/api/forensic/sign-audit-export';
const DECRYPT_EXPORT_PATH = '/api/forensic/decrypt-export';
const DATA_AT_REST_BACKFILL_PATH = '/api/admin/data-at-rest-backfill';
const DATA_AT_REST_ENCRYPTION_ALGORITHM = 'RSA-OAEP-AES-256-GCM';
const DATA_AT_REST_ENCRYPTION_VERSION = '1.0';

function isDataAtRestEncryptionEnabled(env: Env): boolean {
  const value = env.DATA_AT_REST_ENCRYPTION_ENABLED;
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'yes' || normalizedValue === 'on';
}

function extractDataAtRestEnvelope(file: R2ObjectBody): DataAtRestEnvelope | null {
  const metadata = file.customMetadata;
  if (!metadata) {
    return null;
  }

  const {
    algorithm,
    encryptionVersion,
    keyId,
    dataIv,
    wrappedKey
  } = metadata;

  if (
    typeof algorithm !== 'string' ||
    typeof encryptionVersion !== 'string' ||
    typeof keyId !== 'string' ||
    typeof dataIv !== 'string' ||
    typeof wrappedKey !== 'string'
  ) {
    return null;
  }

  return {
    algorithm,
    encryptionVersion,
    keyId,
    dataIv,
    wrappedKey
  };
}

function hasDataAtRestMetadata(metadata: Record<string, string> | undefined): boolean {
  if (!metadata) {
    return false;
  }

  return (
    typeof metadata.algorithm === 'string' &&
    typeof metadata.encryptionVersion === 'string' &&
    typeof metadata.keyId === 'string' &&
    typeof metadata.dataIv === 'string' &&
    typeof metadata.wrappedKey === 'string'
  );
}

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

async function handleDataAtRestBackfill(request: Request, env: Env): Promise<Response> {
  if (!env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY || !env.DATA_AT_REST_ENCRYPTION_KEY_ID) {
    return createResponse(
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

  return createResponse({
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

async function signPayloadWithWorkerKey(payload: string, env: Env): Promise<{
  algorithm: string;
  keyId: string;
  signedAt: string;
  value: string;
}> {
  return signWithWorkerKey(
    payload,
    env.MANIFEST_SIGNING_PRIVATE_KEY,
    env.MANIFEST_SIGNING_KEY_ID,
    FORENSIC_MANIFEST_SIGNATURE_ALGORITHM
  );
}

async function signManifest(manifest: ForensicManifestPayload, env: Env): Promise<{
  algorithm: string;
  keyId: string;
  signedAt: string;
  value: string;
}> {
  const payload = createManifestSigningPayload(manifest);
  return signPayloadWithWorkerKey(payload, env);
}

async function signConfirmation(confirmationData: ConfirmationSigningPayload, env: Env): Promise<{
  algorithm: string;
  keyId: string;
  signedAt: string;
  value: string;
}> {
  const payload = createConfirmationSigningPayload(confirmationData);
  return signPayloadWithWorkerKey(payload, env);
}

async function signAuditExport(auditExportData: AuditExportSigningPayload, env: Env): Promise<{
  algorithm: string;
  keyId: string;
  signedAt: string;
  value: string;
}> {
  const payload = createAuditExportSigningPayload(auditExportData);
  return signPayloadWithWorkerKey(payload, env);
}

async function handleSignManifest(request: Request, env: Env): Promise<Response> {
  try {
    const requestBody = await request.json() as { manifest?: Partial<ForensicManifestPayload> } & Partial<ForensicManifestPayload>;
    const manifestCandidate: Partial<ForensicManifestPayload> = requestBody.manifest ?? requestBody;

    if (!manifestCandidate || !isValidManifestPayload(manifestCandidate)) {
      return createResponse({ error: 'Invalid manifest payload' }, 400);
    }

    const signature = await signManifest(manifestCandidate, env);

    return createResponse({
      success: true,
      manifestVersion: FORENSIC_MANIFEST_VERSION,
      signature
    });
  } catch (error) {
    console.error('Manifest signing failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createResponse({ error: errorMessage }, 500);
  }
}

async function handleSignConfirmation(request: Request, env: Env): Promise<Response> {
  try {
    const requestBody = await request.json() as {
      confirmationData?: Partial<ConfirmationSigningPayload>;
      signatureVersion?: string;
    } & Partial<ConfirmationSigningPayload>;

    const requestedSignatureVersion =
      typeof requestBody.signatureVersion === 'string' && requestBody.signatureVersion.trim().length > 0
        ? requestBody.signatureVersion
        : CONFIRMATION_SIGNATURE_VERSION;

    if (requestedSignatureVersion !== CONFIRMATION_SIGNATURE_VERSION) {
      return createResponse(
        { error: `Unsupported confirmation signature version: ${requestedSignatureVersion}` },
        400
      );
    }

    const confirmationCandidate: Partial<ConfirmationSigningPayload> = requestBody.confirmationData ?? requestBody;

    if (!confirmationCandidate || !isValidConfirmationPayload(confirmationCandidate)) {
      return createResponse({ error: 'Invalid confirmation payload' }, 400);
    }

    const signature = await signConfirmation(confirmationCandidate, env);

    return createResponse({
      success: true,
      signatureVersion: CONFIRMATION_SIGNATURE_VERSION,
      signature
    });
  } catch (error) {
    console.error('Confirmation signing failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createResponse({ error: errorMessage }, 500);
  }
}

async function handleSignAuditExport(request: Request, env: Env): Promise<Response> {
  try {
    const requestBody = await request.json() as {
      auditExport?: Partial<AuditExportSigningPayload>;
      signatureVersion?: string;
    } & Partial<AuditExportSigningPayload>;

    const requestedSignatureVersion =
      typeof requestBody.signatureVersion === 'string' && requestBody.signatureVersion.trim().length > 0
        ? requestBody.signatureVersion
        : AUDIT_EXPORT_SIGNATURE_VERSION;

    if (requestedSignatureVersion !== AUDIT_EXPORT_SIGNATURE_VERSION) {
      return createResponse(
        { error: `Unsupported audit export signature version: ${requestedSignatureVersion}` },
        400
      );
    }

    const auditExportCandidate: Partial<AuditExportSigningPayload> = requestBody.auditExport ?? requestBody;

    if (!auditExportCandidate || !isValidAuditExportPayload(auditExportCandidate)) {
      return createResponse({ error: 'Invalid audit export payload' }, 400);
    }

    const signature = await signAuditExport(auditExportCandidate, env);

    return createResponse({
      success: true,
      signatureVersion: AUDIT_EXPORT_SIGNATURE_VERSION,
      signature
    });
  } catch (error) {
    console.error('Audit export signing failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createResponse({ error: errorMessage }, 500);
  }
}

async function handleDecryptExport(request: Request, env: Env): Promise<Response> {
  try {
    // Check if encryption is configured
    if (!env.EXPORT_ENCRYPTION_PRIVATE_KEY || !env.EXPORT_ENCRYPTION_KEY_ID) {
      return createResponse(
        { error: 'Export decryption is not configured on this server' },
        400
      );
    }

    const requestBody = await request.json() as {
      wrappedKey?: string;
      dataIv?: string;
      encryptedData?: string;
      encryptedImages?: Array<{ filename: string; encryptedData: string; iv?: string }>;
      keyId?: string;
    };

    const { wrappedKey, dataIv, encryptedData, encryptedImages, keyId } = requestBody;

    // Validate required fields
    if (
      !wrappedKey ||
      typeof wrappedKey !== 'string' ||
      !dataIv ||
      typeof dataIv !== 'string' ||
      !encryptedData ||
      typeof encryptedData !== 'string' ||
      !keyId ||
      typeof keyId !== 'string'
    ) {
      return createResponse(
        { error: 'Missing or invalid required fields: wrappedKey, dataIv, encryptedData, keyId' },
        400
      );
    }

    // Validate keyId matches configured key
    if (keyId !== env.EXPORT_ENCRYPTION_KEY_ID) {
      return createResponse(
        { error: `Key ID mismatch: expected ${env.EXPORT_ENCRYPTION_KEY_ID}, got ${keyId}` },
        400
      );
    }

    // Decrypt data file
    let plaintextData: string;
    try {
      plaintextData = await decryptExportData(
        encryptedData,
        wrappedKey,
        dataIv,
        env.EXPORT_ENCRYPTION_PRIVATE_KEY
      );
    } catch (error) {
      console.error('Data file decryption failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Decryption failed';
      return createResponse(
        { error: `Failed to decrypt data file: ${errorMessage}` },
        500
      );
    }

    // Decrypt images if provided
    const decryptedImages: Array<{ filename: string; data: string }> = [];
    if (Array.isArray(encryptedImages) && encryptedImages.length > 0) {
      for (const imageEntry of encryptedImages) {
        try {
          if (!imageEntry.iv || typeof imageEntry.iv !== 'string') {
            return createResponse(
              { error: `Missing IV for image ${imageEntry.filename}` },
              400
            );
          }

          const imageBlob = await decryptImageBlob(
            imageEntry.encryptedData,
            wrappedKey,
            imageEntry.iv,
            env.EXPORT_ENCRYPTION_PRIVATE_KEY
          );

          // Convert blob to base64 for transport
          const arrayBuffer = await imageBlob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
            const chunkSize = 8192;
            let binary = '';
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
              for (let j = 0; j < chunk.length; j++) {
                binary += String.fromCharCode(chunk[j]);
              }
            }
            const base64Data = btoa(binary);

          decryptedImages.push({
            filename: imageEntry.filename,
            data: base64Data
          });
        } catch (error) {
          console.error(`Image decryption failed for ${imageEntry.filename}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Decryption failed';
          return createResponse(
            { error: `Failed to decrypt image ${imageEntry.filename}: ${errorMessage}` },
            500
          );
        }
      }
    }

    return createResponse({
      success: true,
      plaintext: plaintextData,
      decryptedImages
    });
  } catch (error) {
    console.error('Export decryption request failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createResponse({ error: errorMessage }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (!hasValidHeader(request, env)) {
      return createResponse({ error: 'Forbidden' }, 403);
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const bucket = env.STRIAE_DATA;

      if (request.method === 'POST' && pathname === SIGN_MANIFEST_PATH) {
        return await handleSignManifest(request, env);
      }

      if (request.method === 'POST' && pathname === SIGN_CONFIRMATION_PATH) {
        return await handleSignConfirmation(request, env);
      }

      if (request.method === 'POST' && pathname === SIGN_AUDIT_EXPORT_PATH) {
        return await handleSignAuditExport(request, env);
      }

      if (request.method === 'POST' && pathname === DECRYPT_EXPORT_PATH) {
        return await handleDecryptExport(request, env);
      }

      if (request.method === 'POST' && pathname === DATA_AT_REST_BACKFILL_PATH) {
        return await handleDataAtRestBackfill(request, env);
      }

      const filename = pathname.slice(1) || 'data.json';

      if (!filename.endsWith('.json')) {
        return createResponse({ error: 'Invalid file type. Only JSON files are allowed.' }, 400);
      }

      switch (request.method) {
        case 'GET': {
          const file = await bucket.get(filename);
          if (!file) {
            return createResponse([], 200);
          }

          const atRestEnvelope = extractDataAtRestEnvelope(file);
          if (atRestEnvelope) {
            if (atRestEnvelope.algorithm !== DATA_AT_REST_ENCRYPTION_ALGORITHM) {
              return createResponse({ error: 'Unsupported data-at-rest encryption algorithm' }, 500);
            }

            if (atRestEnvelope.encryptionVersion !== DATA_AT_REST_ENCRYPTION_VERSION) {
              return createResponse({ error: 'Unsupported data-at-rest encryption version' }, 500);
            }

            if (!env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY) {
              return createResponse(
                { error: 'Data-at-rest decryption is not configured on this server' },
                500
              );
            }

            try {
              const encryptedData = await file.arrayBuffer();
              const plaintext = await decryptJsonFromStorage(
                encryptedData,
                atRestEnvelope,
                env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY
              );
              const decryptedPayload = JSON.parse(plaintext);
              return createResponse(decryptedPayload);
            } catch (error) {
              console.error('Data-at-rest decryption failed:', error);
              return createResponse({ error: 'Failed to decrypt stored data' }, 500);
            }
          }

          const fileText = await file.text();
          const data = JSON.parse(fileText);
          return createResponse(data);
        }

        case 'PUT': {
          const newData = await request.json();
          const serializedData = JSON.stringify(newData);

          if (!isDataAtRestEncryptionEnabled(env)) {
            await bucket.put(filename, serializedData);
            return createResponse({ success: true });
          }

          if (!env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY || !env.DATA_AT_REST_ENCRYPTION_KEY_ID) {
            return createResponse(
              { error: 'Data-at-rest encryption is enabled but not fully configured' },
              500
            );
          }

          try {
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
          } catch (error) {
            console.error('Data-at-rest encryption failed:', error);
            return createResponse({ error: 'Failed to encrypt data for storage' }, 500);
          }

          return createResponse({ success: true });
        }

        case 'DELETE': {
          const file = await bucket.get(filename);
          if (!file) {
            return createResponse({ error: 'File not found' }, 404);
          }
          await bucket.delete(filename);
          return createResponse({ success: true });
        }

        default:
          return createResponse({ error: 'Method not allowed' }, 405);
      }
    } catch (error) {
      console.error('Worker error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createResponse({ error: errorMessage }, 500);
    }
  }
};
