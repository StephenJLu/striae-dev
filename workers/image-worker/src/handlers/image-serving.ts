import { hasValidToken, requireEncryptionRetrievalConfig, requireSignedUrlConfig } from '../auth';
import type { DataAtRestEnvelope } from '../encryption-utils';
import { decryptBinaryWithRegistry } from '../registry/private-key-registry';
import { verifySignedAccessToken } from '../signed-url';
import type { CreateResponse, Env } from '../types';

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

export async function handleImageServing(
  request: Request,
  env: Env,
  fileId: string,
  corsHeaders: Record<string, string>,
  createResponse: CreateResponse
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const hasSignedToken = requestUrl.searchParams.has('st');
  const signedToken = requestUrl.searchParams.get('st');
  if (hasSignedToken) {
    requireSignedUrlConfig(env);

    if (!signedToken || signedToken.trim().length === 0) {
      return createResponse({ error: 'Invalid or expired signed URL token' }, 403);
    }

    const tokenValid = await verifySignedAccessToken(signedToken, fileId, env);
    if (!tokenValid) {
      return createResponse({ error: 'Invalid or expired signed URL token' }, 403);
    }
  } else if (!hasValidToken(request, env)) {
    return createResponse({ error: 'Unauthorized' }, 403);
  }

  requireEncryptionRetrievalConfig(env);

  const file = await env.STRIAE_FILES.get(fileId);
  if (!file) {
    return createResponse({ error: 'File not found' }, 404);
  }

  const envelope = extractEnvelope(file);
  if (!envelope) {
    return createResponse({ error: 'Missing data-at-rest envelope metadata' }, 500);
  }

  const encryptedData = await file.arrayBuffer();
  const plaintext = await decryptBinaryWithRegistry(encryptedData, envelope, env);

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
