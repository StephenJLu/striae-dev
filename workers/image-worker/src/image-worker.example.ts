import {
  decryptBinaryFromStorage,
  encryptBinaryForStorage,
  type DataAtRestEnvelope
} from './encryption-utils';

interface Env {
  IMAGES_API_TOKEN: string;
  STRIAE_FILES: R2Bucket;
  DATA_AT_REST_ENCRYPTION_PRIVATE_KEY?: string;
  DATA_AT_REST_ENCRYPTION_PUBLIC_KEY: string;
  DATA_AT_REST_ENCRYPTION_KEY_ID: string;
  DATA_AT_REST_ENCRYPTION_KEYS_JSON?: string;
  DATA_AT_REST_ENCRYPTION_ACTIVE_KEY_ID?: string;
  DATA_AT_REST_ACTIVE_ENCRYPTION_KEY_ID?: string;
  IMAGE_SIGNED_URL_SECRET?: string;
  IMAGE_SIGNED_URL_TTL_SECONDS?: string;
}

interface KeyRegistryPayload {
  activeKeyId?: unknown;
  keys?: unknown;
}

interface PrivateKeyRegistry {
  activeKeyId: string | null;
  keys: Record<string, string>;
}

type DecryptionTelemetryOutcome = 'primary-hit' | 'fallback-hit' | 'all-failed';

interface UploadResult {
  id: string;
  filename: string;
  uploaded: string;
}

interface UploadResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: UploadResult;
}

interface SuccessResponse {
  success: boolean;
}

interface ErrorResponse {
  error: string;
}

interface SignedUrlResult {
  fileId: string;
  url: string;
  expiresAt: string;
  expiresInSeconds: number;
}

interface SignedUrlResponse {
  success: boolean;
  result: SignedUrlResult;
}

type APIResponse = UploadResponse | SuccessResponse | ErrorResponse | SignedUrlResponse;

interface SignedAccessPayload {
  fileId: string;
  iat: number;
  exp: number;
  nonce: string;
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const MAX_SIGNED_URL_TTL_SECONDS = 86400;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': 'PAGES_CUSTOM_DOMAIN',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Custom-Auth-Key'
};

const createJsonResponse = (data: APIResponse, status: number = 200): Response => new Response(
  JSON.stringify(data),
  {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  }
);

