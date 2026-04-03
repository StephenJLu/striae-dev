import { hasValidToken } from '../auth';
import type { CreateImageWorkerResponse, Env } from '../types';
import { parseFileId } from '../utils/path-utils';

export async function handleImageDelete(
  request: Request,
  env: Env,
  createJsonResponse: CreateImageWorkerResponse
): Promise<Response> {
  if (!hasValidToken(request, env)) {
    return createJsonResponse({ error: 'Unauthorized' }, 403);
  }

  const fileId = parseFileId(new URL(request.url).pathname);
  if (!fileId) {
    return createJsonResponse({ error: 'Image ID is required' }, 400);
  }

  const existing = await env.STRIAE_FILES.head(fileId);
  if (!existing) {
    return createJsonResponse({ error: 'File not found' }, 404);
  }

  await env.STRIAE_FILES.delete(fileId);
  return createJsonResponse({ success: true });
}