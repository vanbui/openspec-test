---
phase: 10-existing-flow-gap-closure
plan: 19
subsystem: ui
tags: [record-picker, combobox, relation-picker, risk-register, assessment-editor, d-28, d-30, d-31, d-36, uat-010]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-18 RelationPicker, searchControlsAction, the picker Risk Type list's applicableControls and applicableControlGroup; 10-15 the served Risk list (AssessmentRiskListItem) and the bounded controlSummary on control implementation responses"
provides:
  - "The assessment editor's Information system impacted and Information asset impacted fields as RelationPicker, with the request's selections first under On this request"
  - "RiskEditorOptions with requestSystems, requestAssets, relationLabels, searchSystems and searchAssets in place of the option lists"
  - "RiskDetailsOptions with requestSystems, requestAssets, searchControls, searchSystems and searchAssets in place of controls, systems and assets"
  - "The Risk Register's system, asset and Control pickers, the control label on the mitigation card, and the UI-SPEC §13.5 copy"
  - "Zod-free helpers in assessment-domain.ts: requestRelationGroup, selectedRelationItem, relationLabelsFromRiskList, inventoryPickerPageSize, controlPickerPageSize"
  - "RiskDetailsContent exported from the Risk detail route, with request-first suggestions that degrade to search only"
  - "Journey proof ASSESS06_SYSTEM_PAST_FIRST_PAGE and E16"
affects: [10-20, 10-21, 10-22, 10-23, phase-18-risk-table]

actuals:
  tokens: 25948
  tasks: 3
  commits: 5
plan_head_before: 46e2c3847efbdf1f1f5d403908d03e51515e7c01
plan_head_after: 1c8ef2df857ceaa68cc50b257d20acf888247060

tech-stack:
  added: []
  patterns:
    - "A picker's selected record keeps its name from a served label (the Risk list, the Risk's own relation, or a record chosen by search); an unknown id reads Name not available"
    - "The editor's label map grows with every record chosen by search, so an editor remounted after a save keeps the name"
    - "Optional suggestion reads on a Server Component page are wrapped so any failure yields no suggestions and never blocks the record"

key-files:
  created: []
  modified:
    - apps/csrm/src/features/assessments/risk-editor.tsx
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/src/features/assessments/assessment-domain.ts
    - apps/csrm/src/features/assessments/control-implementation-editor.tsx
    - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
    - apps/csrm/src/features/risks/risk-detail-editor.tsx
    - apps/csrm/src/features/risks/mitigation-control-list.tsx
    - apps/csrm/src/features/risks/risk-details.tsx
    - apps/csrm/app/(app)/app/risks/[documentId]/page.tsx
    - apps/csrm/src/features/assessments/assessment-editor.test.tsx
    - apps/csrm/src/features/risks/risk-details.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/risk-register-workflow.spec.ts

key-decisions:
  - "10-19: the review page reads the served Risk list for every assessment (it names the Risks' systems and assets) and reads the originating request only while the assessment can change, because a released assessment shows no picker"
  - "10-19: the Risk Register reads the Risk's analyst assessment and then its request only for a mutable Risk; any refusal, failure or thrown error leaves no suggestions and the editor searches only"
  - "10-19: a record chosen by search reports its name to the assessment editor (onRelationChosen), so the editor of a newly added Risk keeps the name after the refresh remounts it"
  - "10-19: a saved Risk Register mitigation card takes its control from the response's controlSummary, else from the current control only while the choice is unchanged; otherwise the form reads The selected control is no longer available. Choose another control."
  - "10-19: the Risk Register's Control picker suggests the applicable controls of the Risk's current Risk Type (risk-details.tsx passes riskTypeId), so the group follows a saved Risk Type change"
  - "10-19: the relation label map is a plain object, because the RSC serializer refuses null-prototype objects passed to a Client Component"

patterns-established:
  - "RiskEditorOptions and RiskDetailsOptions carry the search Server Actions, so tests pass fakes and no editor imports an action for search"
  - "Both editors' system and asset pickers share the copy, the 25-row page size (inventoryPickerPageSize) and the On this request group (requestRelationGroup)"

requirements-completed: [ASSESS-06, UX-06]

