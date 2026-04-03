import { handleImageDelete } from './handlers/delete-image';
import { handleSignedUrlMinting } from './handlers/mint-signed-url';
import { handleImageServing } from './handlers/serve-image';
import { handleImageUpload } from './handlers/upload-image';
import type { CreateImageWorkerResponse, Env } from './types';
import { parsePathSegments } from './utils/path-utils';

export async function routeImageWorkerRequest(
  request: Request,
  env: Env,
  createJsonResponse: CreateImageWorkerResponse,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const pathSegments = parsePathSegments(requestUrl.pathname);
  if (!pathSegments) {
    return createJsonResponse({ error: 'Invalid image path encoding' }, 400);
  }

  switch (request.method) {
    case 'POST': {
      if (pathSegments.length === 0) {
        return handleImageUpload(request, env, createJsonResponse);
      }

      if (pathSegments.length === 2 && pathSegments[1] === 'signed-url') {
        return handleSignedUrlMinting(request, env, pathSegments[0], createJsonResponse);
      }

      return createJsonResponse({ error: 'Not found' }, 404);
    }

    case 'GET': {
      const fileId = pathSegments.length === 1 ? pathSegments[0] : null;
      if (!fileId) {
        return createJsonResponse({ error: 'Image ID is required' }, 400);
      }

      return handleImageServing(request, env, fileId, createJsonResponse, corsHeaders);
    }

    case 'DELETE': {
      if (pathSegments.length !== 1) {
        return createJsonResponse({ error: 'Not found' }, 404);
      }

      return handleImageDelete(request, env, createJsonResponse);
    }

    default:
      return createJsonResponse({ error: 'Method not allowed' }, 405);
  }
}