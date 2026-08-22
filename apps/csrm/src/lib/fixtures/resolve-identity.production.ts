import "server-only";

import type { IdentitySnapshot } from "@/domain/identity";

export const developmentFixtureCookieName = "idambox-csrm-identity";

export function isFixtureRuntime(): boolean {
  return false;
}

export function resolveDevelopmentIdentity(): IdentitySnapshot | undefined {
  return undefined;
}

export function developmentIdentitySelectorState(): readonly IdentitySnapshot[] | undefined {
  return undefined;
}

export function setDevelopmentIdentity(options: unknown): never {
  void options;
  throw new Error("Identity selection is unavailable.");
}
