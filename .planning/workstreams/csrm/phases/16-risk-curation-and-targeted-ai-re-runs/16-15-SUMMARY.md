---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 15
subsystem: web-risk-register-and-phase-16-proof
tags: [risk-register, withdrawn-filter, read-only-detail, playwright, journey, axe, focus, scroll, route-budget, phase-gate, coverage]
status: complete
requirements: [ASSESS-09, ASSESS-10]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-07's contract and register filter value; 16-11 to 16-14's typed layer, curation components, AI proposals and rewrite UI and the editor"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "12-19's UAT-A-like journey setup and completeRiskForRelease"
provides:
  - "Risk Register: Risk state 'Open and closed' default with Withdrawn, the chip, the notice, row and card badges; read-only withdrawn detail with Open {assessment number} and Show history"
  - "apps/csrm/e2e/risk-curation.spec.ts: the Phase 16 journey, PH16_NEG_UNRELATED_REQUESTOR, PH16_NEG_REQUESTING_ANALYST and PH16_UNDO_KEEPS_PLACE at 1440 and 375 with axe"
  - "COVERAGE.md: the API coverage decision for the OpenAI-compatible provider calls"
  - "the Phase 16 gate record (below)"
affects: [16 post-execution gates]

actuals:
  tokens: 22300  # chars/4 over the added lines of 5ddde0f6..5a141663 (89,333 characters)
  tasks: 3
  commits: 22

plan_head_before: 5ddde0f6ccc4a19ae451f417da8f0f8613317865
plan_head_after: 5a141663747d8c8c6dda507ba1d255a847f4361d

tech-stack:
  added: []
  patterns:
    - "A page-address change that the server reads goes through router.replace(url, { scroll: false }), never the native history.replaceState: the native call leaves Next's tree keyed to the loaded search, and the next server action's revalidation then scrolls to the top"
    - "A list that keeps two layouts in the page and lets CSS choose keeps focus on the same control when the choice flips"
    - "A Playwright check on a phone menu item waits until the item is in the viewport before choosing it"

key-files:
  created:
    - apps/csrm/e2e/risk-curation.spec.ts
    - apps/csrm/src/features/risks/risk-details-states.tsx
    - .planning/workstreams/csrm/phases/16-risk-curation-and-targeted-ai-re-runs/COVERAGE.md
  modified:
    - apps/csrm/playwright.config.ts
    - apps/csrm/e2e/risk-register-workflow.spec.ts
    - apps/csrm/src/features/risks/risk-register-filters.tsx
    - apps/csrm/src/features/risks/risk-register.tsx
    - apps/csrm/src/features/risks/risk-details.tsx
    - apps/csrm/src/features/risks/risk-domain.ts
    - "apps/csrm/app/(app)/app/risks/[documentId]/page.tsx, error.tsx, loading.tsx, not-found.tsx"
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/src/features/risk-curation/risk-card-actions.tsx
    - apps/csrm/src/features/risk-curation/risk-rewrite.tsx
    - apps/csrm/src/features/risk-curation/rewrite-form.tsx
    - apps/csrm/src/features/risk-curation/use-risk-proposal-decisions.ts
    - apps/csrm/src/features/risk-curation/use-risk-withdrawal.ts
    - apps/csrm/src/features/attachments/files-list.tsx

key-decisions:
  - "The Show filter changes the address through router.replace with no scroll (pilot ruling, 2026-10-16): one page read per Show change, no remount, focus stays on the option"
  - "The Risk detail header's Show history loads after the page (ssr: false), disabled with its name until it arrives (pilot accepted, 2026-10-16), to keep /app/risks/{documentId} within 300,000 bytes"
  - "The phone actions menu is non-modal: a modal Radix menu aria-hid the page while its controls stayed focusable (axe aria-hidden-focus)"
  - "Undo lands on the returned Risk card from its start (landOn), so its number and actions show at 375"

