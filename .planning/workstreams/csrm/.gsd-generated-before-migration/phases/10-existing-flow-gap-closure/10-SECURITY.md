---
phase: "10"
slug: "existing-flow-gap-closure"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-10-03"
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Built by the orchestrator from the 23 plans' `<threat_model>` STRIDE tables and the `gsd-security-auditor` verdict of 2026-10-03 (`## SECURED`, ASVS level 1, block on high), after the code review fixes (`10-REVIEW-DISPOSITION.md`) and the walkthrough fixes (`10-23-SUMMARY.md`).

---

## Trust Boundaries

From each plan's `<threat_model>` Trust Boundaries table. No two plans declare the same boundary, so deduplication merged no rows. 10-10's "Strapi projection → Requestor" and 10-11's "Stored log → Requestor projection" share a description but name different sources, so both are kept.

| Boundary | Description | Plans |
|---|---|---|
| Browser → Server Action | The zone string is untrusted input from any caller of `syncViewerTimeZoneAction` | 10-01 |
| Cookie → server render | The `csrm-time-zone` cookie is client-controlled and read on every app render | 10-01 |
| Requestor browser → analyst route | A Requestor can type any analyst URL; the page is rendered on the server with her session | 10-02 |
| Next server → Strapi | Strapi remains the authorization authority for every record read | 10-02 |
| None new | A client-side keyboard behaviour change; no data crosses a boundary | 10-03 |
| Strapi request read → both request pages | Strapi scopes the read; the pages render what it serves | 10-04 |
| Browser → Server Actions | Submit and return to draft are validated and authorised on the server | 10-04 |
| Strapi questionnaire read → Requestor page | The Requestor projection carries no actor and no question key | 10-05 |
| Browser → revert Server Action | Strapi re-checks the rule on every return to draft | 10-05 |
| Strapi → any authenticated caller | The 409 body is visible to whoever made the request, Requestor or analyst | 10-06 |
| Strapi error body → Next server | The web transport parses an untrusted error body | 10-06 |
| Server Action → browser | Action results reach the client component that called them | 10-07 |
| Browser → autosave Server Action | Repeated answer saves from the Requestor's browser | 10-08 |
| Strapi release gate → autosave | A save after the analyst takes the questionnaire back is refused (403) | 10-08 |
| Strapi question list → analyst page | The analyst read masks draft answers until the submitted batch | 10-09 |
| Browser → governance Server Actions | Section and order are client-computed; Strapi's definition parser validates them | 10-09 |
| Stored governance log → projection | The log is JSON on the questionnaire; reads validate it against a closed schema | 10-10 |
| Strapi projection → Requestor | The Requestor branch must not gain analyst detail | 10-10 |
| Stored log → Requestor projection | The Requestor branch must not gain analyst detail | 10-11 |
| Analyst → generation route | An analyst action that replaces questions the Requestor may see | 10-11 |
| Analyst browser → generation Server Action | The replacement acknowledgement is a client choice; Strapi decides | 10-12 |
| Any authenticated caller → the new route | The grant, the human-analyst set and the request check decide | 10-13 |
| Registry (process memory) → response | Job records carry the initiating analyst's id, which is never projected | 10-13 |
| Analyst page → jobs read | Only gated analysts reach the page; Strapi enforces the grant | 10-14 |
| Strapi released reads → Requestor | Only the owning Requestor of a released assessment may read its risks and controls | 10-15 |
| Strapi → web parsers | The widened responses are parsed by closed schemas | 10-15 |
| Strapi Administration reads → analyst | Administration records are analyst-only by grant | 10-16 |
| Vendored catalogue → seed → database | Public legislation text reconciled on each seeded start | 10-17 |
| Analyst → server-side control search | A bounded, authorised Administration list read | 10-17 |
| Analyst browser → `searchControlsAction` → Strapi | Typed search text crosses into a Server Action, then the typed client, then the Administration list route | 10-18 |
| Strapi → picker's Risk Type list | Applicable-control summaries leave the server on a list analysts already read | 10-18 |
| Picker → control implementation create and update | The chosen control id is submitted as a relation | 10-18 |
| Analyst browser → search Server Actions → Strapi | Typed search text crosses into Server Actions and the typed client | 10-19 |
| Server page → request and assessment reads | Extra reads that feed the suggested groups | 10-19 |
| Picker → Risk and control implementation updates | Chosen relation ids are submitted | 10-19 |
| Analyst browser → risk and control Server Actions | Converted dates and chosen owner ids are submitted | 10-20 |
| Analyst browser → active-user search | Search text crosses into the existing owner search | 10-20 |
| Served readiness → browser rendering | Requirement labels and destinations from Strapi are rendered as links and captions | 10-21 |
| CSRM title file → seed → database | CSRM-authored and framework names reconciled into the control library on each seeded start | 10-22 |
| Control library → analysts choosing controls | Analysts rely on titles to pick the control that mitigates a Risk | 10-22 |
| Gate logs and summary → repository | Command output is summarised into a committed file | 10-23 |
| Orchestrator's browser walk → dev servers and database | Interactive checks run against shared, live development data | 10-23 |

---

## Threat Register

87 threats from 23 plans: 56 `mitigate` (each verified in code at HEAD) and 31 `accept` (each rationale confirmed for the code as built). T-10-SC is the per-plan supply-chain row (one per plan). Evidence for every row is under **Verification Evidence** below.

