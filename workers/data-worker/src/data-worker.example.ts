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
import type { CreateResponse, Env } from './types';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': 'PAGES_CUSTOM_DOMAIN',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Custom-Auth-Key',
  'Content-Type': 'application/json'
};

const createWorkerResponse: CreateResponse = (data, status: number = 200): Response => new Response(
  JSON.stringify(data),
  { status, headers: corsHeaders }
);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (!hasValidHeader(request, env)) {
      return createWorkerResponse({ error: 'Forbidden' }, 403);
    }

    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      if (request.method === 'POST' && pathname === SIGN_MANIFEST_PATH) {
        return await handleSignManifest(request, env, createWorkerResponse);
      }

      if (request.method === 'POST' && pathname === SIGN_CONFIRMATION_PATH) {
        return await handleSignConfirmation(request, env, createWorkerResponse);
      }

      if (request.method === 'POST' && pathname === SIGN_AUDIT_EXPORT_PATH) {
        return await handleSignAuditExport(request, env, createWorkerResponse);
      }

      if (request.method === 'POST' && pathname === DECRYPT_EXPORT_PATH) {
        return await handleDecryptExport(request, env, createWorkerResponse);
      }

      return await handleStorageRequest(request, env, pathname, createWorkerResponse);
    } catch (error) {
      console.error('Worker error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createWorkerResponse({ error: errorMessage }, 500);
    }
  }
};
