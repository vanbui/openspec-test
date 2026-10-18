---
phase: 10-existing-flow-gap-closure
plan: 18
subsystem: ui, api
tags: [strapi, openapi, zod, record-picker, combobox, control-label, assessment-editor, d-28, d-29, d-31, d-36]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-15 controlLabel and the bounded controlSummary on control implementations; 10-17 the seeded APP titles and searchApplicableControlsAction over listAdministrationControls; 10-02 the interface copy guard"
provides:
  - "RiskTypeApplicableControl and the required RiskTypeSummary.applicableControls (maxItems 1000) on the picker's GET /v1/risk_types list (D-03 item 7)"
  - "RelationPicker, RelationPickerItem, RelationPickerSearchResult and RelationPickerGroup (apps/csrm/src/components/csrm/relation-picker.tsx): the zod-free X-2 record picker that 10-19 and 10-20 reuse"
  - "controlPickerItem in control-label.ts and applicableControlGroup in assessment-domain.ts"
  - "searchControlsAction in assessment-actions.ts: one page of 10 through listAdministrationControls"
  - "chooseRelationMessage in validation-messages.ts (replaces selectRelationMessage)"
  - "The assessment editor's Control picker: applicable controls first, whole-library search, served-summary label, focus on open; the review page no longer loads the control library"
affects: [10-19, 10-20, 10-21, 10-22, 10-23, phase-18-risk-table]

actuals:
  tokens: 26328
  tasks: 3
  commits: 6
plan_head_before: dc85f17404e77e00d7ebf54408f9655824636744
plan_head_after: 45956a1bc4a8da65e337f61b28cd7a64f437c8fb

tech-stack:
  added: []
  patterns:
    - "A record picker takes a suggested group and a server search; the browser filters the suggestions, the server pages the rest, and an item is listed once"
    - "An option's accessible name is its label (aria-label) and its second line is its description (aria-describedby), so journeys match the label exactly"
    - "The picker keeps its search function in a ref, so a parent passing an inline function never restarts the debounce"
    - "A picker Risk Type list projects each applicable control through the same bounded summary as a control implementation's controlSummary"

key-files:
  created:
    - apps/csrm/src/components/csrm/relation-picker.tsx
    - apps/csrm/src/components/csrm/relation-picker.test.tsx
  modified:
    - apps/backend/src/api/csrm-risk/services/risk-workflow.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/features/risks/risk-schema.ts
    - apps/csrm/src/features/risks/risk-schema.test.ts
    - apps/csrm/src/lib/schemas/validation-messages.ts
    - apps/csrm/src/features/assessments/control-label.ts
    - apps/csrm/src/features/assessments/control-label.test.ts
    - apps/csrm/src/features/assessments/assessment-domain.ts
    - apps/csrm/src/features/assessments/assessment-actions.ts
    - apps/csrm/src/features/assessments/assessment-actions.test.ts
    - apps/csrm/src/features/assessments/control-implementation-editor.tsx
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/src/features/assessments/assessment-editor.test.tsx
    - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/assessment-release-workflow.spec.ts
    - apps/csrm/e2e/accessibility.spec.ts

key-decisions:
  - "10-18: RelationPicker is built on the shadcn Input and Popover; options are buttons with role option and tabIndex -1, named by aria-label and described by their second line, so focus never leaves the input"
  - "10-18: plain ArrowDown on a closed picker opens it on the first option; Alt+ArrowDown opens it without moving (WAI-ARIA combobox); Enter is always prevented"
  - "10-18: the server group is labelled Other controls only while a suggested group is shown above it; with no suggestions it has no label"
  - "10-18: applicableControlGroup lives in the zod-free assessment-domain.ts, so the editor composes each Risk's suggested group without domain logic in JSX"
  - "10-18: the server leaves out an applicable control whose fields fall outside 1-255 rather than serving it partially, sorts by control number and caps the list at 1,000"
  - "10-18: the assessment-schema RiskTypeApplicableControl parser is the 10-15 control summary object (identical bounds); risk-schema declares its own copy so the Risk Register module does not import the assessment module"
  - "10-18: the editor's default control search, when no page action is passed, reports the selection service as unavailable rather than returning an empty page"

patterns-established:
  - "RelationPicker({ label, hint, noun, value, onValueChange, search, pageSize, suggested?, otherGroupLabel, searchingText, noMatchText, errorId?, invalid?, inputRef? }) is the single-record picker for 10-19 (systems, assets, the Risk Register) and 10-20"
  - "A required relation's message is chooseRelationMessage(relation): Choose a control."

requirements-completed: [ASSESS-06, UX-06]

