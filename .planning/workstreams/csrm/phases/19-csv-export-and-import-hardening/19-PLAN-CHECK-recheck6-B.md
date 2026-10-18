# 19 Plan Check: Re-check iteration 6, lane B (19-09, 19-10, 19-11, 19-12, 19-14, 19-15)

HEAD bdd0f698, 2026-10-16. Read-only.

**Verdict: ISSUES FOUND. 0 blockers, 1 warning, 3 info.** Every iteration-4 finding for these plans is resolved.

## Mechanical checks
- `verify plan-structure`: all six plans are valid, with 0 errors and 0 warnings. Task counts: 09=3, 10=4, 11=3, 12=4, 14=3, 15=4.
- `frontmatter validate --schema plan`: all six are valid.
- `bash -n`: all 21 automated blocks pass after entity decoding.
- `grep -c ProgramData`: 0 in every plan.

## Iteration-4 findings

### B-NB-1 / B-W-1 (19-09): Resolved
- **Fragment removal.** 19-09:147 and :207 remove only the report export literal from UNSERVED_PATH_FRAGMENTS. That leaves the alerts colon fragment, the two dashboard aliases and /acknowledge.
  - This matches the current analyst-insight-routes.unit.test.ts:81, which holds those four fragments plus the bare /export.
  - It also matches the chain in 19-05:198, where the bare /export becomes the alerts and reports literals, and in 19-08:143, which removes the alerts literal.
- **Served inventory.** 19-09:147 adds the report export to SERVED_INSIGHT_ROUTES (currently :38-74) with underlyingRead = CSRM_ANALYST_INSIGHT_OPERATIONS.getReport.
  - 19-08:145 makes the single deepEqual at :115-117 compare underlyingRead exactly, through an "in served" check.
  - 19-09 builds its insightPolicies with a conditional spread, so the two existing report reads keep the same config.
- **Literal checks.** catalogueUrl of POST /v1/reports/:reportKey/export equals the operation. The quoted read literal "/v1/reports/:reportKey" is not a substring of the export path, so the declared-elsewhere test (:139-148) still holds.

### B-W-2 (19-10): Resolved
- **Files listed.** files_modified (19-10:22-28) and the Task 1 files list both hold:
  - the new assessment-server-schema.ts;
  - assessment-schema.ts and assessment-service.ts;
  - all five web tests the move breaks.
- **Real importers.** A grep for releasedAssessmentDetailForActorSchema and analystAssessmentDetailSchema in apps/csrm/src finds only assessment-schema.ts, assessment-service.ts (:16, :39, :93, :96), assessment-service.test.ts (:14, :297-298) and released-assessment-route.test.ts (:97).
- **Typed fixtures.** The typed AnalystAssessmentDetail fixtures are in exactly the three test files the plan names:
  - assessment-editor.test.tsx :79 and :171;
  - risk-editor.test.tsx :72;
  - analyst-assessment-route.test.tsx :88 and :113.
- **Other analyst-actor fixtures.** None is missed:
  - ai-inputs-changed.test.tsx:285 is an untyped mock return value that is never parsed;
  - released-assessment.test.tsx:42 is the Requestor branch.
- **Mocks in place.**
  - released-assessment-route.test.ts:20 already mocks server-only.
  - assessment-service.ts:1 is already server-only.
  - releasedAssessmentViewSchema and releasedAssessmentViewKeys (:566, :581) have no other users, so they move cleanly.
- **Route budgets.** assessment-schema.ts gains no runtime code. The extended schema is used only from server-only modules, and the types are re-exported as types only (19-10:156-158). Nothing new loads on /app/risks/{documentId} (289 B headroom) or /app/requests/{documentId} (558 B).
- **Format.** The format is taken as a ?format= query parameter (19-10:234, :287, :315).

### C-NB-1 (19-15): Resolved
- **Each task regenerates before its suite.** 19-15:124 ("Contract guards per task") has each task regenerate the served inventory, with the dev servers stopped, and register its file responses with the parity guard:
  - Task 1: the templates;
  - Task 2: the error reports;
  - Task 3: the exports.
- **Files lists.** The files list of each task has served-operations.json and contract-response-parity.test.ts (:206, :243, :279).
- **Verify order.**
  - The Task 1 verify runs only contract-operation-chain.test.ts (:176-182) and the parity guard, not the full suite.
  - Tasks 2 and 3 run the full web suite only after their own regeneration step.

