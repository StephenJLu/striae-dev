import { parsePathSegments } from './config';
import {
  handleImageDelete,
  handleImageServing,
  handleImageUpload,
  handleSignedUrlMinting
} from './handlers';
import type { APIResponse, CreateResponse, Env } from './types';

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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Custom-Auth-Key'
  };

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

const createWorkerResponse = (
  data: APIResponse,
  status: number = 200,
  corsHeaders?: Record<string, string>
): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...(corsHeaders ?? {}),
      'Content-Type': 'application/json'
    }
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const corsHeaders = getCorsHeaders(origin);
    const createResponse: CreateResponse = (data, status) => createWorkerResponse(data, status, corsHeaders);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const requestUrl = new URL(request.url);
      const pathSegments = parsePathSegments(requestUrl.pathname);
      if (!pathSegments) {
        return createResponse({ error: 'Invalid image path encoding' }, 400);
      }

      switch (request.method) {
        case 'POST': {
          if (pathSegments.length === 0) {
            return handleImageUpload(request, env, createResponse);
          }

          if (pathSegments.length === 2 && pathSegments[1] === 'signed-url') {
            return handleSignedUrlMinting(request, env, pathSegments[0], createResponse);
          }

          return createResponse({ error: 'Not found' }, 404);
        }
        case 'GET': {
          const fileId = pathSegments.length === 1 ? pathSegments[0] : null;
          if (!fileId) {
            return createResponse({ error: 'Image ID is required' }, 400);
          }

          return handleImageServing(request, env, fileId, corsHeaders, createResponse);
        }
        case 'DELETE':
          return handleImageDelete(request, env, createResponse);
        default:
          return createResponse({ error: 'Method not allowed' }, 405);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createResponse({ error: errorMessage }, 500);
    }
  }
};