coverage:
  - id: D1
    description: "In the assessment editor, Information system impacted and Information asset impacted are record pickers: the request's selections first under On this request, a server search with Other information systems/assets, the full-page and no-match lines, the selected line from the request, the served Risk list or Name not available, and a save that sends only the changed id"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#offers the request’s systems first and searches the whole inventory for the rest (D-28, D-30, UI-SPEC §13.1)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#says when a system or asset search fills its page or finds nothing (UI-SPEC §13.1)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#names the chosen system and asset from the request, then the served Risk list, never an id (D-30)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#chooses a system found by typing and saves only that change (D-28)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#keeps a searched system’s name after adding a Risk refreshes the editor (D-30)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts (desktop)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The review page reads the request and the served Risk list instead of the 25-row inventory pages, passes the two search actions, and stays zod-free in the browser"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#reads the request and the served Risk list for the system and asset pickers, never an inventory page (D-28, D-30)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/zod-client-boundary.test.ts"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/metadata/record-route-titles.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Risk Register's Risk edit form uses the same system and asset pickers, labelled by the Risk's served relations, with the request group when it was read and search only when it was not"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#picks the impacted system and asset from the request first, labelled by the Risk’s served relations (D-28, D-30)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#searches only, with no group label, when the request’s selections could not be read (research Open Question 2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Risk Register's mitigation control uses the Control picker: focus on open, the Risk Type's applicable controls first, whole-library search, Choose a control., the control label on the card heading and Control row, and the UI-SPEC §13.5 empty, remove and unavailable copy"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#opens the mitigation form on its Control picker with the Risk Type’s applicable controls first (D-31, UI-SPEC §13.1)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#searches the whole control library and names the new card from the served summary (D-29, D-36)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#asks for a control before saving a mitigation control (UI-SPEC §13.1)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#says when a saved control can no longer be named (UI-SPEC §13.5)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#adds, edits, and removes contextual mitigation controls with authoritative feedback"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts (E16, desktop and mobile)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Risk detail route reads the Risk's assessment and then its request for a mutable Risk only, degrades to no suggestions on any failure, and no longer loads the control library or the inventory pages"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#the Risk detail route’s pickers (D-28, D-30)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A system past the first 25 is found by typing in the Risk Register editor (ASSESS06_SYSTEM_PAST_FIRST_PAGE), with its own 26-system CSV fixture, and the discarded edit leaves the shared Risk unchanged"
    requirement: ASSESS-06
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts#ASSESS06_SYSTEM_PAST_FIRST_PAGE (desktop and mobile)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The three editor files show no internal term (copy guard)"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts#src/features/risks/mitigation-control-list.tsx shows no internal term"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts#src/features/assessments/risk-editor.tsx shows no internal term"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts#src/features/risks/risk-detail-editor.tsx shows no internal term"
        status: pass
    human_judgment: false
  - id: D8
    description: "At 375 the system, asset and control pickers are full width with wrapping options and no viewport overflow; at 1440 they sit in the editors' existing field layout (the must-have's backstop)"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts (mobile project at 375: the picker proof and the detail geometry sweep)"
        status: pass
    human_judgment: true
    rationale: "The plan records the 375 and 1440 picker check for plan 10-23's browser walkthrough; the mobile journey uses the picker at 375 but no assertion measures its open list against the viewport."

duration: 24min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 19: System, Asset and Control Pickers in Both Editors Summary

**In the assessment editor and the Risk Register, Information system impacted, Information asset impacted and the mitigation Control are now record pickers that search the whole inventory or library on the server. The originating request's systems and assets come first under `On this request`, and the Risk Type's applicable controls come first in the Control picker. A chosen record keeps its served name, never its id. Neither page loads the control library or a 25-row inventory page any more. A journey proof imports 26 systems and finds the 26th by typing.**

## Performance

- **Duration:** about 24 min
- **Started:** 2026-10-02T11:35:51Z
- **Completed:** 2026-10-02T11:59:19Z
- **Tasks:** 3. Task 1 was the tracer; Tasks 1 and 2 each went RED then GREEN.
- **Files modified:** 13, none new.

## Accomplishments

