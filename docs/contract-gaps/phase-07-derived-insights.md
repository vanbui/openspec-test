# Phase 7: Derived Analyst Insights

## Status

Phase 7 (DASH-01, DASH-02) gives the Security Analyst a dashboard, Alerts and four Reports. Every
figure, alert, report row and activity item is computed on read by Strapi from records that already
exist (D-01). No content-type schema changed. No Alert, Report, Activity, Notification or Audit
entity was added, because the frozen JDL has none.

This record lists:

- the facts the phase could not derive from the frozen datamodel;
- the divergences it accepted;
- the reserved operations it left unserved;
- the pre-existing findings its plans recorded.

Each item states the gap, the decision and its consequences. Items that need a datamodel decision
say so, and items that belong to production hardening are marked **Phase 8**.

| # | Item | Kind | Owner |
| --- | --- | --- | --- |
| 1 | Post-release treatment tracking | Missing fact | Later datamodel decision |
| 2 | Activity events the datamodel does not record | Missing fact | Later datamodel decision |
| 3 | Persisted alerts and per-analyst acknowledgement | Deferral (D-06) | Later datamodel decision |
| 4 | Report export | Deferral (D-06) | Later milestone |
| 5 | Catalogued operations left unserved, and the reserved summary served | Contract record (D-06, D-28) | Catalogue design note |
| 6 | The stored "Overdue" treatment status | Accepted divergence (D-04) | Later datamodel decision |
| 7 | "Generation in progress" in more than one Strapi process | Accepted limit (D-21) | Phase 8 |
| 8 | The "questionnaire submitted" database predicate | Accepted divergence (D-30) | Accepted |
| 9 | PostgreSQL execution | Unverified (research A2) | Phase 8 |
| 10 | Dashboard footers without an equal total (widgets 3 and 4) | Accepted exception | Later filter work |
| 11 | Input reliability | Accepted limit | Later input validation |
| 12 | Findings recorded during the phase | Follow-ups | Phase 8 |

## 1. Post-release treatment tracking (D-27, DR-2)

**Gap.** Releasing a Risk Assessment makes its Risks and Control Implementations immutable. Every
Risk and Control Implementation mutation runs through the mutable-assessment guard, and
`nextReviewDate` freezes with the release. The datamodel has no post-release treatment tracking:
nothing records treatment progress after release. Once one of these alerts is raised on released
work, nothing in the application can clear it:

- `risk-treatment-overdue`;
- `risk-treatment-due-soon`, which becomes overdue once its target date passes;
- `critical-residual-risk-untreated`;
- `control-implementation-overdue`;
- `ineffective-control`;
- `assessment-review-due`. Only a released assessment can raise it, so once its frozen review date
  passes it stays overdue.

**Decision.** Release immutability is unchanged. An alert on released work states a true fact, for
example "Treatment overdue by 12 days". Its source is marked released (`source.released` in the
served alert) and reads "Released · read-only" on every screen. The Phase 7 fixture proves this with
`RSK-E2E-P7-RELEASED-001` and `ASM-E2E-P7-RELEASED-001`.

**Consequences.**

- The dashboard, Alerts and the treatment report keep counting released work until a later datamodel
  decision gives treatment a lifecycle after release.
- The options for that decision include:
  - a post-release treatment record;
  - a sanctioned post-release edit of treatment facts;
  - a re-assessment that supersedes the released assessment.
- None of these is made here.

## 2. Activity events the datamodel does not record

**Gap.** Several workflow events have no dated column with an actor relation:

- **Questionnaire submission.** Its time exists only inside each answer's JSON envelope. No column
  records when a questionnaire was submitted.
- **`governanceLog` events.** Release, return to analyst review, question added, edited or deleted,
  and answer cleared are JSON entries that carry the actor's documentId only. That is why the
  questionnaire revision timeline names the actor as "An analyst".
- **Comments and audit.** There is no comment or audit entity. COLLAB-01 is a v2 requirement.
- **Reversals.** Reversal facts keep only the latest reversal (Phase 06.1). A return to draft also
  clears the request's `submittedDate`, so earlier submissions and reversals leave no trace.
- **Edits.** Edits to Risks, Control Implementations and Risk Assessment metadata record no dated fact
  naming the IdamBox user who made them.

**Decision.** Recent activity reads the seven column-backed events only. Each is one bounded read of
a dated column, with the actor taken from the event's own relation:

