---
phase: 13-request-pick-up-and-notes
plan: 09
subsystem: ui
tags: [assignee-control, x-15, x-14, undo-toast, optimistic-ui, picker, popover, sheet, session-storage, beforeunload, request-hub, playwright, axe, performance-budget]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: changeAssigneeAction (with analystName), listAssignableAnalystsAction, pickerOptions, assignmentTitle, family K, the request read's assignment (13-04); Sam Analyst and the Second Security Analyst sign-in (13-07); request-pick-up.spec.ts in the mobile testMatch (13-08)
  - phase: 12-ai-context-suggestions-and-provenance
    provides: successToast (X-14 paused success toast), the toastAction pattern of use-ai-decisions.ts, the X-13 sheet frames
  - phase: 10-workflow-integrity-and-generation-reliability
    provides: LocalInstant (X-3), the navigation guard (10-08), refusal-copy.ts
provides:
  - The Assignment section on the analyst request page (AssignmentBlock), directly after the hub, with the four holder states, the draft and own-request lines and the legacy-released caption
  - Pick up, Assign to me and Return to queue applied at once with X-14 Undo toasts, rollback with family K, an immediate refresh on ASSIGNMENT_CHANGED and §7.3 focus
  - AssignPicker (next/dynamic): popover from 768px, X-13 full-screen sheet below, eligible analysts only, kept reason and choice per person and request
  - AssignmentHistory: the newest-first toggle with quoted reasons, fail safe on a malformed log
  - components/ui/toast-action.ts (toastAction) for 13-11 and 13-12
  - lib/session-drafts (readSessionDraft, writeSessionDraft, clearSessionDraft, clearAllSessionDrafts; draftOwnerKey, server-only)
  - components/csrm/use-unload-warning.ts (the beforeunload-only warning, out of the shell)
  - Sign out clears every kept draft
  - The hub's Requestor row and its Assigned to (analyst) / Security Analyst (Requestor) row
  - The analyst assignment view's required viewer (contract addition, see Deviations)
  - REQ08_PICK_UP_FROM_REQUEST_PAGE, REQ08_REASSIGN_THROUGH_PICKER and REQ08_OWN_REQUEST_NO_PICK_UP @journey at 1440 and 375
affects: [13-10, 13-11, 13-12, 13-13, 13-17, 13-19]
actuals:
  tokens: 40500
  tasks: 3
  commits: 7
plan_head_before: 603d58d7abb87d8e806f1be9f7951282481c6896
plan_head_after: 14ffdcb3789f5dd0cb7c1d580cfd8022e8b0bbfe
tech-stack:
  added: []
  patterns:
    - "An optimistic control keeps what Strapi last served in state (the page's read, then each change's answer) under useOptimistic, so the shown value survives the transition and resets on the next page read"
    - "An Undo is a second recorded change built from the before and after views (give the request back to who held it, from who holds it now), never a client-side reversal"
    - "Unsent text lives in sessionStorage under csrm-draft:{kind}:{ownerKey}:{requestId}; the owner key is the session's opaque identityKey or a hash, and Sign out clears the prefix"
    - "Code that keeps text arms beforeunload through its own hook module, so the shell's first load does not grow"
key-files:
  created:
    - apps/csrm/src/features/request-assignment/assignment-block.tsx
    - apps/csrm/src/features/request-assignment/assignment-block.test.tsx
    - apps/csrm/src/features/request-assignment/assign-picker.tsx
    - apps/csrm/src/features/request-assignment/assign-picker.test.tsx
    - apps/csrm/src/features/request-assignment/assignment-history.tsx
    - apps/csrm/src/features/request-assignment/assignment-history.test.tsx
    - apps/csrm/src/components/ui/toast-action.ts
    - apps/csrm/src/components/ui/toast-action.test.ts
    - apps/csrm/src/components/csrm/use-unload-warning.ts
    - apps/csrm/src/components/csrm/use-unload-warning.test.tsx
    - apps/csrm/src/lib/session-drafts/session-drafts.ts
    - apps/csrm/src/lib/session-drafts/session-drafts.test.ts
    - apps/csrm/src/lib/session-drafts/draft-owner-key.ts
    - apps/csrm/src/lib/session-drafts/draft-owner-key.test.ts
  modified:
    - apps/csrm/src/features/request-assignment/assignment-domain.ts
    - apps/csrm/src/features/request-assignment/assignment-domain.test.ts
    - apps/csrm/src/features/request-assignment/assignment-schema.ts
    - apps/csrm/src/features/requests/request-hub.tsx
    - apps/csrm/src/features/requests/request-hub.test.tsx
    - apps/csrm/src/features/assessments/assessment-detail.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx
    - apps/csrm/src/components/shell/account-menu.tsx
    - apps/csrm/src/components/shell/app-shell-account.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/request-pick-up.spec.ts
    - apps/csrm/e2e/requestor-request-workflow.spec.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/tests/request-assignment.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
