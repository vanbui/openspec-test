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

function focusHomeTitleAfterNavigation(attempt = 0): void {
  const title = document.querySelector("h1");
  if (
    window.location.pathname === "/" &&
    title instanceof HTMLElement &&
    title.textContent === "Cyber Risk Manager"
  ) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
    return;
  }

  if (attempt < 120) {
    window.requestAnimationFrame(() => focusHomeTitleAfterNavigation(attempt + 1));
  }
}

/** Small client island that submits a server-validated development fixture key. */
export function DevelopmentIdentitySelector({
  activeFixtureKey,
  identities,
}: {
  activeFixtureKey: FixtureKey;
  identities: readonly DevelopmentIdentityOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const changeIdentity = (identity: DevelopmentIdentityOption) => {
    if (identity.fixtureKey === activeFixtureKey) {
      return;
    }

    startTransition(async () => {
      await selectDevelopmentIdentity(identity.fixtureKey);
      if (pathname !== "/") {
        router.replace("/");
      } else {
        router.refresh();
      }
      window.requestAnimationFrame(() => focusHomeTitleAfterNavigation());
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
