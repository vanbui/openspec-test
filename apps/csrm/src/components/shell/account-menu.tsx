"use client";

import { CircleUserRound } from "lucide-react";
import { useEffect, useState } from "react";

import type { IdentitySnapshot } from "@/domain/identity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/** Account interaction owns only its open state; identity remains server-derived. */
export function AccountMenu({
  identity,
  children,
}: {
  identity: IdentitySnapshot | null;
  children?: unknown;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("csrm:identity-changed", close);
    return () => window.removeEventListener("csrm:identity-changed", close);
  }, []);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Account menu"
          className="min-h-11 min-w-11 justify-end px-sm text-right md:min-h-10 md:min-w-10"
          size="md"
          variant="ghost"
        >
          <CircleUserRound aria-hidden="true" className="size-5 shrink-0" />
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-label font-semibold text-foreground">
              {identity?.displayName ?? "CSRM user"}
            </span>
            {identity ? (
              <span className="block truncate text-label text-muted-foreground" title={identity.email}>
                {identity.email}
              </span>
            ) : null}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Account menu">
        <DropdownMenuLabel>{identity?.displayName ?? "CSRM user"}</DropdownMenuLabel>
        {children ? <DropdownMenuSeparator /> : null}
        {children as never}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
