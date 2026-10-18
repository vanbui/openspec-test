---
phase: 13-request-pick-up-and-notes
plan: 11
subsystem: ui
tags: [request-notes, x-18, x-14, x-11, ai-input-mark, undo-toast, optimistic-ui, session-storage, beforeunload, unsent-well, playwright, axe, performance-budget]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: setNoteAiInputAction and family M (13-06); the session store, draftOwnerKey, useUnloadWarning and toastAction (13-09); NotesSection, NotesThread, NoteItem and NoteComposer (13-10)
  - phase: 12-ai-context-suggestions-and-provenance
    provides: successToast (X-14), the X-11 provenance-note recipe
provides:
  - NoteAiInputSwitch, the X-18 per-note switch with an Undo toast and family M rollback
  - NoteItem's three branches (switch, X-11 note, nothing)
  - The composer's off-by-default Changes the AI inputs checkbox
  - Session-kept composer text with its restored caption, the beforeunload-only warning, and clearing once added
  - UnsentNoteWell under the closed line (Copy text, Discard text with Undo), fed by a NOTES_CLOSED refusal or a kept draft
  - NotesSection and both request pages pass draftOwnerKey
  - notes-domain additions (aiMarkCopy, aiMarkToast, aiMarkUndoToast, unsentWellCopy, notesCopy.restored)
  - COLLAB01_MARK_CHANGES_AI_INPUTS, COLLAB01_UNSENT_NOTE_SURVIVES_NAVIGATION and COLLAB01_REQUESTING_ANALYST_NO_MARK @journey at 1440 and 375
affects: [13-12, 13-13, 13-17, 13-18, 13-19, 17]
actuals:
  tokens: 22200
  tasks: 3
  commits: 5
plan_head_before: c9295daf0a9bd333fc1d4c88c67056ebed336095
plan_head_after: 0456837e7b2c8c4cb2c25f2654cd69a2a38b22a0
tech-stack:
  added: []
  patterns:
    - "A per-item optimistic toggle keeps Strapi's last answer in state under useOptimistic, so a refused change rolls back by itself and a re-rendered page resets it"
    - "The composer writes the exact text being sent to the session store when it posts and clears it only once Strapi records the note, so a refusal, a closed window or a closed tab loses nothing"
    - "A self-hiding well owns its Undo: Discard hides it and calls the owner; Undo shows it again, calls the owner and focuses its first action"
key-files:
  created:
    - apps/csrm/src/features/request-notes/note-ai-input-switch.tsx
    - apps/csrm/src/features/request-notes/note-ai-input-switch.test.tsx
    - apps/csrm/src/features/request-notes/unsent-note-well.tsx
    - apps/csrm/src/features/request-notes/unsent-note-well.test.tsx
  modified:
    - apps/csrm/src/features/request-notes/notes-domain.ts
    - apps/csrm/src/features/request-notes/notes-domain.test.ts
    - apps/csrm/src/features/request-notes/note-item.tsx
    - apps/csrm/src/features/request-notes/note-item.test.tsx
    - apps/csrm/src/features/request-notes/note-composer.tsx
    - apps/csrm/src/features/request-notes/note-composer.test.tsx
    - apps/csrm/src/features/request-notes/notes-thread.tsx
    - apps/csrm/src/features/request-notes/notes-thread.test.tsx
    - apps/csrm/src/features/request-notes/notes-section.tsx
    - apps/csrm/src/features/request-notes/notes-section.test.tsx
    - apps/csrm/app/(app)/app/requests/[documentId]/page.tsx
    - apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx
    - apps/csrm/e2e/request-notes.spec.ts
key-decisions:
  - "A refused Undo of the mark uses §10.4's one failure title, 'Mark not changed' (family M has no separate Undo title; 'Couldn’t undo' is family K's)."
  - "A browser that refuses the clipboard (an insecure context or a denied permission) gets a danger toast 'Note text not copied' with 'The text is selected, so you can copy it yourself.', and the well's text is selected. §9.4 names only the success; leaving a failed Copy silent would mislead. 13-UI-SPEC §9.4 should gain the two sentences at the next contract edit."
  - "The X-11 note on a marked note is rendered in NoteItem with the direction's provenance-note recipe (12px Sparkles, --text-caption, --color-text-secondary, no fill or border). features/ai-assistance has no shared provenance-note component: AiAssistanceNotice is the Requestor's sentence, a different X-11 form."
  - "The composer writes the exact text being sent to the store when it posts, and clears it only once Strapi records the note (unless the person has already started the next one). A pending keep is written at once when the composer unmounts, so navigating within 300ms keeps the text."
  - "The beforeunload warning is armed while the trimmed text is non-empty: a whitespace-only field cannot be posted and holds nothing worth a prompt."
  - "The checkbox goes back to off after a successful post (each note is its own choice, X-18 'off by default') and stays as it was after a failed one, so Try again sends the same note."
  - "The unsent well does not print (data-print hidden): it is not a note and not part of the record. Its height is unbounded, so the whole text is readable without a nested scroll region."
  - "No next/dynamic split was needed: the route stays 20,165 bytes under budget, and an analyst sees the switch with the page, not after a second load."
  - "COLLAB-01 stays Pending until the phase gate, as in 13-03 to 13-10."
