---
phase: 15-steerable-questionnaire-ai
plan: 14
subsystem: e2e, gate
tags: [playwright, journey, axe, negative-cases, glossary, coverage, phase-gate, checkpoint]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: plans 15-01 to 15-13
provides:
  - apps/csrm/e2e/questionnaire-ai-proposals.spec.ts (four tests, both projects, all @journey)
  - apps/csrm/playwright.config.ts mobile testMatch entry
  - CONTEXT.md `AI proposal` sentence for questionnaire proposals
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/COVERAGE.md
affects: [16, 17]
actuals:
  tasks: 4
  commits: 8
plan_head_before: 29ba348
requirements-completed: [QUES-11, QUES-12]
status: complete
closes: [UAT-017, UAT-018]
---

# Phase 15 Plan 14: The Journey and the Phase Gate Summary

**Steerable questionnaire AI is proven end to end in the browser at 1440 and 375 on its own records, with axe at every surface: follow-up questions from a marked note on the submitted questionnaire, the answered questions untouched and the dropped attempts listed as left out, the return to analyst review, confirm, edit then confirm, reject with a reason and Undo, a plain-language rewrite, the release refused then allowed, the timeline, and Jane's unchanged answers with no AI wording. The Secondary Requestor, the Requestor and a requesting analyst each see no AI steering. The full Phase 15 gate is green on the production build. Task 4 (the orchestrator's browser walk) is the open checkpoint.**

## Tasks 1 and 2: the journey and the refusals

`apps/csrm/e2e/questionnaire-ai-proposals.spec.ts` runs in order (serial): the journey's questionnaire is shared with the two Requestor checks that follow it. The mobile project collects it through its `testMatch` entry (with the Phase 15 comment); `playwright test --list --project=mobile e2e/questionnaire-ai-proposals.spec.ts` lists all four tests before any browser run (E-1).

| Test (@journey, both projects) | Proves |
|---|---|
| `QUES11_QUES12_JOURNEY` | Jane submits, answers every required question and adds the offshore note; Bob marks it; on the submitted questionnaire the signal and the panel both offer `Suggest follow-up questions`; the group `Bob Doe asked the AI for follow-up questions` holds exactly the three Offshore support questions, no Confirm while submitted, and `2 left out` lists the answered-question and near-duplicate lines (criterion 1, QUES-12). Return to analyst review with a reason; Confirm (`Will the offshore support team have administrator access to your systems?`), Edit, then confirm (`Where is the offshore support team based?`), Reject with `Covered by the vendor questions` and Undo from the toast; the release line `Decide the 1 open AI proposal before you release this questionnaire.` with no Release; a manual MFA question rewritten in plain language and the rewrite confirmed; the remaining proposal rejected, the decided list open; Release (criteria 2 and 4, QUES-11). The timeline: `Proposals requested from the AI` with `none - the AI suggested the questions it judged still needed`, `deterministic-questionnaire-proposals · Model: 1`, `by Bob Doe` and the time; `Plain-language rewrite requested from the AI`; `AI proposal, confirmed` and `AI proposal, edited before confirming` (criterion 3). Jane then sees the three new questions (edited, confirmed, rewritten), not the rejected one, her three earlier text answers unchanged, and no AI wording (criterion 4). Axe: the panel on the submitted questionnaire, Edit then confirm open, the reject row open, the rewrite popover (1440) or sheet (375), the decided group open, the timeline, Jane's questionnaire; no horizontal overflow. |
| `QUES12_SECONDARY_REQUESTOR_REFUSED` | The Secondary Requestor gets the permission state on the questionnaire's Requestor and analyst routes and on the hub, with none of its questions and no AI text; axe on the refused hub. |
| `QUES12_REQUESTOR_SEES_NO_AI` | Jane's questionnaire, its history and her request show no panel, instruction, Answered note, AI control or AI event; axe on her request. |
| `QUES11_REQUESTING_ANALYST` | Bob raises and submits his own request: the hub's Generate shows §12's caption and no instruction field (axe on the hub card); the second analyst generates; Bob's questionnaire shows `You raised this request, so another Security Analyst handles the AI for it.`, no rewrite, no start and no instruction field; the hub shows no proposals line, start or field. |