key-decisions:
  - "The analyst assignment view names its viewer ({ documentId, displayName }, required): a pick-up or an assign-to-me must send the viewer's IdamBox User documentId, which no web session carries. Exposing the caller's own id to the caller discloses nothing; the Requestor view is unchanged."
  - "useLeaveGuard is unchanged: the beforeunload-only warning is its own hook, use-unload-warning.ts, imported only by the lazily loaded picker (the plan's Budget form), so the shell's guard and every route's first load stay as they were."
  - "An Undo restores who held the request before, sent with the new holder as expectedAnalyst; Undo appears only where the reverse is allowed (no Undo for a pick-up or assign on a released request, whose toast says Reassign it if someone else should hold it.)."
  - "A person the API can no longer read is named 'a Security Analyst' in a sentence, never an invented name; the Return-to-queue history sentence adds ', from {from}' only when someone other than the actor held it."
  - "The picker stays mounted once wanted (and mounts closed when a kept reason exists), so a kept reason keeps the unload warning armed after the picker closes."
  - "A click outside the popover leaves focus where the person clicked; Escape and Close return it to the trigger; after an assignment focus goes to the status line (§7.3)."
patterns-established:
  - "toastAction(label, act) for every X-14 toast action outside the Risk route"
  - "useUnloadWarning(active) for any lazily loaded module that keeps unsent text"
requirements-completed: []
coverage:
  - id: D1
    description: "The Assignment section after the hub shows Assigned to {name} or Not picked up, who assigned them and when (or who may pick it up, or the legacy-released caption), only the served actions in §5.2's order, the own-request and draft lines, and nothing for the Requestor"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-assignment/assignment-block.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-assignment/assignment-domain.test.ts"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#places the Assignment section directly after the hub, before Return to draft"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_OWN_REQUEST_NO_PICK_UP @journey"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pick up, Assign to me and Return to queue apply at once, confirm with an Undo toast through successToast and toastAction, roll back with family K, refresh at once on ASSIGNMENT_CHANGED and move focus to the status line"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-assignment/assignment-block.test.tsx"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_PICK_UP_FROM_REQUEST_PAGE @journey"
        status: pass
    human_judgment: false
  - id: D3
    description: "Assign and Reassign open the eligible-analyst picker (popover from 768px, full-screen sheet below) with search, empty, no-match, error and permission states, an optional reason of at most 500 characters and an explicit Assign to {name}; the reason and choice are kept per person and request, restored on reopen, cleared on success and sign-out, and arm beforeunload only"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-assignment/assign-picker.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/session-drafts/session-drafts.test.ts"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/csrm/use-unload-warning.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/shell/app-shell-account.test.tsx#clears every kept draft when Sign out is submitted, before the sign-out action runs"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_REASSIGN_THROUGH_PICKER @journey"
        status: pass
    human_judgment: false
  - id: D4
    description: "The hub reads Requestor (was Owner) with Assigned to for analysts and Security Analyst (name or Not picked up yet) for the Requestor"
    requirement: "REQ-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-hub.test.tsx#RequestHub’s people rows (D-16, D-17; UI-D24)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_PICK_UP_FROM_REQUEST_PAGE @journey"
        status: pass
    human_judgment: false
  - id: D5
    description: "A toast or history sentence naming two long display names wraps at 375px and the toast's Undo stays visible and reachable"
    requirement: "REQ-08"
    verification: []
    human_judgment: true
    rationale: "UI Considerations backstop: the seeded names are short, so the long-name wrap is the orchestrator's browser walk (13-19)."
