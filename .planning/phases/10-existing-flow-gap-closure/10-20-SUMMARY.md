---
phase: 10-existing-flow-gap-closure
plan: 20
subsystem: ui
tags: [exemption-review-date, date-input, owner-combobox, save-status, live-region, focus-management, d-28, d-32, d-33, uat-009, uat-034]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-01 LocalInstant and TimeZoneProvider; 10-08 SaveStatus (X-1); 10-18 RelationPicker in the control editor; 10-19 the pickers in both editors, the shared helpers in assessment-domain.ts and the riskTypeId prop on risk-details.tsx"
provides:
  - "exemptionReviewDateFormValue, exemptionReviewDateFromForm and withExemptionReviewInstant (zod-free, assessment-domain.ts)"
  - "The exemption review date as a date input in both editors, saved at 00:00 UTC, with an untouched legacy value never resent (D-32)"
  - "SaveStatusValue { kind: 'note'; message } for No changes to save. in the same polite region"
  - "useRecordSaveStatus (features/assessments/use-record-save-status.ts): one form's confirmation, cleared on the next change and on failure, with an added-at entry for a new record"
  - "Risk saved at, Mitigation control saved at and Assessment details saved at in each assessment-editor action row; Risk added at and Mitigation control added at on the new record, with focus returned to Add Risk or that Risk's Add mitigation control"
  - "Control owner as OwnerCombobox over the active-user search in both editors; ControlImplementationEditorOptions carries searchOwners instead of users"
  - "Journey proofs ASSESS06_RISK_SAVE_CONFIRMED and ASSESS06_CONTROL_ADD_CONFIRMED, and E11's owner part"
affects: [10-21, 10-22, 10-23, phase-18-risk-table]

actuals:
  tokens: 23116
  tasks: 3
  commits: 5
plan_head_before: 2ad27992def1affc9edfe4dffff6a892ec267060
plan_head_after: 76b7d51d5c6af8bc1d69575b7ed8861adefaeb9f

tech-stack:
  added: []
  patterns:
    - "A form's save confirmation is a hook over react-hook-form's watch: saved only after an ok result, a note for no changes, cleared on any change and on failure"
    - "A just-created record's confirmation is passed by id and set in an effect after its form mounts, so the polite region announces it"
    - "Focus after a create returns through a pending-focus state that an effect resolves once the add control is back on the page"
    - "A calendar date stored as a datetime: the form holds the UTC date part, compares date parts, and converts only a submitted value to 00:00 UTC"

key-files:
  created:
    - apps/csrm/src/features/assessments/assessment-domain.test.ts
    - apps/csrm/src/features/assessments/use-record-save-status.ts
  modified:
    - apps/csrm/src/features/assessments/assessment-domain.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/components/csrm/save-status.tsx
    - apps/csrm/src/features/assessments/risk-editor.tsx
    - apps/csrm/src/features/assessments/control-implementation-editor.tsx
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/src/features/risks/risk-detail-editor.tsx
    - apps/csrm/src/features/risks/mitigation-control-list.tsx
    - apps/csrm/src/features/risks/risk-details.tsx
    - apps/csrm/src/components/csrm/save-status.test.tsx
    - apps/csrm/src/features/assessments/assessment-editor.test.tsx
    - apps/csrm/src/features/assessments/assessment-actions.test.ts
    - apps/csrm/src/features/risks/risk-details.test.tsx
    - apps/csrm/e2e/assessment-release-workflow.spec.ts

key-decisions:
  - "10-20: the control owner uses searchActiveUsersAction, the active-user search both pages already pass for the Risk and treatment owners; no new operation or grant"
  - "10-20: a confirmation's time is the moment the ok result reaches the browser, rendered through LocalInstant style time"
  - "10-20: a new record's added-at confirmation is set after its form mounts, so the polite region announces it instead of arriving already filled"
  - "10-20: the Risk Register card takes its control owner from the saved control implementation's controlOwner; editing a mitigation control needs both the page's options and its owner search"
  - "10-20: the exemption review date form value is the stored instant's UTC date (an offset value reads as its UTC date); an empty field saves null"

patterns-established:
  - "useRecordSaveStatus(watch, addedAt?) for any form that saves in place and confirms beside its Save button (X-1)"
  - "Action rows carry data-slot=\"form-actions\": flex-col below 640px, a row from sm, with SaveStatus after the buttons"

