---
phase: 11-navigation-landing-and-list-clarity
plan: 19
subsystem: ui
tags: [quick-find, cmdk, command, radix-dialog, server-action, navigation-guard, next-dynamic, nextjs, vitest, playwright, ux-10, uat-048, d-47, d-48, d-49, d-50, d-51, d-52, x-7, x-8]

requires:
  - phase: 10-questionnaire-and-assessment-workflow
    provides: "10-08: navigation-guard.tsx (NavigationGuardProvider, useNavigationGuard with guardLink, the leave warning)"
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-06: queue=all and filters[q] on the Requests queue; 11-07: request-title search on the assessment lists; 11-10: listMyRequests (GET /v1/my_requests); 11-14: the Risk row's stage; 11-05 and 11-13: the shell and header; 11-01: X-7 and X-8 in the design direction"
provides:
  - "quickFindAction(input: unknown) ('use server'): a strict 2-100 character term, the session's capabilities, the viewer's lists in parallel through the existing service functions at page size 10, five options per group with the served total and Show all above five, display fields and hrefs only; a refused list is left out, a failed or thrown read marks only its own group failed"
  - "quick-find-domain.ts (zod-free): QuickFindGroupKind, QuickFindOption, QuickFindGroup, QuickFindResult, quickFindViewer, quickFindGroupsFor, quickFindShowAllHref, quickFindShowAllLabel, quickFindDescription, matchCount, matchCountLabel, quickFindAnnouncement, isSearchableTerm and the term, group and debounce constants"
  - "QuickFindDialog({ open, onOpenChange, returnFocusTo, viewer }): Radix Dialog with its title and description inside the content, Command (shouldFilter and vimBindings off), the 100-character input, groups named '{label}, {n} matches', two-line options, Show all, one polite region, the 250ms single-flight search, and aria-activedescendant kept on the option cmdk selects by itself"
  - "QuickFindTrigger({ viewer }): the header Search control (aria-keyshortcuts 'Control+K Meta+K', aria-haspopup, aria-expanded), the ⌘ K or Ctrl K hint after mount, the global Ctrl+K and ⌘K shortcut, the dialog through next/dynamic on first open, prefetched on pointer enter or focus"
  - "useNavigationGuard().navigate(href, { trigger, onLeave }): pushes at once when nothing is unsaved (onLeave first), otherwise opens the leave warning"
  - "AppShell: a .header-actions group holding the Search control before the role tag or the account menu, rendered only with assessment-request:read"
  - "globals.css: .header-actions, .header-search (the phone circle), .shortcut-hint, .shortcut-key, the role tag's truncation below 375px, and the X-8 frame from 768px with the option and heading rules"
  - "E2E: UX10_FIND_AND_OPEN (Quick find @journey, desktop and mobile), UX10_ANALYST_GROUPS and UX10_SHOW_ALL (desktop at 1440); quick-find.spec.ts on the mobile project's testMatch"
affects: [11-20, 11-21, 13, 19.1, 20]

actuals:
  tokens: 21630
  tasks: 3
  commits: 6
plan_head_before: ac2ea95b11ffeb36789959dd1f7bfeb4b6b50630
plan_head_after: e2d245ca28d2d3652961b9fdd4ae49633a926d64

tech-stack:
  added: []
  patterns:
    - "A search across lists is one validated Server Action that starts each allowed list's existing service read together and returns display fields and hrefs only; capabilities choose the lists, Strapi scopes every read"
    - "Single flight on the client: a debounced term is sent only when no search is in flight, a newer term waits in a ref, a result is applied only if its term is still the latest, and the waiting term is sent when the search returns"
    - "A dialog body that loads through next/dynamic is mounted only from the first open, and its import starts early on pointer enter or focus of its trigger"
    - "A programmatic navigation that must respect unsaved work goes through useNavigationGuard().navigate(href, { trigger, onLeave })"
    - "Phone rules for a shell control sit in a 767px block after the shell's own phone block, which tests read as the first one"