coverage:
  - id: D1
    description: "The picker's Risk Type list carries each Risk Type's bounded applicable-control summary (documentId, controlNumber, name, framework) through Strapi, the spec, the generated client and both closed parsers; a query still serves the Administration page"
    requirement: ASSESS-06
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted picker Risk Type list names each Risk Type's applicable controls for the control picker (D-31)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted contextual Risk routes cover the frozen writable surface and bounded references"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-service.test.ts#the picker Risk Type list carries bounded applicable controls (D-31, D-02)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "RelationPicker: combobox semantics, suggested group first, open on typing, ArrowDown, Alt+ArrowDown or a pointer press and never on Tab, Enter never submits, Escape clears, selected line with Clear, debounced server search with stale-response guard, full-page, no-match and Retry search states; zod-free"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/csrm/relation-picker.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/zod-client-boundary.test.ts#/app/review/assessments/{documentId} downloads no zod: no client module it renders imports it"
        status: pass
    human_judgment: false
  - id: D3
    description: "The assessment editor's mitigation Control field is the picker (never a native select): Applicable to {Risk Type name} first, the choice read from the served control summary or Control not found, focus on Add mitigation control, Choose a control. under the picker, the new remove dialog copy; the page loads no control library"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/control-label.test.ts#a control as a record picker item (D-36, UI-SPEC §16.2)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS06_APPLICABLE_CONTROLS_FIRST"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS06_CONTROL_PICKED_BY_TYPING"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS07_CONTROL_NAMED_BY_NUMBER_AND_TITLE"
        status: pass
    human_judgment: false
  - id: D4
    description: "searchControlsAction searches the whole library by number, name or framework, one page of 10, labelled by controlPickerItem, with plain permission and unavailable messages and no call for invalid input"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-actions.test.ts#control search for the Control picker (D-29, UI-SPEC §13.1)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/security/server-only-boundary.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The picker and the control editor carry no internal term (copy guard)"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts#src/components/csrm/relation-picker.tsx shows no internal term"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts#src/features/assessments/control-implementation-editor.tsx shows no internal term"
        status: pass
    human_judgment: false
  - id: D6
    description: "At 375 the Control picker is full width, its options wrap and its list never overflows the viewport; at 1440 it sits in the editor's two-column field grid (the must-have's backstop)"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/accessibility.spec.ts#focus is never obscured and text reflows"
        status: pass
    human_judgment: true
    rationale: "The plan records the 375 and 1440 picker check for plan 10-23's browser walkthrough; no automated assertion opens the picker's list at 375."

duration: 47min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 18: Control Record Picker Summary

**The assessment editor's mitigation control is now a searchable record picker. The Risk Type's applicable controls come first under `Applicable to {Risk Type name}`, and typing searches the whole library on the server, 10 rows at a time. The picker's Risk Type list carries a bounded applicable-control summary through Strapi, the spec and both closed parsers, and the review page no longer loads the 2,646-control library.**

## Performance

- **Duration:** about 47 min
- **Started:** 2026-10-02T10:44:55Z
- **Completed:** 2026-10-02T11:31:33Z
- **Tasks:** 3. Task 1 was the tracer and Tasks 1 and 2 went RED then GREEN.
- **Files modified:** 24, of which 2 are new.

## Accomplishments

- **Strapi (D-31).** `listRiskTypeDocuments` populates `applicableControls` with `controlNumber`, `name` and `framework`, sorted by control number. `projectRiskTypeSummary` adds `applicableControls` through `projectControlImplementationControlSummary`, so each control has exactly four fields within 1-255 characters. The list is sorted and capped at 1,000. A query still serves the Administration page unchanged. No new route or grant was added.
- **Contract (D-02, D-03 item 7).** `RiskTypeApplicableControl` is closed with 1-255 strings. `RiskTypeSummary.applicableControls` is required with `maxItems: 1000`. The client was regenerated and `api:check` is clean.
- **Parsers.** `riskTypeSchema` reuses the 10-15 control summary object, which has the same bounds. The Risk Register picker schema in `risk-schema.ts` declares the same bounds itself, with no `.trim()`. Both pass the parity guard without grandfathering changes.
- **`RelationPicker` (X-2, D-28).**
  - **Built on:** the shadcn `Input` and `Popover`, using OwnerCombobox's 300 ms debounce and stale-response guard.
  - **Field:** the hint sits outside the `<label>` and is in `aria-describedby`, together with the error when the field is invalid.
  - **List:** `role="group"` sections with `.micro-label` headings. Each option has a name line and a `text-xs` second line, the active option uses `bg-muted` (`--color-bg-inset`), and options are `min-h-11` (44 px) below 768 px and `min-h-6` (24 px) above.
  - **Opening:** typing, ArrowDown or Alt+ArrowDown, or a pointer press opens the list. Tab never opens it, and Enter never submits the form.
  - **States:** a `Type to search controls.` prompt, `Searching controls…`, `Showing the first 10 matches. Keep typing to narrow the list.`, a no-match message, and `Retry search` after a failed search.