requirements-completed: [ASSESS-06]

coverage:
  - id: D1
    description: "In both editors the exemption review date is a date input with no UTC hint; a stored value shows its UTC date; a chosen date saves at 00:00 UTC; clearing saves null; an untouched legacy value is never resent (D-32, UAT-009)"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-domain.test.ts#the exemption review date as a calendar date (D-32)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#enters the exemption review date as a date like every other, with no UTC hint (D-32, UI-SPEC §13.3)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#keeps an untouched legacy exemption review date exactly as it was (D-32)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#saves a chosen exemption review date at 00:00 UTC and a cleared one as no date (D-32)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#enters the exemption review date as a date and keeps an untouched value as it was (D-32, UI-SPEC §13.3)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#saves a chosen exemption review date at 00:00 UTC and a cleared one as no date (D-32)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An invalid exemption review date reads Enter a valid exemption review date. (UI-SPEC §13.3)"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-actions.test.ts#states the length limit of Risk text and asks for a valid exemption review date (UI-SPEC §13.3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "In both editors Control owner is an OwnerCombobox over the active-user search, seeded from the served owner, submitting the chosen id; the Risk Register card names the owner from the response (D-28, UAT-034)"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#seeds the control owner from the served owner and chooses any active user by search (D-28, UAT-034)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#hands the page’s owner search to every Control owner picker, never a list of names already on the Risk"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#chooses any active user as the control owner and names the card from the response (D-28, UAT-034)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts (E11 owner part, desktop)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Saving a Risk, a mitigation control or the assessment details confirms in the action row with the local time in a polite region, clears on the next change and on failure; No changes to save. is a note in the same region; failures keep Risk not saved, Mitigation control not changed and Assessment not saved (D-33, X-1)"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/csrm/save-status.test.tsx#a note shows its plain message in the same polite region, with no icon (UI-SPEC §13.4)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#confirms a saved Risk beside Save risk with the local time, and clears it on the next change"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#keeps the Risk not saved alert and shows no confirmation when a save fails"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#confirms a saved mitigation control beside its Save button, clears it on the next change, and clears it on failure"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#confirms saved assessment details beside Save assessment, and keeps Assessment not saved on failure"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS06_RISK_SAVE_CONFIRMED (desktop)"
        status: pass
    human_judgment: false
  - id: D5
    description: "After a create, the new Risk's card shows Risk added at {time} with focus on Add Risk, and the new control's form shows Mitigation control added at {time} with focus on that Risk's Add mitigation control (UI-SPEC §13.4, UI-D18)"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#confirms an added Risk on its new card and returns focus to Add Risk (UI-SPEC §13.4)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#confirms an added mitigation control on its form and returns focus to that Risk’s Add mitigation control"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS06_CONTROL_ADD_CONFIRMED (desktop)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Risk Register keeps Risk changes saved., Mitigation control changes saved., Mitigation control added. and Mitigation control removed. (D-33), and its journey still passes with the owner combobox in the mitigation form"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#adds, edits, and removes contextual mitigation controls with authoritative feedback"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts (desktop and mobile)"
        status: pass
    human_judgment: false
  - id: D7
    description: "At 375 each save confirmation sits below its Save button and wraps; at 1440 it sits beside the button in the action row (the must-have's backstop)"
    verification: []
    human_judgment: true
    rationale: "The plan records the 375 and 1440 confirmation check for plan 10-23's browser walkthrough; the release journey drives the editor at 1440 only after the readiness checks and asserts the confirmation's text, not its placement."

duration: 22min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 20: Exemption Date, Control Owner Search and Save Confirmations Summary

**Analysts now enter the exemption review date with the same date field as every other date in both editors. It is saved at 00:00 UTC, and an old value with a time of day is never resent unless the analyst changes it. They choose any active user as the control owner through the owner search, in both editors. Every save in the assessment editor now confirms beside its Save button with the local time (`Risk saved at 3:47 pm`). A new Risk or control confirms on its own card, and focus returns to the add control that opened it.**

## Performance

- **Duration:** about 22 min
- **Started:** 2026-10-02T12:07:52Z
- **Completed:** 2026-10-02T12:29:42Z
- **Tasks:** 3. Task 1 was the tracer. Tasks 1 and 2 each went RED then GREEN.
- **Files modified:** 16 (2 new).

## Accomplishments

