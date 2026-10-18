# Phase 11: Navigation, landing and list clarity - Research

**Researched:** 2026-09-28
**Domain:** the Next.js 16.3 App Router shell and navigation, server-derived workflow projections in Strapi 5, an accessible command dialog, and DataTable lists
**Confidence:** HIGH for codebase facts, the contract chain and the Next.js behaviours in the bundled docs, all read this session. MEDIUM for four framework behaviours tagged [ASSUMED], each of which has a planned browser proof (see the Assumptions Log).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Scope and contract boundary

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

#### Sidebar and navigation model (UX-07, UAT-002)

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

  The v1.0 follow-up about the Requestor dashboard's "seven extra list reads" is stale. Phase 7 replaced them with one owner-scoped group-by (`.planning/workstreams/csrm/MILESTONES.md:121`; `requestor-dashboard-service.ts:154-171` makes six bounded reads today).
- **D-12:** The phone drawer renders the same profile and sections through the same component, with the New request button for the Requestor. The own-requests section is collapsed there too, which ends the analyst drawer's scroll for personal items (`REPORT.md` §5).
- **D-13:** Seams for later phases. Nothing in Phase 11 hard-codes a section outside the profile data.
  - **Phase 20** adds one item, My risks and treatments, to My work.
  - **Phase 22** adds an Admin profile and re-gates Reference data.
  - **Phase 13** adds "Assigned to me" (a queue view) and its count to Assessment work.
  - **Phase 17** adds the notification centre to the header.
- **D-14:** Phase 10's navigation guard stays on every sidebar link, the New request button and the wordmark. The mobile sheet closes only once the guard lets the navigation go ahead (Phase 10 plan-check warning 2).
- **D-15:** The header gains quick find's search control beside the role tag at every width (D-47). Nothing else in the header changes.

#### Home per actor (UX-08 criteria 1 and 2; UAT-001, UAT-003, UAT-004)

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

#### Lifecycle stepper and next action (UX-08 criterion 3; UAT-038; the UAT-003 wording)

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

#### Review and My lists (UX-09 criterion 1; UAT-035; the UAT-048 picker)

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

#### Every figure opens its list (UX-09 criterion 2; UAT-048)

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

#### Exposure (DASH-03; UAT-060)

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

#### Released label (UX-09 criterion 3; UAT-065; decision 16)

- **D-46:** A request whose stored status is `approved` reads "Released" everywhere:
  - the badge, the filter options and the chips;
  - the throughput report's lifecycle rows;
  - Home and My requests.

  The stored value, the `status=approved` query value and the API stay unchanged (decision 16).
  - **Both label maps change together:** `status-badge.tsx:72` and `request-domain.ts:29`.
  - **The glossary:** the root `CONTEXT.md` drops "the request-status label `Approved` (`CsrmRequestStatus`) [is] unchanged".

  **Reversibility:** reversible.

#### Quick find (UX-10; G-5)

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

#### Copy and local time (deferred here by Phase 10)

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

#### Verification and plan shape

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

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-07 | The sidebar is divided into sections named by job, with labels that match page headings and counts on items that hold work (Requestor: New request button, Home, My work; Security Analyst: Home, Assessment work, Oversight, Reference data and a collapsed own-requests section; the phone drawer shows the same sections) | "Sidebar" in Findings by requirement; Patterns 1 and 2; Pitfalls 1, 4, 5 and 14; plans 11-03 and 11-10 |
| UX-08 | Each actor lands on one Home that leads with their next actions, on a phone as on a desktop (the analyst: queue, deadlines and alerts, with own requests secondary; the Requestor: "Needs your action" apart from "With the Security Analyst", the action panel first at 375px; on a phone the lifecycle reads "Step n of m" with the next action) | "Home" and "Stepper" in Findings by requirement; Patterns 3 and 4; Pitfalls 2, 3, 6, 7 and 12; plans 11-02, 11-06, 11-07, 11-08 and 11-09 |
| UX-09 | Review lists carry the columns needed to triage, figures open their records, and statuses use user terms (queue: requestor, type, criticality, due date, age; assessment list: request title, Risk count, highest residual rating; every figure opens its filtered list; assessments searchable by request title; a released request reads "Released") | "Lists", "Figures" and "Released label" in Findings by requirement; the Figure link inventory; Pattern 7; Pitfalls 8, 9, 10, 11 and 13; plans 11-01, 11-04, 11-05, 11-11 and 11-13 |
| UX-10 | Quick find opens any record the user may read by number or title (Ctrl+K or ⌘K and a header control; requests, questionnaires, Risk Assessments and Risks; only authorised records, through the existing list searches; Enter opens; dialog and combobox keyboard patterns at 375px and 1440px) | "Quick find" in Findings by requirement; Pattern 6; Pitfalls 15 to 19; plan 11-14 |
| DASH-03 | Exposure figures state their scope and separate released Risks from Risks still under assessment (released by default, "under assessment" shown separately and said on the widget, accepted Risks marked) | "Exposure" in Findings by requirement; Pattern 5; Pitfalls 20, 21 and 22; plans 11-11 and 11-12 |
</phase_requirements>

## Summary

Phase 11 is mostly presentation and projection work over data that already exists. Seven findings shape the plans.

