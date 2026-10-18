# Phase 16: Risk curation and targeted AI re-runs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 16-risk-curation-and-targeted-ai-re-runs
**Mode:** `--auto`, one pass.
- Every area was selected automatically, and each question took the recommended option with no user prompt: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005), at the G-4 premium bar, consistent with `NEXT-WAVE-DECISIONS.md` and the post-demo decisions G-11 to G-18.
- The orchestrator seeded the requirements, decisions 5, 6, 8 and 14, G-3, Phase 12's run record and provenance, the reversal of Phase 04's "a linked draft never invokes the provider again", the withdrawal and rejection rules, the reinstatement question, the contract-gap record, the two AI operations and their inputs, the seams, and the single editable guard.
- The code read during the scout confirmed or corrected each seed. Corrections: Phase 04's "Expose no Risk delete service" is reaffirmed by decision 6, not reversed as UAT-027 suggested; there is no risk delete operation to serve, only a proof that none exists; the generic `/api/csrm-risks` core routes are already unmounted.
- No todo matched the phase (`todo.match-phase 16`: 0). No `.continue-here.md`, SPEC.md or checkpoint existed, no discuss hooks were active, and no codebase maps exist (grep fallback).
- The discussion completed in one pass, so no `16-DISCUSS-CHECKPOINT.json` remains.

**Areas discussed:**
1. What changes the schema
2. How withdrawal is stored
3. What a withdrawn risk keeps, and whether it can be edited
4. Who sees a withdrawn risk
5. The shape of the withdrawal operation
6. Reinstatement
7. Confirmation or Undo
8. Withdrawal as an edit
9. Where withdrawn risks drop out
10. The overall rating after curation
11. Delete, and unsaved rows
12. Where the risk history lives
13. What the history records
14. Who reads the history
15. The editable guard
16. The guard and the edit transition
17. Regeneration or targeted operations
18. Foundations for the two operations
19. Jobs
20. Instructions and new information
21. What "Suggest more risks" sees and returns
22. Duplicates
23. Accepting a suggested risk
24. What "Rewrite this risk" may change
25. Diff units and stale proposals
26. The Accept rule in re-runs
27. Decisions and the item lifecycle
28. Undecided proposals and release
29. Grants
30. Interface, extensions and the premium bar
31. The route budget
32. Verification and plan shape

---

## 1. What changes the schema (decision 6, G-6)

| Option | Description | Selected |
|--------|-------------|----------|
| Two content-type changes through one contract-gap record (withdrawal facts on `CsrmRisk`; a risk history entity), with the AI proposal envelopes as dated amendments to Phase 12's record and a dated note on Phase 04's draft-job contract, all reviewed at one checkpoint | Decision 6 needs a home for withdrawal and history that the frozen schema lacks; the AI proposals fit Phase 12's run record, which was designed for Phases 15 to 17 | ✓ |
| Withdrawal facts only, with history deferred to Phase 18 | The success criterion "stays in history with its reason" and ASSESS-09 criterion 1 need history now | |
| A separate record for the AI envelopes | They change no content type; a dated amendment follows Phase 10 D-01's precedent for an approved envelope | |

**Choice:** `[auto] Contract: Q: "Which content-type changes does Phase 16 make, and in which records?"` → two changes in `phase-16-risk-withdrawal-and-history.md`, AI envelopes as amendments (recommended default).
**Notes:** The ROADMAP's "risk withdraw and delete" is read as withdrawal plus the proof that no delete exists (decision 6).

---

## 2. How withdrawal is stored (decision 6)

| Option | Description | Selected |
|--------|-------------|----------|
| A current fact on the risk: `withdrawnAt`, `withdrawnBy`, `withdrawalReason`, cleared on reinstatement with the history keeping both events | The 06.1 and 06.8 audit-fact shape; gates read it directly, never a log | ✓ |
| A risk status enumeration (active, withdrawn, later closed) | The JDL gives `CsrmRisk` no status; a competing one would collide with `closureDate` and `treatmentStatus` | |
| Reuse `closureDate` and `comments` | Overloads JDL terms; decision 6 keeps closure for released risks through the register | |

