import type { Env } from './types';

// ListsStore must be exported from the worker entry point so Wrangler can
// register it as a Durable Object class.
export { ListsStore } from './lists-do';

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
};

/** Routes map URL path segment to the DO/KV key for each list. */
const ROUTE_TO_KEY: Record<string, string> = {
  members: 'allow',
  primershear: 'primershear',
};

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

/**
 * Constant-time string comparison to mitigate timing side-channels on auth checks.
 * Both strings are encoded to bytes and compared with a full XOR pass.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function isAuthorized(request: Request, secret: string): boolean {
  if (!secret) return false;
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  return timingSafeEqual(auth.slice(7), secret);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const segment = url.pathname.replace(/^\/+|\/+$/g, '');
    const listKey = ROUTE_TO_KEY[segment];

    if (!listKey) {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    if (!isAuthorized(request, env.LISTS_ADMIN_SECRET)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Route all reads and writes through the Durable Object. A single global
    // DO instance per list key serialises operations and eliminates the
    // read-modify-write race that would exist with direct KV access.
    const id = env.LISTS_STORE.idFromName(listKey);
    const stub = env.LISTS_STORE.get(id);

    const doUrl = new URL(request.url);
    doUrl.pathname = '/';
    doUrl.search = '';
    doUrl.searchParams.set('key', listKey);

    const doRequest = new Request(doUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' ? request.body : null,
    });

    return stub.fetch(doRequest);
  },
};
