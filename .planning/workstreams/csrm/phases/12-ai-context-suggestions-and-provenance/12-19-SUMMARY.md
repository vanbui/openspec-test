---
phase: 12-ai-context-suggestions-and-provenance
plan: 19
subsystem: phase journey, glossary, coverage and gate
tags: [e2e, journey, glossary, coverage, gate]
requires:
  - phase: 12-14
    provides: the hub policy caption
  - phase: 12-15
    provides: the provenance header, the run sheet and the Requestor notice
  - phase: 12-16
    provides: markers, review bars and the release requirement
  - phase: 12-17
    provides: citations, suggestions and uncited claims
  - phase: 12-18
    provides: help text, Not sure and question origins
provides:
  - apps/csrm/e2e/ai-context-provenance.spec.ts (@journey, both projects)
  - e2e/helpers/assessment-release.ts (completeRiskForRelease and selectOwner, shared)
  - CONTEXT.md entries AI run, AI proposal, Information classification (request)
  - COVERAGE.md for the OpenAI-compatible provider surface
status: complete
completed: 2026-10-07
commits:
  docs-glossary: b90f0ad
  fix: 2a22ad7
  journey: 99754c2
  docs: (this commit)
---

# Phase 12 Plan 19 Summary

Executed by the pilot.

## Accomplishments

- `ai-context-provenance.spec.ts` (`@journey`) runs on its own records in both projects. The Security Analyst creates three systems (the payroll platform internet-facing) and a Restricted asset holding personal data through Administration; the Requestor submits a Project request selecting them, with Privacy Act and tax file number obligations and third-party involvement. The analyst sees the hub's classification caption, generates the questionnaire, and checks `PH12_C4_PROVENANCE_HEADER`, help text, the asset question and the run sheet's `Information assets` group, then releases through the AI-proposed description. The Requestor sees the AI disclosure and the Not sure paragraph, `PH12_C5_HELP_TEXT` (the hint describes the group) and `PH12_C5_NOT_SURE`, answers Not sure then Yes on the provider question and No on recovery, and submits. After the draft, `PH12_NEG_REQUESTOR_EDITOR_NOT_FOUND`; then `PH12_C1_SYSTEM_ASSET_LINKS`, `PH12_C1_TWO_RISKS_ONE_TYPE`, `PH12_C2_CITATION_OPENS_ANSWER` (Escape returns focus), `PH12_C2_NO_SOURCE_CITED`, `PH12_C2_CLAIMS_TO_CHECK`, the Accept treatment note, the sheet's `Control candidates`, completion of all five risks, `Confirm remaining` on every record, `PH12_C3_ADD_PLANNED_CONTROL` with Undo and re-add, dismiss and restore, release, and `PH12_C4_REQUESTOR_NOTICE` with no generator row and no AI internals. Axe (serious or critical) and overflow are checked on the governance page, the sheet, the Requestor's questionnaire, the editor with proposals, a source open, the editor's sheet and the released view.
- `completeRiskForRelease` and `selectOwner` moved unchanged into `e2e/helpers/assessment-release.ts`; the release journey imports them. The mobile project's spec list gains the new spec.
- CONTEXT.md gains `AI run`, `AI proposal` and `Information classification (request)`; COVERAGE.md records three INTEGRATE and four OPT-OUT rows, each with a reason.

## Gate (production build, 2026-10-07)

| Step | Result | Duration |
|---|---|---|
| `api:check` | clean | 24 s |
| web typecheck | clean | 13 s |
| web lint | clean | 6 s |
| web suite | 3,544/3,544 (160 files) | 150 s |
| Strapi suite | 756/756 | 35.7 min |
| Playwright, both projects | 158/159 passed; 1 failed (see below); 0 flaky reported | 25.4 min |