duration: 66min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 09: The Assignee Control on the Request Page Summary

**An analyst now picks up, takes, hands over or returns a request from its page with one click and an Undo, through a picker that lists only who may hold it and never loses a typed reason; both actors read who holds it on the hub.**

## Performance

- **Duration:** 66 min (2026-10-08T19:38:31Z to 20:44Z), the suites included
- **Tasks:** 3 (Task 1 the tracer, Tasks 1 and 2 RED then GREEN), plus one contract fix before them and one budget refactor after them
- **Files changed:** 35 (14 created)

## Accomplishments

- **Assignment section (§5.2).** `AssignmentBlock` renders after `RequestHub` in `AssessmentDetail`, in a `#assignment` wrapper around a `DetailSection` titled `Assignment`:
  - the status line (`tabIndex={-1}`), then the caption: `Picked up {instant}`, `Assigned by {name} · {instant}`, `Any Security Analyst who didn’t raise this request can pick it up.`, or the legacy-released sentence;
  - the own-request and draft lines in place of controls;
  - only the actions Strapi served, in §5.2's order, as outline small pills. They wrap beneath the status from 768px, and stack at full width and touch height below 768px.
- **Optimistic changes (§7).**
  - `useOptimistic` runs over the last served view. Pending opacity applies at once, and the rollback eases back at `--duration-base`.
  - Each success toasts through `successToast` with `toastAction('Undo', …)`, where the Undo is allowed, and refreshes the route.
  - A failure shows a danger toast titled per §7.1, with family K's copy and `Try again` or `Refresh page`. `ASSIGNMENT_CHANGED` refreshes at once.
  - Focus moves to the status line.
  - `assignment-domain.ts` holds every sentence, label, name, toast and request: the component has no business logic.
- **Picker (§6).** `AssignPicker` is loaded with `next/dynamic`.
  - From 768px it is a 480px popover anchored to its trigger. Below 768px it is the full-screen sheet with a visible title and `Close` (named `Close assign`).
  - Search uses a 250ms debounce and applies only the latest answer. Skeletons appear after 300ms, with `aria-busy`.
  - It has the empty, no-match, error (`Try again`) and permission (family K, closes) states.
  - Choosing marks with a check and never applies. `Assign to a Security Analyst` shows `Choose a Security Analyst first.` when nobody is chosen.
  - The reason is limited to 500 characters, and `Ctrl`/`⌘+Enter` assigns.
  - The reason and choice are kept in the session store, restored with `Restored from earlier in this session.` (the choice only if the fresh list still holds it), cleared on success, and kept on a failed assign.
- **History (§5.3).** A newest-first toggle with `aria-expanded`/`aria-controls` and an `ol` named `Assignment history`. Reasons are quoted on their own `whitespace-pre-wrap` caption line, and nothing is rendered as markup. A malformed log shows no toggle.
- **Hub (§5.1).** `Requestor` replaces `Owner` (U3, changed deliberately). The row after it reads `Assigned to` for analysts, or `Security Analyst` with `Not picked up yet` for the Requestor.
- **Session store and sign-out.** `session-drafts.ts` keys drafts as `csrm-draft:{kind}:{ownerKey}:{requestId}` and tolerates missing or refusing storage. `draftOwnerKey` is server-only. The account menu's sign-out calls `clearAllSessionDrafts()` before the action runs (not when the leave guard intercepts).
- **Copy guard.** It now reads every `.tsx` and `-domain.ts` file in `features/request-assignment`. A domain test asserts that no assignment sentence contains `Accept` or `release`; the legacy caption's own `Released` state word is excluded.

## Test Counts

- **Contract fix (`117e44e`).**
  - RED: the mounted pick-up and read cases failed (`UNEXPECTED_ASSIGNMENT_KEYS`, `UNEXPECTED_UNASSIGNED_ANALYST_VIEW`).
  - GREEN: request-assignment, request-workflow and contract-catalogue integration `# pass 47 / # fail 0`; web `Tests 200 passed`; `api:check` clean; typecheck clean.
