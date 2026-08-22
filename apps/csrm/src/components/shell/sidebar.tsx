"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";

import type { RouteDefinition } from "@/config/routes";
import { navigationGroupLabels } from "@/config/routes";
import { Button } from "@/components/ui/button";

import { NavigationGroup } from "./navigation-group";

const sidebarStorageKey = "idambox-csrm-sidebar-collapsed";

/** Presentation-only desktop navigation. Capability filtering stays in AppShell. */
export function Sidebar({
  routes,
  activeHref = "/",
}: {
  routes: readonly RouteDefinition[];
  activeHref?: string;
}) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(sidebarStorageKey) === "true";
  });
  const groups = Object.entries(navigationGroupLabels).flatMap(([id, label]) => {
    const groupRoutes = routes.filter((route) => route.group === id);

    return groupRoutes.length > 0 ? [{ id, label, routes: groupRoutes }] : [];
  });

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--csrm-sidebar-width",
      collapsed ? "64px" : "272px",
    );
    window.localStorage.setItem(sidebarStorageKey, String(collapsed));
  }, [collapsed]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-20 hidden border-r border-border-subtle bg-surface-muted transition-[width] duration-[var(--duration-drawer)] motion-reduce:transition-none lg:block ${collapsed ? "lg:w-16" : "lg:w-[272px]"}`}
    >
      <div className="flex h-16 items-center border-b border-border-subtle px-sm">
        {collapsed ? (
          <p className="sr-only">IdamBox Cyber Risk Manager</p>
        ) : (
          <>
            <p className="truncate text-label font-semibold text-foreground">IdamBox</p>
            <span aria-hidden="true" className="mx-sm h-4 border-l border-border-subtle" />
            <p className="truncate text-label font-semibold text-muted-foreground">
              Cyber Risk Manager
            </p>
          </>
        )}
        <Button
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-pressed={!collapsed}
          className="ml-auto shrink-0"
          onClick={() => setCollapsed((current) => !current)}
          size="icon"
          variant="ghost"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
      <nav aria-label="CSRM navigation" className="h-[calc(100%-4rem)] overflow-y-auto space-y-lg px-sm py-lg">
        {groups.map((group) => (
          <NavigationGroup
            activeHref={activeHref}
            collapsed={collapsed}
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
