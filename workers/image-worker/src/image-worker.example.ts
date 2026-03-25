import {
  decryptBinaryFromStorage,
  encryptBinaryForStorage,
  type DataAtRestEnvelope
} from './encryption-utils';

interface Env {
  IMAGES_API_TOKEN: string;
  STRIAE_FILES: R2Bucket;
  DATA_AT_REST_ENCRYPTION_PRIVATE_KEY: string;
  DATA_AT_REST_ENCRYPTION_PUBLIC_KEY: string;
  DATA_AT_REST_ENCRYPTION_KEY_ID: string;
  IMAGE_SIGNED_URL_SECRET?: string;
  IMAGE_SIGNED_URL_TTL_SECONDS?: string;
}

interface UploadResult {
  id: string;
  filename: string;
  uploaded: string;
  variants: string[];
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
  if (!env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY) {
    throw new Error('Data-at-rest decryption is not configured for image retrieval');
  }
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
      uploaded: uploadedAt,
      variants: []
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
  const signedToken = requestUrl.searchParams.get('st');
  if (signedToken) {
    requireSignedUrlConfig(env);

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
  const plaintext = await decryptBinaryFromStorage(
    encryptedData,
    envelope,
    env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY
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