- **Editor.**
  - **Control field:** labelled `Control` with the UI-SPEC §13.1 hint. Its value is set with `setValue('control', …, { shouldDirty: true })`.
  - **Selected line:** comes from the served `controlSummary` through `controlPickerItem`, or reads `Control not found`.
  - **Suggested group:** each Risk's group comes from its saved Risk Type (`applicableControlGroup`).
  - **Focus and errors:** `Add mitigation control` focuses the new form's `Control` input, and the required error `Choose a control.` sits under the picker.
  - **Remove dialog:** reads `This removes the control from this Risk. The control stays in the library.`
- **Search (D-29).** `searchControlsAction` takes a trimmed, strict search of 1-200 characters. It reads one page of 10 through `listAdministrationControls(parseAdministrationQuery('controls', …))` and labels each row with `controlPickerItem`. A 403 returns `You do not have permission to search these records.`; any other failure returns `The selection service is unavailable. Please try again later.`
- **Page.** It no longer imports or calls `listControls`, and it passes `searchControls={searchControlsAction}`.
- **Journey.**
  - **E11 (control part):** the new form opens focused on the picker. The `Applicable to …` group shows (`ASSESS06_APPLICABLE_CONTROLS_FIRST`), typing `APP-11` finds and chooses `APP-11 · Security of personal information`, and after reload the form reads `Selected control: {label}` (`ASSESS06_CONTROL_PICKED_BY_TYPING`).
  - **E12:** the released view shows the number and title and matches no 24-character id.

## Task Commits

1. **Task 1 (tracer): A Risk's applicable controls come first in its mitigation control picker**
   - `7e9bc0c` test (RED)
   - `9321249` feat (GREEN), with the spec committed alongside the regenerated `schema.d.ts`
   - Tracer gate (interactive, end-of-phase, verify is automated only): after the commit, `api:check` exited 0. The web files, the mounted file and the typecheck were already green on the committed code. I logged "⚡ Tracer verified end-to-end — expanding".
2. **Task 2: Typing searches the whole control library on the server, with plain copy**
   - `be5e8a5` test (RED)
   - `4821000` feat (GREEN)
3. **Task 3: Guard the picker copy, then prove the choice end to end**
   - `4db1d6a` test: the accessibility sweep's Control heading (deviation 3)
   - `45956a1` test: E11, E12 and the copy guard

**Plan metadata:** the SUMMARY commit, then the STATE and ROADMAP commit.

## Tests Run

| Run | Result |
| --- | --- |
| T1 RED, web (picker, control label, service, editor) | `relation-picker` not found, the planned RED for a new module. 13 failed / 55 passed, each on its target: `controlPickerItem` missing, parser bounds, the strict parser refusing the new field, the native select still present, the route still calling `listControls` |
| T1 RED, mounted `assessment-workflow.integration.test.ts` | 25 tests: 20 pass, 5 fail. Two are targets (the key set, and the new picker case missing `applicableControls`); three depend on the first. 28 s |
| T1 GREEN, web (picker, `src/features/assessments`, `risk-schema.test.ts`, parity, zod guard) | 17 files, 455 passed; typecheck clean |
| T1 GREEN, mounted | 25/25 pass, 31 s; `api:check` exit 0 after the commit |
| T2 RED, web (picker, actions, editor) | 13 failed / 67 passed. Targets: `searchControlsAction` missing, `Choose a control.`, full page, no match, `Retry search`, the dialog copy, the page wiring. Five new cases passed at once because Task 1's GREEN already gave the picker its debounce, stale guard and `errorId` wiring, and the editor already accepted a search prop |
| T2 GREEN, web (picker, `src/features/assessments`, server-only boundary) | 15 files, 315 passed; typecheck clean; zod guard and parity 151 passed |
| Copy guard (`interface-copy-guard.test.ts`) | 44 passed |
| Full web unit suite (`pnpm --dir apps/csrm test`) | 127 files, 2,677 passed, 0 failed, 31.8 s |
| Full Strapi suite (`pnpm --dir apps/backend test`) | 608 tests: 608 pass, 0 fail, 0 cancelled, 0 skipped; 933 s (938 s wall clock, partly overlapping the web suite) |
| Playwright, first run (`assessment-release-workflow.spec.ts`, `accessibility.spec.ts`) | desktop: 11 passed, 1 failed, 0 flaky, 0 skipped, 310 s. The release journey passed; the analyst administration sweep failed on deviation 3 |
| Playwright, second run (same two specs) | desktop: 12 passed, 0 failed, 0 flaky, 0 skipped, 259 s (4.3 min). Next logged the known benign `The destination stream closed early` 34 times (see 10-01). The tree was unchanged afterwards (D-48) |
| Final `api:check`, `lint` (`next typegen && tsc --noEmit`) | exit 0, exit 0 |

