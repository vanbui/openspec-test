# Phase 12: AI context, suggestions and provenance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 12-ai-context-suggestions-and-provenance
**Mode:** `--auto`, one pass.
- Every area was selected automatically, and each question took the recommended option with no user prompt.
- The orchestrator seeded where the UAT found the problems, the context builder's contents, the draft and questionnaire behaviours, the provenance and run record needs, the data policy and R-08-42.
- The code read during the scout confirmed or corrected each seed before it was recorded.
- No todo matched the phase (`todo.match-phase 12`: 0), and no `.continue-here.md` or checkpoint existed.
- The discussion completed in one pass, so no `12-DISCUSS-CHECKPOINT.json` remains.

**Areas discussed:**
1. Where the run record and provenance live
2. What the assessment context holds
3. Untrusted data and the instruction slot
4. Size bounds
5. The Risk Type library
6. Scales and ratings
7. Accept proposals
8. Suggested controls
9. Pre-filled system, asset and classification
10. Citations and uncited claims
11. Questionnaire style
12. Question provenance
13. Field acceptance and release readiness
14. What each actor sees
15. The request's data classification
16. The ceiling and environments
17. The policy on the hub
18. Who may start generation, and R-08-42
19. Run reads
20. The decision operation
21. Restarts
22. Records generated before Phase 12
23. The route budget
24. Verification

---

## 1. Where the run record and provenance live (INT-06, G-3)

| Option | Description | Selected |
|--------|-------------|----------|
| A new `CsrmAiRun` entity, plus an `aiProvenance` JSON attribute on `CsrmRisk` and `CsrmAssessment`; questions derived from the governance log | One home for every run across operations and phases. A failed first generation has a home. Phase 21 can query runs. Current per-field state is read with the record, and the run's decisions log keeps the history (the 06.8 fact-plus-log split) | ✓ |
| JSON run logs on the existing aggregates (the request, questionnaire and assessment), like `governanceLog` | Follows 06.8 literally and inherits each aggregate's authorisation. But it needs four schema changes, the request becomes a dumping ground, aggregates grow with every re-run, job completion contends with analyst edits, and cross-request queries mean scanning JSON | |
| A run entity holding all per-field state, with no change to existing types | Only one new type. But every risk edit writes the run, editor and table reads join runs, and Phase 16 and 17 re-runs make current state a merge across runs | |
| One row per proposal item (a proposal entity) | Normalised and queryable, but tens of rows per draft and a join on every risk read | |

**Choice:** `[auto] Run record: Q: "Where do the run record and per-field provenance live?"` → the new entity plus provenance JSON on the two aggregates (recommended default).
**Notes:**
- `CsrmRisk` and `CsrmAssessment` have no JSON attribute today, so per-field state needs one. `CsrmQuestion` needs none, because its state can be derived.
- The 06.1 rule against a competing audit entity is about entities that compete with JDL ones. No JDL entity records AI runs, and G-3 now requires them.
- The record follows the Phase 06.1 and 06.8 format and is approved at a checkpoint (G-6).

---

## 2. What the assessment context holds (INT-05, UAT-030)

| Option | Description | Selected |
|--------|-------------|----------|
| One builder for both operations: request fields (regulatory and third-party included), systems and assets with classifications, the Risk Type library; questions with answers and control candidates for the draft; minimisation by field | Answers the UAT exactly and keeps one reviewable context | ✓ |
| Add the missing fields to each provider's prompt separately | Two drifting prompt builders; no single reviewable context | |
| Send everything the request holds, the Requestor's identity and dates included | Violates G-3 data minimisation | |

**Choice:** `[auto] Context: Q: "What goes into the AI context?"` → one builder, minimised per field (recommended default).
**Notes:** The scout confirmed each gap the UAT inferred:
- the questionnaire prompt sends seven request fields;
- the draft sends answer values by key only, sorted by key;
- neither operation sends systems, assets or regulatory requirements.

Questionnaire generation also receives the Risk Type library, so its questions cover the risk areas the draft will assess.

---

## 3. Untrusted data and the instruction slot (decision 5)

| Option | Description | Selected |
|--------|-------------|----------|
| Three slots: CSRM system instructions, a bounded analyst instruction slot (empty until Phase 15), and a delimited untrusted data block built with the existing escaping | Makes decision 5 structural now; later phases only fill the slot | ✓ |
| Keep the flat list of tagged values | No place for trusted instructions; Requestor text is not grouped as untrusted | |

**Choice:** `[auto] Prompt structure: Q: "How is Requestor text kept apart from instructions?"` → three slots (recommended default).

---

## 4. Size bounds (06.7 D-10)

