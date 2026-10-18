import { isKeycloakProvisioningEnabled } from "./config";
import { developmentIdentityEnabled } from "../utils/development-identity-enabled";

/*
 * The fixed Keycloak user ids that docker/keycloak/import/idambox-realm.json gives
 * the two local fixture people, so a local Keycloak sign-in resolves to the
 * seeded IdamBox User through externalSubject (docs/adr/0004). The two files
 * must change together.
 *
 * Only the local development seed writes them, and never while provisioning is
 * on: provisioning owns externalSubject then, and writes back the id Keycloak
 * actually assigned (ADR 0002).
 */
export const DEVELOPMENT_FIXTURE_SUBJECTS = Object.freeze({
  "jane.doe@idambox.com": "5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e01",
  "bob.doe@idambox.com": "5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e02",
} as const);

export function developmentFixtureSubject(email: keyof typeof DEVELOPMENT_FIXTURE_SUBJECTS): { externalSubject?: string } {
  if (!developmentIdentityEnabled() || isKeycloakProvisioningEnabled()) return {};
  return { externalSubject: DEVELOPMENT_FIXTURE_SUBJECTS[email] };
}
