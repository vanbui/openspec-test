import 'server-only';
import createClient, { type Client } from 'openapi-fetch';
import { resolveSessionRuntimeMode } from '@/lib/auth/development-runtime';
import {
  developmentFixtureIdentityForRole,
  getSessionAdapter,
} from '@/lib/auth/development-session-adapter';
import { isConflictReason, type ConflictReason } from '../conflict-reasons';
import type { paths } from '../generated/schema';

export type StrapiClient = Client<paths>;
export type TransportError = {
  message: string;
  status?: number;
  /** The closed-list rule a 409 named; absent for any other failure or an unknown value. */
  reason?: ConflictReason;
  kind?: 'response-contract-mismatch';
  operation?: string;
};
export type TransportResult<T> = { data: T; error: null } | { data: null; error: TransportError };

const configurationErrorMessage = 'CSRM API configuration is invalid.';

function parseStrapiRestBase(value: string | undefined): string {
  if (!value) {
    throw new Error(configurationErrorMessage);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(configurationErrorMessage);
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(configurationErrorMessage);
  }

  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname !== '/api' && !pathname.endsWith('/api')) {
    throw new Error(configurationErrorMessage);
  }

  return `${url.origin}${pathname}`;
}

async function developmentIdentityHeader(): Promise<Record<string, string> | undefined> {
  if (!developmentIdentityBridgeEnabled()) {
    return undefined;
  }

  const session = await getSessionAdapter().current();
  const identity = session?.developmentRole
    ? developmentFixtureIdentityForRole(session.developmentRole)
    : null;

  return identity ? { 'x-csrm-dev-identity': identity } : undefined;
}

/**
 * The identity bridge exists only where the development session does (next dev,
 * or a production build inside the attested E2E runtime) and only when the
 * operator switched it on. The resolver already demands the flag under a
 * production build; the explicit conjunct keeps next dev silent without it.
 */
function developmentIdentityBridgeEnabled(): boolean {
  return resolveSessionRuntimeMode(process.env) === 'development' && process.env.CSRM_DEV_IDENTITY === 'true';
}

/**
 * In OIDC mode the caller's own Keycloak access token goes to Strapi in its own
 * header, which Strapi verifies against the realm JWKS and maps to an IdamBox User
 * (docs/adr/0004). `Authorization` stays with the API token below. No session, no
 * token: the call carries no identity and Strapi refuses it.
 */
async function oidcIdentityHeader(): Promise<Record<string, string> | undefined> {
  if (!oidcIdentityEnabled()) {
    return undefined;
  }

  const token = await getSessionAdapter().identityToken();
  return token ? { 'x-csrm-identity-token': token } : undefined;
}

function oidcIdentityEnabled(): boolean {
  return resolveSessionRuntimeMode(process.env) === 'oidc';
}

function apiTokenHeader(required: boolean): Record<string, string> | undefined {
  // Optional Strapi API token (admin panel > Settings > API Tokens). When
  // configured it hardens the outer users-permissions gate; the identity
  // header and the IdamBox authorization policy remain the per-user authority.
  // Either identity path requires it, because every CSRM route sits behind it.
  const token = process.env.CSRM_API_TOKEN?.trim();
  if (required && !token) {
    throw new Error(configurationErrorMessage);
  }
  return token ? { authorization: `Bearer ${token}` } : undefined;
}

export async function createStrapiClient(): Promise<StrapiClient> {
  const baseUrl = parseStrapiRestBase(process.env.CSRM_API_BASE_URL);
  const token = apiTokenHeader(developmentIdentityBridgeEnabled() || oidcIdentityEnabled());
  const identity = (await developmentIdentityHeader()) ?? (await oidcIdentityHeader());
  const headers = identity || token ? { ...token, ...identity } : undefined;

  return createClient<paths>({ baseUrl, ...(headers ? { headers } : {}) });
}

/**
 * The error body is untrusted: only a conflict's reason crosses, and only when it is in the closed
 * list (D-22, T-10-14). The served message, name and every other detail stay behind, so the
 * application shows its own copy.
 */
export function normalizeTransportError(error: unknown, status?: number): TransportResult<never> {
  const reason = status === 409 ? servedConflictReason(error) : undefined;
  return {
    data: null,
    error: {
      message: 'The CSRM service is unavailable. Please try again later.',
      ...(status ? { status } : {}),
      ...(reason ? { reason } : {}),
    },
  };
}

function servedConflictReason(body: unknown): ConflictReason | undefined {
  const error = isPlainObject(body) ? body.error : undefined;
  const details = isPlainObject(error) ? error.details : undefined;
  const reason = isPlainObject(details) ? details.reason : undefined;
  return isConflictReason(reason) ? reason : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deliberately exposes only a stable local diagnostic identifier, never parser input or internals. */
export function normalizeResponseParserError(operation: string): TransportResult<never> {
  return {
    data: null,
    error: process.env.NODE_ENV === 'development'
      ? { message: 'The response did not match the expected CSRM contract.', kind: 'response-contract-mismatch', operation }
      : { message: 'The CSRM service is unavailable. Please try again later.' },
  };
}
