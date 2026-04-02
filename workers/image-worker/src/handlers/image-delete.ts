import { hasValidToken } from '../auth';
import { parseFileId } from '../config';
import type { CreateResponse, Env } from '../types';

export async function handleImageDelete(
  request: Request,
  env: Env,
  createResponse: CreateResponse
): Promise<Response> {
  if (!hasValidToken(request, env)) {
    return createResponse({ error: 'Unauthorized' }, 403);
  }

  const fileId = parseFileId(new URL(request.url).pathname);
  if (!fileId) {
    return createResponse({ error: 'Image ID is required' }, 400);
  }

  const existing = await env.STRIAE_FILES.head(fileId);
  if (!existing) {
    return createResponse({ error: 'File not found' }, 404);
  }

  await env.STRIAE_FILES.delete(fileId);
  return createResponse({ success: true });
}
