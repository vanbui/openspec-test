# Phase 16 deferred items

## 16-10: an added risk's AI fields cannot be reviewed or edited (needs a pilot ruling, G-6)

**Status: resolved (2026-10-16).** The pilot approved option 1 in `729ef6e0` (the "Phase 16 execution amendment (2026-10-16)" of `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`, item 1). A `risk-suggestions` run now takes Phase 12's v1 events for a Risk it added, as that Risk's `created` history row shows, and the item fold reads only the v2 events. Test `488e3d2e`, fix `68706176`; see the addendum in `16-10-SUMMARY.md`. 16-11 and 16-15 are unblocked.

**Found during:** 16-10 Task 3, by a mounted probe that was not committed.

**What happens.** "Add to assessment" creates the Risk with AI provenance whose envelope `runId` names the `risk-suggestions` run, as the approved Phase 16 amendment to `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md` requires ("a Risk added from a suggestion names the suggestion run on each field, and its envelope's `runId` and `proposalKey` name that run and item"). Phase 12's per-field review then appends its decision event v1 to the envelope's run:

- a Phase 12 field decision (`{ target: { kind: "risk", riskId }, action: "accept" }`, the editor's "Confirm remaining"), in `applyFieldDecisions` (`ai-proposal-decisions.ts`);
- a human analyst's edit of a proposed AI field (`PATCH /api/v1/risks/{riskId}`), through `applyAiFieldEdit` in `updateRiskWithinMutation` (`risk-workflow.ts`), which appends an `edited` v1 event.

The same amendment says "A v1 event on a risk proposal run is refused and nothing is written", and `appendAiRunDecisions` enforces it. So both calls on an added Risk answer 409 `AI_RUN_RECORD_UNAVAILABLE` (probe: `{"confirm":[409,"AI_RUN_RECORD_UNAVAILABLE"],"edit":[409,"AI_RUN_RECORD_UNAVAILABLE"]}`). Its `aiProposalsReviewed` requirement stays outstanding, and the only way to release the assessment is to withdraw the added Risk. It fails closed (nothing is written without its audit record), but it breaks the amendment's own promise that the added Risk is "reviewed per field with Phase 12's decisions", and 16-UI-SPEC E1's journey (`Add to assessment`, then `Open {risk number}` and Phase 12's `Confirm remaining`).

**Why it was not fixed in 16-10.** Every fix changes an approved contract text, so it needs the pilot's ruling (G-6). The candidates:

1. **Recommended.** On a `risk-suggestions` run, also accept Phase 12's v1 field and suggested-control events (`target` = the added Risk's documentId) beside the v2 item events. The run record parses the two families by `schemaVersion` within that operation, and the item fold reads only the v2 events. This keeps one audit trail per run, and an added Risk is reviewed exactly as a drafted one. It amends "A v1 event on a risk proposal run is refused" for `risk-suggestions` only.
2. Leave the envelope `runId` naming the assessment's draft run (the per-field `runId` keeps the suggestion run), so Phase 12's v1 events land on the draft run. This amends "its envelope's `runId` and `proposalKey` name that run and item", and it records the review of the suggestion's fields on a run that did not propose them.
3. Skip the v1 audit event when the envelope's run is a risk proposal run, and keep only the per-field fact (`by`, `at`). This weakens WR-103 (no AI decision without its run record).

16-11 and 16-15 (the web "Add to assessment" and the E1 journey) depend on the ruling.

## 16-15: other `next/dynamic` bodies with no Suspense boundary of their own (pre-existing, out of scope)

**Found during:** 16-15 Task 2 (the rewrite popover failed in `risk-curation.spec.ts` at 1440).

`next/dynamic` wraps a body in a Suspense boundary of its own only when it has `loading` (or `ssr: false`). A body first rendered after an interaction without one suspends the page's nearest boundary: the whole page hides behind its route skeleton for a moment and the scroll position is lost. 16-15 fixed the two Phase 16 cases (`RewriteFormBody` in `rewrite-form.tsx`, `RiskRewriteSection` in `assessment-editor.tsx`) and guards them in `zod-client-boundary.test.ts`. These earlier ones have the same shape and were not changed here:

- `features/questionnaire-ai/ai-proposals-panel-client.tsx`: `DecidedProposals` (shown when its toggle opens; Phase 15).
- `features/questionnaires/questionnaire-review.tsx`: `QuestionAiRowExtras` (Phase 15).
- `features/attachments/files-list.tsx`: `FileAiControl` (Phase 14).

Each is server-rendered on first load when present then, so the flash shows only when it first appears after an interaction. Suggested fix: a `loading` option on each, as 16-15 did.

## Phase 16 code review: findings deferred with a route (pilot rulings, 2026-10-16)

From `16-REVIEW.md`; the full disposition is in `16-REVIEW-DISPOSITION.md`. Each route is also recorded as a dated "Carried from Phase 16" section in the target phase's CONTEXT.

- **BE1-02 (due state):** a withdrawn Risk of a released assessment still carries a live `treatmentDueState` in the Risk Register's `Withdrawn` view (`accepted` was fixed in the review). Route: **Phase 20**, which owns treatment tracking and the overdue rule. Low exposure: analyst-only `Withdrawn` filter; every count, alert and report excludes withdrawn Risks.
- **BE1-04:** the history read serves `kind`, `sourceKind` and `reason` unchecked against the closed contract, so one off-contract row fails the web's strict parser for the whole page. Route: **Phase 18** (S-9 opens the history's vocabulary for bulk curation). Hiding audit rows is not acceptable.
- **BE1-08:** Security Analyst Agent edits are recorded with source `analyst`. Route: **Phase 18**, with a G-6 amendment for the closed source values.
- **BE1-01 (display):** `created` rows now record starting values (audit); 16-UI-SPEC §8.3 shows no lines for them. Showing them in the history sheet is routed to **Phase 18**.
- **BE2-11:** every risk-workflow 400 on an AI decision reads as `AI_PROPOSAL_STALE`. Route: **Phase 17.1**, with the carried W-1 assessment-side 409 reason codes.
- **BE2-13:** no limit on concurrent provider calls in one process. Route: **Phase 22**'s configuration hardening (S-13).
