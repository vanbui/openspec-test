import type { ReactNode } from "react";

import type { RouteDefinition } from "@/config/routes";
import type { IdentitySnapshot } from "@/domain/identity";

import { AppHeader } from "./app-header";
import { Sidebar } from "./sidebar";

/**
 * Server-compatible frame for CSRM. It receives only serializable identity and
 * registry data; interactive navigation controls remain explicit future islands.
 */
export function AppShell({
  identity,
  routes,
  children,
}: {
  identity: IdentitySnapshot | null;
  routes: readonly RouteDefinition[];
  children: ReactNode;
}) {
  return (
    <>
      <a
        className="sr-only fixed left-md top-md z-50 bg-surface px-md py-sm text-label font-semibold text-primary focus:not-sr-only focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        href="#main-content"
      >
        Skip to main content
      </a>
      <AppHeader identity={identity} />
      <Sidebar identity={identity} routes={routes} />
      <main
        className="min-h-screen min-w-0 bg-background pt-16 lg:pl-[272px] lg:pt-16"
        id="main-content"
      >
        <div className="mx-auto max-w-canvas px-md py-xl sm:px-lg lg:px-xl lg:py-3xl">
          {children}
        </div>
      </main>
    </>
  );
}
