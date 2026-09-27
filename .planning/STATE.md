---
gsd_state_version: "1.0"
milestone: v2.0
milestone_name: Assessment Lifecycle and Oversight
current_phase: 10
current_plan: 0
status: planning
last_updated: "2026-09-28T02:15:00+10:00"
last_activity: "2026-09-28 — branch v2.0 created from uat-trial; Phase 11 UI-SPEC approved; paused at the weekly usage ceiling"
progress:
  total_phases: 14
  completed_phases: 0
  total_plans: 23
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-28)

**Core value:** Make a complex cyber-risk workflow simple and auditable while keeping Security Analysts—not AI—in control of assessment review and release.
**Current focus:** v2.0 Assessment Lifecycle and Oversight, on branch `v2.0`: planning Phases 10–22 and 17.1 in execution order. Phase 10 is planned, Phase 11 has its UI-SPEC, and Phase 11's plans are next.

## Current Position

Phase: 11 (UI-SPEC approved, with 7 of 7 checker dimensions passing; plans next). Phase 10 is planned (23 plans; a fresh plan check runs before it is built). Phase 12 is discussed and researched, with its UI-SPEC next. Phases 13–22 and 17.1 are not yet planned.
Plan: —
Status: Planning v2.0 on branch `v2.0` (mode: plan-all-first); paused at the weekly usage ceiling
Last activity: 2026-09-28 — Phase 11 UI-SPEC written, checked and committed

## Milestone

**Version:** 2.0, Assessment Lifecycle and Oversight
**Phases:** 10–22 and 17.1 (14 phases). Execution order: 10, 11, 12, 13, 14, 15, 16, 19, 17, 17.1, 18, 20, 21, 22.
**Requirements:** 46 in `.planning/REQUIREMENTS.md`, tracing all 65 product gap UAT findings (`.planning/uat/product-gaps/`).
**Decisions:** `.planning/NEXT-WAVE-DECISIONS.md`: the eighteen from the UAT report and G-1 to G-10.
**Previous milestone:** v1.0, shipped 2026-09-26 and closed 2026-09-28:
- `.planning/MILESTONES.md`;
- `.planning/milestones/v1.0-ROADMAP.md` and `v1.0-REQUIREMENTS.md`;
- `.planning/milestones/v1.0-STATE.md` (its full decision log, risks and gate records).

## Decisions

v1.0's decisions (`.planning/milestones/v1.0-STATE.md`) stay binding unless a v2.0 decision reverses them, and `NEXT-WAVE-DECISIONS.md` names each reversal.

