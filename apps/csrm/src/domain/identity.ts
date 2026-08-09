import type { CapabilityId } from "@/config/capabilities";

export const fixtureKeys = ["requestor", "analyst"] as const;

export type FixtureKey = (typeof fixtureKeys)[number];

/** Serializable identity context for the shell; never a backend authorization grant. */
export interface IdentitySnapshot {
  fixtureKey: FixtureKey;
  subject: string;
  displayName: string;
  email: string;
  capabilities: readonly CapabilityId[];
}
