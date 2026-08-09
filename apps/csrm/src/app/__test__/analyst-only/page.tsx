import { notFound } from "next/navigation";

import { AccessDeniedState } from "@/components/states/access-denied-state";
import { resolveRouteAccess } from "@/domain/route-access";
import type { IdentitySnapshot } from "@/domain/identity";
import {
  isFixtureRuntime,
  resolveDevelopmentIdentity,
} from "@/lib/fixtures/resolve-identity";

const analystOnlyCapability = "function.administration.controls" as const;

/**
 * Explicit test-only access evidence. This has no registry entry, data request,
 * or production route surface; it proves that local guards run before work.
 */
export async function resolveAnalystOnlyEvidence(
  identity: IdentitySnapshot | null,
  beforeProtectedLoad?: () => void | Promise<void>,
): Promise<"allowed" | "forbidden"> {
  const shellAccess = await resolveRouteAccess(
    "/",
    identity?.capabilities ?? [],
  );

  if (
    shellAccess.kind !== "allowed" ||
    !identity?.capabilities.includes(analystOnlyCapability)
  ) {
    return "forbidden";
  }

  await beforeProtectedLoad?.();
  return "allowed";
}

export default async function AnalystOnlyEvidencePage() {
  if (!isFixtureRuntime()) {
    notFound();
  }

  const identity = resolveDevelopmentIdentity() ?? null;
  const access = await resolveAnalystOnlyEvidence(identity);

  if (access === "forbidden") {
    return <AccessDeniedState />;
  }

  return (
    <section aria-label="Authorization evidence" className="max-w-2xl">
      <h1 className="text-display font-semibold text-foreground">
        Authorization evidence
      </h1>
      <p className="mt-md text-body text-muted-foreground">
        This non-production route confirms that the required capability passed
        server preflight.
      </p>
    </section>
  );
}
