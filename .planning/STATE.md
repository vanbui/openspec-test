---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 06.9
current_plan: 3/3 complete
status: complete
last_updated: "2026-09-23T12:30:00.000Z"
last_activity: 2026-09-23 — Phase 06.9 complete: assessment navigation and lifecycle visibility
progress:
  total_phases: 19
  completed_phases: 15
  total_plans: 146
  completed_plans: 146
  percent: 79
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-21)

**Core value:** Make a complex cyber-risk workflow simple and auditable while keeping Security Analysts—not AI—in control of assessment review and release.
**Current focus:** Phase 06.10 — Local LLM Evaluation and Optimisation (Phase 06.9 complete 2026-09-23)

## Milestone

**Version:** 1.0
**Status:** Phase 06.9 complete — ready to plan Phase 06.10
**Current phase:** 06.9 (complete)
**Current plan:** 3/3 complete
**Total Plans in Phase:** 3

## Decisions

- Turborepo will contain `apps/strapi` and `apps/web`; the existing sibling Strapi project will be migrated into the repository during Phase 1.
- The provided CSRM project brief governs scope; the Strapi OpenAPI contract governs production API communication.
- Keycloak authenticates identities; IdamBox/Strapi remains the source of application authorization.
- AI assists with drafts and suggestions but cannot release assessments.
- [Pre-Phase 06.1, 2026-09-03]: Revert-to-draft scope confirmed by the operator — a Request may be reverted only from `submitted`; a Questionnaire only while its request is `questionnaire-in-progress` and no assessment draft exists. Both the owning Requestor and an authorised Security Analyst may revert. A mandatory reason plus reverter identity and timestamp are persisted on `CsrmAssessmentRequest` and `CsrmQuestionnaire`, with the data-model addition justified in a `docs/contract-gaps/` record before the schema changes.
- [Phase 06.1, 2026-09-03]: Reversal is granted through its own API-only Function for each aggregate rather than through the shared details grants, so it can be withdrawn independently and the service analyst agent cannot return submitted work to draft. Reversal responses must carry the reverting identity as a populated relation; the typed web boundary rejects the payload otherwise and reports a completed reversal as a failure. The analyst request screen treats a missing questionnaire as ordinary content, not an empty screen, because a submitted request without a questionnaire is the only reversible state.
- [Pre-Phase 06.2, 2026-09-03]: Questionnaire generation mirrors the Phase 4 assessment-draft pattern (POST generate operation, job registry with queued/running/completed/failed/retry, provider-independent interface, polled analyst UI) and ships a working deterministic provider. Generation is offered while the request is `submitted`; regeneration replaces an unanswered questionnaire and is refused once any answer exists.
- [Pre-Phase 06.3, 2026-09-07]: The post-06.2 review produced thirteen findings, split into two phases so correctness lands before polish. 06.3 takes the owner-scoping correction, the released-assessment read failure, and every search, filter, and lookup control. 06.4 takes cross-record navigation, the assessment risk-count tile, release-readiness specificity, and the interface consistency pass. Locked decisions: the "my" screens are owner-scoped for every actor because Requestor is a birthright role; systems, assets, and Risk owners are chosen through server-backed bounded search rather than checkboxes or free text; and a record opens from its identifier or title with row-level Open buttons removed everywhere.
- [Phase 06.3, 2026-09-08]: A My list is owner-scoped for every actor, but the analyst review surfaces are separate routes that keep the wider scope their explicit grant carries; collapsing them into the same rule removed an analyst's ability to review work they do not own. A Requestor selector and an Administration list share one HTTP path and are told apart by one shared predicate used by both the authorization policy and the controller, so the grant decision and the handler decision cannot diverge. The released detail is served only with complete release facts, enforced in both the contract and the projection, rather than loosening the client to accept a payload it cannot render. A contract-to-client-schema parity guard now covers the Zod layer the existing parity suites never reached, and any place a client is deliberately narrower than a shared component must declare the path and the reason.

- [Phase 06.4, 2026-09-09]: A related record has three states and they must read differently: absent says so in words, unavailable renders nothing at all because the record's existence is itself protected, and only available may be linked. Publishing that as a discriminated union turned every consumer that assumed presence into a compile error, which is what forced each screen to state its behaviour. A Requestor may open their assessment only once released, so an in-review assessment is unavailable to its own Requestor. Counts are of residual rating and the interface says so. Verification found four defects that passed both typechecks, both unit suites and diff review and were visible only in a running browser, including a `"use server"` module exporting an object and an unlayered anchor reset that made every link style inert; the parity guard cannot see a server projection no client parses yet.