| Threat ID | Plan | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | 10-01 | Tampering / Denial of service | `readViewerTimeZone`, `formatInstant` (a forged cookie causing a `RangeError` on every page) | medium | mitigate | `isValidTimeZone` (1-64 characters, accepted by `Intl.DateTimeFormat` inside try/catch) runs on both write and read; an invalid value is treated as unknown and formats in UTC with the label (ASVS V5.1.3) | closed |
| T-10-02 | 10-01 | Tampering | `syncViewerTimeZoneAction` called cross-origin | low | mitigate | Next's Server Action origin check (08 D-48) applies; the action's only effect is the caller's own non-sensitive cookie, and it never echoes input | closed |
| T-10-03 | 10-01 | Information disclosure | The zone cookie | low | accept | It holds a public IANA zone name, no personal data, is `httpOnly`, `sameSite=lax`, and never feeds authorization | closed |
| T-10-SC | 10-01 | Tampering | npm installs | low | accept | No package is added; the lockfile is unchanged | closed |
| T-10-04 | 10-02 | Information disclosure / Elevation of privilege | The three analyst detail routes rendering analyst actions or record facts to a Requestor | high | mitigate | `canViewerReviewAssessments()` runs before any service call in the page and in `generateMetadata`; the route tests assert no read for a Requestor, and the journeys assert no analyst action and no `/app/review/` link (ASVS V4.1.1, V4.1.3) | closed |
| T-10-05 | 10-02 | Information disclosure | Metadata or permission copy confirming whether a record id exists | medium | mitigate | For a refused viewer the title is static and no read runs, so existing and missing ids render identically (UI-SPEC §11.1) | closed |
| T-10-06 | 10-02 | Elevation of privilege | Treating the gate as authorization | low | accept | The gate is presentation only; Strapi still refuses every analyst operation for a Requestor (the authorization matrix is unchanged and stays green) | closed |
| T-10-SC | 10-02 | Tampering | npm installs | low | accept | No package is added; `typescript` is an existing devDependency | closed |
| T-10-07 | 10-03 | Tampering | A double selection or a skipped value change corrupting a submitted answer | low | mitigate | Checking goes through the primitive's own `click()` path, which calls `onCheck` only when unchecked; the held-key test asserts exactly one change per press | closed |
| T-10-SC | 10-03 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-08 | 10-04 | Information disclosure | `RequestContextDetails` on the analyst page | low | accept | It renders only fields the existing, authorised request read already serves to that actor; no new read or field crosses a boundary | closed |
| T-10-09 | 10-04 | Elevation of privilege | Offering Return to draft from stale or legacy fields | medium | mitigate | `canRevertRequestToDraft` reads only served `relationships` and fails closed when they are missing; Strapi's `request-workflow.ts` rule remains the authority and refuses any stale attempt (ASVS V4.1.1) | closed |
| T-10-10 | 10-04 | Tampering | Local component state overriding server state after a transition | low | mitigate | The submitted-state override is removed; status comes from the refreshed request only, with a rerender test for submit then revert | closed |
| T-10-SC | 10-04 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-11 | 10-05 | Information disclosure | The Requestor history summary | medium | mitigate | The summary renders only `kind`, `at` and `explanation`, which is all the Requestor projection serves; tests assert no key and no analyst name appear (ASVS V8.1.1) | closed |
| T-10-12 | 10-05 | Elevation of privilege | Offering questionnaire return to draft after the assessment draft started | medium | mitigate | `canRevertQuestionnaireToDraft` requires `questionnaire-in-progress` and fails closed; Strapi's `questionnaire-workflow.ts:278-279` rule still refuses a stale request | closed |
| T-10-SC | 10-05 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-13 | 10-06 | Information disclosure | Reason codes revealing an unreleased questionnaire or an assessment to a Requestor | medium | mitigate | Codes are actor-neutral (`REQUEST_WORK_STARTED` does not say which work); a Requestor already sees such relations as `unavailable` (research Pitfall 11, ASVS V7.4.1) | closed |
| T-10-14 | 10-06 | Tampering | The transport trusting the error body | medium | mitigate | Only a value `isConflictReason` accepts is kept; message, name and other details are dropped, so the web shows its own copy (ASVS V5.1.3) | closed |
| T-10-15 | 10-06 | Tampering / Repudiation | A refusal partially writing before it throws | medium | mitigate | Each refusal case asserts a deep-equal snapshot (08 D-16); the throw sites keep their positions before any write | closed |
| T-10-SC | 10-06 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-16 | 10-07 | Information disclosure | Refusal copy telling a Requestor more than her served relationship state | medium | mitigate | Families A, B, C and D (the Requestor's) use only the actor-neutral sentences of §10.2, which name no questionnaire title, number or analyst; the tests assert the exact strings (research Pitfall 11) | closed |
| T-10-17 | 10-07 | Information disclosure | Forwarding Strapi's internal message to the browser | low | mitigate | Results carry only the web's own sentence and the validated `reason`; the Strapi message is never copied into a result | closed |
| T-10-SC | 10-07 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-18 | 10-08 | Denial of service | Autosave loops against a refusal | medium | mitigate | A 403 or 409 sets `failed/blocked` and stops autosave until refresh; retryable failures retry only on the next change or `Retry save`; at most one save in flight and one queued (research Pitfall 7) | closed |
| T-10-19 | 10-08 | Information disclosure | Draft answers reaching analysts through autosave | low | mitigate | Autosave uses the same Requestor-only save operation and validation as `Save draft`; Strapi still masks draft answers from analysts until the submitted batch (`projectQuestions`), unchanged | closed |
| T-10-20 | 10-08 | Tampering | The autosave action accepting unvalidated input | low | mitigate | It reuses `questionnaireActionSchema` (bounded answers) before any service call | closed |
| T-10-60 | 10-08 | Tampering | A page restored by Back or Forward writing older answers over a newer save | medium | mitigate | The renderer seeds from the session record of the last save when it is newer than the page payload's `updatedAt`; the record holds only the Requestor's own saved answers in that tab's memory and yields to any newer server read (unit cases and `QUES09_AUTOSAVE_SURVIVES_BACK`) | closed |
| T-10-SC | 10-08 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-21 | 10-09 | Information disclosure | The released questions section showing draft answers before submission | high | mitigate | It renders only question text, type, required flag, choices and section plus the aggregate served `progress`; `projectQuestions` still nulls answers for analysts before the submitted batch; the unit test asserts no answer value, checkbox or radio (D-07, ASVS V8.1.1) | closed |
| T-10-22 | 10-09 | Tampering | A client-computed placement corrupting the definition | medium | mitigate | Strapi's `questionnaire-definition.ts` parser validates every add and edit and refuses a clash with `DEFINITION_CONFLICT`; the mounted test proves valid placements on a generated questionnaire | closed |
| T-10-23 | 10-09 | Tampering | The placement parser widening the question list contract | low | mitigate | It declares no bounds and reads only placement fields; the parity guard runs it in all five modes without a narrowing | closed |
| T-10-SC | 10-09 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-24 | 10-10 | Information disclosure | Question text of an unreleased or replaced question reaching a Requestor | medium | mitigate | `questionText` is added to the analyst branch only; the mounted test asserts the Requestor read carries neither `questionText` nor `questionKey` (ASVS V8.1.1) | closed |
| T-10-25 | 10-10 | Tampering / Denial of service | An oversized or malformed snapshot breaking every read | low | mitigate | Writes cut to 500 characters; the closed parser bounds the key; reads of a malformed log fail safe to an empty summary, unchanged | closed |
| T-10-26 | 10-10 | Injection (output) | Question text rendered in the timeline | low | mitigate | Rendered as React text only, never as HTML (the output-safety guard forbids `dangerouslySetInnerHTML`) | closed |
| T-10-SC | 10-10 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-27 | 10-11 | Tampering (workflow invariant) | Replacing a released questionnaire so unreviewed AI questions reach the Requestor | high | mitigate | Synchronous 409 before enqueue plus the in-transaction re-check under the request row lock; both mounted cases assert unchanged state (D-09, ASVS V4.1.1) | closed |
| T-10-28 | 10-11 | Repudiation | A replacement leaving no record of discarded analyst work | medium | mitigate | The `regenerated` event is appended in the same transaction as the replacement, with the initiating analyst, the time and the counts (D-10) | closed |
| T-10-29 | 10-11 | Information disclosure | The change count or the replacement explanation reaching a Requestor | medium | mitigate | The count is added on analyst paths only and the Requestor projection drops the `regenerated` explanation; mounted tests assert both (ASVS V8.1.1) | closed |
| T-10-SC | 10-11 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-30 | 10-12 | Tampering (workflow invariant) | A crafted replace request against a released questionnaire | medium | mitigate | The hint is presentation; plan 10-11's synchronous and in-job refusals are the control, and the refusal copy (I) shows if one is attempted | closed |
| T-10-31 | 10-12 | Information disclosure | The change count on the analyst hub | low | accept | The analyst hub is gated to `assessment:review` (plan 10-02) and the count comes from an analyst-only projection | closed |
| T-10-SC | 10-12 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-32 | 10-13 | Elevation of privilege | The service agent or a Requestor reading job status | high | mitigate | An exact grant to `role.security_analyst` only, plus the literal in `HUMAN_ANALYST_ONLY_OPERATIONS`; the matrix row asserts 403 for owner, other, service agent and no identity (ASVS V4.1.1, V4.1.3) | closed |
| T-10-33 | 10-13 | Information disclosure | Revealing which analyst started a job | low | mitigate | The response uses the existing projections, which omit the initiator; only a boolean `canRetry` for the viewer is added | closed |
| T-10-34 | 10-13 | Elevation of privilege | Widening the by-id reads or retry | medium | mitigate | `get`, `retry` and `authorize` are untouched; a mounted case proves the second analyst still gets 404 by id (D-27) | closed |
| T-10-35 | 10-13 | Information disclosure | Enumerating request ids through 404 versus 200 | low | accept | Only human analysts reach the handler, and they may already list every request in the review queue | closed |
| T-10-SC | 10-13 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-36 | 10-14 | Elevation of privilege | Offering Retry to an analyst who did not start the job | medium | mitigate | The card offers Retry only when the served `canRetry` is true; Strapi's by-id retry still refuses anyone else (D-27) | closed |
| T-10-37 | 10-14 | Denial of service | Polling loops against the new read | low | mitigate | The existing 1-second interval and 30-second timeout bound polling; `Check again` restarts it only on request | closed |
| T-10-SC | 10-14 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-38 | 10-15 | Information disclosure | Owner names and treatment facts on released reads | medium | mitigate | The existing `releasedForOwner` check still gates both reads (404 for anyone else), proven by the mounted case; owners cross as `ActiveUserSummary` (id and display name only), as released assessments already name analysts (ASVS V4.1.3, V8.1.1) | closed |
| T-10-39 | 10-15 | Tampering | Unpopulated relations blanking editor state through a widened mutation response | medium | mitigate | `RiskSummary` and `RiskResponse` stay five fields; only the list uses the new schema (research Pitfall 9) | closed |
| T-10-40 | 10-15 | Tampering | Parser drift on the widened schemas | low | mitigate | Bounds are declared in the spec and mirrored exactly; the new label passes the five parity modes without grandfathering | closed |
| T-10-SC | 10-15 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-41 | 10-16 | Information disclosure | Exposing more of the owner's user record | low | mitigate | Only the trimmed display name crosses, bounded at 255; the owner id was already projected (ASVS V8.1.1) | closed |
| T-10-SC | 10-16 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-42 | 10-17 | Tampering | Seed corrections overwriting operator edits to seeded records | low | accept | The reconciliation already owns these seeded names and descriptions (unchanged behaviour); operator-created records are not touched | closed |
| T-10-43 | 10-17 | Denial of service | The Risk Type search loading the whole library per keystroke | low | mitigate | The action now asks the server for one bounded page (25) through the existing grant | closed |
| T-10-44 | 10-17 | Information disclosure | CSV messages exposing internals | low | mitigate | The new messages name only the column and the problem | closed |
| T-10-SC | 10-17 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-45 | 10-18 | Information disclosure | Applicable-control summaries on the Risk Type picker list | low | mitigate | Same route and `pickerPolicies` grants as today; the projection is closed to four reference-data fields the Administration list already serves analysts; the spec is closed (`additionalProperties: false`) | closed |
| T-10-46 | 10-18 | Denial of service | Control search per keystroke | low | mitigate | 300 ms debounce, stale-response guard, a 10-row page, 200-character input bound, and the server's existing escaped `LIKE` search | closed |
| T-10-47 | 10-18 | Tampering | A forged control id submitted from the picker | medium | mitigate | Unchanged server checks: the create and update workflows resolve the control relation and refuse a missing one; the Server Action's closed schema bounds the id | closed |
| T-10-48 | 10-18 | Elevation of privilege | `searchControlsAction` used by a Requestor | medium | mitigate | The action calls the typed layer only; Strapi enforces the analyst grant on `GET /v1/controls` with a query; a 403 becomes the permission message and no data | closed |
| T-10-SC | 10-18 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-49 | 10-19 | Information disclosure | Request-first suggestions | low | mitigate | The pages read the request and assessment through the analyst-scoped typed reads Strapi already authorises for the viewer; failures degrade to no suggestions and show no detail | closed |
| T-10-50 | 10-19 | Tampering | Forged system, asset or control ids | medium | mitigate | Unchanged server checks: the Risk workflow resolves each relation and refuses an unknown one; the Server Actions' closed schemas bound the ids | closed |
| T-10-51 | 10-19 | Denial of service | Inventory searches per keystroke | low | mitigate | 300 ms debounce, stale-response guard, the selector's 25-row page and 100-character search bound | closed |
| T-10-SC | 10-19 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-52 | 10-20 | Tampering | A crafted exemption review date | low | mitigate | The Server Action's closed schema still requires an ISO datetime with offset, and Strapi validates the datetime field; the browser conversion adds no trust | closed |
| T-10-53 | 10-20 | Information disclosure | Owner search results | low | accept | Unchanged: the existing active-user search, already used for Risk and treatment owners under the analyst grant, returns display names only | closed |
| T-10-54 | 10-20 | Repudiation | A confirmation for a save that did not persist | low | mitigate | Confirmations show only after an `ok` result; failures keep their alerts and clear any confirmation | closed |
| T-10-SC | 10-20 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-55 | 10-21 | Elevation of privilege | Release offered while requirements are outstanding | medium | mitigate | Unchanged: `Release assessment` stays disabled until the served readiness is ready and Strapi rechecks every requirement on release; the summary only regroups what is served | closed |
| T-10-56 | 10-21 | Tampering | A served destination used as a link target | low | mitigate | Destinations are same-page fragments built from the closed readiness schema (bounded strings) and rendered as `#…` hrefs only, as today | closed |
| T-10-SC | 10-21 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-61 | 10-22 | Tampering | A malformed title file mislabelling controls | medium | mitigate | `parseControlTitles` refuses unknown files and ids, titles for controls the catalogue already labels, and titles outside the form rules, naming the file and control; the unit test proves each refusal | closed |
| T-10-62 | 10-22 | Repudiation | A descriptive title misstating its paragraph, so an analyst picks the wrong control | medium | mitigate | Each title is written from and re-read against its paragraph, passes the anchor check, and is spot-checked by the orchestrator (VALIDATION Manual-Only); the paragraph stays the control's description and the clause or section its reference | closed |
| T-10-63 | 10-22 | Information disclosure | Loading licensed ISO text | medium | mitigate | Only the 93 control names load; the vendored ISO file keeps `statement: null`, and the unit test asserts no Annex A seed has a description | closed |
| T-10-64 | 10-22 | Tampering | The seed reconciliation overwriting a title an analyst edited in Administration on the next seeded start | low | accept | Existing behaviour on development seeding only (T-10-42); editing titles under an Admin role is Phase 22's | closed |
| T-10-SC | 10-22 | Tampering | npm installs | low | accept | No package is added | closed |
| T-10-57 | 10-23 | Information disclosure | Gate output copied into the summary | medium | mitigate | Record counts and failure messages only; never print or copy `.env` values; screenshots stay in `.playwright-mcp/`, which is never staged | closed |
| T-10-58 | 10-23 | Tampering | The walk writing to the operator's data or calling the hosted AI provider | medium | mitigate | Read-only interactions, Save only on unchanged forms, no answer typing, and never Generate, Replace, Retry, Submit, Release or Confirm import (Task 2 step 6) | closed |
| T-10-59 | 10-23 | Elevation of privilege | A Requestor reaching analyst actions | medium | mitigate | Jane's walk opens the three analyst URLs and records the permission state with no record fact or analyst action (plan 10-02's gate) | closed |
| T-10-SC | 10-23 | Tampering | npm installs | low | accept | No package is added | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-03 (10-01, low) | The zone cookie: It holds a public IANA zone name, no personal data, is `httpOnly`, `sameSite=lax`, and never feeds authorization | 10-01 plan (2026-09-27), confirmed by the Phase 10 security audit | 2026-10-03 |
| AR-10-02 | T-10-06 (10-02, low) | Treating the gate as authorization: The gate is presentation only; Strapi still refuses every analyst operation for a Requestor (the authorization matrix is unchanged and stays green) | 10-02 plan (2026-09-27), confirmed by the Phase 10 security audit | 2026-10-03 |
| AR-10-03 | T-10-08 (10-04, low) | `RequestContextDetails` on the analyst page: It renders only fields the existing, authorised request read already serves to that actor; no new read or field crosses a boundary | 10-04 plan (2026-09-27), confirmed by the Phase 10 security audit | 2026-10-03 |
| AR-10-04 | T-10-31 (10-12, low) | The change count on the analyst hub: The analyst hub is gated to `assessment:review` (plan 10-02) and the count comes from an analyst-only projection | 10-12 plan (2026-09-27), confirmed by the Phase 10 security audit | 2026-10-03 |
| AR-10-05 | T-10-35 (10-13, low) | Enumerating request ids through 404 versus 200: Only human analysts reach the handler, and they may already list every request in the review queue | 10-13 plan (2026-09-27), confirmed by the Phase 10 security audit | 2026-10-03 |
| AR-10-06 | T-10-42 (10-17, low) | Seed corrections overwriting operator edits to seeded records: The reconciliation already owns these seeded names and descriptions (unchanged behaviour); operator-created records are not touched Risk reduced since: walkthrough fixes 2 and 3 and review fix WR-101 keep an operator’s own edits; only seed-owned values are replaced. | 10-17 plan (2026-09-27), confirmed by the Phase 10 security audit | 2026-10-03 |
| AR-10-07 | T-10-53 (10-20, low) | Owner search results: Unchanged: the existing active-user search, already used for Risk and treatment owners under the analyst grant, returns display names only | 10-20 plan (2026-09-27), confirmed by the Phase 10 security audit | 2026-10-03 |
| AR-10-08 | T-10-64 (10-22, low) | The seed reconciliation overwriting a title an analyst edited in Administration on the next seeded start: Existing behaviour on development seeding only (T-10-42); editing titles under an Admin role is Phase 22's Risk reduced since: walkthrough fixes 2 and 3 and review fix WR-101 keep an operator’s own edits; only seed-owned values are replaced. | 10-22 plan (2026-09-27), confirmed by the Phase 10 security audit | 2026-10-03 |
| AR-10-09 | T-10-SC (all 23 plans, low) | Supply chain: no package added and the lockfile unchanged in Phase 10 (only the root `verify:csrm-seed` script entry returned) | each plan (2026-09-27), confirmed by the Phase 10 security audit | 2026-10-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Verification Evidence (gsd-security-auditor, 2026-10-03)

