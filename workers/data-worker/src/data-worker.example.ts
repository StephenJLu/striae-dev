import {
  DECRYPT_EXPORT_PATH,
  SIGN_AUDIT_EXPORT_PATH,
  SIGN_CONFIRMATION_PATH,
  SIGN_MANIFEST_PATH,
  hasValidHeader
} from './config';
import { handleDecryptExport } from './handlers/decrypt-export';
import {
  handleSignAuditExport,
  handleSignConfirmation,
  handleSignManifest
} from './handlers/signing';
import { handleStorageRequest } from './handlers/storage-routes';
import type { CreateResponse, Env, APIResponse } from './types';

const APP_DOMAIN = 'PAGES_CUSTOM_DOMAIN';

function isAllowedOrigin(origin: string): boolean {
  try {
    const allowedUrl = new URL(APP_DOMAIN);
    const requestUrl = new URL(origin);

    if (requestUrl.protocol !== allowedUrl.protocol) {
      return false;
    }

    if (requestUrl.origin === allowedUrl.origin) {
      return true;
    }

    return requestUrl.hostname.endsWith(`.${allowedUrl.hostname}`);
  } catch {
    return false;
  }
}

function getCorsHeaders(origin?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Custom-Auth-Key',
    'Content-Type': 'application/json'
  };
  
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  
  return headers;
}

const createWorkerResponse: CreateResponse = (data, status: number = 200, origin?: string): Response => new Response(
  JSON.stringify(data),
  { status, headers: getCorsHeaders(origin) }
);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const corsHeaders = getCorsHeaders(origin);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (!hasValidHeader(request, env)) {
      return createWorkerResponse({ error: 'Forbidden' }, 403, origin);
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (request.method === 'POST' && pathname === SIGN_MANIFEST_PATH) {
        return await handleSignManifest(request, env, ((data: unknown, status?: number) => createWorkerResponse(data as APIResponse, status, origin)) as CreateResponse);
      }

      if (request.method === 'POST' && pathname === SIGN_CONFIRMATION_PATH) {
        return await handleSignConfirmation(request, env, ((data: unknown, status?: number) => createWorkerResponse(data as APIResponse, status, origin)) as CreateResponse);
      }

      if (request.method === 'POST' && pathname === SIGN_AUDIT_EXPORT_PATH) {
        return await handleSignAuditExport(request, env, ((data: unknown, status?: number) => createWorkerResponse(data as APIResponse, status, origin)) as CreateResponse);
      }

      if (request.method === 'POST' && pathname === DECRYPT_EXPORT_PATH) {
        return await handleDecryptExport(request, env, ((data: unknown, status?: number) => createWorkerResponse(data as APIResponse, status, origin)) as CreateResponse);
      }

      return await handleStorageRequest(request, env, pathname, ((data: unknown, status?: number) => createWorkerResponse(data as APIResponse, status, origin)) as CreateResponse);
    } catch (error) {
      console.error('Worker error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createWorkerResponse({ error: errorMessage }, 500, origin);
    }
  }
};
