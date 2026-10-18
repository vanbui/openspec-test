---
phase: 13-request-pick-up-and-notes
plan: 10
subsystem: ui
tags: [request-notes, x-16, x-17, notes-thread, composer, optimistic-ui, mark-read, intersection-observer, request-hub, skeleton, print, playwright, axe, performance-budget]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: listRequestNotes, the three notes Server Actions, notePartLabels, validateNoteDraft and family L (13-05); the request read's notes summary (13-06); the analyst assignment view's viewer and the hub's people rows (13-09)
  - phase: 10-workflow-integrity-and-generation-reliability
    provides: LocalInstant (X-3), refusal-copy.ts, the shared EmptyState and ErrorState
provides:
  - NotesSection (server), the last section on both request pages, with the viewer's description and count line
  - NotesThread, NoteItem, NoteComposer, UnreadDot and UnreadCount, NotesSkeleton
  - Optimistic posting with Adding..., rollback that hands the text back, Note added. once, one post at a time
  - Mark-read once per view through the newest loaded note, when the first unread note is seen; New kept for the view
  - The closed lines, the empty states, the failed-read state, Show earlier notes and the ten-line clamp
  - The hub's Notes figure row (figure link, Add a note, or No notes)
  - notes-domain additions (notesDescription, notesCountLine, composerHint, notesClosedLine, notesEmptyState, noteHeader, hubNotesFigure and the fixed words)
  - COLLAB01_NOTES_BETWEEN_JANE_AND_BOB, COLLAB01_OTHER_REQUESTOR_REFUSED and COLLAB01_NOTES_CLOSED_ON_RELEASED @journey at 1440 and 375
affects: [13-11, 13-12, 13-13, 13-17, 13-18, 13-19, 17]
actuals:
  tokens: 24800
  tasks: 3
  commits: 5
plan_head_before: 47b9f5390752eb9c708b16c77d684b47d7ac03a1
plan_head_after: 4b3958754a94e6ba27e26f0afadc1c1eb0bf5295
tech-stack:
  added: []
  patterns:
    - "A thread keeps every note this view has loaded in a map by id, merged with each server render, so a revalidation after a post never drops an earlier page"
    - "Unread is captured per view: the set of note ids first shown as unread keeps New after the server reads them as read"
    - "A server-rendered section that reads its own data is rendered by the page only when the request read gave the viewer a summary, so a refused viewer gets no element and no read"
key-files:
  created:
    - apps/csrm/src/features/request-notes/notes-section.tsx
    - apps/csrm/src/features/request-notes/notes-section.test.tsx
    - apps/csrm/src/features/request-notes/notes-thread.tsx
    - apps/csrm/src/features/request-notes/notes-thread.test.tsx
    - apps/csrm/src/features/request-notes/note-item.tsx
    - apps/csrm/src/features/request-notes/note-item.test.tsx
    - apps/csrm/src/features/request-notes/note-composer.tsx
    - apps/csrm/src/features/request-notes/note-composer.test.tsx
    - apps/csrm/src/features/request-notes/unread-marker.tsx
    - apps/csrm/src/features/request-notes/unread-marker.test.tsx
    - apps/csrm/src/features/request-notes/notes-skeleton.tsx
    - apps/csrm/e2e/request-notes.spec.ts
  modified:
    - apps/csrm/src/features/request-notes/notes-domain.ts
    - apps/csrm/src/features/request-notes/notes-domain.test.ts
    - apps/csrm/src/features/requests/request-hub.tsx
    - apps/csrm/src/features/requests/request-hub.test.tsx
    - apps/csrm/src/features/requests/request-routes.test.tsx
    - apps/csrm/app/(app)/app/requests/[documentId]/page.tsx
    - apps/csrm/app/(app)/app/requests/[documentId]/loading.tsx
    - apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx
    - apps/csrm/app/(app)/app/review/requests/[documentId]/loading.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/playwright.config.ts
