import 'server-only';
import createClient, { type Client } from 'openapi-fetch';
import {
  developmentFixtureIdentityForRole,
  getSessionAdapter,
} from '@/lib/auth/development-session-adapter';
import type { paths } from '../generated/schema';

export type StrapiClient = Client<paths>;
export type TransportError = {
  message: string;
  status?: number;
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
  if (process.env.NODE_ENV !== 'development' || process.env.CSRM_DEV_IDENTITY !== 'true') {
    return undefined;
  }

  const session = await getSessionAdapter().current();
  const identity = session
    ? developmentFixtureIdentityForRole(session.developmentRole)
    : null;

  return identity ? { 'x-csrm-dev-identity': identity } : undefined;
}

function developmentIdentityBridgeEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.CSRM_DEV_IDENTITY === 'true';
}

function apiTokenHeader(required: boolean): Record<string, string> | undefined {
  // Optional Strapi API token (admin panel > Settings > API Tokens). When
  // configured it hardens the outer users-permissions gate; the identity
  // header and the IdamBox authorization policy remain the per-user authority.
  const token = process.env.CSRM_API_TOKEN?.trim();
  if (required && !token) {
    throw new Error(configurationErrorMessage);
  }
  return token ? { authorization: `Bearer ${token}` } : undefined;
}

export async function createStrapiClient(): Promise<StrapiClient> {
  const baseUrl = parseStrapiRestBase(process.env.CSRM_API_BASE_URL);
  const token = apiTokenHeader(developmentIdentityBridgeEnabled());
  const identity = await developmentIdentityHeader();
  const headers = identity || token ? { ...token, ...identity } : undefined;

  return createClient<paths>({ baseUrl, ...(headers ? { headers } : {}) });
}

export function normalizeTransportError(error: unknown, status?: number): TransportResult<never> {
  return { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', ...(status ? { status } : {}) } };
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
