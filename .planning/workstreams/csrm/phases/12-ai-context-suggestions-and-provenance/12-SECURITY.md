---
phase: "12"
slug: ai-context-suggestions-and-provenance
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-08"
---

# Phase 12 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

The independent ASVS L1 audit (`gsd-security-auditor`, 2026-10-08) returned **SECURED**: 57 unique threats across the 19 plans' registers (75 entries; `T-12-SC` repeats in every plan with the same accept disposition), all 57 closed, `threats_open: 0`. It verified each mitigation at HEAD `c4db997`, after the stage B review fixes; where a fix moved or strengthened a mitigation, the evidence cites the current code and test. No plan SUMMARY carries a `## Threat Flags` section, so there are no unregistered flags.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Requestor text → prompt → AI provider | Request fields and answers are untrusted and must never act as instructions; they travel only inside the escaped, delimited `<requestorData>` block | Request text, answers (may hold personal data) |
| Strapi records → AI provider | Only the minimised fields leave the system, and only when the AI data policy allows the request's classification | Minimised request, system, asset, Risk Type and control facts |
| Operator configuration → Strapi | The classification ceiling and the transcript flag come from the environment at boot; outside development a missing ceiling fails closed and an invalid one stops boot | Configuration |
| Provider output → questionnaire and draft records | Model output is untrusted until the adapter and the closed parser accept it; ratings, keys, links and classifications are server-owned | Model-written text and choices |
| Browser → Server Actions → Strapi operations | Run ids, source keys and decision batches are untrusted input; the server decides, and the optimistic UI is a hint | Ids, closed decision items |
| Any caller → run read and decision operation | Runs and decisions are human-Security-Analyst only; an unknown or out-of-scope run is a uniform 404 | Run facts, context summary |
| Automation identity → request and AI routes | The service agent must not start AI runs or write requests (D-32, D-33, R-08-42) | Requests, jobs |
| Strapi → Requestor | Requestor projections carry the AI disclosure only: no provider, model, run, generator or per-field state | Released assessment, questionnaire, lists |
| Mutations and decisions → assessment aggregate | Every change passes the one mutability guard, the serialisation and the accepted-edit rule; AI values reach release only after human review | Review state, provenance, control implementations |
| Stored JSON → read paths | A malformed or stale envelope never denies a read or crashes a page, but fails closed at the release gate | `aiProvenance`, run envelopes |
| Model or analyst text → DOM | Help text, claims, rationales and statements render as text, never markup | Display text |
| Suites → AI provider and working tree | No suite calls a hosted model or leaves the tree dirty | Test data |
| Plan → schema | A content-type change runs only after its dated governance approval (G-6) | Content-type schemas |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-12-01 | Tampering | Content-type schemas | high | mitigate | Blocking-human checkpoint (12-01) and a precondition on the dated approval (12-04); approval `da01ba0` precedes the schema commit `1563b95`; the freeze check at HEAD finds exactly the three approved schema files | closed |
| T-12-02 | Repudiation | The approval itself | medium | mitigate | Dated approval line in the contract-gap record; the pilot's answer copied into 12-01-SUMMARY | closed |
| T-12-03 | Information disclosure | `evaluateAiDataPolicy` outside development | high | mitigate | `data-policy.ts` fails closed (`AI_POLICY_NOT_CONFIGURED`) without a ceiling outside the development double key; an invalid ceiling stops `register`; policy grid, production fail-closed (WR-201) and boot tests | closed |
| T-12-04 | Information disclosure | `logCompletionDiagnostic` | high | mitigate | Logs only with the flag on and both development keys; boot warning elsewhere; R-08-12 closed; transcript-gate tests for both providers restored (CR-201) | closed |
| T-12-05 | Tampering | Test outcomes via a developer `.env` | medium | mitigate | Strapi harness and Playwright pin the deterministic provider, an empty ceiling and the transcript flag off, and the harness restores them | closed |
| T-12-06 | Elevation of privilege | Prompt injection via Requestor text | high | mitigate | `promptDataTag` escaping inside one `<requestorData>` block, declared data by the trusted instructions; analyst slot empty; no tools; guardrail tests | closed |
| T-12-07 | Information disclosure | Personal data in the context | high | mitigate | Field allow-lists exclude identities, numbers, dates, owners and comments; answer sources stored by position (WR-105); minimisation tests for both operations, including "no Requestor text reaches the stored context summary" | closed |
| T-12-08 | Denial of service | Context flooding | medium | mitigate | Count, character and 64 KB summary bounds raise `CONTEXT_TOO_LARGE` before any run or provider call (WR-104, WR-205 tests) | closed |
| T-12-09 | Tampering | `aiProvenance` via update routes | high | mitigate | Not in the writable field lists; every update parses closed writable input; the run's core router is `only: []`; parser tests | closed |
| T-12-10 | Repudiation | `CsrmAiRun.decisions` | medium | mitigate | Append-only, closed parse, 5,000-event bound; an unwritable history refuses the change in the transaction with `AI_RUN_RECORD_UNAVAILABLE` (WR-103) | closed |
| T-12-11 | Information disclosure | Run record contents | medium | mitigate | Closed context-summary parser; the run read is human-analyst only (T-12-28) | closed |
| T-12-12 | Elevation of privilege | Injection into questionnaire generation | high | mitigate | Builder prompt with the trust instruction, closed adapter then the definition parser, no tools | closed |
| T-12-13 | Tampering | Model output bounds | medium | mitigate | 6 to 20 questions, no Boolean or upload types, help text at most 2,000 characters, server-assigned keys and orders, parser re-applied | closed |
| T-12-14 | Repudiation | Unrecorded provider calls | medium | mitigate | One run created immediately before each call, completed in the persisting transaction or failed with a safe code; exact run-count tests | closed |
| T-12-15 | Tampering | Model naming records outside the request | high | mitigate | Wire enums hold this request's keys only; unknown keys are invalid output; the parser checks document ids and is re-applied in the workflow | closed |
| T-12-16 | Tampering | Model-chosen ratings or Accept | high | mitigate | Ratings derived from the 5×5 scale; Accept demoted to Treat when not permitted, with suggestions, or without a rationale (WR-203), and refused by the parser | closed |
| T-12-17 | Repudiation | Invented facts presented as grounded | medium | mitigate | Unknown sources dropped with an adjustment; uncited claims stored and capped (WR-107); citation tests (WR-204) | closed |
| T-12-18 | Elevation of privilege | Injection through answers | high | mitigate | Answers rendered as escaped values; guardrail test asserts one closing tag and escaped payloads | closed |
| T-12-19 | Information disclosure | Generation above the ceiling | high | mitigate | Refused at enqueue, at retry (IN-104) and at execution before any run or provider call; data-policy integration tests with zero provider calls | closed |
| T-12-20 | Repudiation | Unattributed AI-value edits | medium | mitigate | `markEditedFields` plus an `edited` run event in the same mutation | closed |
| T-12-21 | Information disclosure | Error bodies leaking policy internals | low | mitigate | The transport forwards only a closed `reason` with fixed copy; three parity-checked reason lists | closed |
| T-12-22 | Information disclosure | `generation`, `aiOrigin` and run ids to the Requestor | medium | mitigate | Served to the analyst only; the Requestor's web parsers also drop them (CR-401); serialised forbidden-key test | closed |
| T-12-23 | Denial of service | Malformed governance log | low | mitigate | Null origins on an unreadable log; mounted test | closed |
| T-12-24 | Tampering | Help text rendered as markup | low | mitigate | 2,000-character bounds at generation, save and read; rendered as text; no `dangerouslySetInnerHTML` | closed |
| T-12-25 | Information disclosure | Provenance or provider to the Requestor | medium | mitigate | The Requestor variant carries only `aiAssisted`; `generatedBy` removed from the released detail and null on the Requestor's own list (WR-304, D10) | closed |
| T-12-26 | Denial of service | Per-field lookups | low | mitigate | Three bounded `$in` reads per projection | closed |
| T-12-27 | Denial of service | Malformed provenance on the editor read | low | mitigate | Closed parsers return null; unknown citation keys read "Source no longer available" | closed |
| T-12-28 | Information disclosure | IDOR on `GET /api/v1/ai_runs/{runId}` | high | mitigate | Analyst-only Function in both byte-identical catalogue copies, human-analyst guard, uniform 404, matrix row and mounted refusals | closed |
| T-12-29 | Elevation of privilege | Service agent starting AI generation | high | mitigate | Three analyst-only API Functions plus the AI-assistance human-analyst guard; matrix rows with persistence snapshots | closed |
| T-12-30 | Elevation of privilege | Service agent writing requests (R-08-42) | high | mitigate | The agent no longer holds `core_api`, `delete_api` or `reference_data_api`; exact-set role reconciliation; matrix rows; R-08-42 closed | closed |
| T-12-31 | Information disclosure | Requestor text in the run read | medium | mitigate | The run read serves no proposal or decisions; position labels (WR-105) | closed |
| T-12-32 | Elevation of privilege | Requestor or agent deciding proposals | high | mitigate | Analyst-only decision Function plus the guard; matrix row with a real one-item batch (IN-204) | closed |
| T-12-33 | Tampering | Changes to a released assessment | high | mitigate | `assertMutableAssessment` inside `withMutableAssessmentMutation` on all six mutation entry points | closed |
| T-12-53 | Tampering | Content change skipping the accepted-edit rule | medium | mitigate | Accepted-edit is the default; only the decision operation passes a selector, which returns none when no content changed | closed |
| T-12-34 | Tampering | Forged targets, fields or suggestions | medium | mitigate | Closed batch parser with strict strings (WR-106); targets reloaded under the lock and checked against the assessment (CR-202 test); atomic transaction | closed |
| T-12-36 | Repudiation | Unattributed review acts | medium | mitigate | `by` and `at` on field and suggestion facts plus in-transaction run events | closed |
| T-12-54 | Tampering | AI Accept beside a planned control | high | mitigate | Post-batch check inside the transaction (`AI_ACCEPT_WITH_PLANNED_CONTROL`) | closed |
| T-12-35 | Tampering | Undo removing a changed control | medium | mitigate | Snapshot comparison (`AI_SUGGESTION_CONTROL_CHANGED`); a manual removal restores the suggestion (CR-02) | closed |
| T-12-55 | Tampering | Adding a control and confirming Accept in one batch | high | mitigate | The same post-batch check sees a control added in the batch, in either order | closed |
| T-12-56 | Elevation of privilege | Oversized or malformed action batch | low | mitigate | Strict Server Action input schema plus the server parser | closed |
| T-12-37 | Information disclosure | Offering a refused generation | medium | mitigate | `AiPolicyGate` on Generate, Retry and the failed-state Replace (WR-308); the server refusal stays the authority | closed |
| T-12-38 | Information disclosure | `aiPolicy` to a non-analyst | low | mitigate | The generation-jobs read is human-analyst only | closed |
| T-12-39 | Information disclosure | Provider, model or run in the Requestor's view | medium | mitigate | Released-assessment and questionnaire negatives with AI facts in the fixtures, and the browser negative (CR-401) | closed |
| T-12-40 | Elevation of privilege | Run read through a Server Action | medium | mitigate | Strict action input; a 403 renders the permission state | closed |
| T-12-41 | Denial of service | Editor bundle growth | low | mitigate | Header and notice server-rendered; sheet and source bodies behind `import()` with source checks; the route budget override (460,000 bytes) recorded with its reason (WR-407) | closed |
| T-12-42 | Elevation of privilege | Releasing unreviewed AI values | high | mitigate | `aiProposalsReviewed` in release readiness, failing closed on an unreadable envelope (CR-01); browser proof of the outstanding requirement | closed |
| T-12-43 | Tampering | Optimistic state divergence | medium | mitigate | `useOptimistic` with one action per act, rollback and a danger toast | closed |
| T-12-44 | Repudiation | Lost unsaved input | low | mitigate | Unsaved values survive decisions and refreshes (WR-404, WR-303 tests) | closed |
| T-12-45 | Tampering | Model text as markup (XSS) | high | mitigate | Rendered as text; no `innerHTML` in the web source | closed |
| T-12-46 | Information disclosure | Source popover beyond scope | medium | mitigate | Strict source key schema over existing scoped reads; a 403 renders the permission state | closed |
| T-12-47 | Tampering | Undo removing a changed control (web) | medium | mitigate | Server check per T-12-35; refused-Undo copy | closed |
| T-12-48 | Tampering | Help text as markup (XSS) | high | mitigate | Rendered as text; 2,000 bound on save | closed |
| T-12-49 | Information disclosure | Origin markers to the Requestor | low | mitigate | Server per T-12-22; web negative with every analyst AI fact in the fixture (CR-401) | closed |
| T-12-50 | Information disclosure | A suite calling a live model | high | mitigate | Harness and Playwright pins; hosted-provider tests target a loopback fake server; `node --test` loads no `.env` | closed |
| T-12-51 | Tampering | Dirty tree after the gate | medium | mitigate | The gate asserts a clean `git status`; recorded clean | closed |
| T-12-52 | Elevation of privilege | Requestor reaching the analyst editor | medium | mitigate | Browser negative plus the run-read and decision matrix rows | closed |
| T-12-SC | Tampering | npm installs | low | accept | See the accepted risks log: one direct declaration of the already-locked `knex@3.0.1`, no new package | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-12-01 | T-12-SC | Phase 12 adds no package. Plan 12-02 (`b651366`) declares `knex` 3.0.1 as a direct devDependency of `apps/backend` for the run-record tests; `knex@3.0.1` was already locked as a Strapi transitive, so `pnpm-lock.yaml` changes only in its importers section (+3 lines). The plans' wording "the lockfile is unchanged" is corrected here; the final gate's manifest check allows exactly this declaration. | Pilot (approved `knex` declaration, 12-02) | 2026-10-08 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-08 | 57 | 57 | 0 | gsd-security-auditor (ASVS L1, block_on high), at HEAD `c4db997` |

