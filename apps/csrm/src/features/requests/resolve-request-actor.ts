import "server-only";

import { cookies } from "next/headers";

import {
  developmentFixtureCookieName,
  resolveDevelopmentIdentity,
} from "@/lib/fixtures/resolve-identity";

export type TrustedRequestActor = {
  email: string;
};

/**
 * Resolves the development/test actor from the HTTP-only server cookie. The
 * production replacement deliberately supplies no fixture identity; Phase 13
 * can provide the same narrow interface from OIDC without changing actions.
 */
export async function resolveCurrentActor(): Promise<TrustedRequestActor | undefined> {
  const cookieStore = await cookies();
  const identity = resolveDevelopmentIdentity({
    cookieValue: cookieStore.get(developmentFixtureCookieName)?.value,
  });

  return identity ? { email: identity.email } : undefined;
}