### Threat Verification

| Threat ID | Plan | Category | Severity | Disposition | Status | Evidence |
|---|---|---|---|---|---|---|
| T-10-01 | 10-01 | Tampering / DoS | medium | mitigate | CLOSED | `apps/csrm/src/lib/time/format-instant.ts:28-36`: `isValidTimeZone` checks 1–64 characters, with the `Intl` call inside try/catch. `:50` falls back to UTC with a label. The cookie is checked on read at `viewer-time-zone.ts:16` and on write at `time-zone-actions.ts:42` |
| T-10-02 | 10-01 | Tampering | low | mitigate | CLOSED | `time-zone-actions.ts:41-53` returns only `{ ok }` and writes only the caller's own cookie. `next.config.ts` does not widen `serverActions.allowedOrigins`, so Next's own origin check applies |
| T-10-03 | 10-01 | Info disclosure | low | accept | CLOSED (rationale holds) | The cookie is `httpOnly`, `sameSite: 'lax'` (`time-zone-actions.ts:45-51`). Its only reader is `apps/csrm/app/(app)/layout.tsx:22`, which passes it to AppShell for date formatting and never to authorisation |
| T-10-04 | 10-02 | Info disclosure / EoP | high | mitigate | CLOSED | `apps/csrm/src/lib/capabilities/analyst-review-gate.ts:16-21`. The gate runs first, before any read, in both the page and `generateMetadata`: `apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx:26,32`, `apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx:24,42`, `apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx:35,41`. Tests: `analyst-route-gate.test.tsx`, `analyst-assessment-route.test.tsx` |
| T-10-05 | 10-02 | Info disclosure | medium | mitigate | CLOSED | Same lines: a refused viewer gets a static `{ title }` and no read runs |
| T-10-06 | 10-02 | EoP | low | accept | CLOSED (rationale holds) | The gate is presentation only. Strapi's policies are unchanged except for one added guard literal, and the two catalogue copies are byte-identical (`cmp` exit 0) |
| T-10-07 | 10-03 | Tampering | low | mitigate | CLOSED | `apps/csrm/src/components/ui/radio-group.tsx:78-89`: it clicks only when focus did not already check the radio. Held-key tests at `radio-group.test.tsx:149,164` |
| T-10-08 | 10-04 | Info disclosure | low | accept | CLOSED (rationale holds) | `apps/csrm/src/features/requests/request-context-details.tsx:57-76` renders only fields of the request already served; it adds no read |
| T-10-09 | 10-04 | EoP | medium | mitigate | CLOSED | `apps/csrm/src/features/requests/request-domain.ts:139-143` reads served relationships and fails closed when they are missing. Used at `assessment-detail.tsx:172` and `request-workflow-actions.tsx:80`. Strapi refuses at `apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts:109-113` |
| T-10-10 | 10-04 | Tampering | low | mitigate | CLOSED | `request-workflow-actions.tsx:34` takes status from the served request only. The `submitted` override state was removed (diff from `5ea2b77`) |
| T-10-11 | 10-05 | Info disclosure | medium | mitigate | CLOSED | `apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx:96-104` shows the kind label, the time, and an explanation for `answer-cleared` only. The Strapi Requestor branch at `apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts:378-385` serves only kind, at and explanation |
| T-10-12 | 10-05 | EoP | medium | mitigate | CLOSED | `questionnaire-workflow-rules.ts:17-27` requires `questionnaire-in-progress` and fails closed. Strapi refuses at `questionnaire-workflow.ts:287-293` |
| T-10-13 | 10-06 | Info disclosure | medium | mitigate | CLOSED | `apps/backend/src/csrm/conflict-reasons.ts:12-31` is a closed list. `request-workflow.ts:112-113` gives one `REQUEST_WORK_STARTED` code whether a questionnaire or an assessment exists |
| T-10-14 | 10-06 | Tampering | medium | mitigate | CLOSED | `apps/csrm/src/lib/api/transport/server-client.ts:122-139`: a reason is kept only on a 409 and only if `isConflictReason` accepts it (`apps/csrm/src/lib/api/conflict-reasons.ts:34-36`). The message is fixed web copy |
| T-10-15 | 10-06 | Tampering / Repudiation | medium | mitigate | CLOSED | `questionnaire-governance-workflow.ts:197-207` runs each change in one transaction under the CR-101 row locks. The log is appended before any write (`:321-337`, `:557-560`). Answer saves lock too (`questionnaire-workflow.ts:210`). Deep-equal refusal snapshots: `tests/helpers/conflict-reason-fixtures.ts`, used by 3 integration suites |
| T-10-16 | 10-07 | Info disclosure | medium | mitigate | CLOSED | `apps/csrm/src/lib/api/refusal-copy.ts:43-69`: families A–D are actor-neutral and name no title, number or analyst |
| T-10-17 | 10-07 | Info disclosure | low | mitigate | CLOSED | `request-actions.ts:35-48` returns only `refusalMessage` plus the validated reason. No action copies Strapi's `error.message` (grep finds only zod messages) |
| T-10-18 | 10-08 | DoS | medium | mitigate | CLOSED | `apps/csrm/src/features/questionnaires/use-answer-autosave.ts:76-78,94-99`: a blocked save stops autosave. `:141-158`: one save in flight, one queued. `refusal-copy.ts:162-176` treats 403, 404 and 409 as blocked |
| T-10-19 | 10-08 | Info disclosure | low | mitigate | CLOSED | `questionnaire-actions.ts:214-221,237-239`: autosave uses the same save operation as Save draft. `questionnaire-scope.ts:481` nulls answers for analysts until the batch is submitted |
| T-10-20 | 10-08 | Tampering | low | mitigate | CLOSED | `questionnaire-actions.ts:35-38` defines `questionnaireActionSchema`; `:215` parses with it before any call |
| T-10-60 | 10-08 | Tampering | medium | mitigate | CLOSED | `use-answer-autosave.ts:244-271`: the remembered save is used only when it is strictly newer than the page. Wired at `questionnaire-renderer.tsx:277,332` |
| T-10-21 | 10-09 | Info disclosure | high | mitigate | CLOSED | `questionnaire-review.tsx:121-131` shows only the aggregate progress plus the question list. `questionnaire-governance.tsx:114-140` shows question text, caption and choices only. Strapi `questionnaire-scope.ts:481` |
| T-10-22 | 10-09 | Tampering | medium | mitigate | CLOSED | `questionnaire-governance-workflow.ts:408-416` turns a definition error into `DEFINITION_CONFLICT`; `validateDefinition` (`:524`) runs on add and edit |
| T-10-23 | 10-09 | Tampering | low | mitigate | CLOSED | `questionnaire-service.ts:121-151` declares no bounds and reads placement fields only. Registered in the parity guard at `:446` with no narrowings |
| T-10-24 | 10-10 | Info disclosure | medium | mitigate | CLOSED | `questionnaire-scope.ts:358,374` adds `questionText` on the analyst branch only; the Requestor branch (`:378-385`) has no text and no key |
| T-10-25 | 10-10 | Tampering / DoS | low | mitigate | CLOSED | `questionnaire-governance-log.ts:77,128,146-153` caps text at 500 characters. `questionnaire-scope.ts:262-274`: a malformed log reads as an empty list |
| T-10-26 | 10-10 | Injection (output) | low | mitigate | CLOSED | `questionnaire-revision-timeline.tsx:32` renders React text. Guard at `apps/csrm/src/lib/security/output-safety.test.ts:36`; no `dangerouslySetInnerHTML` anywhere in `src` or `app` |
| T-10-27 | 10-11 | Tampering (invariant) | high | mitigate | CLOSED | `questionnaire-generation-workflow.ts:134`: a synchronous 409 `QUESTIONNAIRE_RELEASED` before enqueue. `:80` takes `lockRequestAndQuestionnaire` (`questionnaire-row-locks.ts:58-68`), then `:87` re-checks inside the transaction |
| T-10-28 | 10-11 | Repudiation | medium | mitigate | CLOSED | `questionnaire-generation-workflow.ts:58-63,96-98`: the `regenerated` event (by, at, counted explanation) is appended in the replacing transaction before any delete |
| T-10-29 | 10-11 | Info disclosure | medium | mitigate | CLOSED | `projectAnalystRevision` (`questionnaire-scope.ts:449-460`) is called only on analyst paths (`controllers/csrm-questionnaire.ts:386`, `questionnaire-governance-workflow.ts:438`). `:384` drops the `regenerated` explanation for the Requestor; the web side matches at `timeline.tsx:75-80,102` |
| T-10-30 | 10-12 | Tampering (invariant) | medium | mitigate | CLOSED | The hint is presentation only. The control is T-10-27's two refusals; refusal family I is at `refusal-copy.ts:112-118` |
| T-10-31 | 10-12 | Info disclosure | low | accept | CLOSED (rationale holds) | The hub is gated (T-10-04) and the count comes only from the analyst projection (T-10-29) |
| T-10-32 | 10-13 | EoP | high | mitigate | CLOSED | Catalogue grants `function.questionnaire_generation.request_jobs_read_api` to `role.security_analyst` only, in both identical copies. The literal is in the guard set at `apps/backend/src/policies/csrm-authorization.ts:51`, enforced at `:282`. Matrix row `tests/fixtures/authorization-matrix.ts:907-915` (`humanAnalystOnly(200)`) |
| T-10-33 | 10-13 | Info disclosure | low | mitigate | CLOSED | `projectQuestionnaireGenerationJob` and `projectAssessmentDraftJob` (`apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:825-837`) omit the initiator; only the `canRetry` boolean is added (`:862-869`) |
| T-10-34 | 10-13 | EoP | medium | mitigate | CLOSED | Both registry diffs only add `latestForRequest`. `get`, `retry` and `authorize` are unchanged (`questionnaire-generation-registry.ts:20,22-23`), and the actor's read-all flag is `false` (`questionnaire-generation-workflow.ts:20`) |
| T-10-35 | 10-13 | Info disclosure | low | accept | CLOSED (rationale holds) | Only human analysts reach the handler (T-10-32), and they already list every request in the queue |
| T-10-36 | 10-14 | EoP | medium | mitigate | CLOSED (see note 1) | Strapi's by-id retry is initiator-only (`questionnaire-generation-registry.ts:20,23`). The card hides Retry when `canRetry === false` (`questionnaire-generation-job.tsx:340`, `assessment-draft-job.tsx:329`) |
| T-10-37 | 10-14 | DoS | low | mitigate | CLOSED | Polling is 1,000 ms with a 30,000 ms budget: `questionnaire-generation-job.tsx:35-36` and `assessment-draft-job.tsx:32-33`, with timeout checks in the poll effect |
| T-10-38 | 10-15 | Info disclosure | medium | mitigate | CLOSED | `controllers/csrm-assessment.ts:101-107,260,289`: a Requestor who does not own a released assessment gets 404. Owners are projected as `{ documentId, displayName }` (`assessment-scope.ts:24-27,349-369`) |
| T-10-39 | 10-15 | Tampering | medium | mitigate | CLOSED | `projectRiskSummary` keeps its five fields, unchanged (`assessment-scope.ts:310-318`). Only the list uses `projectAssessmentRiskListItem` |
| T-10-40 | 10-15 | Tampering | low | mitigate | CLOSED | `assessment-schema.ts:306-336` mirrors the spec's `AssessmentRiskListItem`. Registered in the parity guard at `assessment-service.ts:187` with no narrowings |
| T-10-41 | 10-16 | Info disclosure | low | mitigate | CLOSED | `apps/backend/src/api/csrm-administration/services/administration-query.ts:234-238,301`: the name is trimmed and capped at 255. The owner populate loads only `["documentId","displayName"]` (`administration-repository.ts:103,112`) |
| T-10-42 | 10-17 | Tampering | low | accept | CLOSED (rationale holds, see note 3) | Seeding runs only when `IDAMBOX_SEED_CSRM=true` (`apps/backend/src/bootstrap/seed-csrm-data.ts:857`). WR-101 and fixes 2/3 now keep operator edits (`:630-760`) |
| T-10-43 | 10-17 | DoS | low | mitigate | CLOSED | `apps/csrm/src/features/administration/administration-actions.ts:39,103-111`: one page of 25 through `listAdministrationControls` |
| T-10-44 | 10-17 | Info disclosure | low | mitigate | CLOSED | `csv-import.ts:96,243,246` and `csv-client-parser.ts`: messages name only the column and the problem. `served-text.ts:21-26` logs the record and field names, never the text |
| T-10-45 | 10-18 | Info disclosure | low | mitigate | CLOSED | Closed 4-field summary at `assessment-scope.ts:380-395,423-432`. The spec's `RiskTypeApplicableControl` has `additionalProperties: false`. The `pickerPolicies` route is unchanged |
| T-10-46 | 10-18 | DoS | low | mitigate | CLOSED | `apps/csrm/src/components/csrm/relation-picker.tsx:48` (300 ms debounce), `:104,115` (stale-response guard). `assessment-actions.ts:101-104` (200-character bound, page of 10). `administration-repository.ts:54` uses `LIKE ? ESCAPE '!'` |
| T-10-47 | 10-18 | Tampering | medium | mitigate | CLOSED | `apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts:108-112` refuses a missing control. Id bounds at `assessment-schema.ts:10,456-479` |
| T-10-48 | 10-18 | EoP | medium | mitigate | CLOSED | `assessment-actions.ts:288-307` uses the typed layer only; a 403 gives the permission message and no data. `apps/backend/src/api/csrm-risk/routes/csrm-risk.ts:62-65` runs `pickerPolicies` through `csrm-authorization` |
| T-10-49 | 10-19 | Info disclosure | low | mitigate | CLOSED | `apps/csrm/app/(app)/app/risks/[documentId]/page.tsx:26-36,42`: a failed read gives no suggestions. `apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx:56,71` |
| T-10-50 | 10-19 | Tampering | medium | mitigate | CLOSED | `apps/backend/src/api/csrm-risk/services/risk-workflow.ts:60-78` resolves every relation and refuses an unknown one. `control-implementation-workflow.ts:108-112` |
| T-10-51 | 10-19 | DoS | low | mitigate | CLOSED | `relation-picker.tsx:48,104,115`. `apps/csrm/src/features/requests/request-service.ts:121-124,138`: page of 25, 100-character bound |
| T-10-52 | 10-20 | Tampering | low | mitigate | CLOSED | `assessment-schema.ts:264` requires `z.iso.datetime({ offset: true })`; also used through `risks/risk-actions.ts:40` |
| T-10-53 | 10-20 | Info disclosure | low | accept | CLOSED (rationale holds) | `controllers/csrm-risk.ts:211` maps to `projectActiveUserSummary` (`assessment-scope.ts:410`), which returns `{ documentId, displayName }` |
| T-10-54 | 10-20 | Repudiation | low | mitigate | CLOSED | `clear()` runs before each save and `saved()` only after an ok result: `risk-editor.tsx:200,229`, `control-implementation-editor.tsx:145,169`, `assessment-editor.tsx:481,498` |
| T-10-55 | 10-21 | EoP | medium | mitigate | CLOSED | `assessment-editor.tsx:303` sets `disabled={!readiness.ready}`. Strapi re-checks at `assessment-workflow.ts:534-535` |
| T-10-56 | 10-21 | Tampering | low | mitigate | CLOSED | `assessment-domain.ts:117-120` always builds a `#`-prefixed fragment. Bounds at `assessment-schema.ts:347,354` |
| T-10-61 | 10-22 | Tampering | medium | mitigate | CLOSED | `parseControlTitles` (`seed-csrm-data.ts:257` onward) refuses unknown files and controls, already-labelled controls (`:437`), form-rule breaks and bad `supersededTitles`. Tested in `tests/control-titles.unit.test.ts` |
| T-10-62 | 10-22 | Repudiation | medium | mitigate | CLOSED | Anchor check at `control-titles.unit.test.ts:183-274`; limb tests at `:411,551,580`. An independent audit of all 386 titles was recorded (10-23 fixes 3, 3b, 3c). The description stays the source paragraph |
| T-10-63 | 10-22 | Info disclosure | medium | mitigate | CLOSED | `iso-iec-27001-2022-annex-a.json` is unchanged since `5ea2b77`; I counted 93 `statement` values, all null. `control-titles.unit.test.ts:55-67` asserts no description |
| T-10-64 | 10-22 | Tampering | low | accept | CLOSED (rationale holds, risk reduced) | Fix 3's `operatorName` (`seed-csrm-data.ts:702-727`) now keeps an operator's name. Development seeding only (`:857`) |
| T-10-57 | 10-23 | Info disclosure | medium | mitigate | CLOSED | `.gitignore:40` lists `.playwright-mcp/` and 0 files under it are tracked. Only `.env.example` files are tracked. No secret patterns found in `10-*-SUMMARY.md` |
| T-10-58 | 10-23 | Tampering | medium | mitigate | CLOSED (see note 2) | The procedure is in 10-23-PLAN Task 2 step 6 and the walk record shows it was followed. No Generate, Replace, Retry, Submit, Release or Import, and no `CSRM_AI_` line changed |
| T-10-59 | 10-23 | EoP | medium | mitigate | CLOSED | 10-23-SUMMARY Browser checks, row W5 (Jane, 375 and 1440): permission states with no record facts, backed by the T-10-04 code gate |
| T-10-SC (23 rows: one per plan, 10-01 to 10-23) | all | Tampering (supply chain) | low | accept | CLOSED (rationale holds) | `git diff 5ea2b77..HEAD`: no `pnpm-lock.yaml` and no `apps/*/package.json` change. The root `package.json` gained only the `verify:csrm-seed` script, so no dependency was added |

