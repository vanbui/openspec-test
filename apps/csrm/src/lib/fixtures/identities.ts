import "server-only";

import { securityAnalystCapabilityIds } from "@/config/capabilities";
import type { FixtureKey } from "@/domain/identity";

export interface DevelopmentIdentityFixture {
  fixtureKey: FixtureKey;
  subject: string;
  displayName: string;
  email: string;
  explicitCapabilities: readonly (typeof securityAnalystCapabilityIds)[number][];
}

/**
 * Deterministic development/test identity sources. Effective capabilities are
 * derived by the server resolver, so callers cannot submit role or capability
 * values to elevate an identity.
 */
export const developmentIdentityFixtures: Readonly<
  Record<FixtureKey, DevelopmentIdentityFixture>
> = {
  requestor: {
    fixtureKey: "requestor",
    subject: "fixture:jane.doe@idambox.com",
    displayName: "Requestor — Jane",
    email: "jane.doe@idambox.com",
    explicitCapabilities: [],
  },
  analyst: {
    fixtureKey: "analyst",
    subject: "fixture:bob.doe@idambox.com",
    displayName: "Security Analyst — Bob",
    email: "bob.doe@idambox.com",
    explicitCapabilities: securityAnalystCapabilityIds,
  },
};