key-files:
  created:
    - apps/csrm/src/features/quick-find/quick-find-domain.ts
    - apps/csrm/src/features/quick-find/quick-find-actions.ts
    - apps/csrm/src/features/quick-find/quick-find-actions.test.ts
    - apps/csrm/src/features/quick-find/quick-find-dialog.tsx
    - apps/csrm/src/features/quick-find/quick-find-dialog.test.tsx
    - apps/csrm/src/components/shell/quick-find-trigger.tsx
    - apps/csrm/src/components/shell/quick-find-trigger.test.tsx
    - apps/csrm/e2e/quick-find.spec.ts
  modified:
    - apps/csrm/src/components/csrm/navigation-guard.tsx
    - apps/csrm/src/components/csrm/navigation-guard.test.tsx
    - apps/csrm/src/components/shell/app-shell.tsx
    - apps/csrm/src/components/shell/app-shell-account.test.tsx
    - apps/csrm/app/globals.css
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/requestor-request-workflow.spec.ts
    - apps/csrm/playwright.config.ts

key-decisions:
  - "11-19: the shell passes quickFindViewer(granted) ('requestor' or 'analyst') to QuickFindTrigger and the dialog for the per-actor description; the action still chooses lists from the session's own grants"
  - "11-19: a refused (403) list is left out and a failed or thrown list returns status failed with no options and no failure detail; the dialog shows only ok groups until 11-20 renders the failed state"
  - "11-19: the dialog closes through the guard's onLeave on every path, so a blocked navigation keeps quick find open under the leave warning (UI-SPEC §4.6); navigate also runs onLeave before pushing when nothing is unsaved"
  - "11-19: the dialog keeps the input's aria-activedescendant on the option cmdk 1.1.1 selects by itself, which cmdk leaves unset until an arrow key moves it"
  - "11-19: the dialog body mounts only from the first open (an opened flag), so next/dynamic fetches it on first open or on pointer enter or focus of the control, never on route load"
  - "11-19: the X-8 frame from 768px (640px, anchored the header height plus 48px down, the viewport-bounded list) shipped here with the option and heading rules; the phone sheet, footer and states remain 11-20's"
  - "11-19: UX-10 stays open: requirements.ready-ids reports 0/1 ready, because 11-20 and 11-21 also declare it"

patterns-established:
  - "Quick find: a new searchable list is a QuickFindGroupKind with a label, a Show all path, a reader in quick-find-actions.ts through an existing service function, and a place in quickFindGroupsFor"
  - "Programmatic navigation: useNavigationGuard().navigate(href, { trigger, onLeave })"
  - "Header controls: the shell's .header-actions group, before the role tag or the account menu"

requirements-completed: []

