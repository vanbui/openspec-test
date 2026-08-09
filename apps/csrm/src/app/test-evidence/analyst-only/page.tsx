import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { AccessDeniedState } from "@/components/states/access-denied-state";
import { resolveRouteAccess } from "@/domain/route-access";
import type { IdentitySnapshot } from "@/domain/identity";
import {
  isFixtureRuntime,
  developmentFixtureCookieName,
  resolveDevelopmentIdentity,
} from "@/lib/fixtures/resolve-identity";

const analystOnlyCapability = "function.administration.controls" as const;

/**
 * Explicit test-only access evidence. This has no registry entry, data request,
 * or production capability surface; it proves local guards run before work.
 */
async function resolveAnalystOnlyEvidence(
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

function AnalystOnlyEvidenceContent() {
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

export default async function AnalystOnlyEvidencePage() {
  if (!isFixtureRuntime()) {
    notFound();
  }

  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get(developmentFixtureCookieName)?.value;
  } catch {
    // Unit tests exercise the page function directly, outside Next's request
    // storage. In a real request this dynamic API is always available.
  }
  const identity = resolveDevelopmentIdentity({
    cookieValue,
  }) ?? null;
  const access = await resolveAnalystOnlyEvidence(identity);

  if (access === "forbidden") {
    return <AccessDeniedState />;
  }

  return <AnalystOnlyEvidenceContent />;
}
