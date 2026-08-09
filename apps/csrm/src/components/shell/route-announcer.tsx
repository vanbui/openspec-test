"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Polite, non-visual feedback for route and trusted fixture transitions. */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (pathname !== previousPathname.current) {
      previousPathname.current = pathname;
      setMessage(`Navigated to ${pathname === "/" ? "CSRM home" : pathname}`);
    }
  }, [pathname]);

  useEffect(() => {
    const announceIdentity = (event: Event) => {
      const displayName = (event as CustomEvent<{ displayName?: unknown }>).detail
        ?.displayName;
      if (typeof displayName === "string") {
        setMessage(`${displayName} is now active`);
      }
    };
    window.addEventListener("csrm:identity-changed", announceIdentity);
    return () => window.removeEventListener("csrm:identity-changed", announceIdentity);
  }, []);

  return (
    <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
      {message}
    </p>
  );
}
