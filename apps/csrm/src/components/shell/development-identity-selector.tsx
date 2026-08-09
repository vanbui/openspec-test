"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import type { FixtureKey } from "@/domain/identity";
import { DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { selectDevelopmentIdentity } from "@/lib/fixtures/select-development-identity";

type DevelopmentIdentityOption = {
  fixtureKey: FixtureKey;
  displayName: string;
};

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
  const focusPending = useRef(false);

  useEffect(() => {
    if (!focusPending.current || pathname !== "/") {
      return;
    }

    focusPending.current = false;
    const frame = window.requestAnimationFrame(() => {
      const title = document.querySelector("h1");
      if (title instanceof HTMLElement) {
        title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeFixtureKey, pathname]);

  const changeIdentity = (identity: DevelopmentIdentityOption) => {
    if (identity.fixtureKey === activeFixtureKey) {
      return;
    }

    startTransition(async () => {
      await selectDevelopmentIdentity(identity.fixtureKey);
      focusPending.current = true;
      if (pathname !== "/") {
        router.replace("/");
      } else {
        router.refresh();
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
