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
}

interface UploadResult {
  id: string;
  filename: string;
  uploaded: string;
  requireSignedURLs: boolean;
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

type APIResponse = UploadResponse | SuccessResponse | ErrorResponse;

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

function requireEncryptionConfig(env: Env): void {
  if (!env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY || !env.DATA_AT_REST_ENCRYPTION_KEY_ID) {
    throw new Error('Data-at-rest encryption is not configured for image uploads');
  }

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

  requireEncryptionConfig(env);

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
      requireSignedURLs: false,
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

async function handleImageServing(request: Request, env: Env): Promise<Response> {
  if (!hasValidToken(request, env)) {
    return createJsonResponse({ error: 'Unauthorized' }, 403);
  }

  requireEncryptionConfig(env);

  const fileId = parseFileId(new URL(request.url).pathname);
  if (!fileId) {
    return createJsonResponse({ error: 'Image ID is required' }, 400);
  }

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
      switch (request.method) {
        case 'POST':
          return handleImageUpload(request, env);
        case 'GET':
          return handleImageServing(request, env);
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