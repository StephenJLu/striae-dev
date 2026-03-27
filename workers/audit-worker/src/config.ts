import type { Env } from './types';

export const DATA_AT_REST_ENCRYPTION_ALGORITHM = 'RSA-OAEP-AES-256-GCM';
export const DATA_AT_REST_ENCRYPTION_VERSION = '1.0';

export const hasValidHeader = (request: Request, env: Env): boolean =>
  request.headers.get('X-Custom-Auth-Key') === env.R2_KEY_SECRET;