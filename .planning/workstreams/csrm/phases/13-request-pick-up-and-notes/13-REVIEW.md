---
phase: 13-request-pick-up-and-notes
reviewed: 2026-10-09T07:01:25Z
depth: standard
diff_base: ab000f6
reviewed_head: b744ffb
lanes: 6
operator_pass: none
files_reviewed: 248
files_reviewed_list:
  - apps/backend/src/api/csrm-ai-run/controllers/csrm-ai-run.ts
  - apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts
  - apps/backend/src/api/csrm-analyst-insight/controllers/dashboard.ts
  - apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts
  - apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json
  - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/request-assignment.ts
  - apps/backend/src/api/csrm-assessment-request/operations.ts
  - apps/backend/src/api/csrm-assessment-request/routes/request-assignment.ts
  - apps/backend/src/api/csrm-assessment-request/services/assignment-log.ts
  - apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts
  - apps/backend/src/api/csrm-assessment-request/services/my-requests.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-assignment-policy.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-lifecycle.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-lock.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-people.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-status-summary.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-summary-facts.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts
  - apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts
  - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
  - apps/backend/src/api/csrm-request-note/content-types/csrm-request-note-read-state/schema.json
  - apps/backend/src/api/csrm-request-note/content-types/csrm-request-note/schema.json
  - apps/backend/src/api/csrm-request-note/controllers/request-notes.ts
  - apps/backend/src/api/csrm-request-note/operations.ts
  - apps/backend/src/api/csrm-request-note/routes/request-notes.ts
  - apps/backend/src/api/csrm-request-note/services/note-ai-input-log.ts
  - apps/backend/src/api/csrm-request-note/services/request-notes-policy.ts
  - apps/backend/src/api/csrm-request-note/services/request-notes.ts
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/backend/src/bootstrap/seed-assessment-navigation-lifecycle.ts
  - apps/backend/src/csrm/ai/ai-inputs-signal.ts
  - apps/backend/src/csrm/ai/assessment-context-loader.ts
  - apps/backend/src/csrm/ai/assessment-context.ts
  - apps/backend/src/csrm/conflict-reasons.ts
  - apps/backend/src/csrm/generation-job-viewer.ts
  - apps/backend/src/csrm/people/eligible-person.ts
  - apps/backend/src/policies/csrm-authorization.ts
  - apps/backend/tests/ai-inputs-signal.unit.test.ts
  - apps/backend/tests/ai-provenance.unit.test.ts
  - apps/backend/tests/ai-provider-guardrails.unit.test.ts
  - apps/backend/tests/ai-run.integration.test.ts
  - apps/backend/tests/analyst-dashboard.integration.test.ts
  - apps/backend/tests/analyst-insight-authorization.unit.test.ts
  - apps/backend/tests/assessment-context.integration.test.ts
  - apps/backend/tests/assessment-context.unit.test.ts
  - apps/backend/tests/assessment-workflow.integration.test.ts
  - apps/backend/tests/assessment-workflow.unit.test.ts
  - apps/backend/tests/authorization-matrix.integration.test.ts
  - apps/backend/tests/authorization-policy.unit.test.ts
  - apps/backend/tests/authorization.integration.test.ts
  - apps/backend/tests/conflict-reasons.unit.test.ts
  - apps/backend/tests/contract-catalogue.integration.test.ts
  - apps/backend/tests/fixtures/authorization-matrix.ts
  - apps/backend/tests/fixtures/uat-a-like-context.ts
  - apps/backend/tests/helpers/strapi-http-harness.ts
  - apps/backend/tests/my-requests.integration.test.ts
  - apps/backend/tests/questionnaire-generation.integration.test.ts
  - apps/backend/tests/questionnaire-generation.unit.test.ts
  - apps/backend/tests/questionnaire-workflow.integration.test.ts
  - apps/backend/tests/request-assignment.integration.test.ts
  - apps/backend/tests/request-assignment.unit.test.ts
  - apps/backend/tests/request-lifecycle.unit.test.ts
  - apps/backend/tests/request-notes.integration.test.ts
  - apps/backend/tests/request-notes.unit.test.ts
  - apps/backend/tests/request-status-summary.integration.test.ts
  - apps/backend/tests/request-status-summary.unit.test.ts
  - apps/backend/tests/request-workflow.integration.test.ts
  - apps/backend/tests/review-queue-buckets.integration.test.ts
  - apps/backend/tests/review-queue.unit.test.ts
  - apps/backend/tests/second-analyst-seed.integration.test.ts
  - apps/backend/tests/served-operations.integration.test.ts
  - apps/backend/types/generated/contentTypes.d.ts
  - apps/csrm/app/(app)/app/requests/[documentId]/loading.tsx
  - apps/csrm/app/(app)/app/requests/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/requests/loading.tsx
  - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/review/assigned/error.tsx
  - apps/csrm/app/(app)/app/review/assigned/loading.tsx
  - apps/csrm/app/(app)/app/review/assigned/page.tsx
  - apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/review/requests/[documentId]/loading.tsx
  - apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/review/requests/page.tsx
  - apps/csrm/app/globals.css
  - apps/csrm/app/sign-in/page.tsx
  - apps/csrm/e2e/analyst-insights.spec.ts
  - apps/csrm/e2e/app-shell.spec.ts
  - apps/csrm/e2e/design-system-conformance.spec.ts
  - apps/csrm/e2e/helpers/navigation.ts
  - apps/csrm/e2e/navigation-and-home.spec.ts
  - apps/csrm/e2e/quick-find.spec.ts
  - apps/csrm/e2e/request-notes.spec.ts
  - apps/csrm/e2e/request-pick-up.spec.ts
  - apps/csrm/e2e/request-relationship-states.spec.ts
  - apps/csrm/e2e/requestor-request-workflow.spec.ts
  - apps/csrm/e2e/review-lists.spec.ts
  - apps/csrm/playwright.config.ts
  - apps/csrm/src/components/csrm/use-unload-warning.test.tsx
  - apps/csrm/src/components/csrm/use-unload-warning.ts
  - apps/csrm/src/components/shell/account-menu.tsx
  - apps/csrm/src/components/shell/app-shell-account.test.tsx
  - apps/csrm/src/components/shell/header-role-layout.test.ts
  - apps/csrm/src/components/shell/mobile-navigation.test.tsx
  - apps/csrm/src/components/shell/navigation-counts.test.ts
  - apps/csrm/src/components/shell/navigation-counts.ts
  - apps/csrm/src/components/shell/role-switcher.test.tsx
  - apps/csrm/src/components/shell/role-switcher.tsx
  - apps/csrm/src/components/ui/toast-action.test.ts
  - apps/csrm/src/components/ui/toast-action.ts
  - apps/csrm/src/config/navigation/navigation.test.ts
  - apps/csrm/src/config/navigation/navigation.ts
  - apps/csrm/src/config/navigation/page-boundaries.test.tsx
  - apps/csrm/src/config/navigation/page-headings.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-domain.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts
  - apps/csrm/src/features/ai-assistance/ai-generation-facts-schema.ts
  - apps/csrm/src/features/ai-assistance/ai-inputs-changed.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-inputs-changed.tsx
  - apps/csrm/src/features/ai-assistance/ai-provenance-header.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-provenance-header.tsx
  - apps/csrm/src/features/ai-assistance/ai-run-sheet.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx
  - apps/csrm/src/features/ai-assistance/test-fixtures.ts
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-schema.ts
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-service.test.ts
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard-service.ts
  - apps/csrm/src/features/analyst-dashboard/analyst-dashboard.test.tsx
  - apps/csrm/src/features/assessments/analyst-assessment-route.test.tsx
  - apps/csrm/src/features/assessments/assessment-detail.tsx
  - apps/csrm/src/features/assessments/assessment-draft-job.tsx
  - apps/csrm/src/features/assessments/assessment-editor.tsx
  - apps/csrm/src/features/assessments/assessment-list.test.tsx
  - apps/csrm/src/features/assessments/assessment-list.tsx
  - apps/csrm/src/features/assessments/assessment-request-link.tsx
  - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
  - apps/csrm/src/features/assessments/assessment-schema.ts
  - apps/csrm/src/features/assessments/assessment-service.test.ts
  - apps/csrm/src/features/assessments/assessment-service.ts
  - apps/csrm/src/features/assessments/assessment-status-filters.test.tsx
  - apps/csrm/src/features/assessments/questionnaire-generation-job.test.tsx
  - apps/csrm/src/features/assessments/questionnaire-generation-job.tsx
  - apps/csrm/src/features/assessments/released-assessment-route.test.ts
  - apps/csrm/src/features/assessments/request-context-lines.test.tsx
  - apps/csrm/src/features/assessments/request-context-lines.tsx
  - apps/csrm/src/features/contract-response-parity.test.ts
  - apps/csrm/src/features/home/home-page.test.tsx
  - apps/csrm/src/features/home/requestor-home-presentation.ts
  - apps/csrm/src/features/home/requestor-home-service.ts
  - apps/csrm/src/features/home/requestor-home.test.tsx
  - apps/csrm/src/features/home/requestor-home.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-domain.ts
  - apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-review.tsx
  - apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-schema.ts
  - apps/csrm/src/features/questionnaires/questionnaire-service.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx
  - apps/csrm/src/features/quick-find/quick-find-actions.test.ts
  - apps/csrm/src/features/quick-find/quick-find-actions.ts
  - apps/csrm/src/features/quick-find/quick-find-dialog.test.tsx
  - apps/csrm/src/features/quick-find/quick-find-domain.ts
  - apps/csrm/src/features/reports/figure-link-audit.test.ts
  - apps/csrm/src/features/request-assignment/assign-picker.test.tsx
  - apps/csrm/src/features/request-assignment/assign-picker.tsx
  - apps/csrm/src/features/request-assignment/assignment-actions.test.ts
  - apps/csrm/src/features/request-assignment/assignment-actions.ts
  - apps/csrm/src/features/request-assignment/assignment-block.test.tsx
  - apps/csrm/src/features/request-assignment/assignment-block.tsx
  - apps/csrm/src/features/request-assignment/assignment-domain.test.ts
  - apps/csrm/src/features/request-assignment/assignment-domain.ts
  - apps/csrm/src/features/request-assignment/assignment-history.test.tsx
  - apps/csrm/src/features/request-assignment/assignment-history.tsx
  - apps/csrm/src/features/request-assignment/assignment-schema.ts
  - apps/csrm/src/features/request-assignment/assignment-service.test.ts
  - apps/csrm/src/features/request-assignment/assignment-service.ts
  - apps/csrm/src/features/request-assignment/queue-pick-up-button.test.tsx
  - apps/csrm/src/features/request-assignment/queue-pick-up-button.tsx
  - apps/csrm/src/features/request-notes/note-ai-input-switch.test.tsx
  - apps/csrm/src/features/request-notes/note-ai-input-switch.tsx
  - apps/csrm/src/features/request-notes/note-composer.test.tsx
  - apps/csrm/src/features/request-notes/note-composer.tsx
  - apps/csrm/src/features/request-notes/note-item.test.tsx
  - apps/csrm/src/features/request-notes/note-item.tsx
  - apps/csrm/src/features/request-notes/notes-actions.test.ts
  - apps/csrm/src/features/request-notes/notes-actions.ts
  - apps/csrm/src/features/request-notes/notes-domain.test.ts
  - apps/csrm/src/features/request-notes/notes-domain.ts
  - apps/csrm/src/features/request-notes/notes-schema.ts
  - apps/csrm/src/features/request-notes/notes-section.test.tsx
  - apps/csrm/src/features/request-notes/notes-section.tsx
  - apps/csrm/src/features/request-notes/notes-service.test.ts
  - apps/csrm/src/features/request-notes/notes-service.ts
  - apps/csrm/src/features/request-notes/notes-skeleton.tsx
  - apps/csrm/src/features/request-notes/notes-thread.test.tsx
  - apps/csrm/src/features/request-notes/notes-thread.tsx
  - apps/csrm/src/features/request-notes/unread-marker.test.tsx
  - apps/csrm/src/features/request-notes/unread-marker.tsx
  - apps/csrm/src/features/request-notes/unsent-note-well.test.tsx
  - apps/csrm/src/features/request-notes/unsent-note-well.tsx
  - apps/csrm/src/features/requests/request-domain.ts
  - apps/csrm/src/features/requests/request-hub.test.tsx
  - apps/csrm/src/features/requests/request-hub.tsx
  - apps/csrm/src/features/requests/request-routes.test.tsx
  - apps/csrm/src/features/requests/request-schema.ts
  - apps/csrm/src/features/requests/request-service.test.ts
  - apps/csrm/src/features/requests/request-service.ts
  - apps/csrm/src/features/requests/request-summary-schema.ts
  - apps/csrm/src/features/requests/request-table.test.tsx
  - apps/csrm/src/features/requests/request-table.tsx
  - apps/csrm/src/lib/api/conflict-reasons.test.ts
  - apps/csrm/src/lib/api/conflict-reasons.ts
  - apps/csrm/src/lib/api/generated/schema.d.ts
  - apps/csrm/src/lib/api/refusal-copy.test.ts
  - apps/csrm/src/lib/api/refusal-copy.ts
  - apps/csrm/src/lib/api/transport/server-client.test.ts
  - apps/csrm/src/lib/api/transport/server-client.ts
  - apps/csrm/src/lib/auth/development-session-adapter.test.ts
  - apps/csrm/src/lib/auth/development-session-adapter.ts
  - apps/csrm/src/lib/auth/session-adapter.ts
  - apps/csrm/src/lib/auth/sign-in-page.test.tsx
  - apps/csrm/src/lib/capabilities/capability-adapter.test.ts
  - apps/csrm/src/lib/capabilities/development-capabilities.ts
  - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
  - apps/csrm/src/lib/performance/zod-client-boundary.test.ts
  - apps/csrm/src/lib/session-drafts/draft-owner-key.test.ts
  - apps/csrm/src/lib/session-drafts/draft-owner-key.ts
  - apps/csrm/src/lib/session-drafts/session-drafts.test.ts
  - apps/csrm/src/lib/session-drafts/session-drafts.ts
  - apps/csrm/src/lib/testing/e2e-ui-state-route-authorization.test.tsx
  - docs/contract-gaps/phase-13-request-assignment.md
  - docs/contract-gaps/phase-13-request-notes.md
  - docs/design/csrm-design-direction.md
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/served-operations.json
  - docs/references/specification.json
  - docs/security/phase-08-residual-risks.md
findings:
  critical: 0
  warning: 28
  info: 32
  total: 60
status: issues_found
---
# Phase 13: Code Review

## Summary