**Choice:** `[auto] Withdrawal: Q: "How is a withdrawal recorded on the risk?"` → the three-attribute current fact (recommended default).

---

## 3. What a withdrawn risk keeps, and whether it can be edited

| Option | Description | Selected |
|--------|-------------|----------|
| It keeps its number, fields, controls and AI provenance unchanged, and is read-only until reinstated; a reason of 1 to 500 characters through the revert-reason parser | Parked records cannot change unseen; one reason convention across the product | ✓ |
| Editable while withdrawn | Changes to invisible records; a confusing history | |
| Strip its control implementations | Destroys evidence; decision 6's audit integrity | |

**Choice:** `[auto] Withdrawn state: Q: "What can happen to a withdrawn risk?"` → kept whole and read-only (recommended default).

---

## 4. Who sees a withdrawn risk (G-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Security Analysts only: a "Withdrawn" filter in the editor and the Risk Register; the Requestor and participants never see one or learn it exists, and a direct read is a 404 | Second-line working material, often an AI misfire; G-12 already says participants read "every non-withdrawn risk" | ✓ |
| Show withdrawn risks to the Requestor, marked | Communicates rejected AI output; contradicts G-12 | |
| Hide them from analysts too, outside the history | Decision 6 asks for a "Withdrawn" filter | |

**Choice:** `[auto] Visibility: Q: "Who sees withdrawn risks?"` → analysts only (recommended default).

---

## 5. The shape of the withdrawal operation

| Option | Description | Selected |
|--------|-------------|----------|
| One batch operation per assessment (1 to 200 risk ids, one reason, one transaction, `{ applied, unchanged }`), and the same shape for reinstatement | Serialised on the assessment like every risk mutation; Phase 18's bulk withdrawal reuses it with no new contract; mirrors Phase 12's batch decision operation | ✓ |
| `POST /risks/{riskId}/withdraw` per risk | Phase 18 would need a second, bulk operation | |
| A field on `PATCH /risks/{riskId}` | Server-owned facts written through a generic update; no required reason; no clean grant | |

**Choice:** `[auto] Operation: Q: "What does Withdraw call?"` → the assessment-scoped batch (recommended default).

---

## 6. Reinstatement

| Option | Description | Selected |
|--------|-------------|----------|
| Allowed while the assessment is editable, with a reason, recorded; the facts clear and the history keeps both events | Withdrawals are sometimes wrong, and new information can bring a risk back; recreating it by hand would split one risk into two records and lose its provenance | ✓ |
| Not allowed: withdrawal is final | Forces duplicate records for an honest mistake | |
| Allowed without a reason | The seed asks for a reason; the third line needs one | |

**Choice:** `[auto] Reinstate: Q: "Can a withdrawn risk come back?"` → yes, with a reason (recommended default).
**Notes:** How a reinstated risk's earlier acceptance decision is treated is Phase 17.1's; the recommendation (withdrawal voids it) is recorded as seam S-6.

---

## 7. Confirmation or Undo (G-4)

| Option | Description | Selected |
|--------|-------------|----------|
| No confirmation: a compact reason form, optimistic apply, and an Undo toast that reinstates with the fixed reason "Withdrawal undone" | G-4 keeps confirmations for irreversible, governance-significant steps; withdrawal is reversible | ✓ |
| A confirmation dialog | Friction for a reversible step, against G-4 | |
| Undo that erases the withdrawal from the history | Breaks the append-only history | |

**Choice:** `[auto] Feedback: Q: "How does withdrawing feel?"` → reason form plus Undo (recommended default).

---

## 8. Withdrawal as an edit (decision 17, 06.8 D-13)

| Option | Description | Selected |
|--------|-------------|----------|
| Withdrawal and reinstatement are content edits: they run the accepted-edit transition and, from Phase 17.1, withdraw "Mark reviewed" | They change what the assessment says; a review must see the final scope | ✓ |
| Not edits | A reviewed assessment could lose a risk with no fresh review | |