- **Assessment editor (D-28, D-30; UI-SPEC §13.1).**
  - **Fields:** `RiskEditor` renders `Information system impacted` and `Information asset impacted` as `RelationPicker`s with the §13.1 hints, groups, searching, no-match and full-page copy. Their page size is 25 (`inventoryPickerPageSize`, the selector's page).
  - **Selected line:** comes from the request's selection, then the served label map, else `Name not available` (`selectedRelationItem`).
  - **Saving:** writes the value with `setValue(…, { shouldDirty: true })`, so a save sends only the changed id.
  - **Chosen by search:** a record chosen by search joins the editor's label map, so a new Risk's editor keeps the name after the refresh remounts it.
  - **Released view:** the read-only fallback names relations from the request and the label map.
- **Review page.**
  - **Removed:** the reads of `listInformationSystems` and `listInformationAssets`.
  - **Reads:** the Risk Types and the served Risk list (`listAssessmentRisks`) for every assessment, and the request (`getRequest`) only while the assessment can change.
  - **Passes:** `requestSystems`, `requestAssets`, `relationLabels` (`relationLabelsFromRiskList`), `searchInformationSystemsAction` and `searchInformationAssetsAction`.
  - **Failures:** a 403 from any of these reads shows the permission state, and any other failure shows the error state.
- **Risk Register editor.**
  - **Options:** `RiskDetailsOptions` now carries the suggestions and three search functions.
  - **Risk edit form:** the same system and asset pickers, seeded from the Risk's served relations. After a save, the detail is named from the chosen item.
- **Mitigation control (D-29, D-31, D-36, D-38).**
  - **Picker:** the search input and the native select are gone. The `Control` picker receives focus when the form opens and lists `Applicable to {Risk Type name}` first. Typing searches the whole library through `searchControlsAction`.
  - **Required control:** saving with no control shows `Choose a control.` (`chooseRelationMessage`).
  - **Card:** the heading and the `Control` row read `controlLabel`. Because `RiskDetailControl` has no framework, an untitled control reads as its number. After a save, the card is built from the response's `controlSummary`.
  - **§13.5 copy:** the empty state, the remove dialog and `The selected control is no longer available. Choose another control.`.
- **Risk detail route.**
  - **Exported:** `RiskDetailsContent`.
  - **Removed:** the reads of `listControls`, `listInformationSystems` and `listInformationAssets`, and the merged lists.
  - **Suggestions:** for a mutable Risk only, the route reads the Risk's analyst assessment and then its request. Any refusal, failure or thrown error leaves the suggestions empty.
  - **Passes:** the three search actions.
- **Guard and journey.**
  - **Copy guard:** `mitigation-control-list.tsx` joined it. `risk-editor.tsx` and `risk-detail-editor.tsx` were already listed.
  - **E16:** expects focus on `combobox { name: 'Control', exact: true }`.
  - **`ASSESS06_SYSTEM_PAST_FIRST_PAGE`:** imports 26 `Picker proof {suffix} NN` systems through the CSV import. It shows that the prefix fills one 25-row page without the 26th, then finds the 26th by typing and chooses it. It asserts `Selected system: …` and reloads without saving.

## Task Commits

1. **Task 1 (tracer): The assessment editor finds any system or asset by typing, with the request's own first**
   - `81b570b` test (RED)
   - `48a45fc` feat (GREEN)
   - Tracer gate (interactive, end-of-phase, automated-only verify): the verify passed on exactly the committed code (295 tests, typecheck clean). I logged "⚡ Tracer verified end-to-end — expanding".
2. **Task 2: The Risk Register editor uses the same pickers, request-first where it can**
   - `57a6419` test (RED)
   - `733cec0` feat (GREEN)
3. **Task 3: Guard the editors' copy, then prove E16 and a record past the first page**
   - `1c8ef2d` test

**Plan metadata:** the SUMMARY commit, then the STATE and ROADMAP commit.

## Tests Run

| Run | Result |
| --- | --- |
| T1 RED, `assessment-editor.test.tsx` | 13 failed / 22 passed. Six target tests fail on their assertions: no combobox, no picker option, no selected line, the route still reading the inventory, and no released fallback name. Six existing RiskEditor tests fail with `options.systems` undefined, because the shared fixture moved to the new props (the planned RED for a prop rename). |
| T1 GREEN, `src/features/assessments`, route titles, zod guard | 15 files, 295 passed; typecheck clean |
| T2 RED, `risk-details.test.tsx` | 14 failed / 5 passed. The targets fail on their assertions: the `Control` row, the empty copy, and the page still reading the library. The rest fail through the removed `options.systems` and `options.controls`, or because `RiskDetailsContent` is not yet exported. |
| T2 GREEN, `risk-details.test.tsx` | 19 passed |
| T2 verify, `src/features/risks`, `src/features/assessments`, zod guard | 22 files, 406 passed; typecheck clean |
| Copy guard (`interface-copy-guard.test.ts`) | 45 passed (44 before, plus the new file) |
| Playwright (`risk-register-workflow.spec.ts`, `assessment-release-workflow.spec.ts`), dev servers stopped | **desktop:** 2 passed, 0 failed, 0 flaky, 0 skipped (release 22.0 s, Risk Register 34.1 s). **mobile:** 1 passed, 0 failed, 0 flaky, 0 skipped (Risk Register 34.7 s). The run took 3.1 min (191 s wall clock). Next logged the known benign `The destination stream closed early` 14 times (see 10-01). Afterwards the tree held only this plan's edits (D-48). |
| Typecheck after the spec edit (covers `e2e/`) | exit 0 |
| Full web unit suite (`pnpm --dir apps/csrm test`) | 127 files, 2,694 passed, 0 failed, 72 s |

The Strapi suite was not run: this plan changes no Strapi source, spec or catalogue.

## Files Created/Modified

- `apps/csrm/src/features/assessments/risk-editor.tsx`: the system and asset pickers, `RiskEditorOptions`, `onRelationChosen`.
- `apps/csrm/src/features/assessments/assessment-editor.tsx`: the new props, the growing label map, `unavailableSearch`, and the released fallback names.
- `apps/csrm/src/features/assessments/assessment-domain.ts`: `inventoryPickerPageSize`, `controlPickerPageSize`, `relationNameNotAvailable`, `requestRelationGroup`, `selectedRelationItem`, `relationLabelsFromRiskList`.
- `apps/csrm/src/features/assessments/control-implementation-editor.tsx`: `controlSearchPageSize` now comes from `controlPickerPageSize`.
- `apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx`: the request and Risk list reads and the two search actions.
- `apps/csrm/src/features/risks/risk-detail-editor.tsx`: `RiskDetailsOptions`, the system and asset pickers, and merging from the chosen items.
- `apps/csrm/src/features/risks/mitigation-control-list.tsx`: the Control picker, focus on open, `Choose a control.`, the control label, the §13.5 copy, and the summary-first merge.
- `apps/csrm/src/features/risks/risk-details.tsx`: passes `riskTypeId` to the mitigation list.
- `apps/csrm/app/(app)/app/risks/[documentId]/page.tsx`: `RiskDetailsContent` exported, `readRequestSelections`, and the three search actions.
- Tests: `assessment-editor.test.tsx`, `risk-details.test.tsx` (including the new route block), `interface-copy-guard.test.ts`, `risk-register-workflow.spec.ts`.

## Decisions Made

- **Request read only when it matters.** The review page reads the request only while the assessment can change, because a released assessment has no picker. It reads the Risk list for every assessment, because the Risk list names each Risk's system and asset.
- **Search travels in options.** `searchSystems` and `searchAssets` sit in `RiskEditorOptions`, beside the suggestions, so one object serves `RiskEditor` and the tests. `AssessmentEditor` takes them as props with an "unavailable" default, as 10-18 did for controls.
- **Names chosen by search persist.** `onRelationChosen` adds a searched record's name to the editor's label map, so the edit form of a newly added Risk still names the system after the refresh remounts it.
- **Risk Register suggestions.** For a mutable Risk, the page reads the analyst assessment and then its request (research Open Question 2). It wraps both reads, so a refusal, an error result or a thrown error all leave the editor searching only, and nothing is shown. A released Risk reads neither.
- **Mitigation merge.** The card takes the response's `controlSummary`, else the current control only when the control id is unchanged. A changed choice is never shown under the old control's name. With neither, the form shows the §13.5 unavailable message.
- **Focus.** The Risk Register's Control picker takes focus whenever its form opens, in create and edit mode alike, matching the old search input's `autoFocus`.
- **Required control.** It is checked in `submit` with `chooseRelationMessage('control')`, so the copy keeps 10-18's single source. A comment names `Choose a control.` for the plan's grep.
- **Plain label map.** The map is a plain object: React's RSC serializer refuses null-prototype objects passed to a Client Component.
- **Stronger journey proof.** It also asserts that the prefix search fills one 25-row page and leaves out the 26th, so it proves the bound and not only the final match.
- **Extra Playwright spec.** The release journey ran beside the Risk Register journey, because this plan changed the review page's reads and the Risk form it drives.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The zod-free helpers and page sizes live in `assessment-domain.ts`**
- **Found during:** Task 1 GREEN and Task 2 GREEN
- **Issue:** AGENTS.md keeps domain logic out of JSX, and both editors need the same group, selected-item and label-map helpers. `assessment-domain.ts` is not in the plan's file list, and `controlSearchPageSize` lived in a client editor module the Risk Register should not import.
- **Fix:** I added the helpers and both page-size constants to `assessment-domain.ts`. `control-implementation-editor.tsx` re-exports its constant from the domain value.
- **Files modified:** `assessment-domain.ts`, `control-implementation-editor.tsx`
- **Committed in:** `48a45fc`, `733cec0`

**2. [Rule 2 - Missing critical] `risk-details.tsx` passes the Risk Type to the mitigation list**
- **Found during:** Task 2 GREEN
- **Issue:** the plan expected `risk-details.tsx` to stay untouched. The Control picker's suggested group needs the Risk's current Risk Type, and only `risk-details.tsx` holds the updated detail after a Risk Type edit.
- **Fix:** one prop, `riskTypeId={current.riskType?.documentId ?? null}`.
- **Committed in:** `733cec0`

**3. [Rule 1 - Bug] A changed control with no served summary could be named as the old control**
- **Found during:** Task 2 GREEN
- **Issue:** the plan's rule was "the summary, else the current control". After an edit that changed the control, that rule would label the new id with the old control's name.
- **Fix:** the current control is used only while the control id is unchanged. Otherwise the form shows the §13.5 message.
- **Committed in:** `733cec0`

**4. [Rule 3 - Blocking] The route test needs the page function**
- **Found during:** Task 2 RED
- **Issue:** proving the degraded page needs the Server Component's content function.
- **Fix:** `RiskDetailsContent` is exported, as the review page already exports `AssessmentEditorContent`. The test inspects the returned element's `options`.
- **Committed in:** `57a6419` (test), `733cec0` (export)

**5. [Rule 3 - Blocking] I removed a duplicate test I had introduced while editing**
- **Found during:** Task 1 RED
- **Issue:** while splitting the route source assertions I created a duplicate `it` block.
- **Fix:** I removed it before the RED commit, so the existing assertions remain exactly once.
- **Committed in:** `81b570b`

---

**Total deviations:** 5 auto-fixed (3 Rule 3, 1 Rule 2, 1 Rule 1).
**Impact on plan:** no scope change. No Strapi source, content type, spec, catalogue or dependency changed. The guard needed only one new file, because 10-13/10-14 had already added the other two.

## Issues Encountered

- **Heredocs.** A Git Bash heredoc holding the Python edit script failed on its quotes, as in 10-15 and 10-18. The scripts were written to the scratchpad with the Write tool. Nothing was committed from the failed attempt.
- **TDD.** `workflow.tdd_mode` is not enabled, so no `tdd-red-evidence` record was required. Each RED failed on its target assertions. Tests that rely on the shared fixture failed through the prop rename, as the planned RED for an interface change.

## Deferred / Handed On

- **375 and 1440 backstop:** the picker's visual check at both widths is recorded for 10-23's browser walkthrough (coverage D8). The mobile journey already drives the system picker at 375.
- **Control owner:** the Risk Register's `Control owner` select moves to `OwnerCombobox` in 10-20, as 10-18 recorded.
- **Exemption review date:** still the text input with the UTC hint in both editors (UI-SPEC §13.3, a later plan).
- **Ledgers:** nothing was added to `deferred-items.md` or the windows ledger. No stub, skipped test or unrun verify remains. `Name not available` is the deliberate §16.4 fallback, not a stub.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **10-20:** can add `OwnerCombobox` for `Control owner` in `mitigation-control-list.tsx` beside the new `Control` picker. `options.users` is unchanged.
- **Phase 18 risk table:** can reuse `requestRelationGroup`, `selectedRelationItem` and the editors' options shape.

## Self-Check: PASSED

- **Files:** all 13 modified files exist.
- **Commits:** `81b570b`, `48a45fc`, `57a6419`, `733cec0` and `1c8ef2d` were found, each ending with the `Co-Authored-By` trailer.
- **Commit count:** `git rev-list --count 46e2c38..HEAD` = 5 before this SUMMARY.
- **Content types:** no file under `apps/backend/src/api/*/content-types/` changed.
- **Acceptance criteria:**
  - The review page and the Risk page name none of `listControls`, `listInformationSystems` or `listInformationAssets`.
  - `risk-editor.tsx` has `Systems selected on the request come first.` and `RelationPicker`.
  - `mitigation-control-list.tsx` has `RelationPicker`, `The control stays in the library.` and `Choose a control.`, and no `Search reusable Controls`.
  - The Risk page has `getRequest`.
  - The spec has `ASSESS06_SYSTEM_PAST_FIRST_PAGE` and no `Search reusable Controls`.
  - The guard lists all three editor files.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