Phase 13 is reviewed from `ab000f6` (`PHASE_13_BASE`, the fresh plan check's commit, the last commit before any Phase 13 code) to `b744ffb`. The scope is every file the range added, modified or renamed outside `.planning/` (`git diff --name-only --diff-filter=AMR ab000f6..HEAD -- . ':(exclude).planning'`): 248 files.

Following the Phase 10 rule for reviews over 50 files (STATE.md Decisions), six `gsd-code-reviewer` lanes reviewed the whole scope in parallel. Every lane worked at standard depth, diffed from `ab000f6`, read-only, and wrote its own report.
- **Intended behaviour:** every lane read Phase 13's CONTEXT.md, its UI-SPEC.md and the two approved contract-gap records (`docs/contract-gaps/phase-13-request-assignment.md` and `docs/contract-gaps/phase-13-request-notes.md`).
- **Common focus:** record-level authorisation, separation of duties, the notes reader rule (404 for everyone else), the request lock and compare-and-set, append-only logs, the AI context and data policy, people projection (`documentId` and `displayName` only), the G-4 premium bar and accessibility, and the AGENTS.md rules.
- **Large files:** the contract and data files were reviewed by their Phase 13 diff only.
- **No operator pass** this time.
- **Read-only throughout:** the pilot's browser walk ran in parallel against the dev servers, so no lane ran a test suite, a `tsc` build, Playwright or a server.
- **Lane split:** the six lanes follow the pilot's partition. One adjustment keeps every lane within about 55 files: the 12 unit tests of the shell, navigation, auth and capability modules went to Lane 4 with their source, so Lane 5 holds the other 54 web unit tests and the AI-assistance test fixtures.

This file keeps each lane report verbatim, one after another. Each report's title line is replaced by a level-two heading naming its lane, its other headings move down one level, and its frontmatter is merged into the frontmatter above. Finding IDs keep each lane's hundreds (1xx to 6xx).

| Source | Files | Critical | Warning | Info | Total |
|---|---|---|---|---|---|
| Lane 1 (1xx): Strapi source, types, config, package.json, docs and CONTEXT.md | 54 | 0 | 3 | 3 | 6 |
| Lane 2 (2xx): Strapi tests, fixtures and harness | 34 | 0 | 6 | 5 | 11 |
| Lane 3 (3xx): web source: requests, assignment, notes, jobs and the AI-inputs signal | 44 | 0 | 6 | 8 | 14 |
| Lane 4 (4xx): web source: shell, navigation, lists, Homes, quick find, lib and components | 49 | 0 | 1 | 5 | 6 |
| Lane 5 (5xx): web unit tests | 55 | 0 | 5 | 6 | 11 |
| Lane 6 (6xx): Playwright specs, helpers and playwright.config.ts | 12 | 0 | 7 | 5 | 12 |
| All | 248 | 0 | 28 | 32 | 60 |

The counts are per source and are not deduplicated: a finding that repeats or extends another still counts in its own lane, and the "Overlaps" list below names each one. Lane severities are reviewer claims until they are adjudicated. The dispositions, the pilot's rulings and the stage B fixes go in `13-REVIEW-DISPOSITION.md`.

## Overlaps

**The same defect reported by two lanes** (fix once; disposition both IDs)

- WR-303 (Lane 3) and WR-502 (Lane 5): when a post fails, the composer puts back the failed text and overwrites anything typed while the note was pending (`note-composer.tsx:136-158`). The session store and the field then disagree. Lane 5 adds that no test covers it.

**Related findings** (one fix may close several; disposition each ID)

- **Eligibility of a dual-role user.** WR-101 (Lane 1), IN-204 (Lane 2) and WR-604 (Lane 6) concern a user who holds both the human Security Analyst role and the Security Analyst Agent role.
  - WR-101: the server never checks the acting analyst against `isEligibleAssignee`.
  - IN-204: no harness user holds both roles end to end.
  - WR-604: the picker's exclusions are never observed in a browser.
- **Note links from the signal and the run sheet.** WR-305 (Lane 3) and WR-607 (Lane 6) both concern `#note-` links.
  - WR-305: a link to a note older than the newest 20 loaded goes nowhere.
  - WR-607: the run sheet's Notes group and its close-then-navigate link are never opened in a browser.
- **The thread's page size.** IN-305 (Lane 3) and IN-205 (Lane 2).
  - IN-305: loading earlier notes relies on Strapi's default page size, not the page's own 20.
  - IN-205: that default is never asserted.
- **Focus after actions.** WR-501 (Lane 5) and WR-605 (Lane 6).
  - WR-501: several unit focus assertions after Undo and after posting cannot fail.
  - WR-605: no browser test exercises the G-4 keyboard and focus paths.
  - IN-501 (Lane 5) is the picker's case: focus is not returned to the trigger after assigning.
- **Unsent text and the leave warnings.** WR-401 and IN-402 (Lane 4), and IN-303 and IN-304 (Lane 3).
  - WR-401: sign-out deletes the kept text before any prompt.
  - IN-402: drafts survive identity changes other than Sign out.
  - IN-303: the warning is off while a note is posting.
  - IN-304: the unsent-note well does not arm the warning.
- **Notes refusal copy for invalid input.** IN-401 (Lane 4) and IN-505 (Lane 5).
  - IN-401: a server 400 reads as the 403 sentence.
  - IN-505: invalid-input refusals say "Try again" while their kind is blocked.
- **Who may see the AI-inputs signal, and unread consistency.**
  - WR-202 (Lane 2): the service agent's exclusion from the signal is unproven in tests.
  - IN-103 (Lane 1): the signal's reader silently drops a malformed marked note, against the fail-visible rule the record sets.
  - WR-103 (Lane 1): a note with no author link is unread on its row but missing from every count.
  - WR-206 (Lane 2): the queue oracle never discriminates the viewer's part for an analyst who raised the request.

## Phase 13: Code Review Report, Lane 1 (Strapi source, types, config, package.json, docs and CONTEXT.md)

**Reviewed:** 2026-10-09T06:57:52Z
**Depth:** standard (Phase 13 diff from `ab000f6`; the large contract, catalogue, generated-type and direction files by their Phase 13 diff only)
**Files Reviewed:** 54
**Status:** issues_found

### Summary

I read every Strapi file in this lane in full or by its Phase 13 diff, and traced the call chains a decision depends on. Those chains run through the policy, controller, service, lock and SQL, through the job registries and workflows, and through the context loader, builder, run record and signal. I checked them against 13-CONTEXT (D-01 to D-34 and the Orchestrator Confirmations), the two approved contract-gap records and the 13-UI-SPEC copy.

The record-level model holds where it matters. Every new route needs its exact FunctionAPI grant. The three human-only operations are refused a second time by `HUMAN_ANALYST_ONLY_OPERATIONS`. Notes are admitted by `canUseRequestNotes` alone, which returns one 404 before any other read or write. Every write runs inside `withRequestLock` and repeats its deciding reads after the lock. People cross the API as a documentId and a display name.

I found no Critical defect. The three Warnings are gaps between the code and its own contract:

1. The acting analyst's eligibility (not the Security Analyst Agent) is never checked.
2. The AI-input mark set at posting is authorised by the notes grant, not by the AI-input grant.
3. A note whose author link is gone is flagged unread on its own row but left out of every unread count.

The three Info items cover a released-request no-op that answers 409, a catalogue design note that does not record two of the three new Functions, and a signal reader that drops a malformed marked note without showing it.

**Checked and found correct:**
- **Policy.** `humanAnalyst` and `viewerId` are set from the resolved IdamBox User's grants (`csrm-authorization.ts:336-341`), never from the query or the auth mode. The assignment PUT, the eligible-list GET and the AI-input PUT are in `HUMAN_ANALYST_ONLY_OPERATIONS` (`:76-78`) and have their own denial copy. Both catalogue copies are byte-identical (`cmp`). The Agent role holds none of the three new Functions; `role.requestor` holds `notes_api` only.
- **Notes reader rule.** All four notes routes `admit` through `canUseRequestNotes` before parsing the query or body, so a non-reader gets the 404, never a 400. A missing request, another Requestor, the Agent on another person's request and a note on another request all get the same `NOTES_NOT_FOUND` 404. Inside the lock, `lockedRequest` asks the same question again. No participant read reaches notes: `summarizeRequestNotes` returns null for anyone the rule refuses.
- **Lock.** There is one tail map. `SELECT id … FOR UPDATE` on the request row runs first, then every deciding read inside `work` goes through the Document Service, so it joins the transaction through ALS. Nothing is nested. The delete override counts notes and deletes inside one lock call. Revert, assignment, create, mark-read and AI-input all use the same module. No `withRequestLock` runs inside a CR-101 or `lockAssessmentRequest` transaction.
- **Compare-and-set and history.** The refusal order is: OWN_REQUEST first, then REQUEST_NOT_SUBMITTED, ASSIGNMENT_CHANGED (on `expectedAnalyst`), ASSIGNEE_NOT_ELIGIBLE, ASSIGNMENT_REQUIRED, a no-op, and HISTORY_UNAVAILABLE at the 1,000-event cap. The four facts and one event are written in one update.
- **Log parsers.** Both parsers are closed and versioned, take an exact key set, and check that the action agrees with its from and to (the assignment log) or that from and to differ (the AI-input log). The assignment history fails safe to `history: null`. No authorisation decision reads either log; the gates read `assignedAnalyst` and `changesAiInputs` only.
- **`assertAssignedAnalyst`.** It holds only for the current assignee, read from that user's own record, who is still `isEligibleAssignee` and reached the operation through the human grant. The refusals are 409 REQUEST_UNASSIGNED and 403 NOT_ASSIGNED_ANALYST. `isEligiblePerson` fails closed on missing status or roles and excludes the Agent role.
- **Notes rules.** Note sequence and the 500-note cap are read after the lock. There is one read-state row per reader, and it only moves forward. A Requestor's create that carries the mark gets 400. A requesting analyst gets OWN_REQUEST on create and on the PUT. `NOTES_CLOSED` uses `acceptsNotes`, which is `REVIEWABLE_REQUEST_STATUSES`. A note with no mark change writes no event, and the AI-input log cap is 200. No GET writes anything.
- **Unread SQL.** `VIEWER_PART_SQL` and `LAST_READ_SEQUENCE_SQL` match `authorPartFor` and `readStateOf` (first row by id). Identifiers are constants and values are bound. The page's grouped count, the queue's `notes=unread` filter, the My requests filter and count, and the dashboard figures all compose one `whereNoteUnreadFor`.
- **Queue and dashboard SQL.** `open` reads exactly the reviewable statuses and matches `selectReviewQueueBucket`. `assignee=me` and `assignee=unassigned` use EXISTS and NOT EXISTS on the `assigned_analyst_lnk` table. The dashboard's per-viewer counts reuse `countReviewQueueBucket` with the policy's viewer, which is refused when absent.
- **AI context.** Only notes with `changesAiInputs: true` are read. More than 50 marked notes fails before any run is created or a provider is called; the message names the notes by sequence and stays within 255 characters. Each note body is its own escaped `note.body` value inside `<requestorData>`, with no name, time or id. The v2 summary holds no note text, and the closed parser accepts v1 (read as having included no notes) and v2 within 64 KB.
- **AI-inputs signal.** It is computed in both directions against the target's own run, and only for a completed, context-wide run on the same request. The `generatedDate` fallback fails visible. It is served to human analysts only, on the request read and in both `generation` blocks.
- **People and populate.** `filterRequestReadPopulate` drops `*`, dotted paths, nested populate and every user relation. `revertedBy` and the assignment people are projected as documentId and display name. The Requestor gets `{ assignee: { displayName } }` only. The new request attributes are `private`.
- **Generation jobs (D-18).** `canReadAll…` comes from the policy's `humanAnalyst` fact. `canRetry` is the registries' `mayRetry`. A retry is re-attributed to whoever retries.
- **D-20 and the holder sentences.** D-20 refuses an analyst's submit of another person's draft with 403 NOT_REQUEST_REQUESTOR. The holder sentences match UI-SPEC §12.1 word for word. The second analyst persona is seeded only behind `IDAMBOX_SEED_CSRM` and the development identity.

### Warnings

#### WR-101: The acting analyst is never checked against the eligibility predicate (the Agent role is not excluded)

**File:** `apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts:214-240` and `:290-310`. Related: `apps/backend/src/policies/csrm-authorization.ts:331-334`, `apps/backend/src/api/csrm-request-note/services/request-notes.ts:441-443`.

**Issue:** D-05 says "any **eligible** human Security Analyst may take any of the four actions", and D-06 defines "eligible" to include not holding the Security Analyst Agent role (G-1: a service identity takes no part in assignment). The code checks a narrower condition:

- `changeRequestAssignee` checks only that the actor did not raise the request (OWN_REQUEST).
- The policy checks only `hasHumanAnalystOperation`, which is true for any user who holds the operation through a role named "Security Analyst", even when the same user also holds "Security Analyst Agent".

So an identity that holds both roles can assign another analyst, reassign or unassign any request, and read the eligible list. Its own pick-up is refused only because the target-eligibility check happens to run on itself. The AI-input PUT has the same gap.

The UI also follows the narrower rule: `allowedAssignmentActions` (`request-assignment-policy.ts:73-85`) offers `assign-to-me` to such a viewer, and the server then refuses it with ASSIGNEE_NOT_ELIGIBLE. This needs a misconfigured identity, but G-1's guarantee is meant to hold whatever the role assignment.

**Fix:** decide the actor with the same shared predicate, inside the lock, before any other check:
```ts
// request-assignment.ts, inside withRequestLock, before the OWN_REQUEST check
const actorUser = await loadEligibilityUser(input.strapi, actor);
if (!isEligiblePerson(actorUser)) {
  throw new AssignmentError("CSRM request assignment requires a human Security Analyst.", 403);
}
```
Do the same in `listAssignableAnalysts` and `setNoteAiInput`. The simpler alternative is for the policy to set `humanAnalyst` only when `!roles.some(r => r.name === SECURITY_ANALYST_AGENT_ROLE_NAME)`. Then thread an `eligibleActor` flag into `allowedAssignmentActions`, so the UI never offers what the server refuses.

#### WR-102: The AI-input mark at posting is authorised by the notes grant, so the mark's "held twice" guard does not apply there

**File:** `apps/backend/src/api/csrm-request-note/services/request-notes.ts:316-320`, `:328-338` and `:261`. Related: `apps/backend/src/policies/csrm-authorization.ts:337-341`.

**Issue:** D-26 and D-30 say only a human Security Analyst may set the mark, and that this is enforced twice: by `note_ai_input_api` (granted to `role.security_analyst` only) and by `HUMAN_ANALYST_ONLY_OPERATIONS`. That holds for `PUT …/ai_input`. It does not hold for the mark set at posting:

- `addRequestNote` accepts `changesAiInputs: true` from anyone who passes the `notes_api` create grant. `caller.humanAnalyst` is the policy's fact for the create operation (`hasHumanAnalystOperation(roles, "POST:…/notes")`), not for the mark operation.
- `meta.canMarkAiInputs` in the list response is derived from the list operation in the same way.

The two grants agree today only because the catalogue gives both Functions to the same role. A later catalogue change to one (for example a role given `notes_api` without `note_ai_input_api`, or Phase 22's role review) would silently let that role decide which free text reaches the AI provider. That is exactly the drift the "held twice" rule exists to stop.

**Fix:** have the policy record the mark grant as its own fact on the notes routes, and require it wherever the mark is set or offered:
```ts
// csrm-authorization.ts, beside humanAnalyst
canMarkNoteAiInputs: hasHumanAnalystOperation(grants.explicitRoles, CSRM_REQUEST_NOTE_OPERATIONS.setAiInput),

// request-notes.ts addRequestNote, after the requestor-part check
if (create.changesAiInputs === true && caller.canMarkNoteAiInputs !== true) {
  throw new RequestNotesError("CSRM request note AI-input mark is denied.", 403);
}
// listRequestNotes meta
canMarkAiInputs: caller.canMarkNoteAiInputs === true && viewer.part === "security-analyst" && accepting,
```
Add a matrix or integration case: a caller holding `notes_api` without `note_ai_input_api` who posts with the mark gets 403, and nothing is written.

#### WR-103: A note whose author link is gone shows "New" on its own row but is never counted as unread

**File:** `apps/backend/src/api/csrm-request-note/services/request-notes.ts:155` and `:173-182`. Related: `apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts:185-196`.

**Issue:** The contract says one unread rule feeds every count. The three implementations treat a note with no `author` link differently (for example after the IdamBox User is removed: there is no inverse attribute, so the link row goes and the note stays):

- **The per-note flag** (`projectNote`): `isUnreadNote` compares `author?.documentId ?? null` with the viewer's documentId. `null !== viewer` is true, so the note is unread.
- **`countUnread`:** the Document Service filter `author: { documentId: { $ne: … } }` goes through a relation join, so a NULL author fails the comparison and the note is not counted.
- **The SQL rule** `whereNoteUnreadFor` needs `EXISTS (… na.idambox_user_id <> ?)`, so with no link row the note is not counted.

So the thread shows a "New" marker while `meta.unread`, the request read's `notes.unread`, the queue's `unreadNotes`, `notes=unread`, My requests, the status summary and the dashboard all report 0 for it. The Requestor's Home "New notes" row and the queue flag then never appear for a note the thread itself calls new.

**Fix:** make the three agree. The safest choice keeps such a note unread, because its author is by definition not the viewer:
```ts
// review-queue-repository.ts whereNoteUnreadFor
.whereNotExists((author) => {
  author.from("csrm_request_notes_author_lnk as na")
    .whereRaw("na.csrm_request_note_id = n.id")
    .where("na.idambox_user_id", viewer.id)
    .select("na.id");
})
// request-notes.ts countUnread
$not: { author: { documentId: { $eq: viewer.documentId } } },
```
Alternatively, make `projectNote` treat a null author as read. Either way, add a unit test that removes the author link.

### Info

#### IN-101: Unassigning an already-unassigned released request answers 409 instead of the contract's no-op

**File:** `apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts:232-241`

**Issue:** For a request released before Phase 13 (no assignee), the body `{ analyst: null, expectedAnalyst: null }` changes nothing (`deriveAssignmentAction` returns null). It still reaches `requiresAssignee` and is refused with 409 ASSIGNMENT_REQUIRED. The record says "A change that names the current assignee is a no-op that succeeds and writes no event". This is harmless today, because the UI offers no Unassign there, but the answer contradicts the published no-op rule.

**Fix:** check the no-op before the release rule: `else if (current !== null && requiresAssignee(request.requestStatus))`.

#### IN-102: The catalogue design note for Phase 13 does not record the eligible-list read or `note_ai_input_api`

**File:** `docs/references/idambox-csrm-role-function-api-catalogue.json:26`. The same line is at `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json:26`.

**Issue:** D-30 asks that "a catalogue design note records the new Functions". The Phase 13 note names only `PUT …/assignee` through `assignment_api`. Note 6's amendment covers `notes_api`. No note mentions `GET …/assignable_analysts`, or `function.risk_assessment_requests.note_ai_input_api` and its place in the human-only set.

**Fix:** in both copies, byte-identical, extend the Phase 13 note with one sentence covering the eligible-list read under `assignment_api`, and `note_ai_input_api`: `role.security_analyst` only, in `HUMAN_ANALYST_ONLY_OPERATIONS`, never the Agent.

#### IN-103: The signal's marked-note reader silently drops a malformed row, against the fail-visible rule

**File:** `apps/backend/src/csrm/ai/ai-inputs-signal.ts:167-173`

**Issue:** `loadMarkedNotes` returns `[]` for a marked row whose `postedAt`, `sequence` or `documentId` cannot be read, so that note never appears in the signal. The module's own rule, and the contract's 2026-10-09 decision, is to fail visible: missing a changed input is the riskier failure. The context loader takes the opposite approach and throws on the same row (`assessment-context-loader.ts:58-62`), so the provider and the signal can disagree about such a note.

**Fix:** keep the row and fill its identity fields as best it can. For example, use `postedAt: row.postedAt ? … : ""` and keep the sequence, so the note still counts as changed. Alternatively, throw the same error the loader throws.

---

_Reviewed: 2026-10-09T06:57:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Phase 13: Code Review Report, Lane 2 (Strapi tests, fixtures and harness)

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

### Summary

I reviewed the 34 Strapi test, fixture and harness files in this lane against their Phase 13 diff (`ab000f6..HEAD`). Where a test's validity depended on the source it exercises, I read that source too: `request-lock.ts`, `request-notes.ts`, `request-notes-policy.ts`, `request-assignment.ts`, `request-assignment-policy.ts`, `assignment-log.ts`, `review-queue-repository.ts`, `ai-inputs-signal.ts`, both deterministic providers, and the questionnaire and assessment controllers' signal gating.

Overall, the suite is strong. Every notes route and every assignment route has negative cases for another Requestor and the service agent. All but the eligible-analyst read check persistence deep-equal. The queue's semantic oracle is independent of the queue SQL (Document Service assignee, `summarizeRequestNotes` unread), and the signal's Requestor exclusion is proven against a real baseline.

I found no defect that lets an unauthorised caller through. The findings are proofs that cannot fail, or that pass for the wrong reason:

- **The concurrency proofs (WR-201) do not prove the lock.** On SQLite, knex's single connection serialises every transaction. `simultaneousRequests` is a plain `Promise.all`. No Phase 13 test uses the harness's `recordRowLocks` or `interleaveInTransactionWindow`. So the race tests pass with the in-process tail removed, with `FOR UPDATE` removed, or with two lock modules.
- **The signal's service-agent exclusion is proven by a row that is silently skipped (WR-202).** The surfaces the agent can actually reach (the questionnaire and assessment reads) are untested.
- **One authorisation matrix row (WR-203) cannot fail for its negative actors.**
- **The request-scoped persistence snapshots (WR-204) cannot see a write that lands outside the named request.**
- **The two log-cap tests (WR-205) cannot tell "at the cap" from "fixture malformed".**
- **The queue oracle's fixture mix (WR-206) never discriminates the viewer's part for an analyst who raised the request.**

**Checked and found correct:**

- **Notes reader rule (D-23):** another Requestor and the service agent get 404 on list, create and mark-read for Jane's request, with a real note id. Notes and read states are deep-equal before and after. A missing request returns the same 404 message as a refused one. A participant-shaped Requestor-only user is refused the same way.
- **AI-input mark (D-26, D-30):** Jane, the other Requestor and the service agent get 403 (by grant) with persistence checked. A requesting analyst gets `OWN_REQUEST` on both their own note and a colleague's note. A Requestor's create that carries the mark gets 400 (both `true` and `false`). The mark is `NOTES_CLOSED` in every closed window, and `HISTORY_UNAVAILABLE` on a full or unreadable log. A same-value change is a no-op that writes nothing.
- **Assignment (D-05 to D-08):** the full refusal table is covered: `OWN_REQUEST` for all four actions and before the compare-and-set, `ASSIGNEE_NOT_ELIGIBLE` for each disallowed target, `REQUEST_NOT_SUBMITTED`, `ASSIGNMENT_CHANGED`, `ASSIGNMENT_REQUIRED`, 400 for malformed bodies, the cap, and grant refusals for Jane, the other Requestor, the service agent and an inactive analyst. Each has a persistence snapshot over the request and its assignment facts.
- **Eligible-analyst read (D-06):** the list is exact (`[bob, second]`), names no excluded person, offers no email or subject, refuses `OWN_REQUEST`, and keeps Bob out of the list on his own request.
- **People projection (D-04, T-13-10):**
  - `populate=*`, `populate=requestor` and nested populates return no email, username or subject.
  - `revertedBy` is projected on both the revert response and the request read.
  - The Requestor sees the assignee's display name alone.
  - The queue and My requests serve no `@`.
- **Queue and dashboard (D-13 to D-15):**
  - The 72-combination oracle sweep covers the queue against an independent oracle, with non-degeneracy checks.
  - `open` and `released` partition All requests.
  - A forged viewer id or assignee name gets 400.
  - The dashboard's `mine` and `unassigned` counts are checked as literals and against their lists, and are shown to be personal.
- **D-18 job widening:** a colleague reads and retries a failed job, and the retry is credited to the retrier in the job record, `generatedBy` and the run's `initiatedBy`. The Requestor and the service agent are refused the read and the retry. A held job is not retryable.
- **D-27 and D-28 (AI context and run record):**
  - Only marked notes reach the prompt, escaped and in sequence inside the one `requestorData` block.
  - Hostile note text cannot close or open a tag.
  - 51 marked notes, or an over-budget note, give `CONTEXT_TOO_LARGE` before any run or provider call.
  - The v2 run summary names notes without their text, and v1 reads as "included none".
  - The closed parser refuses `body`, unknown keys and a section past its bound.
- **D-29 (AI inputs signal):** the run baseline, the `generatedDate` fallback, the fail-visible cases and the risk-scoped non-baseline are covered. The Requestor's request and questionnaire reads carry no signal when a baseline exists.
- **D-21 delete guard:** `REQUEST_HAS_NOTES` deletes nothing. The orphan count is SQL-wide and catches a cascaded link as well as a dangling one.
- **D-20:** an analyst submitting another person's draft gets 403 `NOT_REQUEST_REQUESTOR` with persistence unchanged.
- **D-31:** the second-analyst seed is gated by every environment variable and is idempotent with exactly one role.
- **Catalogue (D-30):** both copies are byte-identical. All three Functions are granted both ways, never to the agent. `HUMAN_ANALYST_ONLY_OPERATIONS` gains exactly three operations.

### Warnings

#### WR-201: Concurrency "race" tests cannot fail if the request lock is removed, split or bypassed

**File:**
- `apps/backend/tests/request-notes.integration.test.ts:296-303` (one read-state row), `:312-322` (sequences 1 and 2), `:546-556` (two analysts marking at once), `:626-645` (delete against create)
- `apps/backend/tests/request-assignment.integration.test.ts:317-330` (compare-and-set race)
- `apps/backend/tests/request-workflow.integration.test.ts:332-364` (shared lock)
- `apps/backend/tests/helpers/strapi-http-harness.ts:1422-1431` (`simultaneousRequests`)

**Issue:** `simultaneousRequests` is `Promise.all(fetch…)`, with no hook that forces two handlers into the same window. The tests run on SQLite. There, knex's pool holds one connection, and `request-lock.ts:12-14` itself says "Strapi's single connection serialises every transaction". Once each handler's deciding reads are inside a `strapi.db.transaction`, the second request cannot run a statement until the first commits, whether or not the in-process tail or `FOR UPDATE` exists.

So these tests stay green under each of these regressions:

- the `requestTails` tail is deleted;
- the `forUpdate()` call is deleted;
- a second tail map is introduced for one path, which the module header forbids ("ONE tail map");
- for the delete race, the delete is moved outside `withRequestLock`, as long as it stays inside some transaction.

The shared-lock test (`request-workflow.integration.test.ts:332`) is titled "both complete under the one request lock". It only proves the absence of a deadlock, not that both paths share the lock.

The only regression these tests can catch is a deciding read moved fully outside any transaction. Even that depends on the HTTP requests happening to interleave before the first transaction takes the connection, which is nondeterministic. The contract gaps record "PostgreSQL's row lock stays unproven", but none of the lock protocol that is provable on SQLite is proven either. The harness already has the tool to prove it: `recordRowLocks` (`strapi-http-harness.ts:513-514`, `:781-824`), which Phase 12 uses.

**Fix:** For each Phase 13 writer (`PUT …/assignee`, `POST …/notes`, `POST …/notes/read`, `PUT …/notes/{noteId}/ai_input`, the request `DELETE` and the revert), wrap one call in `recordRowLocks` and assert three things:

- exactly one lock is recorded;
- it is on the request row: `{ uid: "api::csrm-assessment-request.csrm-assessment-request", documentId: requestId }`;
- it is taken in the same transaction as the writes, and is that transaction's first lock.

Also add a unit test of `withRequestLock` with a fake `strapi.db`, proving all of the following:

- a second call's `work` does not start until the first call's promise settles;
- the tail entry is removed afterwards;
- a rejected `work` releases the tail.

For example:

```ts
const { locks } = await harness.recordRowLocks(() => harness.request({ path: assigneePath(id), identity: analyst, init: assigneeChange({ analyst: bob, expectedAnalyst: null }) }));
assert.deepEqual(locks.map(({ uid, documentId }) => [uid, documentId]), [["api::csrm-assessment-request.csrm-assessment-request", id]]);
```

Then retitle the HTTP races as end-to-end smoke checks, not lock proofs.

#### WR-202: The "human Security Analysts only" proof of the AI-inputs signal silently skips the agent rows, and the agent's reachable surfaces are untested

**File:**
- `apps/backend/tests/request-notes.integration.test.ts:664-670`
- `apps/backend/tests/questionnaire-workflow.integration.test.ts` (the D-29 test at the new block's start)
- `apps/backend/tests/assessment-workflow.integration.test.ts` (the final D-29 test)

**Issue:** The loop over `JANE`, `AGENT` and `SERVICE_AGENT` does `if (response.status !== 200) continue;`. The matrix gives the service agent and the Requestor-only "agent" 403 on Jane's request read (`OWNER_REQUEST_AGENT_DENIED_403`, `fixtures/authorization-matrix.ts:709-713`). So two of the three rows the comment claims ("the Requestor and the Security Analyst Agent included, gets null") never assert anything. The test also passes if Jane is wrongly refused.

More importantly, the service agent does reach the analyst questionnaire read (`GET /api/v1/questionnaires/{id}` is `serviceAgent: 200`, `fixtures/authorization-matrix.ts:905-913`). The assessment read serves the agent as `actor === "analyst"` too. Both readers gate the signal on `humanAnalyst` (`csrm-questionnaire/controllers/*.ts:178`, `csrm-assessment/controllers/csrm-assessment.ts:242`). No test reads either surface as the service agent while a baseline exists and a note is marked.

The brief's rule is "the 'AI inputs changed' signal per target, analysts only". As things stand, a regression that drops the `humanAnalyst` gate (for example, gating on `actor === "analyst"` only) would ship green.

**Fix:**
- Replace the `continue` with an explicit expected status per identity: Jane 200 with `aiInputs: null`, and the two agent identities 403.
- In the questionnaire-workflow D-29 test, after `marked` is listed for Bob, read `questionnairePath` as `harness.identities.serviceAnalystAgent`. Assert status 200, `generation.aiInputsChanged === null`, and that the text does not contain the note's documentId.
- Do the same on the assessment read in the assessment-workflow D-29 test.

#### WR-203: The matrix row for mark-read cannot fail for its negative actors

**File:** `apps/backend/tests/fixtures/authorization-matrix.ts:812-825`

**Issue:** The row sends `{ throughNoteId: "matrix-note" }`, and no such note exists. In `markRequestNotesRead` (`request-notes.ts:372-378`), a caller who passes `canUseRequestNotes` but names a missing note also gets 404 with nothing written. If the reader rule were broken and admitted the other Requestor or the service agent, this row would still see 404 with persistence unchanged.

The row is the six-actor matrix's proof for the route. Its 404 expectation for `other` and `serviceAgent` is unfalsifiable. Only the separate integration test (`request-notes.integration.test.ts:149-178`, which uses a real note id) actually proves it, and the matrix lists that test as `seeAlso`, which is "traceability only" by the matrix's own definition (`authorization-matrix.ts:24-25`, `:148`).

The `ai_input` row uses the same fake id. It is falsifiable only because its refusals are 403 grant refusals, which come before the note lookup.

**Fix:** Seed one note on `f.workflow.requests.submitted` in the matrix fixtures, and use its documentId in the mark-read and `ai_input` rows. The negative 404 then depends on `canUseRequestNotes` alone. Alternatively, use the owner as the falsifiability witness: assert that the owner on this row gets the "note not found" 404 while `other` gets the reader-rule 404, distinguished by a seeded real note.

#### WR-204: Request-scoped persistence snapshots cannot detect a refused write that lands on another request or on none

**File:**
- `apps/backend/tests/request-notes.integration.test.ts:59-62` (`persisted`), `:171-177` (missing-request cases)
- `apps/backend/tests/fixtures/authorization-matrix.ts:264-267` (`requestNotesPersistence`)
- `apps/backend/tests/helpers/strapi-http-harness.ts:1712-1740`

**Issue:** `listRequestNotes(requestId)` and `listRequestNoteReadStates(requestId)` filter by `assessmentRequest.documentId`. A defective refusal that writes the note before deciding, or that writes it with no request link, produces a row these snapshots cannot see. The same holds for a write against another request. For example, `addNote("no-such-request", …)` at line 175 is checked for status only. A note created with a dangling or missing link there would pass.

`countOrphanedRequestNotes`, the helper that would catch it, is called only in the two delete tests (`:623`, `:644`). The "persistence deep-equal" guarantee for every notes refusal is therefore weaker than it reads.

**Fix:**
- Add whole-table counts to every notes refusal snapshot: notes, read states, and orphaned notes (`SELECT COUNT(*) FROM csrm_request_notes`, `csrm_request_note_read_states`, and `harness.countOrphanedRequestNotes()`).
- Assert after the missing-request loop that the orphan count is still 0. For example:

```ts
async function persisted(requestId: string) {
  return harness.snapshot([() => harness.listRequestNotes(requestId), () => harness.listRequestNoteReadStates(requestId), () => harness.countOrphanedRequestNotes(), () => harness.countRequestNoteRows()]);
}
```

#### WR-205: The log-cap tests cannot tell "at the cap" from "the fixture is malformed"

**File:**
- `apps/backend/tests/request-assignment.integration.test.ts:296-315` (`LOG_AT_CAP`)
- `apps/backend/tests/request-notes.integration.test.ts:527-544` (`LOG_FULL`)

**Issue:** Both services return the same refusal (`409 HISTORY_UNAVAILABLE`) for a log at its cap and for a log the closed parser rejects. In `assignment-log.ts:124-131`, `canAppendAssignmentEvent` returns `false` for both. On the notes side, `appendNoteAiInputEvent` throws `NoteAiInputLogError` for both.

Both fixtures are hand-built: 1,000 alternating reassign events, and 200 alternating mark events. I traced them and both are currently valid. But if a fixture drifted into invalidity, for example through a parser tightening on `by`, continuity or timestamps, the test would keep passing while no longer exercising the cap. Neither test reads the fixture back as valid, and neither has a below-cap control.

For the assignment log this is the only route-level proof of T-13-08's cap. `canAppendAssignmentEvent` itself has no unit test, and nothing proves that a change against a malformed assignment log is refused with nothing written.

**Fix:**
- Before the refusal, assert the fixture parses:
  - assignment: read the request as Bob and assert `assignment.history` has length 1,000, not `null`;
  - notes: `parseNoteAiInputLog(stored.aiInputLog).length === 200`.
- Add a control at one below the cap (999 or 199 events) where the same change succeeds and appends exactly one event.
- Add a malformed-log write case to the assignment test.
- Add unit cases for `canAppendAssignmentEvent`: `null`, 999, 1,000 and malformed.

#### WR-206: The queue oracle's fixture mix never discriminates the viewer's part for an analyst who raised the request

**File:** `apps/backend/tests/review-queue-buckets.integration.test.ts:712-716` (M10), `:596` (`bobs`)

**Issue:** The queue's unread SQL decides the viewer's part with `VIEWER_PART_SQL` (`review-queue-repository.ts:169-170`): `requestor` when the requestor link names the viewer, otherwise `security-analyst`. The only fixture where an analyst viewer raised the request is M10. It holds a single note, written by Bob in the requestor part.

For Bob, that note is excluded by the author rule (`na.idambox_user_id <> viewer`) whichever part the SQL computes. For the second analyst, the part is `security-analyst` either way. So the M10 rows read 0 and 1 under both the correct SQL and a regression that treats every human-analyst viewer as `security-analyst`. That regression is the exact G-1 case D-24 needs: Bob, on his own request, must see a colleague's analyst-part note as new. The first queue test's `bobs` request has no notes.

My requests exercises the requestor branch only for Requestor viewers. So the "notes=unread" and `unreadNotes` sweep (72 combinations) does not prove the queue for an analyst who raised the request.

**Fix:** In `buildMixFixtures`, add a second-analyst note to M10, which Bob has not read:

```ts
await addNote(m10, ids.secondAnalyst, "Picked up; one question on the vendor contract.");
```

The oracle (`summarizeRequestNotes`) then gives Bob `unread = 1` on M10, and a part regression in the SQL disagrees. Extend the non-degeneracy assertion `BOB_NEW_NOTES` to include `RQB-MIX-10`.

### Info

#### IN-201: The "deterministic output unchanged" guardrail assertions cannot fail

**File:** `apps/backend/tests/ai-provider-guardrails.unit.test.ts:173-178`

**Issue:** `deterministicAssessmentDraftProvider` and `deterministicQuestionnaireGenerationProvider` never read `context.userPrompt` or `records.notes`. They derive output from `records.request`, `records.answers`, `records.assets` and `context.allowed` (`deterministic-assessment-draft-provider.ts:19-127`, `deterministic-questionnaire-generation-provider.ts:13-16`). So `HOSTILE_NOTE_CHANGED_THE_DETERMINISTIC_DRAFT` and `…_QUESTIONNAIRE` hold however a note is escaped. The escaping proof in the preceding test and the captured OpenAI-compatible request are the real guardrail.

**Fix:** Drop these two assertions, or relabel them as "the providers ignore notes". Do not count them toward D-27's "guardrail tests extend to hostile note text".

#### IN-202: The participant unit test is a duplicate of OTHER_REQUESTOR plus a doc-comment grep

**File:** `apps/backend/tests/request-notes.unit.test.ts:68-74`

**Issue:** `canUseRequestNotes` reads no `participant` fact, so the `{ participant: true }` cast is identical to the `OTHER_REQUESTOR` case at line 61. The two `assert.match` calls only check that a source comment exists, which says nothing about behaviour. A comment edit breaks the test, while a behavioural widening that keeps the comment passes.

**Fix:** Keep the behavioural assertion. Replace the comment regexes with a structural guard, for example that `canUseRequestNotes` takes no participant parameter, or drop them.

#### IN-203: Missing edge cases on the assigned-analyst predicate and the change rules

**File:**
- `apps/backend/tests/request-assignment.unit.test.ts:186-212`
- `apps/backend/tests/request-assignment.integration.test.ts:239-252`

**Issue:** D-10 requires the assignee to be "still eligible … not the requestor". `assertAssignedAnalyst` has no case where the assignee is the request's requestor (`{ requestorDocumentId: "analyst", assigneeDocumentId: "analyst" }`). It is covered only indirectly through `isEligibleAssignee`.

At the route level, `ASSIGNMENT_REQUIRED` is proven for `approved` only. `closed` is covered only by `allowedAssignmentActions` and never at the route, although `requiresAssignee` decides it there.

**Fix:**
- Add the requestor-as-assignee case to the `NOT_ASSIGNED_ANALYST` table.
- Add a `seedRequest("closed")` unassign case expecting 409 `ASSIGNMENT_REQUIRED` with persistence unchanged.

#### IN-204: The eligible-analyst refusals check neither persistence nor reason, and no dual-role user is exercised end-to-end

**File:** `apps/backend/tests/request-assignment.integration.test.ts:425-431`, `:355-369`

**Issue:** The 403 grant refusals for Jane, the other Requestor, the service agent and the inactive analyst assert status and the absence of names only. They do not take a persistence snapshot, which the lane's every-route rule asks for. They also do not check that `details.reason` is absent, so a grant refusal mislabelled `OWN_REQUEST` would pass.

`listAssignableAnalysts` pre-filters candidates by `roles.name = "Security Analyst"` (`request-assignment.ts:311-321`), then applies `isEligibleAssignee`. The harness has no active user holding both the human and the agent role, or the human role without the analyst grant. So "the picker never offers a person the operation would refuse" is unit-proven only.

**Fix:**
- Wrap the refusals in the file's `persisted()` and assert `details?.reason === undefined`.
- Create a human-plus-agent user and a human-role-without-grant user with `createUserFixture`, and assert both are absent from the list and both get `ASSIGNEE_NOT_ELIGIBLE` at the PUT.

#### IN-205: The thread's default page size is never asserted

**File:** `apps/backend/tests/request-notes.integration.test.ts:263-273`

**Issue:** Every paged read passes `?limit=50`. `NOTES_PAGE_DEFAULT = 20` (`request-notes-policy.ts:13`) and the clamp in `listRequestNotes` (`request-notes.ts:241`) are never exercised. A change to the default, which the web's "load earlier" depends on, would go unnoticed.

**Fix:** On the 500-note request, assert that `listNotes(full, analyst)` with no query returns 20 notes (sequences 481 to 500) with `hasEarlier: true`.

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Phase 13: Code Review Report, Lane 3 (web source: requests, assignment, notes, jobs and the AI-inputs signal)

**Reviewed:** 2026-10-09
**Depth:** standard (diff base `ab000f6`)
**Files Reviewed:** 44
**Status:** issues_found

### Summary

I reviewed the web side of Phase 13 at standard depth: the analyst and Requestor request pages, the assignment block and picker, queue pick-up, the notes thread, composer, AI-input switch and unsent-text well, the job cards, the server-rendered AI-inputs signal slots, the run sheet's Notes group, the closed parsers, and the Server Actions and typed services behind them. I checked each against 13-CONTEXT (D-04 to D-29), 13-UI-SPEC (§5 to §13, §15) and the two approved contract-gap records. Where a behaviour depended on the server, I read the Strapi code.

I found no Critical issue. The authorisation posture holds. Every control is driven by a server-served fact: `actions`, `canPickUp`/`pickUp`, `accepting`/`closedReason` and `canMarkAiInputs`. Strapi computes `canMarkAiInputs` as `humanAnalyst && part === 'security-analyst' && accepting` (`request-notes.ts:261`), so the switch never appears where the server would refuse it. Server Actions call only the typed services. People cross every parser as `documentId` and `displayName` only, through strict schemas.

The six Warnings are robustness and "no lost input" (G-4) defects:
- The assignment controls do not survive a Server Action transport failure. A failure goes to the route error boundary instead of the retryable rollback toast.
- Two paths lose typed text: the picker's kept reason after a toast retry, and composer text typed while a post is pending.
- The picker resets mid-use whenever its parent re-renders.
- Note deep links fail for notes outside the newest 20.
- The hub stops showing the questionnaire-target AI signal once the Requestor starts answering.

**Checked and found correct**
- **Server-decided controls (D-05, D-07, D-16, D-26).** Assignment actions come only from `served.actions`, in §5.2 order. The own-request and draft notices are shown, and the requesting analyst gets no control. Queue pick-up shows only where the server offered it. The questionnaire and assessment `Pick up on the request page` link renders only for `pickUp === 'allowed'`. The composer renders only while `accepting`. The switch and the composer checkbox render only on `canMarkAiInputs`. The Requestor's create never sends `changesAiInputs` (`notes-thread.tsx:151`), so it never trips the 400.
- **Compare-and-set (D-05).** Each change sends `expectedAnalyst` = the assignee the page showed. Undo sends the current holder as `expectedAnalyst` (`undoAssignmentRequest`). On `ASSIGNMENT_CHANGED`, the action re-reads the request and names the holder with the family K sentences, and the block refreshes.
- **Undo (X-14, UI-D4).** Undo goes through `successToast` plus `toastAction` everywhere: block, queue, switch and well. Undo is withheld for a pick-up or assign on a released request, and the toast says to reassign instead. The undo toast sentences match §7.1 and §10.4 (`aiMarkUndoToast(!next)` maps correctly).
- **Focus.** The status line receives focus after block actions and after a successful Undo. Queue pick-up moves focus to the next `Pick up` or the row link. The switch keeps focus. The composer keeps focus. Earlier notes are inserted without a viewport jump and focus moves to the first inserted note. Discard moves focus to the closed line, and Undo moves it to `Copy text`.
- **Notes rendering.** Bodies are React text only (`whitespace-pre-wrap`, ten-line clamp, print unclamped). There are no edit or delete controls. The pending note shows `Adding…`, and rollback restores the text with the cursor at the end. The add action is not re-entrant. Ctrl/⌘+Enter is guarded against IME composition.
- **Marking read (D-24, UI-D15).** The thread is marked read once per view, through the newest loaded note, when the first unread note intersects the viewport. Failures are silent. `New` markers persist for the view through the `unread` set. No GET has a side effect, and the mark-read action revalidates nothing.
- **Closed window (D-22, §9.4).** A `NOTES_CLOSED` refusal moves the text to the read-only well and refreshes. A draft restored on a closed request also shows in the well. Discard and Undo update the session store.
- **Session drafts (UI-D17, UI-D31).** Drafts are keyed by the opaque owner key plus the request. Signing out clears them. The composer keeps exactly the text being sent until Strapi records it.
- **Job cards (D-18).** Polling is routed by `initiatedByViewer`. `canRetry` is the job's own. `Started by {name}.` shows only for a colleague's queued, running or failed job. Retry is offered whenever `job.canRetry`. `seededKey` includes `canRetry` and `initiatedByViewer`.
- **AI-inputs signal (D-29, D-34).** The signal is rendered by Server Components (`AiInputsChangedBlock`, `RequestContextLines`) and passed as slots, so no client code is added to the editor route. The run sheet's Notes group lives in the lazily loaded body, and `ai-assistance-domain.ts` gained only a type. The sheet shows no note text. `None included` holds for v1 runs, because the parser makes `notes` required and the server serves v1 as none.
- **Parsers (D-02, D-04).** `requestAssignmentSchema`, `requestorAssignmentSchema`, the notes schemas, `requestSummaryAssignmentSchema` and `aiRunContextNoteSchema` are strict and refuse any person key beyond `documentId` and `displayName`. The request read no longer populates `revertedBy`.
- **Copy.** The copy is verbatim to §5 to §10 (families K, L and M, holder rows, `Requestor` in place of `Owner`). No assignment or notes string uses `Accept`, and no assignment string uses `release`.

### Warnings

#### WR-301: A Server Action transport failure on Pick up, Assign, Reassign, Return to queue or Undo reaches the route error boundary instead of rolling back

**File:** `apps/csrm/src/features/request-assignment/assignment-block.tsx:121-132`, `:143-163`; `apps/csrm/src/features/request-assignment/queue-pick-up-button.tsx:91-103`, `:107-120`

**Issue:**
- `apply` and `undo` in the block, and `pickUp` in the queue button, `await changeAssigneeAction(...)` inside an async `startTransition` with no `try/catch`. The Server Action itself never throws, because `changeRequestAssignee` and `getRequest` catch everything. The client call can still reject: the network drops, the Next server is unreachable, or the action id goes stale after a deploy.
- When an async `useTransition` action throws, React 19 rethrows the error to the nearest error boundary. A failed `Pick up` therefore replaces the whole request page or queue with the route's error state. That loses the user's context, including any picker reason held only in state when there is no owner key. §7.1 instead specifies `We couldn't change the assignment. Try again.` with rollback (§7.2).
- In the block's `apply`, `resolve(result.ok)` is never called on this path, so the picker's `.then` never settles.
- The queue's `undo` is a detached `void (async () => …)()`, so its rejection is unhandled and the Undo silently does nothing.
- The sibling controls handle exactly this case: `note-ai-input-switch.tsx:65-70`, `notes-thread.tsx:150-156` and `:182-186`, and the picker's list load at `assign-picker.tsx:157-159`.

**Fix:** Catch the transport failure and map it to the family K retryable result, for example:
```ts
let result: AssignmentActionResult<RequestAssignment>;
try {
  result = await changeAssigneeAction({ requestId, requestNumber, ...request, ...(analystName ? { analystName } : {}), ...(reason ? { reason } : {}) });
} catch {
  result = { ok: false, kind: 'retryable', message: 'We couldn’t change the assignment. Try again.' };
}
resolve(result.ok);
```
Apply the same wrapper to `undo` in the block, and to `pickUp` and `undo` in `QueuePickUpButton`.

#### WR-302: A picker assignment that succeeds through the failure toast's `Try again` never clears the kept reason, and the unload warning stays armed

**File:** `apps/csrm/src/features/request-assignment/assignment-block.tsx:154`; `apps/csrm/src/features/request-assignment/assign-picker.tsx:213-224`

**Issue:**
- The picker clears its kept reason and choice only in the `.then` of the promise that `onAssign` returned for the original submit (`assign-picker.tsx:217-224`).
- When that first attempt fails as retryable, the block's danger toast offers `Try again`, which calls `apply(action, target, reason)` again (`assignment-block.tsx:154`). That is a new promise nobody observes.
- If the retry succeeds, the request is assigned, but three things are left behind:
  - The session draft (`csrm-draft:assign:{owner}:{request}`) still holds the reason and the chosen analyst.
  - The picker's `reason` state is still non-empty, so `useUnloadWarning(true)` keeps a `beforeunload` prompt armed for a change that has already been recorded.
  - Reopening `Reassign` restores the old reason, with `Restored from earlier in this session.`, into a different change.
- UI-SPEC §6 and UI-D31 say the kept reason is cleared when the assignment succeeds.

**Fix:** Clear the picker's kept state from the block whenever a picker-originated change is recorded, whatever path recorded it. Two options:
- Pass an `onRecorded` callback into `apply` from the picker.
- Inside `apply`'s success branch for `assign` and `reassign`, call `clearSessionDraft('assign', draftOwnerKey, requestId)` and signal the picker to reset its state, for example with a `resetKey` prop or by unmounting it with `setPickerMounted(false)` when no draft remains.

#### WR-303: Text typed while a note is posting is overwritten when the post fails, and the session store diverges from the field

**File:** `apps/csrm/src/features/request-notes/note-composer.tsx:137-158`

**Issue:**
- `post` clears the field and keeps it focused, so the person can start typing the next note while the first is pending (§9.1). Each keystroke goes through `edit`, which sets `latest.current` and schedules a debounced `keep(newText)`.
- On failure, the composer runs `latest.current = body; setText(body)` (lines 153-157). That replaces whatever was typed during the pending window, and the new text is lost from the field.
- The debounced keep, or one already written, has put the new text in the session store. The field then shows `body` while the store holds the new text. A reload restores only the new text, and the failed note's text is lost there instead.
- The success path already handles text typed during the pending window (lines 147-151: "unless the person has already started the next one"). The failure path does not, which breaks "no lost input" (D-25, G-4) in both directions.

**Fix:** On failure, keep both texts. For example:
```ts
if (result) {
  const typedMeanwhile = latest.current;
  const restoredText = typedMeanwhile ? `${body}\n\n${typedMeanwhile}` : body;
  latest.current = restoredText;
  keep(restoredText, true);
  restored.current = true;
  setText(restoredText);
  setFailure(result);
}
```
Alternatively, make the textarea `readOnly` while `posting.current` is set, so nothing can be typed in the window.

#### WR-304: The assign picker resets its search, its choice and its list whenever the assignment block re-renders while it is open

**File:** `apps/csrm/src/features/request-assignment/assignment-block.tsx:226`; `apps/csrm/src/features/request-assignment/assign-picker.tsx:130-179`; trigger at `apps/csrm/src/features/assessments/assessment-detail.tsx:140-147`

**Issue:** The block passes an inline `onOpenChange={(open) => { if (!open) setPicker(null); }}`, so it has a new identity on every render.
- `load` lists `onOpenChange` in its `useCallback` deps (line 160).
- The "opening" effect lists `load` in its deps (line 179).
- So any re-render of `AnalystAssignmentBlock` while the picker is open re-runs the open effect. That clears `term` and `chosen`, re-reads the kept reason, sets the list back to `loading` and fetches the list again.

`AnalystAssignmentBlock` is not memoised and re-renders on any re-render of `AssessmentDetail`. That happens on:
- every generation-job status report (`setQuestionnaireJobStatus` and `setDraftJobStatus` through `onJobStatusChange`);
- the `router.refresh()` on job completion;
- any revalidation of the page, such as posting a note or toggling a mark on the same page.

An analyst picking a colleague while a job moves from queued to running loses the search term. The chosen person is restored only when an owner key exists and the person is in the first unfiltered page. The list also flashes back to loading.

**Fix:** Make the open effect depend only on `open` and `requestId`, and hold callbacks in refs. For example, `const onOpenChangeRef = useRef(onOpenChange); onOpenChangeRef.current = onOpenChange;`, and call `onOpenChangeRef.current(false)` inside `load` with `[mode, requestId]` deps. Also memoise the block's handler with `useCallback`.

#### WR-305: Note links from the AI-inputs signal and the run sheet go nowhere for any note outside the newest 20

**File:** `apps/csrm/src/features/ai-assistance/ai-inputs-changed.tsx:38-40`; `apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx:144`; `apps/csrm/src/features/request-notes/notes-section.tsx:47`; `apps/csrm/src/features/request-notes/notes-thread.tsx:95-111`

**Issue:**
- The signal (§10.2) and the sheet's Notes group (§10.3) link each note to `/app/review/requests/{id}#note-{noteId}`.
- The thread renders only the newest `NOTES_PAGE_SIZE = 20` notes. Earlier notes load only when the person presses `Show earlier notes`.
- Nothing in the thread reads `location.hash`, as `grep` for `location.hash`/`hashchange` in `src/features/request-notes` confirms.
- A thread can hold 500 notes, and 50 notes can be marked. So the typical case breaks: an early Requestor note marked after the conversation grew past 20 notes. The fragment has no target, the page lands at the top, and the analyst cannot reach the note the signal names.
- This defeats §10.2's "record link … → the note in the thread", and §8.2's promise that a link to `#note-{id}` scrolls to it and moves focus there.

**Fix:** Let the thread resolve a `#note-{id}` fragment that is not among the loaded notes. Two options:
- On mount and on `hashchange`, when the target id is not in `known`, page earlier notes with `listRequestNotesAction` (by `before`) until it appears, then scroll to it and focus it.
- Alternatively, have the signal and the summary carry the note's `sequence`, which `AiInputsChanged` and the run summary already include, and load the page with `before = sequence + 1` first.

#### WR-306: The hub stops showing the questionnaire-target "AI inputs changed" signal once the Requestor starts answering

**File:** `apps/csrm/src/features/assessments/assessment-detail.tsx:161`, `:194`; `apps/csrm/src/features/requests/request-domain.ts:239-241`

**Issue:**
- The questionnaire signal reaches the hub only as the `aiInputsChanged` slot of `QuestionnaireGenerationJob`. That card renders only while `offersQuestionnaireGeneration(request)`, which means `requestStatus === 'submitted'`.
- Strapi moves the request to `questionnaire-in-progress` on the Requestor's first answer save (`questionnaire-workflow.ts:115-117`). From then on, the hub drops a signal Strapi still serves (`request.aiInputs.questionnaire`).
- That is the UAT-013 yardstick window: Jane adds a note after the questionnaire exists, while answering it, and "the hub and the questionnaire page say that one note changed the AI inputs".
- The draft side was fixed for the same shape of problem with `DraftSignalCard` (`assessment-draft-job.tsx:358-374`, 13-18 deviation 1). The questionnaire side was left as "carries the signal only where it renders" (13-18 key decision). That decision is recorded, but it contradicts D-29 ("server-rendered on the hub").

**Fix:** Render the questionnaire signal on the hub whenever it is served, not only when the generation card is shown. When `!showsQuestionnaireCard && questionnaireAiInputs` is served, render a signal-only card mirroring `DraftSignalCard`, titled as the questionnaire card is. Alternatively, place the slot in the questionnaire `SummaryCard` of `RequestHub`'s relationships.

### Info

#### IN-301: Dead inputs and fields in the assignment and notes contracts of the web

**File:** `apps/csrm/src/features/request-assignment/assignment-actions.ts:27-28`, `:47`, `:110`; `apps/csrm/src/features/request-notes/notes-thread.tsx:100`

**Issue:**
- `changeInputSchema` requires `requestNumber`, but the action never reads it.
- `AssignmentActionResult.currentHolder` is computed and returned, but neither the block nor the queue button reads it. Their copy comes from `message`.
- The thread derives `remaining` from `oldest.sequence - 1` and ignores the served `meta.hasEarlier`. This is correct only while sequences have no gaps, which is a contract invariant today.

**Fix:** Drop `requestNumber` and `currentHolder`, or use them. Gate the earlier-notes button on `hasEarlier` from the page that loaded the oldest note, with the count as presentation only.

#### IN-302: The module-level `focusAfterUndo` is never cleared when the restored row does not remount

**File:** `apps/csrm/src/features/request-assignment/queue-pick-up-button.tsx:50`, `:72-77`, `:98`

**Issue:** After a successful queue Undo, `focusAfterUndo = requestId` waits for that request's `Pick up` to mount. If the refreshed queue no longer lists the request (another filter or page, or someone else picked it up), the value persists for the tab's lifetime. It later steals focus the next time that request's `Pick up` mounts on any queue view.

**Fix:** Clear it after the post-Undo `router.refresh()` settles, for example with a `setTimeout` or `requestAnimationFrame` after the refresh, or store a timestamp and ignore stale values.

#### IN-303: The unload warning is disarmed while a note is in flight, and a reload mid-post can restore an already-posted note's text

**File:** `apps/csrm/src/features/request-notes/note-composer.tsx:95`, `:137-140`, `:144-151`

**Issue:**
- `post` sets `text` to `''` before the request resolves, so `useUnloadWarning(text.trim().length > 0)` is off during the post. Closing the tab in that window, before Strapi answers, gives no prompt. The text exists only in the request and in the tab's `sessionStorage`, which dies with the tab.
- Conversely, a reload during a post that Strapi then records leaves the store holding the body, because the clearing code never runs. The restored draft invites a duplicate of an append-only, undeletable note.

**Fix:** Arm the warning on `text.trim() || posting.current`, kept in state. When restoring a draft on mount, optionally compare it with the newest own note in the served page.

#### IN-304: Text in the unsent-note well does not arm the unload warning

**File:** `apps/csrm/src/features/request-notes/notes-thread.tsx:254`; `apps/csrm/src/features/request-notes/unsent-note-well.tsx:28-86`

**Issue:** UI-D18 arms `beforeunload` because closing the tab is the only way kept text is lost. The §9.4 well holds exactly such text, from the session store or a `NOTES_CLOSED` refusal, but nothing arms the warning while it is shown. Closing the tab discards it silently.

**Fix:** Call `useUnloadWarning(shown)` in `UnsentNoteWell`. It is a client module that already loads only with the thread.

#### IN-305: Earlier notes rely on Strapi's default page size instead of the page's own constant

**File:** `apps/csrm/src/features/request-notes/notes-thread.tsx:183`

**Issue:** The first page asks for `limit: NOTES_PAGE_SIZE` (20), but `loadEarlier` sends no `limit` and relies on `NOTES_PAGE_DEFAULT = 20` in `request-notes-policy.ts`. A server-side change to the default would silently change §8.2's "previous 20".

**Fix:** Pass `limit: NOTES_PAGE_SIZE` in `listRequestNotesAction({ requestId, before: oldest.sequence, limit: NOTES_PAGE_SIZE })`.

#### IN-306: The picker trigger reports `aria-expanded="true"` while its code is still loading, with nothing shown

**File:** `apps/csrm/src/features/request-assignment/assignment-block.tsx:39`, `:97-101`, `:196`

**Issue:** `AssignPicker` is loaded with `next/dynamic({ ssr: false })` and no `loading` component. On first open, the trigger announces expanded, but neither the popover nor the §6 skeleton appears until the chunk arrives. On a slow link that reads as a dead control.

**Fix:** Give `dynamic` a `loading` fallback, such as the four skeleton rows in an anchored container. Alternatively, preload the chunk on pointer enter or focus of `Assign` and `Reassign`.

#### IN-307: The assignment Server Action does not revalidate the analyst questionnaire and assessment pages that now show the assignee

**File:** `apps/csrm/src/features/request-assignment/assignment-actions.ts:64-71`

**Issue:** `RequestContextLines` (§11) renders `Assigned to {name}` or `Not picked up · Pick up on the request page` on `/app/review/questionnaires/{id}` and `/app/review/assessments/{id}`. `revalidateAssignmentPages` revalidates the request pages, the queues and Home, but not those two route trees. `setNoteAiInputAction` does revalidate them, for the signal. Back and forward navigation can therefore show a stale holder line after a pick-up.

**Fix:** Add `revalidatePath('/app/review/questionnaires', 'layout')` and `revalidatePath('/app/review/assessments', 'layout')`, as `notes-actions.ts:126-127` does.

#### IN-308: Notes copy chosen by route, not by role, on two edge paths

**File:** `apps/csrm/app/(app)/app/requests/[documentId]/page.tsx:72`; `apps/csrm/src/features/request-notes/notes-domain.ts:155-159`

**Issue:**
- The Requestor route always passes `viewer="requestor"`. An analyst who opens another person's request at `/app/requests/{id}` therefore gets the Requestor's description and composer hint, while Strapi gives them the analyst part and the switch.
- On the analyst page, a requesting analyst gets the analyst description "Mark a note as changing the AI inputs to include it in AI generation." even though `canMarkAiInputs` is false for them.

**Fix:** Choose the description and hint from the served `meta.viewerPart` and `canMarkAiInputs` rather than from the route, as `composerHint` already does for the hint on the analyst page.

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Phase 13: Code Review Report, Lane 4 (web source: shell, navigation, lists, Homes, quick find, lib and components)

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 49
**Status:** issues_found

### Summary

I reviewed the 49 Lane 4 files against their Phase 13 diff from `ab000f6`. The generated `schema.d.ts` was reviewed through its diff only. The review covered the analyst navigation profile and its counts, the Assigned to me route, the review queue list, both Homes, quick find, the transport, the refusal families K, L and M, the session-draft store, the development persona and the header CSS. For the "equal list" claims I cross-checked the called backend predicates (`dashboard-summary.ts`) and the web modules outside the lane that these files call (`queue-pick-up-button.tsx`, `notes-actions.ts`, `note-composer.tsx`, `assign-picker.tsx`, `oidc-session-adapter.ts`, `ai-run-record.ts`).

The lane has no critical defects. There is one Warning. Signing out while the note composer or the assign picker holds unsent text clears the session store before the sign-out action runs. The composer's `beforeunload` prompt then fires on the external Keycloak redirect, after the session has already ended. Choosing "Stay" therefore leaves a signed-out page whose kept text is already deleted. The five Info items cover a family-L status mapping, owner-key hygiene, a test that cannot prove what it names, duplicated presentation code, and a small copy divergence.

**Checked and found correct:**

- **Navigation profile.** `Assigned to me` comes first in Assessment work, with `assessment:review` and `UserRoundCheck`. The drawer renders the same profile. The current-item rule marks `/app/review/assigned`, and a Requestor reads no analyst count (`shownCountKeys`).
- **Counts.** `assignedToMeNeedingAction` is `requires-attention` with `assignee=me`. `requestsWaitingForPickUp` is `requires-attention` with `assignee=unassigned`. Each is one bounded one-row read. Any rejection, refusal or parse failure settles to `undefined`, and `shownNavigationCount` hides both zero and undefined. The accessible names (`need(s) your action`, `waiting for pick-up` for one and many) match 13-UI-SPEC §1. The sidebar opening its page unfiltered follows the accepted UI-D7.
- **Assigned to me route.** The scope is fixed server-side (`{ ...parse(params, 'open'), assignee: 'me' }`), so a URL `assignee` value can neither widen nor change it. The list strips the assignee from chips, controls and URLs. The view defaults to `All open`, Clear filters returns to `All open`, the table has nine columns and no `Assigned to`, the skeleton has nine columns, and the route has error and loading boundaries. The view-specific `parseAssessmentRequestReviewQuery` default handles a missing or unknown `queue`.
- **Review queue.** The six queues are in §2.2's order and labels, with "Requires attention" no longer saying "my". The `Assigned to` and `Notes` selects and their chips work, and Clear filters resets every filter and the queue. The `Assigned to` column (name, `Pick up` only for `pickUp === 'allowed'` with a served viewer, `Not picked up`, `You raised it`) and the unread line (ink, link to `#notes`, absent at zero) match the spec. Phone cards put the holder line and full-width `Pick up` last, and the shared DataTable keeps the density toggle.
- **Analyst Home.** Tile 1 is `Needs your action` = `mine.requiresAttention` → `/app/review/assigned?queue=requires-attention`. The `Assigned to you` group (four rows) and `Waiting for pick-up` (`unassigned`, which leads to `/app/review/requests?assignee=unassigned`) each open a list whose server predicate is the same `countReviewQueueBucket` call (`dashboard-summary.ts:315-319`). Zero rows render as linked data, so X-10 holds.
- **Requestor Home.** The new-notes row reads the status summary's `withUnreadNotes` and opens `/app/requests?notes=unread`, whose total equals it under the contract. It is absent at zero and on a failed, refused or rejected summary, and the summary joins neither the permission nor the page-error decision. Line 2 adds ` · Assigned to {name}`, and the X-17 marker links to `#notes`.
- **Quick find.** Line 2 is `{status} · Assigned to {name}` or `· Not picked up`, taken from the same queue read with no new read. Requestor options are unchanged.
- **Transport.** `normalizeTransportError` keeps a closed-list reason on 403 and 409 only, and existing callers branch on status first (`generationFailure`, `answerSaveRefusal`, `aiDecisionRefusalCopy`), so the widening causes no regression.
- **Refusal copy.** Family K (all eight rows plus both named sentences), L (`NOTES_CLOSED`, `NOTES_LIMIT_REACHED`, 403, 404, network) and M (`OWN_REQUEST`, 403, 404, 409, network) match 13-UI-SPEC §7.4, §9.5 and §10.4 word for word, apart from IN-401. The new closed reasons are in `CONFLICT_REASONS`.
- **Development persona.** `Second Security Analyst` resolves to `sam.analyst@idambox.com` and holds exactly the Security Analyst capabilities. It is added to the sign-in page and the role switcher. Nothing under `apps/backend/src/keycloak` or `idp/` changed, so it has no Keycloak subject.
- **Header at 375.** The 375 to 767 px rule wraps a long role tag inside the min-height header, and the ellipsis rule stays below 375 px.
- **Unload warning and route budget.** `use-unload-warning.ts` is imported only by `assign-picker.tsx` and `note-composer.tsx`, never by the shell's guard. The shell gains only `clearAllSessionDrafts`, the +248 bytes 13-09 recorded, and 13-19 records 115 bytes of headroom on `/app/risks/{documentId}`.
- **AI parsers.** `aiRunContextSummarySchema` (v1 or v2 with a required `notes`) is safe because `ai-run-record.ts:61,73` projects stored v1 summaries with an empty notes section. The `aiInputsChanged` parser matches `AiInputsChanged` and `AiInputsChangedNote` in the specification, and the `SameType` guard ties it to the domain type.
- **Owner key.** `draftOwnerKey` keys OIDC drafts by the existing opaque `identityKey` and development drafts by a hash of the role. It is `server-only`, so no personal value reaches a storage key in clear.

### Warnings

#### WR-401: Sign-out with unsent note or reason text deletes the kept text first, then the browser's leave prompt fires after the session has already ended

**File:** `apps/csrm/src/components/shell/account-menu.tsx:77-91` (with `apps/csrm/src/components/csrm/use-unload-warning.ts:12-18`)

**Issue:** UI-D18 has the note composer and the assign picker arm only `beforeunload` (`note-composer.tsx:95`, `assign-picker.tsx:128`). Neither sets the shell guard's `blocking`, and `use-unload-warning.test.tsx` asserts that it stays "not blocking". With unsent text on the page, Sign out therefore goes straight to the non-blocking branch:

```ts
if (leaveChosen.current || !guard.blocking) {
  clearAllSessionDrafts();   // the kept note and reason are deleted here, before the action
  return;                    // signOutOfSession then runs
}
```

`signOutOfSession` → `OidcSessionAdapter.signOut` first ends the Auth.js session (`oidc-session-adapter.ts:143`), then redirects to the external Keycloak logout URL (`:145-150`). Next's server-action reducer turns an external redirect into an MPA navigation (`server-action-reducer.js:248-249`), which fires `beforeunload`. The composer's `useUnloadWarning(true)` handler is still mounted and calls `preventDefault()`, so the browser asks "Leave site?" *after* the session is gone. If the person chooses Stay, they remain on a page whose API calls now fail, and their text survives only in component state. The session copy is already deleted, so the next in-app navigation loses it, which contradicts "no lost input" (G-4, §9.3).

The same early clear means a failed or rejected sign-out action (network error) also loses the kept text while the person stays signed in.

A minor related race: a composer keep still pending on its 300 ms timer (`note-composer.tsx:107-110`) re-writes the draft after `clearAllSessionDrafts` has run.

**Fix:** Decide about kept text before the action runs, not after it.

1. Add `hasSessionDrafts()` to `session-drafts.ts` (the shell already loads this module), which scans for any `csrm-draft:` key.
2. Have the account menu treat `guard.blocking || hasSessionDrafts()` as blocking, and ask through the guard's dialog with a sign-out description, for example "Signing out discards the note text you haven't added."
3. Once Leave is chosen, set a module flag in `session-drafts.ts` that `useUnloadWarning`'s handler checks, so the browser does not prompt a second time.
4. Then clear the drafts and submit.

```ts
// session-drafts.ts
let leaving = false;
export const hasSessionDrafts = () => withStore((s) => Array.from({ length: s.length }, (_, i) => s.key(i)).some((k) => k?.startsWith(PREFIX)), false);
export const markLeaving = () => { leaving = true; };
export const isLeaving = () => leaving;
// use-unload-warning.ts
const warn = (event: BeforeUnloadEvent) => { if (!isLeaving()) event.preventDefault(); };
```

Measure `/app/risks/{documentId}` afterwards, because it has 115 bytes of headroom. If the budget forbids the scan in the shell, keep the clear but move it after the redirect decision (an `onLeave`-style confirmation), and add a unit test for "Sign out with unsent text".

### Info

#### IN-401: Family L reads a server 400 as the 403 sentence ("You can't add notes to this request."), not §9.5's field copy

**File:** `apps/csrm/src/lib/api/refusal-copy.ts:341`

**Issue:** 13-UI-SPEC §9.5 maps a 400 to "§8.3's validation copy, field". `noteRefusal(undefined, 400)` returns `{ message: 'You can’t add notes to this request.', kind: 'blocked' }`, which is a permission sentence and a blocked kind. Today this is mostly unreachable, because `validateNoteDraft` mirrors Strapi's three body rules exactly (`notes-domain.ts:56-71` against `request-notes-policy.ts:94-104`). Any future drift between the two rules would make a valid-looking note read as a permission refusal, with no way to fix the text.

**Fix:** Map a 400 to a field-kind, text-oriented sentence, for example `{ message: 'This note can’t be added as written. Check its length and remove any hidden formatting characters.', kind: 'field' }`. Widen `NoteRefusal['kind']` to include `'field'`, which `NoteActionResult` already has.

#### IN-402: Drafts of a person who did not use Sign out stay in the tab's store

**File:** `apps/csrm/src/lib/session-drafts/session-drafts.ts:41-48`, `apps/csrm/src/lib/session-drafts/draft-owner-key.ts:20-24`

**Issue:** `clearAllSessionDrafts` runs only from the OIDC account menu's Sign out. Several ways of ending or changing a person leave the previous person's plain-text note and reason in `sessionStorage`:

- an expired session;
- a Keycloak logout from another tab;
- a pre-hydration native form post of Sign out;
- the development role switcher.

The owner key keeps that text out of the next person's UI, which satisfies UI-D17. It is still readable through devtools on a shared browser, which T-13-32 aims to prevent.

**Fix:** This is hardening, not a spec gap. When the composer or picker mounts with an owner key, remove every `csrm-draft:{kind}:{otherOwner}:*` key. This lives in request-page code, so it adds no shell bytes.

#### IN-403: The header role-tag test proves only that two CSS declarations exist, not that the 375 px header fits

**File:** `apps/csrm/src/components/shell/header-role-layout.test.ts:19-33`

**Issue:** The test regex-matches `app/globals.css` text for `flex: 0 1 auto` and `white-space: normal`. It renders nothing and measures nothing. It would still pass if `.header-actions` lost `min-width: 0` or the header stopped wrapping, so "without horizontal scroll" rests entirely on the §17 browser backstop.

**Fix:** Keep the test as a guard, but name it as such ("declares the wrap rule"). Add a Playwright assertion at 375 px for the `Second Security Analyst` persona that `document.documentElement.scrollWidth <= 375` and that the role tag's full text is visible. The orchestrator backstop can then cite that assertion.

#### IN-404: The X-17 unread line and the person parser are duplicated across modules

**File:** `apps/csrm/src/features/assessments/assessment-list.tsx:253-278`, `apps/csrm/src/features/requests/request-table.tsx:92-117`, `apps/csrm/src/features/home/requestor-home-presentation.ts:153-157`, `apps/csrm/src/features/home/requestor-home.tsx:77-87`, `apps/csrm/src/features/assessments/assessment-schema.ts:42,82`

**Issue:** Three components render the same X-17 marker, with the same class string, icon and `{n} new {note|notes} on {number}` naming:

- `QueueUnreadLine`;
- `UnreadLine`;
- `UnreadMarkerLine`.

`newNotesLine` and its `Intl.NumberFormat` are copied twice. `queuePersonSchema` and `jobInitiatorSchema` are identical parsers. The `Not picked up` and `Not picked up yet` literals are repeated outside `assignment-domain.ts`. A copy or token change to the X-17 marker has to land in four places.

**Fix:** Extract one zod-free `UnreadNotesLink({ count, requestNumber, href })` and one `newNotesText(n)`, for example in `features/request-notes/notes-domain.ts`, which already holds the thread's words. Reuse one `personSummarySchema` in `assessment-schema.ts`.

#### IN-405: Assigned to me's permission and in-list error states name "assessment requests", not the spec's area

**File:** `apps/csrm/src/features/assessments/assessment-list.tsx:585,545`; `apps/csrm/app/(app)/app/review/assigned/error.tsx:10`

**Issue:** 13-UI-SPEC §2.1 gives Assigned to me "the route's locked error and permission states, with `Assigned to me` as the area". The list renders `You don’t have access to assessment requests` and `We couldn’t load assessment requests` for both views. `error.tsx` introduces the description `We couldn’t load the requests assigned to you.`, which is not in the UI-SPEC copy tables. The difference is cosmetic, but it is unrecorded copy.

**Fix:** Either pass the area per view (`view === 'assigned' ? 'requests assigned to you' : 'assessment requests'`) or record the chosen wording in 13-UI-SPEC §2.1 as copy added during execution, as §8.3 and §9.4 do.

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Phase 13: Code Review Report, Lane 5 (web unit tests)

**Reviewed:** 2026-10-09T06:54:55Z
**Depth:** standard
**Files Reviewed:** 55
**Status:** issues_found

### Summary

I reviewed the 55 lane-5 files: 26 new Vitest files in full, and the Phase 13 diff (`ab000f6..HEAD`) of each existing test. Where a test's validity depended on the source it exercises, I read that source too: the assignment block, picker, pick-up button and domain; the notes thread, composer, item, switch and section; the session-draft store and owner key; the Server Actions; `refusal-copy.ts`; and the two server-rendered slot modules. I ran nothing, as the brief requires.

Overall the suite is strong. The refusal states named in D-32 are each exercised:
- a requesting analyst gets no Pick up and the `OWN_REQUEST` notice;
- a closed request shows the §8.4 line in place of the composer, for each reason and each viewer;
- a viewer whose read carries a null notes summary gets no Notes section, no notes read and no flag;
- a Requestor gets no switch and no checkbox.

Optimistic apply, rollback and Undo are proven for all three optimistic controls, as are the compare-and-set payloads. Closed-parser refusals cover email, extra keys and note text at every new seam.

The defects found are of four kinds:
1. Several focus assertions cannot fail, because focus never leaves the element before the assertion.
2. Two "server component / route budget" tests are named for an importer check they do not make.
3. Two guard tests have scope gaps. The lazily loaded assign picker is outside every transitive zod walk. The copy guard excludes the Server Action modules even though they hold user-visible copy.
4. A real no-lost-input defect in the composer has no test: text typed while a note is pending is overwritten when the post fails. The tests that type during a pending post only ever resolve it successfully.

No Critical findings.

**Checked and found correct:**
- **Session-draft isolation.** The store keys `kind:ownerKey:requestId`. Reading as another owner, another request or another kind returns null. `clearAllSessionDrafts` removes only the `csrm-draft:` prefix. A refused or absent store never throws. `draftOwnerKey` separates the four development roles. That matters because every development session's display name is `Development user` and it carries no email, so the role is what gets hashed. The composer, thread and picker tests each prove that another person's kept text is never restored.
- **Optimistic apply, rollback and Undo** for the assignment block, the queue Pick up and the AI-input switch:
  - deferred promises prove the optimistic state;
  - refusals prove the rollback and the family K and M copy;
  - Undo sends the new holder or mark as the expected value (`expectedAnalyst` compare-and-set);
  - after release, Undo is withheld for pick-up and assign (UI-D4).
- **Live region.** The notes thread's polite `role="status"` region is always mounted (`notes-thread.tsx:255`), and the posting test asserts a single `Note added.`.
- **Mark-read.** It is called once per view, through the newest loaded note, only when the first unread note intersects. It is silent on failure, and the `New` markers survive a re-render that reads them as read.
- **Parity guard.** Both new parser modules are registered. The grandfathered count drop (41 to 39) matches the two job entries removed. The new parity cases refuse a missing `viewer`, an assignee with `email`, a missing `unreadNotes`, a missing `withUnreadNotes`, and an `open` count in `mine`.
- **Transport.** It keeps a closed-list reason on 403 and 409 only (`server-client.test.ts`).
- **Context-summary envelope.** v1 parses with the server-projected empty notes section. The backend's `NO_NOTES` in `ai-run-record.ts:39` is consistent with this. v3, a missing version, a missing notes section, a note body, `bound` 51 and an unknown part are all refused.
- **Requestor isolation on Assigned to me.** The assignee is never taken from the URL (`e2e-ui-state-route-authorization.test.tsx`).
- **The request read.** It no longer asks Strapi to populate `revertedBy` (`request-service.test.ts`). A Requestor's assignment view carrying more than `displayName` is refused.
- **Generation-job tests.** They assert that the two retired Phase 10 sentences never render, and that a retry after a colleague's job shows the viewer's own attempt.
- **Requestor sees no AI mark.** The web proof is tautological (IN-504), but the guarantee is in Strapi and is proven there: `apps/backend/tests/request-notes.integration.test.ts:128,356,466` assert `"changesAiInputs" in note === false` for the Requestor.

### Warnings

#### WR-501: Focus assertions after Undo and after posting cannot fail

**File:** `apps/csrm/src/features/request-notes/note-ai-input-switch.test.tsx:90,105,137`; `apps/csrm/src/features/request-assignment/assignment-block.test.tsx:113`; `apps/csrm/src/features/request-notes/notes-thread.test.tsx:146`; `apps/csrm/src/features/request-notes/note-composer.test.tsx:70`

**Issue:** Each of these asserts focus on the element that already held it, so each would still pass if the code that moves focus were deleted.
- **AI-input switch.** `user.click(theSwitch())` focuses the switch. The success toast's Undo, and the refusal, are then invoked programmatically (`lastSuccessAction()?.onClick()`), so focus never leaves the switch. Removing every `keepFocus()` call in `note-ai-input-switch.tsx:48,61,73,79` would leave lines 90, 105 and 137 green.
- **Assignment block Undo.** At line 113, the pick-up's own `focusStatus()` (`assignment-block.tsx:141,161`) has already put focus on the status line before Undo runs. The `focusStatus()` calls inside `undo` (`assignment-block.tsx:120,130`) are therefore unproven.
- **Composer and thread posting.** Both tests post with Ctrl+Enter from inside the textarea. The textarea never loses focus, so the composer's `field.current?.focus()` (`note-composer.tsx:140`) is unproven. That call matters for the click path, where pressing `Add note` moves focus to the button.

In the browser a toast's Undo button takes focus when clicked. This is exactly the §7.3 and §10.4 path ("Undo succeeds: the block's status line"; "Focus stays on the switch throughout") that these tests claim to cover.

**Fix:** Move focus away before invoking the action, then assert it returns. For example:
```tsx
const elsewhere = document.createElement('button'); document.body.append(elsewhere); elsewhere.focus();
await act(async () => lastSuccessAction()?.onClick());
expect(theSwitch()).toHaveFocus();
```
For the composer, add a case that posts with `user.click(screen.getByRole('button', { name: 'Add note' }))` and then asserts `expect(field).toHaveFocus()`.

#### WR-502: A failed post overwrites text typed while the note was pending, and no test covers it

**File:** `apps/csrm/src/features/request-notes/note-composer.tsx:136-158` (source); `apps/csrm/src/features/request-notes/note-composer.test.tsx:105-117`, `apps/csrm/src/features/request-notes/notes-thread.test.tsx:173-185` (tests)

**Issue:** §9.1 clears the textarea and keeps focus while a note is pending, which invites the person to start the next note. On failure, `post` runs `latest.current = body; restored.current = true; setText(body)`. That unconditionally replaces whatever was typed during the round trip.

The newly typed text survives only in the debounced `keepTimer` closure. That closure can later write the new text to the session store while the field shows the old body, so the store and the field disagree. On `NOTES_CLOSED` the thread then reads the store into the well (`notes-thread.tsx:114-118`), which can replace the failed note's text with the newer fragment. Either way one of the two texts is lost, which violates §9.3 and the G-4 "no lost input" bar.

The two tests that type during a pending post (`'Twice'` and `'Two'`) resolve with success only. Neither asserts that the typed text survives.

**Fix:** On failure, merge rather than overwrite, and add a test:
```ts
if (result) {
  const typedMeanwhile = latest.current;
  const restoredText = typedMeanwhile ? `${body}\n\n${typedMeanwhile}` : body;
  latest.current = restoredText; keep(restoredText, true); restored.current = true; setText(restoredText); setFailure(result);
}
```
Test: start a post on a deferred promise, type `"Next"`, resolve with a retryable failure, then assert the field and `sessionStorage` both contain the failed body and `"Next"`.

#### WR-503: The lazily loaded assign picker is outside every transitive zod walk

**File:** `apps/csrm/src/lib/performance/zod-client-boundary.test.ts:18-20,129-150`; `apps/csrm/src/features/request-assignment/assign-picker.test.tsx:368-372`

**Issue:** The route walk stops at a dynamic `import()`: the `importPattern` needs whitespace after `import`, so `import('./assign-picker')` is never followed. Phase 12 closed this same gap for the AI run sheet and source view with a dedicated `clientChainsToZodFrom(entries, true)` walk (WR-407). `assignment-block.tsx:39` now loads `AssignPicker` the same way, but nothing walks it transitively.

The only guard is a source regex in `assign-picker.test.tsx:371` that checks direct imports of `'zod'` and `assignment-schema`. Two regressions would ship zod to every analyst request page when the picker opens, and neither would fail any test:
- `assignment-domain.ts` (or a shared component the picker imports) starts importing a module that defines a schema;
- the picker imports a zod-bearing module through any other name.

**Fix:** Export the walker helpers, or add the case beside the AI walk, and walk the picker as a client entry:
```ts
it('reaches no zod from the lazily loaded assign picker', () => {
  expect(clientChainsToZodFrom([resolve(webRoot, 'src/features/request-assignment/assign-picker.tsx')], true)).toEqual([]);
});
```
Also assert that `assignment-block.tsx` contains `import('./assign-picker')` and that nothing imports it statically, as the `lazyBodies` case does.

#### WR-504: "Server Component only the two record pages import": the importer check the tests are named for is missing

**File:** `apps/csrm/src/features/assessments/request-context-lines.test.tsx:77-82`; `apps/csrm/src/features/ai-assistance/ai-inputs-changed.test.tsx:114-119`

**Issue:** Both modules depend on D-34's route budget. They must be imported only by the server page modules and handed on as slots, because a client view importing either would ship it in the editor's or the questionnaire review's first load. The brief notes `/app/risks/{documentId}` has about 115 bytes of headroom.

The test at `request-context-lines.test.tsx:77` is named "is a Server Component that only the two record pages import" but asserts only the absence of `'use client'` and of hooks. No test checks the importers. Today they are correct: only the three `app/(app)/app/review/*/[documentId]/page.tsx` files import them. A client module such as `assessment-request-link.tsx` or `questionnaire-review.tsx` importing either one directly would pass every test, and the zod walk would not notice because these modules hold no zod.

**Fix:** Assert the importer set:
```ts
const importers = [resolve(process.cwd(), 'app'), resolve(process.cwd(), 'src')].flatMap(sourceModules)
  .filter((file) => !/\.test\./.test(file) && /from '[^']*request-context-lines'/.test(readFileSync(file, 'utf8')));
expect(importers.map(display).sort()).toEqual([
  'app/(app)/app/review/assessments/[documentId]/page.tsx', 'app/(app)/app/review/questionnaires/[documentId]/page.tsx',
]);
```
Do the same for `ai-inputs-changed` (three pages), or rename the test so it claims only what it checks.

#### WR-505: The copy guard excludes the Server Action modules, which hold user-visible copy

**File:** `apps/csrm/src/lib/performance/interface-copy-guard.test.ts:112-130`

**Issue:** `requestAssignmentModules` and `requestNotesModules` keep only `.tsx` and `-domain.ts` files. The stated reason is that "the service, schema and Server Action modules hold no visible copy of their own". That is false. The actions return sentences the components render verbatim:
- `assignment-actions.ts:92`: `Keep the reason to 500 characters or fewer.`
- `assignment-actions.ts:118,123`: `We couldn’t load Security Analysts.`
- `notes-actions.ts:66,79,83,89,107,110,121`, for example `We couldn’t add your note. Try again.` and `We couldn’t mark the notes read.`

All of these strings are clean today, but any internal term added there (for example "Strapi refused…") reaches users unguarded. The Phase 12 precedent guards `ai-assistance-actions.ts` (all AI modules, `.ts` included).

**Fix:** Include the action modules, and drop the incorrect claim from the comment:
```ts
.filter((name) => name.endsWith('.tsx') || name.endsWith('-domain.ts') || name.endsWith('-actions.ts'))
```
Optionally, move these sentences into the domain modules or into `refusal-copy.ts`, so a single home holds each family's words.

### Info

#### IN-501: The picker test says focus returns to the trigger after assigning, but asserts no focus, and the code does not do that

**File:** `apps/csrm/src/features/request-assignment/assign-picker.test.tsx:196-207`

**Issue:** The test is named "assigns the chosen analyst … and closes, returning focus to the trigger" but has no focus assertion. Without `returnFocus` (the harness passes none), `closeFocus` deliberately does not focus the anchor after an assignment (`assign-picker.tsx`, `else if (!wasAssigned) anchor.current?.focus()`). The title therefore describes behaviour the code does not have. The block-level test covers the real §7.3 target (`assignment-block.test.tsx:254`, the status line).

**Fix:** Rename the test to "…and closes", or pass a `returnFocus` spy and assert `toHaveBeenCalledWith(true)`.

#### IN-502: Vacuous "no name in clear" assertions

**File:** `apps/csrm/src/lib/session-drafts/draft-owner-key.test.ts:35-37`

**Issue:** The test asserts the key matches `/^[0-9a-f]{32}$/` and then that it does not contain `bob` or `Bob`. A lowercase hex string can never contain `o` or `B`, so the last two assertions cannot fail. The first case also never exercises the precedence rule: when an `email` is present it is hashed ahead of the role.

**Fix:** Replace the substring checks with `expect(key).not.toBe(sha256(...).slice(0, 32))` against a known clear value, or simply drop them. Add a case showing that `{ email, developmentRole }` hashes the email.

#### IN-503: The "never speaks of accepting or releasing" regex is case-sensitive and word-bounded

**File:** `apps/csrm/src/lib/api/refusal-copy.test.ts:315-326`

**Issue:** `/\bAccept\b|\brelease\b/` does not match `accept`, `accepted`, `Release`, `released` or `Releasing`. A regression such as "Release it instead." or "the analyst accepted it" passes. Compare `assignment-domain.test.ts:199-201` and `interface-copy-guard.test.ts:465`, which use `/accept/i` and `/release/i` with an explicit allowance for sanctioned text.

**Fix:** Use `/accept|releas/i`, with an allowance for the one sanctioned phrase `A released request keeps an assigned Security Analyst`.

#### IN-504: The web "a Requestor sees no AI mark" tests are tautological

**File:** `apps/csrm/src/features/request-notes/note-item.test.tsx:173-177`; `apps/csrm/src/features/request-notes/note-composer.test.tsx:135-139`; `apps/csrm/src/features/request-notes/notes-thread.test.tsx:210-214`

**Issue:** Neither `NoteItem` nor `NoteComposer` receives the viewer. The Requestor case is identical to an unmarked note with `canMarkAiInputs` false, and the web parser (`notes-schema.ts:25`) accepts `changesAiInputs` for any viewer. These tests therefore cannot fail for a Requestor-specific regression. The guarantee is Strapi's and is proven there (see "Checked and found correct"). Flagged so the D-32 traceability does not overstate the web proof.

**Fix:** Either label these as presentation-only in the test names, or add a NotesSection case: a Requestor read (`viewerPart: 'requestor'`, `canMarkAiInputs: false`) whose served note carries `changesAiInputs: true`, asserting the expected X-11 behaviour. That makes the dependency on Strapi omitting the key explicit.

#### IN-505: Invalid-input refusals say "Try again" while their kind is blocked, and the tests check only `ok: false`

**File:** `apps/csrm/src/features/request-notes/notes-actions.ts:89,121`; `apps/csrm/src/features/request-notes/notes-actions.test.ts:50-56,153-165`

**Issue:** A schema failure returns `{ kind: 'blocked', message: 'We couldn’t add your note. Try again.' }`, and the mark action does the same with `We couldn’t change the mark. Try again.`. A blocked failure offers no Try again button (composer) or offers Refresh page (switch), so the copy contradicts the control. The tests assert only `result.ok === false`, so neither the message nor the kind is pinned. The path is not reachable from the shipped components.

**Fix:** Return family L or M's blocked fallback (`noteRefusal(undefined, 400)` or `noteAiInputRefusal(undefined, 400)`) and assert the full result in the tests.

#### IN-506: Service tests mock `normalizeTransportError` without `reason`, so reason pass-through is unproven at that seam

**File:** `apps/csrm/src/features/request-notes/notes-service.test.ts:9-19`; `apps/csrm/src/features/request-assignment/assignment-service.test.ts:8-18`

**Issue:** The mock returns `{ message, status }` only. No service test can therefore show that `OWN_REQUEST`, `ASSIGNMENT_CHANGED` or `NOTES_CLOSED` reach the actions, which branch on them (`assignment-actions.ts:106`, `notes-thread.tsx:170`). The pieces are each tested (`server-client.test.ts:281-292` and the action tests), but the composition is not.

**Fix:** Use the real `normalizeTransportError`, mocking only `createStrapiClient`. Alternatively, keep `details.reason` in the mock and add one refusal case per service that asserts `error.reason`.

---

_Reviewed: 2026-10-09T06:54:55Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Phase 13: Code Review Report, Lane 6 (Playwright specs, helpers and playwright.config.ts)

**Reviewed:** 2026-10-09T08:30:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

### Summary

I read both new specs (`request-pick-up.spec.ts`, `request-notes.spec.ts`) in full. For the other ten files I reviewed the Phase 13 diff (`git diff ab000f6..HEAD`). I traced each journey against D-32, 13-UI-SPEC §1–§16, the CONTEXT authorisation table, `playwright.config.ts` (projects, `testMatch`, `grep`, `workers: 1`) and the alphabetical order in which the single worker runs the spec files. I also checked the mark-read client (`src/features/request-notes/notes-thread.tsx:120-134`) that the notes journeys depend on.

No finding is product-breaking. The weaknesses are in what the suite proves:

- **The second analyst following a job (D-32) is not proven in the browser.** The deterministic job usually finishes before the colleague's page loads, and the test then accepts the generated-questionnaire branch. That branch would also pass on the Phase 10 behaviour. `Started by Bob Doe.` is never required.
- **Read state (D-24 §9.2) is never proven to take effect.** The "no flag is left behind" claims in the notes spec are not awaited, so unread flags leak into later specs.
- **Two count tests always run the zero branch.** Of the deliberately changed count assertions, analyst-insights E1 and `UX07_ANALYST_COUNTS_EQUAL_LISTS` run on desktop before any test picks up a request, so their equal-list branches never execute. The sidebar's `Assigned to me, N need your action` is never asserted with N > 0. E1's change also removed the only browser proof that the team's Requires attention figure equals its list.
- **Smaller gaps:**
  - one picker assertion that cannot fail;
  - no browser keyboard or focus paths for assignment;
  - axe and overflow coverage holes;
  - the run sheet's new `Notes` group (D-28) is never opened in a browser.

**Checked and found correct:**
- Every test in `request-pick-up.spec.ts` (10) and `request-notes.spec.ts` (10) has `@journey` in its title. Both files are in the mobile project's `testMatch`, and `grep: /@journey/` collects all 20 at 375 (the 13-19 gate recorded 10 + 10 mobile). Of the other changed specs, `request-relationship-states`, `app-shell` and `design-system-conformance` set both widths inside their own tests. `analyst-insights` is desktop-only by design.
- Each Phase 13 journey creates its own request, titled with the project name and a base-36 timestamp. No spec touches UAT-A to UAT-C. The seeded `RAR-E2E-NAV-OWNER-001` is only read: no spec picks it up or posts to it.
- `workers: 1` and `fullyParallel: false` run the tests in sequence. The figure-versus-list equalities (`REQ08_HOME_COUNTS_ASSIGNED_WORK`, `COLLAB01_REPLY_FLAGGED_FOR_REQUESTOR`) therefore cannot race another test.
- The deliberate assertion changes match 13-UI-SPEC §16:
  - the holder sentence: the not-picked-up variant in `navigation-and-home`, `request-relationship-states`, `requestor-request-workflow` and `review-lists`; `REQ08_REQUESTOR_SEES_ASSIGNEE` covers the named variant;
  - `Requests, N waiting for pick-up`;
  - `Assigned to me` first in Assessment work, and absent for both Requestors;
  - the 6 → 11 Review queue links (`analyst-insights.spec.ts:637`, `design-system-conformance.spec.ts:235`);
  - the shifted cell indexes in `review-lists`, and the new `Security Analyst` column;
  - quick-find E3 (`Submitted · Not picked up`, and `Assigned to Sam Analyst`);
  - the hub's `Requestor` row in place of `Owner`;
  - the `:not(#assignment *)` exclusion in `requestor-request-workflow.spec.ts:55`, consistent with §5.2's placement.
- No visible "Requires my attention" copy is asserted anywhere: `request-pick-up.spec.ts:458` asserts that none remains.
- The Secondary Requestor on Jane's request:
  - gets the page's permission state. This matches the CONTEXT authorisation table and `app/(app)/app/requests/[documentId]/page.tsx:40`'s 403 path, although 13-UI-SPEC §8.6 says "not-found";
  - gets no Notes region and no `New` marker, and neither the note text nor the title appears in the page HTML, including the RSC flight data;
  - sees no new-notes row on her Home and nothing of Jane's under `Notes: New notes`.
- The Requestor sees no switch, AI mark, signal or Assignment region, and sees the assignee as a display name only.
- `SignInRole` gains `Second Security Analyst`. `app-shell`'s `REQ08_SECOND_ANALYST_SIGN_IN` proves the header at both widths without needing the mobile allowlist.
- The config change is comment and allowlist only. It adds no artifact path, and the gate recorded a clean tree after the run.

### Warnings

#### WR-601: REQ08_COLLEAGUE_FOLLOWS_JOB cannot detect a regression of D-18, and `Started by {name}.` is never proven in the browser

**File:** `apps/csrm/e2e/request-pick-up.spec.ts:58-76`
**Issue:**
- **What the poll accepts.** The poll returns `'generated-questionnaire'` as soon as the hub shows a `QNR-` link or `Review generated questionnaire`. According to 13-08-SUMMARY (line 132), that is the usual outcome, because the deterministic job finishes before the colleague's page loads.
- **Why that branch proves nothing about D-18.** A second analyst could read the generated questionnaire and the hub before Phase 13. D-18 widened only the job-by-id reads and retries, which used to be initiator-only.
- **What a regression would look like.** If D-18 were reverted (a colleague refused the job read, a card showing `Status unavailable`, or no `Started by` line), the test would still pass whenever the job had finished.
- **The checks after the poll are empty in that branch.** Lines 72-76 (`Status unavailable` absent, the retired sentences absent, no second `Generate questionnaire`) are trivially true once the job is complete.
- **What is left unproven.** D-32 lists "the second analyst following a job" as a Playwright journey at both widths. The success criterion 2 half ("any analyst on the request can follow its generation jobs") has no regression guard in the browser. 13-08-SUMMARY says the gap is covered because "the browser run proves the colleague reaches the request and its questionnaire with no refusal". That reasoning is wrong for the reason above.
- **Retry.** Retry by a colleague (`canRetry` for every analyst) has no browser proof either.

**Fix:** Make the job observable deterministically, then require the strict branch. The cleanest option is a test-only latency, or a forced failure, in the deterministic provider. Read it from an environment variable that is set only in `playwright.config.ts`'s Strapi `env`, and accept it only when `CSRM_ENVIRONMENT=development`. Example: `CSRM_AI_DETERMINISTIC_HOLD_MS: '15000'`. This needs an orchestrator decision because 13-19's static check 6 forbids new `CSRM_AI_` lines. Then:
```ts
await expect(activeJob, 'the colleague sees Bob’s job running').toBeVisible();
await expect(startedByBob).toBeVisible();
await expect(page.getByText('Status unavailable', { exact: true })).toHaveCount(0);
// optional forced-failure variant: the colleague sees `Retry questionnaire generation`, retries, and the card loses `Started by`
```
Drop the `'generated-questionnaire'` acceptance from the poll.

#### WR-602: Marking read (D-24, §9.2) is never proven, and the notes journeys' "leaves no flag" cleanup is not awaited, so unread state leaks into later specs

**File:**
- `apps/csrm/e2e/request-notes.spec.ts:383-384, 407, 485-489`
- `apps/csrm/e2e/request-pick-up.spec.ts:582-586`

**Issue:**
- **How marking read works.** The web marks a thread read through `markRequestNotesReadAction`, called without being awaited from an `IntersectionObserver` callback (`notes-thread.tsx:125-130`).
- **The cleanup ends before the call can land.** `COLLAB01_OTHER_REQUESTOR_SEES_NO_FLAG` ends ("Jane reads Bob's note, which clears her own flag for the journeys that follow") right after `New` is visible (line 489). `COLLAB01_REPLY_FLAGGED_FOR_REQUESTOR` says "Opening the thread marks it read, so the journey leaves no flag behind" and also ends on a visibility check (line 440-441). In both cases the context closes and the Server Action can be aborted before it lands.
- **D-24's rule is never proven to take effect.** No test returns to a page to show that a viewed note is no longer `New`, that `{k} new` disappears, or that a queue, Home or My requests flag clears. Every flag in the suite only goes up, so a broken mark-read (wrong `throughNoteId`, a refused action, a non-monotonic update) would pass the whole suite.
- **Bob's note is never read.** `REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT` posts Bob's note on Jane's request and never has Jane read it, so it leaves Jane a permanent unread flag.
- **This makes the run order-dependent.** The mobile project runs `navigation-and-home`, `requestor-request-workflow` and `review-lists` after the desktop `request-*` specs. Jane's Home there carries a `New notes on N requests` row that the desktop pass did not have. `if (figure === 1)` (line 407) skips its exact-copy assertion whenever a leftover exists, which masks the problem.

**Fix:** Add an explicit read-state proof and await it. Use it as the cleanup.
```ts
await page.goto(`${requestorPath(documentId)}#notes`);
await expect(noteWith(page, requestNumber, bobsReply).getByText('New', { exact: true })).toBeVisible();
await expect.poll(async () => {
  await page.reload();
  return noteWith(page, requestNumber, bobsReply).getByText('New', { exact: true }).count();
}, { message: 'D-24: the viewed note is no longer new on the next view' }).toBe(0);
await expect(summaryValue(page, 'Notes').getByRole('link', { name: '2 notes', exact: true })).toBeVisible();
```
Do the same for Jane in `REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT`, or post Bob's note from a request Jane then reads. Then remove the `figure === 1` conditional and assert the exact row copy.

#### WR-603: Two of the deliberately changed count tests always take their zero branch, so the new Assigned to me figures are never proven equal to their lists, and E1 dropped the team figure's proof

**File:**
- `apps/csrm/e2e/navigation-and-home.spec.ts:434-439, 455-458`
- `apps/csrm/e2e/analyst-insights.spec.ts:494-508`

**Issue:**
- **Run order.** With one worker, the desktop project runs files alphabetically: `analyst-insights` and `navigation-and-home` run before `request-pick-up`. No earlier spec picks up a request (`grep -l "Pick up\|assignee" e2e/*.spec.ts` lists only `navigation-and-home`, which uses `assignee=unassigned` in a URL, `review-lists`, which reads the `Pick up` cell text, and `request-pick-up`). `UX07_ANALYST_COUNTS_EQUAL_LISTS` is not `@journey`, and `analyst-insights` is not in the mobile allowlist, so neither runs again later.
- **The equal-list branches never execute.** Bob's Assigned to me count and his `Needs your action` tile are therefore always 0. `assignedCount > 0` and `needsYourAction > 0` are dead in practice: every run asserts only the empty state.
- **The sidebar name is never asserted with a count.** No spec asserts `Assigned to me, N need(s) your action` (13-UI-SPEC §1) with N > 0. `REQ08_ASSIGNED_TO_ME_VIEW` opens the item through `navigationText`, which accepts any count.
- **E1 removed a proof without replacing it.** It deleted the tile check that proved the team-wide Requires attention figure equals `/app/review/requests`. The relabelled team row `Requires attention` and the new `Assigned to you` rows `With new notes`, `Awaiting Requestor` and `Generation in progress` have no browser proof that each opens an equal list (X-10, D-15). `REQ08_HOME_COUNTS_ASSIGNED_WORK` proves only `Needs your action` and `Waiting for pick-up`.

**Fix:**
- In `UX07_ANALYST_COUNTS_EQUAL_LISTS`, have Bob pick up the request the test's Requestor just submitted. Then assert `assignedCount >= 1`, the exact accessible name and list equality without the zero branch.
- In `analyst-insights`, either do the same or assert the team row `Requires attention: n` against `/app/review/requests`.
- Add a short loop over the `Assigned to you` rows in `REQ08_HOME_COUNTS_ASSIGNED_WORK`. Click each row, or `goto` its `href`, and compare `rowFigure` with `shownListTotal`. Include `With new notes` after Jane posts a note on the request Bob holds.

#### WR-604: The picker's "the holder is not offered" assertion cannot fail, and the picker's eligibility exclusions are never shown in the browser

**File:** `apps/csrm/e2e/request-pick-up.spec.ts:194-197`
**Issue:**
- **The assertion is vacuous.** `search.fill('Sam')` runs before the check that `option 'Bob Doe'` has count 0, and the search term alone excludes `Bob Doe`. The assertion passes even if the current assignee is listed (13-UI-SPEC §6: "the current assignee is not listed").
- **The exclusions are never observed.** The CONTEXT table's UI outcome for an ineligible assignee is "Never offered by the picker". This covers the request's Requestor (Jane), a Requestor-only user and the service agent. No browser test observes the unfiltered list.

**Fix:** Assert on the unfiltered list before typing:
```ts
const options = picker.getByRole('option');
await expect(options.first()).toBeVisible();
await expect(picker.getByRole('option', { name: 'Bob Doe', exact: true })).toHaveCount(0);
await expect(picker.getByRole('option', { name: 'Jane Doe', exact: true })).toHaveCount(0);
await expect(picker.getByRole('option', { name: /Agent/ })).toHaveCount(0);
await search.fill('Sam');
```

#### WR-605: None of the G-4 keyboard and focus paths for assignment and marking is exercised in a real browser

**File:**
- `apps/csrm/e2e/request-pick-up.spec.ts:143-155, 187-202, 299`
- `apps/csrm/e2e/request-notes.spec.ts:219-229`

**Issue:**
- **Only two keyboard behaviours are tested.** D-34 and 13-UI-SPEC §15 require a keyboard path for pick-up, assign, unassign, posting and marking. The UI-SPEC also fixes focus targets (§7.3: the block's status line after any block action or picker assign; the next `Pick up` after a row pick-up; the status line after `Undo`). The suite proves only `Ctrl+Enter` posting and focus landing in the picker's search.
- **Everything else is driven by mouse.** Every assignment action, picker choice, Undo and switch toggle is a `.click()`. None of the following is tested:
  - arrows, `Enter` and `Ctrl+Enter` in the picker;
  - `Space` on the AI switch;
  - `Alt+T` for Undo;
  - focus on the status line or the next `Pick up`.
- **Why the browser matters here.** jsdom unit tests do not model real focus movement across Radix portals and toasts. The browser is the only place these G-4 items can regress visibly.

**Fix:** Drive one journey by keyboard at both widths. For example, in `REQ08_REASSIGN_THROUGH_PICKER`:
- `trigger.focus(); press('Enter')`;
- type, then `ArrowDown` and `Enter` to choose;
- `Tab` to the reason, then `Control+Enter`;
- `expect(section.getByText('Assigned to Sam Analyst')).toBeFocused()`.

In `REQ08_PICK_UP_FROM_QUEUE_ROW`, assert the focus target after the row pick-up. In `COLLAB01_MARK_CHANGES_AI_INPUTS`, toggle with `mark.press('Space')`.

#### WR-606: Axe and overflow coverage has holes on new Phase 13 states, and page overflow is never checked at 1440

**File:**
- `apps/csrm/e2e/request-pick-up.spec.ts:95-101, 216, 224-240, 383-403`
- `apps/csrm/e2e/request-notes.spec.ts:40-46, 154-172, 288-310, 449-467, 556`
- `apps/csrm/e2e/app-shell.spec.ts:127-158`

**Issue:**
- **Overflow is checked at 375 only.** `expectNoHorizontalOverflow` returns early unless the width is 375. Nothing checks page overflow at 1440, where the Requests table gained a tenth column (`Assigned to`). §2.2 requires such a table to scroll inside its labelled region rather than the page.
- **Several new states never get an axe scan.** Zero serious or critical violations are never checked on:
  - the requesting analyst's own request page, with the "You raised this request…" lines (`REQ08_OWN_REQUEST_NO_PICK_UP`, `COLLAB01_REQUESTING_ANALYST_NO_MARK`);
  - the Secondary Requestor's refused request page and her Home (`COLLAB01_OTHER_REQUESTOR_REFUSED`, the Home half of `COLLAB01_OTHER_REQUESTOR_SEES_NO_FLAG`);
  - the hub with the AI-inputs signal card (line 556 checks overflow only);
  - the expanded assignment history, `ol` named `Assignment history` (line 216 checks overflow only);
  - the quick-find option with the assignee line;
  - the colleague's request page in `REQ08_COLLEAGUE_FOLLOWS_JOB`;
  - the restored composer with its caption;
  - the new header role tag `Second Security Analyst` at 375 in `app-shell`, where the file's own `expectAccessibleWithoutOverflow` helper goes unused.

**Fix:** Call `expectNoSeriousViolations` at each of those points. Make the overflow helper width-agnostic: assert `document.documentElement.scrollWidth <= window.innerWidth` at every width. In `app-shell`, replace the hand-written overflow poll with `expectAccessibleWithoutOverflow(page, …)`.

#### WR-607: The run sheet's new `Notes` group (D-28, §10.3) is never opened in a browser, although its link behaviour only exists in a browser

**File:** `apps/csrm/e2e/request-notes.spec.ts:516-580`
**Issue:**
- **The plan claims browser proof.** 13-18 ("show which notes a run used … prove … in the browser") lists `COLLAB01_AI_INPUTS_CHANGED_SIGNAL` as its e2e.
- **The test cannot show an included note.** It marks the note after the only generation, so the run included no notes. It never opens `Show what the AI used`; it asserts only that this button exists (line 566).
- **No other spec does it either.** `ai-context-provenance.spec.ts` is unchanged in Phase 13.
- **What remains unproven in a browser:**
  - `1 note included`, and the row `{part} note · {time} · {n} characters`;
  - the absence of note text (G-3, T-13-58);
  - the 13-18 behaviour "the sheet link closes the sheet, then navigates" (Radix `Close asChild` around `next/link`; 13-18-SUMMARY line 30). That behaviour depends on real event ordering, which unit tests cannot observe.

**Fix:** In a journey of its own:
1. Jane posts a note.
2. Bob marks it before generating.
3. Bob opens the questionnaire review and the sheet.
4. Assert:
```ts
const sheet = page.getByRole('dialog', { name: 'What the AI used' });
await expect(sheet.getByText('1 note included', { exact: true })).toBeVisible();
await expect(sheet.getByRole('link', { name: /^Requestor note · / })).toBeVisible();
await expect(sheet).not.toContainText(janesNote);
await sheet.getByRole('link', { name: /^Requestor note · / }).click();
await expect(sheet).toHaveCount(0);
await expect.poll(() => new URL(page.url()).hash).toMatch(/^#note-/);
```

### Info

#### IN-601: Stale count example in the navigation helper

**File:** `apps/csrm/e2e/helpers/navigation.ts:39-40`
**Issue:** The doc comment still gives `"Requests, 9 need attention", D-10` as the count format. Phase 13 (D-14) changed it to `Requests, 9 waiting for pick-up`. The same stale wording survives outside this lane in `assessment-navigation-lifecycle.spec.ts:288` and `assessment-release-workflow.spec.ts:75`, as comment and message strings only.
**Fix:** Update the example to `"Requests, 9 waiting for pick-up"` (13 D-14).

#### IN-602: COLLAB01_NOTES_CLOSED_ON_RELEASED claims an assertion it does not make

**File:** `apps/csrm/e2e/request-notes.spec.ts:175-176, 187-193`
**Issue:** The comment says "the empty thread reads No notes" (§8.5, window closed with none), but the test asserts only the closed line and the absent composer.
**Fix:** Add `await expect(notes.getByText('No notes', { exact: true })).toBeVisible();`. Otherwise, drop the claim from the comment.

#### IN-603: Two journeys depend on a one-way state of a shared seeded record

**File:**
- `apps/csrm/e2e/request-pick-up.spec.ts:599-611`
- `apps/csrm/e2e/request-notes.spec.ts:178-196`

**Issue:** `REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT` asserts `Not picked up · Pick up on the request page` on the seeded released `RAR-E2E-NAV-OWNER-001`, then lands on its Assignment block with `Pick up` offered. Picking up a released request is allowed but can never be undone (`ASSIGNMENT_REQUIRED`, D-08). If any future spec picks this fixture up, for example Phase 17's planned "the analyst picks up the request" slice, every later read of it in the run fails, depending on order. Today nothing does, so this is latent.
**Fix:** Record in the seed, and in the `playwright.config.ts` comment that already names this fixture, that it must stay unassigned (read-only for assignment). Alternatively, give the legacy-released state its own seeded record that no journey may change.

#### IN-604: Helpers duplicated across the two new specs and within one

**File:**
- `apps/csrm/e2e/request-pick-up.spec.ts:14-27, 78-117, 405-410, 570-576`
- `apps/csrm/e2e/request-notes.spec.ts:17-68, 355-360, 492-501`

**Issue:** The two specs each define their own identical copies of these helpers:
- `expectStrapiHealthy`, `switchTo`;
- `expectNoSeriousViolations`, `expectNoHorizontalOverflow`;
- `summaryValue`, `toastWith`, `shownListTotal`;
- the "generate and wait for the questionnaire link" poll (`bobGeneratesQuestionnaire` and its inline copy in `REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT`).

`REQ08_COLLEAGUE_FOLLOWS_JOB` also hand-writes the overflow poll (lines 78-83) that `expectNoHorizontalOverflow` (line 95) provides. A later fix to one copy, for example WR-606's width-agnostic overflow, will miss the others.
**Fix:** Move these into `e2e/helpers/` (for example a `request-collaboration.ts`) and import them in both specs.

#### IN-605: Browser states that no journey covers

**File:**
- `apps/csrm/e2e/request-pick-up.spec.ts` (whole file)
- `apps/csrm/e2e/request-notes.spec.ts` (whole file)

**Issue:** No journey reaches these states. Vitest may cover them, but the browser does not:
- the hub's `Owner` row is never asserted absent; only `Requestor` is asserted present;
- the Requestor page's `Not picked up yet` (§5.1);
- the queue's `You raised it` caption with no `Pick up` (§2.2, §2.3);
- the block's `Assign`, `Assign to me` and `Return to queue` actions, which are reached only through Undo of a pick-up;
- the `ASSIGNMENT_CHANGED` refresh that names the new holder (§7.4);
- "only Reassign" on a released request (D-08);
- the `beforeunload` guard (§9.3), which Playwright can observe via `page.on('dialog')` and `page.close({ runBeforeUnload: true })`;
- the signal's `Unmarked since` path, the signal on the assessment target, and the signal clearing after a new context-wide run.

**Fix:** Add the cheap ones to existing journeys:
- `expect(summaryValue(page, 'Owner')).toHaveCount(0)`;
- `Not picked up yet` on Jane's page before the pick-up;
- the `You raised it` row in `REQ08_OWN_REQUEST_NO_PICK_UP` via a queue search;
- a two-context `ASSIGNMENT_CHANGED` case in which Sam picks up while Bob's page is stale.

---

_Reviewed: 2026-10-09T08:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

