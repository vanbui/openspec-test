import type { ReactNode } from "react";

import type { RouteDefinition } from "@/config/routes";
import { visibleRoutes } from "@/config/routes";
import type { IdentitySnapshot } from "@/domain/identity";
import { DevelopmentIdentitySelector } from "@/components/shell/development-identity-selector";
import { developmentIdentityOptions } from "@/lib/fixtures/identities";

import { AppHeader } from "./app-header";
import { RouteAnnouncer } from "./route-announcer";
import { Sidebar } from "./sidebar";

function DevelopmentSelectorForRuntime({ fixtureKey }: { fixtureKey: IdentitySnapshot["fixtureKey"] }) {
  return (
    <DevelopmentIdentitySelector
      activeFixtureKey={fixtureKey}
      identities={developmentIdentityOptions}
    />
  );
}

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
  const navigationRoutes = identity
    ? visibleRoutes(identity.capabilities).filter((route) => routes.includes(route))
    : [];
  const developmentSelector = identity ? (
    <DevelopmentSelectorForRuntime fixtureKey={identity.fixtureKey} />
  ) : null;

  return (
    <>
      <a
        className="sr-only fixed left-md top-md z-50 bg-surface px-md py-sm text-label font-semibold text-primary focus:not-sr-only focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        href="#main-content"
      >
        Skip to main content
      </a>
      <AppHeader
        identity={identity}
        routes={navigationRoutes}
        developmentSelector={developmentSelector}
      />
      <Sidebar routes={navigationRoutes} />
      <main
        className="min-h-screen min-w-0 bg-background pt-14 lg:pl-[var(--csrm-sidebar-width,272px)] lg:pt-16"
        id="main-content"
      >
        <div className="mx-auto max-w-canvas px-md py-xl sm:px-lg lg:px-xl lg:py-3xl">
          {children}
        </div>
      </main>
      <RouteAnnouncer />
    </>
  );
}
