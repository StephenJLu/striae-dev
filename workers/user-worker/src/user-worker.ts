import { requireUserKvReadConfig, requireUserKvWriteConfig } from './auth';
import { USER_CASES_SEGMENT } from './config';
import {
  handleAddCases,
  handleAddUser,
  handleDeleteCases,
  handleDeleteUser,
  handleDeleteUserWithProgress,
  handleGetUser
} from './handlers/user-routes';
import type { Env } from './types';

function createTextResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // DELETE can mutate user KV data (for example /:uid/cases), so non-GET methods require write config.
      if (request.method === 'GET') {
        requireUserKvReadConfig(env);
      } else {
        requireUserKvWriteConfig(env);
      }
      
      const url = new URL(request.url);
      const parts = url.pathname.split('/');
      const userUid = parts[1];
      const isCasesEndpoint = parts[2] === USER_CASES_SEGMENT;
      
      if (!userUid) {
        return createTextResponse('Not Found', 404);
      }

      // Handle regular cases endpoint
      if (isCasesEndpoint) {
        switch (request.method) {
          case 'PUT': return handleAddCases(request, env, userUid);
          case 'DELETE': return handleDeleteCases(request, env, userUid);
          default: return createTextResponse('Method not allowed', 405);
        }
      }

      // Handle user operations
      const acceptsEventStream = request.headers.get('Accept')?.includes('text/event-stream') === true;
      const streamProgress = url.searchParams.get('stream') === 'true' || acceptsEventStream;

      switch (request.method) {
        case 'GET': return handleGetUser(env, userUid);
        case 'PUT': return handleAddUser(request, env, userUid);
        case 'DELETE': return streamProgress
          ? handleDeleteUserWithProgress(env, userUid)
          : handleDeleteUser(env, userUid);
        default: return createTextResponse('Method not allowed', 405);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage === 'Unauthorized') {
        return createTextResponse('Forbidden', 403);
      }

      if (errorMessage === 'User KV encryption is not fully configured') {
        return createTextResponse(errorMessage, 500);
      }
      
      return createTextResponse('Internal Server Error', 500);
    }
  }
};