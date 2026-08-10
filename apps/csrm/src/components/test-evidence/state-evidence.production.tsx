import { notFound } from "next/navigation";

/** Production replacement keeps browser-only state evidence out of emitted bundles. */
export function StateEvidence() {
  notFound();
}
