---
phase: 10-existing-flow-gap-closure
plan: 08
subsystem: ui
tags: [autosave, server-actions, navigation-guard, link-onnavigate, beforeunload, save-status, radix, d-11, d-12, ques-09]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-01 LocalInstant and the shell's TimeZoneProvider; 10-05 the Requestor questionnaire page and its introduction; 10-07 failure: 'blocked' | 'retryable' on every failed answer save"
provides:
  - "useAnswerAutosave (apps/csrm/src/features/questionnaires/use-answer-autosave.ts): 1,500 ms debounce, blur flush, one save in flight with one queued follow-up, retryable and blocked failures, pause and resume, saveNow, reset, and a send on pagehide, hidden visibility and unmount"
  - "rememberSavedQuestionnaire / savedQuestionnaireAfter: the tab's session record of the last save per questionnaire, compared as instants"
  - "SaveStatus and SaveStatusValue (apps/csrm/src/components/csrm/save-status.tsx), the X-1 save state, with an unannounced visual echo (announce={false})"
  - "autosaveQuestionnaireDraftAction: Save draft's validation and failure mapping, with no revalidatePath and no cookie write"
  - "NavigationGuardProvider, useNavigationGuard, useLeaveGuard, GuardedLink (apps/csrm/src/components/csrm/navigation-guard.tsx)"
  - "ConfirmDialog controlled mode: optional trigger, open and onOpenChange"
  - "QuestionnaireRenderer serverUpdatedAt; QuestionnaireDetail passes the later of the questionnaire's updatedAt and its latest answer time"
affects: [10-09 governance form, 10-13 record picker save confirmations (X-1 SaveStatus with savedLabel), 10-23 pilot walkthrough, any page that later needs a leave warning]

actuals:
  tokens: 21690
  tasks: 3
  commits: 5
plan_head_before: d8e07b9b66d3d8d92e4b615f2a38e57e1a0b895b
plan_head_after: 1dfdbefbaad5884fe8e41eb386b31c0039f0a5be

tech-stack:
  added: []
  patterns:
    - "Autosave Server Action variant: validate and save, call no revalidatePath, revalidateTag, updateTag or refresh, write no cookie, so the response carries no page render"
    - "Session record of the last save, preferred at mount only when strictly later than the page's own answer time (Back and Forward reuse old RSC payloads)"
    - "Leave guard: a page registers its state with useLeaveGuard; links consult it in Link onNavigate after recording their element in onClick; beforeunload only while blocking"
    - "One Radix build (radix-ui) for every overlay, so a dialog opened above another shares its layer and focus stacks"

key-files:
  created:
    - apps/csrm/src/features/questionnaires/use-answer-autosave.ts
    - apps/csrm/src/features/questionnaires/use-answer-autosave.test.tsx
    - apps/csrm/src/components/csrm/save-status.tsx
    - apps/csrm/src/components/csrm/save-status.test.tsx
    - apps/csrm/src/components/csrm/navigation-guard.tsx
    - apps/csrm/src/components/csrm/navigation-guard.test.tsx
    - .planning/phases/10-existing-flow-gap-closure/deferred-items.md
  modified:
    - apps/csrm/src/features/questionnaires/questionnaire-actions.ts
    - apps/csrm/src/features/questionnaires/questionnaire-actions.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-renderer.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-detail.tsx
    - apps/csrm/src/components/csrm/confirm-dialog.tsx
    - apps/csrm/src/components/csrm/confirm-dialog.test.tsx
    - apps/csrm/src/components/shell/app-shell.tsx
    - apps/csrm/src/components/shell/capability-navigation.tsx
    - apps/csrm/src/components/shell/wordmark.tsx
    - apps/csrm/src/components/shell/account-menu.tsx
    - apps/csrm/src/components/shell/app-shell-account.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/questionnaire-workflow.spec.ts

