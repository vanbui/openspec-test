---
phase: 14-request-attachments
plan: 17
subsystem: testing
tags: [playwright, axe, uat-012, clamd, s3, residual-risks, phase-gate, attachments]
requires:
  - phase: 14-request-attachments
    provides: "14-01 to 14-16: the attachment content type, storage and scanning ports, the Strapi routes and policies, the Files section, note chips, the upload queue, the analyst pages' files line and AI-inputs signal, the AI control and What the AI used's Files group, and the spec's earlier journeys"
  - phase: 13-request-pick-up-and-notes
    provides: "13-07's Second Security Analyst sign-in; the notes thread and its New flag"
provides:
  - "E2E COLLAB02_UAT012_SCENARIO @journey: UAT-012's yardstick scenario for Jane, Bob, the second analyst and the Secondary Requestor at 1440 and 375, axe at every page change"
  - "apps/backend/README.md `## Request attachments (Phase 14)`: the ten settings, private S3 (Block Public Access, Bucket owner enforced, SSE-KMS, versioning, lifecycle), clamd and freshclam limits, the reverse proxy's per-path body limits, Media Library rights, the manual checks"
  - "docs/security/strapi-http-hardening.md: the attachment route's own bound, the multipart cleanup middleware, the five unmounted upload routes, no upload handlers for the API token"
  - "docs/security/phase-08-residual-risks.md: R-08-43 (ISM-2059 against quarantine), R-08-44 (Media Library), R-08-45 (the retention constant until Phase 22); R-08-02, R-08-04, R-08-13, R-08-36, R-08-37 and R-08-39 amended"
  - "COVERAGE.md: the clamd and @strapi/provider-upload-aws-s3 capability matrices"
  - "The Phase 14 gate record (below)"
affects: [15, 19, 20, 22]
actuals:
  tokens: 13690
  tasks: 3
  commits: 5
plan_head_before: e25a8ba9e60359669532537569701142d6e7c116
plan_head_after: e0cb9efcbd7962e80a44379e8e1d123af8219469
tech-stack:
  added: []
  patterns:
    - "A phase's yardstick scenario is one @journey that crosses every persona on its own records, with axe at each page change and a clean-up on #notes so no New flag leaks into a later journey"
key-files:
  created:
    - .planning/workstreams/csrm/phases/14-request-attachments/COVERAGE.md
  modified:
    - apps/csrm/e2e/request-attachments.spec.ts
    - apps/backend/README.md
    - docs/security/strapi-http-hardening.md
    - docs/security/phase-08-residual-risks.md
key-decisions:
  - "Both clean-ups in the journey (Bob's and the second analyst's) land on #notes first, because a note is only marked read when its thread is seen (WR-602)"
  - "\"Regenerates\" uses the hub's existing Replace questionnaire (Phase 10 D-08), through a replaceQuestionnaire helper that waits for the deterministic job and returns the hub's new questionnaire link"
  - "\"Jane Doe · Requestor\" is checked as the name and the part separately, because the row lays them out apart at 375"
  - "README: S3 lifecycle rules count from an object's creation, so they never expire current objects; the rule only changes storage class and expires noncurrent versions after at least 7 years. Deleting after closure stays CSRM's (ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE)"
  - "Task 2 was committed before Task 1 because it does not depend on the journey"
  - "The journey's first failure (the notes link's 35.9 by 16 px target, WCAG 2.2 SC 2.5.8) was owned by 14-11; the orchestrator re-opened 14-11 (7f42b392, cfa23fb5, 323d1082) and this spec was not changed for it"
  - "Static check 4 (Keycloak paths) prints one test file whose fake gained stubs in 14-03 and 14-04 (both recorded Rule 3). No Keycloak source, configuration, flag or example-env line changed and the test's assertions hold, so it is recorded as met in intent and left for the pilot to accept or narrow; nothing was patched"
