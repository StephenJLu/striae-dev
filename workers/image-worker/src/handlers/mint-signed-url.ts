import {
  normalizeSignedUrlTtlSeconds,
  parseSignedUrlBaseUrl,
  requireSignedUrlConfig,
  signSignedAccessPayload
} from '../security/signed-url';
import type {
  CreateImageWorkerResponse,
  Env,
  SignedAccessPayload
} from '../types';

interface SignedUrlMintRequestBody {
  expiresInSeconds?: unknown;
}

export async function handleSignedUrlMinting(
  request: Request,
  env: Env,
  fileId: string,
  createJsonResponse: CreateImageWorkerResponse
): Promise<Response> {
  requireSignedUrlConfig(env);

  const existing = await env.STRIAE_FILES.head(fileId);
  if (!existing) {
    return createJsonResponse({ error: 'File not found' }, 404);
  }

  let requestedExpiresInSeconds: number | undefined;
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const requestBody = await request.json().catch(() => null);
    if (requestBody && typeof requestBody === 'object') {
      const expiresInSeconds = (requestBody as SignedUrlMintRequestBody).expiresInSeconds;
      if (typeof expiresInSeconds === 'number') {
        requestedExpiresInSeconds = expiresInSeconds;
      }
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

  let baseUrl: string;
  if (env.IMAGE_SIGNED_URL_BASE_URL) {
    try {
      baseUrl = parseSignedUrlBaseUrl(env.IMAGE_SIGNED_URL_BASE_URL);
    } catch (error) {
      console.error('Invalid IMAGE_SIGNED_URL_BASE_URL configuration', {
        reason: error instanceof Error ? error.message : String(error)
      });
      return createJsonResponse({ error: 'Signed URL base URL is misconfigured' }, 500);
    }
  } else {
    baseUrl = new URL(request.url).origin;
  }

  const signedUrl = `${baseUrl}/${encodeURIComponent(fileId)}?st=${encodeURIComponent(signedToken)}`;

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