| Event | Date | Actor |
| --- | --- | --- |
| Request submitted | `submittedDate` | `requestor` |
| Request returned to draft | `revertedAt` | `revertedBy` |
| Questionnaire generated | `generatedDate` | none |
| Questionnaire released | `releasedAt` | `releasedBy` |
| Questionnaire returned to draft | `revertedAt` | `revertedBy` |
| Risk Assessment draft generated | `generatedDate` | none |
| Risk Assessment released | `approvalDate`, with the complete release triple | `approvedBy` |

- Request events come only from requests in the analyst review scope.
- A generated draft names no one. AI output is advisory, and only a release names the Security
  Analyst who made it.

**Consequences.** The feed shows recent events, not an audit trail. It cannot show questionnaire
submissions, governance events, edits or comments until a later datamodel decision adds an audit
entity or dated event columns. Naming the actor of a governance event needs one batched user read.
07-RESEARCH Q5 records that as a follow-up.

## 3. Persisted alerts and per-analyst acknowledgement (D-06)

**Gap.** Alerts are derived on read, with a deterministic id `<kind>:<sourceDocumentId>`. They clear
only when the underlying record changes. Acknowledging, snoozing or assigning an alert needs
persisted per-analyst state, which needs a new entity.

**Decision.** Deferred beyond this milestone. `GET /api/v1/alerts/{alertId}` and
`PATCH /api/v1/alerts/{alertId}/acknowledge` stay catalogued and unserved (item 5).

**Consequences.**

- Every Security Analyst sees the same alerts.
- An alert cannot be dismissed. It lasts until its condition clears, or indefinitely on released work
  (item 1).
- The alert id is stable, so a later acknowledgement entity could reference it.

## 4. Report export (D-06)

**Gap.** The catalogue reserves `POST /api/v1/reports/{reportKey}/export`, and the Phase 7 context
leaves report export out of scope.

**Decision.** Deferred beyond this milestone, and the operation stays unserved (item 5).

**Consequences.** Reports are read on screen. A report printed from the browser stays legible,
because no content is hover-only. Print is not a deliverable, and the app shell prints with it.

## 5. Catalogued operations left unserved (D-06), and the reserved summary served (D-28)

**Gap.** The catalogue reserved more Phase 7 operations than the phase needs.

**Decision.** Phase 7 serves five analyst operations, each through its own API-only Function granted
to `role.security_analyst` alone:

- `GET /api/v1/dashboard/summary`;
- `GET /api/v1/alerts`;
- `GET /api/v1/alerts/summary`;
- `GET /api/v1/reports`;
- `GET /api/v1/reports/{reportKey}`.

These five stay catalogued and unserved:

| Operation | Menu Function | Why it is unserved |
| --- | --- | --- |
| `GET /api/v1/dashboard/reports` | Dashboard | The dedicated report operations serve it. |
| `GET /api/v1/dashboard/alerts` | Dashboard | The dedicated alert operations serve it. |
| `GET /api/v1/alerts/{alertId}` | Alerts | A derived alert links straight to its source record, so a detail read adds nothing. |
| `PATCH /api/v1/alerts/{alertId}/acknowledge` | Alerts | Acknowledgement needs persisted per-analyst state, a datamodel change (item 3). |
| `POST /api/v1/reports/{reportKey}/export` | Reports | Report export is deferred beyond this milestone (item 4). |

`GET /api/v1/my_requests/status_summary` is served as the catalogue reserved it
(`function.risk_assessment_requests.my_requests.api.02`), under the Requestor's My Requests
Function, rather than at a new `my_assessment_requests` path (D-28). The path in UI-SPEC §7.6 is
superseded.

**Consequences.**

- The Dashboard, Reports and Alerts menu Functions carry only unserved operations.
- The catalogue design note gives the same reasons.
- The analyst insight route inventory test refuses any router that mounts one of these paths.

## 6. The stored "Overdue" treatment status (D-04, D-26)

**Gap.** The `treatmentStatus` enumeration includes "Overdue". Nothing on the server sets it, and a
stored value cannot follow the passing of time.

**Decision.** One rule derives the due state on read:

- **Overdue:** the target date is before today, the treatment is not Complete (NULL counts as not
  Complete), and the Risk is not closed.
- **Due soon:** the same conditions, with the target date inside the named window.

Each Risk Register row carries the rule's result as `treatmentDueState`. The alerts, the dashboard
and the treatment report use the same rule.

The stored value appears verbatim only where a recorded treatment status is shown as recorded:

- the Risk Register's Treatment status column and filter;
- the Risk detail;
- the two report breakdowns by treatment status. These are the treatment performance "Treatment
  status" section and the risk exposure cross-tab, whose description says so.

**Consequences.**

- A Risk can show a stored "Overdue" status while its derived due state is later, or complete or
  closed, and the reverse.
- No figure, alert, tile or overdue marker reads the stored value.
- A later datamodel decision could retire "Overdue" from the enumeration or have the server maintain
  it.

## 7. "Generation in progress" in more than one Strapi process (D-21) - Phase 8

**Gap.** The questionnaire generation job registry lives in the memory of one Strapi process.

**Decision.** The review queue buckets are database predicates. The registry enters them as a bound
set of active request ids:

- `IN` for "Generation in progress";
- `NOT IN` for "Requires my attention".

The set is capped at 1,000 ids and fails closed beyond that.

**Consequences.**

- The bucket, its page, its total and the dashboard's count are exact for a single Strapi process.
- With several processes, each would see only its own jobs.
- A restart forgets jobs in flight, as it already did.
- Phase 8 needs a shared job store, or persisted job facts, before Strapi runs as more than one
  process.

## 8. The "questionnaire submitted" database predicate (D-30, DR-5)

**Gap.** The application decides that a questionnaire is submitted by parsing its definition and
answer envelopes. A database predicate cannot run those parsers.

**Decision.**

- The bucket SQL treats a questionnaire as submitted when any of its answers has `state` equal to
  `submitted`. It reads the JSON path with `whereJsonPath` and never compares JSON text.
- The equivalence test in `apps/backend/tests/review-queue-buckets.integration.test.ts` proves the
  predicate agrees with the in-application rule. It covers one fixture per lifecycle step, plus two
  isolating fixtures.
- These divergences are accepted:
  - **Malformed questionnaire definition.** The application treats the questionnaire as not
    started. The SQL treats it as submitted if any answer is submitted.
  - **`submittedAt`.** The SQL does not read it, while the application requires it. Every submit
    stamps both, so a submitted state without its time is already malformed data.
  - **Submitted and draft answers mixed.** The SQL says submitted and the application says draft.
    This is unreachable, because submission is all or nothing.

**Consequences.** Only malformed stored data can put a request in a different queue from the one the
in-application rule would choose. The parsers still fail closed when that questionnaire is read.

## 9. PostgreSQL execution (07-RESEARCH A2) - Phase 8

**Gap.** Every suite runs on SQLite, and the `pg` driver is not installed. No Phase 7 query has run
on PostgreSQL.

**Decision.** The SQL is written to be portable:

- knex's dialect-aware helpers;
- bound values and bound identifiers;
- constant fragments only;
- every count and sum read through `Number()`;
- every date normalised through `normalizeDateTime`.

**Consequences.** Portability is unverified. Phase 8 must run the Strapi suites on PostgreSQL and
check these constructs in particular:

- **Review queues (07-03):**
  - `CASE WHEN column IS NULL THEN 0 ELSE 1 END` NULL-order terms, which SQLite's native NULL order
    hides;
  - `whereJsonPath` over the answer JSON;
  - `LOWER(column) LIKE LOWER(?) ESCAPE '!'`, where PostgreSQL's `LOWER` follows the locale and
    SQLite's folds ASCII only;
  - bound id sets of up to 1,000 ids in `IN` and `NOT IN`;
  - `countDistinct`.
- **Alerts (07-04):**
  - a `UNION ALL` of eight branches. Their columns line up through typed literals
    (`CAST(? AS TEXT)`, `CAST(? AS INTEGER)`) and typed NULLs (`CAST(NULL AS TEXT)`).
    PostgreSQL checks column types across branches, and SQLite does not;
  - correlated `CASE WHEN EXISTS (...)` released flags;
  - date columns compared with bound `YYYY-MM-DD` strings;
  - the list order's source identifier, kind and documentId tie rules. These assume code-unit
    comparison, which is SQLite's `BINARY` collation. PostgreSQL uses the database collation, so ties
    could be served in a different order from the `compareAlerts` oracle.
- **Reports (07-06):**
  - `ORDER BY` on output aliases (`critical`, `total`);
  - `SUM(CASE WHEN ... THEN 1 ELSE 0 END)`;
  - `COUNT(DISTINCT CASE WHEN r.residual_rating = ? THEN r.id END)`;
  - `NOT EXISTS` over the Information System link;
  - JavaScript `Date` values bound against the `approval_date` datetime column. On SQLite an ISO
    string bound there returned no rows.