patterns-established:
  - "NotesSection({ requestId, requestNumber, viewer, summary, authorNames, draftOwnerKey }) is how a request page shows its notes"
  - "NoteComposer's onSubmit(body, options?) receives { changesAiInputs: true } only when the mark is chosen"
requirements-completed: []
coverage:
  - id: D1
    description: "A human Security Analyst who did not raise the request sees a Changes the AI inputs switch under every note; it applies at once with an Undo toast and rolls back with family M"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/note-ai-input-switch.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/notes-thread.test.tsx#the AI-input mark in the thread (13-UI-SPEC §10.1; D-26)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_MARK_CHANGES_AI_INPUTS @journey"
        status: pass
    human_judgment: false
  - id: D2
    description: "A requesting analyst sees only the X-11 note on a marked note and no checkbox; the Requestor sees neither switch nor mark"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/note-item.test.tsx#the AI-input mark on a note (13-UI-SPEC §10.1, D-26)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_REQUESTING_ANALYST_NO_MARK @journey"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_MARK_CHANGES_AI_INPUTS @journey (Jane's page)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The composer's off-by-default checkbox sends changesAiInputs only when checked"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/note-composer.test.tsx#the composer’s AI-input checkbox (13-UI-SPEC §8.3; X-18; D-26)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Unsent note text is kept per person and request, restored with its caption, cleared once added, arms only the beforeunload warning, and survives in-app navigation"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/note-composer.test.tsx#the composer’s kept text (13-UI-SPEC §9.3; D-25)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/notes-section.test.tsx#the kept note text on both request pages (13-UI-SPEC §9.3; UI-D17)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_UNSENT_NOTE_SURVIVES_NAVIGATION @journey"
        status: pass
    human_judgment: false
  - id: D5
    description: "When notes close with text unsent, the closed line shows above a read-only well with Copy text and Discard text; Discard confirms with an Undo toast and Undo puts the text back"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/unsent-note-well.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/notes-thread.test.tsx#notes closed with unsent text (13-UI-SPEC §9.4)"
        status: pass
    human_judgment: true
    rationale: "The browser half of a NOTES_CLOSED refusal mid-composition needs the request released while a note is being written; it is the orchestrator's browser walk (13-19). The unit tests prove the refusal, the refresh, the well and its Undo."
duration: 22min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 11: The AI-Input Mark and No Lost Note Text Summary

**A Security Analyst now marks which notes change what CSRM sends to the AI, from a switch under each note or a checkbox while writing one, with an Undo and a rollback. Nobody loses a note they were writing: the text survives navigation for the session, and a request that closes mid-sentence keeps it in a copyable well.**

## Performance

- **Duration:** about 22 minutes (2026-10-08T21:19Z to 21:41Z), the Playwright runs included
- **Tasks:** 3. Task 1 is the tracer; Tasks 1 and 2 ran RED then GREEN.
- **Files changed:** 17 (4 created)

## Accomplishments

- **The switch (§10.1, §10.4; X-18).** `NoteAiInputSwitch` sits under the body of every note for a viewer Strapi serves `canMarkAiInputs`. It is labelled `Changes the AI inputs` and described by the note's header line.
  - **Applying:** it flips at once at the pending opacity and calls `setNoteAiInputAction` once.
  - **Success:** it toasts `Note marked as changing the AI inputs.` or `Note no longer marked as changing the AI inputs.` through `successToast`, with `Undo` through `toastAction`. `Undo` is a second recorded change and confirms with `Mark removed.` or `Mark restored.`.
  - **Failure:** it rolls back and shows a danger toast titled `Mark not changed` with family M's sentence, plus `Try again` (retryable) or `Refresh page` (blocked). A network failure reads as family M's retryable sentence.
  - Focus stays on the switch throughout. The row is touch height below 768px and does not print.
