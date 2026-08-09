import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { AccessDeniedState } from "@/components/states/access-denied-state";
import type { IdentitySnapshot } from "@/domain/identity";
import { resolveRouteAccess } from "@/domain/route-access";
import {
  developmentFixtureCookieName,
  isFixtureRuntime,
  resolveDevelopmentIdentity,
} from "@/lib/fixtures/resolve-identity";

const analystOnlyCapability = "function.administration.controls" as const;

async function resolveAnalystOnlyEvidence(
  identity: IdentitySnapshot | null,
  beforeProtectedLoad?: () => void | Promise<void>,
): Promise<"allowed" | "forbidden"> {
  const shellAccess = await resolveRouteAccess("/", identity?.capabilities ?? []);

  if (
    shellAccess.kind !== "allowed" ||
    !identity?.capabilities.includes(analystOnlyCapability)
  ) {
    return "forbidden";
  }

  await beforeProtectedLoad?.();
  return "allowed";
}

export async function AnalystOnlyEvidence() {
  if (!isFixtureRuntime()) {
    notFound();
  }

  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get(developmentFixtureCookieName)?.value;
  } catch {
    // Unit tests exercise this composition outside Next's request storage.
  }
  const identity = resolveDevelopmentIdentity({ cookieValue }) ?? null;
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