key-decisions:
  - "10-08: the page compares a remembered save with the later of the questionnaire's updatedAt and its latest answer updatedAt, because saving answers never touches the questionnaire's own updatedAt while a save's updatedAt is its latest answer time (projectMutation); comparing with questionnaire.updatedAt alone would let a stale tab override a newer save from another tab"
  - "10-08: the mobile navigation sheet moved from @radix-ui/react-dialog 1.1.15 to the radix-ui build every other primitive uses: two Radix copies keep separate layer and focus stacks, so the leave warning could not stack above the sheet; a mouse or pen press on the overlay still closes the sheet at once (the newer build otherwise waits for the click), touch waits for its click"
  - "10-08: Sign out (OIDC mode only) consults the leave guard: the sign-out action clears the session before the browser leaves for Keycloak, so beforeunload alone would warn too late to keep the answers savable; after Leave questionnaire the full-page navigation is not asked about twice"
  - "10-08: Refresh page after a blocked save is router.refresh(); when the refreshed payload arrives the form re-seeds from it and autosave runs again (reset), rather than staying blocked until a hard reload"
  - "10-08: a save that fails during submit shows its sentence in the open submit dialog (the page behind the dialog is hidden), as well as in the save status"
  - "10-08: Save draft and the save before submit go through the hook's saveNow, which waits for a save in flight, so two saves never race; explicit saves are allowed after a blocked failure because the person asked for them"

patterns-established:
  - "A page with unsaved work calls useLeaveGuard(blocking, reason); a single in-app link uses GuardedLink; a list of links records its activated element in onClick and calls guard.guardLink from onNavigate"
  - "ConfirmDialog controlled mode: the owner opens it with open, dismissing calls onOpenChange(false), and the owner closes it from onConfirm"

requirements-completed: [QUES-09]

coverage:
  - id: D1
    description: "Answers save about 1.5 seconds after the last change and at once on blur, one save in flight with one queued follow-up; a blocked failure stops autosave, a retryable one retries on the next change or Retry save; a waiting save is sent on pagehide, hidden visibility and unmount"
    requirement: "QUES-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/use-answer-autosave.test.tsx#useAnswerAutosave timing (UI-SPEC §6.2)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/use-answer-autosave.test.tsx#useAnswerAutosave failures (UI-SPEC §6.1, research Pitfall 7)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx#QuestionnaireRenderer autosave and save status (D-11, UI-SPEC §6.1 and §6.2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The completion card's last line shows Saving… (unannounced), Saved at {local time} (polite) or a failure with Retry save or Refresh page (announced once); Save draft echoes it beside the button, hidden from assistive technology"
    requirement: "QUES-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/csrm/save-status.test.tsx#SaveStatus"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-workflow.spec.ts#QUES09_AUTOSAVE_PERSISTS"
        status: pass
    human_judgment: false
  - id: D3
    description: "An autosave calls no revalidatePath and writes no cookie, so its response carries no x-action-revalidated header; Save draft and submit keep their revalidation"
    requirement: "QUES-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-actions.test.ts#the autosave Server Action revalidates nothing (D-11)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-workflow.spec.ts#QUES09_AUTOSAVE_PERSISTS (x-action-revalidated absent or 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "After an autosave, Back to the questionnaire shows the saved answers (the session record wins over an older page payload), and reopening from its link shows them too"
    requirement: "QUES-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/use-answer-autosave.test.tsx#the session record of the last save (Back and Forward after an autosave)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-renderer.test.tsx#mounts with the remembered answers when they are newer than the page"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-workflow.spec.ts#QUES09_AUTOSAVE_SURVIVES_BACK"
        status: pass
    human_judgment: false
  - id: D5
    description: "While a change waits, a save is in flight or the last save failed, the sidebar links, the mobile sheet links, the wordmark, the Assessment request link and Sign out open Leave this questionnaire?; Keep answering returns focus to the link (the sheet stays open), Leave questionnaire closes the sheet and navigates; beforeunload only while blocking"
    requirement: "QUES-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/csrm/navigation-guard.test.tsx#the leave guard (D-12, UI-SPEC §6.3)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/csrm/navigation-guard.test.tsx#the shell links consult the guard"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/csrm/confirm-dialog.test.tsx#ConfirmDialog in controlled mode"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-workflow.spec.ts#QUES09_LEAVE_WARNING"
        status: pass
    human_judgment: false
  - id: D6
    description: "The browser's own prompt on reload or close, and the screen-reader cadence of the save status"
    verification: []
    human_judgment: true
    rationale: "The beforeunload prompt is browser chrome Playwright cannot assert reliably (research Assumption A1), and announcement cadence needs a screen reader; both are VALIDATION Manual-Only checks for the orchestrator or plan 10-23's walkthrough."

duration: 39min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 08: Questionnaire autosave and the leave warning Summary

**A Requestor's answers now save themselves 1.5 seconds after typing stops or at once when a field loses focus, through a Server Action that revalidates nothing (so no autosave response carries a page render). The completion card shows Saving…, Saved at {local time} or a failure with Retry save or Refresh page. Every in-app link, the wordmark, the request link and Sign out ask "Leave this questionnaire?" while anything is unsaved, and Back after an autosave shows the saved answers (UAT-021, QUES-09).**