function hasValidToken(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${env.IMAGES_API_TOKEN}`;
  return authHeader === expectedToken;
}

function requireEncryptionUploadConfig(env: Env): void {
  if (!env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY || !env.DATA_AT_REST_ENCRYPTION_KEY_ID) {
    throw new Error('Data-at-rest encryption is not configured for image uploads');
  }
}

function requireEncryptionRetrievalConfig(env: Env): void {
  const hasLegacyPrivateKey = typeof env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY === 'string' && env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY.trim().length > 0;
  const hasRegistry = typeof env.DATA_AT_REST_ENCRYPTION_KEYS_JSON === 'string' && env.DATA_AT_REST_ENCRYPTION_KEYS_JSON.trim().length > 0;

  if (!hasLegacyPrivateKey && !hasRegistry) {
    throw new Error('Data-at-rest decryption registry is not configured for image retrieval');
  }
}

function normalizePrivateKeyPem(rawValue: string): string {
  return rawValue.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n');
}

function getNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseDataAtRestPrivateKeyRegistry(env: Env): PrivateKeyRegistry {
  const keys: Record<string, string> = {};
  const configuredActiveKeyId =
    getNonEmptyString(env.DATA_AT_REST_ENCRYPTION_ACTIVE_KEY_ID) ??
    getNonEmptyString(env.DATA_AT_REST_ACTIVE_ENCRYPTION_KEY_ID);
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

async function decryptBinaryWithRegistry(
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

function parseFileId(pathname: string): string | null {
  const encodedFileId = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (!encodedFileId) {
    return null;
  }

  let decodedFileId = '';
  try {
    decodedFileId = decodeURIComponent(encodedFileId);
  } catch {
    return null;
  }

  if (!decodedFileId || decodedFileId.includes('/')) {
    return null;
  }

  return decodedFileId;
}

function parsePathSegments(pathname: string): string[] | null {
  const normalized = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (!normalized) {
    return [];
  }

  const rawSegments = normalized.split('/');
  const decodedSegments: string[] = [];

  for (const segment of rawSegments) {
    if (!segment) {
      return null;
    }

    let decoded = '';
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }

    if (!decoded || decoded.includes('/')) {
      return null;
    }

    decodedSegments.push(decoded);
  }

  return decodedSegments;
}

function base64UrlEncode(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Uint8Array | null {
  if (!input || /[^A-Za-z0-9_-]/.test(input)) {
    return null;
  }

  const paddingLength = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(paddingLength);

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  } catch {
    return null;
  }
}

function normalizeSignedUrlTtlSeconds(requestedTtlSeconds: unknown, env: Env): number {
  const defaultFromEnv = Number.parseInt(env.IMAGE_SIGNED_URL_TTL_SECONDS ?? '', 10);
  const fallbackTtl = Number.isFinite(defaultFromEnv) && defaultFromEnv > 0
    ? defaultFromEnv
    : DEFAULT_SIGNED_URL_TTL_SECONDS;
  const requested = typeof requestedTtlSeconds === 'number' ? requestedTtlSeconds : fallbackTtl;
  const normalized = Math.floor(requested);

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return fallbackTtl;
  }

  return Math.min(normalized, MAX_SIGNED_URL_TTL_SECONDS);
}

function requireSignedUrlConfig(env: Env): void {
  const resolvedSecret = (env.IMAGE_SIGNED_URL_SECRET || env.IMAGES_API_TOKEN || '').trim();
  if (resolvedSecret.length === 0) {
    throw new Error('Signed URL configuration is missing');
  }
}

async function getSignedUrlHmacKey(env: Env): Promise<CryptoKey> {
  const resolvedSecret = (env.IMAGE_SIGNED_URL_SECRET || env.IMAGES_API_TOKEN || '').trim();
  const keyBytes = new TextEncoder().encode(resolvedSecret);
  return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signSignedAccessPayload(payload: SignedAccessPayload, env: Env): Promise<string> {
  const payloadJson = JSON.stringify(payload);
  const payloadBase64Url = base64UrlEncode(new TextEncoder().encode(payloadJson));
  const hmacKey = await getSignedUrlHmacKey(env);
  const signature = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(payloadBase64Url));
  const signatureBase64Url = base64UrlEncode(signature);
  return `${payloadBase64Url}.${signatureBase64Url}`;
}

async function verifySignedAccessToken(token: string, fileId: string, env: Env): Promise<boolean> {
  const tokenParts = token.split('.');
  if (tokenParts.length !== 2) {
    return false;
  }

  const [payloadBase64Url, signatureBase64Url] = tokenParts;
  if (!payloadBase64Url || !signatureBase64Url) {
    return false;
  }

  const signatureBytes = base64UrlDecode(signatureBase64Url);
  if (!signatureBytes) {
    return false;
  }

  const signatureBuffer = new Uint8Array(signatureBytes).buffer;

  const hmacKey = await getSignedUrlHmacKey(env);
  const signatureValid = await crypto.subtle.verify(
    'HMAC',
    hmacKey,
    signatureBuffer,
    new TextEncoder().encode(payloadBase64Url)
  );
  if (!signatureValid) {
    return false;
  }

  const payloadBytes = base64UrlDecode(payloadBase64Url);
  if (!payloadBytes) {
    return false;
  }

  let payload: SignedAccessPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SignedAccessPayload;
  } catch {
    return false;
  }

  if (payload.fileId !== fileId) {
    return false;
  }

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(payload.exp) || payload.exp <= nowEpochSeconds) {
    return false;
  }

  if (!Number.isInteger(payload.iat) || payload.iat > nowEpochSeconds + 300) {
    return false;
  }

  return typeof payload.nonce === 'string' && payload.nonce.length > 0;
}

function extractEnvelope(file: R2ObjectBody): DataAtRestEnvelope | null {
  const metadata = file.customMetadata;
  if (!metadata) {
    return null;
  }

  const { algorithm, encryptionVersion, keyId, dataIv, wrappedKey } = metadata;
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

function deriveFileKind(contentType: string): string {
  if (contentType.startsWith('image/')) {
    return 'image';
  }

  return 'file';
}

async function handleImageUpload(request: Request, env: Env): Promise<Response> {
  if (!hasValidToken(request, env)) {
    return createJsonResponse({ error: 'Unauthorized' }, 403);
  }

  requireEncryptionUploadConfig(env);

  const formData = await request.formData();
  const fileValue = formData.get('file');
  if (!(fileValue instanceof Blob)) {
    return createJsonResponse({ error: 'Missing file upload payload' }, 400);
  }

  const fileBlob = fileValue;
  const uploadedAt = new Date().toISOString();
  const filename = fileValue instanceof File && fileValue.name ? fileValue.name : 'upload.bin';
  const contentType = fileBlob.type || 'application/octet-stream';
  const fileId = crypto.randomUUID().replace(/-/g, '');
  const plaintextBytes = await fileBlob.arrayBuffer();

  const encryptedPayload = await encryptBinaryForStorage(
    plaintextBytes,
    env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY,
    env.DATA_AT_REST_ENCRYPTION_KEY_ID
  );

  await env.STRIAE_FILES.put(fileId, encryptedPayload.ciphertext, {
    customMetadata: {
      algorithm: encryptedPayload.envelope.algorithm,
      encryptionVersion: encryptedPayload.envelope.encryptionVersion,
      keyId: encryptedPayload.envelope.keyId,
      dataIv: encryptedPayload.envelope.dataIv,
      wrappedKey: encryptedPayload.envelope.wrappedKey,
      contentType,
      originalFilename: filename,
      byteLength: String(fileBlob.size),
      createdAt: uploadedAt,
      fileKind: deriveFileKind(contentType)
    }
  });

  return createJsonResponse({
    success: true,
    errors: [],
    messages: [],
    result: {
      id: fileId,
      filename,
      uploaded: uploadedAt
    }
  });
}

async function handleImageDelete(request: Request, env: Env): Promise<Response> {
  if (!hasValidToken(request, env)) {
    return createJsonResponse({ error: 'Unauthorized' }, 403);
  }

  const fileId = parseFileId(new URL(request.url).pathname);
  if (!fileId) {
    return createJsonResponse({ error: 'Image ID is required' }, 400);
  }

  const existing = await env.STRIAE_FILES.head(fileId);
  if (!existing) {
    return createJsonResponse({ error: 'File not found' }, 404);
  }

  await env.STRIAE_FILES.delete(fileId);
  return createJsonResponse({ success: true });
}

async function handleSignedUrlMinting(request: Request, env: Env, fileId: string): Promise<Response> {
  if (!hasValidToken(request, env)) {
    return createJsonResponse({ error: 'Unauthorized' }, 403);
  }

  requireSignedUrlConfig(env);

  const existing = await env.STRIAE_FILES.head(fileId);
  if (!existing) {
    return createJsonResponse({ error: 'File not found' }, 404);
  }

  let requestedExpiresInSeconds: number | undefined;
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const requestBody = await request.json().catch(() => null) as { expiresInSeconds?: number } | null;
    if (requestBody && typeof requestBody.expiresInSeconds === 'number') {
      requestedExpiresInSeconds = requestBody.expiresInSeconds;
    }
  }

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  const ttlSeconds = normalizeSignedUrlTtlSeconds(requestedExpiresInSeconds, env);
  const payload: SignedAccessPayload = {
    fileId,
    iat: nowEpochSeconds,
    exp: nowEpochSeconds + ttlSeconds,
    nonce: crypto.randomUUID().replace(/-/g, '')
  };

  const signedToken = await signSignedAccessPayload(payload, env);
  const signedPath = `/${encodeURIComponent(fileId)}?st=${encodeURIComponent(signedToken)}`;
  const signedUrl = new URL(signedPath, request.url).toString();

  return createJsonResponse({
    success: true,
    result: {
      fileId,
      url: signedUrl,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      expiresInSeconds: ttlSeconds
    }
  });
}

async function handleImageServing(request: Request, env: Env, fileId: string): Promise<Response> {
  const requestUrl = new URL(request.url);
  const hasSignedToken = requestUrl.searchParams.has('st');
  const signedToken = requestUrl.searchParams.get('st');
  if (hasSignedToken) {
    requireSignedUrlConfig(env);

    if (!signedToken || signedToken.trim().length === 0) {
      return createJsonResponse({ error: 'Invalid or expired signed URL token' }, 403);
    }

    const tokenValid = await verifySignedAccessToken(signedToken, fileId, env);
    if (!tokenValid) {
      return createJsonResponse({ error: 'Invalid or expired signed URL token' }, 403);
    }
  } else if (!hasValidToken(request, env)) {
    return createJsonResponse({ error: 'Unauthorized' }, 403);
  }

  requireEncryptionRetrievalConfig(env);

  const file = await env.STRIAE_FILES.get(fileId);
  if (!file) {
    return createJsonResponse({ error: 'File not found' }, 404);
  }

  const envelope = extractEnvelope(file);
  if (!envelope) {
    return createJsonResponse({ error: 'Missing data-at-rest envelope metadata' }, 500);
  }

  const encryptedData = await file.arrayBuffer();
  const plaintext = await decryptBinaryWithRegistry(
    encryptedData,
    envelope,
    env
  );

  const contentType = file.customMetadata?.contentType || 'application/octet-stream';
  const filename = file.customMetadata?.originalFilename || fileId;

  return new Response(plaintext, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const requestUrl = new URL(request.url);
      const pathSegments = parsePathSegments(requestUrl.pathname);
      if (!pathSegments) {
        return createJsonResponse({ error: 'Invalid image path encoding' }, 400);
      }

      switch (request.method) {
        case 'POST': {
          if (pathSegments.length === 0) {
            return handleImageUpload(request, env);
          }

          if (pathSegments.length === 2 && pathSegments[1] === 'signed-url') {
            return handleSignedUrlMinting(request, env, pathSegments[0]);
          }

          return createJsonResponse({ error: 'Not found' }, 404);
        }
        case 'GET': {
          const fileId = pathSegments.length === 1 ? pathSegments[0] : null;
          if (!fileId) {
            return createJsonResponse({ error: 'Image ID is required' }, 400);
          }

          return handleImageServing(request, env, fileId);
        }
        case 'DELETE':
          return handleImageDelete(request, env);
        default:
          return createJsonResponse({ error: 'Method not allowed' }, 405);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createJsonResponse({ error: errorMessage }, 500);
    }
  }
};