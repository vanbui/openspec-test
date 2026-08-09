"use client";

import { useState } from "react";

import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { OptionalValue } from "@/components/states/optional-value";

/** Interactive development-only composition for browser verification of shared states. */
export function StateEvidenceHarness() {
  const [retried, setRetried] = useState(false);

  return (
    <div className="space-y-2xl">
      <LoadingState />
      <EmptyState />
      <ErrorState onRetry={() => setRetried(true)} />
      <p aria-live="polite" role="status">{retried ? "Retry requested" : "Retry available"}</p>
      <section aria-label="Populated state" className="min-w-0 overflow-x-auto">
        <h2 className="text-heading font-semibold">Populated state</h2>
        <p className="mt-sm">Optional value: <OptionalValue value={undefined} /></p>
        <ul className="mt-sm space-y-xs" role="list">
          <li>One item</li>
          <li>Second item</li>
        </ul>
      </section>
    </div>
  );
}