- **Task 1.**
  - RED (`7d409fc`): `Tests 20 failed | 113 passed`, with 4 files unable to load their missing modules.
  - GREEN (`bcd36af`): the verify set `Tests 355 passed` (12 files, including the copy, zod and server-only guards); typecheck and lint clean. The tracer gate re-ran the verify, and it passed.
- **Task 2.**
  - RED (`b8f8696`): 4 failed, plus 3 files unable to load.
  - GREEN (`a05e37d`): the verify set `Tests 293 passed` (12 files); typecheck and lint clean.
- **Task 3 (`6ff192f`).**
  - The mobile list collects all four request-pick-up tests.
  - Playwright for `request-pick-up`, `requestor-request-workflow` and `assessment-navigation-lifecycle`: **14 passed (desktop 8, mobile 6)**.
  - `request-pick-up.spec.ts` alone: **8 passed (desktop 4, mobile 4)**, before and after the refactor.
  - `performance.spec.ts --project desktop`: 11 passed.
  - The tree was clean after every run.
- **Budget refactor (`14ffdcb`).** The verify set `Tests 293 passed` (13 files, including `use-unload-warning.test.tsx`), and `performance.spec.ts` 11 passed.
- **Full web unit suite:** `Test Files 180 passed`, `Tests 3921 passed`.
- **Full Strapi suite:** **`# pass 899 / # fail 0`** (`ℹ tests 899`, 943 s, about 15.7 min, exit 0), after every commit of this plan; nothing listened on 1337 or 3000.

## Performance Budget (delivered JavaScript, desktop medians)

Source: `apps/csrm/.tmp/performance/baseline-desktop.json`. The budget is 300,000 bytes and is unchanged; `PERFORMANCE_BUDGETS` and `ROUTE_BUDGET_OVERRIDES` are untouched.

| Route | Before this plan (account menu as at 603d58d) | With the option on the shell's `useLeaveGuard` | Final (own hook, compact store) |
|---|---|---|---|
| `/app/risks/{documentId}` | 299,626 | 299,925 (75 bytes of headroom) | **299,874 (126 bytes of headroom)** |
| `/app/requests/{documentId}` (Requestor) | 265,881 | 266,177 | **266,128** |

