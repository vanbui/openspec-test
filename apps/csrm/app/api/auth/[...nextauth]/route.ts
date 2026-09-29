import type { NextRequest } from 'next/server';
import { handleOidcAuthRequest } from '@/lib/auth/oidc-session-adapter';

/*
 * The only /api route in this app (proxy.ts): Auth.js's callback endpoint, which
 * serves the registered callback http://localhost:3000/api/auth/callback/keycloak.
 * `handleOidcAuthRequest` answers 404 outside OIDC mode without loading Auth.js.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  return handleOidcAuthRequest(request, 'GET');
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleOidcAuthRequest(request, 'POST');
}
