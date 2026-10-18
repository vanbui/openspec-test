# Phase 11: Navigation, landing and list clarity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 11-navigation-landing-and-list-clarity
**Mode:** `--auto`. No question reached the user. Each area took the recommended option, grounded in the UAT, the delegated decisions (`NEXT-WAVE-DECISIONS.md`), the orchestrator's seeds, Phase 10's plans and a read of the code.
**Areas discussed:** sidebar structure and labels; sidebar counts; Home and the `/app/review` route; the Requestor's split by holder; the phone lifecycle stepper; review list columns and search; figures that open their lists; exposure scope; the Released label; quick find; copy and local time.

**Checks before the discussion:**
- `check_blocking_antipatterns`: no `.continue-here.md` in the phase directory.
- `check_spec`: no SPEC.md.
- `check_existing`: no CONTEXT.md and no plans.
- `cross_reference_todos`: `todo.match-phase` was not run separately. `STATE.md` lists no pending todo for this phase, only v1.0 deferred items acknowledged at the milestone close.
- Codebase maps: `.planning/codebase/` does not exist, so the grep fallback was used (about 60 files read).

---

## Sidebar structure and labels

| Option | Description | Selected |
|--------|-------------|----------|
| Sections per actor as data, following REPORT §5 | One navigation profile per actor, chosen from capabilities; sections named by job; labels equal to page headings; New request as a button; the analyst's own requests collapsed | ✓ |
| Keep one item list and add more group headings | Smallest change, but "My" items would still sit beside review items, and the order would not follow the job | |
| Per-role hand-written sidebars | Clear, but duplicates the layout per role, against brief §9 ("generated from role/capability configuration") | |

**Choice:** [auto] Q: "How should the sidebar be structured?" → Selected: "Sections per actor as data" (recommended).
**Notes:**
- **Labels:** "My questionnaires" was chosen over REPORT's "Questionnaires to answer", because the list also shows submitted questionnaires; its count says how many are waiting.
- **New request:** the page heading "New assessment request" becomes "New request", because in the analyst's own section it is a nav item, and "New Request" is already its route title.
- **Exact strings:** left to the UI-SPEC.

## Sidebar counts and their reads

| Option | Description | Selected |
|--------|-------------|----------|
| Existing aggregate reads, started in the layout and streamed to the navigation | 2 reads for a Requestor and 4 for an analyst; fail-soft; refresh on every server render | ✓ |
| One new "navigation counts" operation | One read per render, but a new operation and grant for every actor | |
| Client polling through a Server Action | Always fresh, but polls against direction do-not 9, and queues behind other actions | |

**Choice:** [auto] Q: "Where do the counts come from?" → Selected: "Existing aggregate reads, streamed" (recommended).
**Notes:**
- **The "extra list reads" follow-up is stale:** Phase 7 replaced the Requestor dashboard's seven count reads with one group-by (`MILESTONES.md:121`), and the Home today makes six bounded reads.
- **The analyst's queue count** is the queue's own total at page size 1, so the badge and the list cannot disagree.

## Home per actor and the `/app/review` route

| Option | Description | Selected |
|--------|-------------|----------|
| `/app` is Home for every actor; `/app/review` redirects in `next.config.ts` (307) | One URL for Home; the variant is chosen from capabilities before any read; a real redirect status, because config redirects run before the streamed page | ✓ |
| Keep `/app/review` as the analyst Home and redirect analysts away from `/app` | Two URLs for "Home" and a redirect on every analyst landing | |
| Page-level `permanentRedirect` on `/app/review` | Streams a meta-refresh with status 200 under the `(app)` loading boundary, and a cached 308 blocks reusing the path | |

**Choice:** [auto] Q: "Where does the analyst Home live, and what happens to /app/review?" → Selected: "/app for every actor; config redirect 307" (recommended).
**Notes:**
- **What this reverses:** 07 D-15 ("`/app` stays the personal dashboard"), under the ROADMAP's decision that analysts land on the analyst Home.
- **Recovery copy:** "Return to workspace" moves to Home.
- **Sign-in:** the sign-in helpers assert "Home".

