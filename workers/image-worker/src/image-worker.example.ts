import { routeImageWorkerRequest } from './router';
import type { APIResponse, Env } from './types';

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      return await routeImageWorkerRequest(request, env, createJsonResponse, corsHeaders);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createJsonResponse({ error: errorMessage }, 500);
    }
  }
};