## Performance

- **Duration:** 39 min
- **Started:** 2026-10-02T04:40:16Z
- **Completed:** 2026-10-02T05:19Z
- **Tasks:** 3 of 3
- **Files modified:** 20 in code (6 created, 14 modified), plus this summary and `deferred-items.md`

## Accomplishments

- `useAnswerAutosave` follows the hook contract (`status`, `blocking`, `schedule`, `flush`, `retry`, `pause`, `resume`) and adds `saveNow` (Save draft and the save before submit) and `reset` (after Refresh page). A 403, 404 or 409 sets `failed/blocked` and ignores later changes, retries and blurs. That closes threat T-10-18: no refusal loop.
- `autosaveQuestionnaireDraftAction` shares Save draft's validation and failure mapping (`questionnaireActionSchema`, T-10-20), and calls no cache invalidation or router refresh. `awk` over its body counts 0 `revalidatePath`. In the journey, the autosave response had no `x-action-revalidated` header.
- `SaveStatus` (X-1) is the last line of the `Questionnaire completion` card. Its parts:
  - an empty polite `role="status"` from load;
  - `Saving…` outside every live region;
  - `CheckCircle2` in `text-success`, or `AlertCircle` in `text-destructive`, at `size-3.5`;
  - `Retry save` or `Refresh page`, as outline small buttons.
  After Save draft, an `aria-hidden` echo with no controls sits beside the button.
- Session record: every successful save is remembered for the tab. At mount the renderer prefers the record only when it is strictly later than the page's latest answer time. This closes threat T-10-60: a page restored by Back cannot write older answers back.
- `NavigationGuardProvider` sits in the shell inside `TimeZoneProvider`, with the 10-01 `ViewerTimeZoneSync` unchanged. It owns one controlled `ConfirmDialog` with the §6.3 copy, and adds `beforeunload` only while blocking. These links consult it:
  - `CapabilityNavigation`, in the sidebar and the mobile sheet;
  - the wordmark, through `GuardedLink`;
  - the questionnaire's `Assessment request {number}` link (`GuardedLink`, keeping the `record-link` treatment);
  - Sign out.
- The form-level `Questionnaire not saved` alert and `Draft saved. Your answers remain editable.` are gone (UI-D29, UI-D10). Save failures show in the status, and submit refusals stay in the dialog.
- The introduction's `Your answers save automatically, so you can stop and finish later.` (UI-SPEC §5.2, added by 10-05 ahead of autosave) is now true. This closes the interim copy gap that 10-05 recorded.

## Task Commits

1. **Task 1 (tracer): answers autosave and the completion card says so, end to end**
   - RED `7b56d0b`: `test(10-08): expect answers to autosave with a visible save status and no page revalidation`
   - GREEN `85d4994`: `feat(10-08): autosave questionnaire answers without re-rendering the page and show the save status`
2. **Task 2: warn before leaving with unsaved answers**
   - RED `5eb1090`: `test(10-08): expect a leave warning while answers are unsaved, with the mobile sheet kept open`
   - GREEN `fae371d`: `feat(10-08): warn before leaving a questionnaire with unsaved answers`
3. **Task 3: guard the new modules' copy, then run every journey once**
   - `1dfdbef`: `test(10-08): guard the autosave and leave-warning copy`

**Plan metadata:** the docs commit that follows this summary.

## Tests run

- **Task 1 RED:** 4 files, 81 passed and 16 failed. Every failure was planned:
  - `save-status.test.tsx` and `use-answer-autosave.test.tsx` could not import modules that did not exist yet;
  - the four autosave-action cases failed on `expected undefined to be type of 'function'`;
  - nine renderer cases failed on missing `Saving…` and `Saved at`, or on the session record not existing yet;
  - the updated failure-and-success case failed.

  `check tdd-red-evidence` returned `RED_EVIDENCE_OK` on the actions file alone for the target test `the autosave Server Action revalidates nothing (D-11) > is exported beside the explicit save`. The mixed run's first failure was a load error, which the checker reports as INVALID_RED.