- **Who sees what (D-26, D-07).** `NoteItem` renders the switch only with `canMarkAiInputs`. Otherwise a marked note shows the X-11 note `Changes the AI inputs` with a 12px `Sparkles`. A Requestor's notes carry no `changesAiInputs`, so they show neither. A note still being added shows no switch.
- **The checkbox (§8.3).** With `canMarkAiInputs`, the composer shows `Changes the AI inputs`, off by default, with the hint `Include this note in what CSRM sends to the AI for this request.`. The thread sends `changesAiInputs: true` only when it is checked. It goes back to off after a successful post and stays as it was after a failed one.
- **Kept text (§9.3; D-25; UI-D17, UI-D18).** The composer keeps its text in the session store under the person's opaque key and the request:
  - 300ms after typing pauses;
  - at once when a post starts;
  - at once when the composer leaves the page.

  It restores the text on return with `Restored from earlier in this session.` (part of the field's description), and clears it once Strapi records the note. While the field holds text, only the browser's `beforeunload` prompt is armed, through 13-09's `useUnloadWarning`. The composer never imports the leave guard.
- **The well (§9.4; D-22; UI-D19).** A `NOTES_CLOSED` refusal keeps the text and refreshes the page. Once the page reads the window as closed, the §8.4 line shows above `UnsentNoteWell`. A closed request with kept text shows the same well on load.
  - **Layout:** the text is read-only on `--color-bg-inset` with its line breaks kept.
  - **Copy text:** writes the clipboard and toasts `Note text copied.`. A refused clipboard selects the text and says so.
  - **Discard text:** removes the well and the kept draft, toasts `Note text discarded.` with `Undo`, and focuses the closed line.
  - **Undo:** restores both, toasts `Note text restored.` and focuses `Copy text`.
- **Pages.** Both request pages pass `draftOwnerKey` (13-09's server helper) to `NotesSection`. The Requestor page computes it from the session it already reads, as the analyst page does.

## Test Counts

- **Task 1.**
  - RED (`abdc716`): `Tests 9 failed | 101 passed`, with the switch's test file unable to load its missing module.
  - GREEN (`dc01be7`): the verify set (`src/features/request-notes`, the zod boundary and copy guards) passed `Test Files 11 passed`, `Tests 293 passed`, with typecheck and lint clean.
  - The tracer gate re-ran this verify, and it passed.
- **Task 2.**
  - RED (`da9ceba`): `Tests 14 failed | 134 passed`, with the well's test file unable to load.
  - GREEN (`fe3da00`): `src/features/request-notes src/lib/session-drafts` passed `Test Files 12 passed`, `Tests 153 passed`, with typecheck and lint clean.
  - The page-level route tests, guards and shell tests (`src/features/requests`, analyst route gate, review workflow, `src/lib/performance`, `src/components/shell`) passed `Test Files 24 passed`, `Tests 504 passed`.
- **Task 3 (`0456837`).**
  - The mobile list collects all six request-notes journeys, the three new ones included.
  - Playwright `request-notes.spec.ts`: **12 passed (desktop 6, mobile 6)**, run twice (once before the commit, once as the plan's verify command).
  - `performance.spec.ts --project desktop`: **11 passed**, run twice.
  - The plan's full verify command exited 0, and the tree was clean after every run.
- **Full web unit suite:** `Test Files 187 passed`, `Tests 4066 passed`.
- **Strapi suite:** not run, because this plan changed no Strapi source.

## Performance Budget (delivered JavaScript, desktop medians)

The source is `apps/csrm/.tmp/performance/baseline-desktop.json`. The budget is 300,000 bytes and is unchanged; `PERFORMANCE_BUDGETS` and `ROUTE_BUDGET_OVERRIDES` are untouched.

| Route | After 13-10 (13-10-SUMMARY) | After 13-11 (first run / verify run) | Headroom |
|---|---|---|---|
| `/app/requests/{documentId}` (Requestor) | 274,147 | **279,835** / 279,835 (+5,688) | 20,165 |
| `/app/risks/{documentId}` (Security Analyst) | 299,870 | **299,740** / 299,736 (no growth; nothing on the route changed) | 260 |

No source fix was needed. The switch, the checkbox, the session text, the well and the X-14 toast helpers join the request page's first load statically, so an analyst sees the switch with the page. The `next/dynamic` fallback for `NoteAiInputSwitch` and `UnsentNoteWell` stays available to later plans that need room on this route.

## Task Commits

1. **Task 1 (tracer):** `abdc716` (test, RED), `dc01be7` (feat, GREEN)
2. **Task 2:** `da9ceba` (test, RED), `fe3da00` (feat, GREEN)
3. **Task 3:** `0456837` (test)

## Decisions Made

See `key-decisions` above. In brief:

- **A refused Undo** reads `Mark not changed`.
- **A refused clipboard** selects the text and says so. These are two new sentences; §9.4 should record them.
- **The X-11 note** is built inline with the direction's recipe, because no shared component exists.
- **The store** holds the exact text being sent until Strapi records it, and flushes on unmount.
- **The guard** arms on trimmed text.
- **The checkbox** resets after success and is kept after a failure.
- **The well** does not print and is not height-bounded.
- **No dynamic split** was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `canMarkAiInputs` wired through the thread and section in Task 1**
- **Found during:** Task 1 GREEN.
- **Issue:** the tracer is "Bob marks Jane's note from the thread". `NotesSection` did not pass `meta.canMarkAiInputs` on, and `NotesThread` did not pass it to `NoteItem` or `NoteComposer`, so the switch could not reach a page.
- **Fix:** `notes-thread.tsx` and `notes-section.tsx` (both in Task 2's file list) carry `canMarkAiInputs` in the Task 1 commit. The thread sends `changesAiInputs: true` only when it is chosen. A thread test proves the switch on every note and the mark reaching the add action.
- **Commit:** `dc01be7`

**2. [Rule 2 - Missing proof] The pages' `draftOwnerKey` is proven in `notes-section.test.tsx`**
- **Found during:** Task 2 RED.
- **Issue:** the plan asks for a proof that both pages pass `draftOwnerKey`. The pages render the async `NotesSection`, which the route tests cannot render with a summary.
- **Fix:** `notes-section.test.tsx` (outside the plan's file list) renders the section with a key and asserts that the kept text is restored. It also reads both page sources for the import and the prop.
- **Commit:** `da9ceba`

**3. [Copy] Two sentences for a refused clipboard**
- **What changed:** `unsentWellCopy.copyFailed` and `copyFailedHint` are not in 13-UI-SPEC §9.4.
- **Why:** a silent failed copy would leave the person believing their text is on the clipboard (G-4 no lost input).

---

**Total deviations:** 3: one Rule 3 wiring move between tasks, one Rule 2 test outside the file list, and one copy addition.
**Impact on plan:** every planned behaviour shipped. No Strapi source, specification or content type changed, and no dependency was added.

## Issues Encountered

- **Next server log noise.** The production Next server logged the known `The destination stream closed early.` lines (08-02's noise) during the runs; no test failed on them.
- **Heredocs in Bash.** Heredocs carrying `’` failed in this shell, as 13-09 recorded. Those test edits went through a script file in the scratchpad instead.

## Threat Model Coverage

- **T-13-37:** the switch and the checkbox render only from Strapi's `canMarkAiInputs`.
  - Unit tests prove that neither renders for a Requestor or a requesting analyst.
  - `COLLAB01_MARK_CHANGES_AI_INPUTS` proves that Jane's page holds no switch and no mark text.
  - `COLLAB01_REQUESTING_ANALYST_NO_MARK` proves that Bob's own request offers neither.
  - Strapi's refusal is 13-05 and 13-06's.
- **T-13-38:** kept text is keyed `csrm-draft:note:{opaque owner key}:{requestId}`. It is cleared once the note is added and on sign-out (13-09's `clearAllSessionDrafts`). A test proves that another person's or another request's text is never restored.
- **T-13-39 (accepted):** `Copy text` only writes the person's own text; nothing reads the clipboard.
- **T-13-SC:** no package was added.

## Known Stubs

None.

## Next Phase Readiness

- **For 13-12 and 13-13:** `/app/requests/{documentId}` has 20,165 bytes of headroom. `/app/risks/{documentId}` still has only 260, so 13-13's shell change needs its own source fix (13-09-SUMMARY).
- **For 13-18:** `setNoteAiInputAction` revalidates only the analyst request page. Plan 13-18 adds the questionnaire and assessment pages when they show the AI-inputs-changed signal.
- **For 13-19's walk:** the release-while-writing path (a `NOTES_CLOSED` refusal, then the well) and a long note in the well at 375px are worth a look in the browser.
- **COLLAB-01:** stays Pending until the phase gate.

## Self-Check: PASSED
