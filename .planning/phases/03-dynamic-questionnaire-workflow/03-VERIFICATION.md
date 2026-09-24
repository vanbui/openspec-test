---
phase: 03-dynamic-questionnaire-workflow
verified: 2026-08-30T06:25:15+10:00
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Inspect the Requestor list, editable questionnaire, confirmation dialog, submitted view, and analyst review at 375px, 768px, and 1440px, including 200% zoom."
    expected: "Grouped content remains legible, controls and actions remain well placed, and no content is clipped or obscured."
    result: passed
    evidence: "Recorded in 03-HUMAN-UAT.md after live desktop, mobile, and 200%-zoom-equivalent workflow checks."
  - test: "Complete the seeded conditional questionnaire using only the keyboard, hide a focused dependent field, trigger invalid submission, and follow the error summary."
    expected: "Focus remains visible and understandable, moves safely when a conditional field disappears, and reaches the first invalid active question in logical order."
    result: passed
    evidence: "Recorded in 03-HUMAN-UAT.md after keyboard-only conditional-field, validation-summary, and focus-order checks."
---

# Phase 3: Dynamic Questionnaire Workflow Verification Report

**Phase Goal:** As a Requestor, I want to complete data-defined questionnaires for my authorised requests over time and submit them when valid, so that Security Analysts receive the structured context they need to review and assess risk.
**Verified:** 2026-08-30T06:25:15+10:00
**Status:** passed
**Re-verification:** Yes — both human UAT items passed after the independent review remediations and full green gate rerun

## User Flow Coverage

User story: “As a Requestor, I want to complete data-defined questionnaires for my authorised requests over time and submit them when valid, so that Security Analysts receive the structured context they need to review and assess risk.”

