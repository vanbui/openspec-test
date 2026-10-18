# Phase 11: Navigation, landing and list clarity - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`. Every gray area was resolved with the recommended option, grounded in:
- the product gap UAT (`.planning/uat/product-gaps/`: `FINDINGS.md`, `REPORT.md` §4 and §5, `JOURNEYS.md`, the two area-1 evidence images);
- the delegated decisions in `.planning/NEXT-WAVE-DECISIONS.md` (#11, #16, G-1, G-4, G-5, G-6);
- the orchestrator's seeds for this phase;
- Phase 10's planned outputs (`10-CONTEXT.md` and its 22 plans);
- a read of the code each finding names.

There is no SPEC.md for this phase. The discussion log is `11-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

Give each actor a sidebar divided into sections named by job, whose labels match the pages they open, and one Home that leads with that actor's next actions on a phone as on a desktop. Give the review lists the columns needed to triage, make every dashboard and report figure open the records behind it, make exposure figures say what they count, show "Released" for a released request, and add quick find (Ctrl+K or ⌘K).

The phase closes nine findings (UAT-001, UAT-002, UAT-003, UAT-004, UAT-035, UAT-038, UAT-048, UAT-060, UAT-065) and delivers UX-07, UX-08, UX-09, UX-10 and DASH-03.

In scope:
- the navigation model and the application shell;
- Home for both actors, and the `/app/review` route;
- the phone lifecycle stepper and the next-action wording;
- the columns, searches and filters of the review lists, My requests and the Risk Register that the figures need;
- the released and under-assessment dimension of exposure;
- quick find;
- the copy and local-time items Phase 10 deferred to this phase;
- the tests that prove each of these.

Out of scope:
- any Strapi content-type schema change;
- assignment, "Assigned to me" and the assignee column (Phase 13);
- notes (Phase 13) and the notification centre (Phase 17);
- a column chooser and saved views (Phase 18);
- export (Phase 19);
- My risks and treatments, and the BAU and Project views (Phase 20);
- trends, heat maps, cycle times and team job health (Phase 21);
- the Admin role and its sidebar (Phase 22);
- Keycloak;
- live AI generation.
</domain>

<decisions>
## Implementation Decisions

### Scope and contract boundary

- **D-01:** No Strapi content-type schema change (`apps/backend/src/api/*/content-types/*` stays frozen). Every change reads fields and relations that already exist:
  - the request's `requestor`, `assessmentType`, `businessCriticality`, `dueDate` and `submittedDate`;
  - the Risk Assessment's status and release facts;
  - the Risk's `treatmentAction`, `residualRating`, `inherentRating`, `treatmentStatus`, `targetDate` and `closureDate`;
  - the questionnaire's `releasedAt` and answer state.

  No contract-gap record is needed.
- **D-02:** The API changes are these six groups, and no others. Each follows the full endpoint chain: the specification, `api:generate` and a clean `api:check`, closed parsers registered in the contract parity guard, a six-actor matrix row for a new route, `served-operations.json` regenerated with the dev servers stopped, and both catalogue copies byte-identical. The server shape and its client parser change in the same plan.
  1. **Review queue** (`GET /v1/assessment_requests`):
     - each item gains the requestor's display name, the assessment type, the business criticality, the due date and the days since submission;
     - `filters[q]` matches the request number or the title;
     - a `queue=all` bucket reads every request in the analyst's review scope: reviewable and released statuses, never a draft.
  2. **Risk Assessment lists** (`GET /v1/risk_assessments` and `GET /v1/my_risk_assessments`):
     - each item gains the request title, the Risk count and the highest residual rating;
     - `q` also matches the request title;
     - new filters `overallRating`, `approvedFrom` and `approvedTo`.
  3. **Risk Register** (`GET /v1/risks`):
     - new filters `stage` (released or under assessment), `treatmentAction` (Accept or Treat), `dueState` (the D-04 treatment due states), `mitigationEffectiveness`, and `any` for mitigation status;
     - a "none" value for residual rating, inherent rating, treatment status and impacted system;
     - each row gains its stage and its treatment action.
  4. **Exposure:**
     - the dashboard summary's exposure and its High and Critical list count released Risks by default, and carry the under-assessment and accepted figures separately;
     - the risk-exposure report does the same;
     - the treatment-performance report's due window becomes the product's due-soon window (D-38).
  5. **Request lifecycle:**
     - `nextAction` gains `holder` (requestor, analyst or none) beside the existing `actor`, which is the viewer;
     - the server's next-action copy names who holds the work, instead of "the other party".
  6. **My requests:**
     - `GET /v1/my_requests` is served. It lists the caller's own requests, each with its holder, stage and next action, and filters them by holder, status and search, with sorting and pagination;
     - `GET /v1/my_requests/status_summary` gains holder counts.

  **Reversibility:** costly. These are published contract fields, filters and one newly served operation.
- **D-03:** Serving `GET /api/v1/my_requests` promotes an existing catalogue entry: FunctionApi `function.risk_assessment_requests.my_requests.api.01`, under the My Requests Function, already granted to the Requestor birthright.
  - **Grants:** none are added.
  - **Owner scope:** the route uses the policy's `requireRequestCollectionScope`, as the status summary does, so every actor, an analyst included, lists only their own requests, and an analyst's own list reads from the Requestor's side.
  - **Files that change:**
    - design note 9 in both catalogue copies, kept byte-identical;
    - `served-operations.json`, which moves the operation from `unserved` to `served`;
    - the specification, with the new path;
    - the matrix, with a new row.

  **Reversibility:** costly. A served operation and a catalogue note.
- **D-04:** Phase 10 executes and passes its gate before any Phase 11 plan starts. Where both phases change a file, Phase 11 builds on Phase 10's result. The files concerned:
  - the shell: `app-shell.tsx`, `app/(app)/layout.tsx`, `capability-navigation.tsx` and `navigation-guard.tsx`;
  - the request pages: `request-hub.tsx`, `request-domain.ts`, `assessment-detail.tsx` and the Requestor request page;
  - the assessment schema and service, and `released-assessment.tsx`;
  - `states.tsx` and `risk-details.tsx`;
  - the interface copy guard, the parity guard and the specification with its generated client;
  - `assessment-scope.ts`, the assessment controller and the E2E specs.

  Phase 11 reuses Phase 10's artifacts:
  - `formatInstant` and `LocalInstant`, and the viewer time-zone cookie;
  - the navigation guard, through `GuardedLink` and the guarded `onNavigate`;
  - the interface copy guard;
  - the design extensions X-1 to X-5.
- **D-05:** Plans are serialised by shared files, as Phase 10's D-40 does: one owner per file per wave. The shared files are:
  - the specification and the generated client;
  - both catalogue copies, `served-operations.json`, the authorization matrix and the parity guard;
  - the interface copy guard;
  - the navigation configuration, the shell and the E2E sign-in helper;
  - the hot E2E specs: `accessibility`, `analyst-insights`, `performance`, `production-hardening`, `design-contract` and `design-system-conformance`.

  Each plan that changes the specification runs in a wave of its own.

### Sidebar and navigation model (UX-07, UAT-002)

- **D-06:** Navigation becomes data. `src/config/navigation/navigation.ts` defines one navigation profile per actor. Each profile is an ordered list of sections, and each section has:
  - an optional label, named by job;
  - whether it collapses, and whether it starts collapsed;
  - its items. Each item keeps its `href`, `label`, `capability` and `icon`, and gains an optional count key.

  How it renders:
  - The profile is chosen from the viewer's capabilities: the analyst profile when they hold `assessment:review`, otherwise the Requestor profile.
  - A section renders only when it holds a visible item.
  - The longest-match current-item rule (`activeNavigationHref`) stays.

  This follows the brief's "generated from role/capability configuration" (§9). Navigation visibility is still not authorisation: Strapi and the route gates stay authoritative.
- **D-07:** The Requestor sidebar follows `REPORT.md` §5:
  - a **New request** button, the primary action rather than a nav item, gated by `assessment-request:create`;
  - **Home**;
  - a **My work** section: My requests, My questionnaires and My risk assessments.

  My questionnaires, not "Questionnaires to answer", because the list also holds submitted questionnaires. Its count says how many wait to be answered (D-10). "My risks and treatments" is not shown until Phase 20 adds it to My work.
- **D-08:** The Security Analyst sidebar follows `REPORT.md` §5:
  - **Home**;
  - **Assessment work:** Requests, Questionnaires and Risk assessments;
  - **Oversight:** Risk register, Alerts and Reports;
  - **Reference data:** Risk Types, Controls, Information Systems and Information Assets;
  - **My own requests**, collapsed by default: My requests and New request.

  "Workspace" and "Analyst dashboard" go. The own-requests section opens itself when the current page belongs to it (a personal request, or the new request form), so the current item is never hidden. Its open state is not persisted.
- **D-09:** Every nav label equals the heading of the page it opens. Labels are in sentence case, with the capitals the direction and Phase 10's voice rule give the domain record terms (Risk, Risk Type, Assessment Request, Security Analyst, Requestor). The route titles follow their headings.

  The headings that change:
  - Dashboard and Analyst dashboard become **Home**;
  - My Requests, My Questionnaires and My Risk Assessments become **My requests**, **My questionnaires** and **My risk assessments**;
  - the three analyst review headings become **Requests** (from Assessment request review), **Questionnaires** (from Questionnaire Review) and **Risk assessments** (from Risk assessment review);
  - Risk Register becomes **Risk register**;
  - New assessment request becomes **New request**. It is a nav item in the analyst's own section, and "New Request" is already its route title.

  The Reference data, Alerts and Reports headings already match their labels. The UI-SPEC fixes each string. The E2E and unit assertions on old headings, labels and titles change in the plan that renames them.
- **D-10:** Counts appear only on items that hold work:
  - **Requestor:** My requests (requests whose next action is yours) and My questionnaires (questionnaires to answer);
  - **Security Analyst:** Requests (the Requires my attention bucket) and Alerts (overdue alerts);
  - **the analyst's own section:** My requests carries the same needs-your-action count. While the section is collapsed, its disclosure shows the count, so personal work is never hidden.

  A zero shows no badge. The count and its meaning ("9 need attention") are part of the link's accessible name, and a count is never shown by colour alone.
- **D-11:** Count reads are server-scoped and bounded, and use existing operations only, called through the existing feature service functions, so no new module calls the client:
  - **Requestor:** `GET /v1/my_requests/status_summary` (its needs-your-action holder count, D-02 item 6) and `GET /v1/my_questionnaires/status_summary` (not started plus draft);
  - **Security Analyst:** the queue total from `GET /v1/assessment_requests?filters[queue]=requires-attention&pagination[pageSize]=1`, and `byUrgency.overdue` from `GET /v1/alerts/summary`, plus the status summary for their own section (its needs-your-action holder count; the own section has no My questionnaires item).

  How the counts render:
  - The layout starts the reads without awaiting them and passes one promise to the navigation, which renders the badges inside a Suspense boundary, so no page waits for a count.
  - A failed or refused read shows no badge: never a zero, never an error in the sidebar.
  - Counts refresh with every server render of the layout: a full load, a router refresh, or a Server Action that revalidates. There is no polling (direction do-not 9).

  The cost is two reads per render for a Requestor and three for an analyst. All are aggregates except the one-row queue page.

  The v1.0 follow-up about the Requestor dashboard's "seven extra list reads" is stale. Phase 7 replaced them with one owner-scoped group-by (`.planning/MILESTONES.md:121`; `requestor-dashboard-service.ts:154-171` makes six bounded reads today).
- **D-12:** The phone drawer renders the same profile and sections through the same component, with the New request button for the Requestor. The own-requests section is collapsed there too, which ends the analyst drawer's scroll for personal items (`REPORT.md` §5).
- **D-13:** Seams for later phases. Nothing in Phase 11 hard-codes a section outside the profile data.
  - **Phase 20** adds one item, My risks and treatments, to My work.
  - **Phase 22** adds an Admin profile and re-gates Reference data.
  - **Phase 13** adds "Assigned to me" (a queue view) and its count to Assessment work.
  - **Phase 17** adds the notification centre to the header.
- **D-14:** Phase 10's navigation guard stays on every sidebar link, the New request button and the wordmark. The mobile sheet closes only once the guard lets the navigation go ahead (Phase 10 plan-check warning 2).
- **D-15:** The header gains quick find's search control beside the role tag at every width (D-47). Nothing else in the header changes.

### Home per actor (UX-08 criteria 1 and 2; UAT-001, UAT-003, UAT-004)

- **D-16:** `/app` is Home for every actor: heading "Home", route title "Home | IdamBox CSRM".
  - **Choosing the variant:** before any data read, the page chooses from the viewer's capabilities, which come from the session without a Strapi read. `assessment:review` gets the analyst Home; everyone else gets the Requestor Home.
  - **No analyst reads for Requestors:** a Requestor issues no analyst read, as 07 D-16 required of the analyst dashboard.
  - **What this reverses:** 07 D-15's "`/app` stays the personal dashboard", for analysts (the ROADMAP Phase 11 decision "analysts land on the analyst Home").

  **Reversibility:** reversible.
- **D-17:** `/app/review` becomes a redirect to `/app`, declared in `next.config.ts` `redirects()`:
  - **Match and status:** the exact path only, as a temporary redirect (307).
  - **When it runs:** config redirects run before the proxy and before rendering.
  - **What it keeps:** bookmarks and old links land on Home, and the review queues under `/app/review/*` do not move.
  - **What retires:**
    - the `(analyst-dashboard)` route group, with its loading and error boundaries. Its content, fixtures and partial selector move to the analyst Home;
    - the nav item that links to `/app/review` today, its only in-app link.
  - **Why temporary:** a later phase can reuse the path without browsers holding a cached permanent redirect.
  - **Why not `redirect()` in the page:** the `(app)` group's `loading.tsx` streams first, so a page-level redirect would answer 200 with a client-side redirect.

  **Reversibility:** reversible.
- **D-18:** The analyst Home leads with the queue, deadlines, jobs and alerts. Top to bottom:
  1. the Needs action tiles;
  2. the review queue, whose Generation in progress row is the jobs figure;
  3. Treatments due and Upcoming due dates;
  4. Top alerts;
  5. Risk exposure (released by default, D-40) and the High and Critical residual Risks;
  6. Recent activity;
  7. **Your own requests**, a compact secondary panel with the analyst's needs-your-action and with-Security-Analysts counts, each opening My requests filtered by holder, and a New request link.

  Team job health (running draft jobs, and failed jobs in the last seven days) needs persisted jobs (R-08-36), so it stays with Phase 21 (DASH-04 criterion 2). The UI-SPEC may reorder within "leads with queue, deadlines, jobs and alerts".
- **D-19:** The Requestor Home, top to bottom:
  1. **Needs your action:** drafts to complete and submit, where a returned draft shows its return reason, and questionnaires to answer, with how many questions are answered;
  2. **With the Security Analyst:** each item shows the request number and title, what the Security Analyst is doing, in plain words that name them, and the days since submission;
  3. **Released assessments:** the most recent five, with the overall-rating chips.

  The seven stored-status tiles leave Home, because their split by stored status is what misled (UAT-003). My requests keeps its status filter. Each section shows a bounded list with its total and a link to My requests filtered by that holder: up to ten items for Needs your action and five for With the Security Analyst, which the planner may lower.
- **D-20:** The split comes from the server's holder (D-02 items 5 and 6), never from the stored request status alone (UAT-003). The holder is:
  - `requestor` while the request is a draft, or while its questionnaire is released, not yet submitted, and no Risk Assessment exists;
  - `analyst` for every other submitted, unreleased request;
  - `none` once the request is released or closed.

  Phases 17 and 17.1 add requestor-held work (Risks released for response, acceptance requests) to the same rule.
- **D-21:** Until Phase 13 adds the assignee's name, items name the holder as "the Security Analyst".
- **D-22:** At 375px, Needs your action is the first content after the page header (heading, description and the New request action). DOM order equals visual order at every width.
- **D-23:** Loading, errors and the five states:
  - **Loading:** the page decides the variant before its Suspense boundary, so each variant's skeleton mirrors its own layout. The `/app` `loading.tsx` renders only the Home header and a skeleton common to both variants, or retires (the planner decides).
  - **Errors:** keep "Try again".
  - **E2E fixtures:** both variants keep the guarded fixtures:
    - `__e2eState` for the five states;
    - the analyst's `analyst-top-alerts-error` partial;
    - a new Requestor partial selector on one Home section, replacing `draft-requests-error`, because the Draft requests widget retires.
  - **The route-fixture authorisation test** (`e2e-ui-state-route-authorization.test.tsx`) moves with the content. It proves a Requestor at `/app` issues no analyst read, fixture or partial selector.
- **D-24:** The Requestor Home keeps a New request action in its page header at every width, because on a phone the sidebar's button is inside the drawer. The analyst Home has no header action (the 07 precedent: the tiles are the entry points).
- **D-25:** "Workspace" leaves the product's copy with the nav label. The recovery links "Return to workspace" and "Back to workspace" name Home instead:
  - the shared permission state;
  - both not-found pages;
  - the Risk detail permission state;
  - the review queue's error boundary.

  The UI-SPEC fixes the string, and decides whether the generic "Loading workspace…" and "We couldn’t load this workspace" defaults change too. This supersedes the 06.6 recovery copy.

### Lifecycle stepper and next action (UX-08 criterion 3; UAT-038; the UAT-003 wording)

- **D-26:** Below 768px the request lifecycle stepper is compact:
  - its heading, unchanged: "Current lifecycle state: {label}";
  - "Step {n} of {m}";
  - the next action, naming who holds the work, as a link when the action is the viewer's;
  - a "Show all steps" disclosure: a button with `aria-expanded` and `aria-controls` that reveals the full ordered list.

  From 768px the full stepper shows, as today. Both request pages change. The UI-SPEC decides whether the hub's own Next action line also shows at phone width. If the text is then in the DOM twice, the E2E locators for `/^Next action:/` at 375px change deliberately (Playwright's strict mode).
- **D-27:** The server's next-action copy names who holds the work, and "The work is waiting with the other party." goes:
  - the Requestor reads what the Security Analyst is doing;
  - the analyst reads what the Requestor is doing;
  - each actor's own actions stay verb-first.

  The new `holder` field lets the hub, the stepper, Home and My requests say "With the Security Analyst" or "Your next step" from data, never by matching strings. The UI-SPEC proposes the strings, and `request-lifecycle.ts` holds them.

  **Reversibility:** costly. A published field.
- **D-28:** Phase 10's generation-job override of the Next action line (plan 10-14) also feeds the compact stepper on the analyst hub, so a phone never offers "Generate the questionnaire" while a job runs.

### Review and My lists (UX-09 criterion 1; UAT-035; the UAT-048 picker)

- **D-29:** The request queue columns:
  - **Columns:** Request, Title, Requestor, Assessment type, Business criticality, Status, Due date, Age and Submitted.
  - **Age** is the days since submission, computed by the server from its UTC today, as the alert day offsets are.
  - **Submitted** is a local date (D-55).
  - **Sorting** is offered where the server already sorts: due date, submitted date (which orders by age), request number, title and status.
  - **Mobile cards** show the number, title, requestor, status, due date and age.
  - **Business criticality** is a business attribute, not a risk rating, so it does not use the risk severity badge (the UI-SPEC decides how it shows).

  An assignee column arrives with Phase 13.
- **D-30:** The queue's search matches the request number or the title, through `filters[q]`, so a search for "RAR-2026-…" finds the request. `queue=all` serves quick find and the throughput report's status links, and the queue select offers it (the UI-SPEC names it). The default queue stays Requires my attention.
- **D-31:** The Risk assessments list columns: Assessment, Request title, Status, Risks (a count), Highest residual rating (the severity badge, with text and icon), Draft initiated by, and the release date where released.
  - **Search** matches the assessment number, the summary or the request title.
  - **My risk assessments** gets the same projection, so the Requestor's list shows the request title too.
  - **The Risk count and the highest residual rating** come from one grouped aggregate over the page's assessments, bounded by the page size. The count covers every Risk of the assessment. Phase 16's withdrawal will exclude withdrawn Risks later.
- **D-32:** The Risk Register's Related assessment picker searches on the server, through the assessment list's `q`: by number, summary or request title. It labels each option "{assessment number} · {request title}". Today the Server Action filters the first 25 assessments by number (`risk-actions.ts:72-83`, `risk-service.ts:83-85`).
- **D-33:** No column chooser on the review lists. UX-09 does not ask for one, and Phase 18 designs column choice once, for the DataTable (ASSESS-15), after which the review lists can adopt it. This re-defers Phase 10's note that column choice would come with Phase 11.
- **D-34:** My requests moves to `GET /v1/my_requests`:
  - it keeps today's search, status filter, sort and pagination;
  - it gains a holder filter;
  - each row shows who holds the request and its next step.

### Every figure opens its list (UX-09 criterion 2; UAT-048)

- **D-35:** Every figure on both Homes and in the four reports opens the list that holds its records, with a total equal to the figure (07 D-18, D-24 and D-36). Where a list lacks the filter, the phase adds a closed one through the contract (D-02):
  - **Risk Register:** `stage`, `treatmentAction`, `dueState` and `mitigationEffectiveness`; `any` for mitigation status; "none" for residual rating, inherent rating, treatment status and impacted system;
  - **Risk Assessment lists:** `overallRating`, `approvedFrom` and `approvedTo`;
  - **review queue:** `queue=all`;
  - **My requests:** `holder`.
- **D-36:** The one exception is a count of control implementations. No list of control implementations exists (Phase 18's table and Phase 20's "Used in" panel own that), so these figures open the Risk Register filtered to the open Risks that hold them, and the link says so: "View the Risks with …". The figure still counts implementations.
- **D-37:** A figure that is the sum of two linked figures, such as a most-exposed system's total or the High and Critical total, may stay plain beside its parts, as long as each part opens its own list.
- **D-38:** The treatment-performance report's due window becomes the product's due-soon window: 14 days, `ALERT_DUE_SOON_WINDOW_DAYS`.
  - **What it gains:** the report's due-state figures then equal the Risk Register's `dueState` lists and the alerts' due-soon list.
  - **One meaning everywhere:** "due soon" then means one window across the product, instead of 14 days on Home and the alerts and 30 days in the report.

  **Reversibility:** costly. A published report measure and its tests.
- **D-39:** A median opens the period's list of released Risk Assessments it is computed from, and the link says so. The sample note (releases without a submission date are excluded) stays.

### Exposure (DASH-03; UAT-060)

- **D-40:** Exposure counts released Risks by default (decision 11): open Risks (no closure date) whose Risk Assessment is released, meaning the complete release triple of an approved status, an approval date and an approver.
  - **Counted separately:** Risks under assessment, whose Risk Assessment is a draft or in review with no release facts.
  - **Where the split comes from:** the two partitions are exactly the two branches of the Risk Register scope (`applyDisclosableParent`), so nothing leaves the Risk Register.
  - **Where the rule lives:** once, beside that scope, in `risk-register.ts`. The Risk Register filter, the dashboard summary and the reports all read it.
- **D-41:** Accepted Risks are marked. A released, open Risk whose treatment action is Accept counts as accepted, shown beside its rating's figure and on its Risk Register row.
  - **Under assessment:** a draft's Accept is a proposal and never counts as accepted.
  - **Later:** Phase 17.1's acceptance facts (acceptor, authority, review date) refine the definition.
- **D-42:** The surfaces:
  - the analyst Home's Risk exposure widget: released Risks by rating, accepted Risks per rating, and the under-assessment figure separately;
  - the High and Critical residual Risks widget: released Risks only;
  - the Risk exposure report: every section released, with separate under-assessment and accepted figures.

  Each states its scope in words, such as "Released Risks only" and "Not yet released"; the UI-SPEC fixes the strings.

  The contract: the dashboard summary's `riskExposure` becomes three rating counts (`released`, `releasedAccepted` and `underAssessment`), and the report gains `acceptedByResidualRating` and `underAssessment.byResidualRating` beside its released sections.

  **Reversibility:** costly. Published response shapes.
- **D-43:** Some figures keep their population, open Risks released and under assessment, and say so on the widget:
  - Treatments due, Upcoming due dates and Top alerts;
  - the Treatment performance and Control effectiveness reports.

  Why:
  - these are work-management figures for the analyst, who is also reviewing draft Risks;
  - changing their population would cascade into the alert rules (07 D-06, D-10).

  Moving them to released Risks only belongs with Phase 21's per-audience metric sets, together with an alert stage filter.
- **D-44:** The Risk Register marks each row's stage and accepted state in text (the UI-SPEC decides how) and filters by both. By default it still lists every Risk in scope, released and under assessment, open and closed.
- **D-45:** The analyst insights seed (`seed-analyst-insights.ts`) gains one released, open, accepted Risk, so the accepted marker has a browser proof. Strapi integration tests build their own fixtures. The seed reaches the operator's development database only when the orchestrator restarts Strapi.

### Released label (UX-09 criterion 3; UAT-065; decision 16)

- **D-46:** A request whose stored status is `approved` reads "Released" everywhere:
  - the badge, the filter options and the chips;
  - the throughput report's lifecycle rows;
  - Home and My requests.

  The stored value, the `status=approved` query value and the API stay unchanged (decision 16).
  - **Both label maps change together:** `status-badge.tsx:72` and `request-domain.ts:29`.
  - **The glossary:** the root `CONTEXT.md` drops "the request-status label `Approved` (`CsrmRequestStatus`) [is] unchanged".

  **Reversibility:** reversible.

### Quick find (UX-10; G-5)

- **D-47:** Quick find opens from two places:
  - **a search control in the header:** a visible "Search" label with the shortcut hint from 768px, and below 768px an icon button whose accessible name is "Search";
  - **Ctrl+K or ⌘K.**

  How the shortcut works:
  - it toggles the dialog;
  - it works anywhere in the app except while another dialog is open;
  - it ignores IME composition and key repeat;
  - both modifiers work on every platform.

  The control carries `aria-keyshortcuts`. The platform-specific hint renders after mount, so server and client never disagree. The UI-SPEC fixes the names and copy.
- **D-48:** The dialog follows the WAI-ARIA APG modal dialog pattern and the combobox-with-listbox pattern:
  - focus starts in the input, and Tab stays inside the dialog;
  - the listbox is always shown;
  - the arrow keys move the active option (`aria-activedescendant`), and Enter opens it;
  - Escape closes the dialog and returns focus to where it was.

  How it is built:
  - on the source-owned shadcn `Command` (`src/components/ui/command.tsx`) over `cmdk` 1.1.1, already a dependency (MIT), so nothing new is installed;
  - with client filtering off (`shouldFilter={false}`), because the server filters;
  - with cmdk's Ctrl+J, K, N and P bindings off (`vimBindings={false}`), because Ctrl+K toggles the dialog;
  - with the dialog's title inside the dialog content (the shipped `CommandDialog` renders its title outside the content);
  - with the result counts announced in a polite live region.
- **D-49:** Search runs in one Server Action:
  - **Input:** it validates the term, trimmed, 2 to 100 characters.
  - **Reads:** it runs, in parallel on the server, the existing list searches the viewer's capabilities allow, five results each, through the existing feature service functions:
    - **Requestor:** My requests, My questionnaires and My risk assessments;
    - **Security Analyst:** Requests (the review queue with `queue=all`), Questionnaires, Risk assessments, Risks and My requests.
  - **Scope:** Strapi scopes every read, so results are only records the viewer may read. The capability check only decides which lists to ask.
  - **Output:** display fields and hrefs only, never records.
  - **No Route Handler:** that would be a frontend facade.
- **D-50:** Typing is debounced, by about 250 ms (the planner decides), and one search is in flight at a time. Next dispatches Server Actions one at a time per client, so a newer term waits, and only the latest result is applied. Each group shows up to five results with its total and a link to its list filtered by the term.
- **D-51:** Opening a result goes through Phase 10's navigation guard, which gains a programmatic entry point, so a Requestor with unsaved answers is warned first.
- **D-52:** The dialog body loads on demand, through `next/dynamic` on first open, optionally prefetched when the control is hovered or focused. That keeps the shell's first-load JavaScript within the 300 KB route budget (R-08-34).
- **D-53:** The states:
  - **Before two characters:** a hint.
  - **While searching:** loading rows.
  - **No results:** "No matches" for the term.
  - **One list fails:** that group says it couldn't search its list, and the other groups still show.
  - **A list the viewer can't read:** it is never asked.

  At 375px the dialog is a full-width sheet; the UI-SPEC decides the layout.

### Copy and local time (deferred here by Phase 10)

- **D-54:** The "contextual Risks" wording leaves:
  - the analyst Home;
  - the reports: their web presentation, `report-copy.json`, and the served definitions in `report-definitions.ts`, which a mounted test keeps equal to the JSON;
  - the Risk Register list description.

  DASH-03's scope wording replaces it. These files join the interface copy guard, which excluded them for this phase (Phase 10 UI-SPEC §17.2).
- **D-55:** Instants on lists, dashboards, alerts and reports render in the viewer's time zone, through Phase 10's `formatInstant` and `LocalInstant` and extension X-3. The surfaces:
  - the review queue's Submitted date;
  - My requests' Updated date;
  - the Requestor Home's dates;
  - the analyst Home's Recent activity;
  - My risk assessments' release date;
  - every new date column.

  Calendar dates stay zone-free:
  - due, target and review dates;
  - the reports' as-at dates and month buckets, which the server computes in UTC.

  Alerts show calendar dates only, so nothing changes there.

### Verification and plan shape

- **D-56:** Each behaviour gets a failing test first, where it can be tested: a web unit test, a Strapi unit or integration test, or a Playwright journey.
  - **Changed assertions:** an E2E assertion that names a changed heading, label, title, copy string or route changes deliberately in the plan that changes it, and the plan lists it.
  - **New journeys** use their own fixtures, or seeded fixtures that no other spec consumes.
- **D-57:** The proofs the phase must carry:
  - **the sidebar per actor, at 1440px and 375px:** sections, labels equal to headings, counts, the collapsed section and the drawer;
  - **Home per actor, at 375px and 1440px:** the Requestor's first screen shows the action panel, and the analyst's shows the queue;
  - **lists:** the queue and assessment columns, and figure-to-list equality for each linked figure;
  - **exposure scope and the Released label;**
  - **quick find:** by keyboard at both widths, and within its scope, so the Secondary Requestor never sees Jane's records;
  - **the redirect:** `/app/review` lands on Home;
  - **the E2E sign-in helper** asserts the Home heading and the role in the banner, and the sign-in guard (`e2e-sign-in-assertions.test.ts`) changes with it.
- **D-58:** Plans that edit Strapi or run Playwright run with the dev servers stopped.
  - **The phase gate:** the web suite, the typecheck, `api:check` and the Strapi suite; the full Playwright suite on the production build; identical catalogue copies; the content-type freeze check; and a clean tree.
  - **Browser checks:** at 375px and 1440px, for the Requestor, the Secondary Requestor and the Security Analyst.

### Planner's Discretion

- Module placement for:
  - the navigation profile data, the count composition and the navigation components;
  - the two Home variants;
  - the quick-find action and dialog;
  - the holder and exposure SQL helpers.
- The page sizes of the Home sections, within the bounds in D-19.
- The debounce (about 200 to 300 ms), and whether quick find prefetches on hover or focus.
- Whether `/app`'s `loading.tsx` stays (D-23).
- The names of new query parameters and response fields, within the closed vocabularies above.
- Splitting a large plan into smaller ones, provided D-05's serialisation holds.
</decisions>

<operator_decisions>
## Delegated Decisions This Phase Depends On

The operator delegated the product decisions on 2026-09-27 (`.planning/NEXT-WAVE-DECISIONS.md`). They are binding. No operator decision is open for this phase.

| Decision | What it settles here | Decisions that depend on it |
|---|---|---|
| #11 What exposure counts | Released Risks by default, "under assessment" separately, accepted Risks marked | D-40 to D-45 |
| #16 Released request label | "Released" for display, the stored value unchanged | D-46 |
| ROADMAP Phase 11: analysts land on the analyst Home | `/app` is the analyst Home for analysts | D-16 to D-18 |
| G-4 Premium experience bar | A keyboard path for every primary action, skeletons, empty states that say what to do, phone layouts, every figure opening its records | D-10, D-19, D-23, D-26, D-35 to D-39, D-47 to D-53 |
| G-5 Quick find | Ctrl+K or ⌘K, requests, questionnaires, Risk Assessments and Risks by number or title, within the viewer's scope, through the existing list searches | D-47 to D-53 |
| G-1 Separation of duties | An analyst's own requests sit apart, in their own collapsed section, and are enforced from Phase 13 | D-08, D-18 |
| G-6 Planning housekeeping | A Playwright run leaves the tree clean, with no restore step | D-58 |
| #10 and #18 (later phases) | Assignment (Phase 13) and notifications (Phase 17) extend the seams | D-13, D-21 |
</operator_decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/uat/product-gaps/FINDINGS.md`: UAT-001, UAT-002, UAT-003, UAT-004, UAT-035, UAT-038, UAT-048, UAT-060 and UAT-065 in full.
- `.planning/uat/product-gaps/REPORT.md`:
  - §3: the status of Q1, Q2, Q5 and F2;
  - §4: the dashboard metrics and presentation rules;
  - §5: the proposed sidebars;
  - §8: the Phase 11 proposal.
- `.planning/uat/product-gaps/JOURNEYS.md`: areas 1 (navigation tree, dashboards), 2 (review lists), 3 (375px), 5 (registers and reports), 8 (dashboards), 9 (sidebar usage) and 11 (copy).
- `.planning/uat/product-gaps/evidence/a1-analyst-landing-dashboard.jpg` and `.planning/uat/product-gaps/evidence/a1-requestor-dashboard-375.jpg`.
- `.planning/uat/product-gaps/BRIEF.md` Appendix A: Q1, Q2, Q5 and F2.

### Planning authority
- `.planning/ROADMAP.md` Phase 11: goal, success criteria 1 to 6, decisions, and the contract and datamodel line.
- `.planning/REQUIREMENTS.md`: UX-07, UX-08, UX-09, UX-10 and DASH-03.
- `.planning/NEXT-WAVE-DECISIONS.md`: #11, #16, G-1, G-4, G-5 and G-6.
- `.planning/STATE.md` Decisions: the planning method, and plans written ahead against earlier phases' planned outputs.
- `.planning/milestones/v1.0-STATE.md`, for the v1.0 decisions this phase keeps or reverses:
  - 06.3: My lists are owner-scoped for every actor;
  - 06.6: the DataTable and recovery copy;
  - 07: D-15, D-16, D-18, D-24 and D-36;
  - 08: D-12, D-15 (sign-in asserts the shell), D-26 (Menu), D-27 (one status mapping) and D-50.
- `.planning/phases/07-analyst-dashboard-reports-and-alerts/07-CONTEXT.md`:
  - D-13: the report keys and windows;
  - D-15 and D-16: routes and gating;
  - D-18, D-24 and D-36: every figure opens an equal list;
  - D-19: charts.
- `.planning/phases/10-existing-flow-gap-closure/10-CONTEXT.md`:
  - D-19: local time;
  - D-24: permission copy;
  - D-38: copy;
  - D-40: serialisation;
  - D-41 to D-48;
  - the Deferred Ideas that name this phase.
- `.planning/phases/10-existing-flow-gap-closure/10-UI-SPEC.md`: extensions X-1 to X-5, the voice rules, and §17.2, the copy guard and its Phase 11 exclusions.
- `.planning/phases/10-existing-flow-gap-closure/` plans:
  - `10-01-PLAN.md`: `formatInstant`, `LocalInstant` and the zone cookie;
  - `10-08-PLAN.md`: the navigation guard and `GuardedLink`;
  - `10-04-PLAN.md` and `10-14-PLAN.md`: hub copy and the Next action override;
  - `10-15-PLAN.md`: released dates;
  - `10-02-PLAN.md`: the analyst route gate and the copy guard.

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md`:
  - §9: navigation generated from capability configuration;
  - §10: role-specific dashboards;
  - §11: collapsible navigation groups and the mobile drawer;
  - §12: responsive layout.
- `docs/references/idambox-datamodel.jdl`: `CsrmAssessmentRequest` (requestor, type, criticality, due and submitted dates), `CsrmAssessmentStatus`, and `CsrmTreatmentAction` (ACCEPT, TREAT).
- `CONTEXT.md` (repository root): the "Released" glossary entry that D-46 changes.

### Contract and authorization
- `docs/references/specification.json`: `AssessmentRequestQueueItem`, `AssessmentSummary`, `AssessmentRequestLifecycleNextAction`, `MyRequestStatusSummary`, `DashboardSummary`, `RatingCounts`, `DashboardHighCriticalRisks`, `RiskExposureReport`, `TreatmentPerformanceReport`, `RiskRegisterItem`, and the query parameters of `/v1/assessment_requests`, `/v1/risk_assessments`, `/v1/my_risk_assessments` and `/v1/risks`.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`: the My Requests Function, the reserved `GET:/api/v1/my_requests`, and design note 9.
- `docs/references/served-operations.json`: the unserved `GET:/api/v1/my_requests` row, and `webCallers`.
- `apps/backend/src/policies/csrm-authorization.ts`: `requireRequestCollectionScope`, `requireAnalystRequestCollectionScope`, `requireAnalystRiskRegisterScope` and `requireAnalystInsightScope`.
- `apps/backend/tests/fixtures/authorization-matrix.ts`: the six-actor rows.
- `apps/csrm/src/features/contract-response-parity.test.ts` and `apps/csrm/src/features/contract-operation-chain.test.ts`: the parser and chain guards.

### Design and framework
- `docs/design/csrm-design-direction.md`:
  - §4 AppShell and sidebar: section labels, on-dark tokens, the light-filled sidebar button's shadows;
  - §4 Tags and chips; §4 Status and risk badges; §4 Cards and KPI tiles (link tiles);
  - §4 Dialogs, Empty states, Record links, Skeletons and Print;
  - §3.10 Type scale; §5 Motion; §6 Do-not list.
- `docs/adr/0001-adopt-bproton-design-system.md`: the adopted system and its gap decisions.
- Next.js 16.3.6 docs under `apps/csrm/node_modules/next/dist/docs/01-app/`:
  - `01-getting-started/03-layouts-and-pages.md`: layouts do not re-render on navigation;
  - `01-getting-started/06-fetching-data.md`: streaming a promise into a Client Component with `use`;
  - `02-guides/server-actions.md`: sequential dispatch, and the security of actions;
  - `03-api-reference/05-config/01-next-config-js/redirects.md` and `03-api-reference/03-file-conventions/proxy.md` (Execution order);
  - `02-guides/lazy-loading.md`;
  - `03-api-reference/04-functions/revalidatePath.md`;
  - `03-api-reference/02-components/link.md`: `onNavigate` and blocking navigation.
- WAI-ARIA Authoring Practices: the combobox pattern (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) and the modal dialog pattern (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/csrm/src/config/navigation/navigation.ts`: the capability-gated item list and `activeNavigationHref`, the longest-match current-item rule. It becomes the profile and section data (D-06).
- `apps/csrm/src/components/shell/capability-navigation.tsx`: `CapabilityNavigation`, which renders labelled `role="group"` sections, and `MobileNavigation`, the Radix dialog drawer with the `Menu` trigger and the Close control. It is extended rather than forked, and keeps Phase 10's guard wiring.
- `apps/csrm/src/features/analyst-dashboard/*`: the analyst dashboard's service (five parallel reads, each failing on its own), presentation (all copy and links), schema and component (KPI strip, widgets, footers). It moves under the analyst Home.
- `apps/csrm/src/features/dashboard/*`: the Requestor dashboard's service (six reads) and widgets. It is rebuilt as the Requestor Home (D-19).
- `apps/csrm/src/components/ui/command.tsx`: the shadcn Command over `cmdk` 1.1.1, unused today. Quick find uses it (D-48).
- `apps/csrm/src/components/csrm/data-table.tsx`: DataTable with sorting, filter chips, density, sticky identifier column and mobile cards. The review lists stay on it.
- `apps/csrm/src/components/csrm/status-badge.tsx`: `statusPresentation`, the one status mapping, where D-46's label changes; and `risk-rating-badge.tsx`, for the highest residual rating.
- `apps/csrm/src/components/csrm/kpi-tile.tsx` and `bar-chart.tsx`: the exposure figures' primitives.
- Phase 10 artifacts, once Phase 10 executes:
  - `apps/csrm/src/lib/time/format-instant.ts` and `apps/csrm/src/components/csrm/local-time.tsx`: local time;
  - `apps/csrm/src/components/csrm/navigation-guard.tsx`: the guarded navigation;
  - `apps/csrm/src/lib/performance/interface-copy-guard.test.ts`: the copy guard.
- Strapi `review-queue-repository.ts`: the lifecycle facts as SQL (`questionnaireReleased`, `questionnaireSubmitted`, `assessmentExists` and `assessmentReleased`), which D-20's holder predicate reuses; `countReviewQueueBucket`.
- Strapi `risk-register.ts` `applyDisclosableParent`: the released and mutable branches that D-40 splits into stage predicates.
- Strapi `request-status-summary.ts`, its controller and its route: the owner-scoped group-by pattern that `GET /v1/my_requests` follows.

### Established Patterns
- Typed openapi-fetch service modules and Server Actions only; the chain guard forbids raw fetch and unlisted operations, and `served-operations.json` records which service files call each operation.
- Closed zod parsers with contract parity. Client components read vocabularies from zod-free `*-domain.ts` modules, and `zod-client-boundary.test.ts` guards the key routes.
- Every figure is the server's: the web words, links and formats what it is given (07 D-02, D-34).
- Route gates run before any read (07 D-16), and Strapi answers an unauthorised assessment read with 404.
- The guarded E2E fixtures (`__e2eState`, `__e2ePartial`) resolve only after the real, authorised reads succeed.
- The analyst review queue is a database predicate with exact totals (D-21, D-30 in Phase 7); new predicates follow that pattern.

### Integration Points
- **Shell:**
  - `apps/csrm/app/(app)/layout.tsx`: session, capabilities, and now the count promise;
  - `apps/csrm/src/components/shell/app-shell.tsx`: sidebar, header and quick-find control;
  - `apps/csrm/next.config.ts`: the `/app/review` redirect.
- **Home:** `apps/csrm/app/(app)/app/page.tsx`, its `loading.tsx` and `error.tsx`, and the retiring `apps/csrm/app/(app)/app/review/(analyst-dashboard)/`.
- **Request pages:** `request-lifecycle-stepper.tsx`, `request-hub.tsx`, `assessment-detail.tsx` and `app/(app)/app/requests/[documentId]/page.tsx`. On the Strapi side, `request-lifecycle.ts`.
- **Lists:**
  - `assessment-list.tsx`, `assessment-schema.ts` and `assessment-service.ts`;
  - `request-table.tsx`, `request-schema.ts` and `request-service.ts`;
  - `released-assessment.tsx`;
  - `risk-register-filters.tsx`, `risk-schema.ts`, `risk-service.ts` and `risk-actions.ts`.

  On the Strapi side: `collection-scope.ts`, `review-queue-repository.ts`, `assessment-scope.ts` with the assessment controller, and `risk-register-query.ts` with `risk-register.ts`.
- **Exposure and reports:** `dashboard-summary.ts`, `report-repository.ts`, `report-definitions.ts` and `insight-constants.ts` (Strapi); `analyst-dashboard-*`, `report-*` and `report-copy.json` (web).
- **Tests:**
  - `apps/csrm/e2e/helpers/navigation.ts` (`signInAs`);
  - `apps/csrm/src/lib/testing/e2e-sign-in-assertions.test.ts` and `e2e-ui-state-route-authorization.test.tsx`;
  - `apps/csrm/src/lib/performance/zod-client-boundary.test.ts`;
  - `apps/csrm/e2e/performance.spec.ts` (key routes and budgets).
</code_context>

<specifics>
## Specific Ideas

- **The UAT baselines:** UAT-A (payroll SaaS, Project), UAT-B (partner API, BAU, at 375px) and UAT-C (external AI service, Other, second Requestor) are the scenarios to re-run after the phase (`REPORT.md` §12).
  - Their records live in the operator's development database, and tests must not change them.
  - Bob's own two requests (Submitted, Under review) are the analyst's "own requests" in that database.
- **Browser proofs** reuse the seeded fixtures that already carry the needed states:
  - Jane's navigation-lifecycle requests and her released and draft questionnaires;
  - the Phase 7 analyst-insights fixtures: in-review Risks for under assessment, and a released Critical Risk.

  D-45 adds an accepted released Risk. New journeys that change state create their own records through the UI.
- **The first screen at 375px** (UAT-004): the heading, the New request action, then the Needs your action panel. For the analyst: the heading, then the Needs action tiles and the queue.
- **The orchestrator's standing rule** "E2E sign-in helpers assert the Dashboard heading" becomes "the Home heading" once the Home plan lands. The instruction text that states it should change then.
</specifics>

<deferred>
## Deferred Ideas

- **Phase 13:** the assignee column, "Assigned to me" and its counts, and the assignee's name on Home items. Renaming the "Requires my attention" queue, whose "my" only becomes true with assignment.
- **Phase 18:** a column chooser on review lists (UAT-035 "with column choice"), designed once for the DataTable (ASSESS-15).
- **Phase 20:** My risks and treatments in the Requestor's My work; the BAU and Project views and type breakdowns; Risk owners' Home items.
- **Phase 21:**
  - team job health: running draft jobs, and failed generation jobs in the last seven days (DASH-04 criterion 2, persisted jobs, R-08-36);
  - trend charts (UAT-048's trend recommendation, DASH-05);
  - moving the treatment, control and alert figures to released Risks only, with an alert stage filter (D-43).
- **Phase 22:** the Admin profile and sidebar; re-gating Reference data.
- **Phase 17:** the notification centre in the header, and "important notifications" on the Requestor Home (brief §10).
- **Not requested by any finding:**
  - sorting the Risk assessments list by Risk count or highest residual rating;
  - recent items and commands in quick find;
  - the sidebar's collapsed icon rail (direction §4, 64px);
  - a user or avatar menu (waits for INT-02).
</deferred>

---

*Phase: 11-navigation-landing-and-list-clarity*
*Context gathered: 2026-09-28*
