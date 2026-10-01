---
gsd_state_version: "1.0"
milestone: v2.0
milestone_name: Assessment Lifecycle and Oversight
current_phase: 10
current_phase_name: post-demo Stage 2, planning every remaining phase in execution order from Phase 11
status: planning
stopped_at: "Post-demo Stage 1 approved on branch `post-demo`: decisions G-11 to G-18, nine requirements added (55 in all), Phases 17, 17.1 and 20 amended and Phase 17.2 inserted. Stage 2 (plan every remaining phase) is next."
last_updated: "2026-10-01T05:33:24.123Z"
last_activity: 2026-10-01
last_activity_desc: "Completed quick task 260929-u0w: Add production-only OIDC sign-in to the CSRM web app against Keycloak"
state_head: e10a1a1e4579ae643da71a6212c9d9c686fd3e3e
progress:
  total_phases: 16
  completed_phases: 0
  total_plans: 23
  completed_plans: 0
  percent: 0
current_plan: 0
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-28)

**Core value:** Make a complex cyber-risk workflow simple and auditable while keeping Security Analysts—not AI—in control of assessment review and release.
**Current focus:** v2.0 Assessment Lifecycle and Oversight on branch `post-demo`, under `.planning/POST-DEMO-BRIEF.md`: reconcile the product demo's risk-owner asks into the roadmap (Stage 1), plan every remaining phase (Stage 2), then build in execution order (Stage 3).

## Current Position

Stage 2 of the post-demo brief: planning every remaining phase in execution order (10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22). Stage 1 is approved: decisions G-11 to G-18 amend Phases 17, 17.1 and 20 and insert Phase 17.2. Phase 10 is planned (23 plans; a fresh plan check runs before it is built). Phase 11 has its UI-SPEC, and its plans are next. Phase 12 is discussed and researched, with its UI-SPEC next. Phases 13–22, 17.1 and 17.2 are not yet planned.
Plan: —
Status: Planning v2.0 on branch `post-demo` (mode: plan-all-first; the pilot drives every transition, and auto-advance is off)
Last activity: 2026-10-01 - Completed quick task 261001-le4: Add the missing gap after the Request relationships card in the Analyst request detail view, matching the Requestor view

## Milestone