- **The guard needed a beforeunload-only form.** It was first built as `useLeaveGuard(…, { beforeUnloadOnly: true })`. The route stayed within budget, but with 75 bytes of headroom, so the plan's Budget form was applied before handing on: `use-unload-warning.ts`, imported only by the lazily loaded picker. `navigation-guard.tsx` and its test are byte-identical to before this plan.
- **What still costs bytes.** The remaining +248 bytes are the sign-out clearing, which must load with the account menu on every route, because it has to run before the sign-out action.
- **Headroom for later plans.** With 126 bytes left on the Risk route, a later shell change (13-13's sidebar item and counts) will need its own source fix.

## Task Commits

0. **Contract fix (deviation):** `117e44e` (fix): name the viewing analyst in the request's assignment view
1. **Task 1 (tracer):** `7d409fc` (test, RED), `bcd36af` (feat, GREEN)
2. **Task 2:** `b8f8696` (test, RED), `a05e37d` (feat, GREEN)
3. **Task 3:** `6ff192f` (test)
4. **Budget refactor:** `14ffdcb` (refactor)

## Decisions Made

See `key-decisions` above. In brief:

- **The viewer field.** The analyst view now names its viewer. This is a contract addition.
- **The unload warning.** It is its own hook, kept out of the shell.
- **Undo.** It restores the previous holder, and appears only where the reverse is allowed.
- **Unreadable people.** A person the API can no longer read is called "a Security Analyst".
- **The picker stays mounted.** Once wanted it stays mounted, so a kept reason keeps the warning armed.
- **Focus after a click outside.** It stays where the person clicked.
- **History count in the journey.** `REQ08_REASSIGN_THROUGH_PICKER` checks `Show assignment history (2)` (pick-up, then reassign), not the plan's `(3)`: the journey makes two changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The analyst assignment view gains a required `viewer`**
- **Found during:** Task 1 design.
- **Issue:** `PUT …/assignee` takes the analyst's IdamBox User documentId. A pick-up or an assign-to-me must send the viewer's own id, but no web session carries it: the session has a display name, an email in OIDC mode and an opaque `identityKey`, never a documentId. The plan's `nextAssignmentRequest` assumed one.
- **Fix:**
  - Strapi: `projectAnalystAssignment` returns `viewer` (the caller, resolved in the same bounded people read as the assignment's people). `assignmentPeopleIds` takes the viewer's id.
  - Contract: `AssessmentRequestAssignment` declares `viewer` as a required `ActiveUserSummary`, and `schema.d.ts` was regenerated.
  - Web: the closed parser and `RequestAssignment` carry it. A view without it is refused.
  - Tests: the mounted cases assert that Bob and the second analyst each see themselves.
- **Scope:** no content type changed, no grant changed, and the Requestor view is unchanged. The plan said "Edits Strapi source? No. Changes the specification? No."; this is the one exception.
- **For 13-12:** its queue Pick up needs the same fact for each row, from `viewer` or an equivalent.
- **Commit:** `117e44e`

**2. [Rule 1 - Bug in an existing assertion] The Requestor journey's first-workflow-action check**
- **Found during:** Task 3.
- **Issue:** `requestor-request-workflow.spec.ts` asserted that the first button in `main` on the analyst request page is `Return to draft`. §5.2 places the Assignment section, with `Pick up`, before it, so the check failed at both widths.
- **Fix:** the check now leaves out buttons inside `#assignment`, which change who holds the request, not its lifecycle. Its intent is unchanged. The file was outside the plan's list.
- **Commit:** `6ff192f`

**3. [Budget, the plan's own fallback] The beforeunload-only warning as its own hook**
- **Issue:** with the option in the shell's guard, the Risk route reached 299,925 bytes, within budget but with 75 bytes of headroom.
- **Fix:** applied before handing on, as above. This is `14ffdcb`.

**4. [Test fixes during GREEN]**
- The hub test counted every `dt` on the page; it now counts only the summary's.
- The picker's permission case looked for a frame that a refusal closes before the lookup; it now only clicks the trigger.
- The sign-out mock now returns `never` for the typecheck.

---

**Total deviations:** 4 (one Rule 3 contract addition, one Rule 1 e2e assertion, one Budget fallback, test fixes).
**Impact on plan:** every planned behaviour shipped. The contract addition is the one change beyond the web app, and it changes no content type.

## Issues Encountered

- **A harness port collision.** One Playwright run failed to start: `EADDRINUSE 127.0.0.1:22112`. The pid-derived web port collided with `ROGLiveService` (a vendor system service, pid 6132, running since 7 Oct). A re-run with a new pid passed.
- **Kept debugging directories.** The failed run kept its database and Next build under `apps/backend/.tmp/playwright-e2e-6e547410…` and `apps/csrm/.tmp/playwright-next-6e547410…`. Both are ignored scratch, and were left in place.
- **Heredocs in Bash.** Two heredocs carrying `’` failed in this shell. Those files were written with the editor tools instead.

## Threat Model Coverage

- **T-13-31:** controls render only from the served `actions`, and Strapi decides every change. The own-request journey proves the UI half; 13-03's mounted test proves the API half.
- **T-13-32:** draft keys carry only an opaque owner key and the request id. Drafts are cleared on success and on sign-out, and the sign-out test checks they are gone before the action runs.
- **T-13-33:** names and reasons are React text, with a test that renders hostile markup as text.
- **T-13-SC:** no package was added.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: response-field (low) | apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts | The analyst assignment view (served only to a human Security Analyst reading through the analyst grant, and on the PUT response) now carries the caller's own documentId and display name as `viewer`. It names only the caller, through the people projection. |

## Known Stubs

None.

## Next Phase Readiness

- **For 13-10 and 13-11:** the session store, `draftOwnerKey` (passed down by the analyst request page), `useUnloadWarning` and `toastAction` are ready for note drafts.
- **For 13-12:** the queue's Pick up can reuse `toastAction`, `successToast` and the domain's toasts. It needs the viewer's documentId for each row (see Deviation 1).
- **REQ-08:** stays Pending until the phase gate, as in 13-03 to 13-08.

## Self-Check: PASSED