### C-W1 (19-15): Resolved
- 19-15:120 and :234, with administration-schema.test.ts in the Task 1 files and in files_modified.
- The parser cases are at :243-275 in the current code; the plan says :242-275 (cosmetic).
- The bounds cases are rewritten against checkImportFileInBrowser.

### C-W2 (19-15): Resolved
features/administration/import-flow-rules.ts is in:
- files_modified (:15);
- the Task 2 files list (:243);
- the copy-guard acceptance (:269).

### save-file.ts comment and Home citation: Resolved
- **save-file.ts.** 19-15:121 rewords the comment at save-file.ts:8-9, which names downloadAdministrationCsv in the current code. Task 1 lists the file.
- **Home citation.** app/(app)/app/page.tsx:24-29 runs from HomePage to canCreate, covering the granted read and the can checks. It is cited identically in:
  - 19-11 :52, :121, :234;
  - 19-12 :123;
  - 19-15 :132.
- **Alerts citation.** alerts/page.tsx:22-24 (19-11:134) is accurate.

### Header action order (pilot ruling): Resolved in 19-11, 19-12 and 19-15
- **19-11:132.** A single Export is the action itself. The two-action headers (My requests and throughput) sit in the md:flex-row-reverse wrapper with Export last in the markup.
- **19-15:128-129 and :296.** The wrapper at administration-workspace.tsx:271 is unchanged and Export is appended as its last child. Create keeps the right edge on desktop.
- **19-12:123.** The pair (Print report, then Export) is in the wrapper. The status badge stays with the title and number through the status slot of PageHeader (page-header.tsx:24-25), and the action group sits at the end of the header.

### 19-14 anchors and 19-15 stripping: Resolved
- **19-14 operations and catalogue.**
  - 19-14:39, :101-102, :123 and :243 use GET:/api/v1/{segment}/export?format={format} in the operations, both catalogue copies and the policy literals (:242).
  - The matrix and served rows use the stripped path (:241, :243).
- **19-15 stripping.** 19-15:136-137 anchors the full string and strips ?format={format} only for the served-anchor match, while still requiring that the path is served with a web caller. 19-11:153 states the same rule.
- **Pilot ruling 3.**
  - 19-09 takes format as a body field (:37, :131).
  - 19-10 takes it as a ?format= query parameter.
  - Their anchors carry no template (19-11:140; this matches the URL set across 19-07 to 19-10).
- **Stale claims.** A grep across all plans finds no claim that only the register export carries ?format.
- **Cross-plan URLs.** The export URLs in 19-07 to 19-10 and 19-14 match the nine anchors in 19-11 and the four in 19-15 exactly. The count chain 36 -> 37 (19-10) -> 41 (19-14) is consistent.

## New blockers
None.

## Warnings
**W-1 [key_links / files_modified]: every file that the analyst header change edits is in the 19-12 Task 3 file list.**
- **Plan:** 19-12, Task 3.
- **Evidence:**
  - 19-12:123 and :235 add Print report and Export {number} to the header of the analyst review page.
  - That header is not in the page. It is rendered by the client component apps/csrm/src/features/assessments/assessment-editor.tsx:846-850 (PageHeader with status and no action). The page only renders AssessmentEditor (app/(app)/app/review/assessments/[documentId]/page.tsx:140).
  - So the actions, plus the released and capability props, need an edit to assessment-editor.tsx, and probably a header case in a test. Neither file is in files_modified or in the Task 3 files list (19-12:227).
  - The route budget is not at risk: /app/review/assessments/{documentId} has 460,000 B (performance.spec.ts:77).
- **Example fix (non-binding):** add assessment-editor.tsx (and the test that asserts the header) to files_modified and to Task 3, and name the prop that carries the action group.

## Info
- **I-1.** 19-12:123 says the released header gains the actions "after its existing actions". released-assessment.tsx:174-178 has no action in the current code, so the wording is stale but harmless.
- **I-2.** 19-15:120 cites the parser cases at :242-275; the real lines are :243-275.
- **I-3.** The prompt mentions six web test files for 19-10. The plan lists five tests plus the new server-schema module, which makes six web files. The grep of the real code shows the five tests are the complete set.
