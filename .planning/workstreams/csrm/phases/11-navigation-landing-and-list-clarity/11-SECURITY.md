---
phase: "11"
slug: navigation-landing-and-list-clarity
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-04"
---

# Phase 11 — Security

The independent ASVS L1 audit returned OPEN_THREATS: 54 unique threats across 74 plan entries, 52 closed, two open below the high blocking threshold, and zero blocking opens. Verified means the severity-filtered security gate passed; the two evidence gaps below remain visible.

## Trust Boundaries

| Boundary | Data crossing | Control |
|---|---|---|
| External query/action → server service | Search strings, enums, dates and pagination | Closed shared schemas and bound query values |
| Identity → Strapi policy → record | Actor identity, owner/analyst capabilities and record IDs | Policy-selected owner and analyst scopes, disclosable parent predicates |
| Strapi response → web presentation | Display facts, counts, status and internal hrefs | Closed response parsers, minimal projections and encoded internal paths |
| Shell identity → retained quick-find state | Private search results and capabilities | Opaque identity/capability owner key remounts the cache |
| Operator → development records | Read-only verification actions | Approved walk rule; independent historical action evidence unavailable |

## Threat Register

Repeated IDs are deduplicated; the auditor checked the variants across all 21 plans.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|---|---|---|---|---|---|---|
| T-11-01 | Information disclosure | `/app` page, analyst reads for a Requestor | medium | mitigate | The variant is decided from `can('assessment:review', granted)` before any read; `home-page.test.tsx` and the route-fixture test prove a Requestor issues no analyst read, fixture or partial; Strapi still refuses each analyst operation (ASVS V4.1.1) | closed |
| T-11-02 | Elevation of privilege | Treating sidebar visibility as authorisation | medium | mitigate | No route gate or Strapi policy changes; navigation stays presentation (code comment and D-06); the full suite reruns every permission journey, including a Requestor opening analyst URLs directly (ASVS V4.1.1, V4.1.5) | closed |
| T-11-03 | Elevation of privilege / Tampering | `queue=all`, `filters[q]` | high | mitigate | `all` widens statuses only inside `requireAnalystRequestCollectionScope` and never includes `draft` (integration proof); `q` is bound as a parameter through `literalContains` with `ESCAPE '!'`, length-bounded 1-200 and closed-key parsed, so no value reaches SQL text (ASVS V5.3.4, V4.1.3) | closed |
| T-11-04 | Information disclosure | New filters on the owner list | high | mitigate | The owner's released predicate is pushed into the same `$and` as every filter, so filters only narrow; integration cases as a second Requestor and on an unreleased assessment prove it (ASVS V4.1.3, V4.2.1) | closed |
| T-11-05 | Information disclosure / Elevation of privilege | `GET /v1/my_requests` (IDOR) | high | mitigate | Owner id from `ctx.state` via `requireRequestCollectionScope` only; the owner join binds that numeric id; closed query keys; per-actor integration proofs and the six-actor matrix row with `mustNotDisclose` (ASVS V4.2.1, V4.1.3) | closed |
| T-11-06 | Information disclosure | Requestor next-action sentences and hrefs | medium | mitigate | Requestor sentences name no record identity; hrefs come only from relationships `projectRequestRelationships` marks available (unchanged rule), and the unit table asserts no Requestor href at analyst-held steps (ASVS V4.2.1) | closed |
| T-11-07 | Information disclosure | Analyst figures in a Requestor's sidebar | medium | mitigate | Reads chosen by `can(…, granted)`: a Requestor issues no analyst read (unit proof); a Strapi refusal resolves to no badge; the E2E asserts no analyst counted items for the Requestor (ASVS V4.1.1) | closed |
| T-11-08 | Tampering | `stage`, `treatmentAction` | high | mitigate | Closed enums mapped to the branch functions or a bound `where`; unknown values are 400; no value reaches SQL text (ASVS V5.3.4) | closed |
| T-11-09 | Information disclosure | Quick find results | high | mitigate | Every group is an existing Strapi list read scoped by policy (owner, analyst review or Risk register scope); capabilities only choose which lists to ask; the output is display fields and hrefs only; unit proof that a Requestor asks no analyst list; plan 11-20 proves scope in the browser as the Secondary Requestor (ASVS V4.1.1, V4.2.1) | closed |
| T-11-10 | Denial of service | Search flooding | medium | mitigate | 2-100 character term, 250ms debounce, one call in flight with latest-wins, at most one 10-row page per list (ASVS V11.1.4) | closed |
| T-11-11 | Tampering | `status=approved` query value | low | mitigate | Only the display label changes; the stored value and query value stay `approved`, and the E2E asserts the filtered URL still carries `status=approved` (decision 16) | closed |
| T-11-12 | Information disclosure | `unknownStatusPresentation` | low | accept | The fallback renders only a status value the closed parser already accepted, in sentence case; it never renders another field, and parsers still refuse unknown values at the boundary | closed |
| T-11-13 | Tampering | `/app/review` redirect | low | mitigate | A literal source and a fixed destination; no part of the request chooses the target, so no open redirect (ASVS V5.1.5) | closed |
| T-11-14 | Elevation of privilege | Analyst Home gate | low | mitigate | `AnalystHomeContent` keeps its own capability check before `getAnalystDashboard()`; guarded fixtures resolve only after the real, authorised reads (D-23) | closed |
| T-11-15 | Information disclosure | Permission and error state copy | low | mitigate | The §2.4 copy names no internal mechanism, and the copy guard scans these files for internal terms, now including `workspace` (ASVS V7.4.1) | closed |
| T-11-16 | Spoofing | Recovery links | low | accept | Every recovery link is a fixed internal path (`/app`); nothing in the request selects it | closed |
| T-11-17 | Elevation of privilege | Renamed routes and labels | low | mitigate | No route path, capability or gate changes; only strings change, so every route's server gate and every Strapi policy is untouched (ASVS V4.1.1); the full suite reruns the permission journeys | closed |
| T-11-18 | Information disclosure | Analyst-only items for a Requestor | low | mitigate | Each item keeps its capability gate, and the Requestor profile holds no analyst item; unit cases render each profile with each actor's capabilities | closed |
| T-11-19 | Information disclosure | `requestorName` | low | mitigate | The hydrate populates `displayName` only; the integration test asserts no email, username or id of the requestor in the item; the analyst already reads the request detail with its requestor (ASVS V8.3.1) | closed |
| T-11-20 | Denial of service | `q` search | low | mitigate | 200-character bound, the existing page cap of 100 and the indexed request number/title columns; one bounded count plus one page per request | open — below high; title index not found |
| T-11-21 | Tampering | `overallRating`, `approvedFrom`, `approvedTo`, `q` | medium | mitigate | Closed key list, the rating enum, strict date parsing and a 200-character `q`; Strapi's document filters bind values; the aggregate binds the page's numeric ids only (ASVS V5.1.3, V5.3.4) | closed |
| T-11-22 | Denial of service | Risk aggregate | low | mitigate | One grouped query restricted to the page's ids (at most 100), never a per-Risk populate (research Pitfall 9) | closed |
| T-11-23 | Tampering | Web link decision | low | mitigate | The link is decided from the served `holder` and `actor` with a closed parser, never from text; a forged or unknown holder fails the parse | closed |
| T-11-24 | Information disclosure | Compact stepper | low | mitigate | It renders the same served lifecycle the hub renders, through `nextActionPresentation`, so no new field or link reaches the Requestor (T-11-06 rule kept) | closed |
| T-11-25 | Tampering | Client bundle | low | mitigate | The widened zod guard keeps validation schemas server-side on every route; validation of external input stays in Server Actions and services (ASVS V5.1.3) | closed |
| T-11-26 | Tampering | `q`, `holder`, `status`, `sort`, `pageSize` | medium | mitigate | Enumerated values mapped to constant SQL fragments, bound `LIKE` with `ESCAPE '!'`, 200-character bound, page sizes 10/20/50 (ASVS V5.3.4) | closed |
| T-11-27 | Elevation of privilege | Analyst actor on own list | low | mitigate | The operation is granted to `role.requestor` only, so the policy never sets the analyst actor; the integration test asserts Requestor-side sentences and hrefs for the analyst's own list (research Pitfall 12) | closed |
| T-11-28 | Tampering | URL query on `/app/requests` | low | mitigate | The page parses the URL with the closed schema (unknown values dropped) and Strapi parses again with closed keys; the owner scope comes from the policy, never the URL (T-11-05) | closed |
| T-11-29 | Information disclosure | Next step links | low | mitigate | Links render only through `nextActionPresentation` from served hrefs, which follow the relationship availability rules (T-11-06) | closed |
| T-11-30 | Information disclosure | Home items (unreleased assessment) | medium | mitigate | Items render `MyRequestItem` fields only (no assessment field exists on it, plan 11-10) and the released section reads the owner's released list; unit cases assert no assessment link on request items (T-11-06) | closed |
| T-11-31 | Spoofing | E2E partial fixture | low | mitigate | The selector resolves only under the attested harness flag and after the real reads succeed; a closed value list (D-23) | closed |
| T-11-32 | Denial of service | Count reads on every layout render | low | mitigate | Two or three bounded reads, all aggregates except a one-row page; unawaited, so no page waits; no polling | closed |
| T-11-33 | Information disclosure | Error detail in the sidebar | low | mitigate | A failed read renders nothing; no error text reaches the sidebar (ASVS V7.4.1) | closed |
| T-11-34 | Information disclosure | Stage split | medium | mitigate | `applyDisclosableParent` stays the union of the two named branches and is still applied first in `applyFilters`, so `stage` only narrows; the partition test proves a partly released assessment's Risks appear in neither (ASVS V4.2.1) | closed |
| T-11-35 | Tampering | `dueState`, `mitigationEffectiveness`, `impactedSystem`, `none`, `any` | high | mitigate | Closed enums mapped to constant SQL fragments; `today` and the window end are server values bound as parameters; `impactedSystem` is a separate key so a documentId can never collide with `none` (research Pitfall 21) (ASVS V5.3.4) | closed |
| T-11-36 | Information disclosure | New filters | low | mitigate | Every filter runs after `applyDisclosableParent` in `applyFilters`, so they only narrow the scope | closed |
| T-11-37 | Information disclosure | Staged exposure | low | mitigate | The operation keeps `requireAnalystInsightScope` and its human-analyst grant; both partitions sit inside the Risk register's disclosable scope (the named branches), so no new Risk becomes visible (ASVS V4.1.1) | closed |
| T-11-38 | Repudiation / Integrity of figures | Exposure counts | medium | mitigate | One definition (the register's branches) for the dashboard, the register filter and the reports; the integration test proves each count equals its register list total | closed |
| T-11-39 | Information disclosure | Staged report | low | mitigate | Both partitions sit inside the Risk register's disclosable scope; the report keeps `requireAnalystInsightScope` and its human-analyst grant (ASVS V4.1.1) | closed |
| T-11-40 | Integrity of figures | Due window and alert kinds | medium | mitigate | One shared predicate for the register, the alerts and the report, proved equal by integration tests; the existing alert fixtures prove the alert lists are unchanged | closed |
| T-11-41 | Tampering | Report query | low | accept | No new query parameter; `today` and the window are server values bound as parameters | closed |
| T-11-42 | Tampering | Figure hrefs | low | mitigate | Every href is an internal path built in the presentation module with `URLSearchParams` (values encoded) from closed vocabularies and served ids; the target lists re-validate their URL and Strapi parses closed keys (ASVS V5.1.5) | closed |
| T-11-43 | Information disclosure | Linked lists | low | accept | Each link opens a list the analyst can already open; Strapi scopes every read; no new read is added | closed |
| T-11-44 | Spoofing | Cross-origin action calls | low | mitigate | Next's Server Action origin check (08 D-48) and the session cookie identity; the action validates its input and never echoes it beyond the trimmed term | closed |
| T-11-45 | Tampering | Navigation from a result | low | mitigate | Hrefs are built server-side from closed kinds and served ids; navigation goes through the guard, so unsaved answers are protected (D-51) | closed |
| T-11-46 | Information disclosure | Cross-Requestor results | high | mitigate | The browser proof `UX10_SCOPE_SECONDARY_REQUESTOR` searches another Requestor's number and title and finds nothing; the scoping is Strapi's (owner and analyst policies), unchanged (ASVS V4.2.1) | closed |
| T-11-47 | Information disclosure | Error states | low | mitigate | Failure copy names the list, never the cause or any server detail (ASVS V7.4.1) | closed |
| T-11-48 | Denial of service | Retry | low | mitigate | `Retry search` reruns one term through the same single-flight path; no automatic retry loop | closed |
| T-11-49 | Tampering | Operator development data during the walk | medium | mitigate | The walk is read-only by rule (no submit, release, generate, answer or save) | open — below high; historical conduct not independently verified |
| T-11-50 | Information disclosure | Secrets in the gate record | medium | mitigate | No `.env` file is read or printed; the summary holds counts and command output only | closed |
| T-11-51 | Elevation of privilege | Boundary drift (content types, Keycloak flags, dependencies) | high | mitigate | The static checks fail the gate on any content-type, Keycloak, flag, manifest, lockfile or `CSRM_AI_` change since `PHASE_11_BASE` | closed |
| T-11-52 | Information disclosure | Requestor Home reads (continues T-11-01) | medium | mitigate | The service calls owner-scoped operations only; the route-fixture test and `home-page.test.tsx` prove no analyst read, fixture or partial for a Requestor (ASVS V4.1.1) | closed |
| T-11-53 | Information disclosure | `MyRequestItem` (continues T-11-06) | medium | mitigate | No assessment field is projected; the questionnaire appears only when the relationship projection marks it available; the integration test asserts no assessment number or id in any item | closed |
| T-11-SC | Tampering | npm installs | low | accept | No package is added; the lockfile is unchanged | closed |

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---|---|---|---|---|
| AR11-01 | T-11-12 | Status fallback renders only the accepted status value, with closed input parsers at the boundary. | Approved 11-01 plan | 2026-10-04 |
| AR11-02 | T-11-16 | Recovery destinations are fixed internal paths and cannot be selected by external input. The shell refusal now uses the fixed sign-in destination. | Approved 11-03 plan | 2026-10-04 |
| AR11-03 | T-11-41 | Report dates and windows are server-derived, bound values; no new report input is exposed. | Approved 11-17 plan | 2026-10-04 |
| AR11-04 | T-11-43 | Figure links open already authorized lists; Strapi independently scopes every read. | Approved 11-18 plan | 2026-10-04 |
| AR11-05 | T-11-SC | Phase 11 adds no dependency. Package manifests and pnpm lockfile remain frozen against 9f95575. Historical workspace migration removed the obsolete yarn lockfile; that housekeeping exception predates the review fixes and is recorded separately. | Approved Phase 11 plans; recorded migration exception | 2026-10-04 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open below high | Open blocking | Run By |
|---|---|---|---|---|---|
| 2026-10-04 | 54 | 52 | 2 | 0 | gsd-security-auditor, independent read-only audit |

No transfer dispositions or unregistered attack-surface flags were found. The auditor inspected tests without executing them. Supplied regression evidence: web3328/3328; api:check, strict typecheck, lint and production build passed; backend709/710 with one stale key assertion repaired test-only, followed by the complete mounted Risk Register file18/18. The final complete backend run remains required.

## Verified boundary evidence

| Threat IDs | Code and test evidence |
|---|---|
| 01,14,30,31,52 | Home variant and service capability selection precede reads; owner-only services and attested successful-read fixtures. Home, fixture and route tests. |
| 02,17,18 | Capability navigation and server analyst route gates; direct Requestor URLs issue no analyst reads. Navigation and analyst-route-gate tests. Strapi policy unchanged against9f95575. |
| 03,19 | csrm-authorization policy, collection-scope closed keys/bounds, review-queue-repository bound literal search and minimal display-name projection. Mounted queue tests. |
| 04,21,22 | assessment-scope owner/release predicate intersects all filters; bounded grouped page-ID Risk aggregation. Mounted owner-isolation test. |
| 05,26,27,53 | my-requests policy-selected numeric owner joins, closed input maps, no assessment projection and six-actor matrix. Mounted my-requests cases. |
| 06,23,24,28,29 | request-lifecycle relationship availability and closed served holder/actor; shared next-action presentation. Lifecycle, parser and service tests. |
| 07,32,33 | navigation-counts capability-selected bounded reads; failures omit badges and layout does not await reads. Isolation and failure tests. |
| 08,34,35,36 | risk-register-query closed enums and bound dates; risk-register disclosable parent runs first; shared treatment-due-state. Mounted partitions/filter proofs. |
| 37,38,39,40 | Dashboard/report analyst policy and shared register branches/due predicate; mounted figure-equals-list and alert-equality proofs. |
| 09,10,44,45,46,47,48 | quick-find-actions validated 2–100-char terms, existing scoped ten-row reads and encoded internal hrefs; Next action origin check; single-flight/debounce, safe error copy and leave guard. Mounted/unit scope/retry/throttle cases; new identity-switch browser passed. |
| 11,13,15,25,42 | Stored approved retained, fixed redirect, recursive safe-copy guard, route-wide client validation boundary and encoded figure URLs. Corresponding unit/browser proofs. |
| 50,51 | Gate evidence contains results without env values. Freeze compares clean for content types, manifests/pnpm lock, production Keycloak source/flags and AI config; catalogue copies identical. Recorded migration/obsolete yarn-lock exceptions retained. |

## Open below the blocking threshold

| Threat | Evidence limit | Required disposition |
|---|---|---|
| T-11-20, low | Term/page bounds and count/page reads exist. requestNumber is unique, but the declared title index was not found in schema, bootstrap, config or migrations. | Adjudicate the index claim against literal contains search; do not claim an absent index. |
| T-11-49, medium | The approved read-only walk table reports conduct but lacks an independently inspectable action transcript or before/after database comparison. | Preserve the historical evidence limit; do not invent a transcript or human approval. |

## Sign-Off

- [x] All threats have a disposition and severity.
- [x] Five accepted risks documented from approved plans.
- [x] Blocking threats_open:0 confirmed at block_on:high.
- [x] Independent audit result and non-blocking evidence gaps retained.

**Approval:** Severity-filtered automated security gate verified2026-10-04. No human security approval claimed.