- **Exemption review date (D-32, UI-SPEC §13.3, UAT-009).**
  - **Helpers:** `exemptionReviewDateFormValue` and `exemptionReviewDateFromForm` are zod-free helpers in `assessment-domain.ts`, alongside `withExemptionReviewInstant`.
  - **Form value:** the field shows the stored instant's UTC date, or is empty.
  - **Saving:** a submitted value is `{date}T00:00:00.000Z`, or null when cleared.
  - **Both editors:** each seeds the date part, renders `type="date"` without the UTC hint or its `aria-describedby`, compares date parts, and converts only a submitted value. An untouched `…T13:45:00Z` is therefore never resent.
  - **Error message:** the Server Action schema reads `Enter a valid exemption review date.` The Risk Register's display already shows the UTC date, so it is unchanged.
- **Control owner (D-28, UI-SPEC §13.2, UAT-034).**
  - **Both editors:** `OwnerCombobox` labelled `Control owner` replaces the select of names already on the Risk. It searches with `searchActiveUsersAction`, which both pages already pass for the Risk and treatment owners. It is seeded from the served `controlOwner` and writes the id with `setValue`.
  - **Options type:** `ControlImplementationEditorOptions` drops `users` and gains `searchOwners`.
  - **Risk Register:** `RiskDetails` passes `searchOwners` to `MitigationControlList`. A saved card takes its owner from the response's `controlOwner`.
- **Save confirmations (D-33, X-1, UI-SPEC §13.4).**
  - **`SaveStatus`:** gains `{ kind: 'note'; message }`, a plain message in the same polite region with no icon.
  - **`useRecordSaveStatus`:** sets `saved` only after an ok result, a note for `No changes to save.`, and clears on any form change (`watch`) and on failure.
  - **Placement:** each assessment-editor form's action row (`data-slot="form-actions"`) is a column below 640px and a row from `sm`. The confirmation follows the buttons: `Risk saved at {time}`, `Mitigation control saved at {time}` or `Assessment details saved at {time}`.
  - **Removed:** the old top-of-form `role="status"` paragraphs.
  - **Failures:** each keeps its alert (`Risk not saved`, `Mitigation control not changed`, `Assessment not saved`).
- **Creates (UI-SPEC §13.4, UI-D18).**
  - **Remembered time:** `AssessmentEditor` keeps an `addedAt` time per new Risk or control id.
  - **Confirmation:** the new record's form confirms `Risk added at {time}` or `Mitigation control added at {time}` once it has mounted.
  - **Focus:** a pending-focus effect returns focus to `Add Risk`, or to that Risk's `Add mitigation control`, once the button is back.
- **Risk Register messages unchanged.** `Risk changes saved.`, `Mitigation control changes saved.`, `Mitigation control added.` and `Mitigation control removed.` still come from the page's sr-only region.
- **Journey (E11 owner part).**
  - **Owner:** `selectOwner` searches `Control owner` and chooses Jane Doe, who is read back after reload.
  - **`ASSESS06_CONTROL_ADD_CONFIRMED`:** the region shows `Mitigation control added at …`, and focus is on `Add mitigation control`.
  - **`ASSESS06_RISK_SAVE_CONFIRMED`:** each Risk form shows `Risk saved at …` before the reload.

## Task Commits

1. **Task 1 (tracer): The exemption review date is a date in both editors and round-trips as a calendar date**
   - `02740de` test (RED)
   - `3b12117` fix (GREEN)
   - Tracer gate (interactive, `end-of-phase`, automated-only verify): the verify passed on exactly the committed code (23 files, 419 tests, typecheck clean). I logged "⚡ Tracer verified end-to-end — expanding".
2. **Task 2: Any active user can be the control owner, and each assessment save confirms with its time**
   - `c88e80a` test (RED)
   - `8406045` feat (GREEN)
3. **Task 3: Prove the owner search and the save confirmations in the release journey**
   - `76b7d51` test

**Plan metadata:** the SUMMARY commit, then the STATE and ROADMAP commit.

## Tests Run

