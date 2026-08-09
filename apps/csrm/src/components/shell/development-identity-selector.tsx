"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

import type { FixtureKey } from "@/domain/identity";
import { DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { selectDevelopmentIdentity } from "@/lib/fixtures/select-development-identity";

type DevelopmentIdentityOption = {
  fixtureKey: FixtureKey;
  displayName: string;
};

/** Small client island that submits a server-validated development fixture key. */
export function DevelopmentIdentitySelector({
  identities,
}: {
  identities: readonly DevelopmentIdentityOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const changeIdentity = (identity: DevelopmentIdentityOption) => {
    startTransition(async () => {
      await selectDevelopmentIdentity(identity.fixtureKey);
      router.refresh();
      if (pathname !== "/") {
        router.replace("/");
      }
      const title = document.querySelector("h1");
      if (title instanceof HTMLElement) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
      window.dispatchEvent(
        new CustomEvent("csrm:identity-changed", {
          detail: { displayName: identity.displayName },
        }),
      );
    });
  };

  return (
    <>
      <DropdownMenuLabel>Development identity</DropdownMenuLabel>
      {identities.map((identity) => (
        <DropdownMenuItem
          key={identity.fixtureKey}
          onSelect={() => changeIdentity(identity)}
        >
          {identity.displayName}
        </DropdownMenuItem>
      ))}
    </>
  );
}
