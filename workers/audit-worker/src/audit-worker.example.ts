interface Env {
  R2_KEY_SECRET: string;
  STRIAE_AUDIT: R2Bucket;
  DATA_AT_REST_ENCRYPTION_ENABLED?: string;
  DATA_AT_REST_ENCRYPTION_PRIVATE_KEY?: string;
  DATA_AT_REST_ENCRYPTION_PUBLIC_KEY?: string;
  DATA_AT_REST_ENCRYPTION_KEY_ID?: string;
}

interface AuditEntry {
  timestamp: string;
  userId: string;
  action: string;
  [key: string]: unknown;
}

interface SuccessResponse {
  success: boolean;
  entryCount?: number;
  filename?: string;
}

interface ErrorResponse {
  error: string;
}

interface AuditRetrievalResponse {
  entries: AuditEntry[];
  total: number;
}

type APIResponse = SuccessResponse | ErrorResponse | AuditRetrievalResponse | Record<string, unknown>;

interface DataAtRestEnvelope {
  algorithm: string;
  encryptionVersion: string;
  keyId: string;
  dataIv: string;
  wrappedKey: string;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': 'PAGES_CUSTOM_DOMAIN',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Custom-Auth-Key',
  'Content-Type': 'application/json'
};

const createResponse = (data: APIResponse, status: number = 200): Response => new Response(
  JSON.stringify(data),
  { status, headers: corsHeaders }
);

const hasValidHeader = (request: Request, env: Env): boolean =>
  request.headers.get('X-Custom-Auth-Key') === env.R2_KEY_SECRET;

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

function generateAuditFileName(userId: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `audit-trails/${userId}/${date}.json`;
}

function isValidAuditEntry(entry: unknown): entry is AuditEntry {
  const candidate = entry as Partial<AuditEntry> | null;

  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof candidate.timestamp === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.action === 'string'
  );
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const decoded = atob(normalized + padding);
  const bytes = new Uint8Array(decoded.length);

  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }

  return bytes;
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;

  for (let i = 0; i < value.length; i += chunkSize) {
    const chunk = value.subarray(i, Math.min(i + chunkSize, value.length));
    for (let j = 0; j < chunk.length; j += 1) {
      binary += String.fromCharCode(chunk[j]);
    }
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parsePkcs8PrivateKey(privateKey: string): ArrayBuffer {
  const normalizedKey = privateKey
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n');

  const pemBody = normalizedKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  if (!pemBody) {
    throw new Error('Encryption private key is invalid');
  }

  const binary = atob(pemBody);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function parseSpkiPublicKey(publicKey: string): ArrayBuffer {
  const normalizedKey = publicKey
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n');

  const pemBody = normalizedKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');

  if (!pemBody) {
    throw new Error('Encryption public key is invalid');
  }

  const binary = atob(pemBody);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function importRsaOaepPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    parsePkcs8PrivateKey(privateKeyPem),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    false,
    ['decrypt']
  );
}

async function importRsaOaepPublicKey(publicKeyPem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    parseSpkiPublicKey(publicKeyPem),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    false,
    ['encrypt']
  );
}

async function createAesGcmKey(usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    usages
  ) as Promise<CryptoKey>;
}

async function wrapAesKey(aesKey: CryptoKey, publicKeyPem: string): Promise<string> {
  const rsaPublicKey = await importRsaOaepPublicKey(publicKeyPem);
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaPublicKey,
    rawAesKey as BufferSource
  );

  return base64UrlEncode(new Uint8Array(wrappedKey));
}

async function unwrapAesKey(wrappedKeyBase64: string, privateKeyPem: string): Promise<CryptoKey> {
  const rsaPrivateKey = await importRsaOaepPrivateKey(privateKeyPem);
  const wrappedKeyBytes = base64UrlDecode(wrappedKeyBase64);

  const rawAesKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    rsaPrivateKey,
    wrappedKeyBytes as BufferSource
  );

  return crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

