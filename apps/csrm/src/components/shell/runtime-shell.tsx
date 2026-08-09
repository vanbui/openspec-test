import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { routeDefinitions } from "@/config/routes";
import {
  developmentFixtureCookieName,
  resolveDevelopmentIdentity,
} from "@/lib/fixtures/resolve-identity";

/** Development/test shell integration. Production replaces this module at build time. */
export async function RuntimeShell({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const identity = resolveDevelopmentIdentity({
    cookieValue: cookieStore.get(developmentFixtureCookieName)?.value,
  });

  return (
    <AppShell identity={identity ?? null} routes={routeDefinitions}>
      {children}
    </AppShell>
  );
}