Run on both projects: **8/8** (2.9 min), the tree clean afterwards.

## Task 3: glossary, coverage and the gate

- **Glossary (D-34):** 12-19's `AI proposal` entry did not cover questionnaire proposals; one sentence added ("On a questionnaire, an AI proposal can add, change or remove a question, and a Security Analyst confirms, edits then confirms, or rejects each one."), nothing else changed.
- **Coverage:** `COVERAGE.md` re-decides Phase 12's seven capability rows for `questionnaire_proposals` and `question_rewrite`: three INTEGRATE, four OPT-OUT, each with a reason.

## Phase gate

Production build, dev servers stopped (no listener on 1337 or 3000), throwaway Strapi secrets exported for each Playwright run only (this host has no `apps/backend/.env`), Node 24.19 from the session shim.

| Gate | Command | Result | Duration | POST-DEMO-BRIEF baseline (2026-10-01) |
|---|---|---|---|---|
| `api:check` | `pnpm --dir apps/csrm api:check` (then `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts`) | clean | 3 s | clean |
| Typecheck | `pnpm --dir apps/csrm typecheck` | clean | 8 s | clean |
| Lint | `pnpm --dir apps/csrm lint` | clean | 4 s | clean |
| Web unit | `pnpm --dir apps/csrm test` | **5,381 / 5,381** (222 files) | 157 s | 2,046 / 2,048 |
| Strapi | `pnpm --dir apps/backend test` | **1,624 / 1,624**, 0 fail, 0 skipped | 28 min 57 s | 578 / 578 (10 min 45 s) |
| Playwright | `pnpm --dir apps/csrm test:e2e` (both projects) | **236 / 236** (desktop 174, mobile 62) | 41.7 min | 84 / 84 (11.1 min) |
| Tree | `git status --short` | empty | — | — |

**How it got there (the flaky count).** First full Playwright run: 232/236. Two failures were caused by Phase 15 and fixed: the submitted view offered `Rewrite in plain language` on answered rows, which `questionnaire-workflow.spec.ts` caught through the button's new accessible name (`3b1aaed`); and Phase 13's `request-notes.spec.ts` asserted that the provenance header's only button is the sheet trigger, which 15-12's deliberate signal action changed (`e9d6690`, assertion updated). Two were intermittent and not from Phase 15 code: `COLLAB02_OTHER_REQUESTOR_NOT_FOUND` (a Chromium `Network.getResponseBody` "no data" error reading the replayed action's response; it had also failed once in 15-13's run) and `REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT` at 375 (axe's `document-title` on a client-navigated page before its streamed title). Second full run: 234/236, the same two intermittent failures; both specs fixed (`25cf712`: the action's answer read through the route; the axe helper waits for the page title), the replay test then passed 6/6 with `--repeat-each=3`. Third full run: **236/236**. Flaky total across the three runs: 4 failures in 2 tests, both now fixed; no test re-run to pass.

The Strapi run was on `e1b0d01`; nothing under `apps/backend` changed after it. The web suite, typecheck, lint and `api:check` were re-run after the last code fix.

**Static checks against `PHASE_15_BASE=15eb830b`:**

| Check | Result |
|---|---|
| Content-type freeze: `git diff --name-only 15eb830b -- 'apps/backend/src/api/*/content-types/*'` | empty |
| Catalogue copies: `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | identical |
| Dependencies: `git diff 15eb830b -- apps/backend/package.json apps/csrm/package.json pnpm-lock.yaml` | empty |
| Approvals: each record's `## Phase 15 amendment` section to the end of the file, case- and bold-insensitive | `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`: "approved by the pilot on 2026-10-11", no awaiting status line; `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`: "approved by the pilot on 2026-10-11", no awaiting status line |
| No changed path contains `keycloak` | **Not empty, and not from Phase 15.** Seven paths differ from `15eb830b`, every one from the operator's commit `d32bb25` (vanbui, 2026-10-12 09:21 +1100, `chore(quick-261012-cye): move local services to docker and add ClamAV`), merged before this session's HEAD `84f0e66`: `apps/backend/src/keycloak/development-fixture-subjects.ts`, `apps/backend/tests/keycloak-identity.unit.test.ts`, `docker/keycloak/import/idambox-realm.json` (moved from `idp/`), `docs/adr/0003-production-only-keycloak-oidc-sign-in.md`, `docs/adr/0004-strapi-verifies-keycloak-access-tokens.md`, `scripts/verify-keycloak-idp.mjs`, `scripts/verify-keycloak-provisioning.mjs`. No Phase 15 commit touches a Keycloak path, flag, source, config or realm, and none was touched in this session. The pilot decides whether the check's base should exclude operator commits. |

