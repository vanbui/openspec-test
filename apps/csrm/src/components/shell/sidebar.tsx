import type { RouteDefinition } from "@/config/routes";
import type { IdentitySnapshot } from "@/domain/identity";
import { navigationGroupLabels, visibleRoutes } from "@/config/routes";

import { NavigationGroup } from "./navigation-group";

export function Sidebar({
  identity,
  routes,
  activeHref = "/",
}: {
  identity: IdentitySnapshot | null;
  routes: readonly RouteDefinition[];
  activeHref?: string;
}) {
  const enabledRoutes = identity
    ? visibleRoutes(identity.capabilities).filter((route) => routes.includes(route))
    : [];
  const groups = Object.entries(navigationGroupLabels).flatMap(([id, label]) => {
    const groupRoutes = enabledRoutes.filter((route) => route.group === id);

    return groupRoutes.length > 0
      ? [{ id, label, routes: groupRoutes }]
      : [];
  });

  if (groups.length === 0) {
    return null;
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[272px] border-r border-border-subtle bg-surface-muted lg:block">
      <div className="flex h-16 items-center border-b border-border-subtle px-lg">
        <p className="truncate text-label font-semibold text-foreground">IdamBox</p>
        <span aria-hidden="true" className="mx-sm h-4 border-l border-border-subtle" />
        <p className="truncate text-label font-semibold text-muted-foreground">
          Cyber Risk Manager
        </p>
      </div>
      <nav aria-label="CSRM navigation" className="space-y-lg px-sm py-lg">
        {groups.map((group) => (
          <NavigationGroup
            activeHref={activeHref}
            id={group.id}
            key={group.id}
            label={group.label}
            routes={group.routes}
          />
        ))}
      </nav>
    </aside>
  );
}
