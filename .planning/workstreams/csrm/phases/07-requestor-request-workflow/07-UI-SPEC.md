---
phase: 7
slug: requestor-request-workflow
status: approved
shadcn_initialized: true
preset: new-york / neutral / Radix / CSS variables / Lucide
created: 2026-08-22
inherits: 06-UI-SPEC.md
---

# Phase 7 — Requestor Request Workflow UI Design Contract

> This contract extends the approved Phase 6 shell, visual tokens, responsive geometry, and WCAG 2.2 AA rules. Where it is silent, [Phase 6 UI-SPEC](../06-create-the-idambox-csrm-next-js-application/06-UI-SPEC.md) is binding. This phase adds only the Requestor-owned Risk Assessment Request workflow.

---

## Scope and source decisions

Implement the Requestor dashboard, My Requests, New Request, and Request Details routes. Enable the existing central Requestor routes (`/`, `/requests`, `/requests/new`, `/requests/[requestId]`) through the capability registry; do not create parallel navigation or role-name checks. The `Risk Assessment Requests` navigation group becomes visible only through its enabled capability-authorized entries.

All domain wording and fields use the persisted `CsrmAssessmentRequest` model. Use **Risk Assessment Request**, **Information System**, and **Information Asset**; never call a request a ticket, case, or generic item when its type is known. Render request data from the typed Strapi service boundary. The current identity, record ownership, capability, and permitted transition determine every visible action; UI concealment is never authorization.

| Decision | Contract | Source |
|----------|----------|--------|
| Data boundary | Phase 7 reads and persists requests and catalogue selections through the typed Strapi boundary. Backend ownership enforcement prevents a Requestor from discovering or changing another Requestor's record by identifier. | 07-CONTEXT D-01, D-02 |
| Requestor editing | A Requestor may edit only an owned `draft`. Submitted requests may be withdrawn back to `draft` only before analyst processing begins. `questionnaire-in-progress`, `risk-assessment-drafted`, `under-review`, `approved`, and `closed` are read-only to the Requestor. | 07-CONTEXT D-03 |
| Analyst draft collaboration | A Security Analyst may view and edit a Requestor's unsubmitted draft. The status stays `draft`; the Requestor must submit it. | 07-CONTEXT D-04, D-05 |
| Form shape | Use one progressive, sectioned page—not a wizard—and never add frontend-only domain fields. | 07-CONTEXT D-06, D-07 |
| Catalogue relations | Information Systems and Information Assets are independently searchable multi-selects and are optional. | 07-CONTEXT D-08 |
| Conditional detail | Show `thirdPartyDetails` only after `thirdPartyInvolvement` is set to Yes; it is required only for submission. | 07-CONTEXT D-09 |
| List behavior | My Requests defaults to most recently updated first and offers keyword search and status filtering only in its first release. Desktop uses a table; mobile uses request cards. | 07-CONTEXT D-11, D-12 |

`requestNumber`, `requestor`, `requestStatus`, and `submittedDate` are system/transition-owned: never make them user-editable form controls. Show `requestNumber` only after persistence. `sponsor` may be displayed as `Not provided` when returned, but has no Phase 7 editing control because no authorised sponsor selector is defined. Do not expose the backend DELETE operation in this phase.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui, initialized in `apps/csrm` |
| Preset | `new-york`, neutral base, CSS variables, Radix primitives, RSC, Tailwind v4 |
| Component library | Radix through shadcn/ui; compose CSRM-owned request components rather than copying per-route markup |
| Icon library | Lucide React only; icon-only controls require an accessible name and desktop tooltip |
| Font | Inter variable via `next/font`, fallback `ui-sans-serif, system-ui, sans-serif` |
| Theme | Use existing semantic `:root` / `.dark` variables and semantic Tailwind utilities only; no raw hex values in TSX |
| Registry | Official shadcn registry only; no third-party registry, block, or copied remote component |

Use the existing `AppShell`, `PageHeader`, state components, Button, Card, Alert, Sheet, Skeleton, Tooltip, Dropdown Menu, and Breadcrumbs. Add only official shadcn primitives required by this phase: `badge`, `dialog`, `alert-dialog`, `input`, `label`, `textarea`, `select`, `popover`, `command`, `table`, and `pagination` (or their current official equivalents).

Build and reuse these CSRM compositions:

| Composition | Required visual and interaction contract |
|-------------|------------------------------------------|
| `RequestStatusBadge` | Compact readable badge: `Draft` uses muted/neutral surface; `Submitted` and `Questionnaire in progress` use warning; `Risk assessment drafted` and `Under review` use info; `Approved` uses success; `Closed` uses neutral. Always render the text label, never colour alone. |
| `RequestListControls` | A labelled search field (`Search requests`) and labelled Status select, followed by sort and pagination controls. Controls retain their layout while results load and write their state to the URL so an in-page reload/back navigation preserves it. |
| `RequestTable` / `RequestCardList` | One semantic desktop table and one mobile card-list presentation of the same paginated result set. Both expose a single record link named by request title and number; cards do not hide status, updated date, or action-needed state. |
| `RequestForm` | One `<form>` divided by headings and separators into four progressive sections; draft saving and submit validation share the same persisted fields and server error mapping. |
| `CatalogueMultiSelect` | Labelled, searchable `Popover` + `Command` multi-select for Information Systems and Information Assets. It announces selected count, supports keyboard search/removal, shows selected tokens with named remove buttons, and never treats an empty selection as invalid. |
| `RequestWorkflowPanel` | A compact status banner at the top of Request Details with a text status badge, next-step sentence, and only currently permitted action(s). It is not a decorative multi-step tracker. |
| `UnsavedChangesDialog` | Route/action interception dialog used only when dirty form data would be discarded. Focus starts on `Keep editing`; `Discard changes` is destructive. |

Button and state rules remain inherited: primary blue filled, secondary bordered, ghost, destructive; 40px desktop and 44px touch targets; one primary action per visual action group. New dialogs manage focus, expose their accessible label/description, dismiss with Escape, restore focus to their trigger, and default focus to the safest non-destructive action.

---

## Spacing Scale

Use the inherited 4px scale without additions: `xs` 4px, `sm` 8px, `md` 16px, `lg` 24px, `xl` 32px, `2xl` 48px, `3xl` 64px. The 44×44px mobile/touch target remains the sole exception.

- Page geometry, shell sizes, gutters, 1440px canvas, and desktop/tablet/mobile breakpoints remain exactly as Phase 6.
- Dashboard widgets use 24px card padding and 24px gaps. Use a one-column stack below 768px, two columns at 768–1199px, and at most three balanced columns at 1200px and above.
- My Requests keeps a 16px gap between controls and results; table rows are at least 48px high. Card-list items use 16px padding, 16px gaps, and a 44px minimum action/link target.
- The form uses 32px between sections, 24px within a section, 16px between labelled controls, and 8px label-to-control spacing. At 1024px and above, place only short related controls in two columns; all text areas and catalogue selectors span the full form column. At narrower widths, all fields are one column.
- The maximum readable form column is 672px. Request Details summary may use a two-column definition layout at 1024px and above; it collapses to one column below 768px.

---

## Typography

Use exactly the inherited four sizes and two weights; do not introduce a compact data-table type scale.

| Role | Size | Weight | Line Height | Usage in this phase |
|------|------|--------|-------------|---------------------|
| Label | 14px | 600 | 1.2 | Field labels, table headers, filters, status labels, metadata labels |
| Body | 16px | 400 | 1.5 | Request content, cards, form values, helper and error text |
| Heading | 20px | 600 | 1.2 | Dashboard widget titles, form-section headings, dialog/state titles |
| Display | 28px | 600 | 1.2 | Page title only |

Request titles wrap naturally in detail and form surfaces. In tables, titles truncate at two lines with the complete title available through the record link's accessible name; request numbers, status labels, dates, and filter labels stay one line. Long descriptions, purposes, third-party details, and regulatory requirements wrap with `overflow-wrap:anywhere`; never cause horizontal page scrolling.

---

## Color

Retain the inherited 60/30/10 composition and token values. The request workflow must not add new colours or gradients.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `background` / `#F7FAFC` | Application canvas and page background |
| Secondary (30%) | `surface` / `#FFFFFF` and `surface-muted` / `#EDF4F6` | Cards, forms, table/card containers, quiet status surface |
| Accent (10%) | `accent` / `#087F8C` | Inherited active-route rule, selected catalogue item indicator, concise workflow progress/confirmation icon only |
| Primary | `primary` / `#075E9B` | `New request`, `Save draft`, `Submit request`, record links, and focus-adjacent active indicators |
| Destructive | `destructive` / `#B42318` | Discarding unsaved changes and blocking errors only |
| Semantic status | Existing `success`, `warning`, `info`, and neutral surfaces | Text-labelled request-status badges and action-needed callouts only |

Accent is reserved for the active navigation rule, selected catalogue option, concise non-destructive confirmation icon, and concise workflow progress indicator. It must not become a default form border, dashboard-card fill, or all-interactive-control colour. Status badges pair a semantic background/border treatment with their exact text label and meet contrast requirements.