- [Pre-Phase 06.7 execution, 2026-09-15]: Operator approved live development verification against a local OpenAI-compatible runtime only: Ollama at `http://127.0.0.1:11434/v1` with model `qwen3.5:9b` and no API key, so request and questionnaire content never leaves the machine. No external SaaS endpoint is approved. Non-secret `CSRM_AI_*` values live in the gitignored `apps/strapi/.env`; automated suites stay hermetic.
- [Phase 06.7, 2026-09-15]: openai 7.15.0 rejects an empty credential at construction, so a keyless endpoint gets an inert constructor credential and the request hook strips the authorization header; the configuration still accepts a blank key. The E2E Strapi server pins CSRM_AI_PROVIDER=deterministic so a developer .env configured for live checks cannot reach a model during browser journeys.
- [Phase 06.7, 2026-09-15]: Live verification showed questionnaire generation could never succeed against a real model because the request schema left each question's options undescribed, so the model invented a structure the parser rejected. The model now returns a fully required wire shape (text, a six-value answer type excluding file upload, section title, required flag, choices) and the adapter assigns question keys, section keys and orders before the unchanged parser validates the result (D-14). Endpoint doubles that return hand-written definitions cannot catch this class of defect; provider tests must use the model-facing shape.
- [Pre-Phase 06.5, 2026-09-03]: Real AI integration is scoped to the two implemented operations only — assessment-draft generation and questionnaire generation — substituted behind the existing provider interfaces. Deterministic providers are retained for tests and offline runs. The remaining conceptual AI operations in the brief stay out of scope for this milestone.
- Playwright E2E execution against `next dev` is accepted for Phase 1 and deferred to Phase 8 production hardening.
- [Pre-Phase 02, 2026-08-29]: The design system foundation landed ahead of Phase 2: Tailwind v4 active through PostCSS, `docs/design/csrm-design-direction.md` adopted as the authoritative visual direction, semantic token names preserved with evolved values plus status/risk/motion extensions, shadcn/ui installed as the component foundation (themed via token aliases), Inter loaded through next/font, and the legacy ui/primitives module retired. Phase 2 screens compose these primitives; feature components must consume tokens or mapped utilities only.
- [Pre-Phase 02, 2026-08-29]: Development auth bridge design: a development-only Strapi middleware resolves a trusted `x-csrm-dev-identity` email header to a seeded idambox-user and sets `ctx.state.idamboxUser` (enabled only when `NODE_ENV=development` and `CSRM_DEV_IDENTITY=true`, fail-closed otherwise); a dev-gated bootstrap grants users-permissions public-role content-api actions for csrm-* types only (never IAM types); the web dev session maps fixture roles to jane.doe@idambox.com (Requestor) and bob.doe@idambox.com (Security Analyst) and the server-only transport attaches the identity header. Keycloak remains out of scope until Phase 8.
- [Phase 03]: Emit the Phase 3 RED sentinel only after Strapi health, fixture sign-in, shell, responsive, keyboard, and existing navigation baselines pass.
- [Phase 03]: Keep the PHASE3_RED sentinel confined to Plan 03-01 and require Plan 03-12 to remove the escape hatch when the journey turns GREEN.
- [Phase 03]: Use schemaVersion 1 closed Zod definitions and reject unknown keys, versions, type mismatches, nondeterministic order, and invalid condition graphs. — Persisted Strapi JSON crosses a mutable trust boundary and must fail closed.
- [Phase 03]: Represent File upload as unsupported/file-upload-deferred, accept only null, and block completeness when visible and required. — No authorised upload, storage, scanning, or retention contract exists in Phase 3.
- [Phase 03]: Derive questionnaire visibility, hidden-answer clearing, progress, and completeness with pure functions. — Server and renderer consumers must recompute the same deterministic state outside JSX.
- [Phase 03]: Serve exactly eight questionnaire workflow operations under /v1; keep Phase 4 review-comment, complete-review, and assessment-generation operations unserved.
- [Phase 03]: Treat questionnaireId as an opaque Strapi documentId and allowlist draft mutations to questionKey/value only.
- [Phase 03]: Use bounded named questionnaire DTOs with shared safe 400/403/404/409 error envelopes.
- [Phase 03]: Serve questionnaire reads only through exact catalogue-backed /api/v1 workflow routes; generic questionnaire and question CRUD routes remain unmounted.
- [Phase 03]: Resolve explicit analyst grants before the implicit Requestor birthright, yielding analyst read-all or Requestor owner-only scope server-side.
- [Phase 03]: Mask every draft answer from analyst question projections until the questionnaire has one complete submitted answer batch.
- [Phase 03]: Parse persisted questionnaire definitions and answer envelopes independently inside Strapi before any draft or submit write.
- [Phase 03]: Treat submitted and questionnaire-in-progress as the only answerable request states, and make submitted answer batches immutable.
- [Phase 03]: Submit the complete active answer batch through Strapi transaction context with one server timestamp.
- [Phase 03]: Gate questionnaire fixtures on IDAMBOX_SEED_CSRM=true plus the exact development runtime and development identity gates.
- [Phase 03]: Reconcile questionnaire workflow fixtures by stable requestNumber, questionnaireNumber, and questionKey metadata rather than record counts.
- [Phase 03]: Validate the complete questionnaire seed definition graph through the production schemaVersion 1 parser before persistence.
- [Phase 03]: Keep Requestor and analyst questionnaire inventories as distinct service functions even though they share a bounded summary projection.
- [Phase 03]: Parse over-populated question records into an explicit allowlist before applying the strict definition graph parser.
- [Phase 03]: Return validated answer values with safe mutation failures and invalidate Requestor plus analyst routes only after authoritative success.
- [Phase 03]: Reuse assessment-request:read for questionnaire navigation visibility because Requestor questionnaire access is owner-scoped by Strapi and navigation is not authorization.
- [Phase 03]: Keep the discovery presentation server-compatible and reserve client behavior for the route error boundary retry.
- [Phase 03]: Render questionnaire state, answered progress, and unanswered count as explicit text and icons so meaning never depends on color.
- [Phase 03]: Validate the complete active questionnaire before opening confirmation, then persist current active answers before invoking the server-owned atomic submit operation. — Prevents invalid confirmation while retaining server authority.
- [Phase 03]: Render submitted answers through the same ordered section and visibility tree as edit mode, replacing controls with semantic read-only values. — Guarantees one renderer model for Requestor and analyst consumers.
- [Phase 03]: Treat active required File upload questions as explicit unavailable blockers and never expose a text, URL, or file control fallback. — Fails closed until an authorised upload contract exists.
- [Phase 03]: Check authoritative questionnaire state before requesting analyst questions so draft answers never cross the web page boundary.
- [Phase 03]: Reserve analyst answer rendering for submitted records through the shared QuestionnaireRenderer read-only mode.
- [Phase 03]: Discard questionnaire and definition props in every non-submitted analyst detail state.
- [Phase 03]: Count active dashboard questionnaires from the owner-scoped status summary while bounding rendered action items to 50 from the owner-scoped list.
- [Phase 03]: Keep request and questionnaire dashboard actions as a discriminated union so each retains its authoritative workflow state and presentation contract.
- [Phase 03]: Expose analyst questionnaire review through assessment:review capability visibility without treating navigation as authorization.
- [Phase 03]: Use a process-unique isolated SQLite filename for every Phase 3 Playwright run. — Prevents stale fixture state and protects the developer database.
- [Phase 03]: Return closed OpenAPI QuestionnaireMutationResult projections from questionnaire mutations. — Keeps mounted responses aligned with the generated typed client.
- [Phase 03]: Treat bodyless questionnaire submit as submission of the authoritative persisted draft batch. — The published submit operation has no request body and Strapi owns completeness.
- [Phase 04]: Represent the three-part assessment release fact with all eight boolean combinations so malformed partial releases can be tested fail-closed.
- [Phase 04]: Keep provider and document-write failure injection inside the mounted test harness with no environment or production-route switch.
- [Phase 04]: Use a synchronous ordinary Playwright count expectation for the Wave 0 analyst queue boundary so the RED remains attributable without locator-timeout noise.
- [Phase 04]: Release requires the complete assessment status/approver/date triple and owning-request approval in one transaction; partial facts fail closed.
- [Phase 04]: Draft jobs use an exhaustive volatile four-state registry with bounded terminal retention, while persisted provenance identifies the initiating analyst.
- [Phase 04]: Risk and ControlImplementation mutation contracts expose only their frozen editable fields and resolve relation identifiers server-side.
- [Phase 04]: Identifier collision retries are field-specific. — Unrelated unique constraints must propagate immediately rather than consume the bounded retry budget.
- [Phase 04]: Partial release facts are immutable and fail closed. — Only the valid complete approval triple is released, while any incomplete aggregate blocks further mutation.
- [Phase 04]: Assessment aggregate mutations use exact positive allowlists. — Unknown, parent, workflow, release, identity, and audit fields are rejected before persistence.
- [Phase 04]: Questionnaire text is treated only as bounded data and is never echoed into proposal templates or interpreted as instructions.
- [Phase 04]: Job records expose safe metadata only; initiating analysts retain access while equivalent all-job scope must be asserted by the later exact-grant route boundary.
- [Phase 04]: Deterministic RiskTypes reuse six stable controls from the existing 2,646-control library and seed reconciliation replaces only managed descriptions and relations.
- [Phase 04]: Use a dedicated assessmentReviewCollectionScope so the analyst queue cannot inherit Requestor birthright or the broader core collection behavior.
- [Phase 04]: Keep the queue DTO at five fields and use the opaque request documentId to follow existing authorised request and questionnaire relationships.
- [Phase 04]: Keep volatile job lifecycle in the bounded registry while assessment-workflow exclusively owns authoritative reloads, provider validation, identifiers, relations, and transactional persistence.
- [Phase 04]: Treat a linked draft on a risk-assessment-drafted request as restart discovery and never invoke the provider or create a duplicate aggregate.
- [Phase 04]: Require the resolved explicit analyst actor inside every assessment metadata controller path; Requestor release reads remain deferred to Plan 04-16.
- [Phase 04]: Serialize by Assessment documentId and lock/reload inside the transaction before applying the positive metadata allowlist.
- [Phase 04]: Stamp reviewedBy and draft-to-review transitions only on the first accepted edit; later edits preserve the original reviewer and states.
- [Phase 04]: Shared ancestor mutation transaction — Assessment and contextual Risk writes use one serialized row-lock, release guard, and first-edit transition path.
- [Phase 04]: Exact server-side Risk reference resolution — Risk relations resolve against their exact content types and active-user state before persistence.
- [Phase 04]: ControlImplementation mutations resolve Risk to Assessment and revalidate exact descendant ancestry inside the shared serialized Assessment transaction. — Direct child routes cannot bypass partial or complete release immutability.
- [Phase 04]: Reusable Controls are resolved server-side and projected separately from contextual ControlImplementations. — Preserves JDL terminology and rejects forged cross-content-type relations.
- [Phase 04]: Release serializes on Assessment documentId, locks and reloads readiness inside one transaction, and stamps both dates plus the owning request with one server time.
- [Phase 04]: Requestor assessment projections require exact owner ancestry plus the complete release triple and approved owning request.
- [Phase 04]: Shared assessment descendant GET operations branch by the server authorization actor while every mutation remains exact analyst-only.
- [Phase 04]: Keep analyst and Requestor assessment functions and schemas distinct even where the generated API shares a GET path.
- [Phase 04]: Project every mutation body field explicitly into the named generated OpenAPI DTO and let openapi-fetch serialize validated opaque path parameters.
- [Phase 04]: Expose no Risk delete service, action, input, or result because the served generated inventory has no Risk DELETE operation.
- [Phase 04]: Keep each review route shell synchronous and place every typed service read inside a named async child under an explicit concrete Suspense fallback.
- [Phase 04]: Bound draft-job observation to one request in flight, one-second cadence, and a 30-second client budget while preserving the server-owned job as authority.
- [Phase 04]: Compose request detail with the authorised questionnaire review inventory so draft generation receives the opaque questionnaire identifier without raw UI transport.
- [Phase 04]: Submit only analyst-changed Risk and ControlImplementation fields because frozen reads return compact summaries; merge successful edits into local review state.
- [Phase 04]: Keep the assessment detail route synchronous and place all typed reads inside its Suspense-wrapped async child.
- [Phase 04]: Offer release only through readiness-gated explicit analyst confirmation while Strapi remains authoritative and rejected release stays retryable.
- [Phase 04]: Consume only the current strict owner-released service projections; never infer release from status or enrich missing contract fields in the UI. — Preserves the frozen contract and server-owned release fact.
- [Phase 04]: Discard the complete Requestor assessment presentation if any released descendant read is forbidden, missing, malformed, or unavailable. — Prevents partial disclosure of sensitive risk information.
- [Phase 04]: Keep Requestor released assessment presentation structurally separate from analyst editors with no mutation or release affordance. — Maintains immutability without using disabled controls as authorization.
- [Phase 04]: Use the owner-scoped rating-summary total as the released dashboard count while bounding rendered recent assessment DTOs to five.
- [Phase 04]: Treat any released list or rating-summary permission or transport failure as a dashboard permission/error state rather than an empty success.
- [Phase 04]: Construct read-only assessment links from encoded opaque document IDs and never derive releases from approved request records.
- [Phase 04]: Prerelease Requestor checks use a separate browser context so the frozen RiskSummary response remains unchanged while Strapi independently validates persisted release readiness.
- [Phase 04]: The integrity gate derives its range from the oldest executor-scoped Phase 4 commit and scans added production/test lines plus the complete Phase 4 test set.
- [Phase 04]: Normalize supplied Risk text in the shared writable-field parser before validation and persistence.
- [Phase 04]: Validate analyst review due-date filters through UTC component round-tripping to reject impossible calendar values without timezone drift.
- [Phase 04]: Use existing authorised assessment-detail ownerLabels for persisted owner selections; do not add identity input or a second request.
- [Phase 04]: Propagate typed searchActiveUsersAction through editor props while server response remains the sole release-readiness authority.
- [Phase 04]: Validate Phase 4 integrity from approved base ccfe77e6650e95b539645700f190aaab2c924bfe rather than a branch name.
- [Phase 04]: Skip only empty normalized Risk and ControlImplementation edit deltas locally; preserve create and changed updates.
- [Phase 04]: Retain the isolated dual-role Playwright closure and record responsive keyboard verification approval.
- [Phase 05]: Make the first missing-product assertion the visible /app/risks Risk Register heading after health, sign-in, and shell baselines pass. — This makes the RED attributable only after the inherited harness baselines succeed.
- [Phase 05]: Run pnpm through the active Node executable's Corepack entry point for the RED wrapper. — This preserves the required Node runtime across Windows command shims without a dependency.
- [Phase 05]: Require the exact human Security Analyst role and exact GET:/api/v1/risks grant before creating Risk Register collection scope. — Prevents service-agent grants from authorizing the human analyst register.
- [Phase 05]: Perform semantic severity and bidirectional target-date null-last ordering in the SQLite repository before limit/offset, then hydrate only selected document IDs through Strapi. — Preserves global ordering and bounded hydration across pages.
- [Phase 05]: Reject targetDateFrom and targetDateTo as unknown contract parameters while continuing to project and globally sort targetDate. — Preserves the frozen API contract without inventing unsupported filters.
- [Phase 05]: Keep targetDate projected and sortable while browser canonicalization discards targetDateFrom/targetDateTo and generated transport cannot express them. — Preserves the locked Phase 5 contract without inventing unsupported date filters.
- [Phase 05]: Use closed selectedLabels to preserve active off-page picker selections without widening bounded inventory responses. — Bounded authorised inventories remain honest while selected values stay visible.
- [Phase 05]: Apply existing server inventory bounds as explicit client trust-boundary caps with cap-plus-one payloads failing closed. — Malformed or over-populated Strapi responses cannot reach UI consumers.
- [Phase 05]: Reuse the exact human Security Analyst Risk Register scope for detail authorization before any caller-selected Risk lookup.
- [Phase 05]: Project one closed Risk aggregate with bounded ID/label relation summaries and a 1,000-item mitigation limit checked by a plus-one probe.
- [Phase 05]: Derive released Risk detail state through the existing complete release predicate; partial or malformed release facts return the safe no-data path.
- [Phase 05]: Rebuild Risk Register URLs exclusively from the closed canonical query. — Unsupported date-filter and unknown URL state are discarded instead of copied forward.
- [Phase 05]: Resolve risk:manage presentation denial before typed Risk inventory reads. — Denied routes expose no filter, total, paging, or protected record clue.
- [Phase 05]: Preserve server response order and authoritative totals across desktop Risk tables and mobile cards. — Global sorting and pagination remain owned by Strapi.
- [Phase 05]: Activate the mutable Risk fixture only when IDAMBOX_SEED_CSRM=true and the complete established development identity predicate passes. — Production and partial development gates must remain inert.
- [Phase 05]: Assign workflow, release, and mutability facts only when creating managed seed records; reseeds repair safe presentation and relationships without normalising live state. — Development restarts must not regress analyst workflow or persisted edits.
- [Phase 05]: Serialize Risk Register seed reconciliation in process so concurrent bootstrap calls cannot create duplicate stable aggregates. — Stable-key lookup and create must remain safe under concurrent bootstrap calls.
- [Phase 05]: Represent Risk detail only as one complete mutable or released aggregate; malformed or partial release state remains a safe no-data result.
- [Phase 05]: Treat action values as already-computed deltas, reject empty updates server-side, and keep no-op handling local to the UI.
- [Phase 05]: After a 409, perform exactly one authoritative detail read without retrying the mutation or invalidating routes.
- [Phase 05]: Load the complete Risk aggregate only after the risk:manage capability check, and load mutable picker inventories only after the server-owned parentLock is known.
- [Phase 05]: Replace local detail state from the single authoritative 409 result; released authority removes all editors while unavailable authority removes the complete Risk projection.
- [Phase 05]: Render released Risks through semantic values with no forms, disabled controls, mutation buttons, or picker inventory reads.
- [Phase 05]: Integrity scope derives from the oldest Phase 5 task commit recorded in a summary. — This makes the final-tree gate attributable and deterministic.
- [Phase 05]: Browser totals remain authoritative and suite-order independent. — Displayed totals are compared with distinct rendered records while both stable fixtures remain mandatory.
- [Phase 05]: Playwright servers launch through the invoking Node Corepack entry point. — This preserves Node 24.19.0 across Windows command shims.
- [Phase 05]: Validate fixed-width target dates by UTC component round-tripping before comparing canonical YYYY-MM-DD strings. — Impossible dates cannot normalize silently.
- [Phase 05]: Apply both inclusive date bounds only through the shared repository filter used by count and page selection. — Authoritative totals and pages must share one pre-pagination predicate.
- [Phase 05]: The approved RISK-01 target-date addendum supersedes the earlier temporary Phase 5 decisions that rejected or stripped targetDateFrom and targetDateTo.
- [Phase 05]: Reject the complete browser query when any supplied target-date bound is invalid, duplicated, impossible, or inverted, then render no data and issue no service requests. — Prevents malformed URL state from silently broadening the authorised register.
- [Phase 05]: Reuse one Target date range fieldset in desktop More filters and the mobile Sheet while representing each bound as an independent active filter. — Keeps responsive behavior consistent while preserving individual chips and clearing.
- [Phase 05]: Use the stable mutable Risk target date for deterministic inclusive browser proof.
- [Phase 05]: Keep Phase 5 in progress until orchestrator-owned re-verification passes.
- [Phase 06]: Keep each Administration E2E segment independently selectable with its own health, sign-in, and shell baseline. — Prevents earlier slices from selecting later product behavior and preserves attributable GREEN progression.
- [Phase 06]: Treat unchanged as a first-class CSV state whose persistence must remain byte-for-byte unchanged. — Prevents unchanged rows from being collapsed into rejection or receiving writes.
- [Phase 06]: Make authorization denials prove collection persistence before asserting the expected status. — Denial tests remain meaningful even while the exact Phase 6 route is still RED.
- [Phase 06]: Represent legacy Risk Type and Control picker grants as distinct query-qualified FunctionAPI operations while retaining the unchanged no-query HTTP contract. — Separates assessment picker compatibility from human-only Administration authorization on shared paths.
- [Phase 06]: Treat any explicit picker-route query as an Administration request before parsing. — Ensures exact-grant and human-analyst authorization precede caller-controlled query validation and lookup.
- [Phase 06]: Keep downstream CRUD and import handlers fail closed until their owning plans land. — Allows Strapi route registration without falsely implementing or exposing later workflows.
- [Phase 06]: Preserve existing assessment operation identities and safe errors on the shared Risk Type and Control GET paths while extending their generated Administration typing. — Maintains inherited picker contract parity on shared HTTP paths.
- [Phase 06]: Treat normalized Information System and Information Asset uniqueness as a single-Strapi-process guarantee; multi-process adoption requires a separately approved schema migration. — Frozen schemas have no database uniqueness for these two natural keys.
- [Phase 06]: Keep Risk Type as the only enabled Administration workflow kind in Plan 06-04 while retaining compile-time closed configuration for later collections. — Preserves the plan boundary while keeping caller-selected UIDs and tables impossible.
- [Phase 06]: Resolve bounded applicable Control document IDs server-side and project no persistence metadata in Risk Type DTOs. — Prevents forged relations and persistence metadata disclosure.
- [Phase 06]: Normalize application conflicts and database uniqueness failures to one field-addressable Risk Type 409. — Gives callers one safe deterministic conflict contract.
- [Phase 06]: Treat administration:manage as presentation capability only; every route resolves it before reads while Strapi remains authoritative. — Navigation visibility is not authorization.
- [Phase 06]: Project at most 100 deterministic Control options and use sequenced typed server search for off-page matches. — Keep the browser bounded while retaining dynamic relation search.
- [Phase 06]: Keep Risk Types as the only operable Administration collection in Plan 06-05; CSV import remains later. — Preserve attributable plan ownership.
- [Phase 06]: Control collection differences remain in the existing closed Administration adapter family. — This preserves the Strapi production boundary and prevents parallel endpoints or frontend facades.
- [Phase 06]: Control filtering remains server authoritative; framework suggestions are page-bounded. — Free typed input reaches Strapi while the client avoids claiming global facet completeness from one page.
- [Phase 06]: Mobile administration shortcuts derive from capability-gated navigation. — Desktop and mobile discovery now share the same authorization-aware navigation model.
- [Phase 06]: Resolve Information System owners by exact active IdamBox user document ID and project only the bounded owner identifier.
- [Phase 06]: Retain normalized Information System and Information Asset uniqueness as a serialized single-Strapi-process guarantee without changing frozen schemas.
- [Phase 06]: Use a clean browser-cookie reset between Bob and Jane E2E baselines because the Next development Sign-out server action can hang independently of ADMIN-03.
- [Phase 06]: Preflight exact CSV byte, logical-row, and record-byte limits before fatal UTF-8 decoding and standards-compliant parsing.
- [Phase 06]: Classify duplicate CSV keys and multiple persisted matches as ambiguous without selecting a winner.
- [Phase 06]: Keep browser CSV parsing advisory while mirroring closed columns, exact limits, blank-optional semantics, and formula-safe downloads.
- [Phase 06]: Bind Risk Type commit to literal confirmed=true, the prefixed SHA-256 preview digest, and a second upload of the same File bytes.
- [Phase 06]: Reload and reclassify Risk Types inside the serialized commit boundary, then isolate every eligible row in its own repository transaction.
- [Phase 06]: Treat transport and 5xx commit failures as unknown outcomes that require collection inspection, never an automatic mutation retry.
- [Phase 06]: Extend the Risk Type import slice through closed collection configuration instead of forking parsers, controllers, actions, or UI.
- [Phase 06]: Create browser update and unchanged fixtures through the UI inside each invocation-scoped Playwright database.
- [Phase 06]: Mechanically fail Phase 6 integrity on any test escape, live-port literal, schema or catalogue drift, generic mutation, or missing token gate.
- [Phase 06]: Keep the frozen previewDigest transport shape while treating its value as a five-minute random opaque proof bound to actor, collection, raw file digest, and the ordered reviewed classification snapshot.
- [Phase 06]: Compare all commit-time row states and matched documentIds with the reviewed snapshot before any write; skip and report drift as ROW_PREVIEW_DRIFT.
- [Phase 06]: Persist contract-valid long Control strings through the Strapi database query layer after closed custom validation because the frozen content-type schemas cannot be changed.
- [Phase 06.3]: Questionnaire status is computed after authorised candidate loading and re-sorted server-side before pagination so rows and totals share scope and ordering.
- [Phase 06.3]: Questionnaire list controls serialize only the typed native status union; clear recovery removes q and status at page one.
- [Phase 06.3]: My Questionnaire and analyst Questionnaire Review remain separate presentation surfaces so their server authorization scopes remain distinct.
- [Phase 06.3]: Parser-bearing service modules are declared explicitly while composing server actions remain parser-free.
- [Phase 06.3]: Selector totals use matching filtered count queries and analyst summaries page beyond the former 1,000-row cap.
- [Phase 06.5 — Design System Conformance]: Design direction is the sole UI token authority; the affected specs defer their stale duplicate values.
- [Phase 06.5 — Design System Conformance]: Uppercase is reserved for named micro-label uses; navigation and form labels remain sentence case.
- [Phase 06.5 — Design System Conformance]: Require the design-direction reference in each affected UI specification Colour section so unrelated references cannot satisfy the authority guard.
- [Phase 06.5 — Design System Conformance]: Keep the documentation guard value-free: detect semantic token/hexadecimal pairings without copying approved design tokens.
- [Phase 06.5 — Design System Conformance]: Only the exact server harness flag enables the closed UI-state allowlist; populated wraps real typed Strapi-authorized service output.
- [Phase 06.5 — Design System Conformance]: A partial dashboard proof is a separately closed server-only selector, not a caller-controlled fixture state.
- [Phase 06.5 — Design System Conformance]: Every state marker is asserted together with visible copy and native or ARIA meaning.
- [Pre-Phase 06.6, 2026-09-10]: 06.6 has no UI-SPEC. The design direction stays the sole value-bearing authority and 06.6-CONTEXT.md carries the per-surface decisions, so a second restatement of design values cannot reappear. Record links move from hover-only underline to an at-rest underline in a quieter link-tinted decoration colour, becoming full link colour on hover and focus; the link colour is 3.3:1 against body text, so the at-rest underline supplies the non-colour cue on touch devices.
- [Pre-Phase 06.6, 2026-09-10]: Every list surface renders through DataTable (table at md and wider, cards below). DataTable is extended with optional sorting, page-size and filter inputs plus an opt-in sticky first column, never forked. State primitives own structure, typography, icon and templated copy; surfaces pass a record noun, a filtered flag, at most one action, and optionally a compact density for dashboard widgets. The dashboard has no exemption from the shared-state rule.
- [Pre-Phase 06.6, 2026-09-10]: Plans that edit the same test file are serialised by dependency rather than relying on parallel execution in one working tree: 05 follows 03 (shared questionnaire workflow test), 06 follows 05, 08 follows 06, and the comparative harness (07) runs last.
- [Pre-Phase 06.6, 2026-09-10]: Plan execution-context includes reference the workflow runtime as the relative `gsd-core/...` path rather than a user-specific install directory. The executor injects its own workflow context, so the change is behaviour-neutral.
- [Phase 06.6, 2026-09-10]: The execution sandbox keeps the repository's `.git` directory read-only, so executors cannot stage or commit. Rather than widening the sandbox to full access, plans run one at a time with git left untouched, and each plan's diff is reviewed, re-verified outside the sandbox, and committed as one conventional commit per plan. Every commit therefore passes review before it lands; the trade-off is per-plan rather than per-task commit granularity.
- [Phase 06.6, 2026-09-11]: Every list surface shares one recovery contract through the shared state primitives: a "Try again" button that refreshes in place on error and a "Return to workspace" link on permission denial; only the dashboard keeps its own recovery links ("View My Requests", "Return to sign in"). DataTable mobile cards are a labelled list of list items, and card identifier links carry a 24px target (WCAG 2.2 2.5.8). Record-link declarations are important so a feature class cannot restyle a record link. The list-state guard resolves every component rendered in a state slot rather than trusting names. The comparative design-contract suite and the 06.5 conformance suite together form the regression harness; the type contract is parsed once, in the conformance suite.
- [Phase 06.8]: D-13 is implemented as a real stored assessmentStatus transition to draft, fired only when the pre-edit assessment was in-review and release-ready; it supersedes the Phase 4 state precedent while retaining its reviewer half.
- [Phase 06.8]: A drafted assessment with a non-null reviewedBy is the retained evidence of a withdrawn review, and the analyst editor states that in words.

