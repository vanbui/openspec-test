/*
 * Strapi -> Keycloak IdamBox User provisioning is off unless
 * IDAMBOX_KEYCLOAK_PROVISIONING=true (docs/adr/0002). While off, nothing but the
 * flag is read, so Strapi runs with no Keycloak and no KEYCLOAK_* variables.
 * While on, every value is required and a gap stops the boot. Error messages
 * name the variable only and never echo a value, so the client secret, or a
 * base URL carrying credentials, cannot reach a log.
 */
export type KeycloakProvisioningConfig = {
  baseUrl: string;
  realm: string;
  adminClientId: string;
  adminClientSecret: string;
  requestTimeoutMs: number;
};

export class KeycloakProvisioningConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeycloakProvisioningConfigurationError";
  }
}

export const PROVISIONING_FLAG = "IDAMBOX_KEYCLOAK_PROVISIONING";
export const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

type Environment = Record<string, string | undefined>;

/*
 * Only "true" and "false" (or unset/empty) are accepted. A typo such as "yes"
 * or "1" stops the boot instead of silently leaving production unprovisioned.
 */
export function isKeycloakProvisioningEnabled(env: Environment = process.env): boolean {
  const value = (env[PROVISIONING_FLAG] ?? "").trim().toLowerCase();
  if (value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new KeycloakProvisioningConfigurationError(`${PROVISIONING_FLAG} must be "true" or "false".`);
}

function requireValue(env: Environment, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new KeycloakProvisioningConfigurationError(`${PROVISIONING_FLAG} is true but ${key} is not configured.`);
  }
  return value;
}

function parseBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new KeycloakProvisioningConfigurationError("KEYCLOAK_BASE_URL must be an absolute http(s) URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new KeycloakProvisioningConfigurationError("KEYCLOAK_BASE_URL must be an absolute http(s) URL.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new KeycloakProvisioningConfigurationError(
      "KEYCLOAK_BASE_URL must not contain credentials, a query string or a fragment.",
    );
  }
  return url.href.replace(/\/+$/, "");
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_REQUEST_TIMEOUT_MS;
  const timeout = Number(value);
  if (!Number.isInteger(timeout) || timeout <= 0) {
    throw new KeycloakProvisioningConfigurationError("KEYCLOAK_REQUEST_TIMEOUT_MS must be a positive integer.");
  }
  return timeout;
}

/** Returns null when provisioning is disabled; throws when it is enabled but incomplete. */
export function readKeycloakProvisioningConfig(env: Environment = process.env): KeycloakProvisioningConfig | null {
  if (!isKeycloakProvisioningEnabled(env)) return null;

  return {
    baseUrl: parseBaseUrl(requireValue(env, "KEYCLOAK_BASE_URL")),
    realm: requireValue(env, "KEYCLOAK_REALM"),
    adminClientId: requireValue(env, "KEYCLOAK_ADMIN_CLIENT_ID"),
    adminClientSecret: requireValue(env, "KEYCLOAK_ADMIN_CLIENT_SECRET"),
    requestTimeoutMs: parseTimeout(env.KEYCLOAK_REQUEST_TIMEOUT_MS),
  };
}