key-decisions:
  - "Copy: the composer adopts 13-05's control-character sentence, 'Remove the hidden formatting characters from the note, then add it.', as its third validation message. It says what is wrong and how to fix it (3.3.3), and it matches §8.3's other two sentences in form. 13-UI-SPEC §8.3 should gain it at the next contract edit."
  - "The over-length count reads 'It has 5,001.' (the shipped validateNoteDraft and the Voice rule's formatted numbers), not the plan's 'It has 5001.'."
  - "Show earlier notes counts what remains as the oldest loaded note's sequence less one: sequences run from 1 with no gaps and nothing is ever removed (D-21), so the count stays right between a post and the page's next render."
  - "A note being added shows the viewer's own name: the Requestor's name when Strapi gives the viewer the Requestor's part, and the analyst view's viewer (13-09) otherwise. A note whose author the API cannot name reads 'The Requestor' or 'A Security Analyst', never an invented name."
  - "§8.4 marks a never-submitted draft 'not applicable' for analysts; should one see it, the thread shows the analyst's draft line, 'Notes are paused while this request is a draft.'"
  - "Both pages render NotesSection only when the request read carries a notes summary, so a participant or another Requestor gets no element, no count and no notes read."
  - "The empty and failed-read states reuse the shared EmptyState (first-use 'No notes yet', cleared 'No notes') and ErrorState ('We couldn’t load the notes', Try again refreshes the page) at compact density."
  - "COLLAB-01 stays Pending until the phase gate, as in 13-03 to 13-09."
patterns-established:
  - "NotesSection({ requestId, requestNumber, viewer, summary, authorNames }) is how a request page shows its notes; 13-11 adds draftOwnerKey"
requirements-completed: []
coverage:
  - id: D1
    description: "Both request pages end with a Notes section: an ordered thread, oldest first, each note with its author's name, part and local time, the body as text with line breaks kept, and no edit or delete control"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/notes-thread.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/note-item.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/notes-section.test.tsx"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_NOTES_BETWEEN_JANE_AND_BOB @journey"
        status: pass
    human_judgment: false
  - id: D2
    description: "Adding a note is optimistic with Adding..., takes the server's time with a polite Note added., rolls back with family L's copy and the text restored; Ctrl/⌘+Enter posts; one post at a time"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/note-composer.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/notes-thread.test.tsx#posting a note (13-UI-SPEC §9.1)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_NOTES_BETWEEN_JANE_AND_BOB @journey"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unread notes carry the X-17 New marker for the page view; the thread is marked read once, silently, when the first unread note is seen; the hub's Notes figure flags them"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/notes-thread.test.tsx#marking the thread read (13-UI-SPEC §9.2; D-24)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-hub.test.tsx#RequestHub’s Notes row (13-UI-SPEC §5.1)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_NOTES_BETWEEN_JANE_AND_BOB @journey"
        status: pass
    human_judgment: false
  - id: D4
    description: "Closed lines, empty states, the failed-read state, Show earlier notes, the ten-line clamp, the skeleton block and print hiding"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/notes-thread.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/notes-section.test.tsx#the Notes section’s other states (13-UI-SPEC §8.4 to §8.6)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_NOTES_CLOSED_ON_RELEASED @journey"
        status: pass
    human_judgment: false
  - id: D5
    description: "Another Requestor or a participant gets the page's refusal state and no notes surface, count or flag; a read with notes null renders and reads nothing"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-routes.test.tsx#renders no notes surface and reads no notes"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_OTHER_REQUESTOR_REFUSED @journey"
        status: pass
    human_judgment: false
  - id: D6
    description: "At 375px the composer, its hint and Add note fit without horizontal scroll, and the textarea grows to twelve rows then scrolls inside itself"
    requirement: "COLLAB-01"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_NOTES_BETWEEN_JANE_AND_BOB @journey (no overflow with the composer focused)"
        status: pass
    human_judgment: true
    rationale: "UI Considerations backstop: the twelve-row growth with a long typed note is the orchestrator's browser walk (13-19)."
duration: 30min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 10: The Notes Thread on Both Request Pages Summary

**Jane and Bob now write to each other at the foot of the request page: each note is attributed by name and part with a local time, appears at once while it is added, is flagged New to the other actor, and stays readable, but closed, once the assessment is released.**

## Performance

- **Duration:** about 30 minutes of execution (2026-10-08T20:48Z to 21:19Z), the Playwright runs included
- **Tasks:** 3. Task 1 is the tracer; Tasks 1 and 2 ran RED then GREEN.
- **Files changed:** 23 (12 created)

## Accomplishments

- **Section (§8.1).** `NotesSection` is a Server Component. It reads the newest 20 notes and renders a `DetailSection` titled `Notes` inside `#notes`, with:
  - the viewer's description (the Requestor's includes the AI transparency sentence);
  - the count line, `{n} {note|notes}` and the X-17 `{k} new`;
  - the client `NotesThread`.

  Both pages render it last, and only when the request read carries a notes summary.
- **Thread (§8.2).**
  - An `ol` named `Notes on {RAR}`, oldest first. Each note is an `li` holding an `article` with `id="note-{id}"` and `tabIndex={-1}`, labelled by the author's name.
  - The header line is the name at 500, then `{part} · ` and `LocalInstant` in a `<time>`, then the X-17 dot and `New`.
  - Bodies are React text, `whitespace-pre-wrap`, wrapping anywhere. They clamp at ten lines with `Show full note` / `Show less` (ghost, `aria-expanded`, `aria-controls`), measured after layout and on resize, and print whole.
