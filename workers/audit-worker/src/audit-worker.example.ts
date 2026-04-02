import { hasValidHeader } from './config';
import { handleAuditRequest } from './handlers/audit-routes';
import type { CreateResponse, Env } from './types';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': 'PAGES_CUSTOM_DOMAIN',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

      if (!pathname.startsWith('/audit/')) {
        return createWorkerResponse({ error: 'This worker only handles audit endpoints. Use /audit/ path.' }, 404);
      }

      return await handleAuditRequest(request, env, url, createWorkerResponse);

    } catch (error) {
      console.error('Audit Worker error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createWorkerResponse({ error: errorMessage }, 500);
    }
  }
};