**Version:** 2.0, Assessment Lifecycle and Oversight
**Phases:** 10–22, 17.1, 17.2 and 19.1 (16 phases). Execution order: 10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22.
**Requirements:** 55 in `.planning/REQUIREMENTS.md`: 46 tracing all 65 product gap UAT findings (`.planning/uat/product-gaps/`), and 9 from the product demo's risk-owner asks PD-1 to PD-5.
**Decisions:** `.planning/NEXT-WAVE-DECISIONS.md`: the eighteen from the UAT report, G-1 to G-10, and the post-demo G-11 to G-18.
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
- The Turborepo contains `apps/backend` (Strapi) and `apps/csrm` (Next.js); the sibling Strapi project was migrated in during Phase 1, and the folders took these names in d161fce.
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
- [Post-demo start, 2026-10-01]: The product demo's risk-owner asks are reconciled, planned and built on branch `post-demo` under `.planning/POST-DEMO-BRIEF.md`. That brief overrides three stale facts: the `v2.0` branch and the git-excluded brief above; the app paths, now `apps/backend` and `apps/csrm` (`d161fce`); and INT-02, now implemented, flag-gated and off in development. GSD agents inherit the session model, and auto-advance is off, so the pilot drives every transition.
- [Post-demo G-11, 2026-10-01]: The nominated risk owners are each risk's own `riskOwner`, set by the analyst (one step for all) and required before release for response; no request-level owner and no reuse of `sponsor`; the assigned analyst, the reviewer and the peer approver cannot be a risk owner or executive approver on that assessment, and an owner cannot act on it as an analyst (extends G-1).
- [Post-demo G-12, 2026-10-01]: The Requestor, the nominated risk owners and named executive approvers read the whole assessment from its first release for response through the released record, with the stage labelled; anyone else gets the refusal a missing record gets at every route and stage (extends decision 3; reverses v1's owner-only Requestor read).
- [Post-demo G-13, 2026-10-01]: "Submit final assessment" opens numbered acceptance rounds that lock analyst editing, and the assigned analyst can recall a round; once every risk has a valid decision, the assigned analyst releases and closes in one confirmed step (assessment `approved`, request `closed`, shown "Closed"); automatic closure on the last decision is rejected (reverses v1's release transition to request `approved`; decision 16's "Released" request label now covers only earlier releases).
- [Post-demo G-14, 2026-10-01]: Each risk takes an explicit Accept or Treat decision from its named owner, with authority by residual rating for both choices (High adds the named executive approver; only the executive decides Critical, as a time-limited exception); Accept only where no planned control exists; each decision records authority, rationale, review date and a fingerprint; no analyst, AI or service identity decides (reverses G-2's per-risk decline).
- [Post-demo G-15, 2026-10-01]: Contest points are their own entity (Phase 17.2): any participant raises one on any content they can read, with a reason, a reply thread and a status; sending back or recalling reopens the whole assessment, every point is answered before resubmission, and a decision survives a round only while its risk's fingerprint is unchanged (reverses G-2's decline that returned one risk).
- [Post-demo G-16, 2026-10-01]: Phase 20 tracks treatments from Not Started through In Progress to Complete on evidence; the server sets Overdue from `treatmentResolveDate` and every read derives it by the same rule; date changes need a reason; overdue treatments escalate to the assigned analyst and the risk owner (new RISK-06; reverses Phase 7 D-04 in part).
- [Post-demo G-17, 2026-10-01]: First-line users find people through the already-granted `GET /api/v1/users?search=`, hardened (two characters, active human users only, `documentId` and `displayName` only, every search logged): control owners in Phase 17, then treatment owners in 17.1 (settles Phase 2's deferred directory contract; sponsor selection stays off).
- [Post-demo G-18, 2026-10-01]: Risk owners and executive approvers receive in-app notifications at each stage (Phases 17 and 17.1, and NOTIFY-04 for contest points in 17.2), and decisions left waiting get email reminders from Phase 20.
- [Post-demo G-19, 2026-10-01]: The in-app notification centre moves from Phase 17 into the inserted Phase 19.1 (after 19, before 17), keeping Phase 17 within L; NOTIFY-01 moves with it, its first kinds are the events that exist before Phase 17, and Phase 17 adds its response kinds through the same service (reverses only decision 18's placement of the centre in Phase 17).

## Risks and Open Decisions

- **INT-02 (Keycloak):** implemented, flag-gated, and off in development (updated 2026-10-01). OIDC sign-in (ADR 0003, quick tasks 260929-u0w and 260930-iei) and Strapi access-token verification (ADR 0004, `b6000d0`) ship behind `CSRM_AUTH_OIDC_ENABLED` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION`, with provisioning behind `IDAMBOX_KEYCLOAK_PROVISIONING` (ADR 0002). Development and every suite keep them off and use the development identity bridge; nobody starts Keycloak or flips them during v2.0 work. New authorisation rules are enforced in Strapi against the resolved IdamBox User and never branch on the auth mode. Phase 22 keeps a development fixture for the Admin role. The remaining risk is deployment-time: a Keycloak environment, the ADR 0004 realm changes, and `externalSubject` links for every user.
- **Phase 8 residuals** (`docs/security/phase-08-residual-risks.md`):
  - decided: the fonts (R-08-24, G-10) and the AI transcript flag (R-08-12, G-7);
  - already closed in code: the CORS allowlist (R-08-11);
  - still open, and deployment-time only: the proxy topology (R-08-04), log retention (R-08-13) and CSP reporting (R-08-07);
  - carried: the in-memory job registry and the shared job store (R-08-36) and PostgreSQL execution (R-08-37). Phases 13 and 21 touch jobs.
- **Plans written ahead:** Phases 11–22 and 17.1 are planned against today's code plus the planned outputs of earlier phases. Re-run each phase's plan check just before executing it.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260929-u0w | Add production-only OIDC sign-in to the CSRM web app against Keycloak | 2026-09-29 | 0f27661 | [260929-u0w-add-production-only-oidc-sign-in-to-the-](./quick/260929-u0w-add-production-only-oidc-sign-in-to-the-/) |
| 260930-iei | When CSRM_AUTH_OIDC_ENABLED=true, move the Signed in as / Sign out block to a top-right initials avatar menu with name, email and Sign out | 2026-09-30 | e76aa5f | [260930-iei-when-csrm-auth-oidc-enabled-true-move-th](./quick/260930-iei-when-csrm-auth-oidc-enabled-true-move-th/) |
| 261001-kxa | Make the Request context card span the full content width in the Analyst request detail view, matching the Requestor view | 2026-10-01 | a11d51b | [261001-kxa-update-the-analyst-request-detail-view-a](./quick/261001-kxa-update-the-analyst-request-detail-view-a/) |
| 261001-le4 | Add the missing gap after the Request relationships card in the Analyst request detail view, matching the Requestor view | 2026-10-01 | e10a1a1 | [261001-le4-add-the-missing-gap-between-the-request-](./quick/261001-le4-add-the-missing-gap-between-the-request-/) |

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

**Last session:** 2026-10-01
**Stopped At:** post-demo Stage 1 approved and committed: decisions G-11 to G-18 (`NEXT-WAVE-DECISIONS.md`, Post-demo decisions), nine requirements added (55 in all), Phases 17, 17.1 and 20 amended, and Phase 17.2 inserted. Stage 0 recorded the baseline: web 2,046/2,048 (two stale paths, fixed in `678b117`), Strapi 578/578, Playwright 84/84.
**Resume File:** `.planning/POST-DEMO-BRIEF.md`: the operator's prompt verbatim, the overrides, the dev-mode rules, the baseline gates, the host notes and the gate commands. It replaces the git-excluded v2.0 orchestration brief, which does not exist in this repository.

**Exact next step to resume:**
1. Re-read the brief and this file, confirm the branch is `post-demo` with a clean tree (apart from the brief's three operator items), and check usage.
2. Stage 2: plan every remaining phase in execution order with the Next wave planning method, starting with Phase 11's patterns and plans. Read-only units run in parallel once their dependencies have a CONTEXT.md; the pilot commits each unit's files by path.
3. The planning gate: every phase has plans and a passing check, every ask (PD-1 to PD-5) traces to a requirement, a phase and a success criterion, nothing references the pre-rename app paths, and `/gsd-health` is clean.
4. Stage 3: the G-10 fonts quick task, then build from Phase 10, opening each phase with a fresh plan check.

## Next Action

**Post-demo Stage 2 on branch `post-demo`**, following Session Continuity above. Nothing is built yet. No dev server was running at the start of the post-demo session.

## Accumulated Context

### Roadmap Evolution

- Phases 10–22 added (2026-09-27): the next wave from the product gap UAT (65 findings). Phase 9 is scoped by Phases 12, 15, 16 and 17.
- Phase 17.1 inserted after Phase 17 (2026-09-27): Review, peer approval and risk acceptance (`NEXT-WAVE-DECISIONS.md` decision 17 and G-2). There are now 46 requirements.
- v1.0 closed (2026-09-28): an override close-out, with its phase directories kept and Phase 06.10 moved to backlog 999.1.
- v2.0 started (2026-09-28): Assessment Lifecycle and Oversight, Phases 10–22 and 17.1.
- Phase 17.2 inserted after Phase 17.1 (2026-10-01): Contest points and rework rounds (`NEXT-WAVE-DECISIONS.md` G-15), because the contest-and-rework loop would push Phase 17.1 past size L. The post-demo decisions G-11 to G-18 also amend Phases 17, 17.1 and 20; there are now 55 requirements.
- Phase 19.1 inserted after Phase 19 (2026-10-01): In-app notification centre (`NEXT-WAVE-DECISIONS.md` G-19), because the notification centre pushed Phase 17 beyond size L. NOTIFY-01 moves from Phase 17, and Phase 19.1 runs before Phase 17.
