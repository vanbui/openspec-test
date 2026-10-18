---
phase: 10-existing-flow-gap-closure
plan: 23
subsystem: testing
tags: [phase-gate, playwright, node-test, vitest, static-checks]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: plans 10-01 to 10-22 (every Phase 10 change the gate covers)
provides:
  - The Phase 10 gate on the production build at eed7ed0, all six brief commands green, with counts and durations
  - The four static boundary checks since 5ea2b77, each with empty output
  - A fix that keeps the source free of CSRM_AI_ lines changed since 5ea2b77
  - Walkthrough fixes 1 to 8, 3b, 3c and 3d, and the Fix 8 addendum, each test-first, with the gate rerun twice (green at 5ef0f88 and 4c10b43)
  - The pilot's browser checks (51 rows, all pass), the requirement coverage and the Manual-Only results, recorded verbatim
affects: [gsd-verify-work 10, Phase 10 code review and regression gates, the final Phase 10 gate, Phase 22 (the Information Asset owner)]

actuals:
  tokens: 143980
  tasks: 3
  commits: 39
plan_head_before: a2182e4b8b87e01b9c7e407c5598b3f0c694f429
plan_head_after: f51fe3dabc5dffb5b6acd79a3b5a10c5c94bc804

tech-stack:
  added: []
  patterns:
    - "A gate's static source check is part of the gate: a test that needs a pinned provider proves it through the provider's observable output, not by naming the configuration variable"

key-files:
  created:
    - .planning/phases/10-existing-flow-gap-closure/10-23-SUMMARY.md
  modified:
    - apps/backend/tests/questionnaire-governance.integration.test.ts
    - apps/backend/src/bootstrap/controls/privacy-act-app-ndb-2026-06-04.json
    - apps/backend/src/bootstrap/seed-csrm-data.ts
    - apps/backend/src/api/csrm-administration/services/served-text.ts
    - apps/backend/src/api/csrm-administration/services/administration-query.ts
    - apps/backend/src/api/csrm-administration/services/csv-import.ts
    - apps/backend/tests/control-library-bounds.unit.test.ts
    - apps/backend/tests/administration.unit.test.ts
    - apps/backend/tests/administration.integration.test.ts
    - apps/backend/tests/assessment-seed.integration.test.ts
    - apps/csrm/src/features/administration/administration-schema.test.ts
    - apps/csrm/e2e/administration-workflow.spec.ts
    - apps/backend/src/bootstrap/controls/csrm-control-titles.json
    - apps/backend/tests/control-titles.unit.test.ts
    - scripts/csrm-seed-control-files.mjs
    - scripts/verify-csrm-seed.mjs
    - scripts/verify-csrm-seed-runtime.mjs
    - package.json
    - apps/csrm/src/features/assessments/assessment-domain.ts
    - apps/csrm/src/features/assessments/assessment-domain.test.ts
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/src/features/assessments/assessment-editor.test.tsx
    - apps/csrm/src/features/assessments/risk-editor.tsx
    - apps/csrm/src/features/assessments/control-implementation-editor.tsx
    - apps/csrm/e2e/assessment-release-workflow.spec.ts
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-domain.test.ts
    - apps/csrm/src/features/assessments/assessment-detail.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/csrm/src/features/risks/risk-details.tsx
    - apps/csrm/src/features/risks/risk-details.test.tsx
    - apps/csrm/src/features/assessments/assessment-request-link.tsx
    - apps/csrm/src/features/assessments/released-assessment.test.tsx
    - apps/csrm/src/features/administration/administration-config.ts
    - apps/csrm/src/features/administration/csv-import-flow.tsx
    - apps/csrm/src/features/administration/administration-workflow.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/assessment-navigation-lifecycle.spec.ts
    - apps/csrm/src/features/risks/mitigation-control-list.tsx
    - apps/csrm/e2e/risk-register-workflow.spec.ts
    - .planning/phases/10-existing-flow-gap-closure/deferred-items.md
    - apps/csrm/src/features/administration/administration-workspace.tsx
    - apps/csrm/src/components/csrm/relation-picker.tsx
    - apps/csrm/src/components/csrm/relation-picker.test.tsx
    - apps/csrm/src/features/assessments/owner-combobox.tsx
    - apps/csrm/src/features/assessments/owner-combobox.test.tsx
    - apps/csrm/src/features/risks/risk-register-filters.tsx
    - apps/csrm/src/features/risks/risk-register.test.tsx
    - apps/csrm/e2e/accessibility.spec.ts

key-decisions:
  - "10-23: the CSRM_AI_ source check failed on a read-only assertion 10-09 added; it was replaced by a comment naming the deterministic-shape proof the test already makes, rather than widening the check (fix eed7ed0)"
  - "10-23: api:check and the schema.d.ts refresh are recorded as two steps; the refresh exits 1 only for the operator's two types/generated files, which git lists whatever pathspec is given"
  - "10-23 fix 2: APP-13 is curated at the source to its own five subclauses (2,558 characters); Schedule 2 and endnotes 1 to 5 (98,415 characters) are cut. The over-long text dates from d7fd4a0 (2026-08-08), before Phase 10"
  - "10-23 fix 2: a seeded start replaces a control description the seed wrote (the one its stored sourceData gives) or one beyond the 10,000 bound, and keeps an operator's own; other seeded fields keep the existing reconciliation"
  - "10-23 fix 2: the Controls projection and the CSV change preview bound every text field they serve, cut at a word boundary with an ellipsis, and log a warning naming the control, never its text; the web's closed parser stays strict"
  - "10-23 fix 3: 72 of 114 audited descriptive titles (41 of 51 CPS 230, 10 of 24 CPS 234, 21 of 39 PSPF) narrowed or misstated their paragraph and are corrected; the voice cap widens to 12 words and 100 characters so a title can cover every limb"
  - "10-23 fix 3: a seeded start replaces a name the seed wrote (the bare number, its stored catalogue label, or a title in the title file's supersededTitles) and keeps an operator's own, replacing 10-22's accepted overwrite (T-10-64)"
  - "10-23 fix 3: both seed verifiers read the seed's own catalogue list and title file; their stale pre-Phase 10 assumptions are fixed (root Strapi resolution, the Function map, agent grants as a subset of the analyst's), and the root verify:csrm-seed script is restored"
  - "10-23 fix 3: the 179 PSPF titles outside the audited 39 are deferred to a full audit (sample failure rate 21 of 38)"
  - "10-23 fix 1: an unchanged Save assessment sends nothing and says No changes to save. unless the assessment is drafted, where Strapi records the analyst's review on that save (D-13); the three editors share one comparison in assessment-domain"
  - "10-23 fix 4: the analyst page's Next action follows the fact its generation card uses (a submitted request); the Phase 7 fixtures' unreachable state is left as seeded and deferred, because a consistent fixture breaks its pinned invariants"
  - "10-23 fix 5: each Administration kind has a running-text noun (control, information system, information asset; Risk Type keeps its capitals) used in the CSV import's running sentences"
  - "10-23 fix 6: discarding a mitigation form returns focus to its Edit or Add control (X-5)"
  - "10-23 fix 7: the controls Name and Framework columns and the Risk Type Description column use the DataTable long-text option (wrap within 14rem to 28rem, clamp to two lines); system and asset names, types and references stay on one line"
  - "10-23 fix 8: every picker popup is an APG listbox popup (focus stays in the input, options through aria-activedescendant), so the Popover wrapper carries no dialog role; More filters, which takes focus, stays a dialog named by its title"
  - "10-23 fix 8: two Label in Name defects the open-list scan found are fixed with it: a Control option's framework line is its description and leaves the label text, and a readiness Risk row separates its number from its count"
  - "10-23 fix 3c: the 18 titles an independent audit of all 386 found faulty (12) or ambiguous (6) are corrected within the 12-word, 100-character cap; each replaced title is listed last in supersededTitles, so 13 controls now list two earlier titles"
  - "10-23 fix 3c: every fix 3 and 3b 'restored' claim was checked mechanically against its delivered title; 9 overstated rows are annotated as completed in Fix 3c and 16 now say the limb is generalised, with no further retitle beyond the audit's 18"
  - "10-23 fix 3c: ISO Annex A 8.1 'User endpoint devices' versus 'User end point devices' is deferred to the operator, because there is no licensed copy to check against"
  - "10-23 pilot ruling: PSPF-042 ('reasonable') and PSPF-095 ('accredited') keep their titles; dropping 'reasonable' generalises a degree, and 'Zone Five' already denotes the accredited area"
  - "10-23 fix 3d: PSPF-130 reads 'Enabling appropriate access to official information and controlling supporting technology access', keeping the need-to-know 'appropriate' on 'access'; the pilot's example was not used verbatim because it opens with the paragraph's own opening phrase, which fix 3b's convention avoids"
  - "10-23 fix 8 addendum: axe's scrollable-region-focusable on an overflowing picker popup is accepted as the APG activedescendant combobox false positive, set aside only for that rule on the open popover content holding the listbox, and only in the overflow test that proves the keyboard path; fix 8's 28 scans stay strict and the container stays untabbable"
  - "10-23 Task 3: requirements-completed lists the six delivered requirements; ADMIN-05 stays open (requirements-partial) because the Information Asset owner moves to Phase 22"

requirements-completed: [REQ-07, QUES-08, QUES-09, ASSESS-06, ASSESS-07, UX-06]
requirements-partial: [ADMIN-05]  # delivered except the Information Asset owner, which moves to Phase 22 (REQUIREMENTS.md, ADMIN-05 Remainder)

coverage:
  - id: D1
    description: "The Phase 10 gate passes on the production build: Strapi, web, typecheck, lint, api:check and the full Playwright suite (both projects)"
    verification:
      - kind: integration
        ref: "pnpm --dir apps/backend test (third gate at 4c10b43: 649/649; first gate at eed7ed0: 630/630)"
        status: pass
      - kind: unit
        ref: "pnpm --dir apps/csrm test (third gate: 2,777/2,777; first gate: 2,745/2,745)"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/csrm typecheck; pnpm --dir apps/csrm lint; pnpm --dir apps/csrm api:check; pnpm verify:csrm-seed (third gate)"
        status: pass
      - kind: e2e
        ref: "pnpm --dir apps/csrm test:e2e (third gate: 87/87, desktop 83, mobile 4; first gate: 86/86)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No content type changed since 5ea2b77, the catalogue copies are byte-identical, no Keycloak file changed, and no CSRM_AI_ source line changed"
    verification:
      - kind: other
        ref: "the four static checks of 10-23 Task 1, at eed7ed0, 5ef0f88 and 4c10b43"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both actors walk every Phase 10 surface at 375 and 1440 on the restarted dev servers (backstops B1 to B8)"
    verification:
      - kind: manual_procedural
        ref: "10-23-SUMMARY.md ## Browser checks (the pilot's 51 rows, B1 to B8 at 375 and 1440, W1 to W18, all pass; approved 2026-10-03)"
        status: pass
    human_judgment: true
    rationale: "The pilot's blocking-human browser walk is the human verification of record; the Manual-Only items it leaves open stay open"
  - id: D4
    description: "Fix 3d: PSPF-130 keeps 'appropriate', with fix 3b's title listed as superseded"
    requirement: "ADMIN-05"
    verification:
      - kind: unit
        ref: "apps/backend/tests/control-titles.unit.test.ts#ADMIN-05 D-46 fix 3d: PSPF-130 keeps 'appropriate', the need-to-know intent of its paragraph"
        status: pass
      - kind: other
        ref: "pnpm verify:csrm-seed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Fix 8 addendum: an overflowing picker list passes axe with only the scoped scrollable-region-focusable exception, and its keyboard path reaches the last option in view"
    requirement: "ASSESS-06"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/accessibility.spec.ts#an overflowing picker list passes axe while open at 1440 and 375"
        status: pass
    human_judgment: false

duration: 48min (Task 1) plus the walkthrough fixes and Task 3, 2026-10-02 to 2026-10-03
completed: 2026-10-03
status: complete
---

# Phase 10 Plan 23: Phase gate and browser walk Summary

