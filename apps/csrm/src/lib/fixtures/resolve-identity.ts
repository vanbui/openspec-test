import "server-only";

import { resolveEffectiveCapabilities } from "@/config/capabilities";
import {
  fixtureKeys,
  type FixtureKey,
  type IdentitySnapshot,
} from "@/domain/identity";

import { developmentIdentityFixtures } from "./identities";

export const developmentFixtureCookieName =
  "idambox-csrm-development-identity";

const developmentIdentityCookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  maxAge: 60 * 60 * 8,
  path: "/",
} as const;

type CookieWriter = {
  set(
    name: string,
    value: string,
    options: typeof developmentIdentityCookieOptions,
  ): void;
};

type ResolveIdentityOptions = {
  runtime?: string | undefined;
  cookieValue?: string | undefined;
};

export function isFixtureRuntime(
  runtime: string | undefined = process.env.NODE_ENV,
): boolean {
  return runtime === "development" || runtime === "test";
}

function isFixtureKey(value: unknown): value is FixtureKey {
  return typeof value === "string" && fixtureKeys.includes(value as FixtureKey);
}

function snapshotFor(fixtureKey: FixtureKey): IdentitySnapshot {
  const fixture = developmentIdentityFixtures[fixtureKey];

  return {
    fixtureKey: fixture.fixtureKey,
    subject: fixture.subject,
    displayName: fixture.displayName,
    email: fixture.email,
    capabilities: resolveEffectiveCapabilities(fixture.explicitCapabilities),
  };
}

/**
 * Resolves a trusted server cookie only in development/test. Invalid or absent
 * cookie values safely fall back to the Requestor fixture rather than granting
 * a capability. Phase 13 replaces this seam with OIDC/effective capabilities.
 */
export function resolveDevelopmentIdentity(
  options: ResolveIdentityOptions = {},
): IdentitySnapshot | undefined {
  const runtime = options.runtime ?? process.env.NODE_ENV;
  if (!isFixtureRuntime(runtime)) {
    return undefined;
  }

  return snapshotFor(
    isFixtureKey(options.cookieValue) ? options.cookieValue : "requestor",
  );
}

/** The development selector is absent from production server output. */
export function developmentIdentitySelectorState(
  runtime: string | undefined = process.env.NODE_ENV,
): readonly IdentitySnapshot[] | undefined {
  if (!isFixtureRuntime(runtime)) {
    return undefined;
  }

  return fixtureKeys.map((fixtureKey) => snapshotFor(fixtureKey));
}

/**
 * Validates and persists a fixture choice after the server runtime gate. This
 * is a development aid only, not backend authorization.
 */
export function setDevelopmentIdentity({
  fixtureKey,
  runtime = process.env.NODE_ENV,
  cookieStore,
}: {
  fixtureKey: unknown;
  runtime?: string | undefined;
  cookieStore: CookieWriter;
}): void {
  if (!isFixtureRuntime(runtime)) {
    throw new Error("Development identity selection is unavailable.");
  }

  if (!isFixtureKey(fixtureKey)) {
    throw new Error("Invalid development identity selection.");
  }

  cookieStore.set(
    developmentFixtureCookieName,
    fixtureKey,
    developmentIdentityCookieOptions,
  );
}