### Threat Flags folded in

- The Threat Flags sections in 10-06, 07, 08, 09, 10, 11, 13, 14, 16 and 17 all say "None", and each one points to an existing ID: T-10-13–17, -18–20, -60, -21–29, -32–37, -41, -43 and -44.
- The "Threat surface" sections in 10-04 and 10-05 point to T-10-08–12.
- No flag needed a new threat. Unregistered flags: none.

### Notes (all non-blocking, nothing open)

1. **T-10-36 (Retry offer).** The plan says Retry shows only when `canRetry === true`. The code hides it only when `canRetry === false`, as the 10-14 summary records. `null` happens only just after a start. A start never returns a failed job (`enqueue` hands back an active or new job), and a status check sets `canRetry` from Strapi before any failed status shows. Strapi's by-id retry is initiator-only in any case, so this is closed on the server's authority.
2. **T-10-58 (the walk writing data).** Walk 1 pressed Save assessment once on the unchanged, In review ASM-E2E-P7-MUTABLE-001. Because of the Fix 1 bug, that re-saved identical values on the development database; only timestamps may have moved and it stayed In review. No AI call and no other write happened. An unchanged save now sends nothing (`assessment-editor.tsx:484-487`, `assessmentSaveWrites`).
3. **T-10-42 and T-10-64 (seed overwrites).** The acceptances still hold, and the risk is now lower: operator edits to name, description, reference and framework fields are kept. One edge case remains, from before Phase 10: if an operator creates a control whose number the catalogue also seeds, a seeded start fills its blank fields and rewrites its `sourceData`.
4. **Informational.** `scripts/verify-csrm-seed*.mjs` (10-23 fix 3) relaxed the "agent grants equal analyst grants" check to "the agent has no Function the analyst lacks". Only the verifier changed: both catalogue copies are byte-identical and no grant changed.

**Count:** 87 threats: 56 mitigate CLOSED, 31 accept rationales confirmed; 0 open (4 high, 30 medium, 53 low).

**threats_open:** 0

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-03 | 87 | 87 | 0 | gsd-security-auditor (verdict), orchestrator (this record) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-03