patterns-established:
  - "PH16_UNDO_KEEPS_PLACE: an editor probe attribute and a recorded scroll trail prove a refreshed page neither remounts nor moves"

duration: 680min
completed: 2026-10-16
---

# Phase 16 Plan 15: Risk Register Withdrawn View, the Phase 16 Journey and the Phase Gate Summary

**The Risk Register lists withdrawn risks only on request and shows them read-only. One Playwright spec proves Phase 16's four success criteria and its negative cases at 1440 and 375 with axe. The full phase gate is green at `5a141663`.**

## Performance

- **Started:** 2026-10-16T04:51:51+11:00 (`7120685c`)
- **Completed:** 2026-10-16T16:12+11:00
- **Tasks:** 3 of 3
- **Files:** 30 changed (1,244 insertions, 72 deletions)

## Accomplishments

- **Task 1 (`7120685c` RED, `e9c14737` GREEN).** The Register's `Risk state` reads `Open and closed` by default and offers `Withdrawn`, with the chip, the notice, and the badge on rows and phone cards. A withdrawn risk's detail is read-only: the badge, the `Withdrawn risk - read only` alert naming who, when and why, `Open {assessment number}` to the assessment's Withdrawn view, and `Show history`. It offers no edit or mitigation-control action.
- **Task 2 (`5cdbc7af`).** `risk-curation.spec.ts` covers every journey label (`PH16_SC1_WITHDRAW_LEAVES_READINESS`, `PH16_SC1_HISTORY`, `PH16_UNDO_AND_REINSTATE`, `PH16_SC2_SUGGEST_PAYMENT_FILE`, `PH16_SC3_REWRITE_DIFF`, `PH16_READINESS_WAITS_FOR_DECISIONS`, `PH16_SC4_RELEASED_NO_CONTROLS`, `PH16_REQUESTOR_EXCLUDES_WITHDRAWN`, `PH16_REGISTER_WITHDRAWN_FILTER`) and both negative tests. Every test carries `@journey`, and the mobile project's `testMatch` lists the spec. `PH16_UNDO_KEEPS_PLACE` (`8b69699b`) was added under the pilot's ruling.
- **Task 3.** `COVERAGE.md` (`6c7ba95e`), the full gate and the static checks (below).
- **E4.** `risk-register-workflow.spec.ts` never asserted `All`, so no E4 change was needed. It changed for another reason; see Deviations 5.

## Gate record

All runs were on this host, Node 24.19.0, with dev servers stopped, in the plan's order. `retries` is 0, so a flaky test shows as a failure.

| Run | HEAD | api:check | typecheck | lint | Web | Strapi | Playwright | Result |
|---|---|---|---|---|---|---|---|---|
| 1 | `5cdbc7af` | clean | clean | clean | 5,789 passed, 1 failed (234 files), 87 s | not run | not run | failed (Deviations 6) |
| 2 | `90326dca` | clean | clean | clean | 5,790/5,790, 83 s | 2,004 passed, 0 failed, 1 skipped (2,005), 36.5 min | 239 passed, 2 failed, 5 did not run (246), 33.1 min | failed (Deviations 5, 7) |
| 3 | `ba289590` | clean | clean | clean | 5,797/5,797, 66 s | 2,004 passed, 0 failed, 1 skipped (2,005), 32.3 min | 243 passed, 2 failed, 1 did not run (246), 47.9 min | failed (Deviations 8, 9) |
| **4** | **`5a141663`** | **clean** | **clean** | **clean** | **5,801/5,801 (234 files), 60 s** | **2,004 passed, 0 failed, 1 skipped (2,005), 31.4 min** | **248/248 (desktop 180, mobile 68), 0 failed, 0 flaky, 33.8 min** | **green** |

