---
phase: quick-261007-jbs
plan: 01
status: complete
workstream: csrm
commits:
  red: see git log
  green: see git log
  docs: see git log
---

# Quick 261007-jbs: first-load JavaScript budget

Both record routes pass the unchanged 300,000-byte delivered JavaScript ceiling. No route override was added.
Assessment review has 447 bytes of headroom, so the next editor changes should re-run the gate.

## Triage and measurements

| Build or change | Risk detail | Assessment review |
|---|---:|---:|
| Phase 11 final gate | 297,332 | 294,709 |
| Before this task | 301,121 | 300,470 |
| After isolating the search term constant | 300,442 | 299,788 |
| Final, with risk edit form loaded on demand | **297,520** | **299,553** |

All figures are five-sample delivered JavaScript medians in bytes. The before measurement for risk detail is the Phase 12 gate; the retained local baseline after a 19-byte Alert experiment was 301,102. The final five samples for each route were identical. The final measurements are in the ignored `apps/csrm/.tmp/performance/baseline-desktop.json`.

I built revision `6785116` from a Git archive in an ignored scratch directory and compared its route client-reference chunks with the retained production builds. The risk detail chunk containing its page copy remained 31,717 decoded bytes. A chunk shared with the shell search control grew from 54,981 decoded / about 18,801 gzipped bytes in the scratch Phase 11 build to 64,213 decoded / about 21,616 gzipped bytes before the fix. The new runtime import of `QUICK_FIND_MAX_TERM_LENGTH` from `quick-find-domain.ts` brought search dialog copy and helpers into the shell's first load. A small constants module restored a type-only domain import in the trigger and saved about 660 bytes on risk detail and 682 on assessment review.

Risk detail also imported its edit form on the initial read view, although the form is shown only after Edit risk. Loading that form on demand moved its first-use code out of the route document's initial script set. Risk detail fell another 2,922 bytes. The build's shared chunk allocation also lowered assessment review by 235 bytes. The review route retains its provenance header and on-demand source sheet. Both routes pass without widening a budget.

## Decisions

- Keep the shared 300,000-byte budget because both excesses had source fixes.
- Show a short loading status while the risk edit form loads after the analyst opens it.
- Revert a direct dialog package import experiment: it raised both route totals and disturbed mobile navigation tests.

## Verification

- Red guard: `pnpm --dir apps/csrm test src/components/shell/quick-find-trigger.test.tsx` — 1 failed, 21 passed before the fix.
- `pnpm --dir apps/csrm test` — 154 files, 3,469 tests passed.
- `pnpm --dir apps/csrm typecheck` — passed.
- `pnpm --dir apps/csrm test:e2e e2e/performance.spec.ts` — 11 passed; both record routes green.
- `pnpm --dir apps/csrm test:e2e e2e/assessment-release-workflow.spec.ts` — 1 passed.
- `pnpm --dir apps/csrm test:e2e e2e/risk-register-workflow.spec.ts --project=desktop -g "Bob filters the Risk Register"` — 1 passed; the deferred edit form opened and completed its workflow.

## Proposed commits

| Order | Commit | Message | Exact paths to stage |
|---|---|---|---|
| RED | see git log | `test(quick-261007-jbs): guard the search trigger's lazy dependency` | `apps/csrm/src/components/shell/quick-find-trigger.test.tsx` |
| GREEN | see git log | `fix(quick-261007-jbs): defer risk editing and trim first-load search code` | `apps/csrm/src/components/shell/quick-find-trigger.tsx`; `apps/csrm/src/features/quick-find/quick-find-constants.ts`; `apps/csrm/src/features/quick-find/quick-find-domain.ts`; `apps/csrm/src/features/risks/risk-details.tsx`; `apps/csrm/src/features/risks/risk-details.test.tsx` |
| Docs | see git log | `docs(quick-261007-jbs): record route budget triage` | `.planning/workstreams/csrm/quick/261007-jbs-bring-risk-and-review-routes-within-js-budget/261007-jbs-PLAN.md`; `.planning/workstreams/csrm/quick/261007-jbs-bring-risk-and-review-routes-within-js-budget/261007-jbs-SUMMARY.md` |

## Deviations

- The scratch `pnpm build` command unexpectedly began resolving packages; it was interrupted before installation, and the historical build was completed through the installed Next binary.
- The direct dialog import experiment was reverted after its measurements and navigation test failures. It is absent from the proposed commits.
- `git status` still shows `capability-navigation.tsx` and `ai-run-sheet.tsx` as touched; `git diff` shows no content change for either. Exclude both from staging.
- Git remained read-only. State and roadmap files were not changed.