---

## Route and screen contracts

### Requestor dashboard (`/`)

Title: `Dashboard`. Page action: `New request` when the centralized capability permits it. The visual order is action-first:

1. **Needs your attention** — a full-width card/list of owned `draft` requests and any later status that requires Requestor action. In this phase, an empty result must say `You have no requests requiring action.` Each item links to Request Details and shows title, request number, status, and one exact next-step sentence.
2. **Recently submitted** — owned submitted-or-later requests, newest submitted first, with title, request number, status, and submitted date. Empty copy: `You have not submitted any requests yet.`
3. **Request status** — data-driven status-summary cards with label, count, and an accessible link to My Requests filtered to that status. Do not show a zero-valued visual metric without its label.
4. **Notifications** — relevant workflow notices only. When none exist, render the compact empty message `No new notifications.` Do not fabricate alerts, risk data, questionnaires, or released assessments in this phase.

Widgets preserve their final card geometry with skeletons during loading. A widget load failure renders an inline retry error while other dashboard content remains available; a whole-page failure uses the shared error state.

### My Requests (`/requests`)

Title: `My Requests`. Primary action: `New request`.

Desktop at 768px and above uses a semantic table with sortable headers: **Request**, **Status**, **Assessment type**, **Updated**, and **Actions**. `Request` contains title plus request number. Only the active sort has an `aria-sort` value; its button announces direction. Default sort is `Updated: newest first`. The visible sort control offers `Updated: newest first`, `Updated: oldest first`, and `Title: A–Z`; changing it resets pagination to page 1 and returns focus to the results heading.

At less than 768px replace the table—not merely its columns—with one request card per result. A card shows title/link, request number, status, assessment type when supplied, updated date, and an explicit `View request` link. Search, status filter, sort, result count, and pagination remain above/below the cards in the same order and never require horizontal scrolling.

Search filters by request title and request number after a 300ms debounced input; do not send a request on every keystroke. The Status filter includes `All statuses` plus the persisted statuses. Show result count using `1 request` / `{n} requests`. Pagination is labelled `Request pagination`, includes previous/next and current page, disables unavailable controls, and announces the loaded result range. No reset button is necessary; clearing search and selecting `All statuses` is the explicit reset.

No results from an active search/filter: heading `No matching requests`; body `Try changing your search or status filter.`; action `Clear filters`. No owned records: heading `No risk assessment requests yet`; body `Start a request to provide the context needed for a cyber risk assessment.`; primary action `New request`.

### New Request and Request Details (`/requests/new`, `/requests/[requestId]`)

Breadcrumbs: `Risk Assessment Requests` → `New request` or the persisted request title. Page titles: `New risk assessment request` and the request title. A saved request adds the request number as muted metadata below the title.

The page is one progressive form with these visible sections, in this order:

| Section | Persisted controls | Submission rule |
|---------|--------------------|-----------------|
| Request details | `title`, `description`, `assessmentType` | Title, description, and assessment type required on submit; only title required for Save draft. |
| Business context | `division`, `businessUnit`, `businessPurpose`, `businessCriticality`, `dueDate` | Business purpose and business criticality required on submit; division, business unit, and due date optional. |
| Third-party and regulatory context | `thirdPartyInvolvement` as explicit Yes/No radio group; conditional `thirdPartyDetails`; `regulatoryRequirements` | The Yes/No choice is required on submit. When Yes, third-party details is required; regulatory requirements optional. When No, hide and clear the details field before submit. |
| Related CSRM catalogue records | `informationSystems`, `informationAssets` | Both optional searchable multi-select relations; no selection is a valid state. |

Each required field carries visible `Required` helper text only after submit validation (not permanently beside every label); optional fields do not need a label suffix. Provide concise helper text before catalogue selections: `Search and select all that apply.` Use native/controlled date input labelled `Requested due date`; do not infer a due date.

For a Requestor-owned draft, keep `Save draft` as the primary action and `Submit request` as the adjacent secondary action until all submit requirements are valid. On a new form, `Save draft` first creates the record then routes to Request Details with confirmation `Draft saved.` On an existing draft, save stays in place and announces `Draft saved.` Buttons disable only while their own request is in flight; prevent double submission.

Selecting `Submit request` first runs submit validation. If valid, open a confirmation dialog:

- Title: `Submit risk assessment request?`
- Body: `Once submitted, your request will be available for Security Analyst review. You can withdraw it only until processing begins.`
- Actions: `Keep editing` (default focus) and `Submit request` (primary).

