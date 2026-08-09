"use client";

import Link from "next/link";
import {
  ChartNoAxesCombined,
  ClipboardList,
  FileQuestion,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import type { RouteDefinition } from "@/config/routes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const routeIcons = {
  "layout-dashboard": LayoutDashboard,
  "clipboard-list": ClipboardList,
  "file-question": FileQuestion,
  "shield-check": ShieldCheck,
  "triangle-alert": TriangleAlert,
  settings: Settings,
  "chart-no-axes-combined": ChartNoAxesCombined,
} as const;

export function NavigationGroup({
  id,
  label,
  routes,
  activeHref,
  collapsed = false,
  onRouteSelect,
}: {
  id: string;
  label: string;
  routes: readonly RouteDefinition[];
  activeHref: string;
  collapsed?: boolean;
  onRouteSelect?: () => void;
}) {
  const [open, setOpen] = useState(() =>
    routes.some((route) => route.href === activeHref),
  );

  if (routes.length === 0) {
    return null;
  }

  const headingId = `navigation-group-${id}`;

  return (
    <section aria-labelledby={headingId} className="space-y-sm">
      <button
        aria-controls={`${headingId}-routes`}
        aria-expanded={open}
        className={cn(
          "flex min-h-10 w-full items-center rounded-[var(--radius-card)] px-md text-left text-label font-semibold text-muted-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
          collapsed && "justify-center px-0",
        )}
        id={headingId}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
        <span aria-hidden="true" className={cn("ml-auto", collapsed && "ml-0")}>⌄</span>
      </button>
      <ul
        className={cn("space-y-xs", !open && "hidden")}
        id={`${headingId}-routes`}
        role="list"
      >
        {routes.map((route) => {
          const isActive = route.href === activeHref;
          const Icon = routeIcons[route.icon];
          const link = (
            <Link
              aria-current={isActive ? "page" : undefined}
              aria-label={collapsed ? route.title : undefined}
              className={cn(
                "flex h-11 min-w-0 items-center border-l-[3px] border-transparent px-md text-label font-semibold text-foreground transition-colors hover:bg-surface md:h-10",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                collapsed && "justify-center px-0",
                isActive && "border-l-accent bg-primary-soft",
              )}
              href={route.href}
              onClick={onRouteSelect}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className={cn("ml-sm truncate", collapsed && "sr-only")} title={route.title}>
                {route.title}
              </span>
            </Link>
          );

          return (
            <li key={route.id}>
              {collapsed ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent>{route.title}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : link}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