| Option | Description | Selected |
|--------|-------------|----------|
| Send Requestor text whole; bound the reference libraries by count with a deterministic relevance ranking, recorded; fail loudly over a hard budget; keep wire schemas in the portable strict subset | Respects "never truncate silently"; bounded prompts; works on the G-7 production target | ✓ |
| Truncate long fields visibly | Contradicts 06.7 D-10's reasoning: risk-relevant content could be dropped | |
| No bounds | The control library alone is 2,646 entries; prompts would be unbounded | |

**Choice:** `[auto] Bounds: Q: "How is the context kept within bounds?"` → the recommended option.
**Notes:** Research found that Azure OpenAI's documented strict subset excludes `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern` and `format`, and allows 100 object properties and five levels of nesting. Today's questionnaire schema uses four of those keywords, so both wire schemas move their bounds into the adapters.

---

## 5. The Risk Type library (decision 14, UAT-029)

| Option | Description | Selected |
|--------|-------------|----------|
| Every Risk Type counts as active until Phase 22's flag; bounded at 60 with ranking; several risks per type; no type allowed | Decision 14 and ASSESS-08 criterion 1; no invented flag | ✓ |
| A separate "AI-eligible" flag | A new schema fact decision 14 drops unless needed; the active flag suffices | |
| Keep a fixed list of names | The defect itself | |

**Choice:** `[auto] Risk Types: Q: "Which Risk Types does the draft use, and how many risks per type?"` → the library, several per type (recommended default).
**Notes:** `CsrmRiskType` has no active flag, so Phase 22 adds it. The parser's one-risk-per-type check goes, and the shared ordering rule stays (08 D-09).

---

## 6. Scales and ratings (decision 8, UAT-042)

| Option | Description | Selected |
|--------|-------------|----------|
| The model proposes likelihood and consequence on the 5 × 5 scales; CSRM derives every rating in one shared scale module that Phase 18 enforces and Phase 22 configures | Consistent ratings by construction; ends the "High" as a consequence drift; one seam | ✓ |
| The model proposes ratings too, and the adapter checks consistency | Invites mismatches the adapter must reject or repair | |
| Leave the scales to Phase 18 | The UAT's vocabulary drift continues in every draft until then | |

**Choice:** `[auto] Scales: Q: "What does Phase 12 introduce for the scales?"` → the shared vocabulary and derivation, used by the AI now (recommended default).
**Notes:** The risk editor's inputs stay as they are until Phase 18. The overall rating becomes the highest derived residual rating.

---

## 7. Accept proposals (decision 8, UAT-044)

| Option | Description | Selected |
|--------|-------------|----------|
| Accept or Treat in the wire shape; the adapter turns an Accept for High or Critical residual, or one without a rationale, into Treat and records it; the rationale is the treatment plan text; the analyst confirms it like any AI value | Decision 8 enforced server-side; the model cannot bypass the appetite | ✓ |
| Reject the whole draft when Accept is misused | One field would waste a 20-second generation | |
| Keep Treat only | The finding | |

**Choice:** `[auto] Accept: Q: "How is Accept proposed safely?"` → the recommended option.

---

## 8. Suggested controls (ASSESS-08 criterion 2, UAT-031)