| Run | Result |
| --- | --- |
| T1 RED: domain, editor, actions and Risk Register files | 15 failed / 85 passed, each on its target: the helpers missing, the old message, the text input with its hint, and the submitted value not converted. One new guard (an untouched legacy value is not resent) passed at once, because the text input already kept the raw value. It stays as a regression guard. |
| T1 GREEN verify: `src/features/assessments`, `src/features/risks`, zod guard; typecheck | 23 files, 419 passed; typecheck clean; the acceptance grep for `YYYY-MM-DDTHH` printed nothing |
| T2 RED: `save-status.test.tsx`, `assessment-editor.test.tsx`, `risk-details.test.tsx` | 16 failed / 63 passed. The targets fail on their assertions: the note renders empty, the owner field is a `SELECT`, there is no form action row, focus is not returned, and no created form confirms. Five existing control-editor tests fail with `options.users` undefined, because the shared fixture now passes `searchOwners` instead (the planned RED for the options change). |
| T2 GREEN verify: `save-status.test.tsx`, `src/features/assessments`, `src/features/risks`, zod guard; typecheck | 24 files, 438 passed; typecheck clean |
| Shared `SaveStatus` consumers: `src/features/questionnaires`, `src/components`, `src/lib/performance` (copy guard, zod guard) | 40 files, 595 passed. The questionnaire autosave tests are unchanged and green. |
| Lint (`next typegen && tsc --noEmit`) | exit 0 |
| Playwright `assessment-release-workflow.spec.ts` (dev servers stopped) | **desktop:** 1 passed, 0 failed, 0 flaky, 0 skipped (21.1 s). The run reported 1.7 min (107 s wall). No mobile project runs this spec. |
| Playwright `risk-register-workflow.spec.ts` (extra; `mitigation-control-list.tsx` changed) | **desktop:** 1 passed (33.0 s). **mobile:** 1 passed (33.2 s). 0 failed, 0 flaky, 0 skipped. The run reported 2.5 min (149 s wall). |
| Tree after each Playwright run | Only this plan's own uncommitted spec edit and the three operator items (D-48). |
| Full web unit suite (`pnpm --dir apps/csrm test`) | 128 files, 2,720 passed, 0 failed, 69 s (2,694 before; +26) |
| Static guards | `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` is empty, and nothing under `apps/backend` or `docs` changed in this plan |

Next logged its known benign `The destination stream closed early` line 5 times in the release run and 7 times in the Risk Register run (see 10-01). The Strapi suite was not run, because this plan changes no Strapi source, spec or catalogue.

## Files Created/Modified

- `assessment-domain.ts`: `exemptionReviewDateFormValue`, `exemptionReviewDateFromForm`, `withExemptionReviewInstant`.
- `assessment-domain.test.ts` (new): the round-trip cases.
- `assessment-schema.ts`: the exemption message and its comment.
- `save-status.tsx`: the `note` state.
- `use-record-save-status.ts` (new): the confirmation hook.
- `risk-editor.tsx`: the date input, the date-part comparison, and the action row with `Risk saved at` / `Risk added at`.
- `control-implementation-editor.tsx`: `OwnerCombobox`, `searchOwners` in its options, and the action row with `Mitigation control saved at` / `added at`.
- `assessment-editor.tsx`: the owner search to each control form, `addedAt`, focus return, and `Assessment details saved at`.
- `risk-detail-editor.tsx`: the date input and the date-part comparison.
- `mitigation-control-list.tsx`: `OwnerCombobox`, the `searchOwners` prop, the edit gate, and the owner taken from the response.
- `risk-details.tsx`: passes `searchOwners`.
- Tests: `save-status.test.tsx`, `assessment-editor.test.tsx`, `assessment-actions.test.ts`, `risk-details.test.tsx`, `assessment-release-workflow.spec.ts`.

## Decisions Made

- **Owner search.** The control owner uses `searchActiveUsersAction`. Both pages already pass it for the Risk and treatment owners under the analyst grant, so no operation, grant or Strapi change was needed (T-10-53 accepted as planned).
- **Confirmation time.** It is the moment the ok result reaches the browser, shown through `LocalInstant style="time"`. The record responses carry no save timestamp. A confirmation never shows before an ok result (T-10-54).
- **Announced creates.** The added-at confirmation is set in an effect after the new form mounts. A live region inserted already filled is often not announced; one that changes after mount is.
- **Exemption form value.** A stored instant with an offset reads as its UTC date. A value that is not an instant reads as empty, so it is never resent unless the analyst enters a date.
- **Risk Register edit gate.** Editing a mitigation control needs both the page's options and its owner search, matching `RiskDetails`' existing `canEdit`. A released Risk receives neither.
- **Journey.** E11 also asserts `Selected owner: Jane Doe` before saving and after the reload, so the owner proof covers persistence, not only the search.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A shared confirmation hook in a new file**
- **Found during:** Task 2 GREEN
- **Issue:** three forms need the same confirmation behaviour: saved, note, clear on change, clear on failure, and the added-at entry. AGENTS.md keeps logic out of JSX and prefers reusable modules.
- **Fix:** I added `use-record-save-status.ts`, which is not in the plan's file list.
- **Committed in:** `8406045`

