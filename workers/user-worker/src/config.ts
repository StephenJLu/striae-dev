import type { Env } from './types';

export const USER_CASES_SEGMENT = 'cases';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const FIREBASE_IDENTITY_TOOLKIT_BASE_URL = 'https://identitytoolkit.googleapis.com/v1/projects';
export const GOOGLE_IDENTITY_TOOLKIT_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';

export function normalizeWorkerBaseUrl(workerDomain: string): string {
  const trimmedDomain = workerDomain.trim().replace(/\/+$/, '');
  if (trimmedDomain.startsWith('http://') || trimmedDomain.startsWith('https://')) {
    return trimmedDomain;
  }

  return `https://${trimmedDomain}`;
}

export function resolveAuditWorkerBaseUrl(env: Env, defaultAuditWorkerBaseUrl: string): string {
  const configuredDomain = typeof env.AUDIT_WORKER_DOMAIN === 'string' ? env.AUDIT_WORKER_DOMAIN.trim() : '';
  if (configuredDomain.length > 0) {
    return normalizeWorkerBaseUrl(configuredDomain);
  }

  return normalizeWorkerBaseUrl(defaultAuditWorkerBaseUrl);
}