## The Requestor's split by holder

| Option | Description | Selected |
|--------|-------------|----------|
| Serve the reserved `GET /v1/my_requests` with a server-derived holder, and add holder counts to the status summary | The same SQL lifecycle facts as the review queue, so totals are exact; My requests gains the holder filter its figures need; the catalogue already reserves and grants the operation | ✓ |
| Compose in the web from the drafts list, the questionnaire list and status-filtered request lists | No contract change, but the web would re-derive the lifecycle (against "every figure is the server's"), and the stored `questionnaire-in-progress` status covers three holders (UAT-003) | |
| Keep the stored-status tiles and add a holder label to each | Leaves the tiles that misled | |

**Choice:** [auto] Q: "How is 'Needs your action' separated from 'With the Security Analyst'?" → Selected: "Server-derived holder through `GET /v1/my_requests`" (recommended).
**Notes:**
- **Scope beyond the ROADMAP line:** this adds a served operation that the ROADMAP's contract line ("extra queue projection fields, a released or under-assessment dimension on exposure") does not name. It is API only, with no content-type change and no new grant. Reported to the orchestrator.
- **The lifecycle's `holder`:** added beside the existing `actor` (the viewer), so the hub and the stepper name who holds the work without matching strings.

## The phone lifecycle stepper

| Option | Description | Selected |
|--------|-------------|----------|
| Compact below 768px: heading, "Step n of m", the next action, and a "Show all steps" disclosure | Meets UX-08 criterion 3; keeps the asserted heading "Current lifecycle state: …" | ✓ |
| A horizontal scrolling stepper on phones | Still hides the next action; horizontal scroll inside the page | |
| Hide the stepper on phones | Loses the lifecycle entirely | |

**Choice:** [auto] Q: "How does the stepper read on a phone?" → Selected: "Compact with disclosure" (recommended).
**Notes:** whether the hub also repeats the Next action line at phone width is left to the UI-SPEC. If it does, the `/^Next action:/` locators at 375px change deliberately.

## Review list columns and search

| Option | Description | Selected |
|--------|-------------|----------|
| Server projection plus columns; search by number or title; a `queue=all` bucket; no column chooser | Meets UX-09 criterion 1 and UAT-035; the column chooser waits for Phase 18's DataTable work | ✓ |
| The same, plus a column chooser now | Not asked for by UX-09; Phase 18 would design it again for the risk table | |
| Compute age and look up the requestor in the web | The requestor needs a populate the queue does not do today, and the age would move with render time | |

**Choice:** [auto] Q: "What does each review list show, and who computes it?" → Selected: "Server projection, no column chooser" (recommended).
**Notes:**
- **The column chooser:** Phase 10's deferral note had pointed column choice at Phase 11; it is re-deferred to Phase 18 with that reason.
- **The Related assessment picker:** it moves to the server-side assessment search, by number, summary or request title.

## Figures that open their lists

| Option | Description | Selected |
|--------|-------------|----------|
| Exact-predicate links, adding closed list filters where missing; one labelled exception for control implementations | Keeps 07 D-18, D-24 and D-36 (equal totals); control implementations have no list, so their figures open the Risks that hold them, and the link says so | ✓ |
| Link figures to the nearest list, even when its total differs | Cheap, but breaks the equal-total rule the analyst dashboard proves today | |
| Link only the figures that already have a filter | Leaves the throughput report and most report tables unlinked (UAT-048) | |

**Choice:** [auto] Q: "How far does 'every figure opens its filtered list' go?" → Selected: "Exact links with new closed filters" (recommended).
**Notes:** the treatment-performance report's window moves from 30 to 14 days. That gives "due soon" one meaning across the product, and makes its due-state figures equal the Risk Register's due-state lists.