**2. [Rule 2 - Missing critical] `withExemptionReviewInstant` beside the two named helpers**
- **Found during:** Task 1 GREEN
- **Issue:** both editors must convert only a submitted exemption date, never one left out of the changed set.
- **Fix:** one zod-free helper in `assessment-domain.ts`, used by both editors.
- **Committed in:** `3b12117`

**3. [Rule 3 - Blocking] One RED assertion reworded for the acceptance grep**
- **Found during:** Task 1 acceptance check
- **Issue:** my new test asserted the absence of the literal `YYYY-MM-DDTHH`. The plan's grep over the two feature folders must print nothing.
- **Fix:** the test asserts `not.toMatch(/HH:mm/)` instead, with the same intent.
- **Committed in:** `3b12117`

**4. [Rule 1 - Bug, test] The new describe block's refresh fixture**
- **Found during:** Task 2 GREEN
- **Issue:** the shared `assessment` fixture has no Risks, so the refresh after a create removed the Risk card. The test was reading a detached node.
- **Fix:** in this block the refresh returns the Risk. The RED focus check was also tightened to wait for the created control's edit form, because the create form's submit button shares the add control's name and could pass the check too early.
- **Committed in:** `c88e80a` (tightened check), `8406045` (fixture)

**5. [Scope - verification] An extra Playwright spec**
- **Found during:** Task 3
- **Issue:** `mitigation-control-list.tsx` changed, and only the Risk Register journey drives it.
- **Fix:** I ran `risk-register-workflow.spec.ts` at desktop and mobile beside the planned release journey. It passed and needed no change.

---

**Total deviations:** 4 auto-fixed (2 Rule 3, 1 Rule 2, 1 Rule 1), plus one extra verification run.
**Impact on plan:** no scope change. No Strapi source, content type, spec, catalogue or dependency changed.

## Issues Encountered

- **Heredocs.** A Git Bash heredoc with typographic apostrophes failed again, as in 10-15, 10-18 and 10-19. All edits were made with the Edit tool instead. Nothing was committed from the failed attempt, and the scratchpad helper script was not used.
- **TDD.** `workflow.tdd_mode` is not enabled, so no `tdd-red-evidence` record was required. Each RED failed on its target assertions. The test changes made during GREEN are listed in deviations 3 and 4.

## Deferred / Handed On

- **375 and 1440 backstop:** the placement of each confirmation (below Save at 375, beside it at 1440) is recorded for plan 10-23's browser walkthrough (coverage D7).
- **Ledgers:** nothing was added to `deferred-items.md` or the windows ledger. No stub, skipped test or unrun verify remains.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **10-21 to 10-23:** can use `useRecordSaveStatus` and the `form-actions` row for any other form that saves in place.
- **Phase 18 risk table:** can reuse the exemption date helpers and the owner search wiring.

## Self-Check: PASSED

- **Files:** `assessment-domain.test.ts` and `use-record-save-status.ts` exist, and all 14 modified files exist.
- **Commits:** `02740de`, `3b12117`, `c88e80a`, `8406045` and `76b7d51` were found, each ending with the `Co-Authored-By` trailer.
- **Commit count:** `git rev-list --count 2ad2799..HEAD` = 5 before this SUMMARY.
- **Content types:** no file under `apps/backend/src/api/*/content-types/` changed.
- **Acceptance criteria:**
  - `assessment-domain.ts` exports both helpers, and the `YYYY-MM-DDTHH` grep prints nothing.
  - `control-implementation-editor.tsx` and `mitigation-control-list.tsx` contain `OwnerCombobox`.
  - `assessment-editor.tsx` contains `Assessment details saved at`, and `risk-editor.tsx` contains `Risk saved at`.
  - The spec contains `ASSESS06_CONTROL_ADD_CONFIRMED` and `ASSESS06_RISK_SAVE_CONFIRMED`, and no `selectOption({ label: 'Jane Doe' })`.
  - Every verify command exited 0.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