**Phase 10 closed by evidence: the gate green three times on the production build (last at `4c10b43`: Strapi 649/649, web 2,777/2,777, Playwright 87/87 with 0 flaky, the seed verification and the four static boundary checks clean), eleven walkthrough fixes and the Fix 8 addendum, test-first (APP-13's over-long text, 166 title corrections over 152 descriptive controls across fixes 3 to 3d, unchanged saves, picker listbox popups, wrapping titles, focus and copy), and the pilot's approved walk of both actors at 375 and 1440: 51 browser rows, all pass. ADMIN-05 is delivered except the Information Asset owner, which moves to Phase 22.**

Status: complete. Task 1 (the gate), Task 2 (the pilot's walk, approved 2026-10-03 with the Fix 3d and Fix 8 addendum rulings) and Task 3 (this record) are done. The orchestrator runs the code review, the regression gate, the verifier and one final full gate, because Fix 3d and the addendum change code after the third gate.

## Performance

- **Duration:** Task 1 took 48 min; the walkthrough rounds, their fixes, two more gates and Task 3 ran across 2026-10-02 and 2026-10-03 (the final continuation took about 25 min)
- **Started:** 2026-10-02T13:41:47Z
- **Gate record written:** 2026-10-02T14:29Z
- **Task 2 approved:** 2026-10-03 (the pilot)
- **Completed:** 2026-10-02T19:30Z (2026-10-03 local)
- **Tasks:** 3 of 3
- **Files modified:** 51 since `a2182e4` (49 outside `.planning/`), 39 commits before the Task 3 record

## Phase gate

All six commands of POST-DEMO-BRIEF §5 ran at `eed7ed0` (branch `post-demo`), each run on its own from the repository root under Node 24.19.0 and pnpm 11.24.0, with ports 1337 and 3000 free (`netstat` printed nothing). Each figure comes from the single recorded run named here; the logs are in the session scratchpad (`p10-23-gate-<name>.log`).

| # | Command | Passed | Failed | Skipped | Flaky | Duration | Exit |
|---|---|---|---|---|---|---|---|
| 1 | `pnpm --dir apps/backend test` (full Strapi suite, node:test, serial) | 630 | 0 | 0 (cancelled 0, todo 0) | n/a | 789 s wall (node:test 783.3 s) | 0 |
| 2 | `pnpm --dir apps/csrm test` (full web suite, Vitest, 129 files) | 2,745 | 0 | 0 | n/a | 39 s wall (Vitest 37.4 s) | 0 |
| 3 | `pnpm --dir apps/csrm typecheck` (`next typegen && tsc --noEmit`) | clean | 0 errors | n/a | n/a | 4 s | 0 |
| 4 | `pnpm --dir apps/csrm lint` (`next typegen && tsc --noEmit`) | clean | 0 errors | n/a | n/a | 4 s | 0 |
| 5a | `pnpm --dir apps/csrm api:check` (`api:generate` then `git diff --exit-code` on `schema.d.ts`) | clean (no diff) | n/a | n/a | n/a | 2 s | 0 |
| 5b | `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | `schema.d.ts` refreshed (not listed afterwards) | n/a | n/a | n/a | under 1 s | 1, see note |
| 6 | `pnpm --dir apps/csrm test:e2e` (full Playwright suite, production build, 1 worker) | 86: desktop 82, mobile 4 | 0 | 0 | 0 | 14.9 min (899 s wall) | 0 |

Notes:
- **Flaky count 0.** `retries` is `process.env.CI ? 2 : 0` (`apps/csrm/playwright.config.ts:142`), so outside CI an unstable test fails instead of passing as flaky. The run printed `86 passed (14.9m)`, with no `failed`, `flaky` or `skipped` line and no retry. The CSV journey that showed the 10-17 resize race passed first time on both projects (orchestrator fix `dc85f17`).
- **5b exits 1 for the operator's files only.** It prints `apps/backend/types/generated/components.d.ts: needs update` and `apps/backend/types/generated/contentTypes.d.ts: needs update`, because git's refresh reports every stat-dirty entry whatever pathspec it is given. Those two are the operator's empty-diff line-ending items, left alone. Run joined to 5a by `&&`, the same line exits 1 for this reason alone; `api:check` itself exits 0 (logged in `p10-23-gate-api-check-combined.log`, then rerun as 5a and 5b).
- **Superseded run.** Before the fix below, the Strapi suite passed 630/630 in 902 s at `a2182e4` (`p10-23-gate-strapi-prefix.log`). The table's figures come from the full rerun after the fix.
- **Tree after the Playwright run:** only the three operator items (` M apps/backend/types/generated/components.d.ts`, ` M apps/backend/types/generated/contentTypes.d.ts`, `?? example-risk-assessment-questions/`). The run changed no file, and nothing was restored (D-48).
- **Observation, not a failure:** the Next production server under Playwright logged `⨯ Error: The destination stream closed early.` 191 times, spread over many navigation-heavy tests (the most were 22 and 19, before the two `request-relationship-states.spec.ts:43` cases). This is Next logging a response stream the browser abandoned on navigation. It first shows in Phase 10 runs: 0 in the pre-phase `261002-drq` single-spec runs, 46 in 10-01's full run (12.0 min), 39 to 61 in the later full runs. No test asserts on it, and the suite is green. It is noted for the pilot, not treated as a defect.

## Static checks

Run at `eed7ed0` (`p10-23-gate-static.log`). Each output is quoted between brackets.

1. **Content types unchanged since `5ea2b77` (D-01).** `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` printed `[]` (nothing).
2. **Catalogue copies byte-identical (D-02).** `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` printed nothing (exit 0).
3. **No Keycloak file changed.** `git diff --name-only 5ea2b77..HEAD | grep -i keycloak` printed nothing, over 221 changed files.
4. **No `CSRM_AI_` source line changed.** `git diff 5ea2b77..HEAD -- apps scripts package.json turbo.json pnpm-workspace.yaml | grep '^[+-].*CSRM_AI_'` printed nothing.

The first run of check 4, at `a2182e4`, failed (`p10-23-gate-static-prefix.log`). It printed `[+  assert.equal(process.env.CSRM_AI_PROVIDER, "deterministic");]` from `apps/backend/tests/questionnaire-governance.integration.test.ts`, added by `e66a853` (10-09). The fix is recorded below.

## Walkthrough fixes

The pilot's Task 2 walk (2026-10-03) was not approved and listed six defects. Each is fixed as a GSD Rule 1 deviation inside this plan, failing test first, and recorded here. The full gate reruns after the last fix.

Rounds 2 and 3 added fixes 7, 8, 3b and 3c. The pilot then approved Task 2 with two rulings, Fix 3d and the Fix 8 addendum, which are the last two sections below. The fix order in this section is the order of record, not of commit; every commit is listed under Task Commits.

### Fix 2: APP-13 and the control description bound

**Root cause.** APP-13's `legalText` in `apps/backend/src/bootstrap/controls/privacy-act-app-ndb-2026-06-04.json` was 100,973 characters. The PDF extraction ran on past the end of Schedule 1 and appended Schedule 2 and the compilation's endnotes. The seed copies `legalText` into the control description. `ControlsAdministrationRecord` (and its create and update inputs) bound `description` at `maxLength: 10000`, and the web's closed parser enforces the bound. So every Administration › Controls page and every control picker page that held APP-13 failed to load: searches for `APP`, `APP-1`, `APP-13`, `Privacy Act`, `data` and `personal` (the framework name holds "Data", so all 24 Privacy Act controls match). The server was serving data that broke its own contract.

**What was cut, and why (curated at the source, D-44's file).** APP 13 is five subclauses: 13.1 Correction, 13.2 Notification of correction to third parties, 13.3 Refusal to correct information, 13.4 Request to associate a statement, and 13.5 Dealing with requests. Its own text ends at `…for associating the statement with the personal information (as the case may be).`. That text is kept verbatim: 2,558 characters, including the one running page header inside it (`Schedule 1 Australian Privacy Principles Part 5 … Clause 13 384 Privacy Act 1988`), which the other twelve APPs also carry. Everything after it is cut, 98,415 characters in all:

| Cut segment (from its first heading) | Characters |
|---|---|
| Schedule 2, Statutory Tort for Serious Invasions of Privacy (Parts 1 to 4) | 27,661 |
| Endnote 1, About the endnotes | 2,233 |
| Endnote 2, Abbreviation key | 1,173 |
| Endnote 3, Legislation history | 20,581 |
| Endnote 4, Amendment history | 45,772 |
| Endnote 5, Editorial changes | 995 |
| **Total cut** | **98,415** |

None of the cut text belongs to another seeded control: the catalogue seeds APP-1 to APP-13 and the Part IIIC NDB sections (26WE to 26WQ), and neither Schedule 2 nor the endnotes is one of them. Curation was clean, so no truncation marker was needed. The edit is a one-line JSON diff (CRLF kept). A guarded scratch script replaced only APP-13's `legalText` literal and checked that nothing else in the parsed file changed. APP-13 now reads 2,558 characters against the bound of 10,000.

**Every other offender.** None. Every one of the 2,646 seeds (titles applied) was checked against every bounded string field of `ControlsAdministrationRecord`: `controlNumber` 1 to 255, `name` 1 to 255, `description` up to 10,000, `controlReference` up to 500, `framework` 1 to 255, `frameworkVersion` up to 255 and `frameworkSource` up to 2,000 (`documentId` is not seeded). Each value was also checked for being blank or untrimmed. APP-13's description was the only breach. The longest values before the fix were 41, 139, 100,973, 18, 84, 49 and 130 characters; after it, the longest description is NDB-26WF's 4,944, and the survey finds 0 breaches. The four catalogues 10-22 guards are untouched.

**Reconciling the development database.** `seedCsrmControls` used to overwrite every seeded field whenever any of them differed. It now treats the description by ownership:
- A stored description that equals the one its stored `sourceData.control` gives is one the seed wrote, and the current seed replaces it.
- A stored description beyond 10,000 characters is replaced too, because no valid write can store one.
- Any other non-blank description is an operator's own, and a seeded start keeps it.

`sourceData` holds the catalogue entry the seed read, and no Administration write can change it. That makes ownership provable without new state, and it keeps D-01 (no content type change). The other seeded fields keep the existing reconciliation (T-10-42 and T-10-64). `controlDescription` is now the one derivation shared by a fresh seed and the ownership check. The dev database's APP-13 row stores the old text in both `description` and `sourceData`, so it is seed-owned and over the bound, and the pilot's next seeded Strapi start rewrites it (same documentId, still 2,646 controls).

**Write and read bounds.**
- **Writes** already refused an over-long description. `parseAdministrationMutation` rejects more than 10,000 characters after trimming, with the existing `INVALID_ADMINISTRATION_DATA` 400. The CSV import rejects the row with `VALUE_TOO_LONG` on `description`. Neither path truncates. These are now proven by a mounted test: create and update with 10,001 characters are 400s, 10,000 characters are served whole, and a CSV row is rejected and writes nothing.
- **Reads.** The new `served-text.ts` holds `boundServedText`, which cuts a value at the last word boundary inside its bound, closes it with `…` and never splits a surrogate pair. It also holds `warnServedTextBounded`, which logs `strapi.log.warn` naming the record and its fields, never the text. The Controls projection (`projectAdministrationRecord` for `controls`, used by the record, the list, and the create and update responses) bounds all seven bounded text fields and warns `CSRM control {documentId} ({controlNumber}) …`. The CSV preview's `changes[].before` used to `slice` silently at 10,000. It now uses the same visible bound and warning, so an over-long stored value can never compare equal to a file value.
- **Other projections.** The control summaries on control implementations (`ControlImplementationControlSummary`) and the picker's applicable-control summaries (`RiskTypeApplicableControl`) carry no description; they serve `name` and the other fields bounded at 255 (D-31, D-34). `ControlSummary` and `ControlListResponse` are not served by any operation.

**Parser decision.** The web's closed parser (`administration-schema.ts`) stays strict. The contract makes an over-long description a server defect, and the server now bounds its reads. A new web test pins this: 10,000 characters parse and 10,001 throw.

**History.** The over-long text predates Phase 10. `git log --all -S "Endnote 5—Editorial changes"` finds only `d7fd4a0` (2026-08-08, "Created 11 JSON catalogues in apps/csrm/docs/references/controls"). `git log --follow` on the file shows `d7fd4a0`, then `a1b66f7` (2026-08-11, the move to `apps/backend/src/bootstrap/controls/`, content unchanged), then `8e30fbe` (10-17). At `d7fd4a0` and at the Phase 10 baseline `5ea2b77`, APP-13's `legalText` was 100,985 characters. 10-17's D-44 correction removed the 12-character leaked prefix `information `, leaving 100,973.

**Tests.**

| File | Test | Before the fix (`7e07dba`) | After (`a31ae03`) |
|---|---|---|---|
| `apps/backend/tests/control-library-bounds.unit.test.ts` (new) | every seeded control satisfies every Controls contract bound | fail: `APP-13 description 100973 > 10000` | pass |
| same | APP-13 keeps its own five subclauses and nothing after the end of Schedule 1 | fail: ends in Schedule 2 text | pass |
| `apps/backend/tests/administration.unit.test.ts` | a Control record and a CSV change never serve stored text beyond its bound | fail: description served at 15,389 characters | pass |
| `apps/backend/tests/assessment-seed.integration.test.ts` | a seeded start replaces the over-long APP-13 text an earlier seed stored | fail: 100,973 characters | pass |
| same | a seeded start keeps an operator's own description of a seeded control, then changes nothing | fail: the seed overwrote it | pass |
| same | a seeded start replaces a stored description beyond the bound, whoever stored it | fail: 100,973 characters | pass |
| same | (10-17) a seeded start corrects a Privacy Principle an earlier seed stored truncated: the fixture now also stores the `sourceData` an earlier seed wrote | pass | pass |
| `apps/backend/tests/administration.integration.test.ts` | the walkthrough's control searches return contract-valid records on every page (`APP`, `APP-13`, `Privacy Act`, `data`, `personal`; every page; each finds APP-13) | fail: `APP` page 1 `APP-13 description 100973 > 10000` | pass |
| same | a stored control description beyond the bound is served shortened, visibly, with a warning that names the control | fail: served at 15,389 characters | pass |
| same | control writes refuse a description beyond the bound and never shorten it | pass (regression proof of existing behaviour) | pass |
| `apps/csrm/src/features/administration/administration-schema.test.ts` | keeps the Control record parser strict on the 10,000-character description bound | pass (decision pin) | pass |
| `apps/csrm/e2e/administration-workflow.spec.ts` | `ADMIN05_APP13_LOADS` (Administration › Controls `?q=APP-13` shows the row titled `Correction of personal information`, with no load failure) and `ADMIN05_PICKER_FINDS_APP13` (the Risk Type form's control picker searches `APP-13` and offers `APP-13 · Correction of personal information`) | not run before the fix | pass |

Runs (logs in the session scratchpad, `p10-23-f2-*.log`):
- RED, four Strapi files: 50 tests, 42 passed, 8 failed, all on assertions (89 s). `check tdd-red-evidence` returned RED_EVIDENCE_OK for both unit targets (TAP).
- GREEN, five Strapi files (with `control-titles.unit.test.ts`): 67/67 (95 s).
- Web `src/features/administration`: 3 files, 61/61. `pnpm --dir apps/csrm typecheck`, `lint` and `api:check`: clean, then `git update-index --refresh` on `schema.d.ts`.
- Playwright `e2e/administration-workflow.spec.ts`, no dev server running: 5 passed (desktop 4, mobile 1), 0 failed, 0 flaky, 0 skipped, 1.8 min. Next logged the known benign `destination stream closed early` 10 times. The run left the tree unchanged. The release journey's picker step was not touched, so it was not run.
- Static checks since `5ea2b77`: no content type changed, and the four 10-22 catalogues are unchanged. Both role-function catalogue copies are untouched and byte-identical, and the specification is untouched.

**Commits.** `7e07dba` test(10-23): expect every seeded control within the Controls contract bounds; `a31ae03` fix(10-23): keep APP-13 and every control description within the contract bound; and the docs commit that records this fix.

**Decisions.**
- Curate at the source: APP 13's paragraphs are kept verbatim and Schedule 2 and the endnotes are cut, so no truncation marker is needed.
- Description ownership is decided by the stored `sourceData`. The 10-17 seed test's fixture now stores what an earlier seed really wrote (its `sourceData` beside its description); its assertions are unchanged.
- The read bound covers all seven bounded text fields of the Controls record (identifier fields included), so the projection cannot serve a contract-breaking record. The warning names the documentId and number.
- The web parser stays strict (see above).
- No content type, specification or catalogue-copy change (D-01, D-02).

**Deferred.** Both are in `deferred-items.md`:
- `scripts/verify-csrm-seed.mjs` fails on 13 files (10-22's title file). It is not part of the gate.
- The specification's `ControlsAdministrationRecord` requires an `updatedAt` that neither the server nor the web serves.

**Open for the pilot:** APP-13 against Schedule 1 stays in Task 3's Manual-Only list. The development database picks up the curated APP-13 on the next seeded Strapi start.

### Fix 3: descriptive control titles

**Defect.** The pilot's sample found two of five CPS 230 titles narrowing their paragraph:
- CPS-230-34 dropped "or its role in the financial system".
- CPS-230-57 dropped "or is not documented in a formal agreement".

The titles are 10-22's (D-46), in `apps/backend/src/bootstrap/controls/csrm-control-titles.json`.

**Rule applied (the pilot's).** A title is short and in CSRM's own words, and it never misstates or narrows its paragraph.
- **Narrowing:** dropping a limb, a party, a condition, a threshold or a qualifier that changes what the requirement covers.
- **Misstating:** adding an obligation, party or qualifier the paragraph does not have, or naming the wrong actor (for example "APRA power to classify" where APRA requires the entity to classify).
- **Umbrella titles are fine.** A title that names the requirement's whole subject without listing its parts, such as "Contents of the BCP" or "Elements of the operational risk management framework", drops nothing. A title that lists some limbs and not others narrows the paragraph.
- **Length:** a slightly longer title that covers every limb is preferred over a shorter one that narrows.
- **10-22's checks still hold:** every title shares a specific word with its own paragraph, no title repeats its paragraph's opening words, titles are unique within their framework, and no title uses an em or en dash, "must" or "shall".

**Audited set (114 titles).**

| Framework | Reviewed | Changed | Kept |
|---|---|---|---|
| APRA CPS 230 | all 51 | 41 | 10 |
| APRA CPS 234 | all 24 | 10 | 14 |
| PSPF | 39 | 21 | 18 |
| **Total** | **114** | **72** | **42** |

The 39 PSPF titles are:
- **30 spread evenly across the 218:** catalogue positions `round(i × 217 / 29)` for i = 0 to 29. That gives PSPF-001, 008, 016, 023, 031, 038, 046, 053, 061, 068, 076, 083, 091, 098, 106, 114, 122, 129, 137, 144, 152, 159, 167, 174, 182, 189, 197, 204, 212 and 219.
- **Eight more whose paragraph has several limbs:** an `unless`, `only … if`, `or otherwise` or bulleted exception. They are PSPF-048, 077, 080, 081, 139, 149, 151 and 158.
- **PSPF-011,** read as PSPF-008's neighbour so that both stay distinct.

The worksheet is `p10-23-f3-title-review.md` in the session scratchpad. It holds each reviewed paragraph, the 10-22 title, the verdict and the limb restored or the reason kept. It is not in the repository.

**Every changed title (72).** The two the pilot found come first.

| Control | 10-22 title | Corrected title | Limb or qualifier restored |
|---|---|---|---|
| CPS-230-34 | Critical operations defined by adverse customer impact | Critical operations defined by material harm to customers or the financial system | the second limb 'or its role in the financial system', and 'material' (completed in Fix 3c: this title said 'material harm to … the financial system', not its role in it) |
| CPS-230-57 | Relief for listed providers on standardised terms | Partial relief for listed providers on standardised terms or no formal agreement | the alternative 'or is not documented in a formal agreement', and 'partial' (only paragraphs 53, 54, 55(d), 59(a) and 59(c)) (revised in Fix 3c: 'listed providers' could be read as stock-exchange listed) |
| CPS-230-11 | Operational risk, critical operations and service provider risks | Operational risk, conduct and compliance standards, critical operations and providers | limb (a)'s standards for conduct and compliance |
| CPS-230-13 | Preventing and recovering from disruption to critical operations | Preventing, withstanding and recovering from critical operation disruption where practicable | the limb that keeps operating during a disruption, as 'withstanding' ('within tolerance' is generalised), and the qualifier 'to the extent practicable' |
| CPS-230-14 | Service provider reliance within prudential obligations | Service provider reliance only with obligations met and risks managed | the second condition: the associated risks are effectively managed |
| CPS-230-16 | Periodic review of operational risk management | Operational risk management within the required framework reviews | removes 'periodic', which the paragraph does not say; the review is part of the CPS 220 and SPS 220 framework reviews |
| CPS-230-17 | Integrating operational risk into overall risk management | Operational risk integration and BCP consistency with recovery and exit plans | the paragraph's second sentence: business continuity planning consistent with recovery and exit planning |
| CPS-230-18 | APRA actions on operational risk weaknesses | APRA actions on material operational risk weaknesses | the threshold 'material' |
| CPS-230-19 | Board accountability for operational risk oversight | Board accountability for overseeing operational risk, continuity and providers | business continuity and service provider arrangements, which the paragraph includes |
| CPS-230-20 | Senior manager roles for operational risk | Board-ensured senior manager roles for operational risk, continuity and providers | the Board's duty to ensure the roles, and business continuity and service provider arrangements |
| CPS-230-21 | Board approval of BCP, tolerances and provider policy | Board oversight and approval for operational risk, BCP, tolerances and providers | limb (a), Board oversight of operational risk (its key controls and the reviews in (b) and (c) are generalised under 'oversight') (revised in Fix 3c: 'approval for … providers' read as the Board approving providers) |
| CPS-230-22 | Briefing the Board on impacts to critical operations | Senior management briefing the Board on decisions affecting critical operations | the party (senior management) and the condition: decisions that could affect critical operations' resilience |
| CPS-230-23 | Managing the full range of operational risks | Full range of operational risks, with end-to-end senior management responsibility | the second sentence: senior management responsibility across the end-to-end process |
| CPS-230-24 | IT capability and information asset health | IT capability, information asset age and health, and CPS 234 security | 'age' of information assets and the CPS 234 information security limb |
| CPS-230-25 | Operational risk impact of business decisions | Business and strategic decision impacts on operational risk and resilience | strategic decisions and operational resilience |
| CPS-230-27 | Risk assessment before providing a material service | Risk assessment before providing a material service, and APRA-required stronger controls | the second sentence: APRA may require stronger controls (processes are generalised under 'controls') |
| CPS-230-28 | Designing and embedding operational risk controls | Operational risk controls designed and embedded within appetite and compliance obligations | 'in line with its risk appetite' and the purpose of meeting compliance obligations |
| CPS-230-29 | Monitoring and testing control effectiveness | Risk-based control monitoring and testing, senior management reporting and timely rectification | monitoring (review is generalised under 'monitoring and testing'), frequency by materiality (as 'risk-based'), reporting to senior management and timely rectification |
| CPS-230-30 | Remediating control gaps and weaknesses | Timely root-cause remediation of material weaknesses, tracked in the risk profile | 'material', root causes and timeliness (failures are generalised under 'material weaknesses'), and the limb keeping weaknesses in the risk profile until remediated |
| CPS-230-31 | Recording and addressing incidents and near misses | Timely incident and near miss handling, reflected in risk and control assessments | the second sentence: incidents and near misses taken into the risk profile and control effectiveness assessments |
| CPS-230-32 | Notifying APRA of operational incidents within 72 hours | Notifying APRA within 72 hours of material operational risk incidents | the materiality threshold (material financial impact or material impact on critical operations) |
| CPS-230-35 | Minimum critical operations by entity type | Minimum critical operations by entity type, unless justified otherwise | the qualifier 'unless it can justify otherwise' |
| CPS-230-36 | APRA power to classify critical operations | APRA power to require critical operation classification | corrects the actor: APRA requires the entity to classify; it does not classify |
| CPS-230-38 | APRA review and setting of tolerance levels | APRA-required tolerance reviews, and APRA-set tolerances for heightened risk or weakness | corrects the actor (APRA requires the entity to review) and adds the condition for APRA-set tolerances (completed in Fix 3c: this title dropped 'change' and 'material' before 'weakness') |
| CPS-230-40 | BCP capabilities and tolerance level monitoring | BCP capabilities, tolerance monitoring and Board reporting of failures with remediation | the limb reporting tolerance failures, with a remediation plan, to the Board |
| CPS-230-41 | Notifying APRA of critical disruptions within 24 hours | Notifying APRA within 24 hours of a critical operation disruption beyond tolerance | corrects 'critical disruptions' to a disruption to a critical operation outside tolerance |
| CPS-230-43 | Severe but plausible test scenarios | Tailored severe but plausible test scenarios, including any APRA-determined scenario | tailoring to material risks and the APRA-determined scenario limb |
| CPS-230-44 | Annual update of the BCP | Annual BCP update as needed for changes and review or testing shortcomings | the qualifier 'as necessary' and what the update reflects |
| CPS-230-45 | Internal audit review of the BCP | Internal audit review and Board assurance on the BCP and its testing | the assurance to the Board, which covers the BCP's credibility and the testing procedures |
| CPS-230-47 | Provider policy on agreements, exits and fourth parties | Provider policy on agreement lifecycle, material provider risks and fourth parties | limb (b), managing material service provider risks, and (a)'s monitoring and substituting, generalised as 'agreement lifecycle' |
| CPS-230-48 | Register of material service providers | Register of material service providers and management of their risks | the limb managing the material risks of using these providers |
| CPS-230-49 | Minimum material service providers by entity type | Minimum material service providers by entity type, unless justified otherwise | the qualifier 'unless it can justify otherwise' |
| CPS-230-50 | Annual submission of the provider register | Annual submission of the material provider register to APRA | the recipient (APRA) and 'material' |
| CPS-230-51 | APRA power to classify providers as material | APRA power to require providers or arrangements to be classified material | corrects the actor and adds service provider arrangements |
| CPS-230-52 | Due diligence before a material arrangement | Due diligence and risk assessment before a material arrangement or material change | materially modifying an arrangement, and limb (b), the reliance risk assessment |
| CPS-230-54 | APRA access rights in provider agreements | APRA access and non-obstruction terms in provider agreements | limb (c): the provider agrees not to impede APRA |
| CPS-230-56 | APRA-directed changes to provider arrangements | APRA-required review and change of provider arrangements on prudential concerns | the review, and the condition 'heightened prudential concerns' (completed in Fix 3c: this title dropped 'heightened') |
| CPS-230-58 | APRA written exemption for unlisted arrangements | APRA written exemption for arrangements outside the paragraph 57 relief | arrangements failing either paragraph 57 condition, not only unlisted providers (revised in Fix 3c: 'exemption' read as a full exemption) |
| CPS-230-59 | Monitoring material arrangements and provider performance | Monitoring and senior management reporting on material arrangements | senior management reporting (performance, control effectiveness and compliance are generalised under 'Monitoring') |
| CPS-230-60 | Notifying APRA of critical and offshoring arrangements | Notifying APRA of critical service agreements and material offshoring, including changes | material changes to agreements and significant offshoring changes; 'material' offshoring (completed in Fix 3c: this title said 'including changes', with no threshold) |
| CPS-230-61 | Internal audit of critical outsourcing arrangements | Internal audit review of proposed critical outsourcing and Board compliance reporting | 'proposed' arrangements and the regular compliance reporting to the Board |
| CPS-234-15 | Information security capability proportionate to threats | Information security capability proportionate to threats and supporting sound operation | the second limb: a capability that enables the entity's continued sound operation |
| CPS-234-16 | Third-party information security capability assessment | Proportionate assessment of related and third-party information security capability | related parties beside third parties, and 'commensurate with the potential consequences' |
| CPS-234-17 | Keeping capability current with changing threats | Keeping capability current with changing vulnerabilities and threats | vulnerabilities beside threats |
| CPS-234-22 | Third-party control design evaluation | Evaluating the design of related and third-party security controls | related parties beside third parties |
| CPS-234-28 | Reliance on third-party control testing | Assessing reliance on related or third-party control testing | related parties, and the assessment the paragraph requires |
| CPS-234-29 | Escalating unremediated control deficiencies | Escalating control deficiencies that cannot be remediated in time | corrects 'unremediated' to deficiencies that cannot be remediated in a timely manner |
| CPS-234-31 | Annual review of testing program sufficiency | Reviewing testing program sufficiency annually and on material change | the second trigger: a material change to information assets or the business environment |
| CPS-234-34 | Internal audit of third-party control assurance | Internal audit of related or third-party assurance it relies on, where material | related parties and both conditions: material potential impact and internal audit's reliance |
| CPS-234-35 | Notifying APRA of material incidents within 72 hours | Notifying APRA within 72 hours of material or regulator-notified incidents | limb (b): incidents notified to other regulators (completed in Fix 3c: 'regulator-notified' read as notified by a regulator, and dropped 'other') |
| CPS-234-36 | Notifying APRA of material control weaknesses | Notifying APRA of material control weaknesses not remediable in time | the condition: weaknesses the entity expects it cannot remediate in a timely manner |
| PSPF-008 | Appointing a Chief Security Officer | Appointing and empowering a Chief Security Officer | 'empowered' to oversee protective security |
| PSPF-016 | Approved security governance arrangements | Accountable Authority approval of tailored security governance arrangements | the approving party and the qualifier 'tailored' (its basis, the entity's size, complexity and risk environment, is not named) |
| PSPF-038 | Impact of risk decisions on other entities | Considering risk decision impacts on other entities and sharing risk information | the second limb: sharing risk information where appropriate |
| PSPF-046 | Foreign ownership, control or influence in procurement | Foreign ownership, control or influence risks in procurement and contracts | the limb covering developments during the contract period, generalised as 'and contracts' |
| PSPF-048 | Use of secure, verifiable third-party vendors | Use of secure, verifiable third parties, with CISO-approved business exceptions | the exception: other use where business operations require it, approved by the CISO (the residual risk is generalised as the approved exception) |
| PSPF-053 | Documenting decisions to vary requirements | Documenting exceptional-circumstance variations in the security plan | the condition 'due to exceptional circumstances' and where they are documented |
| PSPF-077 | Agreement before sharing outside government | Agreement before sharing outside government, except returned external information | the exception for returning or responding to information an outside party provided (completed in Fix 3c: this title carried 'returned' only, and not the OFFICIAL: Sensitive limit) |
| PSPF-080 | AUSTEO information withheld from non-citizens | AUSTEO information withheld from non-citizens unless exempted | the exception 'unless an exemption is granted' |
| PSPF-091 | TikTok removal from government devices | Blocking and removing TikTok on government devices without a legitimate business reason | preventing installation, and the legitimate business reason exception |
| PSPF-098 | Maintaining a cyber security strategy and uplift plan | ISM-aligned cyber security strategy and uplift plan with Zero Trust culture | 'in accordance with the Information Security Manual and the Zero Trust guiding principles' (develop, implement and maintain are not named: the title names the strategy and plan as an umbrella) |
| PSPF-114 | IRAP-assessed gateway capabilities | Gateways with an IRAP or ASD assessment in the last 24 months | the 24-month recency and the ASD assessment for TOP SECRET gateways (completed in Fix 3c: this title offered IRAP or ASD as open alternatives) |
| PSPF-137 | ASD approval for overseas TOP SECRET remote access | ASD approval for overseas TOP SECRET remote access outside PSPF facilities | the condition 'outside of facilities meeting PSPF requirements' |
| PSPF-144 | Clearances issued only with sponsorship | Clearances issued only when sponsored or authorised by government | the alternative 'or otherwise authorised by the Australian Government' |
| PSPF-149 | Approving citizenship eligibility waivers | Approving and recording citizenship eligibility waivers | the limb keeping a record of every waiver approved |
| PSPF-151 | Approving checkable background eligibility waivers | Approving and recording checkable background eligibility waivers | the limb keeping a record of every waiver approved |
| PSPF-152 | Vetting agency advice on uncheckable backgrounds | Uncheckable backgrounds: vetting agency advice and Accountable Authority waiver | the second limb: a clearance issues only on the Accountable Authority's waiver |
| PSPF-167 | Sponsoring entity sharing of relevant concerns | Sponsoring Entity sharing of relevant concerns where appropriate | the qualifier 'where appropriate' |
| PSPF-189 | Security integrated into facility planning | Security integrated into facility planning, selection, design and modification | selecting, designing and modifying facilities beside planning |
| PSPF-204 | Construction and securing of perimeter doors | Construction and securing of perimeter doors and hardware | perimeter hardware beside doors |
| PSPF-212 | Post-quantum cryptography on new equipment | Post-quantum cryptography on newly procured equipment and software | software beside equipment, and 'newly procured' (revised in Fix 3c: 'cryptographic' equipment and 'approved' algorithms) |
| PSPF-219 | Training on foreign interference and espionage | Training on foreign interference, espionage, cultivation and exploitation | cultivation and exploitation by foreign powers |

All 72 titles stay within 10-22's anchor, opening-copy, uniqueness and form checks. They run to at most 12 words and 95 characters (CPS-230-29 is the longest), so a stored name `{number} — {title}` is at most 108 characters against the contract's 255.

**Titles reviewed and kept (42).**

| Control | Title kept | Why it does not narrow |
|---|---|---|
| CPS-230-12 | Identifying, assessing and managing operational risks | names the whole obligation: identify, assess and manage operational risks from every listed source |
| CPS-230-15 | Elements of the operational risk management framework | an umbrella for limbs (a) to (f); it names no limb, so it drops none |
| CPS-230-26 | Comprehensive operational risk profile assessment | an umbrella for the comprehensive assessment and its parts (a) to (c) |
| CPS-230-33 | Critical operations register and business continuity | register (a) plus 'business continuity' as an umbrella for (b) to (e) |
| CPS-230-37 | Tolerance levels for each critical operation | an umbrella for the three tolerance levels (a) to (c) |
| CPS-230-39 | Contents of the BCP, including triggers and communications | 'Contents of the BCP' covers (a) to (e); 'including' marks the named items as examples |
| CPS-230-42 | BCP testing program and annual exercise | the program, covering all critical operations, and the annual exercise; scenarios are the program's content |
| CPS-230-46 | Service provider management policy | an umbrella for the policy and what it must cover |
| CPS-230-53 | Formal agreement for material arrangements | an umbrella for the formal agreement and its minimum terms (a) to (g) |
| CPS-230-55 | Arrangement risks, continuity and orderly exit | 'arrangement risks' covers (a) and (b); continuity is (c) and orderly exit (d) |
| CPS-234-13 | Board responsibility for information security | Board responsibility for information security is the paragraph's whole subject; the second sentence says how the Board discharges it |
| CPS-234-14 | Defined information security roles and responsibilities | an umbrella for the defined roles of every party listed |
| CPS-234-18 | Information security policy framework | an umbrella; the paragraph sets one framework commensurate with exposures |
| CPS-234-19 | Policy direction on security responsibilities | the policy direction on responsibilities of all parties |
| CPS-234-20 | Classification of information assets by criticality and sensitivity | names the classification and its two axes; third-party-managed assets are information assets the title does not exclude |
| CPS-234-21 | Timely, proportionate information security controls | timely and proportionate are the paragraph's two qualifiers; (a) to (d) are what proportionate is measured against |
| CPS-234-23 | Incident detection and response mechanisms | detection and response mechanisms, as the paragraph requires |
| CPS-234-24 | Information security response plans | the plans the paragraph defines |
| CPS-234-25 | Response plan stages and incident escalation | stages (a) and escalation (b), which includes reporting |
| CPS-234-26 | Annual review and testing of response plans | annual review and testing, as required |
| CPS-234-27 | Systematic control testing program | an umbrella for the systematic program and its proportionality factors |
| CPS-234-30 | Skilled, independent testing specialists | skilled and independent, as required |
| CPS-234-32 | Internal audit of information security controls | internal audit review of security controls; the related and third-party controls are included, not excluded |
| CPS-234-33 | Skilled personnel for control assurance | skilled personnel providing control assurance |
| PSPF-001 | Portfolio security advice from the Department of State | the Department of State's advice and guidance to portfolio entities |
| PSPF-011 | Appointing a Chief Information Security Officer | (neighbour of PSPF-008) appointing a CISO is the whole requirement; it has no 'empowered' |
| PSPF-023 | Positive security culture program | the program and its purpose; the parties are the entity's own leadership |
| PSPF-031 | Annual protective security report to the Minister | the report to the Minister |
| PSPF-061 | Marking security classified information | an umbrella for the marking rule and its exception |
| PSPF-068 | Security classification metadata on technology systems | the metadata on the systems the paragraph names; the caveat is 'where relevant' |
| PSPF-076 | Sharing with state and territory government agencies | names the sharing the MOU governs |
| PSPF-083 | Sharing with foreign non-government stakeholders | names the sharing the protections govern |
| PSPF-081 | AGAO information withheld from most non-citizens | 'most non-citizens' already carries the National Intelligence Community and listed-department exception |
| PSPF-106 | Maturity Level Two: regular back-ups | the Essential Eight strategy at Maturity Level Two |
| PSPF-122 | Risk assessment for temporary access | the risk assessment for temporary access |
| PSPF-129 | Facilitating access to official information | facilitated access to official information |
| PSPF-139 | Remote work exposed to foreign government direction | names the subject (remote work exposed to foreign direction) without stating the rule, so it narrows nothing (corrected in Fix 3c: the audit found it dropped 'extrajudicial' and 'that conflict with Australian law') |
| PSPF-158 | Conditional clearances for manageable concerns | an umbrella for the three conditional-clearance steps and the delegation |
| PSPF-159 | Concerns shared with the vetting outcome | the concerns shared with the vetting outcome |
| PSPF-174 | Resolving doubt in the national interest on reassessment | resolving doubt in the national interest on reassessment |
| PSPF-182 | Security obligations and debriefing at separation | obligations for all separating personnel and debriefing for clearance holders; the title names both |
| PSPF-197 | ASIO-T4 certification of Zone Five areas | Zone Five areas hold TOP SECRET or catastrophic-impact information by definition; the clause describes them rather than restricting which areas |

**Voice rule widened.** 10-22's unit test capped a descriptive title at 8 words and 80 characters. 55 of the corrected titles need more, because covering every limb takes words. The cap is now 12 words and 100 characters, which is the title file's own `CONTROL_TITLE_MAX_LENGTH`.

**Reconciling the development database.** The pilot's development database holds 10-22's titles. Before this fix, a seeded start overwrote every seeded name, so it would also have overwritten an operator's own edit (10-22 accepted that as T-10-64). The seeded start now decides a name by ownership, the same way fix 2 decides a description.

A stored name counts as one the seed wrote when it is any of:
- the bare control number (a database seeded before D-46);
- `{number} — {label}`, where the label comes from the catalogue entry stored in `sourceData` (for example 10-17's earlier APP titles);
- `{number} — {title}`, for a title listed under the title file's new `supersededTitles`.

`supersededTitles` keeps, per catalogue and control, every title an earlier seed stored. It now lists each of the 72 titles 10-22 seeded. A seeded start replaces a seed-written name with the current name. It keeps any other non-blank name, which is an operator's own.

`parseControlTitles` validates the list and refuses the file, naming the file and the control, when:
- the list is not an object;
- it names a catalogue the file does not title, or a control the file does not title;
- a control's titles are not a non-empty list;
- a superseded title breaks the form rules;
- a control's current title is listed as superseded.

The rule needs no new state and no content-type change (D-01). In the pilot's database, the 72 controls stored under 10-22's titles are renamed on the next seeded start, keeping their documentIds and relations. Every other control is unchanged, and an operator-edited name is kept.

The other seeded fields keep the existing reconciliation (T-10-42). `readControlLibrary` now also returns `supersededTitles`, and `seedCsrmControls` takes it as a third argument.

**Mounted reconcile proof** (`assessment-seed.integration.test.ts`):
- CPS-230-34 stored as `CPS-230-34 — Critical operations defined by adverse customer impact` becomes `CPS-230-34 — Critical operations defined by material harm to customers or the financial system` on a seeded start. It keeps its documentId and its paragraph, a further start leaves its `updatedAt` unchanged, and the library stays at 2,646.
- CPS-230-57 renamed by an operator to `CPS-230-57 — Our reading: relief for exchanges and clearing houses` keeps that name through two seeded starts, with `updatedAt` unchanged after the second.
- The existing proofs still pass: 10-22's bare-number rename of 5.1 and 10-17's APP-11 correction (its stored entry gives the old label).

**Seed verification (the 10-22 regression in `deferred-items.md`, now resolved).**

*Root cause.* `scripts/verify-csrm-seed.mjs` counted every JSON file in the controls folder against a hard-coded 12, so 10-22's title file made 13 (before: exit 1, `Expected exactly 12 control reference files, found 13`).

*Fix.* A new helper, `scripts/csrm-seed-control-files.mjs`, reads the seed's own `CONTROL_CATALOGUE_FILES` and `CONTROL_TITLE_FILE` declarations from `seed-csrm-data.ts`. Both verifiers now use it instead of a second list. The folder must hold exactly those catalogues plus the title file, and the title file may title only those catalogues.

Running the script and its runtime partner to a pass turned up five more stale assumptions. Each is fixed in the same commit:

| Stale assumption | Origin | Fix |
|---|---|---|
| The ordering check looked for `await loadControlCatalogues(strapi)` | Phase 10 (10-22) | Follows `readControlLibrary(strapi.dirs.app.root)`, and `seedCsrmControls(strapi, controlSeeds` as a prefix |
| The runtime check expected untitled names and modelled a stale control as `sourceData: { stale: true }`, a shape no seed writes, so fixes 2 and 3 rightly treat its values as an operator's | Phase 10 (10-22, fixes 2 and 3) | Applies the D-46 titles, and stores the stale control the way an earlier seed did: an older entry in `sourceData` with the name and description derived from it |
| The runtime check resolved `@strapi/strapi` from `scripts/`, which finds a stale yarn-era install in the root `node_modules` (dated 2026-07-25), and its TypeScript compile failed | Before Phase 10 (pnpm migration) | Resolves Strapi from `apps/backend/package.json`. `node_modules` was not touched |
| The runtime check keyed Functions by menu path, so the API-only Functions, which have no menu path, collided | Before Phase 10 (23 API-only Functions at `5ea2b77`, 24 now) | Keys them by name and menu path, as the seed does |
| Both checks required the Security Analyst Agent's grants to equal the Security Analyst's | Before Phase 10. The agent lacked 23 of the analyst's Functions at `5ea2b77`: administration, release, generation, dashboard, alerts and reports. 10-13 added a 24th, the human-only job read (D-47) | Both now assert the safety invariant the catalogue actually holds: the agent has no Function the analyst lacks. The catalogue is authoritative and frozen in Phase 10 (D-02); no authorisation behaviour changed |

The static script also asserts a root `verify:csrm-seed` package script. The 2026-09-25 overlay (`8495a37`) dropped it, so it is restored as `node scripts/verify-csrm-seed.mjs && node scripts/verify-csrm-seed-runtime.mjs`. The overlay's other dropped scripts (`verify:schema`, `verify:csrm-model`, `verify:keycloak-*`) are outside this fix and stay unregistered.

*After the fix:*
- `node scripts/verify-csrm-seed.mjs` prints `IdamBox CSRM seed catalogue verification passed` (exit 0).
- `node scripts/verify-csrm-seed-runtime.mjs` prints `IdamBox CSRM runtime seed verification passed` (exit 0, 30 s, two boots on a disposable SQLite under `apps/backend/.tmp`, removed afterwards).
- `pnpm verify:csrm-seed` runs both and exits 0 (31 s).

**Tests.**

| File | Test | Before the fix (`ee24167`) | After (`0797c33`) |
|---|---|---|---|
| `apps/backend/tests/control-titles.unit.test.ts` | fix 3: a corrected title covers every limb of its paragraph (all 72 pinned, CPS-230-34 and CPS-230-57 first) | fail: 72 controls still under their 10-22 titles | pass |
| same | fix 3: each title an earlier seed wrote stays listed as superseded | fail: none listed | pass |
| same | fix 3: a well-formed superseded title list is accepted | pass (the parser ignored the key) | pass |
| same | fix 3: the seed refuses a malformed superseded title list (7 cases) | fail: `Missing expected rejection` | pass |
| same | descriptive titles are short noun phrases in the CSRM voice (cap widened to 12 words, 100 characters) | pass | pass |
| `apps/backend/tests/assessment-seed.integration.test.ts` | fix 3: a seeded start renames a control stored under its earlier seeded title, then changes nothing | fail: name stayed `… adverse customer impact` | pass |
| same | fix 3: a seeded start keeps an operator's own name for a seeded control, then changes nothing | fail: the seed overwrote it with `… on standardised terms` | pass |
| `scripts/verify-csrm-seed.mjs` | the static seed verification | fail: `found 13` | pass |
| `scripts/verify-csrm-seed-runtime.mjs` | the runtime seed verification | fail: compile errors, then untitled names and the Function map | pass |

Runs (logs in the session scratchpad, `p10-23-f3-*.log`):
- **RED,** `control-titles.unit` and `assessment-seed.integration`: 36 tests, 31 passed, 5 failed, all on assertions (48 s). `check tdd-red-evidence` returned RED_EVIDENCE_OK for the unit and mounted targets.
- **GREEN,** the same two files with `control-library-bounds.unit`: 38/38 (49 s).
- **Cross-checks:**
  - `administration.integration` (control search pages, the `masking` proof, fix 2's walkthrough searches): 23/23 (35 s).
  - The other four seed files (`questionnaire-seed`, `risk-register-seed`, `analyst-insights-seed`, `analyst-insight-catalogue-seed`): 16/16 (122 s).
- `pnpm --dir apps/csrm api:check`: exit 0, then `git update-index --refresh` on `schema.d.ts`. That command exits 1 only for the operator's two `types/generated` files, as in note 5b.
- **No journey run.** No e2e assertion names a changed title: `ADMIN05_CONTROL_TITLES_LOADED` checks only that CPS-234-15 and PSPF-001 have a non-numeric name. No web file changed.
- **Static checks since `5ea2b77`:**
  - no content type changed;
  - the four vendored catalogues 10-22 guards are unchanged;
  - both role-function catalogue copies are untouched and byte-identical;
  - the specification is untouched.

**Commits.**
- `ee24167` test(10-23): expect descriptive titles that cover every limb and keep operator names
- `0797c33` fix(10-23): correct descriptive titles that narrow their paragraph and keep operator names
- `ac34d19` fix(10-23): verify the seed against the seed's own control files
- the docs commit that records this fix

**Decisions.**
- The pilot's no-narrowing rule outranks 10-22's 8-word voice cap. The cap is now 12 words and 100 characters.
- Names follow the same ownership rule as descriptions (fix 2). The title history lives in the CSRM title file (`supersededTitles`), because `sourceData` holds only the vendored entry, never a CSRM title. This replaces 10-22's accepted overwrite of an operator's name (T-10-64). The other seeded fields still reconcile as before.
- A future change to a descriptive title must add the old title to `supersededTitles`. The parser refuses a list that names the current title, and the unit test pins this round's 72.
- The seed verifiers derive their file list from the seed. The agent-grant equality became the subset invariant the catalogue actually holds.

**Deferred.** The remaining 179 PSPF titles were not audited. The sample failure rate (16 of 30 spread titles, 5 of 8 multi-limb) suggests many of them narrow their paragraph in the same ways. This is logged in `deferred-items.md` for the pilot to schedule. It is now resolved in Fix 3b below.

**Open for the pilot:** the descriptive-title Manual-Only row. Re-walk CPS-230-34, CPS-230-57 and a few of the corrected titles on the development database after the next seeded Strapi start, which renames the 72.

### Fix 3b: the remaining PSPF titles

**Why the audit was widened.** Fix 3 sampled 39 PSPF titles, and 21 of them (55%) narrowed or misstated their paragraph: 16 of the 30 spread evenly across the catalogue and 5 of the 8 multi-limb ones. The pilot had widened the CPS audit to every title after 2 of 5 samples failed. The orchestrator applied the same rule to the PSPF, so this fix audits the other 179 PSPF titles. That resolves the open item in `deferred-items.md`.

**Rule applied.** The rule is the pilot's, applied as in fix 3:
- A title is short, in CSRM's own words, and never misstates or narrows its paragraph.
- It must not drop a limb, party, condition, exception, threshold or qualifier that changes what the requirement covers, and it must not add one.
- An umbrella title that names the whole subject, without listing its parts, drops nothing (as fix 3 kept PSPF-061, PSPF-139 and PSPF-158).
- "In accordance with" a named standard says how a requirement is met, not what it covers, so a title need not name the standard (PSPF-093, PSPF-097, PSPF-195).
- A title may open with the party's name, as fix 3's PSPF-016 and PSPF-167 do, but never with the paragraph's opening phrase. Five drafts that did were reworded (PSPF-025, 037, 051, 055 and 117).
- The cap stays at 12 words and 100 characters. The longest new title is PSPF-188 at 98 characters, and seven run to 12 words (PSPF-013, 037, 095, 188, 193, 213 and 215). A stored name `{number} — {title}` is therefore at most 109 characters, against the contract's 255.

**Audited set and counts.** All 218 PSPF descriptive titles have now been audited: fix 3 reviewed 39 and this fix the other 179.

| PSPF domain | Reviewed in 3b | Changed | Kept |
|---|---|---|---|
| GOV (governance) | 29 | 11 | 18 |
| RISK | 18 | 14 | 4 |
| INFO (information) | 19 | 9 | 10 |
| TECH (technology) | 33 | 14 | 19 |
| PER (personnel) | 61 | 21 | 40 |
| PHYS (physical) | 19 | 6 | 13 |
| **Total** | **179** | **75** | **104** |

Across both fixes, 96 of the 218 PSPF titles changed (21 in fix 3 and 75 here) and 122 were kept. 75 of 179 is 42%, below the sample's 55%, because the sample included eight multi-limb paragraphs by design.

The worksheet is `p10-23-f3b-pspf-review.md` in the session scratchpad. It holds each paragraph, the 10-22 title, the verdict and either the limb restored or the reason the title was kept, in the format of fix 3's worksheet. It is not in the repository.

**Every changed title (75).**

| Control | 10-22 title | Corrected title | Limb or qualifier restored |
|---|---|---|---|
| PSPF-005 | Documented partnership responsibilities of shared service providers | Documented shared service responsibilities for partnerships and security service arrangements | the second limb: security service arrangements with other entities, beside partnerships |
| PSPF-012 | Chief Information Security Officer capability and clearance | Chief Information Security Officer capability, experience and clearance | experience beside capability |
| PSPF-013 | Chief Information Security Officer accountability for cyber risks | CISO accountability to the Accountable Authority for cyber risks and their management | the party held to account (the Accountable Authority) and the second limb: how the program manages the risks |
| PSPF-014 | Skilled and resourced security practitioners | Skilled, empowered and resourced security practitioners | 'empowered' (as PSPF-008) |
| PSPF-020 | Periodic review of the security plan | Annual consideration and at least two-yearly review of the security plan | the thresholds: considered annually and reviewed at least every two years |
| PSPF-022 | Monitoring the effectiveness of the security plan | Security plan effectiveness monitoring and continuous improvement | the second limb: a continuous cycle of improvement |
| PSPF-025 | Specialist training for high-risk roles | Security training targeted at specialist and high-risk positions | specialist positions as a second class of position (10-22 read 'specialist' as the training) |
| PSPF-026 | Procedures for responding to security incidents | Procedures for responding to and managing security incidents | managing beside responding |
| PSPF-028 | Reporting significant security incidents to authorities | Timely reporting of significant or reportable incidents and referrals to authorities | externally reportable incidents, referral obligations and the applicable timeframe |
| PSPF-030 | Procedural fairness in security investigations | Procedural fairness in security investigations, with regard to national security | the qualifier 'with due regard to national security considerations' |
| PSPF-033 | Accountable Authority approval of the annual report | Accountable Authority verification and approval of the annual protective security report | the limb confirming the report's content was verified |
| PSPF-036 | Entity tolerance for security risks | Accountable Authority tolerance for security risks, documented in the security plan | the party setting tolerance and the limb documenting it in the security plan |
| PSPF-037 | Risk steward for each security risk | Named risk steward for every security risk or category, including shared risks | the alternative 'or category of security risk' (10-22 required one per risk) and shared risks |
| PSPF-039 | Accountability for procurement security risks | Procurement security risk accountability, keeping contract decisions within acceptable risk | the second limb: procurement and contract decisions do not expose the entity or government to unacceptable risk |
| PSPF-040 | Security terms in procurement and contracts | Proportionate security terms in procurement, contracts and outsourced arrangements | third-party outsourced arrangements and the qualifier 'proportionate' |
| PSPF-041 | Provider compliance with PSPF requirements | Provider, contractor and subcontractor compliance with entity-specified PSPF requirements | contractors and subcontractors beside providers, and 'relevant ... as detailed by the entity' |
| PSPF-042 | Provider incident reporting in contract terms | Contract terms for provider incident reporting and following investigation directions | the second limb: following direction arising from incident investigations ('reasonable' is not carried; kept by the pilot's ruling, see Fix 3c) |
| PSPF-043 | IRAP reports for consuming entities | IRAP reports for current and prospective consuming entities | entities 'looking to consume' the services |
| PSPF-044 | Monitoring contract security terms over the contract life | Monitoring and reviewing contract security terms over the contract life | review beside monitoring |
| PSPF-047 | Reassessing contractual security risks over time | Managing, reassessing and adjusting contractual security risks over the contract life | managing and adjusting beside reassessing, over the life of the contract |
| PSPF-051 | Managing insider threat in vetted entities | Program against insider threat in entities managing security clearance subjects | the program, and corrects 'vetted entities' to entities that manage Baseline to Positive Vetting clearance subjects |
| PSPF-052 | Varying PSPF requirements in exceptional circumstances | Time-limited variation of PSPF requirements in exceptional circumstances, within risk tolerance | the conditions: for a limited period and consistent with the entity's risk tolerance |
| PSPF-054 | Annual review of alternative mitigations | Annual review and reporting of alternative mitigation decisions | annual reporting beside review |
| PSPF-055 | Business continuity plan for critical services | Continuity planning for critical and risk-warranted services and assets | assets, and other services and assets when a threat and security risk assessment warrants |
| PSPF-057 | Notifying personnel of heightened emergency risk | Notifying likely impacted personnel of heightened emergency risk | corrects the party: personnel likely to be impacted, not all personnel |
| PSPF-058 | Originator control of classification changes | Originator control of sanitisation and classification changes | sanitisation beside reclassification and declassification |
| PSPF-059 | Assessing the value and sensitivity of information | Originator assessment of information value, importance and sensitivity | the party (the originator) and 'importance' |
| PSPF-062 | Applying minimum protections to classified information | Applying minimum protections and handling to OFFICIAL and security classified information | OFFICIAL information (not security classified) and the handling requirements |
| PSPF-064 | Marking security caveats as text | Text-marked security caveats, only alongside a security classification | the second limb: a caveat appears only with a security classification |
| PSPF-070 | Classified discussions only in approved locations | Classified discussions and dissemination only in approved locations | dissemination of classified information beside discussions |
| PSPF-071 | Operational controls proportional to information value | Operational controls proportional to information value, importance and sensitivity | importance and sensitivity beside value |
| PSPF-072 | Register of TOP SECRET and accountable material | TOP SECRET and accountable material recorded in an auditable register | the qualifier 'auditable' |
| PSPF-074 | Destroying classified information after retention | Destroying classified information after retention or at authorised destruction dates | the second trigger: reaching authorised destruction dates |
| PSPF-075 | Need-to-know access for people outside the entity | People outside the entity: needed clearance, need-to-know and compliant transfer | the clearance (where required) and the transfer under the Minimum Protections and Handling Requirements |
| PSPF-085 | Risk-based application of ISM controls | Risk-based application of ISM controls and guidelines | the ISM cyber security guidelines beside its controls |
| PSPF-086 | Authorisation to operate on accepted residual risk | Authorisation to operate on accepted residual risk before handling government data | the condition: authorised before the system processes, stores or communicates government information |
| PSPF-087 | Risk-based decisions to authorise systems | ISM risk-based decisions to authorise new or changed systems | changes to existing systems and the ISM basis (reauthorisation is generalised under 'authorise') |
| PSPF-090 | Reassessing authorisation after significant change | Reassessing authorisation after significant system or security environment change | the second trigger: a considerable change to the system's security environment |
| PSPF-094 | Security Zone storage for SECRET technology assets | Security Zone storage for technology assets at SECRET or below | 'or below' (10-22 read SECRET only) |
| PSPF-095 | Rack storage for TOP SECRET technology assets | SCEC-endorsed racks or compartments in Zone Five for TOP SECRET technology assets | compartments, SCEC endorsement and the Zone Five area ('accredited' is not carried; kept by the pilot's ruling, see Fix 3c) |
| PSPF-096 | Certified outsourced facilities for catastrophic-impact assets | ASIO-T4 certified and ASD accredited outsourced facilities for catastrophic-impact assets | the ASD accreditation beside the ASIO-T4 certification |
| PSPF-108 | Blocking connections to malicious endpoints | Blocking connections to and from known malicious endpoints | connections from malicious endpoints, and 'known' |
| PSPF-109 | IRAP-assessed cloud service providers | Using only cloud providers IRAP-assessed in the last 24 months | the 24-month recency (as PSPF-114) |
| PSPF-110 | Acting on IRAP assessment findings | Risk-based action on IRAP assessment recommendations and findings | recommendations beside findings, and the risk-based approach |
| PSPF-111 | Certified hosting for classified information | Certified hosting for classified information and systems of government significance | the second class: systems of government significance information and data |
| PSPF-115 | Receiving and resolving disclosed vulnerabilities | Receiving, verifying, resolving and reporting disclosed vulnerabilities from any source | verifying and reporting, and disclosures from internal and external sources |
| PSPF-117 | Identity verification to Level 3 assurance | Identity verified to at least Level 3 assurance before employment | the threshold 'at least', and the check made before employment |
| PSPF-119 | Confirming eligibility to work for the government | Confirming eligibility to work in Australia and for the government | eligibility to work in Australia |
| PSPF-121 | Checks before granting temporary access | Checks before temporary access, and Negative Vetting 1 for TOP SECRET | the second limb: an existing Negative Vetting 1 clearance before TOP SECRET temporary access |
| PSPF-128 | Third-party agreement before temporary access | Agreement of other information owners before temporary access | other entities and third parties, generalised as 'other information owners' |
| PSPF-130 | Controlling access to supporting technology | Enabling official information access and controlling access to supporting technology | the main limb: enabling access to official information ('appropriate' is not carried) (completed in Fix 3d: 'appropriate', the need-to-know qualifier, is restored) |
| PSPF-133 | Clearance requirements for caveated information | Clearance and suitability requirements for caveated information access | suitability requirements beside clearance |
| PSPF-134 | Individual user identification for classified systems | Per-user identification, authentication and authorisation for classified system access | authentication and authorisation beside identification |
| PSPF-140 | Use of authorised security vetting agencies | Security vetting by authorised vetting agencies or, where authorised, the entity | the alternative: authorised entities conducting their own vetting |
| PSPF-145 | Identifying positions that need a clearance | Identifying positions that need a clearance and documenting the level | the limb documenting the clearance level required |
| PSPF-148 | Business need before a citizenship eligibility waiver | Exceptional business need and risk assessment before a citizenship eligibility waiver | 'exceptional' and the risk assessment |
| PSPF-150 | Business need before a checkable background waiver | Exceptional business need and risk assessment before a checkable background waiver | 'exceptional' and the risk assessment |
| PSPF-160 | Procedural fairness in clearance decisions | Procedural fairness in adverse clearance decisions, preserving the national interest | 'adverse' (10-22 covered every decision) and 'without compromising the national interest' |
| PSPF-165 | Monitoring conditional clearance compliance | Monitoring conditional clearance compliance and reporting breaches to the vetting agency | the second limb: reporting non-compliance to the Authorised Vetting Agency |
| PSPF-169 | Annual review of eligibility waivers | Reviewing eligibility waivers annually, before revalidation and before position transfers | the two further triggers: before revalidation and before a proposed position transfer |
| PSPF-177 | Sponsoring entity concerns passed to the vetting agency | Sponsoring Entity concerns passed to the vetting agency where appropriate | the qualifier 'where appropriate' (as PSPF-167) |
| PSPF-180 | Travel briefings for Negative Vetting 2 holders | International travel briefings for Negative Vetting 2 and higher holders | 'and higher' clearance holders, and international travel |
| PSPF-181 | Advising security staff of adverse separations | Advance advice to security staff of adverse cessations of employment | the timing: advice before separation or transfer |
| PSPF-183 | Security information for the receiving entity | Security information for a receiving entity on request | the condition 'when requested' |
| PSPF-186 | Withdrawing access on separation | Withdrawing access on separation or transfer | transfer beside separation |
| PSPF-188 | Recording clearance status changes on separation | Recording separation clearance changes and lawful security file transfers between vetting agencies | the limb transferring personal security files between Authorised Vetting Agencies, as far as legislation allows |
| PSPF-192 | Access controls designed for the highest risk | Facility access controls designed or modified for the highest risk level | modifying facilities beside designing them |
| PSPF-193 | Construction to ASIO Technical Notes for public areas | Construction to ASIO Technical Notes for public areas and unclassified asset storage | the second area: where unclassified physical resources and technical assets are stored |
| PSPF-199 | SCIF accreditation for TOP SECRET systems | ASD-accredited SCIFs for TOP SECRET systems and compartmented information | Sensitive Compartmented Information and the accrediting party (ASD) |
| PSPF-203 | Containers and secure rooms by business impact | Containers and secure rooms by Security Zone and business impact | the Security Zone as the second basis |
| PSPF-205 | Access control for authorised personnel | Zone access control for authorised personnel, vehicles and equipment | vehicles and equipment beside personnel |
| PSPF-207 | Ongoing facility access for people not engaged | Approved ongoing facility access for people neither engaged nor contracted | the approval, and people covered by a contract or agreement as outside the rule |
| PSPF-213 | Cyber risk reporting to the Audit Committee | Cyber risk reports to each Audit Committee and biannual uplift plan progress | every meeting, and the second limb: biannual reporting on the strategy and uplift plan (completed in Fix 3c: 'each Audit Committee' misread every meeting of the one committee, and the strategy was missing) |
| PSPF-215 | Cyber Security Partnership Program participation | Cyber Security Partnership Program participation and notifying ASD of risk profile changes | the second limb: notifying ASD of a change in the risk profile |
| PSPF-218 | Withholding temporary access while a waiver is considered | Withholding temporary or provisional access from waiver subjects until vetting completes | provisional access, subjects who already hold a waiver, and 'until vetting is complete' (completed in Fix 3c: 'waiver subjects' did not say a waiver granted or pending) |

All 75 pass 10-22's anchor, opening-copy, uniqueness and form checks, and fix 3's 12-word, 100-character voice rule.

**Titles reviewed and kept (104).** Each reason is in the worksheet. In summary:
- **Umbrella titles that name the whole subject:** PSPF-009, 018, 049, 063, 066, 067, 078, 079, 082, 089, 092, 107, 124, 125, 126, 143, 153, 164, 166, 187, 194, 198, 208 and 211. PSPF-126 and PSPF-143 name the subject without stating the rule, as fix 3 kept PSPF-139.
- **Titles that name the whole requirement:** PSPF-002, 003, 004, 006, 007, 010, 015, 017, 019, 021, 024, 027, 029, 032, 034, 035, 045, 050, 056, 060, 065, 069, 073, 084, 088, 112, 116, 118, 120, 123, 127, 131, 132, 135, 136, 138, 141, 142, 146, 147, 154, 155, 156, 157, 161, 162, 163, 168, 170, 171, 172, 173, 175, 176, 178, 179, 184, 185, 190, 191, 196, 200, 201, 202, 206, 209, 210, 214, 216 and 217. Four of them, PSPF-112, 155, 175 and 190, were corrected in Fix 3c: the independent audit found that each leaves out or blurs a word of its paragraph (the panel's name, 'eligibility', finishing in time, 'major').
- **Essential Eight at Maturity Level Two:** PSPF-099 to PSPF-105, which follow fix 3's kept PSPF-106.
- **"In accordance with" a standard (how, not what):** PSPF-093, 097 and 195.

**Reconciling the development database.** This fix needs no new mechanism. Fix 3's ownership rule reads `supersededTitles`, which now lists 96 PSPF controls (fix 3's 21 and these 75). Each lists the single title 10-22 seeded for it. On the pilot's next seeded Strapi start, each of the 75 controls still stored as `{number} — {10-22 title}` is renamed to its corrected title, keeping its documentId and relations. A name an operator edited is kept. `parseControlTitles` already refuses a list that names a current title, a control the file does not title, or a malformed title, so the seed loads the new list only because each entry is valid.

**Tests.**

| File | Test | Before the fix (`a99efae`) | After (`feac941`) |
|---|---|---|---|
| `apps/backend/tests/control-titles.unit.test.ts` | fix 3b: every corrected PSPF title covers every limb of its paragraph (all 75 pinned; none overlaps fix 3's 72) | fail: 75 controls still under their 10-22 titles | pass |
| same | fix 3b: each PSPF title an earlier seed wrote stays listed as superseded (and the PSPF list holds 21 + 75 controls) | fail: none of the 75 listed | pass |
| same | the 21 existing tests: form rules, the 12-word and 100-character voice rule, anchors, uniqueness, 386 titles, and fix 3's 72 pins and superseded-list validation | pass | pass |

Runs (logs in the session scratchpad, `p10-23-f3b-*`):
- **RED:** `control-titles.unit` alone, 23 tests: 21 passed and 2 failed, both on assertions (`p10-23-f3b-red.tap`). `check tdd-red-evidence` returned RED_EVIDENCE_OK for the target test.
- **GREEN:** four files, 63 of 63 passed in 80 s, with the tests compiled by `tsc -p tests/tsconfig.json` (clean build, no `noEmitOnError` workaround needed). The four files are:
  - `control-titles.unit` (23);
  - `control-library-bounds.unit` and `assessment-seed.integration` (17), which include fix 3's mounted reconcile proofs: a control stored under its earlier seeded title is renamed, and an operator's own name is kept;
  - `administration.integration` (23).
- **`pnpm verify:csrm-seed`:** exit 0 in 31 s. Both the static and the runtime seed verifications passed.
- **No journey run.** No web, e2e or Strapi source file names any of the 75 old titles. Only the title file's `supersededTitles` and the unit test do. No web file changed.
- **Static checks since `5ea2b77`:**
  - the four vendored catalogues are byte-identical;
  - no content type changed;
  - this fix touched neither the specification nor either role-function catalogue copy, and the two copies are byte-identical.

**Commits.**
- `a99efae` test(10-23): expect every remaining PSPF title to cover its paragraph
- `feac941` fix(10-23): correct the remaining PSPF titles that narrow their paragraph
- the docs commit that records this fix

**Decisions.**
- Every PSPF title was audited rather than a further sample. This matches the pilot's call for CPS 230 and CPS 234 after a similar failure rate.
- All 75 corrections are pinned, rather than a representative subset, so that a later edit cannot quietly reintroduce a narrowing title. Fix 3 pinned all 72 of its corrections in the same way.
- Party names count as subjects, not as copied openings. Titles that repeated the paragraph's opening phrase were reworded.

**Deferred.** None. The open PSPF item in `deferred-items.md` is resolved.

**Open for the pilot:** the descriptive-title Manual-Only row. After the next seeded Strapi start, which renames fix 3's 72 controls and these 75, re-walk a few PSPF corrections (for example PSPF-094, PSPF-121 and PSPF-218).

### Fix 1: an unchanged Save assessment wrote

**Root cause.** `AssessmentMetadata.submit` in `assessment-editor.tsx` always called `saveAssessmentAction`, while the Risk and mitigation control editors compare the form with its starting values and stop with `No changes to save.` (UI-SPEC §13.4, "Any, with nothing changed"). The write was not harmless. Strapi treats every accepted assessment save as a review transition (`transitionForAcceptedEdit`, `assessment-workflow.ts`): an in-review, release-ready assessment goes back to `draft`, so an unchanged save withdrew a completed review.

**Change.**
- `assessment-domain.ts` (zod-free) now holds:
  - `changedWritableValues`, the one comparison the three forms share (the Risk and mitigation control editors' local copies are gone);
  - `assessmentWritableFields`, held to `assessmentUpdateInputSchema` by a unit test;
  - `assessmentDetailsFormValues` and `normalizeAssessmentDetails`, the details form's starting values and the normalisation it sends, so an untouched form compares equal to the stored assessment;
  - `assessmentSaveWrites`, which decides whether a save has anything to write.
- Unchanged details send no request and show `No changes to save.` in the Save assessment status region, with no icon. Focus stays on Save assessment.
- **Decision:** a drafted assessment still saves when nothing changed. Strapi records the analyst's review on that save (D-13). That covers a generated draft and a draft whose review a later edit withdrew, and the page itself says "Save the assessment again to record a fresh review". Blocking it would strand both. In review, an unchanged save never sends.

**Tests.**

| File | Test | Before (`de7ab44`) | After (`d1c75b7`) |
|---|---|---|---|
| `assessment-editor.test.tsx` | sends nothing for unchanged assessment details and says No changes to save. in the same region (also: a change undone is no change; the next real change confirms) | fail: status empty, the action was called | pass |
| same | reads empty stored details as unchanged | fail | pass |
| same | still saves an unchanged drafted assessment, because that save records the review (D-13) | pass (guard) | pass |
| `assessment-domain.test.ts` | what a save has to write (6 tests: comparison, field list against the schema, blank normalisation, in-review unchanged, in-review changed, draft) | not present | pass |
| `e2e/assessment-release-workflow.spec.ts` | `ASSESS06_DETAILS_SAVE_CONFIRMED` (the changed save shows `Assessment details saved at …`), `ASSESS06_UNCHANGED_SAVE_NOTED` (`No changes to save.`) and `ASSESS06_UNCHANGED_SAVE_WRITES_NOTHING` (no non-GET request during the unchanged save, and the assessment stays In review) | not present | pass |

- **RED:** `assessment-editor.test.tsx` 59 tests, 57 passed and 2 failed on assertions. `check tdd-red-evidence` returned RED_EVIDENCE_OK (`p10-23-f1-red.json`).
- **GREEN:** `src/features/assessments` 15 files, 320/320.
- **Journey:** the first release-journey run failed on a focus assertion I had added (`toBeFocused` read `inactive` in that headless page). The unit test already proves focus, so I dropped that assertion; the copy and no-request assertions had passed. On the rerun the release journey passed, 1 of 1 (desktop), in 1.2 min.

**Commits.** `de7ab44` test(10-23): expect an unchanged Save assessment to send nothing; `d1c75b7` fix(10-23): send nothing for an unchanged Save assessment.

### Fix 4: the Next action on RAR-E2E-P7-DUESOON-001 and RAR-E2E-P7-OVERDUE-001

**Root cause, with evidence.** The line and the actions read different facts.
- **The line.** Strapi's `projectRequestLifecycle` (`request-lifecycle.ts`) picks the step from relations alone. For any request past draft with no questionnaire, `highestMatchingStep` returns the Submitted step, and the analyst action for it is `Generate the questionnaire.`.
- **The actions.** The analyst page shows the generation card only when `requestStatus === 'submitted'` (`assessment-detail.tsx`). That is Strapi's own rule: `generateQuestionnaire` and the generation job refuse anything else with `REQUEST_NOT_ELIGIBLE` (`questionnaire-generation-workflow.ts`).
- **The fixtures.** `seed-analyst-insights.ts` (Phase 7, D-23) writes RAR-E2E-P7-OVERDUE-001 as `under-review` and RAR-E2E-P7-DUESOON-001 as `questionnaire-in-progress`, both with no questionnaire and no assessment, so that no request is `submitted`. Its test pins this: `REQUEST_COULD_START_GENERATION_*`, four requests and two assessments.
- **The workflow cannot reach these states.**
  - `questionnaire-in-progress` is written only when a Requestor saves an answer on a released questionnaire (`nextRequestStatusAfterDraft`).
  - `under-review` is written only on an accepted assessment edit (`transitionForAcceptedEdit`).
  - The only questionnaire removal is a replacement, which needs `submitted`.

So the impossible fixture state exposes the mismatch, but the cause is that the line and the actions read different facts.

**Change.** The line now follows the actions' fact, in the zod-free `request-domain.ts`:
- `offersQuestionnaireGeneration(request)` (a submitted request) decides whether the analyst page shows the questionnaire card.
- `analystRequestLifecycle(request)` drops the served analyst action of the Submitted step when the page does not offer generation, so no Next action line shows. The served steps are unchanged.

Both page decisions now read one predicate. The requestor's page keeps the served lifecycle: its actions already read the same fact as its line (`draft`).

**Fixture not changed (deferred).** A consistent fixture would need a released questionnaire on the due-soon request and a questionnaire and an assessment on the overdue request. That breaks the fixture's pinned invariants and adds records to journeys that count questionnaires and assessments. It is logged in `deferred-items.md`: the stepper on those two requests still shows `Submitted` as the current step beside their status badge.

**Tests.**

| File | Test | Before (`7c371d6`) | After (`8c4e2a7`) |
|---|---|---|---|
| `assessment-review-workflow.test.tsx` | names no questionnaire generation for an `under-review` / `questionnaire-in-progress` request with no questionnaire, because none is offered (the two fixture shapes) | fail: the line read `Next action: Generate the questionnaire.` | pass |
| same | names questionnaire generation for a submitted request with no questionnaire, beside the Generate control | pass (guard) | pass |
| `request-domain.test.ts` (new) | 7 tests: generation offered only for `submitted`; Submitted step kept for a submitted request; no action for `under-review`, `questionnaire-in-progress` and `risk-assessment-drafted` (steps kept); other served actions and the requestor's kept; no lifecycle and terminal pass through | not present | pass |

- **RED:** `assessment-review-workflow.test.tsx` 57 tests, 55 passed and 2 failed on assertions. RED_EVIDENCE_OK (`p10-23-f4-red.json`).
- **GREEN:** `src/features/requests` and `src/features/assessments` 25 files, 392/392.
- **No journey change.** No journey asserts a Next action on such a request. `request-relationship-states.spec.ts` asserts the requestor's line, and the questionnaire governance journey's request holds a questionnaire.
- **No Strapi change.**

**Commits.** `7c371d6` test(10-23): expect no Next action naming generation the page does not offer; `8c4e2a7` fix(10-23): keep the analyst's Next action to the actions the page offers.

### Fix 5: separators, labels and running-text case

All three surfaces are in Phase 10's copy scope (UI-SPEC §15.2, §16 and §17.1, and the X-4 rule), so nothing is deferred.

**Changes.**
- `risk-details.tsx`:
  - The related assessment reads `{assessment number} · {title}` (it was an em dash, X-4).
  - The labels `Impacted Information system` and `Impacted Information asset` become `Information system impacted` and `Information asset impacted`, the labels the editors and the released Risk use (UI-SPEC §13.1 and §15.2).
- `assessment-request-link.tsx`: `{request number} · {title}` (it was a colon, X-4), on both the analyst and the released assessment views. The file joins the interface copy guard.
- **CSV import.** `administration-config.ts` gives each kind a running-text noun: `control`/`controls`, `information system(s)` and `information asset(s)`, while `Risk Type(s)` keeps its capitals as the UI-SPEC writes it. `csv-import-flow.tsx` uses the noun in its three running sentences: the guidance, the confirm summary and the result load failure. Titles, buttons and links keep the collection name (`Import Controls from CSV`, `View Controls`). The guidance now reads `A row whose control number matches an existing control updates it. Other valid rows create new controls. …`.
- **Decision:** the e2e and unit expectations changed together in the test commit, before the fix, as the TDD order requires.

**Tests.**

| File | Test | Before (`1fae217`) | After (`f193a3d`) |
|---|---|---|---|
| `risk-details.test.tsx` | renders one complete Risk in the five sections (labels; link `RA-2026-001 · Customer portal review`; no `Impacted Information`) | fail | pass |
| `assessment-editor.test.tsx` | renders the analyst request link (`RAR-2026-0042 · Customer portal security assessment`) | fail | pass |
| `released-assessment.test.tsx` | renders all fields of the released projection (same link) | fail | pass |
| `administration-workflow.test.tsx` | UAT-054 explains matching in plain words (lower-case control) | fail | pass |
| `interface-copy-guard.test.ts` | lists `assessment-request-link.tsx`; it shows no internal term | pass | pass |
| `e2e/assessment-navigation-lifecycle.spec.ts` | the originating request link is named `{number} · {title}` | not run before | pass |

- **RED:** the five unit files, 192 tests: 188 passed and 4 failed on assertions. RED_EVIDENCE_OK (`p10-23-f5-red.json`).
- **GREEN:** `risks`, `assessments`, `administration` and `lib/performance`, 28 files, 570/570.

**Commits.** `1fae217` test(10-23): expect middle-dot joins, sentence-case labels and lower-case control; `f193a3d` fix(10-23): join identifiers with a middle dot and keep running text in sentence case.

### Fix 6: focus after Discard mitigation changes

**Rule relied on.** X-5 in `docs/design/csrm-design-direction.md`, In-place edit form: "Focus moves to its first field; saving moves focus to the saved item and discarding returns it to the control that opened the form."

**Root cause.** `MitigationControlList` closed the form on discard (`setMode(null)`) and moved focus nowhere. The form held focus, so focus fell to the body when the form unmounted.

**Change.** In `mitigation-control-list.tsx`, discarding an edit returns focus to that control's `Edit mitigation control`, and discarding a new control returns it to `Add mitigation control`. Focus moves once the button is back on the page, using the same pending-focus effect as the assessment editor's add controls. An unchanged edit save closes through the same path, so it also returns to `Edit mitigation control`.

**Tests.**

| File | Test | Before (`3786559`) | After (`c5cdf00`) |
|---|---|---|---|
| `risk-details.test.tsx` | returns focus to Edit mitigation control after its changes are discarded (X-5); nothing is sent | fail: focus on the body | pass |
| same | returns focus to Add mitigation control after a new control is discarded (X-5) | fail | pass |
| `e2e/risk-register-workflow.spec.ts` | `RISK_DISCARD_RETURNS_FOCUS`: after the journey's discard, `Add mitigation control` is focused | not run before | pass |

- **RED:** `risk-details.test.tsx` 25 tests, 23 passed and 2 failed on assertions. RED_EVIDENCE_OK (`p10-23-f6-red.json`).
- **GREEN:** `src/features/risks` 8 files, 128/128.

**Commits.** `3786559` test(10-23): expect focus back on the opening control after a mitigation discard; `c5cdf00` fix(10-23): return focus to the opening control after a mitigation discard.

### Fixes 1, 4, 5 and 6: runs

All runs had no dev server running (`netstat` printed nothing). Logs are in the session scratchpad (`p10-23-f1-*`, `p10-23-f4-*`, `p10-23-f5-*`, `p10-23-f6-*` and `p10-23-f1456-*`).
- **Journeys** (`risk-register-workflow`, `administration-workflow`, `assessment-navigation-lifecycle`, `assessment-release-workflow`): 12 passed (desktop 9, mobile 3), 0 failed, 0 flaky, 0 skipped, in 3.0 min. Next logged the known `destination stream closed early` 18 times. The run left the tree unchanged, and `settleElementWidth` was not touched.
- **Full web suite:** 130 files, 2,768/2,768, in 40.6 s.
- **`typecheck` and `lint`:** clean.
- **Not changed:** no Strapi source, contract, catalogue or content type.
- **Housekeeping:** fix 1's failed first journey run left its harness database and build under the ignored `apps/backend/.tmp` and `apps/csrm/.tmp`. I removed those two run-scoped paths.

**Deferred.** One item, in `deferred-items.md`: the Phase 7 fixtures' unreachable state, whose stepper still shows `Submitted` (fix 4).

**Open for the pilot.** Re-walk four things:
- an unchanged Save assessment on ASM-E2E-P7-MUTABLE-001;
- the two fixtures' request pages, which now show no Next action line;
- the Risk Register detail's related assessment, labels and discard focus;
- the Controls CSV guidance.

The full gate reruns in the next agent.

### Fix 7: Control titles wrap at 1440 (B3)

Walkthrough round 2 (2026-10-03). The pilot's re-walk confirmed fixes 1, 2, 4, 5 and 6 at 375 and 1440 with no data change, and found two code defects: this one and fix 8. Both are GSD Rule 1 deviation fixes, failing test first. No control title changed; the pilot sends a further title pass, and the full gate runs once after it.

**Root cause.** The controls `Name` column in `administration-workspace.tsx` did not use the DataTable long-text option (`wrap`, direction §4 DataTable, X-3). Its cell kept the table primitive's `whitespace-nowrap`, so a long title set the column's width. On the CPS 230 page at 1440 the table was 1232px wide in a 1102px region (the pilot measured Name at 623px), so Type was clipped and Reference was out of view.

**Change.**
- The controls `Name` and `Framework` columns and the Risk Type `Description` column set `wrap: true`. Each cell then wraps within 14rem to 28rem, and its content clamps to two lines (`line-clamp-2`). The full text stays in the DOM and prints whole (the existing print rule).
- Framework is included because framework names are long titles too. The Privacy Act framework name is 85 characters and would hold a 1440 page wide on its own.
- No new styling: the change uses the table component's own option and the clamp the Risk Register statement already uses.

**Other lists checked.**
- Information Systems and Information Assets: names, types, owners, locations and flags are short record names or closed values. They stay on one line, and the systems list keeps its own backstop (ADMIN05_SYSTEM_OWNER_COLUMNS, still passing).
- The other DataTables with long free text are not Phase 10 surfaces: `Title` on the request, assessment and questionnaire lists, and `Summary` on the assessment and released-assessment lists. An overflowing table there scrolls inside its labelled region (D-29). They are logged in `deferred-items.md`.

**Tests.**

| File | Test | Before (`15b08f7`) | After (`ee7c673`) |
|---|---|---|---|
| `administration-workflow.test.tsx` | B3 wraps long control titles, framework names and Risk Type descriptions within the long-text bounds (the cells carry `whitespace-normal min-w-56 max-w-md` and the text `line-clamp-2`; number, type and reference stay on one line) | fail: the title was bare text in a `whitespace-nowrap` cell | pass |
| `e2e/administration-workflow.spec.ts` | `ADMIN05_CONTROL_TITLES_WRAP`: at 1440, on `?q=CPS-230` and `?q=APP-1`, the table is no wider than its region after `settleElementWidth`, `data-overflow` is `false`, and Name, Type and Reference sit inside the region; the longest CPS 230 title on the page spans more than one line | fail: `CPS-230` table 1232px > region 1102px | pass |

- **RED:** `administration-workflow.test.tsx` 43 tests, 42 passed and 1 failed on its assertion. `check tdd-red-evidence` returned RED_EVIDENCE_OK (`p10-23-f7-red.json`). The Controls journey (desktop, `@administration-controls`) failed on the width assertion: `Expected: <= 1102, Received: 1232`.
- **GREEN:** `src/features/administration` and `data-table.test.tsx`, 4 files, 71/71. The Controls journey passed, 1 of 1, in 57.8 s.
- **D-29 region helper:** no step pinned the Controls table as overflowing at 1440, so no expectation changed. The helper follows the measured width, and it now records `data-overflow` `true` at 768, `false` at 1280 and `false` at 1440.

**Browser measurements at 1440 (production harness, `p10-23-f78-e2e.json`).**

| Page | Table width | Region width | Longest title's Name cell |
|---|---|---|---|
| `/app/admin/controls?q=CPS-230`, before | 1232px | 1102px | one line, column 623px (pilot) |
| `/app/admin/controls?q=CPS-230`, after | 1102px | 1102px | `Risk-based control monitoring and testing, senior management reporting and timely rectification`: 2 lines, cell 464 × 44px, text 36px tall (one line 16px) |
| `/app/admin/controls?q=APP-1`, after | 1102px | 1102px | (framework column wraps) |

**Commits.** `15b08f7` test(10-23): expect long control titles to wrap at 1440 (B3); `ee7c673` fix(10-23): wrap long control titles in the Controls list at 1440 (B3).

### Fix 8: named picker popovers (aria-dialog-name)

**Root cause.** Every picker draws its list in a Radix `PopoverContent`, and Radix gives that element `role="dialog"`. The pickers never name it, so axe reports `aria-dialog-name` (serious) whenever a list is open.
- The affected pickers: `RelationPicker` (Control, system and asset), `OwnerCombobox` (risk, treatment and control owners), `RelationMultiSelect` (the request's systems and assets) and the Risk Register's relation filters.
- The route sweep never caught it, for two reasons: `aria-dialog-name` is an axe best-practice rule, which the WCAG tags never run, and no sweep scanned a list while it was open.

**Which APG variant, and why.** I read each component's focus and key handling first.
- Each opens with `onOpenAutoFocus` prevented.
- Its options are `tabIndex={-1}` buttons that prevent `mousedown`.
- Arrow keys move `aria-activedescendant` while focus stays in the input.
- Choosing returns focus to the input, or keeps it there.

That is the ARIA APG combobox with a **listbox popup**, not a dialog popup. So the popup must not be a dialog:
- The `PopoverContent` passes `role={undefined}`. That overrides Radix's default, so the positioning wrapper is a plain element with no role. `role="presentation"` was not used: Radix makes the element focusable (`tabIndex=-1`), and a presentational role on a focusable element is a role conflict.
- Each input keeps `role="combobox"` and `aria-expanded`, and adds `aria-haspopup="listbox"`.
- Each input sets `aria-controls` to the listbox while the listbox is shown. `OwnerCombobox`, `RelationMultiSelect` and the filters had pointed at a missing id while the list was loading.
- The status lines (`role="status"`) and failures with Retry (`role="alert"`) are announced through their own live roles. Retry is reached as before.
- **More filters** on the Risk Register is different: it moves focus into its fields, so it is a genuine dialog. It is now named by its title (`aria-labelledby` to the `PopoverTitle`, which gains an id).

Every keyboard behaviour is unchanged, and the existing unit tests still pass: the list opens on typing, ArrowDown or a press, never on Tab, and Enter never submits the form.

**Two more serious findings from the new open-list scan.** That scan runs this spec's Label in Name rule, and with a list open it found two serious `label-content-name-mismatch` defects in Phase 10 components. Fix 8's criterion is no serious violation with the list open, so both are fixed here, test first.
- **A Control option** was named by its title line (`aria-label`), but its framework line was part of its visible text. The two lines read together as `…informationPrivacy Act…`, which the name did not contain. The framework line is now `aria-hidden`. It is still the option's description through `aria-describedby`, so a screen reader still hears it, and the option keeps its title-line name, so `Selected control: {label}` is unchanged.
- **A readiness Risk row** (10-21) is named `{risk number}: {n} outstanding`. Its number and its count were adjacent elements with no space, so the visible text ran together as `RSK-…-0011 outstanding`. A space now separates them.

**Other pickers checked.**
- The Administration form's `Applicable Controls` search renders its listbox inline, with no popover, so it is unaffected.
- The Risk Register's relation filters had the same defect and are fixed in the same way. Its More filters popover was the one genuine dialog, and it is now named.
- The only other `PopoverContent` in `src` is More filters itself.

**Tests.**

| File | Test | Before | After (`d6e29c5`) |
|---|---|---|---|
| `relation-picker.test.tsx` | opens a listbox popup that the combobox controls, with focus kept in the input and no dialog; announces its status line and a failed search with Retry search, without a dialog | fail (`ba1d9bb`): no `aria-haspopup`, a `dialog` rendered | pass |
| same | names an option by its title line and describes it with the framework line, which is not part of its label text | fail (`d045322`): the framework line was label text | pass |
| `owner-combobox.test.tsx` | `OwnerCombobox` opens a listbox popup it controls (and no `aria-controls` while only the status shows); announces a failed search with Retry owner search, without a dialog; `RelationMultiSelect` opens a listbox popup it controls | fail (`ba1d9bb`) | pass |
| `risk-register.test.tsx` | names the More filters dialog by its title and opens each relation filter as a listbox, not a dialog | fail (`ba1d9bb`): More filters had no name | pass |
| `assessment-editor.test.tsx` | keeps a Risk row’s visible words the words of its name (Label in Name) | fail (`ba1d9bb`): `RSK-00422 outstanding` | pass |
| `e2e/accessibility.spec.ts` | picker lists pass axe while open at 1440 and 375 (below) | fail (`ba1d9bb`): `aria-dialog-name` on the open Control picker's popover, and `label-content-name-mismatch` | pass |

- **The browser proof.** The new test signs in as Bob and opens every picker list by typing a search, without choosing. It runs at 1440 and at 375:
  - the assessment editor of `ASM-E2E-P7-MUTABLE-001` (in review): Information system impacted, Information asset impacted, Risk owner, Control and Control owner;
  - the Risk Register detail of `RSK-DEV-MUTABLE-001`: Edit risk's system, asset, Risk owner and Treatment owner, then a new mitigation control's Control and Control owner;
  - the Risk Register's Risk owner filter, in More filters at 1440 and in the Filters sheet at 375;
  - a new request's two relation searches.
- **Each scan.** With the list open, the test scans with the WCAG tags, Label in Name and best practice, and the result's record proves `aria-dialog-name` ran. It asserts no serious or critical violation, that the listbox popup is not a dialog, `aria-haspopup="listbox"`, `aria-controls` equal to the listbox id, and focus still in the input. Escape then closes the list. Nothing is chosen, saved or submitted: Edit risk is left by navigation and the mitigation form is discarded.
- **Result.** 28 scans (14 per width), with 0 serious or critical violations. Each scan reports one moderate best-practice finding, `region`: the popup is portalled to the end of `body`, outside the landmarks. That is how every Radix popover renders, and it is not a WCAG rule.
- **RED:**
  - The three picker files: 42 tests, 36 passed and 6 failed on their assertions. RED_EVIDENCE_OK (`p10-23-f8-red.json`).
  - The readiness test: 60 tests, 59 passed and 1 failed. RED_EVIDENCE_OK (`p10-23-f8b-red.json`).
  - The option test: 21 tests, 20 passed and 1 failed. RED_EVIDENCE_OK (`p10-23-f8c-red.json`).
  - The e2e test failed on its first scan with `aria-dialog-name` (the Radix `role="dialog"` popover) and the readiness `label-content-name-mismatch`. A first RED run with the WCAG tags alone showed only the readiness defect, which is how I found that `aria-dialog-name` is a best-practice rule. The scan was widened before the RED commit.
- **GREEN:** the picker, assessment, risk and request feature files, 24 files, 477/477.
- **One test correction in the fix commit.** The first GREEN run stopped at the Risk Register filter because the scan looked for the first `option` in any open popover, and More filters holds native selects whose options are never visible. The locator now looks inside the listbox. The product passed that step on the rerun, unchanged.

**Commits.** `ba1d9bb` test(10-23): expect picker popups to be listboxes, not unnamed dialogs; `d045322` test(10-23): expect a control option's framework line to describe it, not name it; `d6e29c5` fix(10-23): make picker popups listboxes and name the More filters dialog.

### Fixes 7 and 8: runs

All runs had no dev server running (`netstat` printed nothing before each Playwright run). Logs are in the session scratchpad (`p10-23-f7-*`, `p10-23-f8*` and `p10-23-f78-*`).
- **Affected Playwright specs** (`administration-workflow`, `accessibility`, `assessment-release-workflow`, `risk-register-workflow`, both projects, production harness): 20 passed (desktop 18, mobile 2), 0 failed, 0 flaky, 0 skipped, in 5.1 min. Next logged the known `destination stream closed early` 15 times. `settleElementWidth` was kept everywhere it was called, and the run left the tree unchanged.
- **Full web suite:** 130 files, 2,777/2,777, in 30.2 s. That is 9 more than the second gate: 1 for fix 7 and 8 for fix 8.
- **`typecheck` and `lint`:** clean.
- **Not run, as instructed:** the full Strapi suite, the full Playwright suite and the full phase gate. The gate runs once, after the pilot's title pass.
- **Not changed:** no Strapi source, contract, catalogue, content type or control title.
- **Housekeeping:** the failed RED and first-GREEN runs kept their harness database and Next build under the ignored `apps/backend/.tmp` and `apps/csrm/.tmp`, and their `apps/csrm/test-results`. I removed only those run-scoped paths. Older kept runs from earlier sessions were left alone.

**Deferred** (in `deferred-items.md`, commit `c9122fe`):
- the CPS 230 and CPS 234 PDF-extraction leftovers, routed to Phase 22 or a quick task;
- the pilot's agreement to defer the two RAR-E2E-P7 fixtures;
- the non-Phase 10 list columns without the long-text option.

**Open for the pilot.** Re-walk two things:
- B3 at 1440 on the CPS 230 controls page;
- each picker with its list open, under the pilot's own axe scan.

### Fix 3c: the audited titles

Walkthrough round 3 (2026-10-03). The pilot accepted fixes 7 and 8. An independent, judge-only audit then read all 386 descriptive titles against their paragraphs (the ISO titles against the Annex A control names). It found 12 faults and 6 ambiguous titles:

| Catalogue | Audited | Faults | Ambiguous |
|---|---|---|---|
| ISO/IEC 27001:2022 Annex A | 93 | 0 | 0 |
| APRA CPS 230 | 51 | 4 | 3 |
| APRA CPS 234 | 24 | 0 | 1 |
| PSPF | 218 | 8 | 2 |
| **Total** | **386** | **12** | **6** |

Fix 3c corrects all 18 as a GSD Rule 1 deviation, failing test first. 13 of the 18 were fix 3 or fix 3b titles, so those controls now carry their third seeded title. The audit also found three fix 3 rows whose "restored" claim the delivered title did not carry (CPS-230-56, PSPF-077 and PSPF-114), and the record corrections below follow from that.

**Every corrected title (18).** "Replaced title" is the title the seed stored before this fix.

| Control | Replaced title | Corrected title | Limb or reading restored |
|---|---|---|---|
| CPS-230-21 | Board oversight and approval for operational risk, BCP, tolerances and providers | Board oversight of operational risk; approval of BCP, tolerances and provider policy | (c)'s object: the Board approves the service provider management policy, not the providers. Its key controls and the reviews in (b) and (c) stay generalised under 'oversight' |
| CPS-230-34 | Critical operations defined by material harm to customers or the financial system | Critical operations: material adverse impact on customers or financial system role | 'material adverse impact', and the entity's role in the financial system rather than harm to the system itself (completes fix 3's claim) |
| CPS-230-38 | APRA-required tolerance reviews, and APRA-set tolerances for heightened risk or weakness | APRA-required tolerance changes, and APRA-set tolerances on heightened risk or material weakness | the change APRA may require (the review is generalised: the required change entails it), and 'material' before 'weakness'; 'on' replaces 'for', so the tolerances follow APRA's finding (completes fix 3's claim) |
| CPS-230-56 | APRA-required review and change of provider arrangements on prudential concerns | APRA-required review and change of provider arrangements on heightened prudential concerns | 'heightened' (completes fix 3's claim) |
| CPS-230-57 | Partial relief for listed providers on standardised terms or no formal agreement | Partial relief for Attachment-category providers on standardised terms or no formal agreement | providers in a category the Attachment lists, which 'listed providers' let a reader take as stock-exchange listed |
| CPS-230-58 | APRA written exemption for arrangements outside the paragraph 57 relief | APRA written partial exemption for arrangements outside the paragraph 57 relief | 'partial': APRA may exempt only from paragraphs 53, 54, 55(d), 59(a) and 59(c) |
| CPS-230-60 | Notifying APRA of critical service agreements and material offshoring, including changes | Notifying APRA of critical service agreements and material offshoring, including material changes | the threshold on changes: (a)'s material change to a critical-service agreement and (b)'s significant offshoring change, generalised as 'material' (completes fix 3's claim) |
| CPS-234-35 | Notifying APRA within 72 hours of material or regulator-notified incidents | 72-hour APRA notice of material incidents or those notified to other regulators | incidents the entity notified to other regulators, which 'regulator-notified' let a reader take as notified by a regulator (completes fix 3's claim) |
| PSPF-077 | Agreement before sharing outside government, except returned external information | Agreement before sharing outside government, except returning or answering OFFICIAL: Sensitive input | 'responding to' (as 'answering'), and the limit to outside information the entity then classified OFFICIAL: Sensitive (completes fix 3's claim) |
| PSPF-112 | Procuring data centre services through the panel | Procuring data centre services through the Data Centre Facilities Supplies Panel | the panel's name |
| PSPF-114 | Gateways with an IRAP or ASD assessment in the last 24 months | Gateways IRAP-assessed, or ASD-assessed if TOP SECRET, in the last 24 months | an ASD assessment counts only for TOP SECRET gateways (completes fix 3's claim) |
| PSPF-139 | Remote work exposed to foreign government direction | Remote work exposed to extrajudicial foreign government directions conflicting with Australian law | 'extrajudicial' and 'that conflict with Australian law' |
| PSPF-155 | Assessing TOP SECRET-Privileged Access suitability | Assessing TOP SECRET-Privileged Access eligibility and suitability under its Standard | 'eligibility' beside suitability, and the TOP SECRET-Privileged Access Standard |
| PSPF-175 | Starting revalidation before clearances lapse | Starting revalidation early enough to finish before clearances lapse | starting in time to complete revalidation before the due date, not merely before the lapse |
| PSPF-190 | Security plans for new and refurbished facilities | Security plans for new or under-construction facilities and major refurbishments | 'major' refurbishments, and facilities under construction |
| PSPF-212 | Post-quantum cryptography on newly procured equipment and software | Supporting approved post-quantum algorithms in newly procured cryptographic equipment and software | 'cryptographic' equipment and software, and 'approved' algorithms |
| PSPF-213 | Cyber risk reports to each Audit Committee and biannual uplift plan progress | Reporting cyber risk every Audit Committee meeting; strategy and uplift progress twice-yearly | every meeting of the one Audit Committee, the strategy beside the uplift plan, and 'twice-yearly' for 'biannual', which reads as biennial (completes fix 3b's claim) |
| PSPF-218 | Withholding temporary or provisional access from waiver subjects until vetting completes | Eligibility waiver granted or pending: no temporary or provisional access until vetted | clearance subjects who hold an eligibility waiver or for whom one is being considered (completes fix 3b's claim) |

**Wording.** 15 titles are the audit's proposals. Three are my own:
- **PSPF-190** adds facilities under construction. The audit's "new facilities and major refurbishments" left them out.
- **PSPF-212** says "approved", not "ISM-approved". The ISM's cryptography guidelines list the ASD-approved algorithms rather than approving them. "Supporting" also carries the paragraph's "are supported".
- **CPS-230-38** keeps the audit's wording, which names the change. "Review and change" with both other limbs needs 13 words.

**Checks.** All 18 have at most 12 words and 100 characters. PSPF-077 is exactly 100, the most the seed accepts. Ten run to 12 words: CPS-230-21, 38, 57 and 60, CPS-234-35, and PSPF-077, 114, 139, 213 and 218. Each passes 10-22's anchor, opening-copy, uniqueness and form checks: no em or en dash, no trailing full stop, no control-id prefix, and no "must" or "shall". A stored name `{number} — {title}` is at most 111 characters, against the contract's 255.

**Data.** `supersededTitles` lists each replaced title last:
- the 13 controls fix 3 or fix 3b had corrected keep their 10-22 title and add their fix 3 or fix 3b title after it (CPS 230 seven, CPS 234 one, PSPF five);
- PSPF-112, 139, 155, 175 and 190 get their first entry, their 10-22 title.

The lists now cover 41 CPS 230 controls (48 titles), 10 CPS 234 controls (11) and 101 PSPF controls (106). A guarded scratch script changed only the 18 titles and these lists, and checked that nothing else in the parsed file changed (key order kept, LF endings).

**Reconciling the development database.** No new mechanism. On the next seeded Strapi start, each of the 18 controls still stored under any title the seed wrote is renamed to its corrected title, keeping its documentId and relations. That covers 10-22's title, or fix 3's or fix 3b's if the database was seeded after them. A name an operator edited is kept. The mounted proof now renames CPS-230-34 from both of its earlier titles.

**Tests.**

| File | Test | Before the fix (`be545dd`) | After (`9306359`) |
|---|---|---|---|
| `apps/backend/tests/control-titles.unit.test.ts` | fix 3c: each audited title covers every limb its audit names (18 pinned; the 13 that revise fix 3 or 3b replace exactly that title; PSPF-112, 139, 155, 175 and 190 are the five new) | fail: 18 controls still under the audited titles | pass |
| same | fix 3c: each title fix 3c replaces stays listed as superseded, after any earlier one | fail: none listed | pass |
| same | fix 3 and fix 3b pins now expect fix 3c's title for the 13 controls it revises; the PSPF superseded list holds 21 + 75 + 5 controls | fail: 11 fix 3 and 2 fix 3b controls under their earlier titles; 96 PSPF controls listed | pass |
| `apps/backend/tests/assessment-seed.integration.test.ts` | fix 3: a seeded start renames a control stored under any earlier seeded title (10-22's, then fix 3's), then changes nothing | fail: renamed to fix 3's title | pass |

Runs (logs in the session scratchpad, `p10-23-f3c-*`):
- **RED:**
  - `control-titles.unit` alone: 25 tests, 20 passed and 5 failed, all on assertions (`p10-23-f3c-red-unit.tap`).
  - `assessment-seed.integration` alone: 15 tests, 14 passed and 1 failed on its assertion (`p10-23-f3c-red-seed.tap`).
  - `check tdd-red-evidence` returned RED_EVIDENCE_OK for both target tests.
- **GREEN:** four files, 65 of 65, in 74 s: `control-titles.unit` (25), `control-library-bounds.unit` (2), `assessment-seed.integration` (15) and `administration.integration` (23).
- **`pnpm verify:csrm-seed`:** exit 0 in 25 s. Both the static and the runtime seed verifications passed.
- **No journey run.** No web, e2e or Strapi source file names any of the 18 replaced titles. Only the title file's `supersededTitles` and the unit test do (`grep` over `apps` and `scripts`; `apps/backend/dist` is ignored build output). No web file changed.

**Correcting the record (fix 3 and fix 3b).** A summary must claim no more than the data delivers. So every "Limb or qualifier restored" claim in the fix 3 and fix 3b tables was checked mechanically against the title that fix delivered. The script is `p10-23-f3c-claimcheck.mjs` in the session scratchpad, not in the repository, and its output is `p10-23-f3c-claimcheck.out`. It reads the record as committed at `9306359`, before these corrections, so its counts reproduce. It works in four steps:
- it splits each claim into limbs, honouring quotes;
- it takes each limb's content words, dropping only words that describe a claim ("limb", "second", "qualifier", "corrects", "beside", and so on);
- it reports a limb whose words are not all in the delivered title, comparing five-letter stems;
- every reported limb was then judged, and the verdicts are recorded in the script.

| Count | Limbs |
|---|---|
| Rows checked (fix 3: 72, fix 3b: 75) | 147 rows, 226 limbs |
| Every key word in the delivered title | 71 |
| Label only (for example "limb (a)", with its content in the next limb) | 6 |
| Reported, then judged carried: the missing words only describe the limb ("the second sentence"), or the title says it in the same sense ("BCP", "where practicable", "on request", "Proportionate") | 122 |
| Reported, then judged generalised: the title covers the limb with a broader word, and the claim now says so | 17 (16 rows) |
| Reported, then judged overstated: the title did not carry the limb, and fix 3c's title does | 10 (9 rows) |

The corrections:
- **Completed in Fix 3c (9 rows).** The three the audit named: CPS-230-56 ('heightened'), PSPF-077 ('responding to' and the OFFICIAL: Sensitive limit) and PSPF-114 (ASD assessment only for TOP SECRET gateways). The check found six more:
  - CPS-230-34: the role in the financial system;
  - CPS-230-38: 'material' weakness and the change;
  - CPS-230-60: the threshold on changes;
  - CPS-234-35: 'other' regulators;
  - PSPF-213: every meeting and the strategy;
  - PSPF-218: a waiver granted or pending.

  Each row now ends "(completed in Fix 3c: …)", saying what that title lacked.
- **Generalised (16 rows).** Each claim now says the limb is generalised, or that a qualifier is not carried. No title changed: the independent audit judged each of these titles fair, and none is among its 18.
  - Fix 3: CPS-230-13 ('within tolerance'), CPS-230-21 (key controls and the (b) and (c) reviews), CPS-230-27 (processes), CPS-230-29 (review), CPS-230-30 (failures), CPS-230-47 (monitoring and substituting) and CPS-230-59 (performance, control effectiveness and compliance). Also PSPF-016 (the basis of tailoring), PSPF-046 (developments during the contract), PSPF-048 (the residual risk) and PSPF-098 (develop, implement and maintain).
  - Fix 3b: PSPF-042 ('reasonable'), PSPF-087 (reauthorisation), PSPF-095 ('accredited'), PSPF-128 (other entities and third parties) and PSPF-130 ('appropriate', since restored in Fix 3d).
- **Revised in Fix 3c, claim already true (4 rows).** CPS-230-21 (also generalised above), CPS-230-57, CPS-230-58 and PSPF-212 end "(revised in Fix 3c: …)", so the tables point to the later title.
- **Kept titles.** Two "kept" entries were also overstated:
  - fix 3's PSPF-139 ("narrows nothing");
  - fix 3b's PSPF-112, 155, 175 and 190 ("name the whole requirement").

  Both entries now note that Fix 3c corrected them.

In all, 28 claim cells and 2 kept entries changed. The audit's two optional tidy-ups (CPS-230-27 "or processes" and PSPF-038 "where appropriate") were not applied, because the audit judged both titles fair. CPS-230-27's claim now says processes are generalised.

**Commits.**
- `be545dd` test(10-23): expect the 18 audited control titles to cover every limb
- `9306359` fix(10-23): correct the 18 audited control titles to cover every limb
- the docs commit that records this fix

**Decisions.**
- All 18 audited titles are applied. Three are reworded where the audit's proposal left out a limb (PSPF-190) or named the wrong approving body (PSPF-212), or where the alternative ran past the cap (CPS-230-38, which keeps the audit's wording).
- Where an earlier fix's claim overstated its title, the claim is corrected in place and annotated, and the title changes only where the audit found a fault. That keeps the record and the data in step without a second, unaudited retitle.
- The ISO 8.1 spelling stays as it is until it is checked against a licensed copy (deferred, below).

**Deferred.** One open question for the operator is in `deferred-items.md`. The audit says ISO/IEC 27001:2022's Annex A table may print 8.1 as "User end point devices", where the file has "User endpoint devices" (ISO/IEC 27002:2022's spelling). It is unchanged, because there is no licensed copy to check against.

**Open for the pilot:** the descriptive-title Manual-Only row. After the next seeded Strapi start, re-walk a few of the 18 (for example CPS-230-34, CPS-230-57, PSPF-077 and PSPF-213). The development database picks up fix 3c only on a seeded start, and operator renames survive it.

**The pilot's rulings on the generalised claims (2026-10-03).** The pilot read the three PSPF titles whose claim says a qualifier is not carried:
- **PSPF-042 is kept** ("Contract terms for provider incident reporting and following investigation directions"). Dropping "reasonable" generalises a degree, and the title still names the obligation to follow directions.
- **PSPF-095 is kept** ("SCEC-endorsed racks or compartments in Zone Five for TOP SECRET technology assets"). "Zone Five" already denotes the accredited Security Zone Five area, so "accredited" adds nothing.
- **PSPF-130 is retitled** (Fix 3d, below). "Appropriate" carries the requirement's need-to-know intent, and the title without it reads as broadening access.

### Fix 3d: PSPF-130 keeps "appropriate"

The pilot approved Task 2 on 2026-10-03 with two rulings, this one and the Fix 8 addendum below. Both are GSD Rule 1 deviation fixes, failing test first.

**Paragraph.** PSPF-130: "Appropriate access to official information is enabled, including controlling access (including remote access) to supporting technology systems, networks, infrastructure, devices and applications."

| | Title |
|---|---|
| 10-22 (first seeded) | Controlling access to supporting technology |
| Fix 3b (replaced) | Enabling official information access and controlling access to supporting technology |
| Fix 3d (current) | Enabling appropriate access to official information and controlling supporting technology access |

**Intent restored.** "Appropriate" is the need-to-know limit on the access the paragraph enables. Fix 3b's title said only "enabling official information access", which reads as broadening access. The new title puts "appropriate" directly on "access", so it cannot be read as "appropriate information". It keeps fix 3b's second limb (controlling access to supporting technology, with remote access generalised under "access").

**Wording.** The pilot's example, "Appropriate access to official information and control of supporting technology access", opens with the paragraph's own opening phrase. Fix 3b reworded five drafts for that reason (the title convention: a title never repeats its paragraph's opening words), so this title keeps fix 3b's verb-first shape instead. It has 11 words and 96 characters, within the 12-word and 100-character cap. It passes the form rules (no em or en dash, no full stop, no control-id prefix, no "must" or "shall"), the anchor, opening-copy and uniqueness checks, and the stored name `PSPF-130 — {title}` is 107 characters against the contract's 255.

**Data.** `supersededTitles` lists PSPF-130's 10-22 title, then fix 3b's title last. A guarded scratch script (`p10-23-f3d-apply.mjs` in the session scratchpad) changed only the title and that list, and checked that nothing else in the parsed file changed (key order kept, LF endings). On the next seeded Strapi start, a PSPF-130 stored under either earlier title is renamed, keeping its documentId and relations, and an operator's own name is kept.

**Tests.**

| File | Test | Before the fix (`05b5482`) | After (`7385b91`) |
|---|---|---|---|
| `apps/backend/tests/control-titles.unit.test.ts` | fix 3d: PSPF-130 keeps 'appropriate', the need-to-know intent of its paragraph (fix 3d replaces fix 3b's title; the title says "appropriate access"; the seed stores it) | fail: seeded under fix 3b's title | pass |
| same | fix 3d: the title fix 3d replaces stays listed as superseded, after any earlier one | fail: fix 3b's title not listed | pass |
| same | fix 3b: every corrected PSPF title covers every limb of its paragraph (its PSPF-130 pin now follows `currentTitle`, which reads fix 3d's title) | fail: PSPF-130 under fix 3b's title | pass |

Runs (logs in the session scratchpad, `p10-23-f3d-*`):
- **RED:** `control-titles.unit` alone, 27 tests: 24 passed and 3 failed, all on assertions (`p10-23-f3d-red-unit.tap`). `check tdd-red-evidence` returned RED_EVIDENCE_OK for the fix 3d target test.
- **GREEN:** four files, 67 of 67, in 70 s: `control-titles.unit` (27), `control-library-bounds.unit` (2), `assessment-seed.integration` (15, including the mounted reconcile proofs) and `administration.integration` (23).
- **`pnpm verify:csrm-seed`:** exit 0 in 26 s. Both the static and the runtime seed verifications passed.
- **No journey run.** No web, e2e or Strapi source file names PSPF-130's replaced title; only the title file's `supersededTitles` and the unit test do. No web file changed.

**Commits.** `05b5482` test(10-23): expect PSPF-130 to keep 'appropriate' access (fix 3d); `7385b91` fix(10-23): retitle PSPF-130 to keep 'appropriate' access (fix 3d).

### Fix 8 addendum: the accepted axe exception

**What the pilot found.** Fix 8's 28 open-list scans passed because none of their lists overflowed. When a list overflows its popover, axe reports one serious `scrollable-region-focusable` on the popover CONTAINER, the element that scrolls. The pilot reproduced it at 1440x900 and at 375x812 on the Risk Register's Control picker, searching `data`: 552px of content in a 458px box.

**Why it is accepted.** The picker is the ARIA APG combobox with a listbox popup: focus stays on the combobox and the options are reached with `aria-activedescendant`, each scrolled into view as it becomes active (`scrollIntoView({ block: 'nearest' })` in `relation-picker.tsx`). The scrolled content is therefore keyboard operable without the container taking focus. Making the container tabbable would add a Tab stop the pattern does not have and break its Tab behaviour, so it is not done. The pilot checked WCAG 2.1.1 directly: with focus on the combobox, ArrowDown moves `aria-activedescendant` through all 10 options, each scrolled into view; Escape closes the list; Discard returns focus to Add mitigation control. This is axe's known heuristic false positive for an activedescendant combobox whose popup scrolls. No product code changed.

**The honest browser proof.** A new test in `apps/csrm/e2e/accessibility.spec.ts`, `an overflowing picker list passes axe while open at 1440 and 375`:
- **Forces the overflow.** As Bob, on the Risk details of `RSK-DEV-MUTABLE-001`, it opens a new mitigation control, scrolls the Control field to mid-viewport, and types `data`. It waits for the "Showing the first 10 matches" status, asserts ten options, and asserts the popover content's `scrollHeight` is greater than its `clientHeight`.
- **Scans it open** with the WCAG tags, Label in Name and best practice (fix 8's `scanWithBestPractice`).
- **Sets aside one finding only.** `withoutAcceptedPopupScroll` removes a `scrollable-region-focusable` node only when its single axe target resolves to the open popover content (`[data-slot="popover-content"][data-state="open"]`) that holds the listbox. Any other node that rule reports, and every other rule, still counts. It is a filter on that rule and that target, not an axe `exclude`, which would hide the whole popup from every rule. The comment above it cites the APG combobox pattern and the pilot's WCAG 2.1.1 check.
- **Asserts 0 serious and 0 critical** for everything else, at most one accepted node, and no horizontal page overflow.
- **Proves the keyboard path.** Focus is on the combobox. ArrowDown, pressed once per option, makes the last option the `aria-activedescendant` (and `aria-selected`). Focus stays on the combobox. The last option's box lies inside the scroller's box, and the scroller has scrolled (`scrollTop` above 0).
- **Leaves no data changed.** Escape closes the list without choosing, then Discard mitigation changes returns focus to Add mitigation control.

Fix 8's other scans are unchanged and keep their strict rule: no exception applies to them, because their lists do not overflow and their keyboard path is not the one this test proves.

**Measurements** (the GREEN run's annotation, `p10-23-f8a-e2e-green.log`):

| Width | Popover content | Popover box | After ArrowDown x10 | Accepted findings | Other findings |
|---|---|---|---|---|---|
| 1440x900 | 552px | 394px | option 10 active and in view, scrolled 110px (its bottom at y899, the scroller's at y900) | 1: `scrollable-region-focusable` on the open popover content | moderate `region` 1 (the portalled popup sits outside the landmarks, as in fix 8's scans); 0 serious, 0 critical |
| 375x812 | 1040px | 354px | option 10 active and in view, scrolled 618px (its bottom at y811, the scroller's at y812) | 1, as above | moderate `region` 1; 0 serious, 0 critical |

The pilot measured a 458px box at 1440; the test's box is 394px because it places the field mid-viewport, which leaves less room on either side. The content height, 552px, matches the pilot's. At 375 the options wrap, so the content is taller.

**Tests.**

| File | Test | Before (`67e7617`) | After (`fe7d6fb`) |
|---|---|---|---|
| `apps/csrm/e2e/accessibility.spec.ts` | an overflowing picker list passes axe while open at 1440 and 375 | fail: at 1440, serious `scrollable-region-focusable` on `#radix-_r_7_`, the open popover content (the overflow precondition passed first) | pass |

Runs (no dev server running; logs in the session scratchpad, `p10-23-f8a-*`):
- **RED:** the new test alone, desktop project: 1 failed on the axe assertion, in 48 s (`p10-23-f8a-e2e-red.log`). Rerun with the JUnit reporter so `check tdd-red-evidence` could read it: the same failure, RED_EVIDENCE_OK (`p10-23-f8a-red-junit.xml`, `p10-23-f8a-red.json`). The first, list-reporter evidence returned INVALID_RED (`zero_tests_discovered`) only because the checker reads TAP or JUnit, not Playwright's list output.
- **GREEN:** the whole of `accessibility.spec.ts`, production harness: 13 passed (all desktop, the project that runs this file), 0 failed, 0 flaky, 0 skipped, in 3.2 min (`p10-23-f8a-e2e-green.log`). That includes fix 8's 28 strict open-list scans (`picker lists pass axe while open at 1440 and 375`) and the new test. Next logged the known `destination stream closed early` 8 times. `settleElementWidth` is not called in this file, so none was touched, and the run left the tree unchanged.
- **`typecheck` and `lint`:** clean.
- **Housekeeping:** each failed RED run kept its harness database and Next build under the ignored `apps/backend/.tmp` and `apps/csrm/.tmp`, and its `apps/csrm/test-results` folder. I removed only those run-scoped paths.

**Commits.** `67e7617` test(10-23): expect an overflowing picker list to pass axe while open (fix 8 addendum); `fe7d6fb` test(10-23): accept only the open popup's scroll finding and prove the keyboard path (fix 8 addendum).

## Phase gate (second run, after the walkthrough fixes)

The full gate ran again at `5ef0f88` (branch `post-demo`), after the last walkthrough fix and its record. That commit includes all six fixes: fix 2 (`7e07dba`, `a31ae03`, `f60fd2f`); fixes 3 and 3b (`ee24167`, `0797c33`, `ac34d19`, `5a4c544`, `a99efae`, `feac941`, `81b8343`); and fixes 1, 4, 5 and 6 (`de7ab44` to `5ef0f88`).

Conditions:
- Each command ran on its own from the repository root under Node 24.19.0 and pnpm 11.24.0.
- Ports 1337 and 3000 were free (`netstat` printed nothing), and no dev server was started.
- The Strapi suite and Playwright never ran at the same time, and the seed verification ran after Playwright.
- Started 2026-10-02T16:33:37Z. Logs are in the session scratchpad (`p10-23-gate2-<name>.log`, each with `time` and `EXIT=` appended).

| # | Command | Passed | Failed | Skipped | Flaky | Duration | Exit |
|---|---|---|---|---|---|---|---|
| 1 | `pnpm --dir apps/backend test` (full Strapi suite, node:test, serial) | 647 | 0 | 0 (cancelled 0, todo 0) | n/a | 900 s wall (node:test 892.0 s) | 0 |
| 2 | `pnpm --dir apps/csrm test` (full web suite, Vitest, 130 files) | 2,768 | 0 | 0 | n/a | 40.7 s wall (Vitest 39.5 s) | 0 |
| 3 | `pnpm --dir apps/csrm typecheck` (`next typegen && tsc --noEmit`) | clean | 0 errors | n/a | n/a | 5.2 s | 0 |
| 4 | `pnpm --dir apps/csrm lint` (`next typegen && tsc --noEmit`) | clean | 0 errors | n/a | n/a | 3.9 s | 0 |
| 5a | `pnpm --dir apps/csrm api:check` (`api:generate` then `git diff --exit-code` on `schema.d.ts`) | clean (no diff) | n/a | n/a | n/a | 1.8 s | 0 |
| 5b | `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | `schema.d.ts` refreshed (not listed afterwards) | n/a | n/a | n/a | 0.1 s | 1, operator files only (as note 5b of the first run) |
| 6 | `pnpm --dir apps/csrm test:e2e` (full Playwright suite, production build, 1 worker) | 86: desktop 82, mobile 4 | 0 | 0 | 0 | 12.7 min (763 s wall) | 0 |
| 7 | `pnpm verify:csrm-seed` (extra check, restored by fix 3: the static catalogue verifier, then the runtime verifier on a disposable SQLite) | both passed | 0 | n/a | n/a | 26.7 s | 0 |

Notes:
- **No EPERM rerun.** The web log has no `EPERM: rename`, so no file was rerun alone.
- **5b.** As in the first run, the refresh prints `apps/backend/types/generated/components.d.ts: needs update` and `apps/backend/types/generated/contentTypes.d.ts: needs update` and exits 1. Those are the operator's empty-diff line-ending items, left alone. `api:check` exits 0. Its only other output is git's `LF will be replaced by CRLF` notice on `schema.d.ts`.
- **Playwright.**
  - Flaky count 0: `retries` is 0 outside CI, and the run printed only `86 passed (12.7m)`, with no `failed`, `flaky` or `skipped` line and no retry.
  - Per project: 82 `ok` lines for `[desktop]` and 4 for `[mobile]`, with 0 `not ok`.
  - Next logged `⨯ Error: The destination stream closed early.` 46 times (191 in the first run). No test asserts on it, and it is the benign navigation-abandon noise described in the first run's notes.
- **Seed verification output.** `IdamBox CSRM seed catalogue verification passed` and then `IdamBox CSRM runtime seed verification passed`. The runtime verifier's second boot logged `IdamBox CSRM control seed complete: 2646 controls (0 created, 1 updated, 2645 unchanged)`, its own stale-control fixture being reconciled.
- **Tree.** After every command, including Playwright and the seed verification, `git status --short` showed only the three operator items. No run changed a tracked file, and nothing was restored (D-48).

**Static checks (second run)**, at `5ef0f88` (`p10-23-gate2-static.log`). Each output is quoted between brackets.
1. **Content types unchanged since `5ea2b77` (D-01).** `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` printed `[]`.
2. **Catalogue copies byte-identical (D-02).** `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` printed `[]` (exit 0).
3. **No Keycloak file changed.** `git diff --name-only 5ea2b77..HEAD | grep -i keycloak` printed `[]`, over 232 changed files (221 in the first run).
4. **No `CSRM_AI_` source line changed.** `git diff 5ea2b77..HEAD -- apps scripts package.json turbo.json pnpm-workspace.yaml | grep '^[+-].*CSRM_AI_'` printed `[]`.

**Comparison with the first run (`eed7ed0`).**

| Command | First run | Second run | Change, and where it comes from |
|---|---|---|---|
| Strapi | 630/630, 789 s | 647/647, 900 s | +17 tests. Fix 2 added `control-library-bounds.unit.test.ts`, plus cases in `administration.unit`, `administration.integration` and `assessment-seed.integration`. Fixes 3 and 3b added cases in `control-titles.unit` and `assessment-seed.integration`. Fixes 1, 4, 5 and 6 changed no Strapi test. |
| Web | 2,745/2,745, 129 files, 39 s | 2,768/2,768, 130 files, 40.7 s | +23 tests and +1 file. The new file is `request-domain.test.ts` (fix 4, 7 tests). Fix 1 added cases in `assessment-domain.test.ts` and `assessment-editor.test.tsx`, fix 4 in `assessment-review-workflow.test.tsx`, fix 6 in `risk-details.test.tsx`, and fix 2 one parser pin in `administration-schema.test.ts`. Fix 5 changed expectations only. |
| typecheck, lint, api:check | clean | clean | none |
| Playwright | 86 (82 + 4), 0 flaky, 14.9 min | 86 (82 + 4), 0 flaky, 12.7 min | No new test case. The fixes added assertions inside existing journeys (`administration-workflow`, `assessment-release-workflow`, `assessment-navigation-lifecycle`, `risk-register-workflow`; +34/−2 lines, no new `test(` line), so the count is unchanged. |
| Seed verification | not run (the script was missing; deferred) | passed, 26.7 s | Restored by fix 3 (`ac34d19`). |
| Static checks | all empty (after `eed7ed0`) | all empty | 11 more changed files since `5ea2b77`, none a content type, Keycloak file or `CSRM_AI_` line |

The gate is green on every command. No fix was needed in this run.

## Phase gate (third run, after Fix 3c)

The full gate ran a third time at `4c10b43` (branch `post-demo`). That commit adds walkthrough round 2 and the title round to the second run's `5ef0f88`:
- fixes 7 and 8: `15b08f7`, `ee7c673`, `ba1d9bb`, `d045322` and `d6e29c5`, with their records `c9122fe` and `c8508a6`;
- Fix 3c: `be545dd` and `9306359`, with its record `4c10b43`.

Conditions:
- Each command ran on its own from the repository root under Node 24.19.0 and pnpm 11.24.0.
- Ports 1337 and 3000 were free before the Strapi suite and before Playwright (`netstat` printed nothing). No dev server was started.
- The Strapi suite and Playwright never ran at the same time, and the seed verification ran after Playwright.
- Started 2026-10-02T18:28:56Z (UTC). Logs are in the session scratchpad (`p10-23-gate3-<name>.log`, each with `time` and `EXIT=` appended).

| # | Command | Passed | Failed | Skipped | Flaky | Duration | Exit |
|---|---|---|---|---|---|---|---|
| 1 | `pnpm --dir apps/backend test` (full Strapi suite, node:test, serial) | 649 | 0 | 0 (cancelled 0, todo 0) | n/a | 693 s wall (node:test 688.0 s) | 0 |
| 2 | `pnpm --dir apps/csrm test` (full web suite, Vitest, 130 files) | 2,777 | 0 | 0 | n/a | 31.1 s wall (Vitest 30.1 s) | 0 |
| 3 | `pnpm --dir apps/csrm typecheck` (`next typegen && tsc --noEmit`) | clean | 0 errors | n/a | n/a | 3.6 s | 0 |
| 4 | `pnpm --dir apps/csrm lint` (`next typegen && tsc --noEmit`) | clean | 0 errors | n/a | n/a | 3.2 s | 0 |
| 5a | `pnpm --dir apps/csrm api:check` (`api:generate` then `git diff --exit-code` on `schema.d.ts`) | clean (no diff) | n/a | n/a | n/a | 1.6 s | 0 |
| 5b | `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | `schema.d.ts` refreshed (not listed afterwards) | n/a | n/a | n/a | 0.1 s | 1, operator files only (as note 5b of the first run) |
| 6 | `pnpm --dir apps/csrm test:e2e` (full Playwright suite, production build, 1 worker) | 87: desktop 83, mobile 4 | 0 | 0 | 0 | 12.4 min (748 s wall) | 0 |
| 7 | `pnpm verify:csrm-seed` (the static catalogue verifier, then the runtime verifier on a disposable SQLite) | both passed | 0 | n/a | n/a | 26.1 s | 0 |

Notes:
- **No EPERM rerun.** The web log has no `EPERM: rename`, so no file was rerun alone.
- **5b.** The refresh prints `apps/backend/types/generated/components.d.ts: needs update` and `apps/backend/types/generated/contentTypes.d.ts: needs update` and exits 1. Those are the operator's empty-diff line-ending items, left alone. `api:check` exits 0. Its only other output is git's `LF will be replaced by CRLF` notice on `schema.d.ts`.
- **Playwright.**
  - Flaky count 0: `retries` is 0 outside CI, and the run printed only `87 passed (12.4m)`, with no `failed`, `flaky` or `skipped` line and no retry.
  - Per project: 83 `ok` lines for `[desktop]` and 4 for `[mobile]`, with 0 `not ok`.
  - Next logged `⨯ Error: The destination stream closed early.` 31 times (191 in the first run, 46 in the second). No test asserts on it, and it is the benign navigation-abandon noise described in the first run's notes.
- **Seed verification output.**
  - The verifiers printed `IdamBox CSRM seed catalogue verification passed`, then `IdamBox CSRM runtime seed verification passed`.
  - The runtime verifier's first boot logged `2646 controls (2646 created, 0 updated, 0 unchanged)`. Its second logged `2646 controls (0 created, 1 updated, 2645 unchanged)`, which is its own stale-control fixture being reconciled.
- **Tree.** After every command, including Playwright and the seed verification, `git status --short` showed only the three operator items. No run changed a tracked file, and nothing was restored (D-48).

**Static checks (third run)**, at `4c10b43` (`p10-23-gate3-static.log`). Each output is quoted between brackets.
1. **Content types unchanged since `5ea2b77` (D-01).** `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` printed `[]`.
2. **Catalogue copies byte-identical (D-02).** `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` printed `[]` (exit 0).
3. **No Keycloak file changed.** `git diff --name-only 5ea2b77..HEAD | grep -i keycloak` printed `[]`, over 236 changed files (232 in the second run).
4. **No `CSRM_AI_` source line changed.** `git diff 5ea2b77..HEAD -- apps scripts package.json turbo.json pnpm-workspace.yaml | grep '^[+-].*CSRM_AI_'` printed `[]`.

**Comparison with the second run (`5ef0f88`).**

| Command | Second run | Third run | Change, and where it comes from |
|---|---|---|---|
| Strapi | 647/647, 900 s | 649/649, 693 s | +2 tests: Fix 3c's two in `control-titles.unit` (the 18 titles, and their superseded entries). Fix 3c changed the mounted reconcile proof in `assessment-seed.integration` but added no test there. Fixes 7 and 8 changed no Strapi test. |
| Web | 2,768/2,768, 130 files, 40.7 s | 2,777/2,777, 130 files, 31.1 s | +9 tests, no new file: fix 7's wrap test in `administration-workflow.test.tsx` and fix 8's eight in `relation-picker.test.tsx`, `owner-combobox.test.tsx`, `risk-register.test.tsx` and `assessment-editor.test.tsx`. Fix 3c changed no web file. |
| typecheck, lint, api:check | clean | clean | none |
| Playwright | 86 (82 + 4), 0 flaky, 12.7 min | 87 (83 + 4), 0 flaky, 12.4 min | +1 desktop test: fix 8's `picker lists pass axe while open at 1440 and 375` (`accessibility.spec.ts:778`). Fix 7's `ADMIN05_CONTROL_TITLES_WRAP` is a step inside an existing journey. |
| Seed verification | passed, 26.7 s | passed, 26.1 s | none. The verifiers read the title file, so they cover Fix 3c's 18 titles and superseded lists. |
| Static checks | all empty | all empty | 4 more changed files since `5ea2b77`, all from fix 8: `owner-combobox.tsx`, `owner-combobox.test.tsx`, `risk-register-filters.tsx` and `risk-register.test.tsx`. Fix 3c's three files were already in the diff. None is a content type, a Keycloak file or a `CSRM_AI_` line. |

The gate is green on every command. No fix was needed in this run.

## Browser checks

The pilot's walk (Task 2, approved 2026-10-03), copied verbatim from the pilot's final table.

Three passes, all with the Playwright MCP browser on the development servers (seeded start), changing no data except as noted:
- Walk 1 at `984b048` (2026-10-03, independent agent for the pilot): B1–B8 at both widths and W1–W16.
- Re-walk at `0b9557c` (after fixes 1–6): R1–R8, B3 and B8 again.
- Pilot check at the third gate commit (after fixes 7, 8 and 3c): B3 at 1440 and the open-picker axe scans.

Data note: walk 1 pressed Save assessment once on the unchanged In review ASM-E2E-P7-MUTABLE-001 (Fix 1's defect). The press re-saved identical values. The record stayed In review at 34 of 62, and only its timestamps may have moved.

| Id | Backstop or surface | Actor | Width | Result | Evidence |
|---|---|---|---|---|---|
| B1 | Long questionnaire description: intro wraps, first question reachable | Jane | 375 | pass | QUES-DEV-DRAFT-001; with 1,440 characters placed in the page only: intro wraps at 294px, first question y=1742; scrollWidth 360/375; axe serious 0 |
| B1 | same | Jane | 1440 | pass | Intro and completion card share one 768px column; first question y=822 on load; 1425/1440; axe 0 |
| B2 | Systems list: Owner and Business criticality | Bob | 375 | pass | Cards show "Owner: Not provided · Business criticality: Not provided"; 360/375; axe 0 |
| B2 | same | Bob | 1440 | pass | Name, Owner and Business criticality visible (x 297–802); overflow only inside the labelled scroll region; page 1425/1440 |
| B3 | Long control titles wrap | Bob | 375 | pass | Re-walk: PSPF-188 (98 characters), CPS-230-29, CPS-230-13, PSPF-005 and CPS-234-15 wrap to 3 lines in 302px cards; 360/375 |
| B3 | same | Bob | 1440 | pass | Pilot check after Fix 7 (`ee7c673`) at `d89f419`, page `q=CPS-230`, 25 rows: the Name cells are `white-space: normal`, and 15 of 25 wrap to two lines (40px), the longest being "Operational risk, conduct and compliance standards, critical operations and providers". The table is 1087px and its region 1087px, so nothing scrolls sideways, and Reference ends at x1384 inside the region. Page 1425/1440. CPS-230-34 reads its Fix 3c title |
| B4 | Control picker | Bob | 375 | pass | Full form width; "8.11 · Data masking" wraps; list x 87–279, no overflow; 360/375 |
| B4 | same | Bob | 1440 | pass | Control (x362) beside Control owner (x850) in the two-column grid; list matches the input width |
| B5 | System and asset pickers | Bob | 375 | pass | Full form width (229px editor, 278px Risk Register); 44px options; lists inside the viewport |
| B5 | same | Bob | 1440 | pass | Editor: system x346, asset x850; Risk Register keeps its one-column layout |
| B6 | Save confirmations | Bob | 375 | pass | "No changes to save." below Save risk and Save mitigation control, with no request; a long message wraps inside the card. Re-walk: Save assessment unchanged sends no request and shows "No changes to save." at y464 below its button |
| B6 | same | Bob | 1440 | pass | Status beside its button in the action row, for all three saves (Save assessment status at x475–608 beside the button); no requests |
| B7 | Readiness links | Bob | 375 | pass | Largest seeded assessment ASM-E2E-P7-MUTABLE-001 (4 Risks, 34 of 62): 5 links; rows wrap; 44px toggle (the seed has no ten-Risk assessment) |
| B7 | same | Bob | 1440 | pass | Same 5 links; the card keeps its right column; the met list is collapsed |
| B8 | Titles for 5.1, CPS-234-15, PSPF-001; `masking` | Bob | 375 | pass | "5.1 · Policies for information security", "CPS-234-15 · Information security capability proportionate to threats and supporting sound operation", "PSPF-001 · Portfolio security advice from the Department of State"; `masking` lists "8.11 · Data masking" in both pickers |
| B8 | same | Bob | 1440 | pass | Same in the Name column; 8.11 with its framework line in both pickers |
| W1 | My Requests, My Questionnaires, My Risk Assessments | Jane | 375 | pass | 375/375; axe 0; no internal term; no raw ids |
| W1 | same | Jane | 1440 | pass | 1440/1440; axe 0; only the development role switcher, which UI-SPEC §17.2 excludes |
| W2 | Request RAR-DEV-QUES-001 | Jane | 375 | pass | Three context groups; Submitted 30 Aug 2026; actions match the state; axe 0 |
| W2 | same | Jane | 1440 | pass | 1425/1440; axe 0 |
| W3 | Questionnaire QUES-DEV-DRAFT-001 | Jane | 375 | pass | "About this questionnaire" first; "0 of 7 answered"; save status present and empty; nothing typed |
| W3 | same | Jane | 1440 | pass | 1425/1440; axe 0 |
| W4 | Released ASM-E2E-P7-RELEASED-001 and ASM-E2E-NAV-OWNER-001 | Jane | 375 | pass | Ratings, Ownership and treatment groups; owner Bob Doe; In Progress; target 20 September 2026 (no released assessment in the seed has a mitigation control; the label is covered by 10-15's automated proofs) |
| W4 | same | Jane | 1440 | pass | 1425/1440; axe 0 |
| W5 | Three analyst URLs as a Requestor | Jane | 375 | pass | Permission states per §11.1 with the right `Go to My …` link; no record facts |
| W5 | same | Jane | 1440 | pass | Same; axe 0 |
| W6 | Review lists | Bob | 375 | pass | 360/375; axe 0 ("contextual" in the Risk Register description is excluded by §17.2, Phase 11) |
| W6 | same | Bob | 1440 | pass | Same |
| W7 | Hubs RAR-DEV-QUES-001 and RAR-DEV-CROSS-001 | Bob | 375 | pass | Third-party details and regulatory requirements shown; generation cards idle; nothing pressed |
| W7 | same | Bob | 1440 | pass | The jobs read worked (no "couldn't check" line); the D-47 line has no live job in the seed to show |
| W8 | Governance editor QUES-DEV-UNRELEASED-001 | Bob | 375 | pass | Per-section add opens in place; Save question and Discard changes stacked at 44px; discard returns focus; no requests |
| W8 | same | Bob | 1440 | pass | Form opens inside its section with focus on Question text; Release disabled with its caption |
| W9 | Released questionnaire QUES-DEV-DRAFT-001 | Bob | 375 | pass | 360/375; axe 0 |
| W9 | same | Bob | 1440 | pass | "0 of 7 answered"; progress bar labelled; no Edit or Delete |
| W10 | Assessment editor ASM-E2E-P7-MUTABLE-001 | Bob | 375 | pass | Walk 1 issue (unchanged Save assessment wrote) fixed by Fix 1 (`de7ab44`, `d1c75b7`); re-walk R2: no request, "No changes to save." below the button |
| W10 | same | Bob | 1440 | pass | Re-walk R2: no request, status beside the button; still In review, 34 of 62 |
| W11 | Analyst read-only ASM-2026-33SAEN | Bob | 375 | pass | "The Requestor can now read this assessment. It can no longer be changed." |
| W11 | same | Bob | 1440 | pass | 1425/1440; axe 0 |
| W12 | Risk Register detail RSK-DEV-MUTABLE-001 | Bob | 375 | pass | Pickers searched, then discarded; names, not ids. Re-walk R6 and R7: "ASM-DEV-RISK-001 · …", "Information system impacted" and "Information asset impacted"; focus returns to Add or Edit mitigation control after a discard |
| W12 | same | Bob | 1440 | pass | Same; "Selected system: Customer portal"; mitigation card "E8-PATCH_APPLICATIONS-003 · Patch applications" |
| W13 | Control search: Administration list and Control picker | Bob | 375 | pass | Walk 1 issue (APP-13's 100,973-character description broke list and picker pages) fixed by Fix 2 (`7e07dba`, `a31ae03`, `f60fd2f`). Re-walk R3: `data` 118, `personal` 30, `APP` 538, `APP-1` 5, `APP-13` 1, `Privacy Act` 24, each loading, with APP-13 listed |
| W13 | same | Bob | 1440 | pass | Re-walk R3: same counts; the APP-13 record holds 2,558 characters, 13.1 to 13.5 only; both pickers load all six searches; axe 0 |
| W14 | Information Systems | Bob | 375 | pass | As B2 |
| W14 | same | Bob | 1440 | pass | As B2 |
| W15 | CSV import (Controls) | Bob | 375 | pass | Guidance, and Column, Required and Format headers. Re-walk R6: "matches an existing control updates it" in lower case |
| W15 | same | Bob | 1440 | pass | 1425/1440; axe 0 |
| W16 | Control detail pages and descriptive titles | Bob | 1440 | pass | Walk 1 found CPS-230-34 narrowing its paragraph, and the re-walk found 3 of 20 still faulty. An independent audit of all 386 titles found 12 faults and 6 ambiguous; all 18 were corrected in Fix 3c, and the earlier fixes were Fix 3 and 3b (147 titles). Headings use number · title |
| W17 | Next action on RAR-E2E-P7-DUESOON-001 and -OVERDUE-001 | Bob | 375 | pass | Re-walk R5: neither shows a Next action line or a Generate control (Fix 4, `7c371d6`, `8c4e2a7`); the fixtures' unreachable states are deferred |
| W17 | same | Bob | 1440 | pass | Same |
| W18 | Pickers with their list open (axe) | Bob | 375 | pass | Pilot check: the same scan at 375. The popup is a listbox with `aria-haspopup=listbox`; the one serious finding is the same accepted `scrollable-region-focusable`; moderate `region` 1 (the portal sits outside the landmarks, as every Radix popover does); page 360/375 |
| W18 | same | Bob | 1440 | pass | Pilot check: Risk Register RSK-DEV-MUTABLE-001, Control picker opened by typing `data` (10 options), nothing chosen. The popup is a listbox: the input has `aria-haspopup=listbox` and `aria-controls`, and `aria-dialog-name` is gone. axe serious: one `scrollable-region-focusable` on the popover container (content 552px in a 458px box). It is accepted as the APG false positive (Fix 8 addendum) after the keyboard path was verified: with focus on the combobox, ArrowDown moves `aria-activedescendant` through all 10 options, each scrolled into view; Escape closes the list; Discard returns focus to Add mitigation control. Page 1425/1440. Only picker-search Server Action POSTs were sent |

## Requirement coverage

Each requirement's delivering plans, its automated proofs (the gate runs above) and its browser rows (`## Browser checks`). The coverage reads against the plan's `requirements` and the Manual-Only items of `10-VALIDATION.md`.

| Requirement | Coverage | Delivered by | Browser rows | Manual-Only |
|---|---|---|---|---|
| REQ-07 | delivered | 10-04; walkthrough fix 4 | W2, W7, W17 | none |
| QUES-08 | delivered | 10-06, 10-09, 10-11, 10-12 | W8, W9 | the hosted-provider question add stays open (no hosted-provider questionnaire in the seed; adding a question writes data) |
| QUES-09 | delivered | 10-03, 10-05, 10-08 | B1, W3 | the browser leave prompt on reload and screen-reader cadence stay open, as the pilot reports them |
| ASSESS-06 | delivered | 10-18, 10-19, 10-20, 10-21; walkthrough fixes 1, 6 and 8 (with its addendum) | B4, B5, B6, B7, W10, W12, W18 | none |
| ASSESS-07 | delivered | 10-15 | W4 | none |
| ADMIN-05 | delivered except the Information Asset owner: moves to Phase 22 with a contract-gap record (REQUIREMENTS.md, ADMIN-05 Remainder; D-01, D-37) | 10-15, 10-16, 10-17, 10-22; walkthrough fixes 2, 3, 3b, 3c, 3d and 7 | B2, B3, B8, W13, W14, W16 | APP titles against Schedule 1: pass; descriptive control titles: pass after Fix 3c (the Annex A 8.1 spelling is open for the operator) |
| UX-06 | delivered | 10-01, 10-02, 10-04, 10-05, 10-06, 10-07, 10-09, 10-10, 10-12, 10-13, 10-14, 10-15, 10-17, 10-18, 10-19, 10-21; walkthrough fix 5 | W1, W5, W6, W11, W15 | copy voice: pass after Fix 5 |

**ADMIN-05 is not fully closed.** Its criterion 1 names asset owners, and `CsrmInformationAsset` has no owner field. Adding one needs a content-type change, which Phase 10 makes none of (D-01), so the Information Asset owner moves to Phase 22 with a contract-gap record (D-37; REQUIREMENTS.md, ADMIN-05 Remainder; ROADMAP Phase 22, "Carried from Phase 10"). Everything else in ADMIN-05 is delivered here: system owners by name and the owner and criticality columns (10-16), complete Privacy Principle titles and Risk Type descriptions (10-17), the label rule (10-15), and a title for every seeded control (10-22, corrected by walkthrough fixes 3, 3b, 3c and 3d).

**UAT-053 is closed except its asset half.** The system owner and the list columns are delivered (B2, W14); the Information Asset owner is the part that moves to Phase 22 with ADMIN-05.

## Manual-Only

The pilot's results for the Manual-Only items of `10-VALIDATION.md`, copied verbatim.

- Question add on a hosted-provider questionnaire: open. Adding a question writes data, and the seed has no hosted-provider questionnaire.
- Browser leave prompt on reload: open. It needs a typed answer, which autosave would write, and there is no throwaway questionnaire.
- Screen-reader cadence: open, because no screen reader was available. The save status is confirmed as a polite status region.
- APP titles against Schedule 1 of the Privacy Act 1988 (Cth): pass. APP-1 to APP-12 match the Schedule 1 headings in sentence case (walk 1). APP-13 "Correction of personal information" matches, and its subclauses 13.1 to 13.5 are complete and in order (re-walk).
- Copy voice: pass after Fix 5. The middle-dot joins and sentence-case labels were checked in the re-walk.
- Descriptive control titles against their paragraphs: pass after Fix 3c. All 386 were audited independently, and the 18 faulty or ambiguous titles were corrected. The Annex A 8.1 spelling ("endpoint" or "end point") is open for the operator, who needs a licensed copy to check it.

## Task Commits

1. **Task 1: run the phase gate and the static checks, then commit the gate record**
   - `eed7ed0` fix(10-23): stop the generated-section test naming the AI provider variable
   - `984b048` docs(10-23): record the Phase 10 gate
2. **Task 2: the pilot's blocking-human browser walk.** Not approved on rounds 1 to 3; each round's defects were fixed inside this plan, test-first (GSD Rule 1). Approved 2026-10-03 with the Fix 3d and Fix 8 addendum rulings.
   - Fix 2: `7e07dba` (test), `a31ae03` (fix), `f60fd2f` (record)
   - Fix 3: `ee24167` (test), `0797c33` (fix), `ac34d19` (fix: the seed verifiers), `5a4c544` (record)
   - Fix 3b: `a99efae` (test), `feac941` (fix), `81b8343` (record)
   - Fix 1: `de7ab44` (test), `d1c75b7` (fix)
   - Fix 4: `7c371d6` (test), `8c4e2a7` (fix)
   - Fix 5: `1fae217` (test), `f193a3d` (fix)
   - Fix 6: `3786559` (test), `c5cdf00` (fix); fixes 1, 4, 5 and 6 recorded in `5ef0f88`
   - Second gate: `0b9557c` (record)
   - Fix 7: `15b08f7` (test), `ee7c673` (fix)
   - Fix 8: `ba1d9bb` and `d045322` (tests), `d6e29c5` (fix); deferrals `c9122fe`; fixes 7 and 8 recorded in `c8508a6`
   - Fix 3c: `be545dd` (test), `9306359` (fix), `4c10b43` (record)
   - Third gate: `d89f419` (record)
   - Fix 3d: `05b5482` (test), `7385b91` (fix)
   - Fix 8 addendum: `67e7617` (test, RED), `fe7d6fb` (test, the scoped exception and the keyboard proof)
   - Fix 3d and the addendum recorded in `f51fe3d`
3. **Task 3: record the browser checks, the requirement coverage and the Manual-Only results:** docs(10-23): record the Phase 10 browser checks (this record).

Also in the range, not this plan's: `ac5ad66` docs(contract-gaps): approve Phase 10's governance-log amendments (G-6), the orchestrator's commit. `commits: 39` in the frontmatter is `git rev-list --count a2182e4..f51fe3d` and includes it; the Task 3 record is the 40th.

## Files Created/Modified

Every file is listed under `key-files` in the frontmatter, and each fix section names its own. In summary:
- **Strapi seed data and its guards:** APP-13's curated text (`privacy-act-app-ndb-2026-06-04.json`), the descriptive titles and their `supersededTitles` (`csrm-control-titles.json`), the description and name ownership rules (`seed-csrm-data.ts`), the served-text bound (`served-text.ts`, `administration-query.ts`, `csv-import.ts`), and the two seed verifiers with their shared file list (`scripts/`).
- **Web:** the unchanged Save assessment (`assessment-domain.ts`, `assessment-editor.tsx`), the analyst Next action (`request-domain.ts`, `assessment-detail.tsx`), copy joins and labels (`risk-details.tsx`, `assessment-request-link.tsx`, `administration-config.ts`, `csv-import-flow.tsx`), discard focus (`mitigation-control-list.tsx`), wrapping titles (`administration-workspace.tsx`) and listbox popups (`relation-picker.tsx`, `owner-combobox.tsx`, `risk-register-filters.tsx`).
- **Tests:** the unit, mounted and journey proofs each fix section lists, and `e2e/accessibility.spec.ts` (fix 8's open-list scans and the addendum's overflow test).
- **Records:** this summary and `deferred-items.md`.

## Decisions Made

- The `CSRM_AI_` check stays as the plan wrote it. Its failure was resolved in the source, never by narrowing the check: the assertion read a value and changed no configuration, but the gate's rule is literal, and the assertion added nothing the test does not already prove.
- `api:check` and its refresh are recorded as separate steps, so each exit code means one thing (5a and 5b above).
- The brief's six commands were used (`--dir` forms; `lint` added), which the rules file names as equivalent to the plan's five `--filter`/`--prefix` forms.
- Each walkthrough fix records its own decisions in its section; the frontmatter's `key-decisions` lists them all.
- **Fix 3d's wording.** The title keeps "appropriate" on "access" and keeps fix 3b's verb-first shape, rather than the pilot's example, which opens with the paragraph's own opening phrase.
- **The addendum's scope.** The exception is a filter on one rule and one target, not an axe `exclude`, and it applies only in the overflow test that proves the keyboard path. Fix 8's 28 scans keep their strict rule.
- **Requirement status.** `requirements-completed` lists the six delivered requirements. ADMIN-05 is `requirements-partial` and stays open in REQUIREMENTS.md with its Remainder, so nothing calls it fully closed.
- **The browser and Manual-Only sections are the pilot's text,** copied by script from the pilot's final table and checked with `diff` against it; no row was added, edited or filled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A Phase 10 test line broke the gate's `CSRM_AI_` source check**
- **Found during:** Task 1 (static check 4, first run at `a2182e4`)
- **Issue:** `e66a853` (10-09) added `assert.equal(process.env.CSRM_AI_PROVIDER, "deterministic");` to `questionnaire-governance.integration.test.ts`. The check `git diff 5ea2b77..HEAD -- apps … | grep '^[+-].*CSRM_AI_'` printed it, so the plan's verify command could not exit 0.
- **Fix:** replaced the assertion with a comment naming the proof the test already makes. The harness pins the deterministic provider (`strapi-http-harness.ts:455`, unchanged since `5ea2b77`), and `GENERATED_ADD_CONTEXT_SECTION` asserts the deterministic `context` section at order 0, which a hosted generation would fail.
- **Files modified:** `apps/backend/tests/questionnaire-governance.integration.test.ts`
- **Verification:** the failing proof was static check 4 itself. After the edit, check 4 printed nothing, and the file ran alone with 11/11 passing (34 s, `p10-23-fix-governance-file.log`). Then the whole gate reran (the table above).
- **Committed in:** `eed7ed0`

**2 to 12. [Rule 1 - Bug] The walkthrough fixes (Task 2).** Fixes 1 to 8, 3b, 3c and 3d, and the Fix 8 addendum, each found by the pilot's walk or its rulings and each fixed failing test first. Each has its own section under `## Walkthrough fixes` with the issue, the fix, the files, the RED and GREEN runs and the commits.

---

**Total deviations:** 12 auto-fixed (12 bugs: the gate's `CSRM_AI_` line and eleven walkthrough fixes, the addendum counted with Fix 8).
**Impact on plan:** each fix stays inside Phase 10's scope. No content type, contract, specification, role-function catalogue or `CSRM_AI_` configuration changed (the static checks), and no Keycloak file changed.

## Issues Encountered

- `git update-index --refresh -- <path>` exits 1 on this host while the operator's two `types/generated` files stay stat-dirty (note 5b). This is host-expected, not a defect.
- The Next `destination stream closed early` server log noise is recorded under Phase gate notes.
- `check tdd-red-evidence` reads TAP or JUnit, not Playwright's list reporter, so the addendum's RED was rerun with the JUnit reporter to be checked (Fix 8 addendum, Runs).

## Deferred

All in `deferred-items.md`, none blocking: the Phase 7 fixtures' unreachable state (fix 4), the CPS 230 and CPS 234 PDF-extraction leftovers, the non-Phase 10 list columns without the long-text option, the specification's unserved `updatedAt`, and the ISO Annex A 8.1 spelling for the operator. The Information Asset owner moves to Phase 22 (ADMIN-05 Remainder). The three Manual-Only items the pilot leaves open stay open.

## Next Phase Readiness

- Plan 10-23 is complete: Tasks 1 to 3 are done, and every Phase 10 plan has a summary.
- Not run here, by instruction: the full phase gate. Fix 3d and the addendum change code after the third gate, so the orchestrator runs one final full gate (brief §5, `verify:csrm-seed` and the four static checks against `5ea2b77`) after the code review, the regression gate and `gsd-verifier`.
- The phase is not marked complete here; the orchestrator does that after verification and the final gate.
- No dev server is running, and the executor started none.

## Self-Check: PASSED

- Files found: `csrm-control-titles.json`, `control-titles.unit.test.ts`, `accessibility.spec.ts` and this summary.
- Commits found: `eed7ed0`, `984b048`, `d89f419`, `05b5482`, `7385b91`, `67e7617`, `fe7d6fb` and `f51fe3d`.
- `## Browser checks` and `## Manual-Only` match the pilot's final table line for line (`diff` printed nothing); 16 B-rows at 375 and 1440 read pass; no cell reads pending or issue.

---
*Phase: 10-existing-flow-gap-closure*
*Gate recorded: 2026-10-02; walk approved and plan completed: 2026-10-03*

## Phase gate (final run, after the code review)

Run by the orchestrator at `00306ac`, after Fix 3d and the Fix 8 addendum, the code review gate (56 findings: 52 fixed test-first, 1 skipped with evidence, 3 deferred with routes; `10-REVIEW-DISPOSITION.md`), the regression gate, the `verify:post` steps (`10-SECURITY.md` SECURED with 87/87 threats closed; `10-VALIDATION.md` validated and Nyquist-compliant; `10-UI-REVIEW.md` 20/24 with its disposition) and the verifier (`10-VERIFICATION.md`: 6/6 success criteria, no gaps). No dev server ran; no fix was needed during the run.

| # | Command | Result | Duration | Exit |
|---|---|---|---|---|
| 1 | `pnpm --dir apps/csrm api:check` | no diff in `schema.d.ts` | 1 s | 0 |
| 1b | `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | exits 1 only for the two operator `types/generated` files (as in every run) | under 1 s | 1 |
| 2 | `pnpm --dir apps/csrm typecheck` | clean | 3 s | 0 |
| 3 | `pnpm --dir apps/csrm lint` | clean | 3 s | 0 |
| 4 | `pnpm --dir apps/csrm test` | 2,862 passed in 134 files, 0 failed, no `EPERM` rerun | 29 s | 0 |
| 5 | `pnpm --dir apps/backend test` | 660 passed, 0 failed, 0 skipped, 0 cancelled | 650 s | 0 |
| 6 | `pnpm --dir apps/csrm test:e2e` | 88 passed: desktop 84, mobile 4; 0 failed, 0 flaky, 0 skipped (the Next server logged "The destination stream closed early" 32 times; no test asserts on it) | 12.3 min | 0 |
| 7 | `pnpm verify:csrm-seed` | the catalogue and runtime verifications both pass | 25 s | 0 |

Against the third run (`4c10b43`): Strapi 649 → 660 (+11, the code review fixes' mounted proofs), web 2,777 → 2,862 (+85), Playwright 87 → 88 (+1, the overflowing-picker proof of the Fix 8 addendum).

**Static checks since `5ea2b77`:** (1) no content-type file changed; (2) `cmp` of the two role-function catalogue copies is silent (exit 0); (3) no Keycloak path among the 254 changed files; (4) no `CSRM_AI_` source line added or removed; (5) the four vendored catalogues 10-22 guards are byte-identical.

**`git status --short` after the run:** only the three operator items (` M apps/backend/types/generated/components.d.ts`, ` M apps/backend/types/generated/contentTypes.d.ts`, `?? example-risk-assessment-questions/`).