requirements-completed: [COLLAB-02]  # traced here; COLLAB-02 stays Pending until phase close (the pilot's stage B)
coverage:
  - id: D1
    description: "UAT-012 end to end: Jane creates the payroll SaaS request with the security pack, the data-flow document and the questionnaire spreadsheet, and submits it; Bob generates the questionnaire; Jane adds the architecture deck with her note; Bob sees the note flagged New and all four files with Jane Doe, Requestor and a time; he includes the pack (Included · all {m} characters) and the data-flow document stays out; the questionnaire page reads 4 files · 1 included in the AI inputs and its signal names the pack Included since; he replaces the questionnaire and What the AI used lists 1 file included, the pack and not the data-flow document; the second analyst removes the spreadsheet, Bob sees Removed by Sam Analyst with no Restore, the second analyst restores it; the Secondary Requestor gets the not-found state and the analyst page's refusal with no file name, title or number. Axe clean at every page change, no horizontal overflow, at 1440 and 375."
    requirement: COLLAB-02
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_UAT012_SCENARIO @journey (desktop 37.1 s, mobile 35.7 s)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The deployment requirements, hardening notes, residual rows and amendments, and the two API coverage matrices"
    verification:
      - kind: other
        ref: "Task 2's grep verify (README section, AlertExceedsMax, Bucket owner enforced, ISM-2059, 27 MiB, csrm-multipart-cleanup, /api/upload/files/page, INSTREAM | INTEGRATE, getSignedUrl | INTEGRATE, no empty OPT-OUT reason)"
        status: pass
    human_judgment: true
    rationale: "The grep proves the documents carry their requirements; whether an operator can deploy private storage and scanning safely from the README is a reading judgment for the pilot."
  - id: D3
    description: "The Phase 14 gate: api:check, typecheck, lint, web, Strapi and Playwright on both projects, a clean tree and the six static checks"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "pnpm --dir apps/csrm test (4,819/4,819)"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend test (1,247/1,247)"
        status: pass
      - kind: e2e
        ref: "pnpm --dir apps/csrm test:e2e (222/222)"
        status: pass
    human_judgment: true
    rationale: "Static check 4 (Keycloak paths) prints one test file, met in intent; the pilot decides whether to accept it or narrow the check."
duration: 87min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 17: UAT-012 End to End, the Deployment Record and the Phase Gate Summary

**UAT-012 now passes from start to finish in the browser at 1440 and 375, across Jane, Bob, the second analyst and the Secondary Requestor. Operators have the private S3, ClamAV and reverse-proxy requirements. Three new residuals are on the register, and Phase 14 passes its full gate: web 4,819, Strapi 1,247 and Playwright 222 (167 desktop, 55 mobile), with none flaky.**

- **The scenario.** `COLLAB02_UAT012_SCENARIO @journey` runs on its own records. It covers:
  - files at intake and with a note;
  - all four files with who added each and when;
  - the inclusion, the files line and the AI-inputs signal;
  - a regeneration whose What the AI used lists the pack and not the data-flow document;
  - a removal with Restore for the remover only;
  - nothing at all for the Secondary Requestor.
- **The record.** The README's `## Request attachments (Phase 14)`, the hardening notes, `COVERAGE.md` and the residual register. The new rows are **R-08-43** (ISM-2059 read against quarantine), **R-08-44** (administrators see attachment files in the Media Library) and **R-08-45** (the retention period). R-08-45 is the constant `ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE` (7, in `apps/backend/src/csrm/files/attachment-policy.ts`). Phase 22's Admin setting takes it over (ROADMAP Phase 22, "Carried from Phases 12, 14 and 19.1").
- **The re-opening.** The journey's first run found a WCAG 2.2 SC 2.5.8 defect owned by 14-11. The orchestrator re-opened 14-11 and fixed it there: `7f42b392` test, `cfa23fb5` fix, `323d1082` docs. This spec did not change for it.

