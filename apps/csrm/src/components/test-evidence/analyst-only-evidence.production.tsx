import { notFound } from "next/navigation";

/** Production replacement prevents test fixtures and analyst grants from emitting. */
export function AnalystOnlyEvidence() {
  notFound();
}