**Choice:** `[auto] Review: Q: "Does withdrawing a risk withdraw the review?"` → yes (recommended default).

---

## 9. Where withdrawn risks drop out (decision 11, G-11 to G-13)

| Option | Description | Selected |
|--------|-------------|----------|
| One active-risk rule in each form it is needed (SQL beside `applyDisclosableParent` and Phase 11's stage predicates, one document filter, one pure predicate), used by readiness, every count, figure, list, export and Requestor read, and by Phases 17, 17.1, 18, 19, 20 and 21 | Phase 11 D-40 already puts the exposure rule "once, beside that scope", and D-31 expects this phase to exclude withdrawn risks; one rule cannot drift | ✓ |
| Filter withdrawn risks in each reader | The three insight repositories already repeat a predicate; another copy per reader drifts | |
| Exclude them only from readiness and the editor | Exposure, the register and the Requestor's view would count risks the analyst removed | |

**Choice:** `[auto] Rule: Q: "How do withdrawn risks leave every figure?"` → one shared rule (recommended default).

---

## 10. The overall rating after curation

| Option | Description | Selected |
|--------|-------------|----------|
| A non-blocking hint when the overall rating no longer matches the highest residual rating of the active risks, with "Use {rating}" | The analyst owns the conclusion; a stale summary is flagged, not silently changed; Phase 18 may make it a rule | ✓ |
| Recompute the overall rating automatically | Overwrites an analyst field without a decision | |
| Make it a readiness rule now | ASSESS-18's derived ratings and override reasons are Phase 18's | |

**Choice:** `[auto] Overall rating: Q: "What happens to the overall rating when risks change?"` → a hint (recommended default).

---

## 11. Delete, and unsaved rows (decision 6)

| Option | Description | Selected |
|--------|-------------|----------|
| No delete route and no code path that deletes a risk, proved by matrix probes and a static guard; "Discard" on an unsaved new risk with an Undo toast that restores the typed values, and the navigation guard on leave | Decision 6 drops the hard-delete exception; Phase 04's "no Risk delete service" stands; the unsaved row never reached the database | ✓ |
| A DELETE for risks never edited since the draft | Decision 6 dropped exactly this exception | |
| No discard control | The UAT's "Add Risk" form could only be saved or abandoned by leaving the page | |

**Choice:** `[auto] Delete: Q: "Can anything delete a risk?"` → no; unsaved rows are discarded on the client (recommended default).

---

## 12. Where the risk history lives (decisions 6 and 9, G-15)

| Option | Description | Selected |
|--------|-------------|----------|
| A new append-only entity, one row per change, with assessment and risk relations, closed kind and source vocabularies that later phases extend, and old and new values | Scales to Phase 18's batch edits and Phase 20's years of treatment updates; queryable for Phase 21; never bloats risk reads; competes with no JDL entity (Phase 12's reasoning for `CsrmAiRun`) | ✓ |
| An append-only JSON log on each risk (06.8's `governanceLog` pattern) | Grows every risk read; contends with batch edits; Phase 21 must scan JSON; Phase 12 rejected the same option for runs | |
| The AI run's decisions log only | Covers AI acts, not withdrawals or manual edits | |

**Choice:** `[auto] History store: Q: "Where is a risk's history kept?"` → a dedicated entity (recommended default).
**Notes:** The 06.1 and 06.8 records deferred a cross-aggregate audit trail "to a future domain-model decision" and forbade audit entities that compete with JDL ones. Decisions 6 and 9 and G-15 are that decision for risks, and the catalogue's design note 6 already says audit history needs a model extension.

---

## 13. What the history records

| Option | Description | Selected |
|--------|-------------|----------|
| Every change on the analyst paths from Phase 16 on: creation (manual, drafted, from a suggestion), field changes with old and new values (manual and AI rewrite), withdrawal and reinstatement with reasons, and control implementation added, updated and removed | A complete history from day one; Phase 17's owner changes (ASSESS-21 criterion 1), 17.2's before-and-after view, Phase 18's ASSESS-16 criterion 4 and Phase 20's RISK-04 criterion 2 build on it; removals of control implementations become auditable | ✓ |
| Only withdrawals, reinstatements and AI acceptances | An AI rewrite would show while the manual edit after it would not: a misleading audit trail | |
| Everything, including Phase 12's per-field acceptances | Duplicates the run's decisions log, which stays the AI history | |

**Choice:** `[auto] History content: Q: "Which changes are recorded?"` → every change from Phase 16 on (recommended default).
**Notes:** Phase 18's ROADMAP line names its own "risk change history" contract-gap record; under this choice it amends Phase 16's record instead of adding a store (seam S-9). Risks created earlier show "History recorded from {date}".

---

## 14. Who reads the history

| Option | Description | Selected |
|--------|-------------|----------|
| One per-risk read, human Security Analyst only in this phase, paginated, with the record-level check through the risk's assessment | Least privilege now; Phases 17 and 17.2 decide what participants read (G-12, G-15) | ✓ |
| An assessment-wide history read now | Phase 17.2 builds the assessment history view (G-15) | |
| Requestor access | Withdrawn risks and AI misfires are not for the Requestor (G-12) | |

**Choice:** `[auto] History read: Q: "Who reads a risk's history?"` → analysts, per risk (recommended default).

---

## 15. The editable guard (ASSESS-24 seam)

| Option | Description | Selected |
|--------|-------------|----------|
| One exported predicate behind `withMutableAssessmentMutation`, taking the actor, passed by withdraw, reinstate, job enqueue, job execution, run completion and every decision; Phase 17 adds G-11's actor rule and Phase 17.1 the acceptance-round lock in that one place | Every Phase 16 mutation inherits both later rules without change; the seed's single guard | ✓ |
| Each operation checks the assessment's status itself | Phase 17.1 would have to find and change every check | |
| Check only at enqueue | A run could start or complete on an assessment released meanwhile | |

**Choice:** `[auto] Guard: Q: "How is 'the assessment is editable' decided?"` → one actor-aware guard (recommended default).

---

## 16. The guard and the edit transition (decision 17)

| Option | Description | Selected |
|--------|-------------|----------|
| Separate them: content changes (withdraw, reinstate, adding a risk, accepting or restoring a unit) run the edit transition; rejections and run completion take the serialisation and the guard but not the transition; Phase 12's dismissal of a suggested control is aligned with the same rule | A rejection changes nothing that was reviewed, so it must not withdraw a review | ✓ |
| Every decision is an edit (Phase 12 D-24 as written) | Rejecting a suggestion after review would withdraw the review for no change | |

**Choice:** `[auto] Transition: Q: "Which acts withdraw a review?"` → content changes only (recommended default).
**Notes:** This refines Phase 12 D-24 for dismissals; the plan that extends the decision operation aligns it with a test.

---

## 17. Regeneration or targeted operations (UAT-028; Phase 04)

| Option | Description | Selected |
|--------|-------------|----------|
| Two targeted operations that write proposals into a run; whole-draft regeneration is not offered and `regenerate_draft` stays unserved; Phase 04's draft-job contract gains a dated note narrowing "a linked draft never invokes the provider again" to the draft job | Nothing the analyst curated is lost; mirrors decision 4's rule for questionnaires | ✓ |
| Serve `regenerate_draft` and replace the draft | Discards withdrawals, edits and accepted proposals | |
| Re-run the draft job on a linked assessment | Breaks the draft job's single-flight and restart-discovery contract | |

**Choice:** `[auto] Re-runs: Q: "What does an AI re-run do to an existing assessment?"` → proposals only (recommended default).

---

## 18. Foundations for the two operations (Phase 12)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 12's context builder, data policy (checked at enqueue and execution), run record, draft risk wire shape, adapter, parser, derived ratings and per-field provenance, with per-field run references added | One AI pipeline; nothing parallel to maintain; Phase 12 designed its run record for Phases 15 to 17 | ✓ |
| A separate pipeline per operation | Two contexts that drift; two policies | |

**Choice:** `[auto] Foundations: Q: "What do the re-runs build on?"` → Phase 12's machinery (recommended default).

---

## 19. Jobs (R-08-36)

| Option | Description | Selected |
|--------|-------------|----------|
| The existing in-process registry pattern, single flight per target (assessment for suggestions, risk for rewrites), with a read and a retry following Phase 13's rule for any analyst on the request; proposals durable in the run | Proposals survive a restart; only an in-flight job is lost and its run is marked interrupted | ✓ |
| Synchronous calls | A 20-second request; no progress; no retry | |
| A persisted job queue | R-08-36's trigger is multi-process deployment, not this phase | |

**Choice:** `[auto] Jobs: Q: "How do the re-runs execute?"` → the registry pattern (recommended default).

---

## 20. Instructions and new information (decision 5; Phases 13, 14, 15)

| Option | Description | Selected |
|--------|-------------|----------|
| An optional instruction in its own bounded slot, with Phase 15's validator, logged in the run; notes marked "changes the AI inputs" and opted-in attachment text enter both contexts through Phase 12's extension points; the editor says, server-derived, when such input arrived after the latest AI run and offers the re-runs | Decision 5's slot; Phase 13's success criterion 5 says Phase 16 reads the mark; the analyst learns when a re-run is worth doing | ✓ |
| No instruction | ASSESS-10 criterion 3 records an instruction per run | |
| Notes in the instruction slot | Requestor text would sit among trusted instructions (decision 5) | |

**Choice:** `[auto] Inputs: Q: "What steers a re-run, and what new information does it see?"` → the recommended option.

---

## 21. What "Suggest more risks" sees and returns (ASSESS-10 criterion 1)

| Option | Description | Selected |
|--------|-------------|----------|
| The context lists active risks, withdrawn risks with reasons, and rejected and open suggestions, as data with short keys; it returns up to a bounded number of complete draft-shaped risks; over the bound the job fails before any provider call | The model knows what exists and what was dismissed; minimisation (no numbers, owners or dates); no silent truncation (06.7 D-10) | ✓ |
| Only the request context, with duplicates removed afterwards | The model repeats existing risks and spends its output on them | |
| Risk numbers and owners in the context | Unneeded personal and record data (G-3) | |

**Choice:** `[auto] Suggestions: Q: "What does the model see and return?"` → the recommended option.

---

## 22. Duplicates (success criterion 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Two deterministic tiers using Phase 12's lexical ranker: near-identical proposals are removed and recorded as adjustments, with the count shown; similar ones are kept and flagged "Similar to {risk}" with a comparison and "Reject as duplicate" | Drops only clear repeats, flags judgement calls, as Phase 12 D-14 drops invalid sources but flags uncited statements; no dependency | ✓ |
| Flag everything, drop nothing | A cluttered list of repeats | |
| Drop everything above one threshold | False positives would vanish unseen | |
| Trust the model alone | No safety net when the model repeats a risk | |

**Choice:** `[auto] Duplicates: Q: "How are repeats of existing risks handled?"` → two tiers (recommended default).

---

## 23. Accepting a suggested risk

| Option | Description | Selected |
|--------|-------------|----------|
| "Add to assessment" creates the risk, whose AI values arrive marked as proposed with their citations and suggested controls, reviewed per field like a drafted risk and gated by "AI proposals reviewed" | One mental model for AI values on the record (Phase 12 D-21, INT-06); the suggestion list stays a compact triage | ✓ |
| "Add" accepts every field at once | Field review could be skipped on a one-line preview | |
| Create suggested risks immediately, hidden until accepted | Wastes risk numbers on rejected proposals and pollutes the table | |

**Choice:** `[auto] Add: Q: "What does accepting a suggestion do?"` → add, then per-field review (recommended default).
**Notes:** "Add to assessment" has no Undo toast because it creates a persisted risk; a wrong addition is withdrawn.

---

## 24. What "Rewrite this risk" may change (ASSESS-10 criterion 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 12's twenty AI-writable fields only, with an optional focus (statement and cause, ratings, treatment); owners, dates, statuses, exemption, escalation, comments, effectiveness and velocity are never proposed; built as a generic field-change mechanism Phase 17 reuses | AI proposes analysis, not accountability facts; ASSESS-13 needs the same per-field mechanism | ✓ |
| Every risk field | The AI would propose owners and dates, which belong to people | |
| Statement fields only | Ratings and treatment often need the same rewrite | |

**Choice:** `[auto] Rewrite scope: Q: "What can a rewrite propose?"` → the AI-writable fields (recommended default).

---

## 25. Diff units and stale proposals

| Option | Description | Selected |
|--------|-------------|----------|
| Per field, except derived groups accepted together (likelihood, consequence and rating; asset and classification; Accept and its rationale); each unit records its base value, and accepting a unit whose base changed is refused as stale | The risk never holds an inconsistent combination; a proposal never overwrites a later edit | ✓ |
| Strictly per field | Accepting a likelihood without its rating breaks decision 8's derivation | |
| Whole-risk accept or reject | ASSESS-10 asks for per-field acceptance | |
| Apply stale units anyway | Silently overwrites the analyst's later edit | |

**Choice:** `[auto] Diff: Q: "What does the analyst accept, and what if the risk changed meanwhile?"` → units with stale detection (recommended default).

---

## 26. The Accept rule in re-runs (decision 8, G-14)

| Option | Description | Selected |
|--------|-------------|----------|
| The adapter turns an AI Accept into Treat for a High or Critical residual rating, a missing rationale, or a risk with a planned control implementation, recording the adjustment; acceptance refuses an AI Accept unit if the resulting residual rating is High or Critical; one rule in `risk-scale.ts` | Decision 8 holds end to end; G-14's coherence ("Accept ... only for a risk with no planned control implementation") applies to the AI's recommendation; Phase 22 configures one place | ✓ |
| Adapter only | Accepting the Accept unit without the rating unit could leave an AI Accept on a High risk | |

**Choice:** `[auto] Accept rule: Q: "How is decision 8 enforced for re-runs?"` → adapter and acceptance (recommended default).

---

## 27. Decisions and the item lifecycle (decision 6)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 12's decision operation gains run-scoped targets (a proposed risk, a rewrite unit) with `accept`, `reject` (optional reason) and `restore` (for Undo); items are open, accepted, rejected, superseded (by a newer rewrite or a withdrawal) or lapsed (the assessment stopped being editable); a newer suggestion run leaves open suggestions open | Every proposal ends in a recorded human act or a cited cause; nothing undecided is silently lost | ✓ |
| A new decision operation for Phase 16 | Phase 12 D-24 anticipated run-scoped items on its operation | |
| A newer suggestion run supersedes open suggestions | Good proposals the analyst had not reached would be lost | |

**Choice:** `[auto] Decisions: Q: "How are proposals decided and closed?"` → the recommended option.
**Notes:** Phase 12 calls rejecting a suggested control "dismiss"; Phase 16 uses decision 6's word, "reject". The history labels both as rejected, and the planner may unify the action names.

---

## 28. Undecided proposals and release (decision 6)

| Option | Description | Selected |
|--------|-------------|----------|
| A readiness requirement, "AI proposals decided", outstanding while any item is open; "Reject remaining" clears it; the open count is a current fact (an amendment to the assessment's `aiProvenance`) written with run completion and each decision | Decision 6's basis is "what a person decided"; an AI-proposed risk left undecided leaves risk identification incomplete; gates never parse history (06.8) | ✓ |
| Undecided proposals lapse at release, as Phase 12's suggested controls do | A proposed risk is an identification decision, not a refinement of a reviewed risk | |
| Compute the gate by parsing every run's log | A gate that parses JSON, which 06.8 rules out | |

**Choice:** `[auto] Release: Q: "Can an assessment be released with AI proposals undecided?"` → no (recommended default).
**Notes:** Phase 12's undecided suggested controls keep their non-blocking rule (Phase 12 research, open question 1).

---

## 29. Grants (G-1, G-3; Phase 12 D-32)

| Option | Description | Selected |
|--------|-------------|----------|
| Every Phase 16 operation is human Security Analyst only (new API-only Functions plus `HUMAN_ANALYST_ONLY_OPERATIONS`); the service agent keeps its existing risk edits but cannot set withdrawal facts or touch a withdrawn risk; every analyst on the request may act, since editing is not exclusive | Every run names an accountable analyst; withdrawal and decisions are human judgements; decision 10 | ✓ |
| Let the service agent withdraw or start re-runs | AI-driven removal and AI-initiated runs, against G-3 and decision 6 | |
| Only the assignee may act | Decision 10: editing is not exclusive | |

**Choice:** `[auto] Grants: Q: "Who may withdraw, reinstate, re-run and decide?"` → human analysts (recommended default).

---

## 30. Interface, extensions and the premium bar (G-4)

| Option | Description | Selected |
|--------|-------------|----------|
| The editor gains an active and withdrawn filter, "Suggest more risks" with a proposals panel, per-risk "Withdraw", "Rewrite" and "History", and the new-information notice; the register gains the "Withdrawn" filter; reuse X-1, X-3, X-4, X-5, X-10, Phase 12's marker and citation chip, the revision timeline and the one status mapping; propose extensions only for the field comparison and the withdrawn treatment; G-4 in full, with sheets and stacked diff cards on phones | Shared components Phase 18 reuses; the field comparison serves Phases 17 and 17.2 | ✓ |
| A separate curation page | Splits the analyst's work across two places | |
| New one-off visuals per surface | Near-duplicate extensions | |

**Choice:** `[auto] Interface: Q: "Where do curation and re-runs live, and how do they look?"` → the recommended option.

---

## 31. The route budget (R-08-34)

| Option | Description | Selected |
|--------|-------------|----------|
| Load the proposals panel, the diff, the history and the withdraw form on demand from a Client Component, render static parts on the server, keep client pieces zod-free, and keep `performance.spec.ts` green or record a reasoned exception | The editor route was at 89.9% of its budget before Phases 10 and 12 add to it | ✓ |
| Raise the budget | Needs a recorded reason, not yet justified | |

**Choice:** `[auto] Budget: Q: "How does the editor stay within budget?"` → the recommended option.

---

## 32. Verification and plan shape

| Option | Description | Selected |
|--------|-------------|----------|
| A failing test first at each seam; Strapi integration for every grant and refusal and the active-risk rule across every reader; wire tests through the fake server; deterministic providers that prove the payment-file risk and the duplicate tiers; web units with refusal states; a new Playwright spec with its own records at 375px and 1440px; the record and checkpoint first; shared files serialised | Hermetic, proves every criterion and negative case without a live model; G-6's clean tree | ✓ |

**Choice:** `[auto] Verification: Q: "How is the phase proved and sequenced?"` → the recommended option.
**Notes:** The live UAT-A check on the hosted provider is manual and the operator's. Phase 16 adds no slice to `risk-owner-journey.spec.ts`, which Phase 17 creates. The size is at the top of M, and the planner reports if the plan set runs long.

---

## Planner's Discretion

- Names of operations, Functions, reason codes, run operations, item kinds and history kinds, within the proposed families.
- Module placement for the curation, history and proposal modules, server and web.
- Exact bounds and the duplicate thresholds.
- Where the open-item fact lives (the `aiProvenance` amendment is recommended).
- The deterministic providers' rules and wording.
- How the plans split, provided shared files are serialised.
- Copy, layout and visuals, which the UI-SPEC fixes.

## Deferred Ideas

- Closing released risks through the register (Phase 20); bulk withdrawal and edits in the table (Phase 18); residual reassessment (Phase 17).
- Participant access to risk history and an assessment-wide history view (Phases 17 and 17.2).
- Soft removal of control implementations; a notification when proposals are ready; withdrawal reason categories (Phase 21); merging duplicates.
- Per-cell AI markers and diffs in the table (Phase 18); whole-draft regeneration (not offered); local model evaluation (999.1).
