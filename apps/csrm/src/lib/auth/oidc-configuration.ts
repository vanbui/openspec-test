import 'server-only';

/*
 * Flag-gated Keycloak OIDC configuration (ADR 0003, D-02, D-04). Every export here is
 * strict: an invalid flag or an incomplete/malformed AUTH_* value throws, naming the
 * variable and never its value, so a misconfigured deployment fails at startup rather
 * than falling back to a silently broken sign-in.
 */

const FLAG_NAME = 'CSRM_AUTH_OIDC_ENABLED';

/**
 * Unset, empty or `'false'` means the OIDC path is off (the default). `'true'` turns it
 * on. Anything else is a typo or an unsupported value, and the message never echoes it.
 */
export function parseOidcEnabledFlag(value: string | undefined): boolean {
  if (value === undefined || value === '') return false;
  if (value === 'false') return false;
  if (value === 'true') return true;
  throw new Error(`${FLAG_NAME} must be unset, "false" or "true".`);
}

export interface OidcConfiguration {
  authUrl: string;
  authSecret: string;
  clientId: string;
  clientSecret: string;
  issuer: string;
}

const requiredVariableNames = [
  'AUTH_URL',
  'AUTH_SECRET',
  'AUTH_KEYCLOAK_ID',
  'AUTH_KEYCLOAK_SECRET',
  'AUTH_KEYCLOAK_ISSUER',
] as const;

type RequiredVariableName = (typeof requiredVariableNames)[number];

const MINIMUM_SECRET_LENGTH = 32;

/** An absolute http(s) URL with no username, password, query or fragment, or null. */
function parseStrictUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password || url.search || url.hash) return null;

  return url;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

/**
 * Reads exactly the five `AUTH_*` names idp/README.md documents, in this order, and
 * validates them. Missing or blank values are collected and reported together; a
 * malformed URL or a short secret is reported on its own. No message ever includes a
 * provided value, only the name of the variable that is wrong.
 */
export function readOidcConfiguration(env: NodeJS.ProcessEnv): OidcConfiguration {
  const raw: Record<RequiredVariableName, string | undefined> = {
    AUTH_URL: env.AUTH_URL,
    AUTH_SECRET: env.AUTH_SECRET,
    AUTH_KEYCLOAK_ID: env.AUTH_KEYCLOAK_ID,
    AUTH_KEYCLOAK_SECRET: env.AUTH_KEYCLOAK_SECRET,
    AUTH_KEYCLOAK_ISSUER: env.AUTH_KEYCLOAK_ISSUER,
  };

  const trimmed: Partial<Record<RequiredVariableName, string>> = {};
  const missing: RequiredVariableName[] = [];

  for (const name of requiredVariableNames) {
    const value = raw[name]?.trim();
    if (!value) {
      missing.push(name);
    } else {
      trimmed[name] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(`${FLAG_NAME}=true requires ${missing.join(', ')}.`);
  }

  const authUrl = parseStrictUrl(trimmed.AUTH_URL!);
  if (!authUrl) {
    throw new Error('AUTH_URL must be an absolute http(s) URL with no credentials, query or fragment.');
  }

  const issuer = parseStrictUrl(trimmed.AUTH_KEYCLOAK_ISSUER!);
  if (!issuer) {
    throw new Error('AUTH_KEYCLOAK_ISSUER must be an absolute http(s) URL with no credentials, query or fragment.');
  }

  if (trimmed.AUTH_SECRET!.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET must be at least ${MINIMUM_SECRET_LENGTH} characters. Generate one with \`openssl rand -base64 32\`.`);
  }

  return {
    authUrl: stripTrailingSlash(authUrl.toString()),
    authSecret: trimmed.AUTH_SECRET!,
    clientId: trimmed.AUTH_KEYCLOAK_ID!,
    clientSecret: trimmed.AUTH_KEYCLOAK_SECRET!,
    issuer: stripTrailingSlash(issuer.toString()),
  };
}