**The two unwired verify scripts:** `scripts/verify-csrm-model.mjs` and `scripts/verify-keycloak-provisioning.mjs` are unwired (no package script runs them) and stale against deliberate changes (15-08's handoff); their disposition is **accepted by the pilot (2026-10-12)**, and neither script was changed.

**IN-306:** the host failure carried since 15-07 is gone: the quick task 261012-isn (`f00725f`) added the parent-side heap watchdog, and the full Strapi suite now passes it.

## Coverage map

| Item | Plans | Proof |
|---|---|---|
| QUES-11 (instruct the AI to add, change or remove questions; accept or reject each) | 15-02, 15-05 to 15-07, 15-09 to 15-12 | Strapi: proposal, decision and job suites (15-06, 15-07, 15-09 matrix rows); web: panel, cards, decisions (15-11), rewrite (15-12); browser: `QUES11_QUES12_JOURNEY` |
| QUES-12 (follow-ups that keep every answered question and answer) | 15-02, 15-05, 15-07, 15-08 | Adapter drop rules (`answered-target`, `answers-affected`) and the release re-check; browser: the journey's `2 left out` and Jane's unchanged answers |
| Success criterion 1 (follow-ups on the marked note's topic, answered untouched) | 15-04, 15-05, 15-06, 15-11 | Journey step "criterion 1" |
| Success criterion 2 (rewrite in plain language, accept or reject) | 15-05, 15-06, 15-12 | Journey rewrite step; `question-rewrite-control.test.tsx` |
| Success criterion 3 (instruction, time and analyst in the timeline) | 15-03, 15-04, 15-12 | Journey timeline step; timeline unit tests |
| Success criterion 4 (nothing reaches the Requestor until release) | 15-07, 15-08, 15-12 | Journey release gate and Jane's view; `QUES12_REQUESTOR_SEES_NO_AI` |
| UAT-017 (Generate and Replace take no input) | 15-08, 15-13 | E2 (`questionnaire-generation-workflow.spec.ts`); hub card tests |
| UAT-018 (rewrite and provenance) | 15-12 | Rewrite control and sheet tests; the journey |
| D-01 no content-type change | 15-01, 15-14 | Freeze check above |
| D-02 contract chain | 15-08, 15-09 | `api:check`, parity and served-operations guards |
| D-03 the API changes | 15-08, 15-09 | Contract tests; the six served operations |
| D-04 proposals, not replacements | 15-02, 15-05, 15-07 | Proposal core and decision suites |
| D-05 answered questions fixed | 15-02, 15-05, 15-07, 15-12, 15-14 | Drop rules; Answered note; `3b1aaed`; the journey |
| D-06 when proposals can be requested and decided | 15-06, 15-07, 15-11 | Workflow suites; panel guidance; the journey (no Confirm while submitted) |
| D-07 confirmation only in analyst review | 15-07, 15-11 | Decision refusals; the journey |
| D-08 open proposals decided before moving on | 15-08, 15-12, 15-13 | `AI_PROPOSALS_OPEN` refusals; release and draft gate lines; the journey |
| D-09 narrowed Replace | 15-08, 15-13 | Replacement refusals; `replaceOffer` tests; E2 |
| D-10 questionnaire-wide proposals | 15-05, 15-06, 15-11 | Provider, job and panel tests; the journey |
| D-11 rewrite in plain language | 15-05, 15-06, 15-12 | R1 glossary tests; rewrite control; the journey |
| D-12 instruction on generation and replacement | 15-08, 15-13 | Generation body tests; hub card tests; E2 |
| D-13 what an item holds | 15-02, 15-04, 15-11 | Envelope parsers; card tests |
| D-14 the context | 15-04, 15-05 | Context builder tests |
| D-15 wire shape, adapter, providers | 15-05 | Adapter tests through the fake OpenAI-compatible server; `COVERAGE.md`; production schema check pending (manual) |
| D-16 jobs | 15-06, 15-11 to 15-13 | Job suites; panel, row and hub job tests |
| D-17 the instruction slot | 15-02, 15-10 | Validator and schema tests |
| D-18 one shared validator | 15-02 | Validator module tests |
| D-19 logged and shown | 15-03, 15-04, 15-12 | Governance log and run record tests; sheet and timeline |
| D-20 one generic item core | 15-02 | Core tests |
| D-21 the decision operation | 15-07, 15-10, 15-11 | Decision suites; batch action; optimistic decisions |
| D-22 one transaction per confirmation | 15-07 | Transaction tests |
| D-23 Undo | 15-07, 15-11 | Undo suites; the journey's toast Undo |
| D-24 coexistence, supersession, lapse | 15-02, 15-07 | Fold and supersession tests |
| D-25 concurrency with the Requestor | 15-07, 15-13 | Release re-check; kept and restored answers |
| D-26 governance log amendment | 15-01, 15-03 | The approved 06.8 amendment; log tests |
| D-27 question origin | 15-08, 15-12 | Origin reads; origin markers |
| D-28 where provenance shows | 15-12 | Header, sheet and timeline tests |
| D-29 the Phase 13 seam | 15-04, 15-10, 15-12, 15-13 | Marked notes in context; `CONTEXT_TOO_LARGE` rule; signal action; hub |
| D-30 data policy and answer privacy | 15-04, 15-06 | Policy refusals; answer withholding; deterministic providers in every suite |
| D-31 grants | 15-09 | Matrix rows; `QUES12_SECONDARY_REQUESTOR_REFUSED`; development database after restart pending (Task 4 step 1) |
| D-32 requesting analyst | 15-06, 15-09, 15-11, 15-13, 15-14 | `OWN_REQUEST` refusals; panel line; `0fbb64f`; `QUES11_REQUESTING_ANALYST` |
| D-33 surfaces | 15-11 to 15-13 | Panel, rows and hub |
| D-34 copy and extensions | 15-01, 15-10, 15-14 | X-24 to X-26; copy guard; glossary sentence |
| D-35 the G-4 bar and the route | 15-10 to 15-13, Task 4 | Route budgets in each summary; axe in the journey; the orchestrator's walk |
| D-36 how the phase is proved | every plan | RED then GREEN commits; this journey |
| D-37 plan shape | 15-01 to 15-14 | Fourteen plans, run one at a time |

## Deviations and decisions

- **Three product fixes found by the browser:** a requesting analyst saw the instruction field on Generate before a questionnaire existed (the state came only from the proposals read; now also from the request read's assignment view, `0fbb64f`); Chromium named the card and rewrite controls `Reject : {subject}` from a visually hidden span (`aria-label` now gives `Reject: {subject}`, `369624a`); the submitted view offered a rewrite on answered rows (`3b1aaed`).
- **Two earlier-phase specs changed** (recorded above): Phase 13's header assertion, deliberately (`e9d6690`), and two intermittent harness reads (`25cf712`: the replay test and the shared axe helper).
- **The journey edits the country question** to `Where is the offshore support team based?` and confirms the administrator-access question unchanged (the plan's order named the first and second items the other way round; the edit fits the country question).
- **The journey runs as one serial file**: the Secondary Requestor and Requestor checks read the journey's questionnaire; the requesting-analyst test makes its own request.
- **The Keycloak static check is reported as failing on operator commit `d32bb25`**, not waived; no Keycloak file was touched.

## Route budgets (desktop, third full run, 2026-10-12 19:33 UTC)

| Route | Actor | Delivered JS bytes | 15-13's figure | Budget |
|---|---|---|---|---|
| `/app/requests/{documentId}` | Requestor | 298,054 | 298,054 | 300,000 |
| `/app/questionnaires/{documentId}` | Requestor | 361,791 | 361,767 | 500,000 (override) |
| `/app/risks/{documentId}` | Security Analyst | 293,873 | 293,871 | 300,000 |
| `/app/review/assessments/{documentId}` | Security Analyst | 319,942 | — | 460,000 |

## Pending manual items (15-VALIDATION "Manual-Only Verifications")

1. The operator's live-model check (UAT-A with the offshore note, UAT-017's two instructions, a plain-language rewrite) with the provider they approve, on a fresh copy of the development database.
2. The production schema acceptance check at deployment: one questionnaire-wide proposal and one rewrite against the configured endpoint, no `provider_rejected_request`.
3. The grants reaching the development database after the orchestrator's restart (Task 4 step 1).
4. The premium bar at a glance (Task 4).

## Task 4: the orchestrator's browser walk (open checkpoint)

Not yet done; recorded here verbatim when the orchestrator answers.

---
*Phase: 15-steerable-questionnaire-ai*

## Pilot walk, 2026-10-12

Task 4 resume signal: **issues found**. The pilot’s answer is recorded in `15-PILOT-RULINGS.md`, verbatim in its browser check table. D1–D9 and the NVDA implementation risks are undergoing test-first closure in `15-REVIEW-DISPOSITION.md`. The final gate ran after these fixes on 2026-10-15 and is green: see "Phase gate (final run, after the code review and walk fixes)" below.

The new browser recovery test reproduced D6 at 375: after take-back the owning Requestor received the generic refusal instead of the pinned recovery copy (`/private/tmp/csrm15-recovery-red3.log`). The 1440 run was interrupted by Strapi’s recompilation during source edits; it is not a behavioral test result. `93d69147` adds the two-context restoration and hub/focus/target regressions; their final results remain pending. (Later: the operator UAT closed 5/5 in `15-UAT.md`, and `QUES12_TAKE_BACK_RECOVERY` and `QUES12_SUBMITTED_HUB_JOB` passed at 1440 and 375 in the final gate below.)

## Phase gate (final run, after the code review and walk fixes)

Run by the closing worker on 2026-10-15 from 00:54 to 02:40 UTC. These steps came first:
- **The code review.** `15-REVIEW.md` had 31 findings; `15-REVIEW-DISPOSITION.md` dispositions all of them (31 total, 0 open), together with the pilot's walk items D1 to D9 and the two NVDA markup fixes (`15-PILOT-RULINGS.md`). The closure fixes ended at `36315786`.
- **`verify:post`.** `15-SECURITY.md` verified with 0 open threats; `15-VALIDATION.md` Nyquist-compliant; `15-UI-REVIEW.md` 22/24 with no blockers.
- **The verification and the UAT.** `15-VERIFICATION.md` read `human_needed` (4/4 truths, 0 gaps) on 2026-10-13. `15-UAT.md` is complete, 5/5 passed with 0 issues (`697c962e`, `a30203e6`): the walk regressions, NVDA speech (the operator), the live-provider quality check, production schema acceptance and the visual review at 375 and 1440.

The gate ran from the repository root with Node v24.19.0 and pnpm 11.24.0 from the session shim, both Keycloak flags off, no `.env` read. The tree was clean before the run apart from the uncommitted `.verification-ledger.json` the worker found, which it left alone; ports 1337 and 3000 were free and no dev server ran. The suites ran one at a time.

| Gate | Command | Result | Duration | HEAD |
|---|---|---|---|---|
| `api:check` | `pnpm --dir apps/csrm api:check`, then `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | clean; nothing left modified | 3 s | `90a91942` |
| Typecheck | `pnpm --dir apps/csrm typecheck` | clean (again clean at `e224a148`) | 21 s | `90a91942` |
| Lint | `pnpm --dir apps/csrm lint` | clean (again clean at `e224a148`) | 7 s | `90a91942` |
| Web (Vitest) | `pnpm --dir apps/csrm test` | **Test Files 222 passed (222), Tests 5,409 passed (5,409)** | 89 s (Vitest 86.5 s) | `90a91942` |
| Strapi (node:test) | `pnpm --dir apps/backend test` | **ℹ tests 1,638, ℹ pass 1,637, ℹ fail 0, ℹ skipped 1**, cancelled 0. The skipped test is the POSIX file-mode check (IN-209), which cannot run on Windows | 30.1 min (duration_ms 1,786,702) | `90a91942` |
| Playwright, first run (production build, both projects) | `pnpm --dir apps/csrm test:e2e` | 239 passed, **1 failed**: desktop 175/176, mobile 64/64 (240 tests, 1 worker, no retries) | 32.8 min | `90a91942` |
| Playwright, final run | `pnpm --dir apps/csrm test:e2e` | **240 passed**: desktop **176**, mobile **64**. 0 failed, 0 flaky, 0 skipped (no retries) | 32.4 min | `e224a148` |
| Tree | `git status --short` | only the pre-existing `.verification-ledger.json`; the run modified no tracked file | | `e224a148` |

**The one failure, fixed test-only (`e224a148`).** `COLLAB02_UAT012_SCENARIO` (Phase 14, `request-attachments.spec.ts`) failed at 1440 on step 5: the data-flow document's `Changes the AI inputs` switch was not found. With four files and a note link in the Added column, Bob's Files table did not fit the list, so the cards showed, as the pilot's D2 rule says they should from 768px wherever the table does not fit. The spec's `aiControlFor` already follows the layout shown (`tableShown`), but the step-5 assertion branched on the viewport width. It now waits for the row's switch or the card's AI line and checks the layout shown. No product code changed. The attachments spec then passed 26/26 on both projects (4.8 min), and the full final run above is green. Between the two runs the only other change on the branch is `6698b98c` (Phase 16 planning documents), so the web, Strapi and static results at `90a91942` stand for `e224a148`.

Phase 15's journeys in the final run, each on desktop (1440) and mobile (375): `QUES11_QUES12_JOURNEY`, `QUES12_SECONDARY_REQUESTOR_REFUSED`, `QUES12_REQUESTOR_SEES_NO_AI`, `QUES11_REQUESTING_ANALYST`, `QUES12_TAKE_BACK_RECOVERY` and `QUES12_SUBMITTED_HUB_JOB`: 12 passed. `questionnaire-governance-workflow.spec.ts` (desktop) passed.

**Performance budgets.** `performance.spec.ts` passed 11/11 on desktop in the final run. Figures from that run's `apps/csrm/.tmp/performance/baseline-desktop.json` (measured 02:30:30 to 02:31:15 UTC). Every route is within budget; `git diff 15eb830b..HEAD -- apps/csrm/e2e/performance.spec.ts` is empty, so Phase 15 added no override.

| Route | Actor | Delivered JS bytes | Budget | Left |
|---|---|---|---|---|
| `/app` | Requestor | 229,760 | 300,000 | 70,240 |
| `/app/requests` | Requestor | 252,080 | 300,000 | 47,920 |
| `/app/requests/{documentId}` | Requestor | **298,027** | 300,000 | 1,973 |
| `/app/questionnaires/{documentId}` | Requestor | 361,868 | 500,000 (override) | 138,132 |
| `/app` | Security Analyst | 229,760 | 300,000 | 70,240 |
| `/app/review/assessments/{documentId}` | Security Analyst | 319,925 | 460,000 (override) | 140,075 |
| `/app/risks` | Security Analyst | 263,302 | 300,000 | 36,698 |
| `/app/risks/{documentId}` | Security Analyst | 293,849 | 300,000 | 6,151 |
| `/app/reports/risk-exposure` | Security Analyst | 255,902 | 300,000 | 44,098 |
| `/app/admin/controls` | Security Analyst | 250,494 | 300,000 | 49,506 |

`/app/requests/{documentId}` is the closest to its budget, with 1,973 bytes of headroom, for Phase 16 to watch. Every time to first byte was under 15 ms (budget 500) and every largest contentful paint 424 ms or less (budget 2,500).

**Server log noise, not a failure.** The harness's Next server logged `Error: The destination stream closed early.` 526 times in the final run (542 in the first), a streamed response whose client navigated away, as in Phase 14. The other server errors were the deliberate ones from `production-hardening.spec.ts` and the body-limit journey: 3 `Invalid Server Actions request` and 2 `The Server Reference ID did not match the expected format`.

**Observation for the pilot.** At 1440 the analyst request page's Files table is at the edge of fitting: with two files it needs 983 to 989 px of the list's 1,052 px, and with four files and a note link it did not fit in the first run, so the cards showed. That is the D2 behaviour, not a defect; it is recorded in case the pilot wants the table to hold at 1440.