PHASE_14_BASE=e50053f. COLLAB-02 is traced here (`requirements-completed` copies the plan's array, as the template asks), but it stays Pending until phase close, the pilot's stage B. REQUIREMENTS.md is unchanged.

## Performance

- **Duration:** 87 min for this continuation (2026-10-10T12:19:28Z to 13:46Z), mostly the three suite runs: Task 1's spec 5.3 min, Strapi 30.6 min, Playwright 29.5 min. The previous executor wrote Task 2 and the journey earlier.
- **Tasks:** 3 of 3. Task 1 is the tracer: its verify passed end to end on both projects before its commit, and no checkpoint was synthesized (`auto_advance` false, `end-of-phase`, automated verify only).
- **Files:** 5 (1 created, 4 modified). 406 lines were added across the plan's two commits (226 spec, 180 docs) and 11 removed.

## Task Commits

1. **Task 1 (tracer): UAT-012's scenario.** `e0cb9efc` test(14-17): prove UAT-012's attachment scenario end to end at both widths.
2. **Task 2: deployment, hardening, residuals, API coverage.** `0232360b` docs(14-17): record attachment deployment, hardening, residuals and API coverage. It was committed first because it does not depend on the journey.
3. **Task 3: the phase gate.** No file changed: no journey assertion was wrong.

**The 14-11 re-opening (orchestrator, between Task 2 and Task 1):** `7f42b392` test(14-11), `cfa23fb5` fix(14-11), `323d1082` docs(14-11).

`git rev-list --count e25a8ba9..HEAD` is 5 before this summary's commit: this plan's two, plus the three 14-11 commits.

## Accomplishments

- **The scenario, step by step (D-39; ROADMAP success criteria 1 to 5):**
  1. **Intake.** Jane creates `Payroll SaaS UAT-012 …` from the new-request form with `vendor-security-pack.pdf`, `data-flow.docx` and `vendor-questionnaire.xlsx`, sees them on the draft, and submits.
  2. **Generation.** Bob sees `3 files` and generates the questionnaire from the hub.
  3. **The note.** Jane writes `The vendor sent their architecture deck after today’s call` and attaches `architecture-deck.pptx`. The deck arrives with its note as a `#file-` chip, and her Files section counts four.
  4. **Bob's view.** Jane's note shows `New`. Each of the four files shows `Jane Doe`, `Requestor` and a `<time>`. Bob then reads the thread on `#notes`.
  5. **The inclusion.** Bob includes the pack: the toast appears, then `Included · all {m} characters`. The data-flow document stays `Not included`. Axe runs before the toast.
  6. **The questionnaire page.** It reads `4 files · 1 included in the AI inputs`, linking to `#files`. The signal `AI inputs changed since this questionnaire was generated` names the pack `Included since`, links to its row, leaves the data-flow document out and says `The AI hasn’t seen these changes.`
  7. **The regeneration.** `Replace questionnaire` runs, and the new run has no signal. What the AI used's `Files` group reads `1 file included` and lists the pack (`Requestor file · {n} characters sent`). The data-flow document appears nowhere in the sheet.
  8. **The removal.** The second analyst removes the spreadsheet: no confirmation, the toast, `3 files`. The second analyst then reads the thread on `#notes`.
  9. **Bob after the removal.** The spreadsheet is out of his list. The removed group reads `Added by Jane Doe · ` and `Removed by Sam Analyst · `, with two times and no Restore.
  10. **The restore.** The second analyst restores it: the toast, `4 files`, and no removed group.
  11. **The Secondary Requestor.** She gets `Page not found` on the Requestor URL and `You don’t have permission to review this request` on the analyst URL. Neither page has a Files region, and neither page's HTML holds a file name, the title or the request number.
  - Axe (no serious or critical violation) runs at every page change, and `expectNoHorizontalOverflow` runs on the populated pages, at 1440 and 375.
- **The README** (`## Request attachments (Phase 14)`):
  - the ten settings and their development defaults, and unset storage or scanning outside development turning attachments off;
  - the private S3 bucket: Block Public Access, Bucket owner enforced, SSE-KMS, versioning, the lifecycle rule, the minimum IAM and KMS actions, and no `baseUrl`;
  - `clamd` with `freshclam` (`StreamMaxLength 30M`, `MaxFileSize 30M`, `MaxScanSize 256M`, `AlertExceedsMax yes`), never on the build host;
  - the reverse proxy's limits: 6 MiB, and 27 MiB on the four attachment page paths;
  - Media Library rights kept with super admins;
  - the manual checks.
  - No bucket, host, key or token value appears.
- **The hardening doc:**
  - the attachment route's own bound, formidable's cap and `global::csrm-multipart-cleanup`;
  - the five upload plugin content-API routes as unmounted;
  - the upload handlers removed from what the API token reaches.
- **The residual register:**
  - **R-08-43 (ISM-2059 against D-13's quarantine).** The compensating control is quarantine: the bytes stay private and isolated, and are never served, extracted or included until a scan passes. The evidence is `attachment-quarantine.integration.test.ts`.
  - **R-08-44.** Administrators see attachment files in the Media Library. The recommendation is super-admin-only rights; a Media Library delete reads `File unavailable`.
  - **R-08-45.** The retention constant stands until Phase 22's setting.
  - **Amended:**
    - R-08-02, narrowed;
    - R-08-04, with 6 MiB, and 27 MiB on the four attachment pages;
    - R-08-13, with the attachment security events;
    - R-08-36, with the re-scan scheduler;
    - R-08-37, with the attachment count race (proven on SQLite only);
    - R-08-39: attachments never pass through `sharp`.
- **COVERAGE.md:**
  - **clamd:** `INSTREAM` and `VERSION` INTEGRATE. `PING`, `SCAN`, `CONTSCAN`, `MULTISCAN`, `ALLMATCHSCAN`, `FILDES`, `IDSESSION`/`END`, `STATS`, `RELOAD`, `SHUTDOWN` and `VERSIONCOMMANDS` are OPT-OUT, each with its reason.
  - **@strapi/provider-upload-aws-s3 5.51.0:** `upload`, `delete` and `getSignedUrl` INTEGRATE. `uploadStream`, `isPrivate`, `getObjectMetadata`, `objectExists` and `checkFileSize` are OPT-OUT, each with its reason.

## Phase gate

Run from the repository root under Node v24.19.0 and pnpm 11.24.0 (the brief's shim), on 2026-10-10, at `e0cb9efc`.

| # | Command | Result |
|---|---|---|
| 0 | `netstat -ano \| grep -E ':(1337\|3000) .*LISTENING'` | Empty (exit 1) before each suite. No dev server was started. |
| 1 | `pnpm --dir apps/csrm api:check` | Exit 0. `openapi-typescript 7.13.0` regenerated `schema.d.ts` with no diff. |
| 2 | `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | Exit 0, not staged. |
| 3 | `pnpm --dir apps/csrm typecheck` | Exit 0 (`next typegen && tsc --noEmit`). |
| 4 | `pnpm --dir apps/csrm lint` | Exit 0. The script is the same `next typegen && tsc --noEmit`. |
| 5 | `pnpm --dir apps/csrm test` | `Test Files 210 passed (210)`, `Tests 4819 passed (4819)`, 110.6 s. |
| 6 | `pnpm --dir apps/backend test` (in the background, with `IDAMBOX_KEYCLOAK_PROVISIONING=false IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=false`) | `ℹ tests 1247`, `ℹ pass 1247`, `ℹ fail 0`, cancelled 0, skipped 0. `duration_ms 1838472` (30.6 min). Exit 0. |
| 7 | `pnpm --dir apps/csrm test:e2e` (in the background, after 6, production build) | `222 passed (29.5m)`. Desktop 167/167, mobile 55/55. Flaky 0, failed 0. Exit 0. `COLLAB02_UAT012_SCENARIO` and `REQ08_REASSIGN_THROUGH_PICKER` passed on both projects. |
| 8 | `git status --short` | Empty after every suite. Not even the three operator items show. |

**Task 1's own verify (before its commit):** `pnpm --dir apps/csrm test:e2e e2e/request-attachments.spec.ts` gave `20 passed (5.3m)`: desktop 11, mobile 9. UAT-012 took 37.1 s on desktop and 35.7 s on mobile. `git status --short` then showed only the spec.

**Against the baseline:** at `678b117`, web was 2,048, Strapi 578 and Playwright 84. At this gate they are 4,819, 1,247 and 222, with Phases 10 to 14 added. The last full runs before this gate were 14-16's web 4,801 and Playwright 220 (14-17 adds 2 journeys and 14-11's re-opening 18 unit cases).

**The six static checks:**

| # | Check | Output | Result |
|---|---|---|---|
| 1 | `git diff --name-only e50053f..HEAD -- 'apps/backend/src/api/*/content-types/*'` | `apps/backend/src/api/csrm-request-attachment/content-types/csrm-request-attachment/schema.json` | Pass: exactly the attachment schema |
| 2 | `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | silent, exit 0 | Pass |
| 3 | `git grep -n -I "ANTIVIRUS-TEST" -- apps` | empty, exit 1 | Pass |
| 4 | `git diff --name-only e50053f..HEAD \| grep -i keycloak` | `apps/backend/tests/keycloak-provisioning.unit.test.ts` | **Literal fail, met in intent** (below) |
| 5 | `pnpm --dir apps/backend why fflate` | `fflate@0.8.3` ← `read-excel-file@9.3.10` ← `@csrm/strapi`; `Found 1 version of fflate` | Pass |
| 6 | `git diff e50053f..HEAD -- apps/backend/package.json apps/csrm/package.json` | `apps/backend` adds `@strapi/provider-upload-aws-s3` 5.51.0, `read-excel-file` 9.3.10 and `unpdf` 1.8.1 (the `styled-components` line only moved). `apps/csrm/package.json` has no diff. | Pass |

- **2026-10-11, stage B (WR-305):** check 3 could not see files git treats as binary: `-I` skipped the whole attachment fixture folder, whose README `.gitattributes` then marked binary too. The final gate runs `git grep -n -a -E 'EICAR-STANDARD|ANTIVIRUS-TEST' -- apps` (`-a`, no `-I`), and the attribute now marks only the fixture types binary. Check 4's test file changed once more in stage B, for IN-303: only the environment isolation around `register`, and one assertion that exactly one `CSRM attachments` line is logged, as the pilot's ruling allows.

**Check 4 in detail.** The test file changed in three commits:

- 14-03's `441ae152` added `config.set` and `dirs.app.root` to the test's fake Strapi, because `register()` now validates the attachment settings. It also filters the one `CSRM attachments` info line before asserting that Keycloak logs nothing.
- 14-04's `e9ea4e00` and `ee367d5e` added `plugin()`, because `register()` now installs the private provider and unmounts the upload routes.

Both plans recorded these edits as Rule 3 deviations.

What did not change:

- No Keycloak source, configuration or flag changed. `src/index.ts` has no changed Keycloak line, and no `.env.example`, `.env.e2e` or `playwright.config` line touching `KEYCLOAK`, `OIDC` or `DEV_IDENTITY` changed.
- `Strapi register skips Keycloak entirely when provisioning is disabled` still asserts no middleware, no network call and no Keycloak log line, and it passed in step 6 with every other Keycloak test.

Reverting the fakes would break the Strapi suite, so nothing was patched. The pilot decides whether to accept this or narrow the check to Keycloak source, configuration and flags.

**Route budgets** (delivered JS, desktop, from this run's `apps/csrm/.tmp/performance/baseline-desktop.json`). There is no `ROUTE_BUDGET_OVERRIDES` entry.

| Route | Actor | Delivered | Budget | Left |
|---|---|---|---|---|
| `/app` | Requestor | 229,093 | 300,000 | 70,907 |
| `/app/requests` | Requestor | 251,491 | 300,000 | 48,509 |
| `/app/requests/{documentId}` | Requestor | 293,918 | 300,000 | 6,082 |
| `/app/questionnaires/{documentId}` | Requestor | 358,151 | 500,000 | 141,849 |
| `/app` | Security Analyst | 229,093 | 300,000 | 70,907 |
| `/app/review/assessments/{documentId}` | Security Analyst | 318,162 | 460,000 | 141,838 |
| `/app/risks` | Security Analyst | 262,620 | 300,000 | 37,380 |
| `/app/risks/{documentId}` | Security Analyst | 293,677 | 300,000 | 6,323 |
| `/app/reports/risk-exposure` | Security Analyst | 254,643 | 300,000 | 45,357 |
| `/app/admin/controls` | Security Analyst | 249,542 | 300,000 | 50,458 |

These match 14-16's figures within a few bytes. The 14-11 fix is server-rendered and adds no client JS.

## Decisions Made

See `key-decisions` in the frontmatter (one line each). The orchestrator decisions this phase relies on, as cited by the run:

- the D-30 off-only switch for an already-included file under a refusing AI policy (14-16);
- the attachment list's `meta.total` counts files not removed (14-08);
- file figures on the analyst pages use the human-analyst check, as notes do (14-11);
- the 14-11 re-opening for WCAG 2.5.8.

## Deviations from Plan

1. **[Order] Task 2 was committed before Task 1.** It does not depend on the journey, and the journey was waiting on 14-11's fix.
2. **[Owned elsewhere] The target-size defect went to 14-11.** The journey's first runs failed axe `target-size`: the notes link was 35.9 by 16 px, 4 px above 14-11's files link. The orchestrator re-opened 14-11 (`7f42b392`, `cfa23fb5`, `323d1082`). This spec was not changed for it.
3. **[Check scope] Static check 4.** It printed one Keycloak test file; it is met in intent and was not patched (see Phase gate).
4. **[Plan shape] "Regenerates" uses the hub's `Replace questionnaire`.** No other regeneration exists in analyst review (Phase 10 D-08).

**Total deviations:** 4 (1 order, 1 owned elsewhere, 1 check scope, 1 plan shape), none auto-fixed here. **Impact:** no change to scope. No content type, contract, Strapi source or dependency changed in this plan.

## Issues Encountered

- **Debug leftovers.** The two earlier failed runs left a debug database and Next build in `apps/backend/.tmp/` and `apps/csrm/.tmp/`. Both are git-ignored and harmless.
- **Next's logs.** Next logs `The destination stream closed early` and `failed-to-find-server-action` (from the body-limit test's deliberate action id). Every test passed, as in 14-15 and 14-16.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:

- **T-14-56 and T-14-57 are mitigated.** The README requires them, and the code sends no ACL, refuses a `baseUrl` and treats a limits reply as not scanned.
- **T-14-58 is transferred.** It sits under R-08-04.
- **T-14-59 is accepted.** It is R-08-43.
- **T-14-SC is mitigated.** Checks 5 and 6 cover it.

## User Setup Required

None for development. The production deployment requirements are in `apps/backend/README.md` `## Request attachments (Phase 14)`.

## Next Phase Readiness

- **Status:** all 17 plans of Phase 14 are complete. Next are the phase code review (stage A) and then the pilot's stage B, which marks COLLAB-02 complete.
- **For the pilot:** check 4 (Keycloak paths): accept it, or narrow the check.
- **For the UI review:**
  - Sonner's 20px toast Close over an open sheet at 375 (14-16);
  - the AI cell in compact density at 1440;
  - the off-only switch under a pinned classification limit.
- **Route headroom:** `/app/requests/{documentId}` has 6,082 bytes left and `/app/risks/{documentId}` 6,323.
- **Carried to Phase 22:** the retention constant `ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE` (R-08-45).

## Self-Check: PASSED

- FOUND: `apps/csrm/e2e/request-attachments.spec.ts`, `apps/backend/README.md`, `docs/security/strapi-http-hardening.md`, `docs/security/phase-08-residual-risks.md`, `.planning/workstreams/csrm/phases/14-request-attachments/COVERAGE.md`.
- FOUND: `e0cb9efc`, `0232360b`, `7f42b392`, `cfa23fb5`, `323d1082`.

## Phase gate (final run, after the code review)

Run by the stage B worker on 2026-10-11 from 04:22 to 05:17 UTC at `9beadaef`. These steps came first:
- **The code review.** `14-REVIEW.md` had 93 findings (3 Critical, 37 Warning, 53 Info). All are dispositioned in `14-REVIEW-DISPOSITION.md` under the pilot's rulings (`14-PILOT-RULINGS.md`): 62 fixed in code, 20 fixed test-only, 10 fixed in documents, 1 not reproduced. The pilot's walk items D1 to D7 and O1 to O9 are under "Pilot walk, 2026-10-11": 14 fixed, 2 needing no change. The contract changes are in the record's `## Amendment (2026-10-11, stage B)` (`11161d1`).
- **The regression run at `598bca87`.** Web 5,026 tests in 214 files, typecheck and `api:check` clean, Strapi 1,421 passed, 0 failed and 1 skipped. The full Playwright run passed 226 and failed 2, both harness timing defects: a sign-in button that a resting pointer kept moving, and a toast scanned mid-fade. Both were fixed in `bb808ac`, and the four specs they touch then passed 67 (desktop 35, mobile 32).
- **`verify:post`.**
  - `14-SECURITY.md` is SECURED, with 60 of 60 threats closed (`a69da470`).
  - `14-VALIDATION.md` is validated and Nyquist-compliant, with 2 gaps found and resolved (`2ca01f08`).
  - `14-UI-REVIEW.md` scored 21/24 (`170b5315`), and `14-UI-REVIEW-DISPOSITION.md` fixes all six warnings under the pilot's rulings (`7eba7013`).
- **The verification.** `14-VERIFICATION.md` has `status: human_needed` and `score: "5/5 roadmap success criteria verified at HEAD ce3a0b3b; 1/1 requirement (COLLAB-02, all five acceptance criteria) satisfied; 0 gaps; 6 operator checks remain"` (`227d325c`).
- **The UAT.** `14-UAT.md` is complete (`9beadaef`): 5 passed, 6 pending with the operator, the deployment or the pilot's next walk, and 1 skipped with automated proofs.

The gate ran from the repository root with Node v24.19.0 and pnpm 11.24.0. The tree was clean before the run, and ports 1337 and 3000 were free before the run, before the Strapi suite and before Playwright. No dev server ran. It was one full run with the suites one at a time, and every figure below comes from it. `PHASE_14_BASE=e50053f`.

| Gate | Command | Result | Duration | First gate (`e0cb9efc`) |
|---|---|---|---|---|
| `api:check` | `pnpm --dir apps/csrm api:check`, then `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | clean; nothing left modified | 2 s | clean |
| Typecheck | `pnpm --dir apps/csrm typecheck` | clean | 4 s | clean |
| Lint | `pnpm --dir apps/csrm lint` | clean | 4 s | clean |
| Web (Vitest) | `pnpm --dir apps/csrm test` | **Test Files 214 passed (214), Tests 5,041 passed (5,041)**. No `EPERM: rename` and no rerun | 59 s (Vitest 57.9 s) | 4,819 / 4,819 (210 files) |
| Strapi (node:test) | `IDAMBOX_KEYCLOAK_PROVISIONING=false IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=false CSRM_AI_PROVIDER=deterministic pnpm --dir apps/backend test` | **ℹ tests 1,424, ℹ pass 1,423, ℹ fail 0, ℹ skipped 1**. Cancelled 0, todo 0. The skipped test is the POSIX file-mode check (IN-209), which cannot run on Windows; its reason is stated in the test | 22.4 min (duration_ms 1,344,007) | 1,247 / 1,247 |
| Playwright (production build, both projects) | `pnpm --dir apps/csrm test:e2e` | **228 passed**: desktop **170**, mobile **58**. 0 failed, 0 skipped, 0 did not run (228 tests, 1 worker, no retries) | 30.1 min | 222 passed: desktop 167, mobile 55, 0 flaky |
| Tree | `git status --short` | empty: the run modified no tracked file | | empty |

The lint and typecheck scripts in `apps/csrm/package.json` are the same command (`next typegen && tsc --noEmit`). This is recorded as observed, not changed.

Phase 14's journeys in that run (`request-attachments.spec.ts`):

| Journeys | Desktop | Mobile |
|---|---|---|
| `COLLAB02_DRAFT_FILE_ADDED`, `COLLAB02_REFUSALS`, `COLLAB02_ANALYST_DOWNLOAD`, `COLLAB02_OTHER_REQUESTOR_NOT_FOUND`, `COLLAB02_REMOVE_UNDO`, `COLLAB02_CREATE_WITH_FILES`, `COLLAB02_NOTE_WITH_FILES`, `COLLAB02_AI_INCLUSION`, `COLLAB02_UAT012_SCENARIO`, `COLLAB02_FILE_STATES`, `COLLAB02_FILES_CLOSED`, `COLLAB02_NEW_FORM_REFUSED_ROW` | 12 passed | **12 passed** |
| `COLLAB02_LARGE_UPLOAD`, `ACTION_BODY_LIMIT_OUTSIDE_ATTACHMENT_PAGES` (desktop only: the transfer and the gate, not the layout) | 2 passed | not in the project |

**The walk defects' browser re-verification (the pilot's ruling).** Every journey that carries the browser assertions for D1, D2, D3 and D5 passed in this run, at 1440 (desktop) and at 375 (mobile):
- **D1:** each real link to a file or to the Files section lands, with the target in the viewport and focus on it (`expectLandedOn`): the questionnaire's files line and the signal's file link (`COLLAB02_UAT012_SCENARIO` step 6), What the AI used's file link (step 7 and `COLLAB02_AI_INCLUSION`), a fresh load of a removed file's `#file-{id}` (step 9; WR-506), the hub's `{n} files` link (`COLLAB02_REMOVE_UNDO`) and a note's chip (`COLLAB02_NOTE_WITH_FILES`).
- **D2:** the Files list fits its region at 1440, with every Download and Remove inside it and nothing overlapping the sticky name cell, on the analyst page (`COLLAB02_AI_INCLUSION`), the draft (`COLLAB02_DRAFT_FILE_ADDED`) and the seeded file states (`COLLAB02_FILE_STATES`).
- **D3:** axe runs with the inclusion toast showing over the open phone actions sheet, the toast's Close meets the target size, and the toast clears the sheet's `Preview text`, `Remove` and switch row at 375 (`COLLAB02_AI_INCLUSION`, and `COLLAB02_UAT012_SCENARIO` steps 8 and 10).
- **D5:** after the second analyst's Restore at 375, focus is on the restored card's `Download` (`COLLAB02_UAT012_SCENARIO` step 10).

**Performance budgets.** `performance.spec.ts` passed 11 / 11 on desktop. The figures come from this run's `apps/csrm/.tmp/performance/baseline-desktop.json`, measured 05:08:22 to 05:09:12 UTC. Every route is within its budget. `git diff e50053f..HEAD -- apps/csrm/e2e/performance.spec.ts` is empty, so Phase 14 added no override; the two existing overrides are unchanged.

| Route | Actor | Delivered JS bytes | Decoded | Budget | Left | First gate (`e0cb9efc`) |
|---|---|---|---|---|---|---|
| `/app` | Requestor | 229,641 | 733,620 | 300,000 | 70,359 | 229,093 |
| `/app/requests` | Requestor | 251,953 | 805,819 | 300,000 | 48,047 | 251,491 |
| `/app/requests/{documentId}` | Requestor | **295,891** | 941,593 | 300,000 | 4,109 | 293,918 |
| `/app/questionnaires/{documentId}` | Requestor | 358,507 | 1,221,242 | 500,000 (override) | 141,493 | 358,151 |
| `/app` | Security Analyst | 229,641 | 733,620 | 300,000 | 70,359 | 229,093 |
| `/app/review/assessments/{documentId}` | Security Analyst | 318,814 | 1,032,858 | 460,000 (override) | 141,186 | 318,162 |
| `/app/risks` | Security Analyst | 263,182 | 846,207 | 300,000 | 36,818 | 262,620 |
| `/app/risks/{documentId}` | Security Analyst | 293,710 | 943,989 | 300,000 | 6,290 | 293,677 |
| `/app/reports/risk-exposure` | Security Analyst | 255,478 | 812,212 | 300,000 | 44,522 | 254,643 |
| `/app/admin/controls` | Security Analyst | 250,377 | 804,191 | 300,000 | 49,623 | 249,542 |

`/app/requests/{documentId}` is the closest to its budget at 295,891 bytes, 1,973 bytes above the first gate, which leaves 4,109 bytes of headroom for Phase 15 to watch. Every time to first byte was under 19 ms (budget 500) and every largest contentful paint 512 ms or less (budget 2,500). The file also holds a `/app/review` entry measured on 2026-10-02. That entry is not from this run, so it is left out of the table.

**Server log noise, not a failure.** The harness's Next server logged `Error: The destination stream closed early.` 517 times: the production server reporting a streamed response whose client navigated away. No test failed on it, and the count follows the larger suite and its added navigations. The only other server errors were deliberate:
- 3 `Invalid Server Actions request` lines and 2 `The Server Reference ID did not match the expected format` lines, from `production-hardening.spec.ts`'s forged Server Actions and the body-limit journey's action id `0`;
- 2 `failed-to-find-server-action` notes, from the body-limit journey's inside check, which expects Next's 404.

No connection to the harness's servers dropped.

### Static checks against e50053f

At `9beadaef`: 256 commits since `e50053f` (113 of them in stage B, since `8ca61fa7`); 283 files changed, 43,195 insertions, 673 deletions.

| # | Check | Output | Result |
|---|---|---|---|
| 1 | `git diff --name-only e50053f..HEAD -- 'apps/backend/src/api/*/content-types/*'` | `apps/backend/src/api/csrm-request-attachment/content-types/csrm-request-attachment/schema.json` | Pass: exactly the approved attachment schema. Stage B changed no content type (`git diff --stat 8ca61fa7..HEAD` over the same path is empty) |
| 2 | `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | silent, exit 0; both SHA-256 `a7f9b476d04c0a6f3fa80af0d0ab5a6b95e106ab41b40c6e5aa5079692b12c59` | Pass. Stage B changed neither copy |
| 3 | The EICAR gate as WR-305 sets it: `git grep -n -a -E 'EICAR-STANDARD\|ANTIVIRUS-TEST' -- apps` (reads binary-marked files as text, both markers) | empty, exit 1 | Pass. `.gitattributes` now marks only the fixture types binary, so the fixtures' README is text again (IN-706). The old `-I` gate is also empty |
| 4 | `git diff --name-only e50053f..HEAD \| grep -i keycloak` | `apps/backend/tests/keycloak-provisioning.unit.test.ts` | **Pass, the one reviewed exception** (`14-PILOT-RULINGS.md`, "The Keycloak path static check"). Stage B's only change to it is IN-303's: `withKeycloakEnv` also clears `NODE_ENV`, `CSRM_ENVIRONMENT` and the `CSRM_ATTACHMENT_*` and `CSRM_CLAMAV_*` keys around `register()`, and one assertion pins exactly one `CSRM attachments` line (13 lines added, 3 removed). No Keycloak source, configuration, realm or flag changed |
| 5 | `pnpm --dir apps/backend why fflate` | `fflate@0.8.3` ← `read-excel-file@9.3.10` ← `@csrm/strapi`; `Found 1 version of fflate` | Pass |
| 6 | `git diff e50053f..HEAD -- apps/backend/package.json apps/csrm/package.json` | `apps/backend` adds `@strapi/provider-upload-aws-s3` 5.51.0, `read-excel-file` 9.3.10 and `unpdf` 1.8.1, and raises `engines.node` to `>=22.2.0 <=26.x.x` (IN-208; the `styled-components` line only moved). `apps/csrm/package.json` has no diff. Stage B changed no dependency and no lockfile line | Pass |
| 7 | Auth and identity flags in `.example` and `.env.e2e` files: `git diff e50053f..HEAD -- '*.example' '*.env.e2e' \| grep -E '^[+-].*(KEYCLOAK\|OIDC\|DEV_IDENTITY)'` | empty, exit 1 | Pass. `apps/backend/.env.example` changed only its attachment block (IN-707's placeholders and WR-705's `https://`) |
| 8 | `CSRM_AI_` lines in shipped source: `git diff e50053f..HEAD` over `apps/backend/src`, `apps/backend/config`, `apps/csrm/src`, `apps/csrm/app`, `proxy.ts` and `next.config.ts`, tests excluded | empty, exit 1 | Pass. Only tests name `CSRM_AI_` keys: WR-202's sentinel and the harness's cleared list |

**The tree after the gate.** `git status --short` printed nothing after the web suite, after the Strapi suite, after Playwright and before this record's commit. The run left no operator item and no modified generated file.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