| Step | Expected | Evidence | Status |
| --- | --- | --- | --- |
| Discover authorised work | Jane reaches My Questionnaires and sees only questionnaires belonging to her authorised requests | Owner filter is injected server-side in `questionnaire-scope.ts:81-107`; mounted IDOR/list tests pass; Playwright asserts only `QUES-DEV-001` is shown | ✓ VERIFIED |
| Complete a data-defined questionnaire | Grouped questions render from persisted definitions; conditions, supported types, progress, and unanswered indicators respond to answers | Closed parser/domain engine in `questionnaire-schema.ts` and `questionnaire-domain.ts`; shared renderer in `questionnaire-renderer.tsx`; 31 schema/renderer tests pass | ✓ VERIFIED |
| Save and resume | An incomplete draft can be saved, hidden values are removed, and persisted values return after reload | `saveCurrentDraft` sends active values without full-submit validation; Strapi normalizes and persists server-owned draft envelopes; mounted and browser resume checks pass | ✓ VERIFIED |
| Submit when valid | Invalid submission is blocked and focused; valid submission requires explicit irreversible confirmation | `prepareSubmission` validates active required answers before `ConfirmDialog`; Strapi recomputes visibility/requiredness and commits the submitted batch transactionally; E2E confirmation path passes | ✓ VERIFIED |
| Become immutable | Submitted answers cannot return to draft or be edited, including concurrent PATCH/POST attempts | Server mutation serialization, row lock, reload inside transaction, submitted-batch guard, mounted concurrency test, and read-only UI transition all pass | ✓ VERIFIED |
| Analyst receives structured context | Bob discovers the submission and reviews the authoritative definition/answers without edit controls | Analyst exact-grant scope, submitted-batch masking, `QuestionnaireReview` composing `QuestionnaireRenderer mode="read-only"`, and cross-role E2E all pass | ✓ VERIFIED |
| Outcome | Security Analysts receive reviewable structured context from an authorised Requestor workflow | The independent dual-server journey passed end-to-end against isolated persisted Strapi data | ✓ VERIFIED |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Requestors can access only questionnaires related to their authorised requests, and hostile IDs/filters do not broaden scope | ✓ VERIFIED | Server policy derives owner/all scope; collection queries overwrite owner filters; resource policy checks `assessmentRequest.requestor`; mounted list, filter, direct IDOR, anonymous, inactive-user, and ungranted-role checks pass. |
| 2 | Persisted JSON defines deterministic grouped and conditional questions using a closed versioned contract without new fields/entities | ✓ VERIFIED | Web and Strapi parsers require `schemaVersion: 1`, exact keys, deterministic order, earlier compatible dependencies, valid types/choices/dates, and reject malformed graphs. Questionnaire content schemas have no Phase 3 changes (last schema commit is Phase 1). |
| 3 | The shared renderer supports Text, Long text, Boolean, Single select, Multi select, and Date with progress and unanswered indications; File upload fails closed | ✓ VERIFIED | Renderer branches exist for all supported types, derives visibility/progress outside JSX, and presents required unavailable uploads as blockers. Schema/renderer tests and E2E conditional path pass. |
| 4 | Draft answers can be saved incompletely, resumed later, and have hidden values cleared with server-owned metadata | ✓ VERIFIED | UI draft save bypasses submit completeness validation; Server Action allowlists `questionKey/value`; Strapi stamps draft metadata and filters inactive keys; browser reload restores persisted values. |
| 5 | Submission is valid-only, explicit, atomic, and irreversible even under concurrent mutation and injected write failure | ✓ VERIFIED | Confirmation opens only after active-form validation; Strapi reloads under serialized transaction/row lock, recomputes active requiredness, stamps one batch timestamp, rejects submitted batches, and rolls back a second-write failure. Mounted race and rollback tests pass. |
| 6 | Analysts can review definitions and submitted responses, while draft response values remain masked | ✓ VERIFIED | Analyst list/detail routes require exact grants; question projection masks the entire batch unless all active answers are submitted; inactive conditional answers remain absent; mounted masking and conditional-submission tests pass. |
| 7 | Requestor edit and analyst review use one renderer rather than parallel implementations | ✓ VERIFIED | `questionnaire-review.tsx` imports `QuestionnaireRenderer` and invokes it with `mode="read-only"`; no second question-control renderer exists in the analyst feature. |
| 8 | Exactly the served Phase 3 API surface is represented consistently by routes, OpenAPI, generated client types, and byte-identical catalogues; Phase 4 mutations remain unserved | ✓ VERIFIED | Eight mounted workflow operations have exact grant parity; OpenAPI/generated paths agree; catalogue SHA-256 hashes match; generic CRUD is unmounted; review-comment/complete-review/assessment-generation routes are not mounted or development-enabled. |
| 9 | Web pages use the server-only typed API layer and remain reachable through capability-driven navigation/dashboard links without treating visibility as authorization | ✓ VERIFIED | Pages call questionnaire service functions; service imports `server-only` and generated paths; no direct feature/page fetch exists. Navigation exposes role-appropriate routes, while Strapi remains the enforced boundary. Dashboard builds an encoded questionnaire href in its service and the component consumes `item.href`. |
| 10 | The complete mounted Requestor-to-analyst workflow runs against an idempotent seed and isolated E2E database with automated accessibility/responsive coverage | ✓ VERIFIED | Dev seed is triple-gated/idempotent and covers supported types; Playwright uses `.tmp/playwright-03-12-${process.pid}.db`, `workers: 1`, and `reuseExistingServer: false`; independent E2E run passed. Qualitative visual/focus review remains in Human Verification. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `docs/contract-gaps/phase-03-questionnaire-json-contract.md` | Versioned JSON convention and File upload decision | ✓ VERIFIED | Substantive contract note; matches schemaVersion/type behavior in both parsers. |
| `apps/web/src/features/questionnaires/questionnaire-schema.ts` | Closed external-data normalization | ✓ VERIFIED | Substantive Zod validation; imported by domain/service/actions and covered by 22 tests. |
| `apps/web/src/features/questionnaires/questionnaire-domain.ts` | Ordering, visibility, clearing, progress, completeness | ✓ VERIFIED | Pure implementations are consumed by the renderer and covered by tests. |
| `docs/references/specification.json` | Eight Phase 3 API operations and DTOs | ✓ VERIFIED | All eight routes present and exercised by catalogue parity tests/generated client. |
| `apps/web/src/lib/api/generated/schema.d.ts` | Generated typed questionnaire paths | ✓ VERIFIED | Contains every served `/v1` path consumed by `questionnaire-service.ts`. |
| `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts` | Actor-aware bounded reads, projection, masking | ✓ VERIFIED | Substantive and wired through controller/policy; active-branch fix verified. |
| `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-definition.ts` | Authoritative backend definition/value validation | ✓ VERIFIED | Substantive and called inside every mutation reload. |
| `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts` | Secure draft and atomic submit workflow | ✓ VERIFIED | Substantive and controller-wired; concurrency and rollback fixes execute in production path. |
| `apps/strapi/src/bootstrap/seed-questionnaire-workflow.ts` | Realistic idempotent dev fixture | ✓ VERIFIED | Bootstrap-wired, production-parser validated, triple-gated, and integration-tested. |
| `apps/web/src/features/questionnaires/questionnaire-service.ts` | Server-only typed read/mutation layer | ✓ VERIFIED | Uses generated client paths and runtime response parsing; no raw UI transport. |
| `apps/web/src/features/questionnaires/questionnaire-actions.ts` | Validated, value-preserving Server Actions | ✓ VERIFIED | Unknown input is parsed; safe error mapping and success-only revalidation are tested. |
| `apps/web/src/features/questionnaires/questionnaire-renderer.tsx` | Shared edit/read-only renderer | ✓ VERIFIED | 380 substantive lines, wired to both Requestor and analyst routes and Server Actions. |
| Requestor list/detail routes and state components | Discover, edit, resume, submit, read-only states | ✓ VERIFIED | Server Components consume owner-scoped services; loading/error/permission/empty/populated states exist and tests pass. |
| Analyst list/detail routes and state components | Discover and review submitted context | ✓ VERIFIED | Server Components consume analyst services and discard answers for non-submitted safe states. |
| `apps/web/e2e/questionnaire-workflow.spec.ts` | Full mounted acceptance contract | ✓ VERIFIED | Independent run: 1/1 passed in 36.9 seconds against real isolated servers/database. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Playwright journey | Strapi and Next.js | Health checks, separate role sessions, isolated DB | ✓ WIRED | Independent dual-server run passed. |
| Contract note | Web/Strapi parsers | Matching schemaVersion 1 keys/types | ✓ WIRED | Both reject malformed definitions and unsupported upload values. |
| OpenAPI | Generated TypeScript | Generated `/v1` path keys | ✓ WIRED | Paths present and consumed by service; contract test passes. |
| Catalogues | Mounted routes/policy | Exact `METHOD:/api/v1/...` FunctionAPI operations | ✓ WIRED | Catalogue copies hash-identical and exact-grant test passes. |
| Authorization policy | Scope/workflow services | Policy-derived actor, scope, and ownership | ✓ WIRED | Controller consumes `questionnaireActor`; owner/all query decisions are server-derived. |
| Controller | Workflow service | `saveAnswers` / `submitQuestionnaire` | ✓ WIRED | PATCH/POST mounted tests exercise real persistence. |
| Bootstrap index | Questionnaire seed | `seedQuestionnaireWorkflow` after core seed | ✓ WIRED | Seed integration test proves idempotence and restoration. |
| Requestor pages | Typed service | `listMyQuestionnaires`, detail, questions | ✓ WIRED | Data reaches list/detail renderer through parsed service results. |
| Renderer | Server Actions | Active answer inputs, save, then confirmed submit | ✓ WIRED | Component tests and E2E observe persistence and transition. |
| Analyst review | Shared renderer | `mode="read-only"` | ✓ WIRED | Same renderer displays submitted definitions/answers without controls. |
| Dashboard service | Dashboard component | Encoded `item.href` | ✓ WIRED | SDK literal check was a false negative: href is intentionally produced in service and rendered by component. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| Requestor questionnaire list | `questionnaires` | Server-only generated-client GET → Strapi owner-filtered documents query | Yes, mounted DB records | ✓ FLOWING |
| Requestor renderer | `definition`, RHF `answers` | Authorised detail/questions GET; PATCH response; persisted reload | Yes, parsed definitions and answer envelopes | ✓ FLOWING |
| Analyst review | `questionnaire`, `definition` | Exact-grant list/detail/questions GET → submitted-batch projection | Yes, submitted answers; drafts masked | ✓ FLOWING |
| Requestor dashboard | questionnaire action items | Owner-scoped list + complete status summary | Yes, document IDs/progress from Strapi | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Questionnaire schemas, services, actions, renderer, states, and dashboard behavior | `pnpm --filter @csrm/web exec vitest run ...questionnaire... ...dashboard...` | 6 files, 50 tests passed in 3.07s | ✓ PASS |
| Mounted authorization, masking, mutation, concurrency, rollback, seed, and catalogue behavior | `pnpm --filter @csrm/strapi test` | 24/24 passed in 37.6s | ✓ PASS |
| Real Requestor-to-analyst browser workflow | `pnpm --filter @csrm/web test:e2e -- questionnaire-workflow.spec.ts` | 1/1 passed in 36.9s | ✓ PASS |