| Option | Description | Selected |
|--------|-------------|----------|
| A bounded candidate set (offered types' applicable controls plus a deterministic lexical shortlist of the whole library, at most 150); at most five per risk with a rationale; persisted as proposals; "Add as planned control" through the decision operation | The model judges relevance; the enum guarantees real controls; the whole library can be reached | ✓ |
| The model names control numbers from memory, and CSRM validates them | Framework numbering in the library is not reliably known to a model | |
| The model writes control needs, and CSRM resolves them by search | No model judgement on the matches; weaker precision | |
| Create Planned control implementations directly | Not a proposal; nothing for the analyst to accept | |

**Choice:** `[auto] Suggestions: Q: "Where do suggested controls come from, and how are they added?"` → the candidate set with one-click add (recommended default).
**Notes:** No search dependency is added; the ranking is a small deterministic scorer, unit-tested. Suggestions never block release.

---

## 9. Pre-filled system, asset and classification (INT-05 criterion 3)

| Option | Description | Selected |
|--------|-------------|----------|
| The model picks from the request's own systems and assets; classification comes from the chosen asset's record; every value is marked AI-proposed | The model cannot point a risk at an unrelated record or invent a classification | ✓ |
| The model proposes the classification | Duplicates a recorded fact and invites contradiction | |

**Choice:** `[auto] Pre-fill: Q: "How are the impacted system, asset and classification filled?"` → the recommended option.

---

## 10. Citations and uncited claims (INT-06 criterion 2, UAT-042)

| Option | Description | Selected |
|--------|-------------|----------|
| Per statement field, sources as plain strings validated by the adapter (unknown ones dropped); an empty list is flagged; the model lists up to five uncited claims per risk | Portable schema, robust to one bad citation, and the invented-fact case gets a place | ✓ |
| Enum-constrain every source list in the schema | Multiplies enum values across fields; less portable | |
| One source list per risk | Too coarse to check a statement quickly | |

**Choice:** `[auto] Citations: Q: "How are statements cited and uncited claims flagged?"` → the recommended option.

---

## 11. Questionnaire style (QUES-10, UAT-043)

| Option | Description | Selected |
|--------|-------------|----------|
| 6 to 20 questions; Yes/No as Single select with Not sure; "Not sure" ensured on selects by the adapter; optional where appropriate; short help text on every question; keys stay `q-N` | Suits a non-expert; deterministic guarantees in the adapter | ✓ |
| Keep 8 to 15 and Boolean | Compound questions persist; no "Not sure" on yes/no questions | |
| Leave "Not sure" to the model | The UAT shows the model does not reliably add it | |

**Choice:** `[auto] Questionnaire: Q: "What does a generated questionnaire look like?"` → the recommended option.
**Notes:** Help text reaches the Requestor's form, the analyst's views and the governance form (the Phase 10 deferral). The key allocator for Phase 15 is recorded as a seam.

---

## 12. Question provenance

| Option | Description | Selected |
|--------|-------------|----------|
| Derived from the governance log after the latest generation: AI-proposed, edited or analyst-added; markers while in analyst review | No schema change; reuses Phase 10's change-count basis | ✓ |
| Store a marker in each question's options | An envelope amendment for a fact the log already holds | |

**Choice:** `[auto] Questions: Q: "How is a question's AI origin known?"` → derived (recommended default).

---

## 13. Field acceptance and release readiness

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit accept (per field, or all remaining per risk and for the assessment details); an edit marks a field edited; release readiness requires no field left proposed | Human review of every AI value is provable and auditable | ✓ |
| Saving a risk accepts all its AI values | Conflates "saved my edits" with "reviewed everything" | |
| Markers only, with no readiness effect | AI values could be released unreviewed | |

**Choice:** `[auto] Acceptance: Q: "When does an AI value stop being a proposal?"` → the recommended option.
**Notes:** Accept and Dismiss are reversible (restore), so they get an Undo toast rather than a confirmation (G-4).

---

## 14. What each actor sees (INT-06 criteria 1 and 3)

| Option | Description | Selected |
|--------|-------------|----------|
| Analysts see provider, model, time and initiating analyst, with "What the AI used". The Requestor sees that AI assisted and a Security Analyst reviewed, in the questionnaire introduction and the released overview, with no provider detail. "Generated by" goes | Transparency without exposing internal configuration; fixes UAT-032's wording | ✓ |
| Show the provider and model to the Requestor too | Internal configuration; the disclosure is what matters to the Requestor | |

**Choice:** `[auto] Visibility: Q: "Who sees which provenance?"` → the recommended option.

---

## 15. The request's data classification (G-3)

| Option | Description | Selected |
|--------|-------------|----------|
| The highest classification among the selected assets; Internal when none is recorded, with the default stated in the run | Uses the recorded facts; the default follows common policy for unlabelled information | ✓ |
| Unknown means the highest level (fail closed) | Blocks every request without classified assets once a ceiling is set, and the analyst cannot add assets | |
| Derive it from business criticality | Criticality is not classification | |

**Choice:** `[auto] Classification: Q: "Where does a request's classification come from?"` → the recommended option.
**Notes:** Phase 22 can make the unclassified default configurable.

---

## 16. The ceiling and environments (G-3, G-7)

| Option | Description | Selected |
|--------|-------------|----------|
| A configuration value read through one policy module. Development (both `NODE_ENV` and `CSRM_ENVIRONMENT`) has no ceiling unless set; everywhere else refuses until set; an invalid value fails boot; it applies to every provider; the transcript flag works only in development | G-7 verbatim, fail-closed, testable with the deterministic provider | ✓ |
| Apply the ceiling only to the hosted provider | Suites could not prove refusals | |
| Fail boot in production when unset | Takes the whole application down for an AI setting | |

**Choice:** `[auto] Policy: Q: "How is the ceiling configured and enforced?"` → the recommended option.

---

## 17. The policy on the hub (UX-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 10's generation-jobs read carries the policy status; the panels show the refusal in place of Generate | Offered actions match what Strapi allows | ✓ |
| Refuse only when Generate is clicked | Offers an action that will fail | |

**Choice:** `[auto] Hub: Q: "When does the analyst learn that generation is refused?"` → before offering the action (recommended default).

---

## 18. Who may start generation, and R-08-42

| Option | Description | Selected |
|--------|-------------|----------|
| Generation is human-initiated only: draft generation and its job read and retry become human-only API Functions. The agent loses request create, update, delete and the unmounted reference read; it keeps its other grants, and its future goes to Phase 22's role review | Every run names an accountable analyst; closes R-08-42; mirrors questionnaire generation | ✓ |
| Let the agent start drafts | No v2.0 phase defines an agent workflow; runs would lack a human initiator | |
| Withdraw every agent grant | Beyond R-08-42 and this phase | |

**Choice:** `[auto] Roles: Q: "What does agent-driven generation need?"` → nothing: generation is human-initiated (recommended default).

---

## 19. Run reads

| Option | Description | Selected |
|--------|-------------|----------|
| One read by run id, human-analyst-only; the questionnaire and assessment reads carry the run id | Minimal and precise; later phases add lists as they need them | ✓ |
| A list of runs by request | Larger payloads (context summaries) for a need Phase 12 does not have | |

**Choice:** `[auto] Reads: Q: "How does the web read a run?"` → by id (recommended default).

---

## 20. The decision operation

| Option | Description | Selected |
|--------|-------------|----------|
| One batch operation per assessment: accept, dismiss and restore, each naming its target (the assessment details, a risk or a suggested control), with the run taken from the target's provenance; through the assessment's mutation serialisation | Resource-oriented like the API's other operations; batch-friendly for sequential Server Actions; Phases 16 and 17 extend it | ✓ |
| A generic operation per run | The record-level check would sit on the run rather than the record being changed | |
| Separate operations per action | More grants, rows and parsers for one concept | |

**Choice:** `[auto] Decisions: Q: "What does accepting or dismissing call?"` → the per-assessment batch operation (recommended default).

---

## 21. Restarts (R-08-36)

| Option | Description | Selected |
|--------|-------------|----------|
| Runs left running become interrupted at bootstrap; the registries stay in-process; the shared job store stays open | Honest records for a single-process deployment at little cost | ✓ |
| Leave running runs as they are | Audit records would claim a run that never ends | |
| Build a persisted job queue | Beyond this phase; R-08-36's trigger is multi-process deployment | |

**Choice:** `[auto] Restarts: Q: "What happens to a run when Strapi restarts?"` → interrupted at bootstrap (recommended default).

---

## 22. Records generated before Phase 12

| Option | Description | Selected |
|--------|-------------|----------|
| No provenance means no markers and no readiness requirement; the header shows the stored provider facts with a note | Safe default for existing rows; in-flight UAT records stay releasable | ✓ |
| Backfill every AI field as proposed | Cannot tell AI values from analyst edits; blocks in-flight assessments | |

**Choice:** `[auto] Existing records: Q: "How do existing AI records behave?"` → the recommended option.

---

## 23. The route budget (R-08-34)

| Option | Description | Selected |
|--------|-------------|----------|
| Server-render provenance where possible, zod-free client pieces, on-demand loading for the disclosure and suggestions, and `performance.spec.ts` stays green | The editor route is at 89.9% of its budget | ✓ |
| Raise the budget | Needs a recorded reason and is not yet justified | |

**Choice:** `[auto] Budget: Q: "How does the editor stay within budget?"` → the recommended option.

---

## 24. Verification

| Option | Description | Selected |
|--------|-------------|----------|
| RED first at each seam; wire-shape provider tests through the fake server; a new E2E journey with its own UAT-A-like records; deliberate changes to the release journey; the live model check is manual and the operator's | Hermetic, and proves every criterion without a live model | ✓ |

**Choice:** `[auto] Verification: Q: "How is the phase proved?"` → the recommended option.

---

## Planner's Discretion

- Module decomposition and file placement.
- The relevance ranking's details.
- The exact bounds within the proposed ranges.
- Reason-code, Function and operation names within the proposed families.
- How the new operations and the catalogue moves split across plans.
- Copy, layout and marker visuals, which the UI-SPEC fixes.

## Deferred Ideas

- Analyst instructions and targeted re-runs (Phases 15 and 16), risk withdrawal (16) and residual reassessment (17).
- Scale enforcement in the editor and the API (18); configurable scales, ceiling, active Risk Types and the unclassified default (22).
- Notes and attachments in the context (13 and 14), and the failed-run dashboard (21).
- A shared job store (R-08-36), per-cell markers in the risk table (18), G-1 for AI acceptance (17.1), and the Phase 15 key allocator.
- The service agent role's future (22), and local model evaluation (999.1).