- **Against Phase 15's final gate** (web 5,409, Strapi 1,637 passed with 1 skipped, Playwright 240): web +392, Strapi +367, Playwright +8.
- **api:check** regenerated `schema.d.ts` with no contract diff each run. `git update-index --refresh` cleared its LF noise.
- **`git status --short` after run 4:** only ` M .planning/workstreams/csrm/.verification-ledger.json` (left uncommitted at the pilot's instruction).
- **Route budgets in run 4** (desktop, delivered JS bytes): `/app/requests/{documentId}` 299,581 and `/app/risks/{documentId}` 299,848 of 300,000. Every other route is within budget.

### Focused proof of the Undo fix

- **Red before the fix:** `PH16_UNDO_KEEPS_PLACE`, `--repeat-each 10` at 375, failed 10 of 10 on the unfixed code. After `ec90932e` alone it failed 3 of 10.
- **Diagnostic runs:** with a Show change, the page scrolled to `0` in 4 of 6 runs; without one, 0 of 3. The editor was never remounted.
- **After both fixes** (`1bc59af2`): `risk-curation.spec.ts`, `--repeat-each 5` at 1440 and 375, passed 40/40 (16.5 min).

## Static checks (on `5a141663`; PHASE_16_BASE=01dc4118)

```
## content-type freeze (with the three IAM exclusions)
apps/backend/src/api/csrm-risk-history-event/content-types/csrm-risk-history-event/schema.json
apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json
## catalogue copies
cmp: identical (exit 0)
## Keycloak paths under apps/ in 01dc4118..f2a39dbe and d1518c5f..HEAD
(no match)
## dependency freeze, 01dc4118..f2a39dbe and PHASE_16_IAM_SYNC=d1518c5f..HEAD
(empty)
## glossary
CONTEXT.md:65: **Withdrawn (Risk)**:
## coverage record
INTEGRATE present; "IAM-owned" pg note present
## the pilot's approval lines (T-16-01), bold markers stripped
phase-16-risk-withdrawal-and-history.md: Status: approved by the pilot on 2026-10-15 (G-6).
phase-12-ai-run-record-and-provenance.md: Phase 16 amendment status: approved by the pilot on 2026-10-15 (G-6).
phase-04-deterministic-draft-jobs.md: Phase 16 amendment status: approved by the pilot on 2026-10-15 (G-6).
phase-13-request-notes.md: Phase 16 amendment status: approved by the pilot on 2026-10-15 (G-6).
## "status: awaiting" in the four records
(none)
```

## Commits

| SHA | Subject |
|---|---|
| `7120685c` | test(16-15): expect the Risk Register's Withdrawn filter and read-only detail |
| `e9c14737` | feat(16-15): add the Withdrawn filter and read-only withdrawn detail to the Risk Register |
| `6c7ba95e` | docs(16-15): record the API coverage of the risk proposal provider calls |
| `fcc37886` | fix(16-15): give the rewrite form and the AI rewrite section Suspense boundaries of their own |
| `eb077107` | test(16-15): expect the journey's three risk curation defects fixed |
| `ce553272` | fix(16-15): open the phone actions menu without hiding the page from assistive technology |
| `b76db6ed` | fix(16-15): keep a confirmed AI rewrite change in place after the page reads it again |
| `2081b833` | fix(16-15): land Open {risk number} on a new Risk card the editor has not rendered yet |
| `8bed8cb5` | test(16-15): read the shared Risk Register on one 50-row page in the register workflow |
| `5cdbc7af` | test(16-15): prove risk curation and targeted AI re-runs end to end at both widths |
| `90326dca` | fix(16-15): grow the Risk Register card's number column from a basis |
| `85a93f03` | test(16-15): expect the Risk detail route's boundaries to import a states module |
| `5c742837` | fix(16-15): keep a second copy of RiskDetails out of the Risk detail route's first load |
| `f79547ec` | test(16-15): keep the register journey on 50-row pages through its filter and sort steps |
| `ba289590` | fix(16-15): load the Risk detail header's Show history after the page |
| `fae851b9` | test(16-15): choose a phone menu item only once the menu sits in view |
| `8b69699b` | test(16-15): expect Undo after a Show change to keep the analyst's place |
| `ec90932e` | fix(16-15): land Undo on the returned card so its number and actions show |
| `1bc59af2` | fix(16-15): change the Show address through the router so a later refresh keeps the page in place |
| `880291a5` | test(16-15): prove the waiting Show history control has its name and the loaded one's shape |
| `680fa974` | test(16-15): expect focus to follow a file's action when the refreshed Files list changes layout |
| `5a141663` | fix(16-15): keep focus on a file's action when the refreshed Files list changes layout |

## Deviations

Each was fixed test-first in the code of the plan that owns the behaviour. No assertion was weakened.

1. **Suspense boundaries (`fcc37886`; 16-13, 16-14).** Found by the spec at 1440. `RewriteFormBody` and `RiskRewriteSection` were `next/dynamic` without `loading`, so their first open suspended the editor page's boundary. A `loading` option and a guard in `zod-client-boundary.test.ts` fix it. Three older bodies with the same shape are logged in `deferred-items.md`.
2. **Phone actions menu and axe (`eb077107`, `ce553272`; 16-12).** `PH16_NEG_REQUESTING_ANALYST` at 375 found `aria-hidden-focus` with the menu open: the modal Radix menu aria-hid the page while its controls stayed focusable. The menu is now non-modal.
3. **Confirmed rewrite row folded away (`b76db6ed`; 16-13).** Strapi serves a change against the Risk as it is now. Once a change is confirmed, its current value equals the proposed one, and the row disappeared behind "Show n unchanged fields", taking its Confirmed note and Undo with it (`PH16_SC3_REWRITE_DIFF` at 375). A confirmed change's rows now count as changed (§4.4, "the row stays in place").
4. **`Open {risk number}` did nothing (`2081b833`; 16-13).** The toast can appear before the revalidated page has rendered the new card. `openRisk` set a fragment that nothing lands on. It now waits up to 10 s for the card and lands on it. The spec's step now clicks it (the plan's step names it).
5. **Register workflow page size (`8bed8cb5`, `f79547ec`; test-only).** The new spec adds about 20 Risks to the run's shared database, so the register exceeded its default 25-row page. Two checks failed: the "total equals distinct rendered Risks" proof (27 against 25), and in run 2 the descending sort, where the null-dated fixture fell to page 2. The journey now reads 50-row pages and states that the register fits one. This is not an E4 change.
6. **Register card column (`90326dca`; this plan's Task 1).** Run 1's web suite: Task 1 wrapped the card's number and badge in a span without the `grow basis-24` the DataTable card guard requires.
7. **`/app/risks/{documentId}` over budget (`85a93f03`, `5c742837`, `ba289590`, `880291a5`; this plan's Task 1).** Run 2 measured 304,999 delivered bytes against 300,000.
   - The route's error boundary imported the whole RiskDetails module, putting a second copy in the first load. The states moved to `risk-details-states.tsx`, which brought it to 301,418.
   - The header's Show history now loads after the page (ssr: false), which brought it to 299,815.
   - The pilot accepted the brief disabled state on condition it keeps an accessible name and shifts no layout. `880291a5` proves the waiting control has the loaded one's name, classes, icon and content.
8. **Page jump after Undo (`fae851b9`, `8b69699b`, `ec90932e`, `1bc59af2`; 16-14 and 16-12).** Run 3 failed `PH16_UNDO_AND_REINSTATE` at 375; repeats failed 1 to 2 runs in 3, with the menu modal or not.
   - **Cause 1 (16-14).** `chooseFilter` changed `?risks=` with the native `history.replaceState(null, …)`. Next 16.3.6 syncs that as a restore that keeps the loaded tree: its page segment is keyed to the loaded search, while the router's URL drops it. The next server action's revalidation renders the page for the new URL. The page segment keys diverge, Next treats the page as new and scrolls to it, so the page moves to its top.
   - **Proof of cause 1:** a scroll to 0 in 4 of 6 runs with a Show change, 0 of 3 without, and no remount by the editor probe. In Next's sources, `restore-reducer` keeps the history's tree and `renderedSearch`, and `accumulateScrollRef` assigns a scroll only when segments diverge.
   - **Fix 1 (`1bc59af2`):** `router.replace(url, { scroll: false })`. The router's tree follows the address, focus stays on the option, and the editor keeps its state and unsaved input. The cost is one page read per Show change.
   - **Cause 2 (16-12).** Undo focused the returned card with `focus()` alone. A card is taller than a phone screen, so its header and actions stayed out of view. **Fix 2 (`ec90932e`):** land on it with `landOn`.
   - `fae851b9` makes the spec choose a phone menu item only once it is in the viewport, so it fails where a user would see the problem.
9. **Files list focus after Restore (`680fa974`, `5a141663`; 14's FilesList).** `COLLAB02_UAT012_SCENARIO` at 1440 failed once in run 3; Phase 15's first gate failed it once too.
   - **Not an early read:** the assertion waited its full 15 s with the Download button present but unfocused, so focus was lost in the app.
   - **Cause:** both layouts of the list are in the page, and CSS chooses by the list's width and files: a badge needs the wider table, and a table measured too wide gives way to the cards until the files change. The page's refresh after the restore can flip the choice after focus has landed. The browser then drops focus from the now-hidden control.
   - **Not reproduced in isolation:** 0 of 10 at 1440; the order of the refresh and the focus decides it.
   - **Fix:** the list remembers the focused file action. When a change of layout hides it and focus has not moved elsewhere, focus moves to the same action in the shown layout, with no scroll. Leaving a control that still shows clears the memory, so focus is never pulled back.
   - Passed in run 4 at both widths.
10. **Acceptance wording.** Task 1's "risk-details.tsx contains Show history" was first met through `RiskHistoryTrigger`. The literal now sits in `ShowHistoryPending` in `risk-details.tsx`. `risk-detail-editor.tsx` needed no change, because RiskDetails already withholds editing for a withdrawn Risk.

## Risks and carried items

- **Routes near their 300,000-byte budget** (run 4, desktop):
  - `/app/risks/{documentId}`: 299,848, 152 bytes of headroom. The pilot noted 185 at `ba289590`; ShowHistoryPending's export took 33.
  - `/app/requests/{documentId}`: 299,581, 419 bytes of headroom. The pilot noted 764 from run 3's estimate; the Files list focus fix took about 345.
  - The next feature on either route needs the D-24 triage or a deferral first.
- **One page read per Show change** (Deviations 8), accepted by the pilot's ruling as the idiomatic fix.
- **Older `next/dynamic` bodies without `loading`** (`deferred-items.md`): `DecidedProposals`, `QuestionAiRowExtras`, `FileAiControl`.

## Manual-only items for the orchestrator

- **The live UAT-A check:** the operator's development database, with the real UAT-A records, at 1440 and 375. The spec uses its own UAT-A-like records.
- **The development database after the next Strapi start:** 16-03's schema change (withdrawal facts, `csrm-risk-history-event`) migrates on the operator's database the first time Strapi starts there.
- **Browser backstops:** NVDA on the withdraw and reinstate forms, the history sheet, the AI proposals section and the phone menu; Safari and Firefox for the Show filter's address change, now through the router, and the Undo landing.

## Self-Check: PASSED

- The 22 commits above exist on `csrm` (`git log 5ddde0f6..5a141663`).
- `apps/csrm/e2e/risk-curation.spec.ts` contains `@journey` and every required label. The mobile `testMatch` lists `**/risk-curation.spec.ts`. `COVERAGE.md` contains `INTEGRATE` and `IAM-owned`.
- Run 4 is green and the static checks print what the verify block expects.

## Phase gate (final run, after the code review)

Run by the stage B worker on 2026-10-16, from 08:37 to 09:44 UTC, at `fa0cf7a4`. These steps came first:
- **The code review (stage A).** `16-REVIEW.md` had 54 findings. `16-REVIEW-DISPOSITION.md` closes all of them (46 fixed, 4 skipped with evidence, 4 deferred with routes, 0 open), ending at `14bd22a8`.
- **`verify:post`.** `16-SECURITY.md` is verified: 43 of 43 threats closed, `threats_open: 0`. `16-VALIDATION.md` is validated and Nyquist-compliant. The audit's one gap, D-17's leave guard, was fixed test-first: `8b13b1c2` RED, `cc1c8f25` GREEN, with a dated 16-UI-SPEC §7 amendment for the new Risk's leave copy. `16-UI-REVIEW.md` scored 21/24 with one blocker. `16-UI-REVIEW-DISPOSITION.md` records UI-01 (`aria-controls`, `72b875ed`/`45da8c1e`) and UI-03 (the withdrawn card's 16px blocks, `4e98f71f`/`f8720df4`) as fixed test-first. UI-02, UI-04 and UI-06 are kept with evidence, and UI-05 and UI-07 go to the UAT.
- **The verification and the UAT.** `16-VERIFICATION.md` reads `human_needed`: 4/4 criteria, ASSESS-09 and ASSESS-10 satisfied, 0 gaps. `16-UAT.md` lists the seven checks only a person or a deployment can make, all pending for the pilot's ruling (`fa0cf7a4`).

The gate ran from the repository root with Node v24.19.0 and pnpm 11.24.0 from the session shim. Both Keycloak flags were off and no `.env` file was read. Before the run the tree was clean apart from the uncommitted `.verification-ledger.json`, ports 1337 and 3000 were free, and no dev server ran. The suites ran one at a time, all at one HEAD. `retries` is 0, so a flaky test would show as a failure.

| Gate | Command | Result | Duration | HEAD |
|---|---|---|---|---|
| `api:check` | `pnpm --dir apps/csrm api:check`, then `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | clean; no contract diff, nothing left modified | 2 s | `fa0cf7a4` |
| Typecheck | `pnpm --dir apps/csrm typecheck` | clean | 4 s | `fa0cf7a4` |
| Lint | `pnpm --dir apps/csrm lint` | clean | 3 s | `fa0cf7a4` |
| Web (Vitest) | `pnpm --dir apps/csrm test` | **Test Files 235 passed (235), Tests 5,847 passed (5,847)** | 63 s (Vitest 62.1 s) | `fa0cf7a4` |
| Strapi (node:test) | `pnpm --dir apps/backend test` | **ℹ tests 2,023, ℹ pass 2,022, ℹ fail 0, ℹ skipped 1**, cancelled 0. The skipped test is the POSIX file-mode check (IN-209), which cannot run on Windows | 31.7 min (duration_ms 1,894,632) | `fa0cf7a4` |
| Playwright (production build, both projects) | `pnpm --dir apps/csrm test:e2e` | **248 passed**: desktop **180**, mobile **68**. 0 failed, 0 flaky, 0 skipped | 34.1 min | `fa0cf7a4` |
| Tree | `git status --short` | only ` M .planning/workstreams/csrm/.verification-ledger.json`; the run modified no tracked file | | `fa0cf7a4` |

- **Against the stage A regression gate.** That gate ran web 5,842, Strapi 2,022 passed with 1 skipped, and Playwright 248. Web gains 5 tests: one for D-17 and four for UI-01 and UI-03. Strapi and Playwright are unchanged, since stage B changed only web code and its unit tests.
- **Phase 16's journeys, each at 1440 and 375:** `risk-curation.spec.ts` passed 8 of 8. That is the curation journey with every `PH16_*` label, `PH16_NEG_UNRELATED_REQUESTOR`, `PH16_NEG_REQUESTING_ANALYST` and `PH16_UNDO_KEEPS_PLACE`.
- **Server log noise, not a failure.** The harness's Next server logged `The destination stream closed early.` 666 times, from streamed responses whose client navigated away, as in Phases 14 and 15. The other server errors were the deliberate ones: 3 `Invalid Server Actions request` and 2 `The Server Reference ID did not match the expected format`.

**Performance budgets.** `performance.spec.ts` passed on desktop with no override added in Phase 16: `git diff 01dc4118..HEAD -- apps/csrm/e2e/performance.spec.ts` is empty. The figures come from this run's `apps/csrm/.tmp/performance/baseline-desktop.json`, measured 09:33:47 to 09:34:31 UTC.

| Route | Actor | Delivered JS bytes | Budget | Left |
|---|---|---|---|---|
| `/app` | Requestor | 230,164 | 300,000 | 69,836 |
| `/app/requests` | Requestor | 252,637 | 300,000 | 47,363 |
| `/app/requests/{documentId}` | Requestor | **299,442** | 300,000 | **558** |
| `/app/questionnaires/{documentId}` | Requestor | 363,139 | 500,000 (override) | 136,861 |
| `/app` | Security Analyst | 230,164 | 300,000 | 69,836 |
| `/app/review/assessments/{documentId}` | Security Analyst | 398,022 | 460,000 (override) | 61,978 |
| `/app/risks` | Security Analyst | 264,769 | 300,000 | 35,231 |
| `/app/risks/{documentId}` | Security Analyst | **299,711** | 300,000 | **289** |
| `/app/reports/risk-exposure` | Security Analyst | 256,306 | 300,000 | 43,694 |
| `/app/admin/controls` | Security Analyst | 250,898 | 300,000 | 49,102 |

Every TTFB was under 14 ms (budget 500) and every LCP was 456 ms or less (budget 2,500). The stage B fixes load only on `/app/review/assessments/{documentId}`, so the two near-limit routes did not grow: their figures are a little lower than at stage A, where they were 299,574 and 299,843. The next feature on either route still needs the D-24 triage or a deferral first.

### Static checks (on `fa0cf7a4`; PHASE_16_BASE=01dc4118)

```
## content-type freeze (with the three IAM exclusions)
apps/backend/src/api/csrm-risk-history-event/content-types/csrm-risk-history-event/schema.json
apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json
## catalogue copies
cmp: identical (exit 0)
## Keycloak paths under apps/ in 01dc4118..f2a39dbe and d1518c5f..HEAD
(no match)
## dependency freeze, 01dc4118..f2a39dbe and PHASE_16_IAM_SYNC=d1518c5f..HEAD
(empty)
## glossary
CONTEXT.md:65: **Withdrawn (Risk)**:
## coverage record
INTEGRATE present; "IAM-owned" pg note present
## the pilot's approval lines (T-16-01), bold markers stripped
phase-16-risk-withdrawal-and-history.md: Status: approved by the pilot on 2026-10-15 (G-6).
phase-12-ai-run-record-and-provenance.md: Phase 16 amendment status: approved by the pilot on 2026-10-15 (G-6).
phase-04-deterministic-draft-jobs.md: Phase 16 amendment status: approved by the pilot on 2026-10-15 (G-6).
phase-13-request-notes.md: Phase 16 amendment status: approved by the pilot on 2026-10-15 (G-6).
## the stage A amendments (b264ccc6), bold markers stripped
phase-16-risk-withdrawal-and-history.md: Phase 16 code review amendment status: approved by the pilot on 2026-10-16 (G-6).
phase-12-ai-run-record-and-provenance.md: Phase 16 code review amendment status: approved by the pilot on 2026-10-16 (G-6).
## "status: awaiting" in the four records
(none)
## contract files changed since PHASE_16_BASE
apps/csrm/src/lib/api/generated/schema.d.ts
docs/references/specification.json
```

The content-type freeze still lists exactly the two approved schema files. `specification.json` and `schema.d.ts` changed for the operations the approved record names (16-05 to 16-10) and, since stage A, only under the approved BE1-03 amendment (`97955808`). Stage B changed neither file, and `api:check` regenerates `schema.d.ts` with no diff.