async function decryptJsonFromStorage(
  ciphertext: ArrayBuffer,
  envelope: DataAtRestEnvelope,
  privateKeyPem: string
): Promise<string> {
  const aesKey = await unwrapAesKey(envelope.wrappedKey, privateKeyPem);
  const iv = base64UrlDecode(envelope.dataIv);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    aesKey,
    ciphertext as BufferSource
  );

  return new TextDecoder().decode(plaintext);
}

async function encryptJsonForStorage(
  plaintextJson: string,
  publicKeyPem: string,
  keyId: string
): Promise<{ ciphertext: Uint8Array; envelope: DataAtRestEnvelope }> {
  const aesKey = await createAesGcmKey(['encrypt', 'decrypt']);
  const wrappedKey = await wrapAesKey(aesKey, publicKeyPem);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const plaintextBytes = new TextEncoder().encode(plaintextJson);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    aesKey,
    plaintextBytes as BufferSource
  );

  return {
    ciphertext: new Uint8Array(encryptedBuffer),
    envelope: {
      algorithm: DATA_AT_REST_ENCRYPTION_ALGORITHM,
      encryptionVersion: DATA_AT_REST_ENCRYPTION_VERSION,
      keyId,
      dataIv: base64UrlEncode(iv),
      wrappedKey
    }
  };
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
  if (!Number.isFinite(size)) {
    return 100;
  }

  if (size === undefined) {
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

async function readAuditEntriesFromObject(file: R2ObjectBody, env: Env): Promise<AuditEntry[]> {
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

  if (!env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY) {
    throw new Error('Data-at-rest decryption is not configured on this server');
  }

  const encryptedData = await file.arrayBuffer();
  const plaintext = await decryptJsonFromStorage(
    encryptedData,
    atRestEnvelope,
    env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY
  );

  return JSON.parse(plaintext) as AuditEntry[];
}

async function writeAuditEntriesToObject(
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

async function appendAuditEntry(
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

  const bucket = env.STRIAE_AUDIT;
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
      const bucket = env.STRIAE_AUDIT;

      if (request.method === 'POST' && pathname === DATA_AT_REST_BACKFILL_PATH) {
        return await handleDataAtRestBackfill(request, env);
      }

      if (!pathname.startsWith('/audit/')) {
        return createResponse({ error: 'This worker only handles audit endpoints. Use /audit/ path.' }, 404);
      }

      const userId = url.searchParams.get('userId');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      if (request.method === 'POST') {
        if (!userId) {
          return createResponse({ error: 'userId parameter is required' }, 400);
        }

        const auditEntry: unknown = await request.json();

        if (!isValidAuditEntry(auditEntry)) {
          return createResponse({ error: 'Invalid audit entry structure. Required fields: timestamp, userId, action' }, 400);
        }

        const filename = generateAuditFileName(userId);

        try {
          const entryCount = await appendAuditEntry(bucket, filename, auditEntry, env);
          return createResponse({
            success: true,
            entryCount,
            filename
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          return createResponse({ error: `Failed to store audit entry: ${errorMessage}` }, 500);
        }
      }

      if (request.method === 'GET') {
        if (!userId) {
          return createResponse({ error: 'userId parameter is required' }, 400);
        }

        try {
          let allEntries: AuditEntry[] = [];

          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const currentDate = new Date(start);

            while (currentDate <= end) {
              const dateStr = currentDate.toISOString().split('T')[0];
              const filename = `audit-trails/${userId}/${dateStr}.json`;
              const file = await bucket.get(filename);

              if (file) {
                const entries = await readAuditEntriesFromObject(file, env);
                allEntries.push(...entries);
              }

              currentDate.setDate(currentDate.getDate() + 1);
            }
          } else {
            const filename = generateAuditFileName(userId);
            const file = await bucket.get(filename);

            if (file) {
              allEntries = await readAuditEntriesFromObject(file, env);
            }
          }

          allEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          return createResponse({
            entries: allEntries,
            total: allEntries.length
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          return createResponse({ error: `Failed to retrieve audit entries: ${errorMessage}` }, 500);
        }
      }

      return createResponse({ error: 'Method not allowed for audit endpoints. Only GET and POST are supported.' }, 405);

    } catch (error) {
      console.error('Audit Worker error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createResponse({ error: errorMessage }, 500);
    }
  }
};