## Files Created/Modified

- `apps/csrm/src/components/csrm/relation-picker.tsx` (new): `RelationPicker` and its types.
- `apps/csrm/src/components/csrm/relation-picker.test.tsx` (new): semantics, keyboard, selection and search states.
- `apps/backend/src/api/csrm-risk/services/risk-workflow.ts`: the applicable-control populate.
- `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts`: the `applicableControls` projection.
- `docs/references/specification.json`, `apps/csrm/src/lib/api/generated/schema.d.ts`: `RiskTypeApplicableControl` and `RiskTypeSummary.applicableControls`.
- `apps/csrm/src/features/assessments/assessment-schema.ts`, `apps/csrm/src/features/risks/risk-schema.ts`: both parsers; `chooseRelationMessage('control')`.
- `apps/csrm/src/lib/schemas/validation-messages.ts`: `chooseRelationMessage`.
- `apps/csrm/src/features/assessments/control-label.ts`: `controlPickerItem`.
- `apps/csrm/src/features/assessments/assessment-domain.ts`: `applicableControlGroup`.
- `apps/csrm/src/features/assessments/assessment-actions.ts`: `searchControlsAction`.
- `apps/csrm/src/features/assessments/control-implementation-editor.tsx`: the picker, its error and the dialog copy.
- `apps/csrm/src/features/assessments/assessment-editor.tsx`: the library prop is removed, plus per-Risk control options, `searchControls`, and focus on add.
- `apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx`: no library read; passes `searchControlsAction`.
- Tests: the mounted file, `assessment-service.test.ts`, `control-label.test.ts`, `assessment-actions.test.ts`, `assessment-editor.test.tsx`, `risk-schema.test.ts`, `interface-copy-guard.test.ts`, `assessment-release-workflow.spec.ts`, `accessibility.spec.ts`.

## Decisions Made