### Audit notes (none blocking; none changes a status)

1. **T-12-SC wording.** Recorded in AR-12-01 above.
2. **T-12-30 depends on the seed reconciliation.** The withdrawal of the service agent's request grants reaches a database when Strapi reconciles roles at boot (`IDAMBOX_SEED_CSRM=true`, the `.env.example` default). The pilot's development-database check on 2026-10-08 (a copy of `data.db`) saw the agent role go from 17 to 14 functions, equal to the catalogue. The agent's AI operations are refused by the code guard whatever the database holds.
3. **T-12-50 outside the declared threat.** `CSRM_AI_PROVIDER_MODE` is read when its module loads (`src/csrm/ai-provider-selection.ts`). A developer `.env` cannot reach it in the suites, but a provider value exported in the developer's own shell could select the hosted provider for a unit test that imports a workflow module directly; such a test would still have no provider base URL or key from the harness. Accepted as outside the declared threat; developers run the suites with the documented environment.
4. **T-12-41 budget.** The review editor route's JavaScript budget is 460,000 bytes with its reason recorded (`e2e/performance.spec.ts`, `docs/performance/phase-08-baseline.md`); stage B measured 311,283 bytes. The Risk page was brought back within its 300,000 bytes by `c586c45`.

Review-fix commits after `01d2034` strengthened these mitigations: WR-103 (T-12-10, T-12-20, T-12-36), WR-104 (T-12-08), WR-105 (T-12-07, T-12-11, T-12-31), WR-201 (T-12-03), IN-104 and WR-308 (T-12-19, T-12-37), WR-304 (T-12-25), WR-106 and WR-102 (T-12-34), CR-02 (T-12-35), WR-203 (T-12-16), CR-201 (T-12-04), CR-01 (T-12-42), CR-401 (T-12-22, T-12-39, T-12-49).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-08