- **The Requestor status summary and the Risk Register (07-02):** an owner-scoped `countDistinct`
  group-by, and the constant `closure_date IS NULL` and `IS NOT NULL` fragments.
- **The dashboard summary (07-08)** reuses all of the above.

## 10. Dashboard footers without an equal total (widgets 3 and 4)

**Gap.** Every figure should link to a list whose total equals it (D-18, D-24, UI-D1). Two dashboard
footers cannot:

- **Widget 3, "High and Critical residual Risks".** Its "Open Risk Register" link opens
  `/app/risks?state=open&sort=residualRating:desc`, which lists every open Risk, High and Critical
  first. The Risk Register filters one residual rating at a time and has no multi-rating filter. That
  list's total is therefore every open Risk, not the widget's High and Critical total.
- **Widget 4, "Treatments due".** Its total covers two alert kinds, overdue and due-soon treatments.
  Each footer link opens a list of one kind:
  - "View overdue treatments" opens `/app/alerts?kind=risk-treatment-overdue`;
  - "View treatments due soon" opens `/app/alerts?kind=risk-treatment-due-soon`.

  Each list's total equals its own part of the summary, and the two parts add up to the widget's
  total, but no single list equals it. The alert operation accepts a repeated `kind`. The Alerts
  screen's URL and filter take one kind at a time.

**Decision.** Both are recorded exceptions to the equal-total rule. The rest of the dashboard follows
the rule:

- the per-rating exposure rows in widget 2 open single-rating lists with equal totals;
- the four tiles open lists with equal totals.

The browser proof checks widget 3 by membership only: every listed Risk is in the open register it
links to.

**Consequences.** A multi-rating Risk Register filter would close the widget 3 exception. An Alerts
screen that takes more than one kind would close the widget 4 exception. Both belong to later filter
work.

## 11. Input reliability

**Gap.** Some inputs are optional, frozen or free text.

**Decision.** The figures take them as recorded and never repair them:

- **Request due dates.** A request's `dueDate` is optional and entered by the Requestor. Request
  alerts cover only requests with a due date, and they trust the date given.
- **Review dates.** `nextReviewDate` freezes at release (item 1), so a review-due alert cannot be
  cleared by rescheduling.
- **Risk ratings.** `inherentRating` and `residualRating` are free strings. Any value outside Low,
  Moderate, High and Critical, including a different letter case, counts as "Not rated" in every
  figure. The Risk Register has no "not rated" filter, so the dashboard shows "Not rated" as plain
  text with no link.
- **Treatment status.** `treatmentStatus` may be NULL. It counts as not Complete for the due state
  (D-04) and as untreated for `critical-residual-risk-untreated` (D-31).
- **Dates.** "Today" is the UTC calendar date. Between midnight and 10:00 Australian Eastern
  Standard Time (11:00 in daylight saving time), the UTC date is still the previous day. A date
  therefore passes at that hour, not at local midnight.

**Consequences.** A figure is only as reliable as the record behind it. Validating Requestor due
dates, rating vocabularies and treatment status is a datamodel and input-validation decision outside
Phase 7.

## 12. Findings recorded during Phase 7 - Phase 8

The Phase 7 plans found or deferred these. All but the last predate the phase, and none affects a
Phase 7 figure.

- **`apps/backend/tests/authorization.policy.test.js` never runs.**
  - The Strapi test script passes `dist/tests/authorization.policy.test.js` to `node --test`.
  - `tsc` does not compile JavaScript test sources, so the path matches nothing and Node skips it
    silently.
  - The file also asserts five assessment-request operation keys, where `operations.ts` now has six.
  - The Phase 7 policy proofs live in `analyst-insight-authorization.unit.test.ts`, which runs every
    time.
- **Error bodies carry an undeclared `data: null`.**
  - Strapi's `ctx.badRequest` and `ctx.forbidden` serve `{ "data": null, "error": { ... } }`. The
    published error components are closed with `error` alone.
  - The Phase 7 400, 403 and 404 bodies use the same envelope.
  - The web keys on the status and never parses an error body closed, so nothing reaches a user.
  - A contract pass should declare `data: null` or strip it.
