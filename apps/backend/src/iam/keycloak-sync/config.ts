import { readKeycloakProvisioningConfig, type KeycloakProvisioningConfig, KeycloakProvisioningConfigurationError } from "../../keycloak/config";

export type KeycloakSyncConfig = { pollMs: number; leaseMs: number; attemptMs: number; client: KeycloakProvisioningConfig };
type Environment = Record<string, string | undefined>;

export function readKeycloakSyncConfig(env: Environment = process.env): KeycloakSyncConfig | null {
  const client = readKeycloakProvisioningConfig(env);
  if (!client) return null;
  const positive = (key: string, fallback: number) => {
    const raw = env[key];
    const value = raw === undefined || raw.trim() === "" ? fallback : Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
      throw new KeycloakProvisioningConfigurationError(`${key} must be a bounded positive integer.`);
    }
    return value;
  };
  const pollMs = positive("IDAMBOX_KEYCLOAK_SYNC_POLL_MS", 5000);
  const leaseMs = positive("IDAMBOX_KEYCLOAK_SYNC_LEASE_MS", 60_000);
  const attemptMs = positive("IDAMBOX_KEYCLOAK_SYNC_ATTEMPT_MS", 30_000);
  if (client.requestTimeoutMs > 5000 || attemptMs > 30_000 || leaseMs <= attemptMs + 1000) {
    throw new KeycloakProvisioningConfigurationError("Keycloak sync requires calls <= 5000 ms, attempts <= 30000 ms and lease headroom > 1000 ms.");
  }
  return { pollMs, leaseMs, attemptMs, client };
}
