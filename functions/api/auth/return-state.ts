interface AuthReturnStateContext {
  request: Request;
  env: Env;
}

interface SignRequestBody {
  mode?: 'sign';
  returnUrl?: string;
  ttlSeconds?: number;
}

interface VerifyRequestBody {
  mode?: 'verify';
  returnUrl?: string;
  expiresAt?: number;
  signature?: string;
}

const MAX_TTL_SECONDS = 900;
const MIN_TTL_SECONDS = 60;

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}

function jsonResponse(payload: Record<string, unknown>, status: number = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function normalizeBaseUrl(value: string | undefined): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return value.trim().replace(/\/$/, '');
}

function trimDomainToOrigin(domain: string): string {
  const trimmed = domain.trim().toLowerCase().replace(/\.$/, '');
  const labels = trimmed.split('.').filter(Boolean);
  if (labels.length <= 2) {
    return trimmed;
  }

  const secondLevelSuffixes = new Set([
    'co.uk',
    'org.uk',
    'gov.uk',
    'ac.uk',
    'com.au',
    'net.au',
    'org.au',
    'edu.au',
    'co.nz',
    'com.br',
    'com.mx',
    'co.jp',
    'co.kr',
    'com.sg',
    'com.tr',
    'com.ar',
    'com.cn',
    'com.hk',
    'com.tw',
  ]);

  const suffix2 = labels.slice(-2).join('.');
  const keepCount = secondLevelSuffixes.has(suffix2) ? 3 : 2;
  return labels.slice(-keepCount).join('.');
}

function getAllowedRootHostname(env: Env): string | null {
  const authActionDomainRaw = (env as unknown as Record<string, unknown>).AUTH_ACTION_DOMAIN;
  const authActionDomain = normalizeBaseUrl(
    typeof authActionDomainRaw === 'string' ? authActionDomainRaw : undefined
  );
  if (!authActionDomain) {
    return null;
  }

  return trimDomainToOrigin(authActionDomain);
}

function getAuthActionStateSecret(env: Env): string {
  const envMap = env as unknown as Record<string, unknown>;
  const dedicated = typeof envMap.AUTH_ACTION_STATE_SECRET === 'string'
    ? envMap.AUTH_ACTION_STATE_SECRET.trim()
    : '';
  return dedicated;
}

function isAllowedReturnUrl(returnUrl: string, allowedRootHostname: string): boolean {
  try {
    const parsed = new URL(returnUrl);
    if (parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    return hostname === allowedRootHostname || hostname.endsWith(`.${allowedRootHostname}`);
  } catch {
    return false;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256'
    },
    false,
    ['sign', 'verify']
  );
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const signingKey = await importHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign('HMAC', signingKey, encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signatureBuffer));
}

async function verifyPayloadSignature(secret: string, payload: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const signingKey = await importHmacKey(secret);
  const signatureBytes = base64UrlDecode(signature);

  return crypto.subtle.verify('HMAC', signingKey, signatureBytes as BufferSource, encoder.encode(payload));
}

function clampTtlSeconds(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return MAX_TTL_SECONDS;
  }

  const rounded = Math.floor(input);
  if (rounded < MIN_TTL_SECONDS) {
    return MIN_TTL_SECONDS;
  }

  if (rounded > MAX_TTL_SECONDS) {
    return MAX_TTL_SECONDS;
  }

  return rounded;
}

function isFreshExpiry(expiresAt: number): boolean {
  const now = Date.now();
  return Number.isFinite(expiresAt) && expiresAt > now && expiresAt <= now + MAX_TTL_SECONDS * 1000;
}

export const onRequest = async ({ request, env }: AuthReturnStateContext): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Allow': 'POST, OPTIONS',
        'Cache-Control': 'no-store'
      }
    });
  }

  if (request.method !== 'POST') {
    return textResponse('Method not allowed', 405);
  }

  const signingSecret = getAuthActionStateSecret(env);
  if (signingSecret.length === 0) {
    return textResponse('Auth return state secret is not configured', 502);
  }

  const allowedRootHostname = getAllowedRootHostname(env);
  if (!allowedRootHostname) {
    return textResponse('Auth action URL is not configured', 502);
  }

  let payload: SignRequestBody | VerifyRequestBody;
  try {
    payload = await request.json() as SignRequestBody | VerifyRequestBody;
  } catch {
    return textResponse('Invalid request body', 400);
  }

  if (!payload || typeof payload !== 'object' || typeof payload.mode !== 'string') {
    return textResponse('Missing mode', 400);
  }

  if (payload.mode === 'sign') {
    const returnUrl = typeof payload.returnUrl === 'string' ? payload.returnUrl : '';
    if (!isAllowedReturnUrl(returnUrl, allowedRootHostname)) {
      return textResponse('Invalid return URL', 400);
    }

    const ttlSeconds = clampTtlSeconds(payload.ttlSeconds);
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const signedPayload = `${returnUrl}|${expiresAt}`;
    const signature = await signPayload(signingSecret, signedPayload);

    return jsonResponse({
      returnUrl,
      expiresAt,
      signature
    });
  }

  if (payload.mode === 'verify') {
    const returnUrl = typeof payload.returnUrl === 'string' ? payload.returnUrl : '';
    const signature = typeof payload.signature === 'string' ? payload.signature : '';
    const expiresAt = typeof payload.expiresAt === 'number' ? payload.expiresAt : Number.NaN;

    if (!isAllowedReturnUrl(returnUrl, allowedRootHostname)) {
      return jsonResponse({ valid: false });
    }

    if (!isFreshExpiry(expiresAt) || signature.length === 0) {
      return jsonResponse({ valid: false });
    }

    const signedPayload = `${returnUrl}|${expiresAt}`;
    const valid = await verifyPayloadSignature(signingSecret, signedPayload, signature).catch(() => false);
    return jsonResponse({ valid });
  }

  return textResponse('Unsupported mode', 400);
};