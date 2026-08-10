import { StateEvidenceHarness } from "@/app/test-evidence/states/state-evidence-harness";
import { notFound } from "next/navigation";
import { isFixtureRuntime } from "@/lib/fixtures/resolve-identity";

export function StateEvidence() {
  if (!isFixtureRuntime()) {
    notFound();
  }

  return (
    <section aria-label="State evidence" className="space-y-2xl">
      <div>
        <h1 className="max-w-reading text-display font-semibold text-foreground">
          State evidence for a deliberately long non-domain browser verification title
        </h1>
        <p className="mt-md max-w-reading text-body text-muted-foreground" title="Long browser evidence identifier">
          Long browser evidence identifier that stays readable without clipping important controls.
        </p>
      </div>
      <StateEvidenceHarness />
    </section>
  );
}
