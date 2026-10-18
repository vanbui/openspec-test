# Phase 3 Multi-Source Coverage Audit

SOURCE | ID | Feature/Requirement | Plan | Status | Notes
--- | --- | --- | --- | --- | ---
GOAL | — | Requestor completes authorised data-defined questionnaires over time and submits valid responses for analyst review | 03-01, 03-04–03-12 | COVERED | Full mounted and browser path
REQ | QUES-01 | Requestor sees only questionnaires for authorised requests | 03-03, 03-04, 03-07, 03-08, 03-11, 03-12 | COVERED | Owner scope and discovery
REQ | QUES-02 | Grouped conditional renderer with progress/unanswered indication | 03-02, 03-05, 03-09, 03-12 | COVERED | Shared JSON/domain contract and renderer
REQ | QUES-03 | Save draft and resume | 03-02, 03-05–03-07, 03-09, 03-12 | COVERED | Server-owned envelope and actions
REQ | QUES-04 | Valid submission after explicit confirmation | 03-02, 03-03, 03-05, 03-07, 03-09, 03-12 | COVERED | Atomic server submit and ConfirmDialog
REQ | QUES-05 | Analyst reviews definitions and submitted responses | 03-03, 03-04, 03-06, 03-07, 03-10, 03-11, 03-12 | COVERED | Analyst list/detail reuse renderer and route reachability
CONTEXT | D-01 | Reuse identity, authorization, UI, typed service, and dual-server foundations | 03-01, 03-04, 03-07–03-12 | COVERED | Existing patterns referenced explicitly
CONTEXT | D-02 | Full questionnaire/question authorization, exact grants, owner chain, analyst read-all, answer guards, no schema edits | 03-03–03-06, 03-12 | COVERED | Mounted tests plus source invariants
CONTEXT | D-03 | Versioned options/answer JSON convention and web Zod; no invented fields | 03-02, 03-05, 03-07, 03-09 | COVERED | Contract note and paired engines
CONTEXT | D-04 | Dev-gated idempotent realistic Jane seed; decide File upload | 03-02, 03-06, 03-09 | COVERED | File upload explicitly deferred/fail-closed
CONTEXT | D-05 | Discovery, grouped fill, progress, conditions, validation, save/resume, confirmed submit, five states | 03-01, 03-08, 03-09, 03-11, 03-12 | COVERED | Requestor slice, dashboard reachability, and E2E
CONTEXT | D-06 | Analyst uses same read-only renderer | 03-09, 03-10, 03-11, 03-12 | COVERED | Single exported renderer invariant and navigation
CONTEXT | D-07 | Server Components, RHF+Zod, typed services, semantic tokens, WCAG, responsive, five states | 03-02, 03-07–03-12 | COVERED | Automated/component/E2E plus manual UAT
CONTEXT | D-08 | Dual-server journey and mounted cross-owner/state-guard coverage | 03-01, 03-04, 03-05, 03-12 | COVERED | W0 and final GREEN
CONTEXT | D-09 | OpenAPI/controller/catalogue/generated client alignment and api:check | 03-03, 03-07, 03-12 | COVERED | Spec changes trigger generation
RESEARCH | — | Derived questionnaire state from answer envelopes and owning request state | 03-02, 03-05 | COVERED | No new lifecycle field
RESEARCH | — | Hidden answers cleared and active requiredness recomputed server-side | 03-02, 03-05, 03-09 | COVERED | T-03-04/T-03-06 controls
RESEARCH | — | Atomic full-batch submission | 03-05, 03-12 | COVERED | T-03-05 transaction proof
RESEARCH | — | Exact development permissions and catalogue parity | 03-03, 03-06 | COVERED | No IAM/future route actions
RESEARCH | — | Five UI states, shared renderer, accessibility/responsive behavior | 03-08–03-12 | COVERED | Binding UI contract D-05–D-07
RESEARCH | — | File upload deferred with deliberate fail-closed behavior | 03-02, 03-05, 03-06, 03-09, 03-12 | COVERED | Excluded from seed; required visible blocks

## Exclusions (not gaps)

- Production Keycloak integration remains Phase 8.
- File upload plumbing/rendering is deferred by the Phase 3 research decision; explicit unavailable/rejection behavior is in scope and covered.
- New questionnaire fields/content types and a frontend API facade are prohibited.
- Analyst review comments, review completion, and assessment generation are later workflow scope; catalogue entries may remain documented but are not served by Phase 3.