- [Next wave, 2026-09-27]: The product gap UAT (`.planning/uat/product-gaps/`: 65 findings against the operator's intended product in `BRIEF.md` Appendix A) becomes Phases 10–22, planned with GSD. Milestone v1.0 stays open for now: closing it needs the operator's decisions on the 52 open items the close audit lists, the v1.0 acceptance test has not run, and nine of the UAT's major defects are in v1.0's own flows (Phase 10 closes them). The new phases continue v1.0's numbering under a "Next Wave" section of ROADMAP.md, and the Next-wave requirements in REQUIREMENTS.md (46 after the delegated decisions) trace to the intended-product IDs and to every finding. Phase 9 keeps its entry but is scoped by Phases 12, 15, 16 and 17, and its carried items move there (R-08-42 to Phase 12, O-5 to Phase 13). Phase 19 runs before Phase 18, whose risk-row import and export reuse its infrastructure.
- [Next wave decisions, 2026-09-27]: The operator delegated the product decisions, to be made "based on what the process is in real life revolving around Cyber Governance as well as Premium UI/UX". `.planning/NEXT-WAVE-DECISIONS.md` records all eighteen from `REPORT.md` §9 and six more (G-1 to G-6), replacing the provisional defaults. The model is the Three Lines: the business owns treatment and accepts residual risk, and Security Analysts assess and own the method. The assessment follows the ISO/IEC 27005 process, and risk owners approve the treatment plan and accept residual risk (ISO/IEC 27001:2022 clause 6.1.3 f). Headline choices:
  - a 5 × 5 matrix, with ratings as the product of the two scores banded Low, Moderate, High and Critical, and acceptance authority and review intervals by rating;
  - no hard delete of persisted risks;
  - analyst re-rating after release as a recorded review;
  - separation of duties on an analyst's own request;
  - peer approval before release when any residual risk is Critical;
  - per-file AI opt-in for attachments, under a classification ceiling;
  - control titles loaded in Phase 10;
  - notifications in the app (Phase 17), then reminders and email (Phase 20);
  - quick find with Ctrl+K or ⌘K;
  - a premium experience bar for every UI-SPEC.

  Three requirements were added: ASSESS-20, NOTIFY-02 and UX-10, making 46. Phase 17.1, "Review, peer approval and risk acceptance", was inserted. Contract-gap records are approved by the orchestrator after review (G-6).
- [Next wave planning method, 2026-09-27]: Each phase is planned in roadmap order with GSD: discussion in auto mode (CONTEXT.md), the UI design contract for UI phases (UI-SPEC.md, deferring every value to `docs/design/csrm-design-direction.md`), research, plans and the plan check. Planning stops before execution: auto-advance is not used for this wave's planning. Plans for Phases 11–22 are written against today's code plus the planned outputs of earlier phases, so re-run the plan check for a phase just before executing it.
- Turborepo will contain `apps/strapi` and `apps/web`; the existing sibling Strapi project will be migrated into the repository during Phase 1.
- The provided CSRM project brief governs scope; the Strapi OpenAPI contract governs production API communication.
- Keycloak authenticates identities; IdamBox/Strapi remains the source of application authorization.
- AI assists with drafts and suggestions but cannot release assessments.
- [v1.0 close and v2.0 start, 2026-09-28]: Decided under the operator's delegation (G-8).
  - v1.0 closed as an override close-out; see MILESTONES.md.
  - Its phase directories stay in place, and no tag was created. The suggested `v1.0` tag target is `37874ed` on `main`.
  - v2.0 continues the phase numbering.
  - Phase 06.10 is now backlog item 999.1.
  - The v1.0 STATE body moved to `.planning/milestones/v1.0-STATE.md`, so every agent reads a short STATE.

- [v2.0 planning conventions, 2026-09-28]:
  - Work moved to branch `v2.0`, created from `uat-trial` at `e3d393d`. `uat-trial` stays as the UAT and planning snapshot.
  - Recorded UI extensions form one milestone-wide sequence in `docs/design/csrm-design-direction.md`: Phase 10's X-1 to X-5 (recorded by plan 10-01), then Phase 11's X-6 to X-10 (recorded by Phase 11's first plan). Each later UI-SPEC numbers after the highest number in the committed UI-SPECs, so Phase 12 starts at X-11. Phase 7's X-1 to X-13 were local to its own contract; they are in the direction as dated CSRM extension notes and are cited by those.
  - Phase 11's UI-D33 is approved: "mitigation control" is the display term for a Control Implementation in the copy that phase rewrites, as in Phase 7's contract, Phase 10's D-28 and D-33, and the Risk Register's save messages. The JDL name stays in the data model and API.

## Risks and Open Decisions

- **INT-02 (Keycloak):** deferred by operator decision. Keycloak stays disabled, and Phase 22 uses a development fixture for the Admin role until then.
- **Phase 8 residuals** (`docs/security/phase-08-residual-risks.md`):
  - decided: the fonts (R-08-24, G-10) and the AI transcript flag (R-08-12, G-7);
  - already closed in code: the CORS allowlist (R-08-11);
  - still open, and deployment-time only: the proxy topology (R-08-04), log retention (R-08-13) and CSP reporting (R-08-07);
  - carried: the in-memory job registry and the shared job store (R-08-36) and PostgreSQL execution (R-08-37). Phases 13 and 21 touch jobs.
- **Plans written ahead:** Phases 11–22 and 17.1 are planned against today's code plus the planned outputs of earlier phases. Re-run each phase's plan check just before executing it.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| debug_sessions | phase4-full-e2e-gate | awaiting_human_verify | 2026-09-28 | v1.0 |
| quick_tasks | 260830-1hh-remediate-the-confirmed-phase-2-review-f | unknown | 2026-09-28 | v1.0 |
| quick_tasks | 260830-89x-remediate-the-confirmed-phase-3-review-f | unknown | 2026-09-28 | v1.0 |
| quick_tasks | 260831-srn-remediate-every-phase-4-review-finding-w | unknown | 2026-09-28 | v1.0 |
| quick_tasks | 260901-oiw-remediate-every-confirmed-phase-5-review | unknown | 2026-09-28 | v1.0 |
| quick_tasks | 260901-qri-make-consecutive-playwright-runs-collisi | unknown | 2026-09-28 | v1.0 |
| quick_tasks | 260902-a9r-remediate-all-phase-6-independent-review | unknown | 2026-09-28 | v1.0 |
| uat_gaps | 02/02-HUMAN-UAT.md | passed | 2026-09-28 | v1.0 |
| uat_gaps | 03/03-HUMAN-UAT.md | passed | 2026-09-28 | v1.0 |
| uat_gaps | 05/05-HUMAN-UAT.md | passed | 2026-09-28 | v1.0 |
| uat_gaps | 06/06-HUMAN-UAT.md | passed | 2026-09-28 | v1.0 |
| deferred_items | 08/deferred-items.md: Close-out dispositions (2026-09-26) The phase review closed or routed every row above. Where a row's owner cel… | acknowledged | 2026-09-28 | v1.0 |
| deferred_items | 08/deferred-items.md: the 40 table rows (08-02 to 08-13) | resolved (Status column added; each row was closed or routed at the Phase 8 close-out) | 2026-09-28 | v1.0 |

## Performance Metrics

**v1.0 final gate** (2026-09-26, `7eaf99d`):
- Playwright 84/84 in both projects on the production build;
- Strapi 526/526;
- web 1,892/1,892;
- typecheck and `api:check` clean.

Gate history: `.planning/milestones/v1.0-STATE.md`.

## Session Continuity

**Last session:** 2026-09-28
**Stopped At:** paused at the weekly usage ceiling: 94% of the weekly limit against the brief's 95% ceiling, with the limit resetting at 2026-09-28 00:00 UTC (10:00 AEST). The operator restarts the session by hand. The last commit adds Phase 11's UI-SPEC and this state. The tree is clean, and `v2.0` is pushed to `origin`.
**Resume File:** the operator's local v2.0 orchestration brief (git-excluded). Its unit instructions and per-phase seeds, including the carried verification items, sit alongside it.

**Exact next step to resume:**
1. Re-read the brief and this file, confirm the branch is `v2.0`, and check usage.
2. Run these read-only planning units in parallel. None commits; the orchestrator commits each one's files by path:
   - Phase 11, Unit C (patterns and plans), then Unit D and a revision;
   - Phase 12, Unit B (its UI-SPEC numbers new extensions from X-11);
   - Unit A for Phases 13, 16 and 19, whose dependencies already have a CONTEXT.md.
3. Continue in the execution order: Phase 14 and 15 Unit A once Phase 13 has its CONTEXT.md, then 17, 17.1, 18, 20, 21 and 22.
4. With every phase planned, self-host the fonts (G-10), then build from Phase 10, opening each phase with a fresh plan check.

## Next Action

**Resume v2.0 planning on branch `v2.0`** after the weekly usage reset, following Session Continuity above. Nothing is built yet. Both dev servers were running at the pause; the next session checks the ports.

## Accumulated Context

### Roadmap Evolution

- Phases 10–22 added (2026-09-27): the next wave from the product gap UAT (65 findings). Phase 9 is scoped by Phases 12, 15, 16 and 17.
- Phase 17.1 inserted after Phase 17 (2026-09-27): Review, peer approval and risk acceptance (`NEXT-WAVE-DECISIONS.md` decision 17 and G-2). There are now 46 requirements.
- v1.0 closed (2026-09-28): an override close-out, with its phase directories kept and Phase 06.10 moved to backlog 999.1.
- v2.0 started (2026-09-28): Assessment Lifecycle and Oversight, Phases 10–22 and 17.1.
