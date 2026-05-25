export type KeycloakProvisioningConfig = {
  enabled: boolean;
  baseUrl: string;
  realm: string;
  adminClientId: string;
  adminClientSecret: string;
};

const REQUIRED_ENV_KEYS = [
  'KEYCLOAK_BASE_URL',
  'KEYCLOAK_REALM',
  'KEYCLOAK_ADMIN_CLIENT_ID',
  'KEYCLOAK_ADMIN_CLIENT_SECRET',
] as const;

function requireEnvValue(key: (typeof REQUIRED_ENV_KEYS)[number]) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Keycloak provisioning is enabled but ${key} is not configured.`);
  }

  return value;
}

export function getKeycloakProvisioningConfig(): KeycloakProvisioningConfig {
  const enabled = process.env.IDAMBOX_KEYCLOAK_PROVISIONING === 'true';

  if (!enabled) {
    return {
      enabled,
      baseUrl: '',
      realm: '',
      adminClientId: '',
      adminClientSecret: '',
    };
  }

  return {
    enabled,
    baseUrl: requireEnvValue('KEYCLOAK_BASE_URL').replace(/\/+$/, ''),
    realm: requireEnvValue('KEYCLOAK_REALM'),
    adminClientId: requireEnvValue('KEYCLOAK_ADMIN_CLIENT_ID'),
    adminClientSecret: requireEnvValue('KEYCLOAK_ADMIN_CLIENT_SECRET'),
  };
}