| Alternative for the treatment window | Why not |
|---|---|
| Keep 30 days, and add "treatment open" and "no target date" filters to the Risk Register | Two more filters, and two meanings of "due soon" |

## Exposure scope

| Option | Description | Selected |
|--------|-------------|----------|
| Released by default, under assessment separate, accepted marked, on the exposure figures; other figures state their scope | Decision 11; the stage split is the Risk Register scope's own two branches; the alert rules stay as they are | ✓ |
| Released only on every Risk-derived figure, alerts included | Changes the alert rules and the analyst's work view; belongs with Phase 21's per-audience metric sets | |
| A scope toggle on each widget | More interaction than DASH-03 asks for | |

**Choice:** [auto] Q: "What does exposure count, and where does the rule apply?" → Selected: "Released by default on exposure; other figures say what they count" (recommended).
**Notes:** until Phase 17.1 records acceptance facts, "accepted" means a released, open Risk whose treatment action is Accept.

## The Released label

| Option | Description | Selected |
|--------|-------------|----------|
| "Released" for display everywhere; the stored and query values unchanged | Decision 16; one word for one outcome | ✓ |

**Choice:** [auto] Q: "What does a released request read?" → Selected: "Released" (the decided option).
**Notes:** both label maps change together, and the root `CONTEXT.md` glossary changes with them.

## Quick find

| Option | Description | Selected |
|--------|-------------|----------|
| The shadcn Command over the installed cmdk 1.1.1, one Server Action over the existing list searches, lazy-loaded | No new dependency; server-scoped results; within the route JavaScript budget | ✓ |
| A Route Handler search endpoint | A frontend API facade, against the project rules | |
| A hand-built combobox dialog | Re-implements the APG combobox keyboard handling that cmdk already provides | |

**Choice:** [auto] Q: "How is quick find built?" → Selected: "Command over cmdk, Server Action, lazy-loaded" (recommended).
**Notes:**
- `cmdk` 1.1.1 is already a dependency (`apps/csrm/package.json`, MIT) and `components/ui/command.tsx` exists unused, so no dependency is added.
- **cmdk settings:** its default client filter and its Ctrl+J/K/N/P bindings are turned off.
- **The shipped `CommandDialog`** renders its title outside the dialog content, so the dialog is composed with its title inside.
- **Server Actions** run one at a time per client, so the search coalesces to the latest term.

## Copy and local time

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite "contextual Risks" with DASH-03's scope wording, add the files to Phase 10's copy guard, and show instants in local time through Phase 10's helper | Closes the two items Phase 10 deferred here | ✓ |

**Choice:** [auto] Q: "How are the deferred copy and time items handled?" → Selected: as above (recommended).
**Notes:**
- **What changes:** the review queue's Submitted date, My requests' Updated date, the Home dates, Recent activity, and My risk assessments' release date.
- **What stays:** calendar dates, and the reports' server-computed UTC buckets and as-at dates.
- **Alerts** carry calendar dates only.

---

## Planner's Discretion

- Where the navigation profile, the count composition, the Home variants, the quick-find modules and the SQL helpers live.
- The Home section sizes, within the bounds set in CONTEXT.
- The debounce value and the quick-find prefetch trigger.
- Whether `/app`'s `loading.tsx` stays.
- Parameter and field names, within the closed vocabularies.
- Splitting large plans, while one owner holds each shared file per wave.

## Deferred Ideas

- **Phase 13:** the assignee column, "Assigned to me", and renaming the "Requires my attention" queue.
- **Phase 18:** a column chooser on the review lists.
- **Phase 20:** My risks and treatments; the type views.
- **Phase 21:** team job health (failed and draft jobs); trends; released-only treatment, control and alert figures.
- **Phase 22:** the Admin profile.
- **Phase 17:** the notification centre in the header.
- **Not requested by any finding:** list sorting by Risk count or rating; quick-find recents and commands; the collapsed icon rail; a user menu (INT-02).