- **Task 1 GREEN (the plan's verify):** the 4 files plus `zod-client-boundary.test.ts`: 131/131 passed, and the web typecheck was clean. A wider run of `src/features/questionnaires`, `analyst-route-gate.test.tsx` and the copy guard gave 14 files, 272/272.
- **Task 1 tracer gate:** the run is interactive and `end-of-phase`, and the verify step is automated only. It was re-run and passed, so expansion continued.
- **Task 2 RED:** 2 files. `confirm-dialog.test.tsx` had 3 planned assertion failures (no controlled dialog), and `navigation-guard.test.tsx` could not import its module yet. `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for `ConfirmDialog in controlled mode > renders open with no trigger, with the dismiss control focused`.
- **Task 2 GREEN (the plan's verify):** `navigation-guard.test.tsx`, `confirm-dialog.test.tsx`, `src/components/shell` and `src/features/questionnaires`: 17 files, 294/294. The typecheck was clean, with no act or unknown-prop warnings in the run.
- **Questionnaire journey** (`e2e/questionnaire-workflow.spec.ts`, after Task 2): 1 passed (desktop), 1.1 min. The steps `QUES09_LEAVE_WARNING`, `QUES09_AUTOSAVE_PERSISTS` and `QUES09_AUTOSAVE_SURVIVES_BACK` and the E2 reload all passed. The tree was clean afterwards.
- **Task 3:** `interface-copy-guard.test.ts` 30/30.
- **Full web suite** (`pnpm --dir apps/csrm test`): 124 files, 2,470/2,470 passed, in 29.0 s. That is up from 2,403: this plan adds 67 tests.
- **Gates:** `typecheck`, `lint` and `api:check` all passed. `git update-index --refresh` was run on `schema.d.ts`, and the contract did not change.
- **Full Playwright run** (`pnpm --dir apps/csrm test:e2e`, dev servers confirmed stopped): **86 passed**, 82 desktop and 4 mobile. 0 failed, 0 flaky, 0 skipped, in 12.2 min (734 s wall). The tree was clean afterwards (D-48).
- **Questionnaire route budget:** `/app/questionnaires/{documentId}` delivered **349,327 bytes** of JavaScript, against the 500,000 budget. The previous run recorded 347,809 bytes, so this plan adds 1,518 bytes. Decoded JavaScript was 1,189,263 bytes in 26 scripts.
- **Static guards:** `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` is empty, and the plan changed nothing under `apps/backend`.
- **Not run:** the Strapi suite. This plan edits no Strapi source.
- **Harness noise (not a failure, pre-existing):** the Next web server logged `Error: The destination stream closed early.` 51 times. The 10-02 and 10-03 full runs logged it 55 and 61 times, so it did not start with this plan.

## Files Created/Modified

- `use-answer-autosave.ts` (new): the hook and the session record. It has no directive and no zod.
- `save-status.tsx` (new): `SaveStatus`, `SaveStatusValue`.
- `navigation-guard.tsx` (new): `NavigationGuardProvider`, `useNavigationGuard`, `useLeaveGuard`, `GuardedLink`.
- `questionnaire-actions.ts`: a shared `saveAnswers`, the revalidating `saveQuestionnaireDraftAction`, and the new `autosaveQuestionnaireDraftAction`.
- `questionnaire-renderer.tsx`:
  - `serverUpdatedAt`;
  - the hook, wired to react-hook-form's `watch` (changes) and the form's `onBlur` (leaving a field, but not moving within one radio or checkbox group);
  - `SaveStatus` and the Save draft echo;
  - pause and resume around the submit dialog;
  - `useLeaveGuard`, disarmed once submitted;
  - Refresh page re-seeding.
- `questionnaire-detail.tsx`: `serverUpdatedAt` from `answersUpdatedAt(...)`, and `GuardedLink` for the request link.
- `confirm-dialog.tsx`: controlled mode.
- `app-shell.tsx`: the provider.
- `capability-navigation.tsx`: the guarded links; `onNavigate` renamed to `onNavigated`; the `radix-ui` Dialog with overlay-press closing.
- `wordmark.tsx`: `GuardedLink`.
- `account-menu.tsx`: the guarded Sign out.
- `app-shell-account.test.tsx`: the `next/navigation` mock gains `useRouter`, which the provider needs.
- `interface-copy-guard.test.ts`: the four new files.
- `questionnaire-workflow.spec.ts`: E2, plus `QUES09_LEAVE_WARNING`, `QUES09_AUTOSAVE_PERSISTS` and `QUES09_AUTOSAVE_SURVIVES_BACK`.

## Decisions Made

- **Page time for the session record:** the later of `questionnaire.updatedAt` and the page's latest answer `updatedAt`. Strapi's save response dates a save by its latest answer, and an answer save does not touch the questionnaire document.
- **One Radix build for the sheet:** the sheet now uses `radix-ui`, so the leave warning stacks over it (see Deviations 1).
- **Sign out is guarded** (the pilot asked for this check). Findings:
  - In development mode there is no Sign out. The shell's in-app navigation in both modes is the sidebar, the mobile sheet, the wordmark and the skip link (an in-page anchor). All of these are guarded except the skip link, which leaves nothing.
  - In OIDC mode, `signOutOfSession` (`app/actions/session.ts`) clears the Auth.js session inside the Server Action and then redirects to Keycloak's logout URL. That redirect is a full-page `location.assign`, so `beforeunload` would prompt, but only after the session was already gone. Choosing to stay would leave answers that can no longer be saved.
  - So the form's `onSubmit` asks first through the guard. Leave questionnaire then submits the form once, and the full-page navigation that follows is not asked about twice.
  - The development role switcher re-renders the same route and does not navigate away, so it is not a leave.
- **Refresh page** re-seeds the form from the refreshed payload and resets autosave. Without this, a soft refresh would leave autosave blocked until a hard reload.
- **A save that fails during submit** shows its sentence inside the open submit dialog too. The page behind the dialog is inert.
- **Retryable status text:** `Your latest answers weren’t saved.` comes verbatim from §6.1. Any field errors still mark their questions and the attention list.
- **`flush` on blur sends only a waiting change.** Save draft always saves, through `saveNow`, so Saved at confirms the request the person made.
- **OIDC caveat (recorded, not changed):** in OIDC mode, an Auth.js token refresh that writes a cookie during an autosave would make that one response revalidated (`request-cookies.js`). The renderer ignores new props after mount, so no input is lost. Development mode and every suite write no cookie on save.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The mobile sheet used a second Radix copy, so the leave warning could not stack above it**
- **Found during:** Task 2 (the blocked sheet-link cases)
- **Issue:** `capability-navigation.tsx` imported `@radix-ui/react-dialog` 1.1.15. `ConfirmDialog`, through `ui/alert-dialog`, uses `radix-ui` 1.6.7, which bundles dialog 1.1.23 with its own dismissable-layer and focus-scope copies. The two copies keep separate layer and focus stacks, so the sheet's focus trap and outside-press handling fought the warning.
- **Fix:** the sheet now imports `Dialog` from `radix-ui`, like every other primitive. The newer build dismisses on the click that follows an outside press, so `mobile-navigation.test.tsx`'s overlay `pointerDown` case (unchanged) would have failed. The overlay's `onPointerDown` therefore closes the sheet at once for mouse and pen, as before. Touch still waits for its click, so a tap cannot fall through to the page.
- **Files modified:** `apps/csrm/src/components/shell/capability-navigation.tsx`
- **Verification:** `mobile-navigation.test.tsx` passes unchanged, the sheet cases in `navigation-guard.test.tsx` pass, and `QUES09_LEAVE_WARNING` passes at 375 in the browser.
- **Committed in:** `fae371d`

**2. [Rule 2 - Missing critical] Sign out was not guarded**
- **Found during:** Task 2 (the pilot's drift check on `app-shell.tsx` and the auth adapters)
- **Issue:** described under Decisions. The session ended before the browser's prompt could protect the answers.
- **Fix:** `account-menu.tsx` consults `useNavigationGuard()` on submit, and `guardLink` accepts an optional `href` for a leave that is not a navigation.
- **Files modified:** `apps/csrm/src/components/shell/account-menu.tsx`, `apps/csrm/src/components/csrm/navigation-guard.tsx`
- **Verification:** `navigation-guard.test.tsx` case `Sign out asks first while something is unsaved, and signs out only on Leave questionnaire`.
- **Committed in:** `5eb1090` (test), `fae371d` (code)

**3. [Rule 1 - Bug] A blocked autosave would stay blocked after Refresh page**
- **Found during:** Task 1
- **Issue:** `router.refresh()` keeps the renderer mounted, so the hook's block, and the form's stale values, would survive the refresh.
- **Fix:** Refresh page records the payload it came from. When a new payload arrives, the renderer re-seeds the definition and the form and calls the hook's `reset()`.
- **Files modified:** `questionnaire-renderer.tsx`, `use-answer-autosave.ts`
- **Verification:** the blocked case in `questionnaire-renderer.test.tsx` calls `router.refresh` once, and the journey passes.
- **Committed in:** `85d4994`

**4. [Plan wording] Hook contract additions**
- `saveNow()` (Save draft and the save before submit wait for any save in flight, then save) and `reset()` sit beside the planned `flush`, so blur and Save draft keep different semantics.
- `guardLink`'s `href` is optional, for Sign out.

**5. [Plan wording] Tests changed beyond the two named assertions**
- `questionnaire-renderer.test.tsx` "preserves values after draft failure…" now expects the save status's alert (`Your latest answers weren’t saved.`) instead of the retired form-level alert text, scoped to the completion region because a file-upload question also renders an alert. `:142` (one empty status at load) is unchanged.
- In `navigation-guard.test.tsx`, two GREEN-time test bugs were fixed:
  - a link named `Workspace` clashed with the navigation's own `Workspace` item;
  - a hidden-role lookup could not compute the hidden sheet's name, so it now asserts on the sheet element.
- `app-shell-account.test.tsx`'s `next/navigation` mock gains `useRouter`, because AppShell now mounts the provider.
- The RED renderer test loaded the session record through a dynamic specifier so it could fail on assertions. GREEN switched it to a static import.

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug), plus 2 plan-wording clarifications.
**Impact on plan:** every change serves D-11 and D-12 or keeps an existing test unchanged. No content type, Strapi source, dependency or contract changed.

## TDD Gate Compliance

Both TDD tasks have a RED `test(10-08)` commit before their GREEN `feat(10-08)` commit (`7b56d0b` then `85d4994`; `5eb1090` then `fae371d`). Both RED runs validated `RED_EVIDENCE_OK`. No REFACTOR commit was needed.

## Issues Encountered

- `check tdd-red-evidence` matches the full TAP test name and reports the first failing test. A run that mixes a load failure (a new module's test file) with the target reads as INVALID_RED, so evidence was recorded on the target file alone.
- A long Bash heredoc with typographic apostrophes was rejected by the shell, so edit scripts ran from the scratchpad.

## Known Stubs

None.

## Deferred

- `@radix-ui/react-dialog` 1.1.15 is now unused by app source. Removing it is a dependency and lockfile change, recorded in `.planning/phases/10-existing-flow-gap-closure/deferred-items.md`.
- The browser's `beforeunload` prompt on reload and the status announcements under a screen reader are manual checks (coverage D6; `10-VALIDATION.md` Manual-Only; plan 10-23's walkthrough).

## Threat Flags

None. No new endpoint, auth path or trust-boundary surface:
- the autosave action reuses the Requestor-only save operation and its validation (T-10-19, T-10-20);
- the guard and the session record are client-only and hold the Requestor's own saved answers in tab memory (T-10-60).

## User Setup Required

None.

## Next Phase Readiness

- Plan 10-09 can rely on `ConfirmDialog` controlled mode. The E3 and E9 rows of UI-SPEC §19.1, research-numbered 10-08, belong to the governance plan.
- Plan 10-13 can reuse `SaveStatus` with `savedLabel={(time) => <>Risk saved at {time}</>}` for D-33's save confirmations.
- Plan 10-23's walkthrough should try reload with a waiting save (the browser prompt), the leave warning from the 375 sheet, and Back after an autosave.

## Self-Check: PASSED

- FOUND: `use-answer-autosave.ts`, `use-answer-autosave.test.tsx`, `save-status.tsx`, `save-status.test.tsx`, `navigation-guard.tsx`, `navigation-guard.test.tsx`, `deferred-items.md`.
- FOUND: commits `7b56d0b`, `85d4994`, `5eb1090`, `fae371d` and `1dfdbef`. `git rev-list --count d8e07b9..1dfdbef` is 5.
- Every acceptance criterion was re-run and passed. Task 1:
  - the four renderer symbols are present, and `Questionnaire not saved` is absent;
  - `questionnaire-detail.tsx` passes `serverUpdatedAt`;
  - the autosave `awk` count is 0;
  - the spec carries the three QUES09 markers and waits for Saved at before reloading.
- Task 2:
  - `onNavigate` and `guardLink` are in `capability-navigation.tsx`;
  - `GuardedLink` is in `wordmark.tsx` and `questionnaire-detail.tsx`;
  - `NavigationGuardProvider` is in `app-shell.tsx`;
  - the guard file holds the four required strings;
  - the test renders `MobileNavigation` with a blocking guard;
  - the spec holds `QUES09_LEAVE_WARNING`.
- Task 3: the guard lists all four files, and the full Playwright run had no failures.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
