import type { Env } from './types';

export function hasValidToken(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = `Bearer ${env.IMAGES_API_TOKEN}`;
  return authHeader === expectedToken;
}