On confirmed success, set the server-returned status, announce `Request submitted.`, keep the user on Request Details, and replace editing controls with the workflow panel. Do not optimistically claim a status change before server acknowledgement.

For `submitted` before analyst processing, show `Withdraw submission` as a secondary action in the workflow panel. It opens a confirmation dialog: title `Withdraw this submission?`; body `This request will return to draft and will no longer be available for analyst processing.`; actions `Keep submission` (default focus) and `Withdraw submission`. On success announce `Request returned to draft.` and show the editable form. It is a reversible workflow transition, not a delete action.

When a record is read-only to the current user, display all populated persisted values in the same section order with `Not provided` for optional omissions. The workflow panel names the status and next step: `Submitted — awaiting Security Analyst review.`, `Questionnaire in progress — a questionnaire is being prepared.`, `Risk assessment drafted — a risk assessment draft is being prepared.`, `Under review — a Security Analyst is reviewing this request.`, `Approved — the request has been approved.`, or `Closed — this request is closed.` Do not show disabled form controls as a substitute for a read-only surface.

An analyst editing another Requestor's draft sees an information alert: `You are editing a Requestor draft. The Requestor must review and submit it.` The available save action is `Save draft changes`; no analyst action may silently submit for the Requestor.

### Form feedback, errors, and unsaved work

- On submit validation failure, show a `role="alert"` summary titled `Check the highlighted fields`, list linked field errors, and move focus to the summary. Each invalid control gets `aria-invalid`, an inline error, and programmatic error description.
- Draft saving validates title only. If title is blank, focus its input and say `Enter a request title to save a draft.`
- A failed save/submit preserves all entered values, displays `We couldn’t save your request. Check your connection and try again.`, and provides `Try again`. Map field-specific safe server errors to fields; never expose raw HTTP, Strapi, identifier, token, or stack-trace details.
- Leaving a dirty new or draft form by navigation, breadcrumb, browser back, or a page action opens `Discard unsaved changes?` / `Your changes have not been saved. Do you want to keep editing or discard them?` with `Keep editing` and destructive `Discard changes`. Successful save/submission clears the dirty state. Do not attempt to override browser tab/window-close handling; use the browser's native prompt there where supported.
- Loading Request Details uses the shared final-geometry title, workflow-panel, and section skeleton. An ownership denial never displays any request title, number, status, or whether an ID exists; use the inherited access-denied state. A safe missing record uses the inherited unavailable state.

---

## Responsive and accessibility requirements

All Phase 6 desktop sidebar, 56px mobile header/drawer, landmark order, route announcer, focus-ring, reduced-motion, 200% zoom, forced-colors, and viewport acceptance matrix remain mandatory. Add these Phase 7 checks:

| Viewport | Required evidence |
|----------|-------------------|
| 375×812 | Dashboard cards stack; My Requests renders cards with search, filter, sort, and pagination; form is one column; catalogue popovers and dialogs remain within viewport; every actionable target is at least 44px with no horizontal page overflow. |
| 390×844 and 430×932 | Long request titles, request numbers, badges, summary values, conditional third-party field, confirmation dialog, and error summary remain legible and unclipped. |
| 768×1024 | Drawer/header mode, desktop table, filter/action row, dashboard grid, and two-column short-form controls render without clipping. |
| 1024×768 | Expanded desktop sidebar, table, pagination, page action, Request Details two-column summary, and workflow panel coexist without overlap. |
| 1440×900 | Cards keep meaningful information density, the form remains at its readable maximum width, and table sort/action controls remain discoverable. |

