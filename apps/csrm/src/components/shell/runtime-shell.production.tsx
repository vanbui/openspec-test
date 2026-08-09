import type { ReactNode } from "react";

import { AppHeader } from "./app-header";
import { RouteAnnouncer } from "./route-announcer";
import { Sidebar } from "./sidebar";

const productionRoutes = [
  {
    id: "dashboard",
    href: "/",
    title: "Dashboard",
    group: "dashboard",
    icon: "layout-dashboard",
    capability: "function.dashboard.dashboard",
    status: "enabled",
  },
] as const;

/**
 * Production has no fixture identity or elevated development capability source.
 * Webpack replaces the development runtime shell before server and browser
 * bundles are emitted.
 */
export function RuntimeShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        className="sr-only fixed left-md top-md z-50 bg-surface px-md py-sm text-label font-semibold text-primary focus:not-sr-only focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        href="#main-content"
      >
        Skip to main content
      </a>
      <AppHeader identity={null} routes={productionRoutes} />
      <Sidebar routes={productionRoutes} />
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