coverage:
  - id: D1
    description: "quickFindAction validates a strict 2-100 character term before any read, asks a Requestor's three lists and an analyst's five (the Risk register only with risk:manage, Requests with queue all) in parallel at page size 10, returns at most five options per group with the served total, display fields and hrefs only, Show all above five, a refused list left out and a failed or thrown list marked failed"
    requirement: "UX-10"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/quick-find/quick-find-actions.test.ts (24 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The header Search control renders before the role tag or the account menu only with assessment-request:read, is named Search with aria-keyshortcuts, aria-haspopup and aria-expanded, shows ⌘ K or Ctrl K after mount, and below 768px is an icon-only 44px circle with its label visually hidden and no hint"
    requirement: "UX-10"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/quick-find-trigger.test.tsx and app-shell-account.test.tsx#AppShell header search control"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/app-shell.spec.ts (E26, six widths, no overflow)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ctrl+K and ⌘K toggle quick find anywhere, a text field included, preventing the default only for those keys, ignoring repeat and composition, and doing nothing while another dialog is open"
    requirement: "UX-10"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/shell/quick-find-trigger.test.tsx#the shortcut"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/quick-find.spec.ts#UX10_FIND_AND_OPEN ([desktop] and [mobile])"
        status: pass
    human_judgment: false
  - id: D4
    description: "The dialog is the APG modal dialog with a combobox and listbox: title Search inside it, focus in the input named Search by number or title, groups named '{label}, {n} matches', arrow keys moving the active option with aria-activedescendant, Enter opening it through the guard, Show all opening the filtered list, one polite region announcing the sum of the totals"
    requirement: "UX-10"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/quick-find/quick-find-dialog.test.tsx (10 cases)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/quick-find.spec.ts#UX10_ANALYST_GROUPS"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/quick-find.spec.ts#UX10_SHOW_ALL"
        status: pass
    human_judgment: false
  - id: D5
    description: "Typing is debounced by 250ms, one search is in flight, a newer term waits and is sent when the search returns, and a stale result is dropped"
    requirement: "UX-10"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/quick-find/quick-find-dialog.test.tsx#one search at a time, the latest term winning (D-50)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The guard's navigate pushes at once when nothing is unsaved and opens the leave warning otherwise; Leave runs onLeave then pushes; Keep answering returns focus to the trigger"
    requirement: "UX-10"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/csrm/navigation-guard.test.tsx#the programmatic entry point, navigate (D-51)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The quick-find dialog's look from 768px (640px frame anchored below the header, two-line options, micro-label headings with totals, the hint keys in the header) and the header row at 320 to 375px with the longest role"
    requirement: "UX-10"
    verification: []
    human_judgment: true
    rationale: "No test asserts the rendered frame, the option layout or the role tag's truncation at 320px (the plan marks the 320px statement as a backstop); the 11-21 walkthrough should look at both widths"

duration: 49 min
completed: 2026-10-04
status: complete
---

# Phase 11 Plan 19: Quick find Summary

**Anyone in the shell can press Ctrl+K or ⌘K, or use the header's new Search control, type a number or a word of a title, and open a record they may read.**

- **The search.** One validated Server Action, `quickFindAction`, runs the viewer's existing list searches together through the existing feature service functions:
  - a Requestor's My requests, My questionnaires and My risk assessments;
  - the Security Analyst's Requests (every queue), Questionnaires, Risk assessments, Risk register (with `risk:manage` only) and My requests.
- **What it returns.** At most five options per group with the list's served total, and `Show all {n} in {list}` above five. It returns display fields and hrefs only.
- **The dialog.** It loads through `next/dynamic` on first open. It is built on the source-owned shadcn `Command` over cmdk 1.1.1, with client filtering and cmdk's Ctrl bindings off, and its title sits inside the dialog.
- **Searching.** Typing is debounced by 250ms, one search runs at a time, and the latest term wins. Each group heading reads its total, for example "Requests, 12 matches", and one polite region announces the sum.
- **Opening a result.** Enter opens the active option through the navigation guard's new `navigate(href, { trigger, onLeave })`, so unsaved answers are still protected.
- **Proofs.**
  - Unit tests cover the action, the dialog, the trigger and the guard.
  - The browser journeys prove a Requestor opening a request by its number with Enter at 1440 and 375, the analyst moving through Requests and opening one, and Show all landing on a Risk register list with exactly the group's total.
- **Budget.** Every route stays within its first-load budget. `/app/risks/{documentId}` now has only 1,351 bytes left (see Next Phase Readiness).

## Performance

- **Duration:** 49 min. This includes the RED and GREEN Playwright runs, the tracer re-run, two Task 3 runs, two full web suites and the full Playwright suite (14.5 min).
- **Started:** 2026-10-03T21:07:16Z
- **Completed:** 2026-10-03T21:56:00Z
- **Tasks:** 3 of 3
- **Files changed:** 16 (8 created, 8 modified, none deleted)

## Accomplishments

- **The action (`quick-find-actions.ts`, `'use server'`).**
  - **Validation:** `z.object({ term: z.string().trim().min(2).max(100) }).strict()`. A refused term reads nothing.
  - **Viewer:** the session comes from `getSessionAdapter()`, and the lists come from `quickFindGroupsFor(granted)`. The Risk register is gated on `risk:manage` there and again where the reads start.
  - **Reads:** every list is read at page 1 with page size 10, and all start together (`Promise.all`).
  - **Options:**

    | Kind | Line 1 | Line 2 | Opens |
    |---|---|---|---|
    | Request | `{requestNumber} · {title}` | its status label (`Released` for approved) | `/app/review/requests/{id}` or `/app/requests/{id}` by group |
    | Questionnaire | `{questionnaireNumber} · {title}` | its status label (`Analyst review` while unreleased) | by group |
    | Assessment | `{assessmentNumber} · {requestTitle}` | its status label | by group |
    | Risk | `{riskNumber} · {statement}` | `Residual rating: {rating|Not rated} · {Released|Under assessment}` | `/app/risks/{id}` |

  - **Group results:**
    - A group with no match is omitted, and so is a list Strapi refuses (403).
    - A failed or thrown read gives that group `status: 'failed'` with no options and no failure text.
    - Above five, the group carries `showAllHref` (UI-SPEC §4.3's seven destinations, the term URI-encoded).
  - **Side effects:** it never revalidates, sets a cookie or refreshes. Every read is an existing operation through an existing service file, so `served-operations.json` and the chain guard are unchanged.
- **The domain (`quick-find-domain.ts`, zod-free).** The kinds, labels, viewer, groups, Show all hrefs and label, the description per actor, `matchCount`, `matchCountLabel` (`1 match`, `1,234 matches`), the announcement and the term rule.
- **The dialog (`quick-find-dialog.tsx`).**
  - **Structure:** `Dialog` with `DialogContent showCloseButton={false} data-quick-find` and a visually hidden `DialogTitle` "Search" and description inside it. Then `Command label="Search by number or title" shouldFilter={false} vimBindings={false}`, `CommandInput maxLength={100}` with the same placeholder, and `CommandList label="Search results"`.
  - **Groups:** each group's heading is the label and total in the micro-label lockup, named `{label}, {n} {match|matches}`. Options are two lines, the value is the href, and `onSelect` calls `navigate`. Show all is the group's last option.
  - **Search:** `useSingleFlightSearch` implements the 250ms debounce, one search in flight, a pending term and a stale-result drop (D-50).
  - **Announcement:** one `aria-live="polite"` region.
  - **Accessibility fix:** `useActiveOptionOnInput` keeps the input's `aria-activedescendant` on cmdk's selected option (deviation 1).
- **The trigger (`quick-find-trigger.tsx`).**
  - **Control:** the `Button` (outline, `.header-search`) with a `Search` icon, the label `Search`, and after mount the hint (`⌘` `K` on Apple user agents, `Ctrl` `K` otherwise, `aria-hidden`). It carries `aria-keyshortcuts="Control+K Meta+K"`, `aria-haspopup="dialog"` and `aria-expanded`.
  - **Shortcut:** one capture-phase `keydown` listener on `window` for Ctrl or Meta with K. It skips `isComposing`, `repeat`, Alt, and any open `[role="dialog"]` other than quick find or `[role="alertdialog"]`, and toggles.
  - **Loading:** the dialog comes through `next/dynamic` (`ssr: false`) and mounts from the first open. Pointer enter or focus starts loading it.
  - **Focus:** `document.activeElement` is stored on open for focus return.
- **The guard (`navigation-guard.tsx`).** `navigate(href, options?)` on the context. When nothing is unsaved it runs `onLeave` and then `router.push`. Otherwise it opens the same leave warning, whose Leave runs `onLeave` and pushes. Without a provider it loads the page.
- **The shell (`app-shell.tsx`).** A `.header-actions` group holds `QuickFindTrigger` (only with `assessment-request:read`), then the role tag or the account menu. DOM order is Menu, the title, Search, then the role, so the skip link's next Tab stop is still Menu.
- **CSS (`globals.css`).**
  - **Header:** `.header-actions` (the 8px step, `margin-inline-start: auto`, shrinkable), `.header-search`, `.shortcut-hint`, and `.shortcut-key` (a 1px `--border`, `--radius-sm`, 4px horizontal padding, `--foreground-secondary`, type from `.micro-label`).
  - **Phone:** the 44px circle with a visually hidden label and no hint below 768px, and the role tag truncating below 375px (UI-D10).
  - **Quick find (X-8):** the frame from 768px, the list height, the heading colour and the inline hidden comma, two-line options (a Risk's one line), and the 44px option height below 768px.
- **E2E (`quick-find.spec.ts`; `playwright.config.ts`).**
  - `UX10_FIND_AND_OPEN` sits inside `Quick find @journey`, and `quick-find.spec.ts` joins the mobile `testMatch` and its comment in the RED commit.
  - `UX10_ANALYST_GROUPS` and `UX10_SHOW_ALL` sit outside it, at 1440.
  - E25 scopes My requests' own `Search` button to `main`.

## Task Commits

1. **Task 1: A Requestor presses Ctrl+K, types a request number and opens it with Enter (tracer, TDD)**
   - `9c12e53`: test(11-19), RED. It includes `quick-find.spec.ts` with `UX10_FIND_AND_OPEN` in the `Quick find @journey` describe, and `'**/quick-find.spec.ts'` on the mobile `testMatch` with its comment.
   - `88577cd`: feat(11-19), GREEN
2. **Task 2: The analyst's five groups, Show all, failure isolation and the single-flight search (TDD)**
   - `dd9b883`: test(11-19), RED
   - `80e9ec0`: feat(11-19), GREEN
3. **Task 3: Prove quick find for the analyst in the browser and keep the page Search buttons unambiguous**
   - `fae7010`: test(11-19)
4. **Regression fix (deviation 5):** `e2d245c`: fix(11-19), the shell's phone block first in `globals.css`

The ledger count is `git rev-list --count ac2ea95..e2d245c` = 6. Every commit ends with the `Co-Authored-By` trailer (6 of 6, checked with `git log --format=%B`).

## TDD Gate Compliance

- **Task 1:** RED `9c12e53` comes before GREEN `88577cd`.
  - `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed). The target was "the programmatic entry point, navigate (D-51, UI-SPEC §4.6) > pushes the route at once when nothing is unsaved", which failed with `AssertionError: expected "vi.fn()" to be called with arguments: [ '/app/requests/r-1' ]`.
  - The run failed 9 of 121: 6 assertions, and the 3 new files failing to load because their modules did not exist yet.
  - The evidence record uses vitest's junit output with `name` moved before `classname` in a scratchpad copy, as in earlier plans.
- **Task 2:** RED `dd9b883` comes before GREEN `80e9ec0`.
  - `RED_EVIDENCE_OK` for "quickFindAction for a Security Analyst > reads the five lists in parallel, Requests across every queue, and returns them in the sidebar’s order". Only My requests was read.
  - The run failed 22 of 261, each on an assertion or a missing export (`quickFindShowAllHref`, `matchCountLabel`).
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The exact Task 1 verify was re-run against the committed tree and exited 0: units 168/168, typecheck clean, spec 2 passed (desktop 1, mobile 1, 56.4s), tree unchanged. Task 2 started only after that.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED | 9 failed of 121 (6 assertions, 3 files not yet loadable) |
| Task 1 GREEN verify (quick-find, shell, guard, zod-boundary and chain guards) | 12 files, 168/168; typecheck clean; e2e `tsc` clean |
| Playwright `quick-find.spec.ts` (Task 1) | **2 passed: desktop 1, mobile 1; 0 failed, 0 flaky, 0 skipped; 55.4s**. Tree identical before and after |
| Tracer re-run (Task 1 verify) | exit 0: 168/168, typecheck clean, 2 passed (56.4s), tree unchanged |
| Task 2 RED | 22 failed of 261 |
| Task 2 GREEN verify (plus the copy, zod, guard and chain guards) | 13 files, 289/289; typecheck clean |
| Task 3, first run (quick-find, requestor-request-workflow, app-shell) | 14 passed, 1 failed (`UX10_SHOW_ALL`, my term; deviation 4): desktop 12 passed and 1 failed, mobile 2; 2.4 min. Tree identical before and after |
| Task 3, second run | **15 passed: desktop 13, mobile 2; 0 failed, 0 flaky, 0 skipped; 2.2 min**. Tree identical before and after |
| Full web suite, first run | 146 files, 3,257/3,258: the W-13 page-header CSS test failed (deviation 5) |
| **Full web suite, final** (`pnpm --dir apps/csrm test`) | **146 files, 3,258/3,258** (11-18 ended at 143 files, 3,191) |
| `typecheck`, `lint`, e2e `tsc -p tsconfig.e2e.json` | clean |
| `api:check` | exit 0; `schema.d.ts` unchanged after `git update-index --refresh` |
| **Full Playwright** (`pnpm --dir apps/csrm test:e2e`, production build) | **147 passed: desktop 125, mobile 22; 0 failed, 0 flaky, 0 skipped; 14.5 min** (21:41:13Z to 21:55:42Z; 11-18: 143, desktop 122 and mobile 21). `git status --short` identical before and after the run |
| Strapi | not run: the plan is web only (no Strapi change, no specification change) |

The production server in the full run logged 89 `The destination stream closed early` messages and one `failed-to-find-server-action` (11-18 logged 83 and 1). Every test passed.

**Route first-load JavaScript** (`performance.spec.ts` medians, delivered bytes, budget 300,000 unless noted):

| Route | 11-18 | 11-19 |
|---|---|---|
| `/app` (both actors) | 228,958 | 231,133 |
| `/app/requests` | 250,427 | 252,997 |
| `/app/requests/{documentId}` | 258,921 | 261,496 |
| `/app/questionnaires/{documentId}` (500,000) | 349,599 | 351,772 |
| `/app/review/assessments/{documentId}` | 292,030 | 294,198 |
| `/app/risks` | 262,683 | 265,261 |
| `/app/risks/{documentId}` | 295,724 | **298,649** |
| `/app/reports/risk-exposure` | 254,577 | 256,752 |
| `/app/admin/controls` | 249,411 | 251,586 |

The header control costs about 2.2 to 2.9 KB on every route. The dialog itself loads only on first open.

## Files Created/Modified

- `apps/csrm/src/features/quick-find/quick-find-domain.ts` (new): the zod-free vocabulary, groups, hrefs, labels and counts
- `apps/csrm/src/features/quick-find/quick-find-actions.ts` (new): `quickFindAction`
- `apps/csrm/src/features/quick-find/quick-find-dialog.tsx` (new): `QuickFindDialog`
- `apps/csrm/src/components/shell/quick-find-trigger.tsx` (new): `QuickFindTrigger`
- `apps/csrm/src/components/csrm/navigation-guard.tsx`: `navigate` and `NavigateOptions`
- `apps/csrm/src/components/shell/app-shell.tsx`: `.header-actions` and the control
- `apps/csrm/app/globals.css`: the header, hint, phone and X-8 rules
- Tests:
  - `quick-find-actions.test.ts`, `quick-find-dialog.test.tsx` and `quick-find-trigger.test.tsx` are new.
  - `navigation-guard.test.tsx` gains the `navigate` cases.
  - `app-shell-account.test.tsx` gains the header control cases.
  - `interface-copy-guard.test.ts` scans the four quick-find files.
- E2E:
  - `quick-find.spec.ts` is new.
  - `requestor-request-workflow.spec.ts` carries the E25 change.
  - `playwright.config.ts` adds the file to the mobile `testMatch` and its comment.

## Decisions Made

The key decisions are listed in the frontmatter. In short:
- The shell passes the viewer kind for the description.
- Failed and refused groups are told apart.
- The dialog closes through `onLeave`.
- The input keeps `aria-activedescendant` on the active option.
- The dialog mounts on first open.
- The X-8 frame from 768px ships now.
- UX-10 stays open: `requirements.ready-ids` reports 0/1, because 11-20 and 11-21 also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2: accessibility] cmdk 1.1.1 leaves the input without aria-activedescendant for the option it selects by itself**
- **Found during:** Task 1 GREEN. The Enter test asserted that the input names the active option.
- **Issue:** cmdk marks the first option `aria-selected` when results arrive, but it sets the input's `aria-activedescendant` only once an arrow key moves the selection (a jsdom probe read `true`, `null`, then the id after ArrowDown). The APG combobox (D-48, UI-SPEC §4.5) requires the input to name the active option, otherwise a screen reader hears none.
- **Fix:** `useActiveOptionOnInput`, a callback ref on `CommandList` with a `MutationObserver` that keeps the input's attribute on the selected option. Once cmdk sets the attribute itself the two agree. The shared `command.tsx` is unchanged.
- **Verification:** the dialog unit test and `UX10_ANALYST_GROUPS` (Chrome) both assert that the input names the first option, then the second after ArrowDown.
- **Committed in:** `88577cd`

**2. [Rule 3: blocking] Vitest does not apply vi.mock to a module that a dependency imports dynamically**
- **Found during:** Task 1 GREEN.
- **Issue:** the RED trigger test replaced the dialog with a stand-in through `vi.mock`. Imported through `next/dynamic` in the trigger, the real module still loaded, and so did its action, so `server-only` threw. A probe showed that `vi.mock` applies to the dynamically imported module's own static imports.
- **Fix:** the trigger test loads the real dialog and mocks only its Server Action and the guard. It now proves the real lazy path. After open it reads the control directly, because the modal hides the page from the accessibility tree.
- **Committed in:** `88577cd`

**3. [Rule 1: test timing and harness] Two RED dialog expectations adjusted in GREEN**
- The input's `aria-activedescendant` is set a render after `aria-selected`, so the test waits for it.
- The guard stand-in now runs `onLeave` as the real guard does when nothing is unsaved. The dialog closes through `onLeave` on both the unblocked and the blocked path, which keeps quick find open under the leave warning (UI-SPEC §4.6).
- **Committed in:** `88577cd`

**4. [Rule 1: my test] UX10_SHOW_ALL first searched a phrase only four seeded Risks hold**
- **Found during:** Task 3's first spec run (14 passed, 1 failed).
- **Issue:** "Phase 7 platform" matches four seeded statements; two read "Phase 7 released platform". The group held 4, so it had no Show all.
- **Fix:** the term is "Phase 7", which all six seeded statements hold. The second run passed 15 of 15, and the full run passed too.
- **Committed in:** `fae7010`

**5. [Rule 1: regression this plan caused] The quick-find phone rules displaced the shell's first 767px block**
- **Found during:** the full web suite (3,257 of 3,258).
- **Issue:** `page-header.test.tsx` ("stacks its controls full-width below 768px", W-13) reads the first `@media (max-width: 767px)` block, and the new header and option blocks now came first.
- **Fix:** the two phone blocks follow the shell's phone block, unchanged. The rerun passed 3,258 of 3,258.
- **Committed in:** `e2d245c`, its own commit

**6. [Interface] `QuickFindTrigger({ viewer })` and `QuickFindDialog({ …, viewer })`**
- The plan names `QuickFindTrigger()` with no props.
- The dialog's description and the action's groups differ by actor (UI-SPEC §4.2). The client cannot read the grants, so the shell passes `quickFindViewer(granted)`, the string `'requestor'` or `'analyst'`.
- The action still decides the lists from the session's own grants. The prop chooses only the description.

**7. [Acceptance wording] Literal greps**
- The schema writes `min(2).max(100)` literally. The same values are `QUICK_FIND_MIN_TERM_LENGTH` and `QUICK_FIND_MAX_TERM_LENGTH` in the domain, which the dialog's `maxLength` and the client's term rule read.
- The dialog's comment says "the shipped command dialog wrapper", so the file has no `CommandDialog` token.
- `risk:manage` gates the Risk register in `quickFindGroupsFor` and again where the action starts its reads.

---

**Total deviations:** 7: 1 accessibility fix to a library gap, 1 test-environment blocker, 2 corrections to my own tests, 1 regression this plan caused (fixed in its own commit), 1 interface note and 1 wording note.
**Impact on plan:**
- No Strapi or specification change, no content-type change, no new Function, FunctionAPI or role, and no dependency (D-01, D-02, T-11-SC).
- `cmdk` 1.1.1 was already installed.
- `served-operations.json` is unchanged: the chain guard passes, because every read goes through an existing service function.

## Issues Encountered

- **Bash heredocs with Python patches** failed to parse (`unexpected EOF`), as in 11-15 to 11-18. The longer patches were written to the scratchpad with the Write tool and run from there. One heredoc patch mangled three regex escapes in `quick-find-trigger.test.tsx` (a backslash-n became a newline and a backslash-b became a backspace). They were repaired before the RED run, and the new files hold no control character.
- **The failed Task 3 spec run** kept its database and builds under the ignored `.tmp` directories, as the harness does after a failure. Its `test-results/` folder is ignored (`.gitignore:9`) and was cleared by the next run. `git status --short` was identical before and after every run.
- **Line endings:** the `LF will be replaced by CRLF` notices are `core.autocrlf` messages. The operator's two `apps/backend/types/generated/*.d.ts` files still report "needs update". They stay untouched and unstaged.

## Known Stubs

None that block the plan's goal. The dialog shows only `status: 'ok'` groups. A failed group's `We couldn’t search {list} just now.` with `Retry search`, the every-list-failed state, the hint below two characters, skeletons, the pending opacity and the "No matches" copy are plan 11-20's states (D-53). The action already returns failed groups for them.

## Threat Flags

None beyond the plan's register:
- **T-11-09:** every group is an existing Strapi list read, and capabilities only choose which lists are asked. The output is display fields and hrefs. A unit test proves a Requestor asks no analyst list, and plan 11-20 proves scope in the browser as the Secondary Requestor.
- **T-11-10:** a 2-100 character term, a 250ms debounce, one call in flight with the latest winning, and one 10-row page per list.
- **T-11-44:** the Server Action's origin check and the session identity apply. The input is strict, and only the trimmed term is echoed.
- **T-11-45:** hrefs are built on the server from closed kinds and served ids (`encodeURIComponent`), and navigation goes through the guard.
- **T-11-SC:** no package was added.

## User Setup Required

None.

## Next Phase Readiness

- **Route budget, for 11-20:** `/app/risks/{documentId}` is at 298,649 of 300,000 bytes, so 1,351 bytes are left. `/app/review/assessments/{documentId}` is at 294,198.
  - Anything 11-20 adds to the trigger, which ships on every route, must be close to free: the cold-open frame and skeleton, the load-failure path, or the focus rules. Keep that work in the lazily loaded dialog.
  - If room runs out, replacing `next/dynamic` with `React.lazy` in the trigger (one less runtime) is the first saving to measure.
- **11-20** can build on:
  - `QuickFindDialog`. Add the D-53 states (failed groups are already in the result, with `status: 'failed'`), the phone sheet with its Close control, the footer hints, the Clear control, and the kept term (UI-D12).
  - The focus rules: `returnFocusTo` is already passed, and `onCloseAutoFocus` restores it. Opening a result should send focus to the header control (UI-D13).
  - The axe proofs.
  - `UX10_GUARD_BLOCKS` belongs outside the `Quick find @journey` describe.
- **The X-8 frame** from 768px shipped here. 11-20 may refine it but need not re-add it.
- **11-21:** the coverage table can cite `quick-find-actions.test.ts`, `quick-find-dialog.test.tsx`, `quick-find-trigger.test.tsx`, the guard's `navigate` cases and `UX10_FIND_AND_OPEN`, `UX10_ANALYST_GROUPS` and `UX10_SHOW_ALL` for UX-10 and UAT-048. The walkthrough should look at the dialog and the 320 to 375px header (coverage D7).

## Self-Check: PASSED

- The created files exist (FOUND): `quick-find-domain.ts`, `quick-find-actions.ts`, `quick-find-actions.test.ts`, `quick-find-dialog.tsx`, `quick-find-dialog.test.tsx`, `quick-find-trigger.tsx`, `quick-find-trigger.test.tsx` and `e2e/quick-find.spec.ts`.
- The six commits `9c12e53`, `88577cd`, `dd9b883`, `80e9ec0`, `fae7010` and `e2d245c` exist on `post-demo`, and each carries the trailer. The ledger reads `ac2ea95..e2d245c` = 6.
- **Task 1 acceptance re-ran PASS:**
  - `quick-find-actions.ts` starts with `'use server'`, contains `min(2)` and `max(100)`, imports `listMyRequests`, and has 0 matches for `createStrapiClient` or `revalidatePath`.
  - `quick-find-dialog.tsx` starts with `'use client'`, contains `shouldFilter={false}` and `vimBindings={false}`, and has 0 `CommandDialog`.
  - The trigger contains `aria-keyshortcuts` and `next/dynamic`, and the guard exposes `navigate`.
  - The mobile `testMatch` lists `'**/quick-find.spec.ts'`, and its comment names the file. `UX10_FIND_AND_OPEN` sits inside `Quick find @journey` and reported `[desktop]` and `[mobile]` results.
  - The verify exited 0, twice.
- **Task 2 acceptance re-ran PASS:**
  - The action calls `listAssessmentRequests` with `queue: 'all'` and gates the Risk register on `risk:manage`.
  - The domain contains `Show all` and `/app/review/requests?queue=all&q=`.
  - The dialog contains `aria-live="polite"`.
  - The verify passed 289/289, with typecheck clean.
- **Task 3 acceptance re-ran PASS:**
  - `UX10_ANALYST_GROUPS` and `UX10_SHOW_ALL` are declared outside the describe and report desktop results only.
  - The page's `Search` button is located in `main`.
  - Both specs pass in both projects, `app-shell.spec.ts` passes in the desktop project, and the tree is clean.
- **The plan's verification passed:**
  - web 3,258/3,258, with typecheck, lint and `api:check` clean;
  - the chain, zod and copy guards pass;
  - full Playwright 147/147, with the tree clean.
- STATE.md, ROADMAP.md and state.json are untouched; the orchestrator owns them. REQUIREMENTS.md is unchanged, because UX-10 is not ready.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-04*