- Use one `h1` per route. The dashboard widgets and form sections are `h2`; never skip heading levels.
- Search, select, radio group, date, and multi-select controls have visible labels and programmatic descriptions. The conditional third-party details field enters the tab order only when visible.
- A table has a caption or `aria-label` identifying it as `My risk assessment requests`; sortable headers are real buttons. Card-list semantics are an accessible list, not clickable nested `div`s.
- Status changes, saved-draft, submit, withdrawal, result-count, and pagination updates announce through the existing polite live region. Validation/server errors use `role="alert"`.
- Skeletons are `aria-hidden`; only one concise loading status is announced. Status is always textual as well as chromatic.
- Maintain focus on the same control after save errors; after successful new-draft save, focus the Request Details `h1`; after submit/withdraw, focus the workflow panel heading.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Dashboard primary CTA / My Requests primary CTA | `New request` |
| Dashboard action widget empty | `You have no requests requiring action.` |
| Recent submissions empty | `You have not submitted any requests yet.` |
| Notifications empty | `No new notifications.` |
| Empty collection heading | `No risk assessment requests yet` |
| Empty collection body | `Start a request to provide the context needed for a cyber risk assessment.` |
| Filtered empty heading/body/action | `No matching requests` / `Try changing your search or status filter.` / `Clear filters` |
| Empty catalogue search | `No Information Systems found` / `No Information Assets found` |
| Draft feedback | `Draft saved.` |
| Submit confirmation | `Submit risk assessment request?` / `Once submitted, your request will be available for Security Analyst review. You can withdraw it only until processing begins.` / `Keep editing` / `Submit request` |
| Submit feedback | `Request submitted.` |
| Withdrawal confirmation | `Withdraw this submission?` / `This request will return to draft and will no longer be available for analyst processing.` / `Keep submission` / `Withdraw submission` |
| Withdrawal feedback | `Request returned to draft.` |
| Submit validation | `Check the highlighted fields` |
| Draft title validation | `Enter a request title to save a draft.` |
| Recoverable write error | `We couldn’t save your request. Check your connection and try again.` / `Try again` |
| Unsaved-work confirmation | `Discard unsaved changes?` / `Your changes have not been saved. Do you want to keep editing or discard them?` / `Keep editing` / `Discard changes` |
| Analyst draft alert | `You are editing a Requestor draft. The Requestor must review and submit it.` |
| Read-only fallback | `Not provided` |

Use sentence case and direct verbs. Phase 6 shared loading, generic collection empty, recoverable-load-error, access-denied, and unavailable copy remains in force for states not made more specific above.

---

## UI Considerations

Applicable state considerations resolved: 8 covered category resolutions, 3 backstop acceptance clusters, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Dashboard widgets, My Requests, new/draft form, catalogue search | ✅ covered | Dashboard and list empty/filtered copy is defined above; a new form deliberately begins unfilled with labels and helper text; catalogue results explicitly show `No Information Systems found` or `No Information Assets found` while retaining the query. |
| loading | Dashboard, request list, form, catalogue search, actions | ✅ covered | Final-geometry skeletons retain headers and controls; catalogue search has an inline loading state; save/submit/withdraw disable only their active action and announce once. |
| error | Dashboard widgets, request list, form, catalogue search, actions | ✅ covered | Whole page uses shared error state; independent dashboard/catalogue errors retry locally; write errors preserve entered form data and map safe field errors. |
| populated | Dashboard, My Requests, catalogue selections | ✅ covered | Widgets have specified action/recent/status/notification content; desktop table/mobile cards show identical essential request data; selections expose count and removable named tokens. |
| partial | Request Details, form, dashboard widgets | ✅ covered | Optional persisted omissions render `Not provided`; successful widgets remain visible when another widget fails; unavailable required data renders an explicit retry error. |
| overflow | Desktop table, mobile cards, form values, navigation | ✅ covered | Cards replace the table below 768px; no horizontal page overflow; titles have specified truncation/wrap behavior and long values wrap anywhere. |
| zero-one-many | My Requests, dashboard widget lists | ✅ covered | Result count uses singular/plural; zero state has bespoke copy; one and many retain the same table/card structure and pagination semantics. |
| long-text | Request titles, long form/detail content, controls | ✅ covered | Detail content wraps; table titles truncate at two lines with an accessible full name; compact labels remain one line. |
| loading | Viewport and assistive-technology state behavior | 🧪 backstop | Playwright plus screen-reader-oriented component evidence verifies no layout shift, one loading announcement, and `aria-hidden` skeletons across list/form/widget loading. |
| error | Permission and write-failure states | 🧪 backstop | HTTP/component tests prove identifier-based ownership denial leaks no record metadata and failed writes retain values, map safe field errors, and expose retry. |
| overflow | Responsive list/form/dialog presentation | 🧪 backstop | Visual/mobile tests at the required widths prove no horizontal page overflow, table-to-card switch, legible long content, and fully visible dialogs/popovers. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Existing `alert`, `avatar`, `breadcrumb`, `button`, `card`, `collapsible`, `dropdown-menu`, `separator`, `sheet`, `skeleton`, `tooltip`; approved additions `badge`, `dialog`, `alert-dialog`, `input`, `label`, `textarea`, `select`, `popover`, `command`, `table`, `pagination` | Not required — official registry only; confirmed 2026-08-22 via `npx shadcn info` |
| Third-party | None | Not applicable — no third-party registry or block is approved |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved — 2026-08-22
