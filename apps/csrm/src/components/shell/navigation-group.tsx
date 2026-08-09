import Link from "next/link";

import type { RouteDefinition } from "@/config/routes";
import { cn } from "@/lib/utils";

export function NavigationGroup({
  id,
  label,
  routes,
  activeHref,
}: {
  id: string;
  label: string;
  routes: readonly RouteDefinition[];
  activeHref: string;
}) {
  if (routes.length === 0) {
    return null;
  }

  const headingId = `navigation-group-${id}`;

  return (
    <section aria-labelledby={headingId} className="space-y-sm">
      <h2
        className="px-md text-label font-semibold text-muted-foreground"
        id={headingId}
      >
        {label}
      </h2>
      <ul className="space-y-xs" role="list">
        {routes.map((route) => {
          const isActive = route.href === activeHref;

          return (
            <li key={route.id}>
              <Link
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-10 min-w-0 items-center border-l-[3px] border-transparent px-md text-label font-semibold text-foreground transition-colors hover:bg-surface",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                  isActive && "border-l-accent bg-primary-soft",
                )}
                href={route.href}
              >
                <span className="truncate" title={route.title}>
                  {route.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
