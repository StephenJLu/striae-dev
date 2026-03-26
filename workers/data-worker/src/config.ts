import type { Env } from './types';

export const SIGN_MANIFEST_PATH = '/api/forensic/sign-manifest';
export const SIGN_CONFIRMATION_PATH = '/api/forensic/sign-confirmation';
export const SIGN_AUDIT_EXPORT_PATH = '/api/forensic/sign-audit-export';
export const DECRYPT_EXPORT_PATH = '/api/forensic/decrypt-export';
export const DATA_AT_REST_BACKFILL_PATH = '/api/admin/data-at-rest-backfill';
export const DATA_AT_REST_ENCRYPTION_ALGORITHM = 'RSA-OAEP-AES-256-GCM';
export const DATA_AT_REST_ENCRYPTION_VERSION = '1.0';

export const hasValidHeader = (request: Request, env: Env): boolean =>
  request.headers.get('X-Custom-Auth-Key') === env.R2_KEY_SECRET;