- **Posting (§9.1).** `Add note` or Ctrl/⌘+Enter puts the note at the end at the pending opacity with `Adding…`, clears the field and keeps focus.
  - **Success:** the note takes Strapi's note and time, and a visually hidden polite region says `Note added.` once.
  - **Failure:** the note fades out at `--duration-base`. The text returns with the cursor at the end, family L's sentence shows as the field error, and a retryable failure adds `Try again`.
  - **404:** refreshes the page, so it shows its own refusal state.
  - A second press while one is pending does nothing.
- **Read (§9.2).** An `IntersectionObserver` on the first unread note calls `markRequestNotesReadAction` once per view, through the newest loaded note. Nothing visible changes and failures are ignored. The `New` set is captured for the view, so markers survive the revalidation that follows a post.
- **States.**
  - **Closed (§8.4):** the closed line, with a 16px `Lock` and `tabIndex={-1}` for 13-11, replaces the composer.
  - **Empty (§8.5):** `No notes yet` with the actor's next step, or `No notes` above the closed line.
  - **Failed read (§8.6):** `We couldn’t load the notes` with `Try again`; the composer stays.
  - **Earlier notes:** an outline `Show earlier notes ({m})` loads the previous 20 above, with `Loading…` and its 16px spinner. The viewport is held and focus moves to the first inserted note. A failure shows `We couldn’t load earlier notes.` with `Try again` in its place.
- **Composer (§8.3).**
  - A labelled three-row textarea (`#note-composer`) that grows to twelve rows, then scrolls. It has no `maxLength` and declares `aria-keyshortcuts`.
  - The viewer's hint, including the requesting analyst's sentence, from Strapi's `viewerPart`.
  - `Add note`, primary, full width at touch height below 768px, followed by the X-7 keys from 768px.
  - `data-print="hidden"`.
- **Hub (§5.1).** The `Notes` row follows the holder row:
  - a figure link to `#notes`, named `{n} notes, {k} new`;
  - or `Add a note` to `#note-composer`;
  - or `No notes`;
  - no row at all when the read has no summary.
- **Skeleton.** `NotesSkeleton` closes both request pages' `loading.tsx`: a heading line, two notes of three lines, and a textarea block.
- **Copy guard.** It now reads every `.tsx` and `-domain.ts` file in `features/request-notes`. A domain test asserts that no notes string contains `Accept`.

## Test Counts

- **Task 1.**
  - RED (`59ca081`): `Tests 13 failed | 43 passed`, with 5 files unable to load their missing modules.
  - GREEN (`7b0d8f9`): the verify set (`src/features/request-notes`, the hub test, the copy, zod and server-only guards) passed `Test Files 12 passed`, `Tests 301 passed`, with typecheck and lint clean. The page-level route tests (request routes, analyst route gate, review workflow, metadata) passed `Tests 208 passed`.
  - The tracer gate re-ran this verify, and it passed.
- **Task 2.**
  - RED (`a0f42da`): 17 failed. The participant page test failed because the unconditional async section blanked the page.
  - GREEN (`7dbbaea`): `src/features/request-notes src/features/requests` passed `Test Files 19 passed`, `Tests 203 passed`, with typecheck and lint clean. The guards, `src/test` and the analyst page tests passed `Tests 312 passed`.
