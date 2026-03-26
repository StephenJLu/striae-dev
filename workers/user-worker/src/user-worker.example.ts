import { authenticate, requireUserKvReadConfig, requireUserKvWriteConfig } from './auth';
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

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': 'PAGES_CUSTOM_DOMAIN',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Custom-Auth-Key',
  'Content-Type': 'application/json'
};

const DEFAULT_AUDIT_WORKER_BASE_URL = 'AUDIT_WORKER_DOMAIN';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      await authenticate(request, env);

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
        return new Response('Not Found', { status: 404 });
      }

      // Handle regular cases endpoint
      if (isCasesEndpoint) {
        switch (request.method) {
          case 'PUT': return handleAddCases(request, env, userUid, corsHeaders);
          case 'DELETE': return handleDeleteCases(request, env, userUid, corsHeaders);
          default: return new Response('Method not allowed', {
            status: 405,
            headers: corsHeaders
          });
        }
      }

      // Handle user operations
      const acceptsEventStream = request.headers.get('Accept')?.includes('text/event-stream') === true;
      const streamProgress = url.searchParams.get('stream') === 'true' || acceptsEventStream;

      switch (request.method) {
        case 'GET': return handleGetUser(env, userUid, corsHeaders);
        case 'PUT': return handleAddUser(request, env, userUid, corsHeaders);
        case 'DELETE': return streamProgress
          ? handleDeleteUserWithProgress(env, userUid, corsHeaders, DEFAULT_AUDIT_WORKER_BASE_URL)
          : handleDeleteUser(env, userUid, corsHeaders, DEFAULT_AUDIT_WORKER_BASE_URL);
        default: return new Response('Method not allowed', {
          status: 405,
          headers: corsHeaders
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage === 'Unauthorized') {
        return new Response('Forbidden', { 
          status: 403, 
          headers: corsHeaders 
        });
      }

      if (errorMessage === 'User KV encryption is not fully configured') {
        return new Response(errorMessage, {
          status: 500,
          headers: corsHeaders
        });
      }
      
      return new Response('Internal Server Error', { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};