- **The parity guard does not exercise the Risk Register parser.**
  - `apps/csrm/src/features/contract-response-parity.test.ts` synthesises integers as their minimum or
    1 and ignores integer enumerations. `RiskRegisterPagination.pageSize`, which is 10, 25 or 50, is
    therefore always 1.
  - The register parser rejects every synthesised payload at `meta.pagination.pageSize`, and the
    entry's `narrowedPaths: ['data']` excuses the rejection.
  - The fix is to use the first enumeration value for an integer enumeration, then drop the
    narrowing.
  - Meanwhile, mounted spec pinning and a direct pin in `risk-schema.test.ts` cover the register.
- **`scripts/verify-phase-06-integrity.mjs` pinned stale catalogue counts.** It expected 30 Functions
  and 110 FunctionAPIs when the catalogue had 45 and 121, and no suite ran it. The gate was retired on
  2026-10-18. The catalogue's identity is now guarded by `served-operations.integration.test.ts`
  ("the two catalogue copies are byte-identical") and its integrity by `pnpm verify:csrm-seed`.
- **Duplicate API-only Function rows remain in development databases seeded before 07-01.** 07-01
  fixed the reconciler, so no new duplicates appear. The old rows are detached and unreachable, and a
  clean-up is optional.
- **`next build` has not been run for the Phase 7 routes.** Every browser suite runs against
  `next dev`. Production-build verification is Phase 8.

## Phase 19 amendment (2026-10-16): the report export served

Item 4's report export, and its row in item 5's table of catalogued operations left unserved, are served by Phase 19, plan 19-09, at the catalogued URL `POST /api/v1/reports/{reportKey}/export`, per `docs/contract-gaps/phase-19-exports-and-export-log.md`, effective on that record's approval. Its FunctionApi moves from `function.reports.reports.api.03` to `function.reports.export_api.api.01`, a human-only API Function granted to `role.security_analyst` alone, with its name, URL and description unchanged. The report's own figures and windows are unchanged; XLSX holds one sheet per report table and CSV one chosen table, with the export record's grants, underlying read (`GET /api/v1/reports/{reportKey}`), row cap, neutraliser and event log. The released assessment's print-ready report (X-31) is a separate page with no operation. Every other item of this record, including the four operations item 5 still leaves unserved, is unchanged.

### Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams", "The shared backend"); on 2026-10-16 its table lists `csrm` and `iam`. The changes, each backward compatible for any later reader:

- **The move** of `function.reports.reports.api.03` to `function.reports.export_api.api.01`, name, URL and description unchanged: the operation was unserved until now, so a reader keyed on the old id re-reads the catalogue and no served grant is lost.
- **The refusals on it:** it is a member of `HUMAN_ANALYST_ONLY_OPERATIONS` (a caller without the human Security Analyst grant is refused with `CSRM analyst exports require a human Security Analyst.`) and of `SERVICE_IDENTITY_REFUSED_OPERATIONS` (the Security Analyst Agent is refused with `CSRM exports are refused to automation identities.`); both apply to this new operation only.
- **`function.reports.reports` keeps its menu path and grants;** it loses only the moved FunctionApi.

`csrm` is the only workstream whose application calls the report export. `iam` reads the catalogue but none of these names: on 2026-10-16, `grep -rlE "CONFLICT_REASONS|HUMAN_ANALYST_ONLY|SERVICE_IDENTITY_REFUSED|/v1/[a-z_]+/export|export_api|csv-import|import/preview|import/template|error_report|function\.risk_register|function\.reports|function\.administration|AssessmentWorkflowErrorResponse|write-excel-file|xlsx-reader|security-event-log" .planning/workstreams/iam/` printed nothing.

Phase 19 amendment status: **approved by the pilot on 2026-10-16** (G-6).

What the pilot checked (2026-10-16): the reserved report export served at its catalogued URL; `function.reports.reports.api.03` moved to `function.reports.export_api.api.01` with name, URL and description unchanged; the reports menu Function keeps its menu path and grants (the Security Analyst Agent still reads reports but cannot export them); no lines removed from the Phase 07 record; AGENTS.md (Strapi enforces every rule against the resolved IdamBox User; navigation visibility is not authorisation; Requestors never reach another Requestor's records; AI is not involved; JDL terminology); the role-function catalogue (new API-only Functions, human-only analyst exports, the Requestor-birthright own-record Function, no grant to the Security Analyst Agent or any service role, both copies byte-identical); `specification.json` changes additive only; no content-type change; and `.planning/PROJECT.md` "The shared backend": the Affected Workstreams section re-ran both greps, `iam` reads none of Phase 19's names, and every change keeps existing endpoints, grants and decisions backward compatible.