- **Task 3 (`4b39587`).**
  - The mobile list collects all three journeys.
  - Playwright for `request-notes` and `requestor-request-workflow`: **8 passed (desktop 4, mobile 4)**, run twice (once before the commit, once as the plan's verify command).
  - `performance.spec.ts --project desktop`: **11 passed**, run twice.
  - The plan's full verify command exited 0, and the tree was clean after every run.
- **Full web unit suite:** `Test Files 185 passed`, `Tests 4015 passed`.
- **Strapi suite:** not run, because this plan changed no Strapi source.

## Performance Budget (delivered JavaScript, desktop medians)

The source is `apps/csrm/.tmp/performance/baseline-desktop.json`. The budget is 300,000 bytes and is unchanged; `PERFORMANCE_BUDGETS` and `ROUTE_BUDGET_OVERRIDES` are untouched.

| Route | After 13-09 (13-09-SUMMARY) | After 13-10 | Headroom |
|---|---|---|---|
| `/app/requests/{documentId}` (Requestor) | 266,128 | **274,147** (+8,019) | 25,853 |
| `/app/risks/{documentId}` (Security Analyst) | 299,874 | **299,870** (−4, compression noise; nothing on the route changed) | 130 |

No source fix was needed. The composer stays in the request page's first load, so 13-11 starts from 274,147 bytes. That plan's switch, checkbox, session text and well still have room within the budget. Its `next/dynamic` fallback stays available.

## Task Commits

1. **Task 1 (tracer):** `59ca081` (test, RED), `7b0d8f9` (feat, GREEN)
2. **Task 2:** `a0f42da` (test, RED), `7dbbaea` (feat, GREEN)
3. **Task 3:** `4b39587` (test)

## Decisions Made

See `key-decisions` above. In brief:

- **Copy.** The composer adopts 13-05's control-character sentence verbatim as the third §8.3 validation message. It fits §8.3's pattern: say what is wrong, then how to fix it. The UI-SPEC should record it.
- **Counts.** `It has 5,001.` uses the formatted number.
- **Earlier notes.** The count of what remains comes from sequences.
- **Names.** The pending note shows the viewer's own name. An author the API cannot name reads by their part.
- **Closed draft for an analyst.** The analyst sees the draft line.
- **Refused viewers.** A viewer without a notes summary gets no section and no read.
- **Shared states.** The empty and error states reuse `EmptyState` and `ErrorState`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The page-level participant proof lives in `request-routes.test.tsx`**
- **Found during:** Task 2.
- **Issue:** the plan's participant case asks for a request page rendered from a read with `notes: null`. No file in the plan's list renders a page.
- **Fix:** a case in `src/features/requests/request-routes.test.tsx` renders the Requestor page with `notes: null`. It asserts no Notes heading, row, count, `New` or `#notes`, and no `listRequestNotes` call. The file is outside the plan's list.
- **Commit:** `a0f42da`

**2. [Rule 1 - Bug] The Requestor page renders `NotesSection` only when there is a summary**
- **Found during:** Task 2 RED.
- **Issue:** rendered unconditionally, the async section is still an element in the page tree.
- **Fix:** both pages now guard on `request.notes`, as the analyst page already did.
- **Commit:** `7dbbaea`

**3. [Interface] `NotesSection`'s props**
- **What changed:** the props are `{ requestId, requestNumber, viewer, summary, authorNames }`, not `{ …, draftOwnerKey }`.
- **Why:** the session draft is 13-11's work, and its plan adds `draftOwnerKey` to `NotesSection` and both pages. `summary` carries the closed reason and the fallback figures when the notes read fails. `authorNames` names the pending note.
- **`composerHint`:** it takes `(viewer, viewerPart)`, not the plan's `(viewerPart, isAnalyst, ownRequest)`. The page decides which viewer is shown, and `viewerPart` alone settles the requesting analyst.

**4. [Scope note] `NOTES_CLOSED` while composing**
- **Current behaviour:** family L's sentence ("…Your text is kept below.") shows as the field error, and the text stays in the composer.
- **Hand-off:** the read-only well and the page refresh are 13-11's work (§9.4).

---

**Total deviations:** 4: one Rule 2 test outside the file list, one Rule 1 page fix, one interface note and one scope note.
**Impact on plan:** every planned behaviour shipped. No Strapi source, specification or content type changed, and no dependency was added.

## Issues Encountered

- **Next server log noise.** The production Next server logged the known `The destination stream closed early.` lines (08-02's noise) during the runs; no test failed on them.
- **Harness cleanup.** The harness could not remove one ignored `.tmp/playwright-e2e-*.db` (EPERM). It is ignored scratch and was left in place.

## Threat Model Coverage

- **T-13-34:** bodies are React text only. No file in `features/request-notes` contains `dangerouslySetInnerHTML`, and a test asserts it. Unit tests render `<b>x</b>`, `<script>` and a URL in a body as literal text with no link.
- **T-13-35:** the page shows its refusal state before any notes read, and `NotesSection` reads nothing without a summary. The e2e asserts that neither the note text nor the title appears anywhere in the other Requestor's page source.
- **T-13-36:** mark-read changes nothing visible, and no read state is shown to anyone.
- **T-13-SC:** no package was added.

## Known Stubs

None. The AI-input switch and checkbox, the session-kept draft and the unsent-text well are 13-11's planned scope.

## Next Phase Readiness

- **For 13-11:** these pieces are ready:
  - `NoteItem` (for the switch and the X-11 note);
  - `NoteComposer` (the checkbox and session text, where `onSubmit` takes the body);
  - `NotesThread` (the well under the closed line, which already carries `tabIndex={-1}`);
  - `NotesSection` and both pages (`draftOwnerKey`).

  The request page's first load is 274,147 bytes.
- **COLLAB-01:** stays Pending until the phase gate.

## Self-Check: PASSED
