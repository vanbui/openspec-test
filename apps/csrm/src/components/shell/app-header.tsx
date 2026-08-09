import type { IdentitySnapshot } from "@/domain/identity";
import type { RouteDefinition } from "@/config/routes";

import { MobileNavigation } from "./mobile-navigation";

export function AppHeader({
  identity,
  routes,
}: {
  identity: IdentitySnapshot | null;
  routes: readonly RouteDefinition[];
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-10 flex h-14 items-center border-b border-border-subtle bg-surface px-md lg:h-16 lg:pl-[var(--csrm-sidebar-width,272px)] lg:pr-xl">
      <div className="flex min-w-0 flex-1 items-center gap-sm lg:hidden">
        <MobileNavigation routes={routes} />
        <p className="truncate text-label font-semibold text-foreground">CSRM</p>
      </div>
      <div aria-label="Account context" className="min-w-0 text-right">
        <p className="truncate text-label font-semibold text-foreground">
          {identity?.displayName ?? "CSRM user"}
        </p>
        {identity ? (
          <p className="truncate text-label text-muted-foreground" title={identity.email}>
            {identity.email}
          </p>
        ) : null}
      </div>
    </header>
  );
}