- [Design system, 2026-09-24]: ADR 0001 adopts the BProton design system (https://claude.ai/artifact/QaGDSeesQHocAe3yvoGpAx) and supersedes the Phase 06.5 cool-neutral/Inter/blue-accent decision. `docs/design/csrm-design-direction.md` is rewritten to BProton values and stays the sole value-bearing authority. Gaps the system does not define are decided as CSRM extensions: status and risk colours kept, ink-only charts and links, `muted-foreground` input boundaries, dense app type scale with mono micro-labels and serif page titles, light only, pill buttons, Lucide icons kept, dark sidebar as the one dark section, logo as favicon. The e2e conformance suite parses the rewritten §3.10 and fails until the CSS implementation lands on the same branch.

## Risks and Open Decisions

- Confirm deployment target, Keycloak environment, attachment storage, comments/audit model, AI provider/job runner during Phase 1/8 adapters without blocking the core workflow.
- **Phase 1 verification gap closed (2026-08-29):** Requestor DELETE was removed from the birthright grant; mounted HTTP now proves owner denial and persistence before exact-grant analyst deletion.
- **Follow-ups found during Phase 06.6 browser verification (2026-09-11), outside its locked criteria:**
  - Status badge treatment differs by record type: request statuses use the tinted status recipe, while assessment status and Risk treatment status render as neutral outline chips. Design direction §4 specifies the tinted recipe for all status badges.
  - The Risk Register filter bar squeezes the search input to roughly 45px at 1024px, with its label wrapping to two lines; the filter row needs a responsive layout between the mobile sheet and the 1440px row.
  - Only the Risk Register's DataTable scroll region is focusable and labelled. Other DataTables can overflow at mid widths (768–1100px) without a keyboard-focusable scroller; consider making the labelled region unconditional whenever the table overflows.
  - Analyst review search inputs are labelled "Search collection" rather than naming the records searched.
- **Closed 2026-09-21 by plan 06.8-08:** the questionnaire relation read a `state` field nothing populated, so every consumer rendered a confident sentence from null. The relation now derives the state from the release fact and the answers.
- **Follow-ups found during Phase 06.7 live verification (2026-09-15), outside its backend scope:**
  - The analyst request review still labels assessment drafting "Deterministic draft assistance" with a "Start deterministic draft assistance" button, even when `CSRM_AI_PROVIDER=openai-compatible` is selected. The copy misstates the draft's source and should become provider-neutral in a web follow-up.
  - The local verification target runs `qwen3.5:9b` on CPU with a 4,096-token context. Questionnaire generation took roughly two and a half to three and a half minutes, and one attempt exceeded a 300-second request timeout (it failed safely as `PROVIDER_TIMEOUT` with a retry). Timeout and context sizing are operator responsibilities under D-10; the verification run used a 900-second timeout.
- **Latent ordering mismatch found 2026-09-15 (Phase 06.7 review):** `parseAssessmentDraftProposal` checks Risk Type order with plain string comparison, while `deterministic-assessment-draft-provider.ts` sorts with `localeCompare`. Mixed-case Risk Type names would make the deterministic draft fail its own parser. The seeded names do not mix case, so it is recorded rather than changed mid-phase; the OpenAI-compatible adapter already sorts the way the parser checks.
- **Verification gap found 2026-09-11:** Phase 06.6 gates ran only the design-contract and conformance E2E suites, so the Administration journey failed unnoticed from 06.6-05 onward: its Requestor denial proof still expected the pre-06.6 copy. The denial itself was correct; the spec now expects the shared permission state (e8cddb5). The same full run found three more journeys bound to pre-06.6 behaviour — the Requestor journey (substring heading match against the new empty state), the Risk Register denial copy, and the relationship-states journey (reading links before the list replaced its skeleton at 375px) — fixed in 166b41d; the four specs then passed 11/11. The dashboard partial-widget proof failed once late in the 14-minute full run and passed in every isolated run. **Corrected 2026-09-21: this was never load sensitivity.** The UI-state harness attestation expired after ten minutes, so every spec running past that point in a full run silently lost its state boundary. The window now outlasts a full run. Phase gates must run the full E2E suite, not only the suites a phase adds.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260828-g25 | Create a brief README file with the steps to build and run this project | 2026-08-28 | db4f6fc | [260828-g25-create-a-brief-readme-file-with-the-step](./quick/260828-g25-create-a-brief-readme-file-with-the-step/) |
| 260828-gvj | Implement the agreed apps/web engineering-rule alignments while preserving Phase 1 plan ownership | 2026-08-28 | 1f45646 | [260828-gvj-implement-the-agreed-apps-web-engineerin](./quick/260828-gvj-implement-the-agreed-apps-web-engineerin/) |
| 260830-1hh | Remediate the confirmed Phase 2 review findings | 2026-08-29 | 09c8ae2 | [260830-1hh-remediate-the-confirmed-phase-2-review-f](./quick/260830-1hh-remediate-the-confirmed-phase-2-review-f/) |
| 260830-89x | Remediate the confirmed Phase 3 review findings | 2026-08-29 | 2df1fdb | [260830-89x-remediate-the-confirmed-phase-3-review-f](./quick/260830-89x-remediate-the-confirmed-phase-3-review-f/) |
| 260831-r6j | Require the Strapi API token for every frontend-to-Strapi call and remove anonymous access | 2026-08-31 | 6b6c30f | [260831-r6j-require-the-strapi-api-token-for-every-f](./quick/260831-r6j-require-the-strapi-api-token-for-every-f/) |
| 260831-srn | Remediate every Phase 4 review finding with per-finding disposition and full gate | 2026-08-31 | 3112876 | [260831-srn-remediate-every-phase-4-review-finding-w](./quick/260831-srn-remediate-every-phase-4-review-finding-w/) |
| 260901-oiw | Remediate every confirmed Phase 5 review finding and prove E2E rerun determinism | 2026-09-01 | ddb8a40 | [260901-oiw-remediate-every-confirmed-phase-5-review](./quick/260901-oiw-remediate-every-confirmed-phase-5-review/) |
| 260901-qri | Make consecutive Playwright runs collision-free | 2026-09-01 | 2b9f7ff | [260901-qri-make-consecutive-playwright-runs-collisi](./quick/260901-qri-make-consecutive-playwright-runs-collisi/) |
| 260902-a9r | Remediate all Phase 6 independent review findings F1-F21 exactly as specified in 06-REVIEW-FINDINGS.md | 2026-09-02 | 6a861f1 | [260902-a9r-remediate-all-phase-6-independent-review](./quick/260902-a9r-remediate-all-phase-6-independent-review/) |
| 260902-ed0 | Remediate all Phase 6 round-2 review findings R1-R9 exactly as decided | 2026-09-02 | ffa5b0f | [260902-ed0-remediate-all-phase-6-round-2-review-fin](./quick/260902-ed0-remediate-all-phase-6-round-2-review-fin/) |
| 260911-k9r | Lengthen the Administration search-as-you-type delay and align its label spacing and select styling with the other list screens | 2026-09-11 | bc131fc | [260911-k9r-administration-search-delay-and-selects](./quick/260911-k9r-administration-search-delay-and-selects/) |
| 260915-hsi | Update Strapi environment example and README documentation for local Ollama qwen3.5:9b and SaaS OpenAI-compatible LLM configuration | 2026-09-15 | 1b45c7f | [260915-hsi-update-strapi-environment-example-and-re](./quick/260915-hsi-update-strapi-environment-example-and-re/) |
| 260917-kel | Log AI questionnaire prompt and response, and harden provider structured-output validation | 2026-09-17 | 3d03ae5 | [260917-kel-log-ai-questionnaire-prompt-and-response](./quick/260917-kel-log-ai-questionnaire-prompt-and-response/) |

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 03 P01 | 4min | 1 tasks | 1 files |
| Phase 03 P02 | 4min | 2 tasks | 4 files |
| Phase 03 P03 | 8min | 2 tasks | 5 files |
| Phase 03 P04 | 10min | 2 tasks | 10 files |
| Phase 03 P05 | 12min | 2 tasks | 6 files |
| Phase 03 P06 | 8min | 2 tasks | 5 files |
| Phase 03 P07 | 6min | 2 tasks | 5 files |
| Phase 03 P08 | 3min | 2 tasks | 6 files |
| Phase 03 P09 | 8min | 2 tasks | 7 files |
| Phase 03 P10 | 6min | 2 tasks | 9 files |
| Phase 03 P11 | 5min | 2 tasks | 4 files |
| Phase 03 P12 | 16min | 2 tasks | 7 files |
| Phase 04 P01 | 8 min | 2 tasks | 3 files |
| Phase 04 P02 | 16min | 3 tasks | 7 files |
| Phase 04 P03 | 9min | 2 tasks | 6 files |
| Phase 04 P04 | 10min | 3 tasks | 7 files |
| Phase 04 P05 | 14min | 1 tasks | 6 files |
| Phase 04 P06 | 19min | 1 tasks | 8 files |
| Phase 04 P07 | 10min | 1 tasks | 6 files |
| Phase 04 P15 | 14min | 1 tasks | 7 files |
| Phase 04 P08 | 14min | 1 tasks | 5 files |
| Phase 04 P16 | 17min | 1 tasks | 8 files |
| Phase 04 P09 | 13min | 3 tasks | 6 files |
| Phase 04 P10 | 11min | 2 tasks | 7 files |
| Phase 04 P13 | 13min | 2 tasks | 6 files |
| Phase 04 P11 | 6min | 2 tasks | 8 files |
| Phase 04 P14 | 5min | 2 tasks | 3 files |
| Phase 04 P12 | 1h 25m | 2 tasks | 14 files |
| Phase 04 P22 | 6 min | 2 tasks | 4 files |
| Phase 04 P21 | 8min | 2 tasks | 9 files |
| Phase 04 P23 | 6 min | 3 tasks | 3 files |
| Phase 05 P01 | 13min | 1 tasks | 2 files |
| Phase 05 P02 | 35 min | 2 tasks | 9 files |
| Phase 05 P03 | 18min | 2 tasks | 7 files |
| Phase 05 P05 | 14min | 2 tasks | 6 files |
| Phase 05 P04 | 14min | 2 tasks | 8 files |
| Phase 05 P06 | 15min | 2 tasks | 3 files |
| Phase 05 P07 | 16min | 2 tasks | 8 files |
| Phase 05 P08 | 14min | 2 tasks | 9 files |
| Phase 05 P09 | 94m | 2 tasks | 16 files |
| Phase 05 P10 | 12min | 2 tasks | 7 files |
| Phase 05 P11 | 8 min | 2 tasks | 7 files |
| Phase 05 P12 | 43 min | 2 tasks | 3 files |
| Phase 06 P01 | 45 min | 2 tasks | 9 files |
| Phase 06 P02 | 44 min | 2 tasks | 16 files |
| Phase 06 P03 | 14 min | 2 tasks | 4 files |
| Phase 06 P04 | 16 min | 2 tasks | 10 files |
| Phase 06 P05 | 1h 18m | 2 tasks | 13 files |
| Phase 06 P06 | 1h 9m | 2 tasks | 19 files |
| Phase 06 P07 | 39min | 2 tasks | 17 files |
| Phase 06 P08 | 13 min | 2 tasks | 8 files |
| Phase 06 P09 | 21 min | 2 tasks | 11 files |
| Phase 06 P10 | 50 min | 2 tasks | 13 files |
| Phase 06 P11 | 1h 25m | 3 tasks | 13 files |
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 06.3 P07 | 24min | 3 tasks | 6 files |
| Phase 06.3 P08 | 18 min | 3 tasks | 4 files |
| Phase 06.3 P11 | 25min | 3 tasks | 13 files |
| Phase 06.5 P01 | 15min | 3 tasks | 7 files |
| Phase 06.5-design-system-conformance P04 | 60m 10s | 2 tasks | 3 files |
| Phase 06.5 P05 | 45 min | 3 tasks | 8 files |
| Phase 06.5 P06 | 35 min | 2 tasks | 5 files |
| Phase 06.8 P02 | 45m | 2 tasks | 5 files |

## Session Continuity

**Last session:** 2026-09-23T12:30:00.000Z
**Stopped At:** Phase 06.9 complete and verified — all three plans executed, full gate green, committed on `dev`
**Resume File:** None

## Next Action

**Phase 06.9 — Assessment Navigation and Lifecycle Visibility is COMPLETE and VERIFIED.** Three plans, three commits, full gate green.

**Resume with `/gsd-discuss-phase 06.10`** (Local LLM Evaluation and Optimisation). Phase 7 — Analyst Dashboard, Reports and Alerts — follows.

### What landed

| Commit | Wave | Delivered |
|--------|------|-----------|
| `39bc203` | 1 | Bounded originating-request summary on assessment detail, crossed through projection, OpenAPI, generated client and closed parser together |
| `9a77469` | 2 | Shared read-only `AssessmentLifecycleStepper` and `AssessmentRequestLink` with two callers each; complete labelled filter vocabularies |
| `cd40d1c` | 3 | Dedicated two-Requestor seed fixture, dual-actor browser journey, direct-URL denial proof, Phase 06.9 axe coverage |
| `1fa032a` | — | Restored the Next config files the Playwright harness rewrites |

### Final gate

- **Playwright: 35 passed / 0 failed** (13.8 minutes, exit 0), ports 1337 and 3000 confirmed free
- **Strapi: 211 passed / 0 failed**
- **Web: 50 test files, 434 tests passed**
- Web typecheck clean; `pnpm --prefix apps/web api:check` clean against the committed tree
- Both actors verified in the browser at 375px and 1440px with no console errors and no horizontal overflow

### Decisions locked this phase (D-1..D-6 in 06.9-CONTEXT.md)

- The originating request is **served, not inferred**: `/v1/risk_assessments/{id}` projects a closed `{documentId, requestNumber, title, requestStatus}` after the authorization decision. No content-type schema change — the `assessmentRequest` relation already existed.
- `requestStatus` is declared as the seven-value request-status enum rather than an open string, so `requestStatusPresentation` lookups are total. An open string would have rendered a confident label from `undefined` — the same failure class as the Phase 06.8 questionnaire `state` field.
- Link destination comes from the served `actor` discriminant, never the route: analysts to `/app/review/requests/{id}`, Requestors to `/app/requests/{id}`. `releasedAssessmentDetailForActorSchema` had been stripping `actor` in its transform and now preserves it.
- The stepper is read-only and carries no action control; it explains state and is not a second workflow-control surface.
- Queue and status filters are orthogonal — a queue choice changes which records return, not which statuses the filter offers.

### Notes carried forward

- **Strapi answers an unauthorised assessment read with 404, not 403.** That is deliberate and stronger: a permission notice would confirm to an unrelated Requestor that the record exists. The route renders not-found, and both the integration test and the browser journey assert it. Any future spec expecting a permission state on that path is asserting the wrong thing.
- **Development sign-in now has a third fixture identity, `Secondary Requestor` (`maya.requestor@idambox.com`).** It exists solely to prove record-level denial with a second authenticated Requestor; it carries a capability grant identical to `Requestor`, lives only in the development session adapter, and its seed is gated on `IDAMBOX_SEED_CSRM` plus the development identity flags. Keycloak remains untouched.
- **A Playwright run rewrites `apps/web/next-env.d.ts` and `apps/web/tsconfig.json`** to point at its throwaway Next build directory, as `playwright.config.ts` documents. Restore both after every run or the pollution travels into a commit — it did here and needed a follow-up commit. `tsconfig.json` still carries stale `.tmp/` include paths from earlier sessions and grows with each run; worth a cleanup.
- **A URL assertion is not a sign-in assertion.** `toHaveURL(//app$/)` also matches `/sign-in?returnTo=/app`, so a click that never left the sign-in page passed and the failure surfaced fifty lines later as a misleading "element not found". E2E sign-in helpers must assert the shell — the Dashboard heading and the role in the banner. Two specs' helpers had this defect; the Phase 06.9 one is fixed, and `accessibility.spec.ts` already asserted the banner correctly.
- **Read console state in a fresh browser tab.** An accumulated tab buffer surfaced a stale `ReferenceError` captured during HMR recompiles and cost a full bisect (stash wave 2, revert wave 1 files) to disprove. A clean tab showed zero errors at every stage.
- **Prefer screenshots over `get_page_text` on this app.** The reader repeatedly picked up an off-screen leftover "Loading workspace…" node from a prior route and made two healthy pages look hung.
- **`accessibility.spec.ts:47` (Phase 06.8 governed questionnaire) failed once in a two-spec partial run** with 76 violations led by a missing `<title>` — the signature of a scan starting mid-navigation. It passed in both full-suite runs. The helper's `page.title()` poll does not fully close that window; a follow-up could wait on a settled navigation instead.
- **Windows flake:** `request-workflow.test.tsx:48` intermittently fails with `EPERM: rename` inside vitest's temp cache when the suite runs alongside other disk-heavy work. It is the `import(/* @vite-ignore */ …)` dynamic import; it passes in isolation and in quiet full runs.

### Follow-ups recorded, outside this phase's criteria

- The wave-1 Strapi fixture builder wraps the memoized `seedAssessmentWorkflowFixtures` and snapshots copies rather than building fully independent records. The IDOR proof itself is sound, and wave 3's browser fixture is genuinely dedicated.
- `projectAssessmentRequestSummary` raises a 400 for an absent or malformed relation, matching the convention of the Risk relation check beside it, though a server-side data-integrity fault is arguably a 500.
- Carried forward from Phase 06.8 and still open: the analyst revision timeline names an actor only as "An analyst"; the analyst questionnaire review shows every question twice; the review queue classifies buckets in the application under a scan bound; the Requestor dashboard issues seven extra list reads for lifecycle counts.

---
Last activity: 2026-09-23 — Phase 06.9 complete: assessment navigation and lifecycle visibility

*Last updated: 2026-09-23 after completing Phase 06.9*


## Accumulated Context

### Roadmap Evolution

- Phase 06.1 inserted after Phase 6: Requestor and Analyst revert-to-draft for Requests and Questionnaires (URGENT)
- Phase 06.2 inserted after Phase 6: AI-generated contextualised questionnaire (URGENT)
- Phase 06.3 inserted after Phase 6: Real AI provider integration for questionnaire and assessment generation (URGENT)
- Phase 06.1 completed: Revert-to-draft delivered and verified for both actors
- Phase 06.2 completed: Generated contextualised questionnaire delivered and verified
- Phase 06.3 inserted after Phase 06.2: correctness, search, and selection from post-06.2 review
- Phase 06.4 inserted after Phase 06.2: cross-record navigation and interface consistency
- Phase 06.5 inserted after Phase 06.2: real AI provider integration now follows the experience phases
- Phase 06.6 completed: cross-surface UI consistency delivered and verified (6/6 criteria, comparative harness with sensitivity proof)
- Phase 06.7 completed: real AI provider integration behind both generation interfaces, verified against a local model (182/182 backend tests; live questionnaire generation succeeded, live assessment drafting limited by CPU-only hardware)
- Phase 06.9 edited: renumbered and reordered with Phase 06.10
- Phase 06.9 completed: assessment lifecycle visibility and originating-request navigation delivered for both actors (35/35 Playwright, 211/211 Strapi, 434/434 web)