The test commands emitted an environment warning because the verifier process used Node 22.19.0 while the root package declares Node 24.19.x. Compilation and all checks nevertheless completed successfully; repeat the release gate on the declared Node version.

### Probe Execution

No `probe-*.sh` files or phase-declared probes exist. The phase-declared executable acceptance check is the Playwright command recorded above and was run independently.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| QUES-01 | 03-01, 03-03, 03-04, 03-06–03-08, 03-11, 03-12 | Requestor sees only questionnaires for authorised requests | ✓ SATISFIED | Server owner scope + mounted IDOR/filter tests + owner-only E2E discovery. |
| QUES-02 | 03-01, 03-02, 03-05, 03-06, 03-09, 03-12 | Data-defined grouped conditional questionnaire with progress/unanswered indication | ✓ SATISFIED | Closed definition/domain engine, shared renderer, component and E2E checks. |
| QUES-03 | 03-01–03-03, 03-05–03-07, 03-09, 03-12 | Save draft and resume later | ✓ SATISFIED | Allowlisted PATCH, server-owned draft metadata, reload/resume E2E. |
| QUES-04 | 03-01–03-03, 03-05–03-07, 03-09, 03-12 | Submit a valid questionnaire after explicit confirmation | ✓ SATISFIED | Active validation, confirmation dialog, atomic immutable submission, race/rollback tests. |
| QUES-05 | 03-01–03-04, 03-06, 03-07, 03-09–03-12 | Analyst reviews definitions and submitted responses | ✓ SATISFIED | Exact analyst grants, draft masking, shared read-only renderer, cross-role E2E. |

