/*
 * Keycloak access-token verification is off unless
 * IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true (docs/adr/0004). While off, nothing
 * but the flag is read. While on, every value is required and a gap stops the
 * boot. As with provisioning (config.ts), messages name the variable only and
 * never echo a value.
 */
export type KeycloakTokenVerificationConfig = {
  /** The realm issuer exactly as Keycloak writes it into `iss`, without a trailing slash. */
  issuer: string;
  /** The CSRM OIDC client: required in `aud` and equal to `azp`. */
  clientId: string;
  requestTimeoutMs: number;
};

export class KeycloakTokenVerificationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeycloakTokenVerificationConfigurationError";
  }
}

export const TOKEN_VERIFICATION_FLAG = "IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION";
export const DEFAULT_JWKS_TIMEOUT_MS = 5000;

type Environment = Record<string, string | undefined>;

export function isKeycloakTokenVerificationEnabled(env: Environment = process.env): boolean {
  const value = (env[TOKEN_VERIFICATION_FLAG] ?? "").trim().toLowerCase();
  if (value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new KeycloakTokenVerificationConfigurationError(`${TOKEN_VERIFICATION_FLAG} must be "true" or "false".`);
}

function requireValue(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new KeycloakTokenVerificationConfigurationError(`${TOKEN_VERIFICATION_FLAG} is true but ${key} is not configured.`);
  }
  return value;
}

/*
 * A production Strapi only trusts an https issuer: its JWKS is the root of every
 * identity decision, so it must not be fetched over plain HTTP.
 */
function parseIssuer(value: string, env: Environment): string {
  const invalid = "KEYCLOAK_ISSUER must be an absolute http(s) URL with no credentials, query or fragment.";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new KeycloakTokenVerificationConfigurationError(invalid);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new KeycloakTokenVerificationConfigurationError(invalid);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new KeycloakTokenVerificationConfigurationError(invalid);
  }
  if (env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new KeycloakTokenVerificationConfigurationError("KEYCLOAK_ISSUER must use https:// in production.");
  }
  return url.href.replace(/\/+$/, "");
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_JWKS_TIMEOUT_MS;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout <= 0) {
    throw new KeycloakTokenVerificationConfigurationError("KEYCLOAK_REQUEST_TIMEOUT_MS must be a positive integer.");
  }
  return timeout;
}

/** Returns null when verification is disabled; throws when it is enabled but incomplete. */
export function readKeycloakTokenVerificationConfig(
  env: Environment = process.env,
): KeycloakTokenVerificationConfig | null {
  if (!isKeycloakTokenVerificationEnabled(env)) return null;

  return {
    issuer: parseIssuer(requireValue(env, "KEYCLOAK_ISSUER"), env),
    clientId: requireValue(env, "KEYCLOAK_TOKEN_CLIENT_ID"),
    requestTimeoutMs: parseTimeout(env.KEYCLOAK_REQUEST_TIMEOUT_MS),
  };
}