- The one failure is `risk-register-workflow.spec.ts` on the mobile project: the pixel check of the pinned header's end hairline at 768 px read the row colour instead of the hairline at `scrollLeft 7`. The spec passed 2/2 when re-run alone on the mobile project (2.4 and 3.0 min). Phase 12 changes nothing in the Risk Register; the check is timing-sensitive under the full suite's load. Recorded as a flaky pre-existing check, routed to the deferred items below.
- Freeze check against `PHASE_12_BASE=7e4fa02`: exactly the three approved schema files (`csrm-ai-run`, `csrm-assessment`, `csrm-risk`).
- The two catalogue copies are byte-identical. No Keycloak path changed.
- Manifests: `apps/backend/package.json` (+1) and `pnpm-lock.yaml` (+3) differ from the base, from 12-02's `b651366`, which declared `knex` for the backend test that imports it. That is the one approved dependency change; nothing else changed.
- `git status --short` after the gate: clean.

## Pending for the operator (manual, per 12-VALIDATION)

1. Development database, after the next `strapi develop` with the host's flags (Keycloak flags false): `PRAGMA table_info(csrm_risks)` lists `ai_provenance`; the `csrm_ai_runs` table exists; the service agent is refused a request read.
2. The live UAT-A, UAT-B and UAT-C re-run on the approved OpenAI-compatible provider configured in `apps/backend/.env` (D-38's live-model check), on seeded, fictitious data only.
3. The production schema acceptance check for the three changed content types.
4. The premium-bar browser checks and UI-SPEC backstops at 375 and 1440 (the pilot's walkthrough).

## Decisions

- The journey edits each risk's release fields as Accept, then confirms the remaining proposals; when the last accepted change returns the release-ready assessment to draft (D-13), one saved Recommendations edit returns it to review, as the release journey does through its API helper.
- The planned-control add and Undo run on the Internet Exposure risk (proposed as Treat, so it carries suggestions; the Accept proposal carries none under G-14).

## Deviations

- The journey's first axe scan of the run sheet found a serious `scrollable-region-focusable` violation: the sheet's scrolling body had no focusable content. Fixed in `2a22ad7` (a labelled, focusable region) before the journey was committed.
- `playwright.config.ts` is outside the plan's file list (the mobile project's spec whitelist).

## Self-Check: PASSED

## Phase gate (final run, after the code review)

Run by the stage B worker from 2026-10-08 23:34 to 2026-10-09 00:12 (+11:00) at `1ef0ed7`, after the code review (`12-REVIEW.md`, 69 findings, all fixed test-first: `12-REVIEW-DISPOSITION.md`), the regression gate, `verify:post` (`12-SECURITY.md` SECURED 57/57; `12-VALIDATION.md` validated and Nyquist-compliant; `12-UI-REVIEW.md` 19/24 with `12-UI-REVIEW-DISPOSITION.md`) and the verification (`12-VERIFICATION.md`: 5/5 success criteria, 0 gaps; human_needed for the operator's checks). From the repository root with Node v24.19.0 and pnpm 11.24.0, ports 1337 and 3000 free, no dev server running.

| Gate | Result | Duration |
|---|---|---|
| `api:check` (then `git update-index --refresh`) | clean | 2 s |
| Typecheck | clean | 5 s |
| Lint | clean | 3 s |
| Web (Vitest) | 3,677 / 3,677 (165 files) | 51 s |
| Strapi (node:test) | 822 / 822 (ℹ tests 822, ℹ pass 822, ℹ fail 0) | 16.2 min |
| Playwright (production build, both projects) | desktop 135 / 135; mobile 23 passed, 1 failed, 2 did not run; 0 flaky | 19.8 min |
| Playwright, `risk-register-workflow.spec.ts` alone (both projects) | 10 / 10 (desktop 7, mobile 3) | 2.3 min |

- The one full-run failure is the known mobile pixel check in `risk-register-workflow.spec.ts` (the pinned header's end hairline at 768 px read the row colour at `scrollLeft 40`); its two dependent mobile tests did not run. It fails only under the full suite's load, as at 12-19 and in both stage B full runs, and passed with the spec alone, so mobile is 26 / 26 on the final code. It stays deferred to Phase 18 (`deferred-items.md`).
- `performance.spec.ts` passed every route budget, including `/app/review/assessments/{documentId}` (its 460,000-byte override, recorded in `docs/performance/phase-08-baseline.md`) and `/app/risks/{documentId}` (watch note: 406 bytes of headroom at 299,594 after `c586c45`).
- Static checks against `PHASE_12_BASE` (`7e4fa02`):
  - content-type schema files: exactly the three approved (`csrm-ai-run`, `csrm-assessment`, `csrm-risk`); stage B approved no other;
  - the two catalogue copies are byte-identical (`cmp`);
  - no Keycloak or auth path changed; the only Keycloak or development-identity flag names in the diff are the Strapi test harness's pin-and-restore lists and the boot test's fake environment;
  - manifests: only the approved `knex` 3.0.1 declaration (`apps/backend/package.json` +1, `pnpm-lock.yaml` +3 importer lines); no new package;
  - `CSRM_AI_` settings: all 15 variables Strapi reads are named in `apps/backend/.env.example`; the web reads none;
- `git status --short` after the gate and the re-run: clean.

## Phase gate addendum (2026-10-09)

The pilot ruled that the flaky mobile pixel check is fixed now, not in Phase 18. It is fixed in `ab23681`, without a retry, and `deferred-items.md` closes the item. The flaky-check worker ran these on 2026-10-09 at `ab23681`, from the repository root with Node v24.19.0 and pnpm 11.24.0, ports 1337 and 3000 free and no dev server running.

| Gate | Result | Duration |
|---|---|---|
| Playwright (production build, both projects) | 161 passed: desktop 135 / 135, mobile 26 / 26; 0 failed, 0 flaky, 0 skipped | 18.6 min |
| Playwright, `risk-register-workflow.spec.ts` alone on the mobile project, `--repeat-each=5` | 15 / 15 (the journey 5 / 5) | 3.9 min |
| Web (Vitest) | 3,682 / 3,682 (166 files). The 5 added tests are the 3 new `settle-scroll` tests and the 2 output-safety cases generated for the new file | 49 s |
| Typecheck, lint | clean | |

- **Cause.** Load did not cause it; the data did. The full run's mobile pass lists 22 Risks (8 when the file runs alone), so at 768 px the register is taller than the window. Tab's focus scroll does not stop at the root's scroll padding as `scrollIntoView` does, so it left the register's header row under the sticky application header. The sampled point showed that header's translucent background, rgb(244, 244, 241) and rgb(246, 246, 243), in all four full runs (`scrollLeft` 7, 39, 40, 40). A diagnostic at 768x450 with 8 Risks reproduced the same two colours, and `elementFromPoint` named `header.header`. Separately, ArrowRight scrolls the region smoothly (40 px over about nine frames), so the poll had sampled it mid-animation (37 or 38).
- **Fix.** The check waits until the region's and the page's scroll positions hold for three frames (`settleScrollPosition`). When a pinned cell is out of view or under the application header, it scrolls only the page to the region's top. It then asserts that the cell is what the browser shows at every sampled point. The colour assertion is unchanged. In this full run the mobile pass took that path after ArrowRight at 768 and at 1024 px (test annotations); the desktop pass did not need it.
- **The check can still fail.** With `border-r border-border` removed from the pinned header cell, the spec failed on the mobile project: "the Risk Register at rest at 768px: the pinned header cell's end edge is painted rgb(216, 213, 205) at scrollLeft 0; found rgb(255, 255, 255), rgb(255, 255, 255)". `data-table.tsx` was then restored byte for byte (`cmp`; SHA-256 unchanged; no diff).
- **The reveal path works when the spec runs alone.** A local edit, never committed and restored byte for byte, ran the 768 pass at 768x450. The spec passed 3 / 3 on mobile, with the check bringing the pinned cells into view at rest and after ArrowRight.
- **New deferred item, routed to Phase 18.** Tab's focus scroll into a table region taller than the window leaves its column-header row under the application header (`deferred-items.md`). WCAG 2.4.11 (AA) holds, and a product fix would change every DataTable region.
- `git status --short` after the runs: clean apart from the other worker's Phase 13 planning files.
