import type { Env } from './types';

export function hasValidToken(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${env.IMAGES_API_TOKEN}`;
  return authHeader === expectedToken;
}

export function requireEncryptionUploadConfig(env: Env): void {
  if (!env.DATA_AT_REST_ENCRYPTION_PUBLIC_KEY || !env.DATA_AT_REST_ENCRYPTION_KEY_ID) {
    throw new Error('Data-at-rest encryption is not configured for image uploads');
  }
}

export function requireEncryptionRetrievalConfig(env: Env): void {
  const hasLegacyPrivateKey =
    typeof env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY === 'string' &&
    env.DATA_AT_REST_ENCRYPTION_PRIVATE_KEY.trim().length > 0;
  const hasRegistry =
    typeof env.DATA_AT_REST_ENCRYPTION_KEYS_JSON === 'string' &&
    env.DATA_AT_REST_ENCRYPTION_KEYS_JSON.trim().length > 0;

  if (!hasLegacyPrivateKey && !hasRegistry) {
    throw new Error('Data-at-rest decryption registry is not configured for image retrieval');
  }
}

export function requireSignedUrlConfig(env: Env): void {
  const resolvedSecret = (env.IMAGE_SIGNED_URL_SECRET || env.IMAGES_API_TOKEN || '').trim();
  if (resolvedSecret.length === 0) {
    throw new Error('Signed URL configuration is missing');
  }
}
