"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import type { RouteDefinition } from "@/config/routes";
import { navigationGroupLabels } from "@/config/routes";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import { NavigationGroup } from "./navigation-group";

export function MobileNavigation({
  routes,
  activeHref = "/",
}: {
  routes: readonly RouteDefinition[];
  activeHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const groups = Object.entries(navigationGroupLabels).flatMap(([id, label]) => {
    const groupRoutes = routes.filter((route) => route.group === id);

    return groupRoutes.length > 0 ? [{ id, label, routes: groupRoutes }] : [];
  });

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          aria-label="Open navigation"
          size="icon"
          variant="ghost"
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent aria-label="CSRM navigation" side="left">
        <SheetTitle>CSRM navigation</SheetTitle>
        <nav aria-label="CSRM navigation" className="min-h-0 flex-1 overflow-y-auto">
          {groups.map((group) => (
            <NavigationGroup
              activeHref={activeHref}
              id={group.id}
              key={group.id}
              label={group.label}
              onRouteSelect={() => setOpen(false)}
              routes={group.routes}
            />
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