1. **The navigation is one flat list.** It is a capability-gated item list (`navigation.ts:54-72`) rendered by one client component (`capability-navigation.tsx:29-66`) inside a Server Component shell. Turning it into per-actor profiles of labelled sections is a contained change. The badges can stream from the layout: a promise the layout starts, read with React's `use()` under Suspense, so no page waits for a count. The Next 16.3 bundled docs show this pattern, and state that layouts do not re-render on navigation.
2. **The analyst dashboard is self-contained.** Its service, presentation, schema and component are gated by capability before any read (`app/(app)/app/review/(analyst-dashboard)/page.tsx:26-50`). Moving it under `/app` behind the same gate is a route move. A `next.config.ts` redirect sends `/app/review` to `/app`. Config redirects run before the proxy and before rendering (the `proxy.md` execution order), so the redirect answers with a real 307 and never the streamed meta-refresh a page-level redirect would give under the `(app)` loading boundary.
3. **The stored status cannot give the split.** "Needs your action" and "With the Security Analyst" cannot come from the stored request status, because `questionnaire-in-progress` covers three holders (UAT-003). The review queue already expresses the lifecycle facts as SQL (`review-queue-repository.ts:71-131`), proven equal to the semantic rule (Phase 7 D-30). The catalogue reserves `GET:/api/v1/my_requests` under the Requestor's My Requests Function, with the grant already in place. Serving it with a holder predicate built from the same facts gives exact totals and the holder filter the Home's figures need.
4. **Exposure splits cleanly.** The Risk Register scope (`applyDisclosableParent`, `risk-register.ts:137-164`) is the union of exactly two branches: a mutable Risk Assessment (draft or in review, with no approval facts) and a released one (the complete release triple). Splitting it gives the released and under-assessment partitions with nothing left over and nothing lost. "Accepted" is a released, open Risk whose `treatmentAction` is `Accept`, a JDL enum value that already exists (`CsrmTreatmentAction { ACCEPT, TREAT }`).
5. **Quick find needs no new dependency.** `cmdk` 1.1.1 is installed (MIT, the registry's latest, about 52M weekly downloads, legitimacy verdict OK), and the shadcn `Command` wrapper exists unused (`src/components/ui/command.tsx`). Three traps are verified in the installed code:
   - the wrapper's `CommandDialog` renders its title outside the dialog content;
   - cmdk filters on the client by default;
   - cmdk binds Ctrl+K to "move up" (its `vimBindings` default).

   Next dispatches Server Actions one at a time per client, so the search must coalesce to the latest term.
6. **Figures need filters to open equal lists.** Many dashboard and report figures lack a list with an equal total today. The phase adds closed filters to the Risk Register, the Risk Assessment lists and the review queue. The treatment-performance report's 30-day window has no matching list, and it aligns to the product's 14-day due-soon window (D-38).
7. **The test churn is large and deliberate.** Every E2E sign-in helper asserts the "Dashboard" heading: the shared helper and seven spec-local sign-ins in five specs, all guarded by `e2e-sign-in-assertions.test.ts`. Nav labels and headings are asserted in about twelve specs, and the `/app/review` route in five. Each change belongs to the plan that makes it (see the E2E and copy assertions that change).

**Primary recommendation:**
- **Order:** 15 plans in 15 serial waves. The web-only shell, Home and sidebar moves come first, so later plans assert the new labels. The six contract plans follow, one per wave, then the counts, the figure links, quick find, and the gate.
- **Reuse:** the review queue's SQL lifecycle facts for the holder; the Risk Register's two scope branches for the stage; the installed `cmdk` for quick find; Phase 10's `LocalInstant` and navigation guard.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sidebar profile, sections and labels | Frontend Server (the layout and `AppShell` choose the profile from session capabilities) | Browser (`CapabilityNavigation` renders, marks the current item, and toggles the collapsed section) | Presentation only; each route's own gate and Strapi authorise the reads |
| Sidebar counts | API (Strapi aggregates and a one-row queue page) | Frontend Server (starts the reads and streams one promise); Browser (renders the badges) | Every figure is the server's (07 D-02); the web never counts |
| Home variant | Frontend Server (the `/app` page reads capabilities before any read) | — | A Requestor must issue no analyst read (07 D-16) |
| `/app/review` redirect | Frontend Server (`next.config.ts` `redirects()`) | — | Runs before the proxy and rendering: a real 307 |
| Holder and next-action wording | API (`request-lifecycle.ts`; the holder SQL for lists) | Browser (renders data) | One derivation; the web never matches strings |
| My requests list | API (owner scope from the policy; SQL holder predicate) | Frontend Server (the page) | Owner scope is authorisation, enforced in Strapi |
| Queue and assessment projections | API (projection and bounded aggregates) | Frontend Server and Browser (DataTable columns) | Totals and figures stay server-side |
| Exposure stage split and accepted marker | API (SQL predicates beside `applyDisclosableParent`) | Browser (renders scope statements and links) | One definition shared by the Risk Register, the dashboard and the reports |
| Figure links | Frontend Server (href builders in the presentation modules) | API (closed list filters) | Equal totals by construction (07 D-18, D-24, D-36) |
| Quick find search | Frontend Server (one Server Action calling the existing service functions) | API (existing scoped list reads) | No frontend facade; Strapi scopes every result |
| Quick find dialog and shortcut | Browser (cmdk, Radix Dialog, the keydown listener) | — | Client interaction only |
| Local time | Frontend Server and Browser (Phase 10's `formatInstant` and `LocalInstant`, with the zone cookie) | — | X-3 |
| Released label | Frontend Server and Browser (`statusPresentation`, `requestStatusPresentation`) | — | Display only; the stored value is unchanged |
| Compact stepper | Browser (breakpoint and disclosure state) | Frontend Server (lifecycle data) | Presentation of server data |

## Project Constraints (from AGENTS.md)

The root `AGENTS.md` and `apps/csrm/AGENTS.md` are the project's instruction files. These directives bind every Phase 11 plan:
- Next.js App Router and TypeScript strict mode. Prefer Server Components, using Client Components only where required. Next.js is 16.3.6, so read `apps/csrm/node_modules/next/dist/docs/` before framework-specific code.
- shadcn/ui before custom primitives; semantic theme tokens only; never hard-code BProton brand colours in feature components.
- All pages work at mobile and desktop widths. WCAG 2.2 AA from 375px to 1440px.
- No business or domain logic in JSX.
- Never call APIs from arbitrary UI components: the typed openapi-fetch service layer only, with no frontend API facade and no raw fetch in pages.
- Validate external input with shared schemas. Closed zod parsers are registered in the parity guard.
- Authorization is enforced server-side, and navigation visibility is not authorization. Requestors must not reach another Requestor's restricted records.
- AI output is advisory and never releases an assessment. No live AI in suites (the deterministic provider is pinned).
- JDL terminology is the domain source of truth. Document contract gaps; never invent entities.
- Automated tests come with every material workflow. No new dependency without a concrete reason.
- Keycloak stays disabled. No secrets are committed.
- UI values come only from `docs/design/csrm-design-direction.md` (ADR 0001). The five screen states are required, and status and risk are never shown by colour alone.

## Standard Stack

### Core (all installed; no package is added by this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.3.6 [VERIFIED: `node -p require('next/package.json').version`] | App Router, `redirects()`, Server Actions, `next/dynamic` | The project's framework |
| react | 19.2.4 [VERIFIED: same] | `use()` for the streamed count promise; Suspense | Bundled with Next 16.3 |
| cmdk | 1.1.1 [VERIFIED: `apps/csrm/node_modules/cmdk/package.json`, `npm view cmdk version`] | Combobox and listbox command menu under the shadcn `Command` | Already a dependency (`apps/csrm/package.json`: `"cmdk": "^1.1.1"`); shadcn's own Command component builds on it |
| radix-ui | 1.6.7 [VERIFIED] | `Dialog` (through `components/ui/dialog.tsx`) for the quick-find modal | The project's primitive layer |
| @radix-ui/react-dialog | 1.1.15 [VERIFIED: package.json] | The mobile navigation sheet (existing) and cmdk's own peer | Pinned already |
| @tanstack/react-table | 9.2.4 [VERIFIED: package.json] | DataTable | 06.6 D-02: extended, never forked |
| zod | ^4.4.3 | Closed parsers and Server Action input | Project rule |
| openapi-fetch and openapi-typescript | 0.17.0 and 7.13.0 | Typed client and generator | Project rule |
| lucide-react | 1.30.0 | Icons | ADR 0001 gap 11b |

### Supporting (tests)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.11 | Web unit tests (jsdom) | Every web behaviour |
| @testing-library/react and user-event | 16.3.0 and 14.6.1 | Component and keyboard tests | The navigation, Home, stepper and quick find |
| @playwright/test | 1.58.2 | E2E on the production build (`desktop` 1440×900; `mobile` 375×812 for `@journey`) | Journeys, width checks, keyboard |
| @axe-core/playwright | 4.11.0 | WCAG scans | The accessibility sweep |
| node:test (Strapi) | Node 24.19.0 | Strapi unit and integration tests, one SQLite database per file | Every Strapi change |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cmdk under the shadcn `Command` | A hand-built combobox over Radix Popover (the X-2 record picker pattern) | X-2 serves one field with one list; quick find is a modal with several grouped lists and needs grouped `aria-activedescendant` navigation, which cmdk already provides |
| One Server Action | A Route Handler returning JSON | A frontend API facade, which `AGENTS.md` forbids |
| Streaming counts through `use()` | Awaiting the counts in the layout | Blocks every page on two or three reads |
| A config redirect | `permanentRedirect()` in the page | Streams a meta-refresh with status 200 under the `(app)` loading boundary (see Pitfall 3) |

**Installation:** none.

**Version verification:** `npm view cmdk version` returned `1.1.1`, `time.modified` 2025-08-27 and `license` MIT. The installed build is 1.1.1.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| cmdk | npm | 1.1.1 published 2025-03-14 | 52,353,196 a week | github.com/pacocoursey/cmdk | [OK] (`gsd-tools query package-legitimacy check`: exists, not deprecated, no postinstall) | Already installed; no install step |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.
This phase installs no package.

## Findings by requirement and finding (with file and line)

### Sidebar (UX-07, UAT-002)

- **Today's model** [VERIFIED: `apps/csrm/src/config/navigation/navigation.ts:27,54-72`]:
  - `navigationGroups = ['Reports', 'Administration'] as const`;
  - ten ungrouped items: Workspace `/app`, My Requests, My Questionnaires, My Risk Assessments, New request, Analyst dashboard `/app/review`, Assessment Requests, Questionnaires, Risk Assessments and Risk register;
  - the group `Reports`: Alerts and Reports;
  - the group `Administration`: Risk Types, Controls, Information Systems and Information Assets.
  - Each item is `{ href, label, capability, icon, group? }`. `activeNavigationHref` (lines 40-52) marks the longest matching href at a path-segment boundary, and `/app` matches only itself.
- **Rendering** [VERIFIED: `apps/csrm/src/components/shell/capability-navigation.tsx:29-66`]: ungrouped items first, then `role="group"` divs with an `aria-label`. `MobileNavigation` (lines 95-148) is a Radix Dialog sheet titled "Navigation", with a `Menu` trigger (08 D-26) and a Close control; it renders the same `CapabilityNavigation`, and `onNavigate` closes the sheet. Phase 10 plan 10-08 adds the guard's `onNavigate` to every link, and `GuardedLink` for the wordmark.
- **Headings that differ from labels today** [VERIFIED: the page files]:
  - `app/(app)/app/page.tsx:39` "Dashboard";
  - `app/(app)/app/requests/page.tsx:42` "My Requests";
  - `app/(app)/app/questionnaires/page.tsx:27` "My Questionnaires";
  - `app/(app)/app/assessments/page.tsx:26` "My Risk Assessments";
  - `src/features/assessments/assessment-list.tsx:397` "Assessment request review" and `:401` "Risk assessment review";
  - `app/(app)/app/review/questionnaires/page.tsx:21,31,40` "Questionnaire Review";
  - `app/(app)/app/risks/page.tsx:40` "Risk Register";
  - `app/(app)/app/requests/new/page.tsx:14` and its `loading.tsx:4` "New assessment request".

  The Reference data headings come from `pluralLabel` in `administration-config.ts:20,31,42,53` ("Risk Types", "Controls", "Information Systems", "Information Assets") and already equal their labels.
- **Route titles** use Title Case ("My Requests | IdamBox CSRM"), and the accessibility and production-hardening specs assert them (see "E2E and copy assertions that change").
- **No count exists** on any item today (JOURNEYS area 1).
- **The design direction already provides:**
  - section labels: `--text-micro` in `--color-text-inverse-muted`, with `--color-border-on-dark` dividers (§4 AppShell);
  - a light-filled button on the sidebar: `--shadow-button-light` and `--shadow-button-light-hover` (§3.12).

  A collapsible section, a count badge on the dark sidebar, and a header search control with a shortcut hint are not defined. The UI-SPEC proposes them as CSRM extensions, recorded in the direction by a plan task before use (the Phase 10 X-1 to X-5 precedent).
- **The layout** (`app/(app)/layout.tsx:8-33`) awaits the session and capabilities, then renders `AppShell` (`app-shell.tsx:8-37`), a Server Component with the skip link, sidebar, header and `main#main-content`. Phase 10 wraps it in `TimeZoneProvider` (10-01) and `NavigationGuardProvider` (10-08).

### Home (UX-08; UAT-001, UAT-003, UAT-004)

- **`/app`** renders `RequestorDashboard` for every actor (`app/(app)/app/page.tsx:1-50`; heading `title="Dashboard"` at line 39; action "Create request" at line 41; metadata `Dashboard | IdamBox CSRM` at line 9). The analyst's own requests show there, and their review work does not (UAT-001).
- **The analyst dashboard** at `/app/review` (`app/(app)/app/review/(analyst-dashboard)/page.tsx:26-61`):
  - checks `can('assessment:review', granted)` before `getAnalystDashboard()`, which makes five parallel reads (`analyst-dashboard-service.ts:153-193`);
  - resolves the guarded fixtures only after the real reads succeed;
  - has its own `loading.tsx` and `error.tsx` inside the route group, so the review queues never flash its skeleton.
- **The Requestor dashboard's reads** [VERIFIED: `requestor-dashboard-service.ts:156-171`]: six, run in parallel:
  - `listDashboardRequests(status=draft, pageSize 50)`;
  - `listMyQuestionnaires()`, a page of 50;
  - `getMyQuestionnaireSummary()`;
  - `listMyReleasedAssessments()`, a page of 25;
  - `getMyAssessmentRatingSummary()`;
  - `getMyRequestStatusSummary()`, one owner-scoped group-by (Phase 7).

  The "seven extra list reads" note in `.planning/workstreams/csrm/milestones/v1.0-STATE.md:718` is stale: `MILESTONES.md:121` records the replacement.
- **The tiles that misled** (UAT-003, UAT-004): `RequestLifecycleWidget` (`requestor-dashboard.tsx:201-234`) renders seven stored-status tiles first in the grid (lines 260-281), one per row below `sm`.
- **The lifecycle's `actor` is the viewer, not the holder** [VERIFIED: `apps/backend/src/api/csrm-assessment-request/services/request-lifecycle.ts:41-62,77`]. `projectRequestLifecycle` sets `actor` from `requestActorFacts(state).analyst`. `actionFor` returns `waiting = "The work is waiting with the other party."` (line 49) whenever the step is not the viewer's.
  - The steps: `draft`, `submitted`, `questionnaire-generated`, `questionnaire-released`, `questionnaire-submitted`, `assessment-drafted`, `assessment-reviewed`, `assessment-released` (lines 13-18).
  - The holder by step:
    - requestor: draft and questionnaire-released;
    - analyst: submitted, questionnaire-generated, questionnaire-submitted, assessment-drafted and assessment-reviewed;
    - none: assessment-released and closed.
- **The Requestor's list reads** (`request-service.ts:56-107`) use the core `GET /csrm-assessment-requests` (owner-scoped, `_q` matching the title or number, `collection-scope.ts:155-164`). They do not project a lifecycle per item: only `findOne` does (`csrm-assessment-request.ts` controller, `findOne` at lines 112-139, through `REQUEST_RELATIONSHIP_POPULATE`, `relationship-scope.ts:30-34`).
- **The reserved operation** [VERIFIED: the catalogue and `served-operations.json`]: `GET:/api/v1/my_requests` is FunctionApi `function.risk_assessment_requests.my_requests.api.01`, "List My Assessment Requests: Returns the signed-in Requestor's assessment requests with filtering, sorting, and pagination", under Function `function.risk_assessment_requests.my_requests` (menuPath `Risk Assessment Requests:My Requests`, roleIds `role.requestor`). It is unserved with the reason "reserved request alias: served by the owner-scoped core route GET /api/csrm-assessment-requests". The status summary precedent: `routes/my-request-status-summary.ts:1-31` (its own router, `requireRequestCollectionScope`) and `controllers/my-request-status-summary.ts:35-44` (it refuses any query key and counts only the owner's requests).
- **The policy's owner scope** [VERIFIED: `apps/backend/src/policies/csrm-authorization.ts:388-391`]: `requireRequestCollectionScope` sets `assessmentRequestCollectionScope: "own"` with the caller's numeric `requestorId`, for any actor holding the operation.
- **The guarded fixtures** [VERIFIED: `apps/csrm/src/lib/testing/e2e-ui-state.ts:22-42`]: `__e2eState` (populated, loading, empty, error, permission) and `__e2ePartial`, which is `'draft-requests-error'` for the Requestor dashboard and `'analyst-top-alerts-error'` for the analyst.
- **Recovery copy** [VERIFIED: `apps/csrm/src/components/states/states.tsx:132`]: the default action is "Return to workspace". Twenty-five occurrences of "Return to workspace" exist across `apps/csrm/src` and `apps/csrm/e2e`, including `app/(app)/not-found.tsx:19`, `app/not-found.tsx:27`, `src/features/risks/risk-details.tsx:164` and `app/(app)/app/review/requests/error.tsx:9` ("Back to workspace").

### Stepper (UX-08 criterion 3; UAT-038)

- **Layout** [VERIFIED: `apps/csrm/src/features/requests/request-lifecycle-stepper.tsx:32-64`]: an `h2` "Current lifecycle state: {label}", then an `ol` in `grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8`, so the eight steps stack in one column below 640px (the 880px block UAT-038 measured).
- **The Next action line** lives in the hub (`request-hub.tsx:82`), after a six-row `dl`.
- **Page order:** the Requestor page (`app/(app)/app/requests/[documentId]/page.tsx:58-61`) and the analyst hub (`assessment-detail.tsx`, around line 76) render the stepper and then the hub.
- **Phase 10 touches the hub:** 10-04 changes its copy and dates, and 10-14 adds `nextActionOverride`, set while a generation job is queued or running.
- **E2E assertions:**
  - the heading `Current lifecycle state: …`: `assessment-navigation-lifecycle.spec.ts:61,197` and `questionnaire-governance-workflow.spec.ts:112,142,156,198`;
  - `/^Next action:/` at 375px: `request-relationship-states.spec.ts:152`;
  - `/^Next action:/` at 1440px: `questionnaire-governance-workflow.spec.ts:113,157`.

### Lists (UX-09 criterion 1; UAT-035; the UAT-048 picker)

- **Review queue projection** [VERIFIED: `apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts:336-344`]: `{ documentId, requestNumber, title, requestStatus, submittedDate }`, hydrated with `REVIEW_QUEUE_ITEM_FIELDS = ["documentId", "requestNumber", "title", "requestStatus", "submittedDate"]` (`review-queue-repository.ts:39`) and no populate (`hydrate`, lines 233-249).
  - **Buckets:** `REVIEW_QUEUE_BUCKETS = ["requires-attention", "awaiting-requestor", "generation-in-progress", "released"]` (`collection-scope.ts:54-59`).
  - **Statuses:** `REVIEWABLE_REQUEST_STATUSES = ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review"]` and `RELEASED_REQUEST_STATUSES = ["approved", "closed"]` (lines 45-52).
  - **Filters:** `safeReviewFilters` accepts exactly `["requestStatus", "title", "requestNumber", "dueDate", "queue"]` (line 228). The title and the request number are separate, ANDed `LIKE` filters (`review-queue-repository.ts:174-186`).
  - **Sort fields:** `dueDate`, `submittedDate`, `requestNumber`, `title`, `requestStatus` and `updatedAt` (`collection-scope.ts:64-71`).
- **Request content type** [VERIFIED: `apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json`]:
  - `requestor`: manyToOne to `idambox-user`;
  - `assessmentType`: enum `["BAU","Project","Other"]`;
  - `businessCriticality`: enum `["Low","Moderate","High","Critical"]`;
  - `dueDate`: date;
  - `submittedDate`: datetime.
- **Web queue** [VERIFIED: `apps/csrm/src/features/assessments/assessment-list.tsx:103-129`]:
  - columns Request, Title, Status and Submitted;
  - the Submitted date is formatted in UTC (lines 31-35);
  - the search box sends `filters[title]` only (`assessment-service.ts:333`), so the number cannot be searched;
  - the queue select offers the four buckets (lines 83-98).
- **Risk Assessment list** [VERIFIED: `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts:101-137,197-208`]:
  - query keys `["q", "status", "sort", "page", "pageSize"]`;
  - `q` → `{ $or: [{ assessmentNumber: { $containsi: q } }, { summary: { $containsi: q } }] }` (line 116);
  - the data query already populates `assessmentRequest` with its `requestor`;
  - the projection `{ documentId, assessmentNumber, assessmentStatus, summary, overallRating, generatedDate, generatedBy, approvalDate }`;
  - both the analyst list (controller `listAssessments`, lines 139-144) and the owner list (`listMyReleasedAssessments`, lines 232-242) use `projectAssessmentSummary`.
  - **Web columns:** Assessment, Summary, Status and Draft initiated by (`assessment-list.tsx:131-155`).
- **Related assessment picker** [VERIFIED: `apps/csrm/src/features/risks/risk-actions.ts:72-83`, `risk-service.ts:83-85`, `risk-schema.ts:303-316`]: `listRiskRegisterAssessments()` reads `GET /v1/risk_assessments` with no query (the default page of 25). The action then filters the labels, which are `assessmentNumber` only, by `includes(needle)`, so "payroll" finds nothing, and assessments past the first 25 cannot be found (UAT-048).

### Figures (UX-09 criterion 2; UAT-048)

- **Reports KPI tiles** [VERIFIED: `apps/csrm/src/features/reports/report-presentation.ts:112-140`]:
  - risk exposure links three tiles to the Risk Register;
  - treatment performance links Overdue to the alerts, and leaves "Due within {window}" and "No target date" plain;
  - throughput has two plain tiles;
  - control effectiveness links "Rated Ineffective" to the alerts and leaves the total plain.
- **Report tables** carry no links: `ReportTableRow = { key, label, values }` (line 25), and `exposedSystemRows` (lines 202-204) links no system.
- **The analyst dashboard's figures link** (`analyst-dashboard-presentation.ts:80-119, 261-288, 332-345`), with two exceptions: the "Not rated" exposure row, because "the register has no 'not rated' filter" (lines 300 and 343), and the High and Critical footer, which opens every open Risk sorted (line 183-184).
- **The Requestor dashboard's figures:** the released count and the rating chips link nowhere (`requestor-dashboard.tsx:132-156`).
- **Risk Register filters** [VERIFIED: `apps/backend/src/api/csrm-risk/services/risk-register-query.ts:3-7,21-35,54-60`]:
  - ratings `["Low", "Moderate", "High", "Critical"]`;
  - treatment statuses `["Not Started", "In Progress", "Overdue", "Complete"]`;
  - mitigation statuses `["Existing", "Planned", "Implemented", "Retired", "none"]`;
  - states `["open", "closed"]`;
  - allowed keys `q`, `treatmentStatus`, `inherentRating`, `residualRating`, `riskOwner`, `treatmentOwner`, `assessment`, `system`, `asset`, `mitigationStatus`, `state`, `targetDateFrom`, `targetDateTo`, `sort`, `page` and `pageSize`.

  Rows carry a server-derived `treatmentDueState` (`risk-register.ts:36-48`), and the web already holds the vocabulary `riskTreatmentDueStates = ['overdue', 'due-soon', 'later', 'no-target-date', 'complete-or-closed']` (`apps/csrm/src/features/risks/risk-domain.ts:17`).
- **Due windows** [VERIFIED: `apps/backend/src/csrm/insights/insight-constants.ts:11,14`]: `ALERT_DUE_SOON_WINDOW_DAYS = 14` and `TREATMENT_REPORT_DUE_WINDOW_DAYS = 30`. The single rule, `deriveTreatmentDueState(facts, today, windowDays = ALERT_DUE_SOON_WINDOW_DAYS)` (`treatment-due-state.ts:54-69`), returns `"overdue" | "due-soon" | "later" | "no-target-date" | "complete-or-closed"`.

### Exposure (DASH-03; UAT-060)

- **Dashboard** [VERIFIED: `apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts:147-154,208-250`]: `openContextualRisks = applyDisclosableParent(...).whereRaw("r.closure_date IS NULL")`. Exposure is `countDistinct` grouped by `residual_rating`; High and Critical is the same scope with `residual_rating IN ('Critical','High')`.
- **Report** [VERIFIED: `report-repository.ts:161-164,251-300`]: the same scope for every exposure section; the exposed systems join `csrm_risks_information_system_impacted_lnk`.
- **The Risk Register scope** [VERIFIED: `apps/backend/src/api/csrm-risk/services/risk-register.ts:137-164`]: `EXISTS` on `csrm_risks_assessment_lnk` joined to `csrm_assessments`, where the parent is either:
  - **mutable:** `assessment_status IN ('draft','in-review') AND approval_date IS NULL AND NOT EXISTS approved_by link`; or
  - **released:** `assessment_status = 'approved' AND approval_date IS NOT NULL AND EXISTS approved_by link`.

  The two branches are disjoint, because the status sets differ.
- **Treatment action** [VERIFIED: `apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json`]: an enumeration `["Accept","Treat"]`. The seeds set `"Treat"` (`seed-analyst-insights.ts:234`).
- **Seeded fixtures for browser proofs** (`seed-analyst-insights.ts:184-297`):
  - an in-review assessment with Risks overdue (High), due soon (Moderate), critical (Critical, untreated) and closed (High, closed);
  - a released assessment with one Critical Risk in treatment.

### Released label (UAT-065)

- **The two maps** [VERIFIED]: `status-badge.tsx:72` `approved: { icon: CircleCheckIcon, label: 'Approved', tone: 'success' }` and `request-domain.ts:29` `approved: { label: 'Approved', order: 5 }`. `CONTEXT.md` (the root glossary) states that the request-status label `Approved` is unchanged.
- **Tests on the old label:**
  - unit: `status-badge.test.tsx:62,234`, `feedback-composites.test.tsx:49`, `assessment-list.test.tsx:68,171,183,236`, `assessment-status-filters.test.tsx:177`, `requestor-dashboard.test.tsx:157,240`, `report-presentation.test.ts:304` and `report-views.test.tsx:524`;
  - E2E: `assessment-navigation-lifecycle.spec.ts:253,259,288`.

### Quick find (UX-10; G-5)

- **The shadcn wrapper** [VERIFIED: `apps/csrm/src/components/ui/command.tsx`]: it imports `Command as CommandPrimitive` from `cmdk` and exports `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut` and `CommandSeparator`.
  - `CommandDialog` (lines 32-61) renders `<DialogHeader className="sr-only"><DialogTitle>{title}</DialogTitle>…</DialogHeader>` as a sibling before `<DialogContent>`, outside the portalled content. Its defaults are the title "Command Palette" and the description "Search for a command to run...".
  - Nothing in `src` or `app` imports it.
- **cmdk 1.1.1's ARIA and keyboard handling** [VERIFIED: `apps/csrm/node_modules/cmdk/dist/index.mjs`, grep]:
  - `role:"combobox"`, `"aria-autocomplete":"list"`, `"aria-expanded":!0` and `"aria-activedescendant"` on the input;
  - `role:"listbox"`, `role:"group"` and `role:"option"` with `"aria-selected"`;
  - the key cases `ArrowDown`, `ArrowUp`, `Home`, `End` and `Enter`, plus `j`, `k`, `n` and `p` under `vimBindings` (default `!0`, true);
  - the `shouldFilter` prop.
- **The existing list searches** [VERIFIED: the files cited]:
  - owner requests `_q`, title or number (`collection-scope.ts:155-164`);
  - review queue `filters[title]` and `filters[requestNumber]`, ANDed (`review-queue-repository.ts:174-186`);
  - questionnaires `q`, title or `questionnaireNumber` (`questionnaire-scope.ts:111`);
  - Risk Assessments `q`, number or summary (`assessment-scope.ts:116`);
  - Risks `q`, `risk_number` or `risk_statement` (`risk-register.ts:335-340`);
  - Requestors have no Risk read until Phase 20.
- **Sequential dispatch** [VERIFIED: Next 16.3.6 bundled docs, `02-guides/server-actions.md` "Sequential dispatch on the client"]: "Next.js dispatches Server Actions one at a time per client … do not rely on `Promise.all` to parallelize Server Actions from the client. If you need parallel work, do it inside a single Server Action."
- **Server Action security** [VERIFIED: same doc, "Security"]: an action is a public POST, so it must validate input and authenticate.
- **The chain guard's inventory** [VERIFIED: `docs/references/served-operations.json` rows; `contract-operation-chain.test.ts:1-60`] records, per served operation, the `webCallers` files that call the client. Calling existing service functions from a new module leaves that inventory unchanged.
- **Route budget** [VERIFIED: `apps/csrm/e2e/performance.spec.ts:55`]: `PERFORMANCE_BUDGETS = { deliveredJsBytes: 300_000, … }`. The heaviest routes already use 81 to 91% of it (R-08-34).

### Copy and time (the Phase 10 deferrals)

- **"contextual" in this phase's surfaces** [VERIFIED: grep]:
  - `analyst-dashboard-presentation.ts:171,173,325`;
  - `report-presentation.ts:117,336,351,359,371,377,400,406`;
  - `report-copy.json:5,23`;
  - `apps/backend/src/api/csrm-analyst-insight/services/report-definitions.ts:24,39`;
  - `app/(app)/app/risks/page.tsx:13`. The Risk Register description is in the page, not in `features/risks/risk-register.tsx` as Phase 10's UI-SPEC §17.2 says.

  The administration, assessment editor, control implementation editor, request form and generation job strings belong to Phase 10.
- **UTC instants on this phase's surfaces** [VERIFIED: grep for `timeZone: 'UTC'`]:
  - `assessment-list.tsx:33` (queue Submitted);
  - `analyst-dashboard-presentation.ts:36` (Recent activity);
  - `request-domain.ts:144-155` `formatRequestDate`, used for `updatedDateLabel` in `request-schema.ts:250` and for the dashboard's `approvalDateLabel` and `updatedDateLabel` (`requestor-dashboard-service.ts:99,108`);
  - `released-assessment.tsx:35,41,57`: the list's "Released" column. Phase 10's 10-15 moves only the detail's instants.

  **Calendar dates, which stay:** `alert-presentation.ts:47,98` (`${value}T00:00:00.000Z`); the reports' `asAtLabel` and month formats (`report-presentation.ts:44-84`), which read the server's UTC `today` and its month buckets; `risk-domain.ts:54`; `mitigation-control-list.tsx:213`; `risk-details.tsx:236`.

## Contract changes (proposed shapes; the planner confirms the names)

All six follow D-02's chain. The spec schemas named are in `docs/references/specification.json` [VERIFIED: read with `node`].

| # | Operation | Request change | Response change | Strapi files | Web files | Proofs |
|---|---|---|---|---|---|---|
| C1 | `GET /v1/assessment_requests` (`assessment-workflow/get-assessment-request-queue`) | `filters[queue]` enum gains `all`; new `filters[q]` (1-200 characters, number OR title, `LIKE` escaped as `literalContains`) | `AssessmentRequestQueueItem` gains `requestorName: string\|null`, `assessmentType: 'BAU'\|'Project'\|'Other'\|null`, `businessCriticality: 'Low'\|'Moderate'\|'High'\|'Critical'\|null`, `dueDate: date\|null` and `daysSinceSubmission: integer≥0\|null` (`additionalProperties: false` stays) | `collection-scope.ts` (buckets, statuses for `all`, `safeReviewFilters` + `q`, projection with `today`); `review-queue-repository.ts` (`applyBucket('all')` adds no predicate; `q`; hydrate populates `requestor` with `displayName`); the controller passes `utcToday(new Date())` | `assessment-schema.ts` (`assessmentRequestQueueItemSchema`), `assessment-service.ts` (query schema: queue + `all`, `q`), `assessment-list.tsx` (columns, cards, sorting, queue option) | `review-queue.unit.test.ts` (parser); `review-queue-buckets.integration.test.ts` (`all` = the union with no draft; `q` finds by number and by title; projection; days since submission against a fixed today); parity guard; matrix row unchanged (same route) |
| C2 | `GET /v1/risk_assessments` and `GET /v1/my_risk_assessments` | `q` also matches `assessmentRequest.title`; new `overallRating` (`AssessmentRating`), `approvedFrom` and `approvedTo` (`YYYY-MM-DD`, inclusive, UTC) | `AssessmentSummary` gains `requestTitle: string\|null`, `riskCount: integer≥0` and `highestResidualRating: AssessmentRating\|null` | `assessment-scope.ts` (`assertCollectionKeys`, predicates, projection); the controller (one grouped knex aggregate over `csrm_risks_assessment_lnk` ⋈ `csrm_risks` for the page's ids: `COUNT`, `MAX(CASE residual_rating …)`) | `assessment-schema.ts` (`assessmentSummarySchema`, which `releasedAssessmentSummarySchema` extends), `assessment-service.ts` (query schema, params), `assessment-list.tsx`, `released-assessment.tsx` (request title; the list's released date through `LocalInstant`), `risk-service.ts`, `risk-actions.ts` and `risk-schema.ts` (the picker) | `assessment-workflow.integration.test.ts` (projection, both lists; request-title search; filters; owner isolation unchanged); `assessment-service.test.ts`; parity |
| C3 | `GET /v1/risks` (`risk-register/get-risks`) | New `stage` (`released`\|`under-assessment`), `treatmentAction` (`Accept`\|`Treat`), `dueState` (the five D-04 states, 14-day window, the list's UTC today) and `mitigationEffectiveness` (`Effective`\|`Partially Effective`\|`Ineffective`\|`Not Assessed`\|`none`); `mitigationStatus` gains `any`; "none" for `residualRating`, `inherentRating` and `treatmentStatus`; "no impacted system" as a closed value or flag (a documentId pattern `[A-Za-z0-9_-]+` would accept the literal `none`, so the planner avoids the collision; see Pitfall 21) | `RiskRegisterItem` gains `stage: 'released'\|'under-assessment'` and `treatmentAction: 'Accept'\|'Treat'\|null` | `risk-register-query.ts` (vocabularies, parser); `risk-register.ts` (`applyReleasedParent` and `applyUnderAssessmentParent` as the two named branches of `applyDisclosableParent`; the predicates; the projection from the populated assessment) | `risk-domain.ts` (zod-free vocabularies), `risk-schema.ts` (query, serializer, item), `risk-register-filters.tsx` (controls and chips), `risk-register.tsx` (row markers), `app/(app)/app/risks/page.tsx` (description) | `risk-register.unit.test.ts` (parser, including a refused `none` pattern); `risk-register.integration.test.ts` (each predicate on fixtures; `dueState` equals `deriveTreatmentDueState` for every fixture; stage partitions: released + under assessment = the scope, and they are disjoint); web schema and filter tests |
| C4 | `GET /v1/dashboard/summary` and `GET /v1/reports/{reportKey}` | none (the report query stays closed: `period` only) | `DashboardSummary.riskExposure` becomes `{ released: RatingCounts, releasedAccepted: RatingCounts, underAssessment: RatingCounts }`; `DashboardHighCriticalRisks` counts released Risks only; `RiskExposureReport` sections count released Risks and it gains `acceptedByResidualRating: RatingCounts` and `underAssessment: { byResidualRating: RatingCounts }`; `TreatmentPerformanceReport.dueWindowDays` stays a field, and its value becomes 14 | `dashboard-summary.ts`, `report-repository.ts`, `insight-constants.ts` (`TREATMENT_REPORT_DUE_WINDOW_DAYS` = `ALERT_DUE_SOON_WINDOW_DAYS`), `report-definitions.ts` (copy); `seed-analyst-insights.ts` (one accepted released Risk) | `analyst-dashboard-schema.ts`, `analyst-dashboard-presentation.ts`, `analyst-dashboard.tsx`, `report-schema.ts`, `report-presentation.ts`, `risk-exposure-report.tsx`, `treatment-performance-report.tsx`, `report-copy.json` | `analyst-dashboard.integration.test.ts` and `analyst-reports.integration.test.ts` (released vs under assessment on fixtures; accepted; the window at 14 with the boundary fixture moved to today+14; each figure equal to its Risk Register or alert list total); `analyst-insights.unit.test.ts:166` (the constant); web presentation, schema and view tests; parity |
| C5 | Request lifecycle (in `GET /csrm-assessment-requests/{id}`, and in the C6 items) | none | `AssessmentRequestLifecycleNextAction` gains required `holder: 'requestor'\|'analyst'\|'none'`; the `summary` strings name the holder | `request-lifecycle.ts` (the holder per step; copy) | `request-schema.ts` (`requestLifecycleSchema`), `request-domain.ts` (types), `request-hub.tsx`, `request-lifecycle-stepper.tsx` | `request-lifecycle.unit.test.ts` (the holder for each step and actor; no "other party"); `request-workflow.integration.test.ts:327-328`; `request-hub.test.tsx:86-88`; `request-lifecycle-stepper.test.tsx:46` |
| C6 | NEW served `GET /v1/my_requests`, and `GET /v1/my_requests/status_summary` | `my_requests`: `q` (title or number), `status` (`CsrmRequestStatus`), `holder` (`requestor`\|`analyst`\|`none`), `sort` (today's My requests sort values), `page`, `pageSize` (10, 20 or 50); the status summary still takes no query | New `MyRequestListResponse { data: MyRequestItem[], meta: { pagination } }`. `MyRequestItem` is `{ documentId, requestNumber, title, requestStatus, submittedDate, dueDate, updatedAt, daysSinceSubmission, holder, stage: { key, label }, nextAction: { summary, href? } \| null, returned: { reason, at } \| null, questionnaire: { documentId, answered, total } \| null }`. `MyRequestStatusSummary` gains `byHolder: { requestor, analyst, none }` | new `services/my-requests.ts` (the owner predicate on `csrm_assessment_requests_requestor_lnk`; the holder predicate reusing the review queue's facts; hydrate with `REQUEST_RELATIONSHIP_POPULATE`; project with `projectRequestLifecycle`), `controllers/my-requests.ts`, `routes/my-requests.ts` (its own router, `requireRequestCollectionScope`), `operations.ts`; `request-status-summary.ts` (holder counts); both catalogue copies (design note 9); `served-operations.json`; the matrix | `request-service.ts` (`listMyRequests`; the status summary parser), `request-schema.ts` (closed parser registered in parity), `request-domain.ts`, `app/(app)/app/requests/page.tsx`, `request-table.tsx`, the Home | new `my-requests.integration.test.ts` (owner isolation per actor; holder equals `deriveRequestLifecycle` for fixtures at every step; search, status, holder, sort and pagination; the analyst's own list reads from the Requestor's side); `request-status-summary.integration.test.ts` (`byHolder`); `authorization-matrix.integration.test.ts` (new row: every identity 200, own rows only); `served-operations.integration.test.ts`; `contract-catalogue.integration.test.ts` |

## Where Phase 10 touches the same files

Build on Phase 10's version of each (D-04). A Phase 11 plan reads the Phase 10 SUMMARY for the file before editing.

| File | Phase 10 plans | Phase 11 change |
|---|---|---|
| `apps/csrm/src/components/shell/app-shell.tsx` | 10-01 (`TimeZoneProvider`, `ViewerTimeZoneSync`), 10-08 (`NavigationGuardProvider`) | The profile, the count promise prop and the quick-find control |
| `apps/csrm/app/(app)/layout.tsx` | 10-01 (`readViewerTimeZone`) | Starts the count reads |
| `apps/csrm/src/components/shell/capability-navigation.tsx` | 10-08 (`onNavigate` through the guard; the sheet closes after the guard allows) | Sections, the button, the collapsible section and the badges |
| `apps/csrm/src/components/csrm/navigation-guard.tsx` | 10-08 (new: provider, `useLeaveGuard`, `GuardedLink`) | A programmatic navigation entry point for quick find (D-51) |
| `apps/csrm/src/features/requests/request-hub.tsx` | 10-04 (copy and dates), 10-14 (`nextActionOverride`) | Holder wording; the phone presentation of the next action |
| `apps/csrm/src/features/assessments/assessment-detail.tsx` | 10-02, 10-04, 10-12, 10-14 | Passes the override to the compact stepper |
| `apps/csrm/app/(app)/app/requests/[documentId]/page.tsx` | 10-04 | Compact stepper props |
| `apps/csrm/src/features/requests/request-domain.ts` | 10-04 and 10-12 (predicates) | The `approved` label; lifecycle and holder types |
| `apps/csrm/src/features/assessments/assessment-schema.ts` and `assessment-service.ts` | 10-13, 10-15, 10-18, 10-20 | Queue item and summary schemas; list params |
| `apps/csrm/src/features/assessments/released-assessment.tsx` | 10-02, 10-15 (the detail's instants) | The list's released date and the request title |
| `apps/csrm/src/components/states/states.tsx`, `src/features/risks/risk-details.tsx` | 10-02, 10-20, 10-21 | Recovery copy (D-25) |
| `apps/csrm/src/lib/performance/interface-copy-guard.test.ts` | 10-02 creates it; later Phase 10 plans extend it | Adds the dashboard, report, Risk Register and navigation files; drops the Phase 11 exclusions |
| `apps/csrm/src/features/contract-response-parity.test.ts` | 10-09, 10-15 | New and changed parsers |
| `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts` | 10-06, 10-10, 10-11, 10-13, 10-15, 10-16, 10-18 | C1 to C6 |
| Both catalogue copies, `served-operations.json`, `authorization-matrix.ts` | 10-13 | C6 |
| `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts` and the assessment controller | 10-15, 10-18 | C2 |
| `docs/design/csrm-design-direction.md` | 10-01 (X-1 to X-5) | Phase 11's accepted extensions (plan 11-01) |
| E2E specs: `questionnaire-workflow`, `assessment-release-workflow`, `requestor-request-workflow`, `request-relationship-states`, `questionnaire-governance-workflow`, `questionnaire-generation-workflow`, `administration-workflow`, `risk-register-workflow`, `performance` | many Phase 10 plans | See "E2E and copy assertions that change" |

Files only Phase 11 changes (Phase 10 lists none of them):
- `navigation.ts`, `request-lifecycle-stepper.tsx`, `status-badge.tsx` and `request-table.tsx`;
- the `features/dashboard/*`, `features/analyst-dashboard/*`, `features/reports/*` and `features/risks/*` register files;
- Strapi `collection-scope.ts`, `review-queue-repository.ts`, `dashboard-summary.ts`, `report-repository.ts`, `report-definitions.ts`, `insight-constants.ts`, `risk-register-query.ts`, `risk-register.ts`, `request-lifecycle.ts` and `request-status-summary.ts`, and the new `my-requests` files;
- `e2e/helpers/navigation.ts`, `e2e/analyst-insights.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/production-hardening.spec.ts`, `e2e/design-contract.spec.ts`, `e2e/design-system-conformance.spec.ts` and `e2e/app-shell.spec.ts`;
- the root `CONTEXT.md` and `next.config.ts`.

## Architecture Patterns

### System Architecture Diagram

```
 Browser                                                          Keyboard: Ctrl+K / ⌘K, or the header "Search" control
   │ GET /app/review ─▶ next.config redirects() ─▶ 307 Location: /app (query kept)        │
   │ GET /app/...                                                                          ▼
   ▼                                                                    QuickFindTrigger (client, in the header)
 proxy.ts (per-request CSP nonce)                                          │ first open: next/dynamic loads the dialog body
   │                                                                       ▼
   ▼                                                                    QuickFindDialog (Radix Dialog + cmdk Command,
 app/(app)/layout.tsx                                                     shouldFilter=false, vimBindings=false)
   │ session (cookie) ─▶ capabilities (no Strapi read)                     │ term ≥ 2 chars, debounced, one in flight
   │ start count reads (not awaited) ───────────────────────┐              ▼
   ▼                                                        │           quickFindAction ('use server', zod term)
 AppShell (RSC): profile = navigationProfileFor(granted)    │              │ Promise.all over EXISTING service functions,
   │                                                        │              │ 5 per list, lists chosen by capability
   ├─▶ CapabilityNavigation (client) ◀── use(countsPromise) ┘              ▼
   │      sections · New request button · own section (collapsed)   Strapi list reads (each scoped by policy):
   │      every link through Phase 10's navigation guard              my_requests · my_questionnaires · my_risk_assessments
   ▼                                                                   (Requestor) / assessment_requests?queue=all&q ·
 /app page: can('assessment:review')?                                  questionnaires · risk_assessments · risks (analyst)
   │ yes ─▶ AnalystHome: dashboard summary + alert reads (existing, analyst-only)
   │ no  ─▶ RequestorHome: my_requests?holder=requestor | holder=analyst + released list + rating summary
   ▼
 Strapi policies: exact grants + scope (own | analyst review | analyst insight | risk register)
   ▼
 SQL predicates (one definition each):
   holder      ← review-queue lifecycle facts (released/submitted questionnaire, assessment exists/released) + owner link
   stage       ← applyDisclosableParent's two branches (mutable ⇒ under assessment, release triple ⇒ released)
   due state   ← deriveTreatmentDueState mirrored in SQL (14-day window everywhere, D-38)
   ▼
 Projections: queue item (+requestor, type, criticality, due, days since submission) · assessment summary
 (+request title, risk count, highest residual) · register row (+stage, treatment action) · my-request item
 (+holder, stage, next action) · exposure {released, releasedAccepted, underAssessment}
```

### Recommended Project Structure (additions and moves only)

```
apps/csrm/
├── next.config.ts                                   # + redirects(): /app/review → /app (307)
├── app/(app)/layout.tsx                             # starts navigation counts (Phase 10 zone read stays)
├── app/(app)/app/page.tsx                           # Home: picks the variant before any read
├── app/(app)/app/review/(analyst-dashboard)/        # retired (page, loading, error move to Home)
└── src/
    ├── config/navigation/navigation.ts              # profiles, sections, items, activeNavigationHref
    ├── config/navigation/page-headings.ts           # recommended: one heading string per page, read by the nav label,
    │                                                #   the PageHeader title and the route title, so label = heading by construction
    ├── components/shell/capability-navigation.tsx   # sections, primary action, collapsible section, badges, drawer
    ├── components/shell/navigation-counts.ts        # 'server-only': starts the bounded reads, returns one promise
    ├── components/shell/quick-find-trigger.tsx      # 'use client': header control, shortcut, lazy dialog
    ├── features/home/                                # analyst-home.tsx (wraps features/analyst-dashboard), requestor-home.tsx,
    │                                                #   home-page-header.tsx, own-requests-panel.tsx
    ├── features/quick-find/                          # quick-find-actions.ts ('use server'), quick-find-dialog.tsx ('use client'),
    │                                                #   quick-find-domain.ts (zod-free kinds, hrefs, labels)
    └── features/requests/                            # listMyRequests + parser in request-service/request-schema;
                                                     #   request-lifecycle-stepper.tsx compact variant
apps/backend/src/api/
├── csrm-assessment-request/services/my-requests.ts       # owner + holder SQL; hydrate; project
├── csrm-assessment-request/controllers/my-requests.ts
├── csrm-assessment-request/routes/my-requests.ts         # own router (as my-request-status-summary.ts)
├── csrm-assessment-request/services/review-queue-repository.ts  # export the lifecycle facts for reuse; `all`; `q`
└── csrm-risk/services/risk-register.ts                   # applyReleasedParent / applyUnderAssessmentParent beside applyDisclosableParent
```

### Pattern 1: Navigation profiles as data (D-06 to D-13)

**What:** one profile per actor, as ordered sections of capability-gated items. The view renders whatever the profile holds.
**When to use:** always. A later phase changes data, not components (D-13).
**Example** (a sketch: the names are proposals; the capability values are quoted from `capability-adapter.ts:1`: `'assessment-request:create','assessment-request:read','assessment:review','risk:manage','administration:manage'`):

```typescript
// apps/csrm/src/config/navigation/navigation.ts (sketch)
export type NavigationCountKey = 'myRequestsNeedingAction' | 'questionnairesToAnswer' | 'requestsRequiringAttention' | 'overdueAlerts';
export interface NavigationItem { href: string; label: string; capability: Capability; icon: LucideIcon; count?: NavigationCountKey }
export interface NavigationSection {
  id: string;
  label: string | null;                 // null: the unlabelled top section (Home)
  collapsible?: { defaultCollapsed: boolean };
  items: readonly NavigationItem[];
}
export interface NavigationProfile {
  primaryAction?: { href: string; label: string; capability: Capability };   // the Requestor's New request button
  sections: readonly NavigationSection[];
}
export function navigationProfileFor(granted: ReadonlySet<Capability>): NavigationProfile {
  return can('assessment:review', granted) ? analystProfile : requestorProfile;
}
```

`activeNavigationHref(pathname, items)` keeps its contract. It receives every visible item of the profile, collapsed sections included, so `/app/requests/{id}` marks the analyst's My requests current. The section then opens itself (D-08).

### Pattern 2: Streaming counts from the layout (D-10, D-11)

**What:** the layout starts the reads without awaiting them. `AppShell` passes the promise down, and a small client component reads it with `use()` inside `<Suspense fallback={null}>`.
**Why:** "On navigation, layouts preserve state, remain interactive, and do not rerender" [VERIFIED: Next 16.3.6 docs, `01-getting-started/03-layouts-and-pages.md:43`]. Awaiting in the layout would delay every full render, and the counts must never block a page.
**Source:** "You can use React's `use` API to stream data from the server to client … pass the promise to your Client Component as prop" [VERIFIED: `01-getting-started/06-fetching-data.md:241-315`].

```typescript
// apps/csrm/src/components/shell/navigation-counts.ts (sketch, 'server-only')
export type NavigationCounts = Partial<Record<NavigationCountKey, number>>;
export function loadNavigationCounts(granted: ReadonlySet<Capability>): Promise<NavigationCounts> {
  // Each read settles to a number or undefined: a refusal or failure hides that badge, never zeroes it.
  // Reads go through EXISTING service functions only (webCallers unchanged): getMyRequestStatusSummary,
  // getMyQuestionnaireSummary, a one-row page of listAssessmentRequests (a new function in
  // assessment-service.ts), getAlertSummary.
}
```

```tsx
// in capability-navigation.tsx (sketch, 'use client')
function ItemBadge({ counts, countKey }: { counts: Promise<NavigationCounts>; countKey: NavigationCountKey }) {
  const value = use(counts)[countKey];
  return value && value > 0 ? <span className="…">{value}<span className="sr-only">{/* "need attention" per the UI-SPEC */}</span></span> : null;
}
// …<Suspense fallback={null}><ItemBadge counts={counts} countKey={item.count} /></Suspense>
```

A Server Action that calls `revalidatePath` re-renders the current route, and the response "contains … a newly rendered RSC Payload for the current route" [VERIFIED: `02-guides/server-actions.md` "A single response carries data and UI"]. Whether that payload re-runs the layout, and so refreshes the counts, is [ASSUMED] (A2). An E2E proof in plan 11-10 settles it: submit a draft, and the My requests badge drops.

### Pattern 3: Home chooses its variant before any read (D-16, D-23)

```tsx
// app/(app)/app/page.tsx (sketch)
export const metadata = { title: 'Home | IdamBox CSRM' };
export default async function HomePage({ searchParams }: HomePageProps) {
  const adapter = getSessionAdapter();
  const session = await adapter.current();                        // cookie only, no Strapi read
  const granted = session ? await adapter.capabilitiesFor(session).granted() : new Set<Capability>();
  const analyst = can('assessment:review', granted);
  return (
    <>
      <HomePageHeader variant={analyst ? 'analyst' : 'requestor'} />   {/* "Home" either way */}
      <Suspense fallback={analyst ? <AnalystHomeSkeleton /> : <RequestorHomeSkeleton />}>
        {analyst ? <AnalystHomeContent searchParams={searchParams} /> : <RequestorHomeContent searchParams={searchParams} />}
      </Suspense>
    </>
  );
}
```

The redirect, in `next.config.ts`: `async redirects() { return [{ source: '/app/review', destination: '/app', permanent: false }]; }`.
- "`permanent` … if `false` will use the 307 status code which is temporary and is not cached."
- "Redirects are checked before the filesystem"
- "any query values provided in the request will be passed through to the redirect destination" [VERIFIED: `03-api-reference/05-config/01-next-config-js/redirects.md`].
- The execution order is headers, then redirects, then Proxy [VERIFIED: `03-api-reference/03-file-conventions/proxy.md:236-247`].

A literal source matches only that path. Nested paths such as `/app/review/requests` are untouched.

### Pattern 4: The holder as a SQL predicate reusing the queue's facts (D-02 item 6, D-20)

**What:** `holder` is decided in SQL over the owner's requests, from the same `EXISTS` fragments the review queue uses. Page items are then hydrated and projected with the one lifecycle derivation.
**Where the facts come from:** `review-queue-repository.ts:71-131` (`fromQuestionnaireLink`, `questionnaireReleased`, `questionnaireSubmitted`, `assessmentExists`, `assessmentReleased`, `whereQuestionnaireHasSubmittedAnswer`). Export them, and do not copy them.

```typescript
// apps/backend/src/api/csrm-assessment-request/services/my-requests.ts (sketch)
// holder = requestor : status = 'draft'
//                      OR (status IN reviewable AND questionnaireReleased AND NOT questionnaireSubmitted AND NOT assessmentExists)
// holder = analyst   : status IN reviewable AND NOT (questionnaireReleased AND NOT questionnaireSubmitted AND NOT assessmentExists)
// holder = none      : status IN ('approved','closed')
// owner             : EXISTS csrm_assessment_requests_requestor_lnk WHERE idambox_user_id = <policy requestorId>
```

The reviewable statuses are `"submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review"`, and the released statuses are `"approved", "closed"` (quoted from `collection-scope.ts:45-52`). The requestor branch is the review queue's `awaiting-requestor` bucket plus drafts (`review-queue-repository.ts:144-150`).

**Proof:** an integration test that, for fixtures at each lifecycle step, the SQL holder equals the holder implied by `deriveRequestLifecycle(...).currentKey`, as Phase 7's D-30 equivalence test does for the buckets.

### Pattern 5: The stage split of the Risk Register scope (D-40, D-41)

Name the two branches of `applyDisclosableParent` (`risk-register.ts:137-164`) as `applyUnderAssessmentParent` and `applyReleasedParent`. Keep `applyDisclosableParent` as their union, so the register, the alerts (`alert-repository.ts:235,248`) and the reports are unchanged by default. Exposure then reads:
- `openReleased = applyReleasedParent(from csrm_risks r).whereNull('r.closure_date')`;
- `openUnderAssessment = applyUnderAssessmentParent(...).whereNull('r.closure_date')`;
- `accepted = openReleased.where('r.treatment_action', 'Accept')`.

The register filter `stage` uses the same two functions. Its row projection derives `stage` from the populated assessment, as `parentLock` does (`risk-register.ts:113-120`: `released` when `isReleased`, otherwise `mutable`).

### Pattern 6: Quick find (D-47 to D-53)

```tsx
// features/quick-find/quick-find-dialog.tsx (sketch, 'use client', loaded with next/dynamic)
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="p-0" showCloseButton={false}>
    <DialogTitle className="sr-only">{/* UI-SPEC title */}</DialogTitle>   {/* inside the content */}
    <Command shouldFilter={false} vimBindings={false} label={/* UI-SPEC */}>
      <CommandInput value={term} onValueChange={setTerm} />
      <CommandList>
        {groups.map((group) => (
          <CommandGroup heading={group.label} key={group.kind}>
            {group.items.map((item) => (
              <CommandItem key={item.href} value={item.href} onSelect={() => guard.navigate(item.href)}>…</CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      <p aria-live="polite" className="sr-only">{/* "{n} results" / "No matches" */}</p>
    </Command>
  </DialogContent>
</Dialog>
```

- **Client:**
  - debounce the term (about 250 ms);
  - keep one call in flight; when it returns, dispatch the newest pending term if it differs;
  - drop any result whose term is no longer current.
- **Server:** `quickFindAction(term)` validates with zod (a string, trimmed, 2 to 100 characters), reads the session's capabilities, and runs `Promise.all` over the existing service functions with a page size of 5. For each list it maps to `{ kind, label, total, items: [{ href, primary, secondary }] }` and never returns raw records.
- **cmdk's `value`:** use the href or the documentId, because cmdk selects items by value.
- **Loading:** `Command.Loading` (the README) or skeleton rows, per the UI-SPEC.

### Pattern 7: Figure links as presentation data (D-35 to D-39)

**What:** each figure's href is built in its presentation module from the list's own filter vocabulary. Add an `href` to `ReportTableRow` cells, for example, and never assemble one in JSX.
**Proof:**
- a unit audit asserts that every figure of every report and Home unit carries an href, or is a documented sum (D-37);
- E2E proofs assert tile or cell = list total for one figure of each kind (the 07 D-24 style).

### Anti-Patterns to Avoid

- **Deriving the holder in the web**, whether by matching the `nextAction.summary` strings or from the stored `requestStatus`. `questionnaire-in-progress` covers three holders (UAT-003); use the server's `holder`.
- **Awaiting the counts in the layout.** Every page would wait on two or three reads; stream them (Pattern 2).
- **`permanentRedirect()` or `redirect()` in a page to retire `/app/review`.** Under `(app)/loading.tsx` it streams a meta-refresh with status 200 (Pitfall 3).
- **Using the shipped `CommandDialog` as it is:** its title sits outside the dialog, its title is "Command Palette", and its `Command` filters on the client.
- **Calling `createStrapiClient` from a new module**, such as quick find or the counts. That changes `served-operations.json`'s `webCallers` and trips the chain guard; call the existing service functions.
- **Counting, ordering or deriving figures in the web** (07 D-02, D-34).
- **Computing an age or a "days ago" with `Date.now()` inside a Client Component.** It risks a hydration mismatch, and the figure would not be the server's; use `daysSinceSubmission`.
- **Drawing business criticality with the risk severity badge.** It conflates a business attribute with a risk rating.
- **A badge whose count is not in the link's accessible name**, or one shown by colour alone (direction do-not 1).

## Figure link inventory (UX-09 criterion 2)

"Filter" names the list filter; "new" marks a filter this phase adds (D-35).

| Surface | Figure | Opens | Equal total? |
|---|---|---|---|
| Analyst Home | Requires my attention, Overdue, Due within 14 days, Needs attention (KPI) | Queue default; Alerts `urgency=overdue`, `due-soon`, `attention` (existing) | yes |
| Analyst Home | Review queue rows (6) | Queue buckets; questionnaires `status=submitted`; assessments `status=draft` and `in-review` (existing) | yes |
| Analyst Home | Exposure released Critical…Low | Risk Register `residualRating=X&state=open&stage=released` (stage new) | yes |
| Analyst Home | Exposure released Not rated | `residualRating=none&state=open&stage=released` (none new) | yes |
| Analyst Home | Accepted per rating | `…&stage=released&treatmentAction=Accept` (new) | yes |
| Analyst Home | Under assessment (total and per rating) | `state=open&stage=under-assessment[&residualRating=X]` (new) | yes |
| Analyst Home | High and Critical: rows; footer | Each Risk; "View Critical" and "View High" per-rating links (`stage=released&state=open`); the combined total is a sum (D-37) | yes, per part |
| Analyst Home | Treatments due, Upcoming, Top alerts | Alerts by kind or urgency (existing) | yes |
| Analyst Home | Your own requests: needs your action, with Security Analysts | My requests `holder=requestor`, `holder=analyst` (new) | yes |
| Requestor Home | Needs your action total; With the Security Analyst total | My requests `holder=requestor`, `holder=analyst` (new) | yes |
| Requestor Home | Released total; rating chips | My risk assessments; `?rating=X` → `overallRating` (new) | yes |
| Risk exposure report | Released open Risks, Critical residual, High residual; new Under assessment and Accepted tiles | Risk Register with `stage` (new) | yes |
| Risk exposure report | Inherent and residual table cells | `inherentRating` or `residualRating` (+ `none`) `&state=open&stage=released` | yes |
| Risk exposure report | Residual × treatment status cells and row totals | `residualRating=X&treatmentStatus=Y` (+ `none`) `&state=open&stage=released` | yes |
| Risk exposure report | Most exposed system: Critical cell, High cell, name, total | `system={id}&residualRating=Critical`/`High&state=open&stage=released`; the name opens the system's Risks; the total is a sum (D-37) | yes, per part |
| Risk exposure report | "n High or Critical Risks have no impacted system" | Risk Register with no impacted system, per rating (new value) | yes |
| Treatment performance | Overdue, Due within 14 days, Due later, No target date | Alerts `kind=risk-treatment-overdue` / `…due-soon`; Risk Register `dueState=later`, `dueState=no-target-date` (new; window aligned, D-38) | yes |
| Treatment performance | Treatment status rows | `treatmentStatus=X` (+ `none`) `&state=open` | yes |
| Assessment throughput | Released in period; each month | Risk assessments `status=approved&approvedFrom&approvedTo` (new) | yes |
| Assessment throughput | Median days to release | The period's released list (D-39) | the list the median is computed from |
| Assessment throughput | Requests by lifecycle state | Queue `queue=all&status=X` (new) | yes |
| Control effectiveness | Total; implementation status rows; effectiveness rows; Rated Ineffective | Risk Register `mitigationStatus=any` / `=X`, `mitigationEffectiveness=X` (new) `&state=open`; Alerts `kind=ineffective-control` (existing) | no, by design (D-36): these open the Risks that hold the implementations, and the link says so |

The treatment performance and control effectiveness populations include Risks under assessment (D-43), so their links carry no `stage`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A combobox inside a dialog, with groups and keyboard | A custom listbox with arrow and active-descendant handling | `cmdk` through `components/ui/command.tsx` | Roles, `aria-activedescendant`, groups, Home and End are handled [VERIFIED: the dist grep] |
| Modal focus trap, Escape and focus return | A custom trap | Radix Dialog (`components/ui/dialog.tsx`) | Focus scope, scroll lock and Escape are built in |
| Local times | New `Intl` formatters | Phase 10's `formatInstant` and `LocalInstant` | X-3 and the validated zone cookie |
| The lifecycle as SQL | New `EXISTS` clauses | `review-queue-repository.ts` facts | Proven equal to the semantic rule (07 D-30) |
| Released and under assessment | New release checks | `applyDisclosableParent`'s two branches | One definition across the Risk Register, the alerts and the reports |
| Due states | New date comparisons | `deriveTreatmentDueState` and its SQL mirror | D-04 is "the single definition" |
| Status labels | New label maps | `statusPresentation`, `statusLabel` (08 D-27) | One mapping |
| Filter URLs and chips | New encoders | `serializeRiskRegisterQuery`, DataTable `filters` | Canonical URLs already exist |
| A leave warning on navigation | A new `beforeunload` | Phase 10's navigation guard | D-12 of Phase 10 |
| An owner-scoped count | A new SQL owner check | `countOwnedRequestsByStatus` (`request-status-summary.ts:68-80`) | The owner id comes from the policy |

**Key insight:** every figure and holder must have one definition on the server. The failures Phase 7 and UAT-003 recorded came from two definitions of the same thing.

## Runtime State Inventory

The phase renames headings, labels and a route, and moves a page. Each category was checked.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. The request status `approved` stays stored (decision 16); no key, collection or enum value is renamed. Verified against the request and Risk content types. | none |
| Live service config | None. No external service holds route or label names. | none |
| OS-registered state | None. | none |
| Secrets and env vars | None. No variable name changes, and `CSRM_AI_*` is untouched. | none |
| Build artifacts and browser state | The browser `localStorage` keeps DataTable density under `csrm:data-table-density:{densityUserId}` (`data-table.tsx:91-92`). Keeping the review lists' `densityUserId` values (`assessment-review-requests`, `assessment-review-assessments`) keeps each viewer's density; renaming one only resets that preference. A 307 is not cached, so no browser holds `/app/review` after the phase. The `.next` build output is rebuilt by each E2E run. | Keep the `densityUserId` values |

## Common Pitfalls

### Pitfall 1: Counts that block or go stale
**What goes wrong:** awaiting count reads in the layout delays every full render. Rendering them only once leaves them stale until a server render.
**Why it happens:** layouts do not re-render on client navigation [VERIFIED: `03-layouts-and-pages.md:43`].
**How to avoid:**
- stream a never-rejecting promise (Pattern 2);
- accept that counts refresh on full loads, router refreshes and revalidating actions;
- no polling (direction do-not 9).

**Warning signs:** the Time To First Byte grows on every route in `performance.spec.ts`; a badge shows 0 after a failed read.

### Pitfall 2: One loading boundary for two layouts
**What goes wrong:** `app/(app)/app/loading.tsx` cannot know the actor, so its skeleton mirrors one Home or the other, not both. The direction requires skeletons that match the final layout.
**How to avoid:** decide the variant in the page before a Suspense boundary (Pattern 3). Keep `loading.tsx` to the Home header and a shared neutral block, or retire it (D-23).

### Pitfall 3: A page-level redirect under a streamed boundary
**What goes wrong:** `redirect()` or `permanentRedirect()` inside a streamed page emits a meta tag, and the status is 200. "When used in a streaming context, this will insert a meta tag to emit the redirect on the client side" [VERIFIED: `03-api-reference/04-functions/permanentRedirect.md`]. The `(app)` group's `loading.tsx` makes every page streamed; Phase 8 observed that shell pages answer 200 (R-08-15).
**How to avoid:** a `next.config.ts` redirect (Pattern 3). Assert it with `page.goto('/app/review')` ending at `/app` under the Home heading, and with `request.get('/app/review', { maxRedirects: 0 })` returning 307.

### Pitfall 4: Strict-mode duplicates from responsive copies
**What goes wrong:** rendering both a phone and a desktop copy of the same text, with one hidden by CSS, makes `getByText`, `getByRole` and `getByRole('link', { name })` resolve two elements, so Playwright's strict mode fails.
**Where it bites:**
- the compact stepper's next action beside the hub's (`request-relationship-states.spec.ts:152` at 375px);
- two quick-find triggers;
- nav badges.

**How to avoid:**
- render one element and change its presentation with CSS; or
- scope the locators to a region, or use `.filter({ visible: true })` (Playwright 1.58), in the plan that introduces the duplicate.

### Pitfall 5: Count badges change the links' accessible names
**What goes wrong:** when the count is part of the name, as D-10 requires, exact-name locators such as `getByRole('link', { name: 'Assessment Requests', exact: true })` fail.
**How to avoid:**
- the sidebar plan and the counts plan update those locators to anchored patterns, `name: /^Requests\b/`;
- keep the name from the content, with no `aria-label`, so axe's `label-content-name-mismatch` does not apply (it checks explicitly labelled elements);
- the visible text starts the name (WCAG 2.5.3).

### Pitfall 6: The sign-in guard pins the old heading
**What goes wrong:** `apps/csrm/src/lib/testing/e2e-sign-in-assertions.test.ts:17` requires every sign-in function to match `/getByRole\(\s*'heading',\s*\{[^}]*\bname:\s*'Dashboard'/`. Renaming the heading to Home fails the unit suite until the guard changes.
**How to avoid:** change the guard's regex to `'Home'` in the same plan as the heading, the shared helper and the seven spec-local sign-ins:
- `e2e/helpers/navigation.ts:17`;
- `analyst-insights.spec.ts:95`, `app-shell.spec.ts:29`, `design-contract.spec.ts:47`, `design-system-conformance.spec.ts:70,78,180` and `production-hardening.spec.ts:182`.

### Pitfall 7: The next action says the same thing twice on a phone
**What goes wrong:** the compact stepper carries the next action (D-26), and the hub's "Next action:" line sits right below it.
**How to avoid:** the UI-SPEC decides one presentation per width. Pass Phase 10's `nextActionOverride` to both (D-28).

### Pitfall 8: Filters vary the review queue's parser in two places
**What goes wrong:** the web's `requestReviewQuerySchema` (`assessment-service.ts:185-192`) has its own `queue` enum and `sort` string. Adding `all` and `q` on the server alone leaves the web list unable to select them, and adding them on the web alone produces 400s.
**How to avoid:** change the server parser (`collection-scope.ts:194-235`), the spec parameters and the web schema together (D-02).

### Pitfall 9: The assessment list's aggregates in a document-service query
**What goes wrong:** Strapi's `documents.findMany` cannot return per-row aggregates, so a Risk count or highest rating computed by populating every Risk multiplies rows (up to 100 assessments × 1,000 Risks).
**How to avoid:** one grouped `knex` query over `csrm_risks_assessment_lnk` ⋈ `csrm_risks`, restricted to the page's assessment ids, with `COUNT(DISTINCT r.id)` and `MAX(CASE r.residual_rating WHEN 'Low' THEN 1 WHEN 'Moderate' THEN 2 WHEN 'High' THEN 3 WHEN 'Critical' THEN 4 END)`. The rating ladder is quoted from `risk-register.ts` (the sort): `CASE ${column} WHEN 'Low' THEN 1 WHEN 'Moderate' THEN 2 WHEN 'High' THEN 3 WHEN 'Critical' THEN 4 ELSE 5 END`. Ignore off-ladder values. Read counts through `Number()`, because PostgreSQL returns COUNT as a string (`dashboard-summary.ts:121-129`).

### Pitfall 10: Two windows for "due soon"
**What goes wrong:** the report's 30-day window has no list with the same predicate. `dueState` on the Risk Register uses 14 days (`deriveTreatmentDueState` default).
**How to avoid:** align the window (D-38). Update `analyst-insights.unit.test.ts:166`, the fixture at today+30 (`analyst-reports.integration.test.ts:683-706`), and the web presentation tests that pass `dueWindowDays: 30` as data (`report-presentation.test.ts:64,221,231,335`; `report-views.test.tsx:91,382-395`; `report-schema.test.ts:63`). These may keep 30 as fixture data, because the presentation is window-agnostic.

### Pitfall 11: "Not rated" means null or off-ladder
**What goes wrong:** `ratingCounts` counts `notRated` as a null rating or one outside the ladder (spec `RatingCounts` description). A Risk Register `residualRating=none` filter written as `IS NULL` alone misses off-ladder values, so the totals differ.
**How to avoid:** `r.residual_rating IS NULL OR r.residual_rating NOT IN ('Low','Moderate','High','Critical')`.

### Pitfall 12: The analyst's own list must read from the Requestor's side
**What goes wrong:** if `GET /v1/my_requests` took the analyst actor, the next actions would read "Generate the questionnaire" with review hrefs.
**Why it is safe:** the policy sets `assessmentRequestActor` to `"analyst"` only for an explicit analyst grant of that operation (`csrm-authorization.ts:230-235`, applied at line 282). `GET:/api/v1/my_requests` is granted to the Requestor role only, so `projectRequestLifecycle` sees a Requestor.
**How to avoid:** keep the grant Requestor-only, and assert it in the matrix row and the integration test.

### Pitfall 13: The Released label in both maps
**What goes wrong:** `status-badge.tsx` (badges) and `request-domain.ts` (filter options, the throughput rows and the dashboard tiles) hold separate request label maps. Changing one leaves "Approved" in filters or reports.
**How to avoid:** change both, and add a unit test that `statusLabel('request', 'approved')` and `requestStatusPresentation.approved.label` are both "Released".

### Pitfall 14: The collapsed section hides the current page
**How to avoid:** the section's open state derives from `activeNavigationHref` over every profile item on first render (D-08). Test `/app/requests/{id}` as the analyst in a unit test and in the drawer.

### Pitfall 15: cmdk's defaults
**What goes wrong:** cmdk filters and sorts items by `value` on the client by default, which hides server results that do not contain the typed text (a Risk found by its statement). `vimBindings` defaults to true, so Ctrl+K inside the input moves the selection up.
**How to avoid:** `shouldFilter={false}` and `vimBindings={false}` [VERIFIED: `node_modules/cmdk/dist/index.mjs`: `vimBindings:j=!0` and cases `"j"`, `"k"`, `"n"`, `"p"`].

### Pitfall 16: The shipped `CommandDialog`
**What goes wrong:** its `DialogHeader` and `DialogTitle` render outside `DialogContent` (`command.tsx:47-51`), not portalled, so an "sr-only" `h2` "Command Palette" sits in the page outline even while the dialog is closed.
**How to avoid:** compose `Dialog`, `DialogContent` with its `DialogTitle` inside, and `Command`, or fix `CommandDialog` in the source-owned file.

### Pitfall 17: Server Actions run one at a time per client
**What goes wrong:** a search typed while a questionnaire autosave (Phase 10) or another action runs waits behind it, and a burst of searches queues.
**How to avoid:**
- debounce, keep a single call in flight, and send the latest term after it;
- never call `revalidatePath`, `cookies().set` or `refresh` in the search action, because each makes the response re-render the route [VERIFIED: `02-guides/server-actions.md`].

### Pitfall 18: A hydration mismatch in the shortcut hint
**What goes wrong:** rendering "⌘K" or "Ctrl K" from `navigator` during server render differs between server and client.
**How to avoid:** render the hint after mount, or render a neutral hint. Accept both `metaKey` and `ctrlKey` everywhere.

### Pitfall 19: The shortcut steals keys or fights other dialogs
**How to avoid:**
- `preventDefault` only when handling Ctrl+K or ⌘K;
- ignore `event.isComposing` and `event.repeat`;
- do not open while another modal dialog is open, such as the Phase 10 leave warning or a confirm dialog;
- close on the same shortcut.

Browsers bind Ctrl+K to search or the address bar in some configurations [ASSUMED], which `preventDefault` overrides while focus is in the page.

### Pitfall 20: Stage and the partial-release rows
**What goes wrong:** an approved Risk Assessment missing its approval date or approver is in neither branch today; it is not disclosable.
**How to avoid:** keep that behaviour. The stage filter uses the two branches exactly, so released plus under assessment equals the Risk Register scope. A test fixture with a partial release proves it appears in neither.

### Pitfall 21: A "none" value inside an id pattern
**What goes wrong:** `system` is parsed as an opaque id matching `^[A-Za-z0-9_-]+$` (`risk-register-query.ts:75-80`), so `system=none` is also a valid id string.
**How to avoid:** use a separate closed parameter or value that cannot be a documentId, such as `impactedSystem=none` as its own key, or a boolean flag. The planner names it.

### Pitfall 22: Exposure link names in E2E
**What goes wrong:** `analyst-insights.spec.ts:502` matches `/^Critical: [\d,]+ open Risks? by residual rating$/`, and `:594` matches the list label "Open contextual Risks by residual rating". Both change with DASH-03's wording.
**How to avoid:** update them in the exposure plan and keep the equality proof at `:500-509`, the row total against its Risk Register list total.

## Code Examples

### Reading the owner id and scoping a list (the existing pattern)

```typescript
// Source: apps/backend/src/api/csrm-assessment-request/controllers/my-request-status-summary.ts:28-45 (existing)
function ownRequestorId(state: unknown): number | null {
  const authorization = isRecord(state) && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
  if (authorization?.assessmentRequestCollectionScope !== "own") return null;
  const requestorId = authorization.assessmentRequestRequestorId;
  return typeof requestorId === "number" && Number.isSafeInteger(requestorId) && requestorId > 0 ? requestorId : null;
}
```

### The owner join (the existing pattern)

```typescript
// Source: apps/backend/src/api/csrm-assessment-request/services/request-status-summary.ts:72-78 (existing)
connection.queryBuilder()
  .from("csrm_assessment_requests as r")
  .join("csrm_assessment_requests_requestor_lnk as o", "o.csrm_assessment_request_id", "r.id")
  .where("o.idambox_user_id", requestorId)
```

### The existing awaiting-requestor predicate the holder reuses

```typescript
// Source: apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts:144-150 (existing)
case "awaiting-requestor":
  query.whereExists(questionnaireReleased)
    .whereNotExists(questionnaireSubmitted)
    .whereNotExists(assessmentExists);
  return;
```

### Local time on a list cell (Phase 10's artifact)

```tsx
// Source: .planning/workstreams/csrm/phases/10-existing-flow-gap-closure/10-01-PLAN.md (LocalInstant contract)
<LocalInstant style="date" value={request.submittedDate} fallback="Not recorded" />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Awaiting all data in a layout | Passing a promise to a Client Component and reading it with `use()` under Suspense | React 19 and Next 15+, documented in the Next 16.3 docs | Counts never block a page |
| Parallel Server Action calls from the client | One action does the parallel work on the server; the client dispatches actions one at a time | Next docs, `server-actions.md` | Quick find coalesces |
| Page-level redirects for retired routes | `next.config` `redirects()` before the proxy | Longstanding; the execution order is in `proxy.md` | A real 307 without rendering |
| The command palette as a bespoke combobox | shadcn `Command` over cmdk | cmdk 1.x | ARIA and keyboard handling for free |

**Deprecated or outdated in this codebase:**
- the "Workspace" and "Analyst dashboard" labels;
- the `(analyst-dashboard)` route group;
- the Requestor dashboard's stored-status tiles;
- the 30-day treatment report window (D-38);
- "The work is waiting with the other party.".

## E2E and copy assertions that change

Line numbers are for today's tree. Phase 10 also edits several of these specs, so each plan re-reads them after Phase 10. "Owner" is the proposed Phase 11 plan (see "Proposed plan grouping").

| Assertion (file:line) | Today | Why it changes | Owner |
|---|---|---|---|
| `assessment-navigation-lifecycle.spec.ts:253,259,288` | Status options include "Approved"; chip "Status: Approved" | D-46 Released | 11-01 |
| `helpers/navigation.ts:17`; spec-local sign-ins at `analyst-insights.spec.ts:95`, `app-shell.spec.ts:29`, `design-contract.spec.ts:47`, `design-system-conformance.spec.ts:70,78,180`, `production-hardening.spec.ts:182` | Level-one heading "Dashboard" | D-16 Home | 11-02 |
| `src/lib/testing/e2e-sign-in-assertions.test.ts:17` | `DASHBOARD_HEADING` regex | D-16 Home (Pitfall 6) | 11-02 |
| `accessibility.spec.ts:48,287-289,318-319,440,469` | `dashboard` expectation: `Dashboard \| IdamBox CSRM`, heading Dashboard; the `lifecycleDashboard` guard (`:216-235`) | D-16; the tiles retire in 11-09 | 11-02 (heading and title), 11-09 (guard) |
| `accessibility.spec.ts:71,357-358`; `analyst-insights.spec.ts:77,466-546,608-636`; `performance.spec.ts:62,120`; `production-hardening.spec.ts:478,506`; `design-system-conformance.spec.ts:23,36,256` | `/app/review` as a page with the heading "Analyst dashboard" | D-17 redirect; the analyst Home at `/app` | 11-02 |
| `src/lib/performance/zod-client-boundary.test.ts:117` | `['/app/review', '(app)/app/review/(analyst-dashboard)']` | The route group retires | 11-02 |
| `src/lib/testing/e2e-ui-state-route-authorization.test.tsx:52,100,126,172` | Imports `AnalystDashboardContent` from the route group | The content moves to Home | 11-02 |
| "Return to workspace"/"Back to workspace": `accessibility.spec.ts:429,485,497`, `administration-workflow.spec.ts:96`, `analyst-insights.spec.ts:710`, `app-shell.spec.ts:9`, `assessment-navigation-lifecycle.spec.ts:194,229`, `design-contract.spec.ts:201`, `design-system-conformance.spec.ts:119,123,508,511`; unit `states.test.tsx:37,61`, `administration-workflow.test.tsx:293`, `alert-list.test.tsx:295`, `alerts-page.test.tsx:109`, `analyst-dashboard.test.tsx:484,489,520`, `reports-pages.test.tsx:196`, `root-fallbacks.test.tsx:25` | The recovery label | D-25 | 11-02 |
| `src/components/shell/mobile-navigation.test.tsx` (whole file: `/app/review`, "Analyst dashboard", "Workspace", groups `Reports` and `Administration`) | The flat list | D-06 to D-12 | 11-02 (Workspace, Analyst dashboard), 11-03 (sections) |
| `analyst-insights.spec.ts:696-700` | Requestors see "Workspace" and no Reports group | Sections | 11-02, 11-03 |
| Nav labels: `requestor-request-workflow.spec.ts:144,152,289` ("My Requests"); `questionnaire-workflow.spec.ts:166-167,275,314`; `questionnaire-generation-workflow.spec.ts:69-70,90`; `assessment-release-workflow.spec.ts:107-108`; `administration-workflow.spec.ts:86,109-111` (group text "Administration"); `analyst-insights.spec.ts:203-207,289-291,314-319,485,654` (group "Reports"); `design-system-conformance.spec.ts:286` ("Administration") | Old labels and groups | D-07 to D-09 | 11-03 |
| Headings and titles: `accessibility.spec.ts:49-56,77-80,300,306,345,417-419,682,689`; `performance.spec.ts:99,124,129`; `production-hardening.spec.ts:454-457,479-485,507,577`; `requestor-request-workflow.spec.ts:156`; `questionnaire-workflow.spec.ts:172,276`; `assessment-release-workflow.spec.ts:113,170`; `assessment-navigation-lifecycle.spec.ts:118`; `risk-register-workflow.spec.ts:234,373`; `analyst-insights.spec.ts:334,508,520` | "My Requests", "My Questionnaires", "My Risk Assessments", "Questionnaire Review", "Assessment request review", "Risk assessment review", "Risk Register", "New assessment request", and titles such as "Risk Register \| IdamBox CSRM" | D-09 | 11-03 (detail route titles only if the UI-SPEC renames them) |
| Exact-name nav link locators, for example `assessment-release-workflow.spec.ts:108` "Assessment Requests" | No count in the name | D-10 badges in the name (Pitfall 5) | 11-10 |
| `request-relationship-states.spec.ts:152` (`/^Next action: /` at 375px); `questionnaire-governance-workflow.spec.ts:113,157` | One Next action line | D-26 and D-27 wording and placement | 11-06 (wording), 11-07 (phone) |
| `request-hub.test.tsx:86-88`, `request-lifecycle-stepper.test.tsx:42,46`; Strapi `request-lifecycle.unit.test.ts:62-68` | "The work is waiting with the other party." | D-27 | 11-06 |
| `requestor-request-workflow.spec.ts:307-325`; `performance.spec.ts:95-96`; `design-system-conformance.spec.ts:180-197`; `assessment-release-workflow.spec.ts:282` | "My Assessment Requests" tiles; "Draft requests"; "Questionnaires in progress"; "Recently released assessments" | D-19 and D-23 | 11-09 |
| `risk-register-workflow.spec.ts:376` | "Search and manage contextual Risks across authorised assessments." | D-54 | 11-11 |
| `analyst-insights.spec.ts:326-330,500-534,594` | Exposure link names and the "Open contextual Risks by residual rating" list | D-42 and D-54 | 11-12 |
| Strapi `analyst-insights.unit.test.ts:166`; `analyst-reports.integration.test.ts:683-706` | `TREATMENT_REPORT_DUE_WINDOW_DAYS` is 30; the fixture at today+30 | D-38 | 11-12 |
| Unit label tests: `status-badge.test.tsx:62,234`; `feedback-composites.test.tsx:49`; `assessment-list.test.tsx:68,171,183,236`; `assessment-status-filters.test.tsx:177`; `requestor-dashboard.test.tsx:157,240`; `report-presentation.test.ts:304`; `report-views.test.tsx:524` | "Approved" | D-46 | 11-01 |

Copy that must pass the interface copy guard once its file joins (D-54): `analyst-dashboard-presentation.ts:171,173,325`, `report-presentation.ts:117,336,351,359,371,377,400,406`, `report-copy.json:5,23` and `app/(app)/app/risks/page.tsx:13`. `report-definitions.ts:24,39` is Strapi source that the guard does not scan; the mounted report test keeps it equal to `report-copy.json`.

## Proposed plan grouping (15 waves, serial)

Each wave holds one plan, as in Phase 10.
- **Why serial:**
  - every contract plan touches the specification and the generated client (D-05);
  - almost every plan ends with a Playwright run, and runs share the production build and `apps/backend/dist`;
  - the web-only plans touch hot shared files: the shell, the navigation, the E2E sign-in helper and the route lists.
- **Why this order:** the shell, Home and sidebar moves come first, so every later plan writes its E2E against the final labels.

| Wave | Plan | Contract? | Delivers | Depends on | Size |
|---|---|---|---|---|---|
| 1 | 11-01 Extensions and the Released label | no | The UI-SPEC's accepted extensions recorded in the direction; the "Released" request label in both maps; the root `CONTEXT.md` glossary | Phase 10 gate | S |
| 2 | 11-02 Home at `/app` | no | `/app` chooses the analyst or Requestor variant before any read; the `/app/review` config redirect (307); "Home" heading and title; Workspace → Home and Analyst dashboard removed from nav; the shared sign-in helper, the seven spec-local sign-ins and the guard; the recovery copy (D-25); route lists (performance, zod boundary, accessibility, production-hardening, design); the fixture route test; local time on Recent activity | 11-01 | L (test churn) |
| 3 | 11-03 Sectioned sidebar | no | Profiles and sections; the New request button; the collapsible own section; the drawer; labels = headings (the page-heading module; the heading, title and "New request" renames); the Phase 20 and 22 seams; the guard kept | 11-02 | L (test churn) |
| 4 | 11-04 Review queue (C1) | spec | Projection, `q`, `all`; the queue columns, cards, sorting and local Submitted date; search by number | 11-03 | M |
| 5 | 11-05 Risk Assessment lists (C2) | spec | Projection, request-title search, `overallRating`, `approvedFrom`/`approvedTo`; list columns; My risk assessments (request title, local release date); the Related assessment picker | 11-04 | M |
| 6 | 11-06 Lifecycle holder (C5) | spec | `holder` on `nextAction`; the holder-naming copy; the hub line | 11-05 | S |
| 7 | 11-07 Phone stepper | no | The compact stepper on both request pages, with Phase 10's override | 11-06 | M |
| 8 | 11-08 My requests (C6) | spec, catalogue, served-ops, matrix | `GET /v1/my_requests`; status summary `byHolder`; the My requests page on it (holder filter, next step) | 11-07 | L |
| 9 | 11-09 Requestor Home | no | Needs your action, With the Security Analyst, released with chip links; the 375px order; the partial selector; local dates; the analyst's "Your own requests" panel | 11-05, 11-08 | M |
| 10 | 11-10 Sidebar counts | no | The count promise and badges; the queue one-row count function; fail-soft; accessible names; locator updates | 11-03, 11-08 | M |
| 11 | 11-11 Risk Register filters (C3) | spec | The `stage`, `treatmentAction`, `dueState`, `mitigationEffectiveness`, `any` and none values; the row stage and accepted markers; the filter UI; the description copy with the guard | 11-10 | L |
| 12 | 11-12 Exposure (C4) | spec | Staged exposure on the dashboard and the report; the window alignment; the accepted seed; the widget and report UI with scope statements; the "contextual" copy with the guard; the exposure links | 11-11 | L (may split: contract with the dashboard, then the report) |
| 13 | 11-13 Figure links | no | The remaining figure links (treatment performance, throughput, control effectiveness, High and Critical per rating); the audit test; the equality proofs | 11-04, 11-05, 11-11, 11-12 | M |
| 14 | 11-14 Quick find | no | The header control, the shortcut, the lazy dialog, the Server Action and the guard entry point; unit and E2E, scope proof included | 11-03, 11-04, 11-05, 11-08 | L |
| 15 | 11-15 Phase gate | no | The full gate on the production build; 375px and 1440px browser checks for the Requestor, the Secondary Requestor and the Security Analyst; the UAT-A/B/C re-read as manual checks | all | S |

Plans 11-04, 11-05, 11-06, 11-08, 11-11 and 11-12 edit Strapi, so they run their Strapi files and the full Strapi suite with the dev servers stopped. Plan 11-08 also regenerates `served-operations.json` (`SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write`) and runs the matrix.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `next.config` `redirects()` also apply when the App Router navigates client-side to `/app/review` (the RSC request reaches the server, which answers the redirect). The docs state only the Pages Router caveat. | Pattern 3, Pitfall 3 | Low. The phase removes every in-app link to `/app/review`, so only direct loads and bookmarks use it; the E2E proves the direct load |
| A2 | A Server Action that calls `revalidatePath` re-renders the `(app)` layout in its response, so the layout's count promise re-runs and the badges refresh | Pattern 2, D-11 | Low. Counts would refresh on the next full load or router refresh instead; the plan 11-10 E2E checks after a submit |
| A3 | Radix Dialog returns focus to the element focused before it opened, even when a keyboard shortcut opened it with no `Dialog.Trigger` | D-48 | Medium. Focus could land on `body` after Escape; mitigate by storing `document.activeElement` on open and restoring it in `onCloseAutoFocus`; the E2E asserts where focus returns |
| A4 | `preventDefault()` on Ctrl+K and ⌘K keydown overrides the browser's own binding while focus is in the page, in Chromium, Firefox and Safari | Pitfall 19 | Low. Chromium is proven by E2E; Safari and Firefox are a manual check |
| A5 | cmdk's grouped listbox markup passes axe's WCAG 2.2 AA rules | D-48 | Low. The E2E axe scan of the open dialog decides; wrapper fixes are possible because the file is source-owned |
| A6 | cmdk's gzip size is about 4 KB (the installed `dist/index.mjs` is 11,328 bytes minified) | D-52 | None. The dialog loads on demand either way |

## Open Questions

1. **The exact strings for labels, headings, holder copy, scope statements and quick-find text.**
   - What we know: the rules (label = heading; sentence case; record-term capitals; the direction's voice) and the structure (D-06 to D-10, D-26, D-27, D-42).
   - What's unclear: the words.
   - Recommendation: the UI-SPEC fixes every string, keeping "Risk Types", "Controls", "Information Systems" and "Information Assets" as they are, because they already equal their headings.
2. **Detail route titles** such as "Assessment Request Review | IdamBox CSRM" and "Risk Assessment Review | IdamBox CSRM" (`app/(app)/app/review/requests/[documentId]/page.tsx:18`).
   - What's unclear: whether they follow the list heading renames.
   - Recommendation: keep them unless the UI-SPEC changes them. D-09 renames list headings; detail pages are headed by their records.
3. **Quick find duplicates.** An analyst's own submitted request appears in both "Requests" (review) and "My requests".
   - Recommendation: no cross-group deduplication. Each group mirrors a sidebar list and is labelled, and the planner may dedupe by documentId if the UI-SPEC asks.
4. **"No impacted system" filter naming** (Pitfall 21).
   - Recommendation: a separate closed key the planner names in the spec.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (Git Bash with the nvm path prefix) | Every web and Strapi command | ✓ | v24.19.0 | — |
| pnpm | Every workspace command | ✓ | 11.24.0 | — |
| Next.js | Web | ✓ | 16.3.6 | — |
| Playwright and Chromium | E2E | ✓ (the v1.0 gate ran 84/84) | 1.58.2 | — |
| SQLite, one database per Strapi test file | Strapi suite | ✓ (in the harness) | — | — |
| Dev servers on 1337 and 3000 | The orchestrator's | running (observed LISTENING) | — | Stop before Strapi files, `served-operations:write` or Playwright |
| `ctx7` CLI and Context7 MCP | Library docs lookup | ✗ | — | The bundled Next.js docs, the installed package source and the W3C APG pages, all used |

**Missing dependencies with no fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Web: vitest 4.1.11 (jsdom), @testing-library/react 16.3.0 and user-event 14.6.1. Strapi: `node:test` compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one SQLite database per file. E2E: Playwright 1.58.2 with @axe-core/playwright 4.11.0 on the production build |
| Config files | `apps/csrm/vitest.config.ts` (`src/**/*.test.{ts,tsx}`, 20 s timeouts); `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` (`desktop` 1440×900; `mobile` 375×812, `@journey` only; one worker) |
| Quick run command | Web: `pnpm --filter @csrm/web exec vitest run <paths>`. Strapi file (servers stopped): `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js`. E2E (servers stopped): `pnpm --filter @csrm/web test:e2e e2e/<spec>.spec.ts` |
| Full suite command | `pnpm --filter @csrm/web test`; `pnpm --filter @csrm/web typecheck`; `pnpm --prefix apps/csrm api:check`; `pnpm --filter @csrm/strapi test`; `pnpm --filter @csrm/web test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-07 | The profile per actor: sections, order, labels, capability gating, the collapsed own section that opens on its own routes, the New request button, the drawer's parity | web unit | `pnpm --filter @csrm/web exec vitest run src/components/shell/mobile-navigation.test.tsx src/config/navigation/navigation.test.ts` | ✅ (mobile-navigation) / ❌ W0 (navigation.test.ts) |
| UX-07 | Label = heading for every nav item (the page-heading constants) | web unit | `pnpm --filter @csrm/web exec vitest run src/config/navigation/navigation.test.ts` | ❌ W0 |
| UX-07 | Counts: capability-chosen reads, a failed read shows no badge, zero shows none, the accessible name carries the meaning | web unit | `pnpm --filter @csrm/web exec vitest run src/components/shell/navigation-counts.test.ts src/components/shell/mobile-navigation.test.tsx` | ❌ W0 |
| UX-07 | Sections, labels and counts at 1440px and in the drawer at 375px, for each actor | E2E | `pnpm --filter @csrm/web test:e2e e2e/navigation-and-home.spec.ts` | ❌ W0 |
| UX-08 | `/app` picks the variant before any read; a Requestor issues no analyst read, fixture or partial | web unit | `pnpm --filter @csrm/web exec vitest run src/lib/testing/e2e-ui-state-route-authorization.test.tsx src/features/home` | ✅ (moves) / ❌ W0 (home tests) |
| UX-08 | `/app/review` answers 307 to `/app` and lands on the Home heading for each actor | E2E | `pnpm --filter @csrm/web test:e2e e2e/navigation-and-home.spec.ts` | ❌ W0 |
| UX-08 | The analyst Home order (queue, deadlines, jobs, alerts first); own requests secondary | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/analyst-dashboard/analyst-dashboard.test.tsx src/features/home`; the E2E first screen at 375px and 1440px | ✅ / ❌ W0 |
| UX-08 | The Requestor Home split by holder; items name the holder; Needs your action first at 375px | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/home src/features/dashboard`; E2E `navigation-and-home.spec.ts` and `requestor-request-workflow.spec.ts` | ✅ / ❌ W0 |
| UX-08 | The holder SQL equals the lifecycle for fixtures at every step; owner isolation; filters, sort and pagination | Strapi integration | quick run `my-requests.integration.test.js`, `request-status-summary.integration.test.js` | ❌ W0 / ✅ |
| UX-08 | The lifecycle `holder` for each step and actor; no "other party" | Strapi unit | quick run `request-lifecycle.unit.test.js` | ✅ |
| UX-08 | The compact stepper: "Step n of m", the next action and the disclosure, with `aria-expanded` | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/requests/request-lifecycle-stepper.test.tsx`; 375px E2E on both request pages | ✅ |
| UX-09 | The queue projection, `all` and `q`; days since submission against a fixed today | Strapi unit + integration | quick run `review-queue.unit.test.js`, `review-queue-buckets.integration.test.js` | ✅ |
| UX-09 | The assessment projection, request-title search and the new filters, on both lists | Strapi integration | quick run `assessment-workflow.integration.test.js` | ✅ |
| UX-09 | Queue and assessment columns, mobile cards and local dates | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/assessments/assessment-list.test.tsx` | ✅ |
| UX-09 | Every figure has an href or is a documented sum; figure = list total per kind | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/reports src/features/analyst-dashboard src/features/home`; E2E `analyst-insights.spec.ts` (tile = list) | ✅ / ❌ W0 (the audit) |
| UX-09 | "Released" in both label maps; stored and query values unchanged | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/components/csrm/status-badge.test.tsx src/features/assessments/assessment-status-filters.test.tsx`; `assessment-navigation-lifecycle.spec.ts` | ✅ |
| UX-09 | The Related assessment picker finds by request title | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/risks/risk-actions.test.ts`; `risk-register-workflow.spec.ts` | ✅ |
| UX-10 | The action validates the term, picks lists by capability, runs five per list, returns display fields and hrefs, and never calls the client directly | web unit | `pnpm --filter @csrm/web exec vitest run src/features/quick-find` | ❌ W0 |
| UX-10 | The dialog's keyboard (open by shortcut or control, arrows, Enter, Escape with focus return), the live region, the guard on navigation | web unit | `pnpm --filter @csrm/web exec vitest run src/features/quick-find src/components/shell` | ❌ W0 |
| UX-10 | At 1440px and 375px: find by number and by title, open with Enter; the Secondary Requestor finds none of Jane's records; axe clean with the dialog open | E2E | `pnpm --filter @csrm/web test:e2e e2e/quick-find.spec.ts` | ❌ W0 |
| DASH-03 | The stage partition (released + under assessment = scope, disjoint); accepted; partial-release rows in neither | Strapi integration | quick run `risk-register.integration.test.js`, `analyst-dashboard.integration.test.js`, `analyst-reports.integration.test.js` | ✅ |
| DASH-03 | Widgets and reports state their scope; the accepted marker; under assessment separate | web unit + E2E | `pnpm --filter @csrm/web exec vitest run src/features/analyst-dashboard src/features/reports`; `analyst-insights.spec.ts` | ✅ |
| All | The contract chain: specification, generated client, parity guard, chain guard, catalogue copies, served operations, matrix | web unit + Strapi | `pnpm --prefix apps/csrm api:check`; `pnpm --filter @csrm/web exec vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; quick run `authorization-matrix.integration.test.js`, `served-operations.integration.test.js`, `contract-catalogue.integration.test.js` | ✅ |
| All | Copy guard with the dashboard, report, Risk Register and navigation files added | web unit | `pnpm --filter @csrm/web exec vitest run src/lib/performance/interface-copy-guard.test.ts` | ✅ (after Phase 10) |

### Sampling Rate

- **Per task commit:**
  - the touched web files by path;
  - `typecheck` when types change, and `api:check` after a spec change;
  - touched Strapi files only with the dev servers stopped, otherwise recorded as pending for the plan's end.
- **Per wave merge:**
  - the full web suite, typecheck and `api:check`;
  - the full Strapi suite after each Strapi plan;
  - the plan's targeted Playwright specs.
  - Plans 11-02, 11-03 and 11-10 change the shell every journey passes through, so each ends with one full Playwright run.
- **Phase gate:** plan 11-15 runs the five commands on the production build, confirms a clean tree and identical catalogue copies, and runs the 375px and 1440px checks for three actors.

### Wave 0 Gaps

- [ ] `apps/csrm/src/config/navigation/navigation.test.ts`: profiles, sections, label = heading (UX-07).
- [ ] `apps/csrm/src/components/shell/navigation-counts.test.ts`: capability-chosen reads, fail-soft, zero hidden (UX-07).
- [ ] `apps/csrm/src/features/home/*.test.tsx`: variant selection, order, holder sections (UX-08).
- [ ] `apps/csrm/src/features/quick-find/*.test.ts(x)`: the action and the dialog (UX-10).
- [ ] `apps/csrm/e2e/navigation-and-home.spec.ts` (`@journey` for the mobile project) (UX-07, UX-08).
- [ ] `apps/csrm/e2e/quick-find.spec.ts` (`@journey`) (UX-10).
- [ ] `apps/backend/tests/my-requests.integration.test.ts`, and optionally a unit file for the query parser (UX-08, D-02 item 6).
- [ ] A figure-link audit, as a unit test beside the report and Home presentation modules (UX-09).

No framework install is needed; the existing infrastructure covers the runners.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | No frontend facade: the typed openapi-fetch service layer and Server Actions only; the chain guard and the served-operations inventory |
| V2 Authentication | no | The development session is unchanged; Keycloak stays disabled (INT-02) |
| V3 Session Management | no | No session change; Phase 10's zone cookie is reused |
| V4 Access Control | yes | Strapi policies with exact grants: `GET /v1/my_requests` under the Requestor's My Requests grant with the owner scope from the policy's numeric id; `queue=all` under the explicit analyst grant (`requireAnalystRequestCollectionScope`); quick find reads only through scoped list operations; Home picks its variant before any read; a new six-actor matrix row |
| V5 Input Validation | yes | Zod on the quick-find term (2 to 100 characters); closed enums and bounded pages for every new filter on the server (`risk-register-query.ts`, `collection-scope.ts`, `assessment-scope.ts` patterns); `LIKE` escaping (`literalContains`, and the `!` escape in the Risk Register) |
| V7 Error Handling | yes | Counts and quick-find groups fail soft without internal detail; Strapi's safe error envelopes stay |
| V8 Data Protection | yes | Quick find returns display fields and hrefs only; `MyRequestItem` carries request facts and the lifecycle, never an unreleased Risk Assessment's identity (the existing availability rules) |
| V11 Business Logic | yes | Bounded reads (5 per list; one-row counts; page caps); debounce and one call in flight |
| V13 API | yes | One newly served operation with a closed query; changed responses stay `additionalProperties: false` and are parsed closed |

### Known Threat Patterns for Next.js Server Actions and Strapi list reads

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reading another Requestor's requests through `GET /v1/my_requests` by a crafted `holder`, `status` or `q` | Information disclosure | The owner predicate joins on the policy-resolved numeric id, and no query value reaches the owner check; closed keys; matrix row and integration proofs |
| Quick find surfacing records the viewer cannot read | Information disclosure | Every group is an existing scoped list read; E2E as the Secondary Requestor searches Jane's title and request number and finds nothing |
| Requestors learning analyst figures through the sidebar counts | Information disclosure | Counts are chosen by capability, and Strapi refuses analyst reads for Requestors, so a 403 shows no badge; unit proof |
| The Home or the holder disclosing an unreleased Risk Assessment to its Requestor | Information disclosure | Items carry request facts and the lifecycle step only; no assessment number or href until release (`relationship-scope.ts:80-101` rules) |
| SQL injection through new filters or `q` | Tampering | Closed enums mapped to constant SQL fragments; bound parameters; escaped `LIKE` |
| Quick-find flooding | Denial of service | Debounce; at least two characters; five per list; sequential dispatch; one call in flight |
| A cross-origin Server Action | Spoofing | Next's origin check (08 D-48); the session cookie identity; the action's input validated |
| An open redirect through `/app/review` | Tampering | The config redirect has a fixed destination |

## Sources

### Primary (HIGH confidence)
- **The codebase**, read this session:
  - the web: navigation, shell, layout, Home, dashboards, reports, lists, stepper, hub, schemas, services, tests and E2E specs, at the file:line references above;
  - Strapi: the policy, the request, queue, assessment, Risk Register, dashboard and report services, the lifecycle, the seeds, the content types and the tests;
  - the contract: `docs/references/specification.json`, the catalogue and `served-operations.json`.
- **The Next.js 16.3.6 bundled docs** (`apps/csrm/node_modules/next/dist/docs/01-app/`): `03-layouts-and-pages.md`, `06-fetching-data.md`, `server-actions.md`, `revalidatePath.md`, `redirects.md`, `permanentRedirect.md`, `proxy.md` (Execution order), `lazy-loading.md`.
- **The installed `cmdk` 1.1.1** (`node_modules/cmdk/package.json` and `dist/index.mjs`) and `npm view cmdk`.
- **Planning:** `.planning/workstreams/csrm/phases/10-existing-flow-gap-closure/10-CONTEXT.md`, `10-UI-SPEC.md` and plans 10-01, 10-02, 10-04, 10-08, 10-14 and 10-15; `.planning/workstreams/csrm/phases/07-analyst-dashboard-reports-and-alerts/07-CONTEXT.md`; `.planning/workstreams/csrm/uat/product-gaps/`.

### Secondary (MEDIUM confidence)
- W3C WAI-ARIA APG, the combobox pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ (the keyboard and roles for a combobox with a listbox popup).
- W3C WAI-ARIA APG, the modal dialog pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ (focus on open and close, Escape, the roles).
- The cmdk README: https://github.com/pacocoursey/cmdk (`shouldFilter`, `Command.Empty`, `loop`, `Command.Dialog` over Radix).

### Tertiary (LOW confidence)
- The [ASSUMED] items A1 to A6, each with a planned proof or a manual check.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new package; the installed versions were verified.
- Architecture: HIGH for the codebase-grounded patterns (holder, stage, streaming counts, config redirect); MEDIUM for A1 to A3.
- Pitfalls: HIGH. Each is tied to a file and line or a bundled doc.
- Contract proposals: HIGH on feasibility (fields and relations exist); the names are the planner's.

**Research date:** 2026-09-28
**Valid until:** 2026-10-28, or until Phase 10 executes. Re-check the Phase 10 overlap table against Phase 10's summaries before planning each Phase 11 plan.