No Phase 3 requirements are orphaned.

### Contract, Authorization, and Test Integrity

- Both role/function/API catalogue files have the same SHA-256 hash (`DFAF37F396C09DF5…`).
- The mounted route table exposes the eight planned operations; generic questionnaire/question CRUD routes are disabled.
- Phase 4 review-comment, complete-review, and assessment-generation catalogue intents are not routes and are not granted by the development permission seed.
- The questionnaire and question content-type schemas were not modified by Phase 3; their most recent history is Phase 1 commit `4e2f1e8`.
- Review fixes `8293bcd`, `9fb1e9d`, `b4e09c3`, and `d5985d5` exist and their changed production paths are exercised by the passing mounted tests.
- Rollback injection intercepts the real document-service update used by production submission; it is not a test-only persistence implementation.
- Playwright uses a process-specific SQLite filename, one worker, and no server reuse, preventing prior local state from turning the journey green.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| Phase file set | — | No unreferenced `TBD`, `FIXME`, or `XXX`; no placeholder implementation, arbitrary UI fetch, hard-coded feature colour, or empty handler found | ℹ️ Info | No blocker debt marker or stub evidence. |
| `.planning/phases/03-dynamic-questionnaire-workflow/03-VALIDATION.md` | 4, 33-40 | Planning-time status/check matrix remains `draft`/pending although implementation tests now exist | ℹ️ Info | Stale planning metadata, not a code or goal-achievement gap; this report contains current evidence. |

### Disconfirmation Pass

- **Human verification closed:** Responsive hierarchy, 200% zoom legibility, and perceived focus clarity passed the two recorded checks in `03-HUMAN-UAT.md`.
- **Potentially misleading test checked:** The concurrency test allows either `[200,200]` or `[200,409]`, but it does not pass on status alone; it reloads every answer and requires all final envelopes to remain submitted. Production also reloads after acquiring the serialized transaction lock, so the immutable outcome is substantively tested.
- **Uncovered error path:** There is no focused assertion for a database failure while acquiring the questionnaire row lock. Such a failure bubbles as a generic 500 and cannot mutate answers because it occurs before persistence. This is informational rather than a Phase 3 goal gap.

### Human Verification Passed

#### 1. Responsive hierarchy and zoom

**Test:** Inspect the Requestor list, editable questionnaire, confirmation dialog, submitted view, and analyst review at 375px, 768px, and 1440px, including 200% zoom.

**Expected:** Grouped content remains legible, controls and actions remain well placed, and no content is clipped or obscured.

**Result:** Passed. The complete workflow remained legible and unclipped at desktop, mobile, and 200%-zoom-equivalent widths.

#### 2. Keyboard and focus clarity

**Test:** Complete the seeded conditional questionnaire using only the keyboard, hide a focused dependent field, trigger invalid submission, and follow the error summary.

**Expected:** Focus remains visible and understandable, moves safely when a conditional field disappears, and reaches the first invalid active question in logical order.

**Result:** Passed. Keyboard operation, conditional focus behavior, invalid-submit focus movement, and status announcements were clear and correct.

### Gaps Summary

No implementation or human-verification gaps remain. All ten merged roadmap/plan truths and all five requirements are supported by substantive, wired code, the remediated independent review findings, the full green gate rerun, and both passed human UAT items.

---

_Verified: 2026-08-30T06:25:15+10:00_
