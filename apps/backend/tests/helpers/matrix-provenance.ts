/*
 * The authorization matrix's provenance rule (Phase 8 D-16; review finding SR-02).
 *
 * The matrix issues every denial itself. Some allowed outcomes it does not issue, because a success
 * would spend a fixture another row or test depends on; each of those must cite an existing mounted
 * test, by `<file> › <test title>`, for the actor whose success it proves. A citation counts only
 * when the cited test sends a request as that actor, which it does by naming the actor's harness
 * identity: `identities.serviceAnalystAgent` for the service agent, never the role-less
 * `identities.analystAgent`. The two credential-less callers have no identity to name, so their
 * successes must be issued. The rule lives here, apart from the running harness, so its own test
 * can show it failing.
 */

export type ProvenanceActor = "owner" | "other" | "analyst" | "serviceAgent" | "noIdentity" | "noToken";

/** What a cited test must name to send a request as the actor. */
export const ACTOR_IDENTITY_REFERENCES: Readonly<Record<ProvenanceActor, RegExp | null>> = {
  owner: /\bidentities\.owner\b/,
  other: /\bidentities\.otherRequestor\b/,
  analyst: /\bidentities\.analyst\b/,
  serviceAgent: /\bidentities\.serviceAnalystAgent\b/,
  noIdentity: null,
  noToken: null,
};

export type ProbeProvenance = {
  /** The operation, with the variant label when the probe is a variant. */
  label: string;
  /** The actors whose stated outcome is a success (2xx). */
  allowedActors: readonly ProvenanceActor[];
  /** Whether the probe issues its allowed requests itself. */
  exercisesAllowed: boolean;
  /** Per actor, the mounted tests that prove a success the probe does not issue. */
  provenBy: Readonly<Partial<Record<ProvenanceActor, readonly string[]>>>;
  /** Related mounted tests kept for traceability; each must exist, and none stands in for a success. */
  seeAlso: readonly string[];
};

/** A cited test's body: its top-level `test("<title>"` declaration up to the next top-level test. */
export function citedTestBody(source: string, title: string): string | null {
  const start = source.indexOf(`test("${title}"`);
  if (start < 0) return null;
  const next = source.indexOf("\ntest(", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

/**
 * Every provenance failure: a success neither issued nor cited for its actor; a citation whose test
 * is missing or sends no request as the actor it is cited for; a citation for an actor the probe
 * refuses, or on a probe that issues its allowed requests itself; and a `seeAlso` that names no test.
 */
export function provenanceFailures(
  probes: readonly ProbeProvenance[],
  readCitedTest: (citation: string) => string | null,
): string[] {
  const failures: string[] = [];
  for (const probe of probes) {
    if (!probe.exercisesAllowed) {
      for (const actor of probe.allowedActors) {
        if (!(probe.provenBy[actor]?.length)) failures.push(`MATRIX_ALLOWED_OUTCOME_UNPROVEN_${probe.label}_${actor}`);
      }
    }
    for (const [actor, citations] of Object.entries(probe.provenBy) as Array<[ProvenanceActor, readonly string[]]>) {
      if (probe.exercisesAllowed) failures.push(`MATRIX_PROVEN_BY_ON_AN_ISSUED_PROBE_${probe.label}_${actor}`);
      if (!probe.allowedActors.includes(actor)) failures.push(`MATRIX_PROVEN_BY_FOR_A_REFUSED_ACTOR_${probe.label}_${actor}`);
      const reference = ACTOR_IDENTITY_REFERENCES[actor];
      for (const citation of citations) {
        const body = readCitedTest(citation);
        if (body === null) failures.push(`MATRIX_CITATION_NOT_FOUND_${probe.label}_${actor}: ${citation}`);
        else if (reference === null || !reference.test(body)) failures.push(`MATRIX_CITATION_DOES_NOT_EXERCISE_ACTOR_${probe.label}_${actor}: ${citation}`);
      }
    }
    for (const citation of probe.seeAlso) {
      if (readCitedTest(citation) === null) failures.push(`MATRIX_CITATION_NOT_FOUND_${probe.label}: ${citation}`);
    }
  }
  return failures;
}