- **Picker primitives.** The picker uses the shadcn `Input` and `Popover`. AGENTS.md puts shadcn first; `Command`, the cmdk list, was not used because it filters on the client and owns focus, which conflicts with server paging and `aria-activedescendant`.
- **Keyboard.** A closed picker opens on ArrowDown and selects the first option; Alt+ArrowDown opens it without moving into the list. This follows the WAI-ARIA combobox pattern. Enter is always prevented, and Escape closes the list and clears the query.
- **Group labels.** The second group label shows only beneath a shown suggested group, so a search with no matching suggestions reads as one plain list.
- **Accessible names.** Each option is named by its label (`aria-label`) and described by its framework line. Journeys and tests match the label exactly, and screen readers still hear the framework.
- **Server bounds.** An applicable control outside the 1-255 bounds is left out rather than served partially, matching 10-15's rule for `controlSummary`.
- **Default search.** The editor's default search, used when the page passes none, reports the service as unavailable. It never pretends the library is empty.
- **Parser reuse.** The assessment module reuses the 10-15 summary object. The Risk Register module declares its own copy with the same bounds and does not import the assessment module.
- **Alignment with 10-17.** The picker search uses the same server route and the same `parseAdministrationQuery('controls', …)` as `searchApplicableControlsAction`. Its page size is 10 (the plan's choice) instead of 25, and it labels results with `controlPickerItem` instead of `applicableControlSearchOptions`, because it needs the second-line detail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Risk Register picker fixture needed the new required field**
- **Found during:** Task 1 GREEN (the Task 1 verify runs `risk-schema.test.ts`)
- **Issue:** the fixture for `fails every picker at cap plus one…` built Risk Types without `applicableControls`, which the closed parser now requires. The file was not in Task 1's list.
- **Fix:** the fixture gained `applicableControls: []`.
- **Files modified:** `apps/csrm/src/features/risks/risk-schema.test.ts`
- **Committed in:** `9321249`

**2. [Rule 3 - Blocking] The domain helper and a test fixture type**
- **Found during:** Task 1 GREEN
- **Issue:** each Risk's suggested group needs a zod-free helper, and AGENTS.md keeps domain logic out of JSX. `assessment-domain.ts` is not in the plan's file list. Separately, `as const` on the editor test fixture made `applicableControls` readonly, which `RiskType` refuses.
- **Fix:** `applicableControlGroup` was added to `assessment-domain.ts`. The test types its fixture as `RiskType`. That test-only edit landed in the GREEN commit, after the RED commit.
- **Committed in:** `9321249`

**3. [Rule 3 - Blocking] The accessibility sweep expected a Control heading that 10-17 changed**
- **Found during:** Task 3's first Playwright run
- **Issue:** since 10-17, the control edit page is titled by `controlLabel` (`5.1 · ISO/IEC 27001 …`) and the list's Name column reads `Not provided` for an untitled control. `firstAdministrationRecord` still built `{number} · {Name column}`, so it waited for `5.1 · Not provided`. This plan did not cause it: 10-17 changed the heading and ran only the Administration journey. It still blocked this plan's verify.
- **Fix:** the sweep now builds the label the page shows: the number, then the title, or the framework when the Name column has no title (D-36, D-42).
- **Files modified:** `apps/csrm/e2e/accessibility.spec.ts`
- **Verification:** the second Playwright run passed, 12/12.
- **Committed in:** `4db1d6a`

**4. [Rule 1 - Bug] The mounted query case used a non-canonical Administration query**
- **Found during:** Task 1 GREEN
- **Issue:** the new mounted case sent `?q=` alone. The shared route accepts only the canonical `q`, `sort`, `page` and `pageSize` set, so it returned 400 `CSRM Risk Register query is invalid.`
- **Fix:** the test sends the canonical query, and its status assertion now prints the response body.
- **Committed in:** `9321249`

---

**Total deviations:** 4 auto-fixed (3 Rule 3, 1 Rule 1).
**Impact on plan:** no scope change. No content-type file changed, no catalogue, matrix or served-operations change, and no dependency was added.

## Issues Encountered

- Inline Python heredocs with apostrophes or nested backslashes broke Git Bash parsing, as in 10-15. The edit scripts were moved to the scratchpad. Nothing was committed from a failed attempt.
- **TDD.** Each new module's RED was "module not found", the planned RED as in 10-01. Every other RED failed on its target assertion. `workflow.tdd_mode` is not enabled, so no `tdd-red-evidence` record was required.
- **Run artefacts.** The first Playwright run exited 1, so its harness kept its database and build under the ignored `.tmp` directories. I removed those two paths myself after reading the failure. No tracked file changed.

## Deferred / Handed On

- **375 and 1440 backstop.** The picker's visual check at both widths is recorded for 10-23's browser walkthrough (coverage D6).
- **Risk Register.** `mitigation-control-list.tsx` (the Risk Register's `Reusable control` select, `Search reusable Controls` and its copy) and the systems and assets pickers move to `RelationPicker` in 10-19. The `Control owner` select moves to `OwnerCombobox` in 10-20.
- **Assessment editor guard.** `assessment-editor.tsx` is still outside the copy guard. Its §17.1 strings belong to a later plan.
- Nothing was added to `deferred-items.md` or the windows ledger. No stub, skipped test or unrun verify remains.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- 10-19 can use `RelationPicker` directly. `RelationPickerItem` is `{ documentId, name, detail? }`, which matches `RelationSelection`, so the request selector actions plug in as `search`.
- 10-20 can keep `OwnerCombobox` for the control owner beside the new `Control` picker. The journey's `Control owner` step is unchanged.

## Self-Check: PASSED

- FOUND: `apps/csrm/src/components/csrm/relation-picker.tsx`, `apps/csrm/src/components/csrm/relation-picker.test.tsx`
- FOUND commits: `7e9bc0c`, `9321249`, `be5e8a5`, `4821000`, `4db1d6a`, `45956a1`, each ending with the `Co-Authored-By` trailer
- `git rev-list --count dc85f17..HEAD` = 6 before this SUMMARY. No file under `apps/backend/src/api/*/content-types/` changed.
- Acceptance criteria:
  - `RiskTypeApplicableControl` is defined, and `applicableControls` has `maxItems` 1000.
  - `relation-picker.tsx` has no zod import.
  - The page has no `listControls`.
  - The control editor has `RelationPicker`, no `Reusable control`, and `The control stays in the library.`
  - `searchControlsAction` calls `listAdministrationControls`.
  - `chooseRelationMessage` is exported, and `selectRelationMessage` is gone.
  - The journey has both `ASSESS06_` labels and no `selectOption(reusableControlValue`.
  - The guard lists both files.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
