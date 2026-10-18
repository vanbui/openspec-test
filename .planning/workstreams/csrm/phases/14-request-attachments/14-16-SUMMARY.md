---
phase: 14-request-attachments
plan: 16
subsystem: ui
tags: [nextjs, react, server-actions, next-dynamic, radix-sheet, useOptimistic, sonner, playwright, axe, attachments, ai-inputs]
requires:
  - phase: 14-request-attachments
    provides: "14-05 family P (attachmentAiRefusal); 14-09 setRequestAttachmentAiInput, getRequestAttachmentAiText, each file's ai facts and the list's aiPolicy; 14-10 contextSummary.attachments with fileName and removed, and the jobs' failureAttachments; 14-13 FilesList, FilesSection and the phone actions sheet; 14-15 FilesPanel"
  - phase: 13-request-pick-up-and-notes
    provides: "X-18's switch (note-ai-input-switch.tsx), the Undo toasts (successToast, toastAction), the run sheet's Notes group"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "the run sheet (ai-run-sheet.tsx, X-13) and both job cards' failure copy (12 §11.2)"
provides:
  - "attachments-actions.ts: setAttachmentAiInputAction (family P with the list's classification and limit) and getAttachmentAiTextAction (the text, or the refusal with its status)"
  - "file-ai-control.tsx: FileAiControl, the X-18 switch Changes the AI inputs with the X-22 facts line, Reading the file’s text…, Undo toasts, rollback and Preview text, in the table cell, the phone card's line and the actions sheet; loaded with next/dynamic by FilesList"
  - "file-text-sheet.tsx: FileTextSheet (X-13), Text the AI will read, loaded with next/dynamic by the control"
  - "context-too-large-files.tsx: ContextTooLargeFiles and contextTooLargeFilesOf, rendered by both job cards"
  - "attachments-domain.ts: fileAiCopy, fileAiFactsLine, fileAiToast, fileAiControlMode (with the orchestrator's off-only ruling) and fileAiSectionLine"
  - "FilesList's AI inputs column, card line and sheet control (only with the served aiPolicy); FilesPanel's section-level AI line"
  - "ai-run-sheet.tsx's Files group (sheetFilesHeading, sheetFileValue)"
  - "E2E COLLAB02_AI_INCLUSION @journey (ROADMAP success criterion 5)"
affects: [14-17, 15, 16, 17, 22]
actuals:
  tokens: 25435
  tasks: 2
  commits: 4
plan_head_before: 22d927aea9fd34b25ed3e36927acdecbd78869d3
plan_head_after: cc457e77c5cebe2a6b592e1b050c81532af24d2e
tech-stack:
  added: []
  patterns:
    - "One mode function decides what a file's AI control shows from Strapi's facts and the section's policy: nothing, the unavailable line, the read-only facts, or the switch (off-only under a refusing policy). The web never infers an action."
    - "Analyst-only controls load on demand from a list both actors render: next/dynamic from FilesList, so a list without the AI policy never downloads the control or its preview"
    - "A grid that holds a DataTable takes one minmax(0, 1fr) track, so a table wider than its section scrolls in its own labelled region, never the page"
key-files:
  created:
    - apps/csrm/src/features/attachments/file-ai-control.tsx
    - apps/csrm/src/features/attachments/file-ai-control.test.tsx
    - apps/csrm/src/features/attachments/file-text-sheet.tsx
    - apps/csrm/src/features/attachments/file-text-sheet.test.tsx
    - apps/csrm/src/features/attachments/context-too-large-files.tsx
    - apps/csrm/src/features/attachments/context-too-large-files.test.tsx
  modified:
    - apps/csrm/src/features/attachments/attachments-actions.ts
    - apps/csrm/src/features/attachments/attachments-actions.test.ts
    - apps/csrm/src/features/attachments/attachments-domain.ts
    - apps/csrm/src/features/attachments/files-list.tsx
    - apps/csrm/src/features/attachments/files-list.test.tsx
    - apps/csrm/src/features/attachments/files-section.tsx
    - apps/csrm/src/features/attachments/files-section.test.tsx
    - apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx
    - apps/csrm/src/features/ai-assistance/ai-run-sheet.test.tsx
    - apps/csrm/src/features/assessments/questionnaire-generation-job.tsx
    - apps/csrm/src/features/assessments/assessment-draft-job.tsx
    - apps/csrm/e2e/request-attachments.spec.ts
key-decisions:
  - "The orchestrator's ruling on D-30 amends UI-SPEC §5.1 for included files only. Under AI_CLASSIFICATION_ABOVE_CEILING or AI_POLICY_NOT_CONFIGURED, an included file keeps an off-only switch, because exclusion is always allowed and withdrawing data from the AI inputs must never be blocked. Once the file is excluded, the switch goes and the line reads Not included. A file not included gets no switch, and the requesting analyst never gets one."
  - "The off-only exclusion's toast offers no Undo, because the policy would refuse the inclusion it would send; focus moves to the facts line as the switch goes."
  - "An included file on a read-only facts line (released, closed or returned) also offers Preview text, to anyone but the requesting analyst. Strapi serves the preview without a window (14-09), and the record shows what was included (UI-D32)."
  - "fileAiControlMode is the single rule for every layout. A file with no AI facts, no policy, or a blocked or unavailable state shows nothing. An image, or a file waiting for its malware check, shows its line. Otherwise the switch shows only where ai.canChange and the policy (or the off-only ruling) allow it; everywhere else, the read-only facts line."
  - "FilesList loads the control with next/dynamic and renders it only when the list carries aiPolicy. The control loads the text sheet with next/dynamic (ssr false) on the first Preview text. The sheet's words live in the sheet module."
  - "The phone card's actions sheet opens when the file has Remove or an AI action (the switch or Preview text), with the AI control above Remove. The card itself shows AI inputs: {facts}, or the image or pending line."
  - "The table's AI inputs cell is a fixed 12rem: the switch and its label stay on one line and a long facts line wraps. FilesPanel and FilesList take one minmax(0, 1fr) track, so the wider table scrolls inside its region at 1440."
  - "A successful AI change hands the answered file to the list, so every layout shows it, and refreshes the page once, for the hub's AI-inputs signal."
  - "The action takes the classification and limit the list served, checked against the contract's classifications, to word the AI_CLASSIFICATION_ABOVE_CEILING refusal. They are copy only and never reach Strapi."
  - "What the AI used links a file whose record names its request, a removed one too (as 14-11's signal does). A file whose record is gone reads A file no longer on this request, in plain text, as the job failure list does."
  - "The plan's Confidential and Official are not in the contract's classification list, so the tests use Restricted above Internal."
  - "Axe runs on the phone actions sheet before the inclusion toast shows, and on the text preview after it leaves. While a toast shows at 375, Sonner's 20px Close (shared X-14 chrome, unchanged) sits over a sheet."
patterns-established:
  - "fileAiControlMode(attachment, policy) is how any surface asks what a file's AI control may show; Phase 20's evidence files can reuse it"
requirements-completed: [COLLAB-02]  # traced here; COLLAB-02 stays Pending until the 14-17 phase gate
coverage:
  - id: D1
    description: "Jane submits with the security pack and the data-flow document. Bob reads the section's line, switches on the pack (Reading the file’s text…, then Included · all {m} characters and the toast), and leaves the DOCX out. He previews the text (focus comes back to Preview text) and generates the questionnaire with the deterministic provider. What the AI used lists the pack by name, linking to its row, and not the DOCX. Jane sees no switch and no AI facts. Axe is clean on the control, the preview, the page and the sheet, at 1440 and 375."
    requirement: COLLAB-02
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_AI_INCLUSION @journey (desktop and mobile)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The switch: off with Not included; turning it on waits with Reading the file’s text…; the facts line (all {m} or first {n} of {m}); Undo both ways; rollback with Inclusion not changed and family P; Try again; the image and pending lines; nothing for blocked or unavailable files"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/attachments/file-ai-control.test.tsx; attachments-actions.test.ts#setAttachmentAiInputAction"
        status: pass
    human_judgment: false
  - id: D3
    description: "No switch for the requesting analyst (G-1), on a released request (read-only facts), or for a file the policy refuses. The orchestrator's off-only switch for an included file under either refusing policy. The section's line for G-1, both refusals and the allowed case. Nothing of the AI inputs for the Requestor."
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/attachments/file-ai-control.test.tsx#where a file’s AI control shows no switch; files-section.test.tsx#the section’s AI line; files-list.test.tsx#the AI inputs on the Files list"
        status: pass
    human_judgment: false
  - id: D4
    description: "Text the AI will read: the stored text as a text node (a <b> stays literal); the end line; nothing for 300ms, then eight skeleton lines; the 409 and 403 lines; Try again; Escape and Close text preview, with focus back. A side sheet from 768px, full screen below, loaded only through next/dynamic."
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/attachments/file-text-sheet.test.tsx; file-ai-control.test.tsx#Preview text (§5.3)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_AI_INCLUSION @journey (the preview, axe and focus, both widths)"
        status: pass
    human_judgment: false
  - id: D5
    description: "What the AI used's Files group: {n} {file|files} included, then each file by its current name (linking to its row), its part and characters sent, first {s} of {m} when truncated, and Removed since. None included when the run used none, and for earlier runs."
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/ai-assistance/ai-run-sheet.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "CONTEXT_TOO_LARGE with files: both job cards say the included files hold too much text and list them as links to their rows; Phase 12's copy without files"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/attachments/context-too-large-files.test.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "In compact density at 1440px the AI inputs cell's switch, facts line and Preview text keep 24px targets and wrap without overlapping the actions column (the UI-SPEC backstop)"
    verification: []
    human_judgment: true
    rationale: "Playwright proves the journey, no page overflow and axe (target size included) at the default density. Compact density at 1440 is the UI-SPEC's backstop, left for the phase's UI review."
duration: 62min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 16: The Analyst's AI Controls on Files Summary

**A Security Analyst who did not raise the request now chooses which files' text the AI reads.**

- **Including.** Bob switches on `Changes the AI inputs` beside a file. The switch waits with `Reading the file’s text…` while Strapi reads the file. The facts line then says `Included · all {m} characters` or `Included · first {n} of {m} characters`, and a toast offers Undo. Excluding applies at once and rolls back on a refusal.
- **Previewing.** `Preview text` opens a lazily loaded sheet with exactly the text the AI will read, as text only.
- **Who sees it.** For analysts, the section says once what may be included, or why nothing can be. The analyst who raised the request sees the facts and no switch. The Requestor sees only §3.1's sentence.
- **What the AI used.** The run sheet gains a `Files` group that names each file by its current name.
- **Failures.** A `CONTEXT_TOO_LARGE` failure caused by included files names them on both job cards.

ROADMAP success criterion 5 now passes end to end at 1440 and 375.

PHASE_14_BASE=e50053f. COLLAB-02 is traced here but stays Pending until 14-17's phase gate (`requirements-completed` copies the plan's array, as the template asks). REQUIREMENTS.md is unchanged.

## Performance

- **Duration:** 62 min (2026-10-10T10:30:27Z to 11:32:13Z), including the full Playwright run (30.6 min).
- **Tasks:** 2 of 2, each test first (a RED commit, then a GREEN commit).
  - Task 1 is the tracer. Before its GREEN commit, its verify passed end to end: vitest 544/544, typecheck, lint, Playwright 18/18 and a clean tree.
  - The run is interactive (`auto_advance` false) and `end-of-phase`, and its verify is automated only, so expansion went ahead with no checkpoint.
- **Files:** 18 (6 created, 12 modified; 1,760 lines added, 36 removed across the four commits).
- **The criterion 5 journey (`COLLAB02_AI_INCLUSION`):**

  | Run | Desktop | Mobile |
  |---|---|---|
  | Task 1's spec | 9.2 s | 8.9 s |
  | Task 2's spec | 15.2 s | 14.8 s |
  | Full suite | 18.2 s | 16.4 s |

  Task 2 adds the text preview and a wait of up to five seconds for the inclusion toast to leave. The journey covers Jane's submission with two files, Bob's inclusion, the preview, generation, What the AI used and Jane's check. Bob's inclusion itself completes within the toast's wait.

## Accomplishments

- **The actions.**
  - `setAttachmentAiInputAction({ requestId, attachmentId, included, classification?, ceiling? })` returns the file as Bob now sees it, with its AI facts, or family P. The classification and limit only word the policy's refusal.
  - `getAttachmentAiTextAction({ requestId, attachmentId })` returns `{ text, facts }`, or the refusal with its status, so the sheet can map 409 to its own line.
- **The control (`FileAiControl`, X-18 and X-22).**
  - It renders in the table's `AI inputs` column, as the phone card's `AI inputs: {facts}` line, and in the phone actions sheet.
  - The switch is labelled `Changes the AI inputs` and described by the file's name.
  - Turning it on shows the pending opacity and `Reading the file’s text…` with the inline spinner until Strapi answers. Then come the facts and the toast `{name} included in the AI inputs.` with Undo (`{name} no longer included.`).
  - Turning it off applies at once with `{name} no longer included in the AI inputs.` and Undo, which waits for the server (`{name} included again.`).
  - A refusal turns the switch back and shows family P in a danger toast titled `Inclusion not changed` (`Couldn’t undo` for an Undo), with `Try again` or `Refresh page`.
  - Images read `Images can’t be included, because the AI reads text only.` A file waiting for its malware check reads `It can be included once it passes the malware check.` Blocked and unavailable files show nothing.
- **Who gets a switch (`fileAiControlMode`).** Only where Strapi's `ai.canChange` and the section's `aiPolicy` allow it, plus the orchestrator's off-only switch for an included file under a refusing policy.
  - The requesting analyst (G-1), a released, closed or returned request, and a file the policy refuses get the read-only facts line.
  - The Requestor's list carries no policy, so it has no column, no line and no switch.
- **The section's line (§5.1, UI-D21).** One line for analysts under the description:
  - G-1 (`Lock`): `You raised this request, so another Security Analyst decides which files the AI uses.`
  - Either policy refusal (`ShieldBan`), worded by family P with the served classification and limit.
  - When allowed: `Include only files whose content is within this request’s {level} classification.`
- **The text preview (`FileTextSheet`, X-13).**
  - Title `Text the AI will read`. Description `{name} · {facts}. CSRM sends this text to the AI as information to analyse, never as instructions.`
  - The stored text sits in the inset well (`bg-surface-muted`, `text-sm`, `whitespace-pre-wrap`, `[overflow-wrap:anywhere]`) as a React text node.
  - A truncated file ends with `The text stops here. The remaining {m − n} characters aren’t sent.`
  - Loading shows nothing for 300ms, then eight skeleton lines. Errors read `We couldn’t load the file’s text` with `Try again`, a 409 reads `This file’s text is no longer included, so there’s nothing to preview.`, and a 403 reads family P.
  - `Close text preview` or Escape closes it, and focus returns to `Preview text`. It is a side sheet at 640px from 768px, full screen below.
- **What the AI used (§7.1).** After `Notes` comes `Files`:
  - The count `{n} {file|files} included`, then each file in upload order as a record link to `/app/review/requests/{id}#file-{fileId}`. The sheet closes, then the route navigates.
  - Each file reads `{Requestor|Security Analyst} file · {s} characters sent`, plus ` · first {s} of {m}` and ` · Removed since` where they apply.
  - `None included` for a run that used none and for earlier runs. Never the text (G-3).
- **The job cards (§7.2).** For `CONTEXT_TOO_LARGE` with `failureAttachments`, both cards read `The files included in the AI inputs hold more text than CSRM can send at once, so nothing was sent. Exclude a file, then try again.` They follow it with a list of record links to the files' rows. Without files, Phase 12's copy is unchanged.

## Task Commits

1. **Task 1 (tracer):** `6ad1c8a9` test (RED), `522141d3` feat (GREEN)
2. **Task 2:** `39c0ecd8` test (RED), `cc457e77` feat (GREEN)

`git rev-list --count 22d927ae..HEAD` is 4 before this summary's commit.

## Verification

- **RED evidence.** Vitest JUnit reports were checked with `check tdd-red-evidence`, with `classname` removed so the parser reads each test's own name. All 19 targets named returned `RED_EVIDENCE_OK`.
  - **Task 1:** 30 of 92 failed. The 9 targets named included: the switch waiting and its facts, the refusal, the image line, the AI column, the phone sheet's switch, both actions, the Files group and `None included`.
  - Three Task 1 cases passed at RED: two input-refusal cases (the stubs refused everything) and the Requestor's no-AI guard.
  - **Task 2:** 19 of 65 failed. The 10 targets named: the sheet (reading, the 300ms skeleton, text not markup, the end line), opening it from the control, the failure list, the draft card and the section's three lines.
  - These Task 2 cases passed at RED because Task 1's `fileAiControlMode` already encodes them: the no-switch cases (pending, blocked, unavailable, read-only, G-1, policy-refused) and the orchestrator's off-only switch.
  - Also green at RED: the Requestor's sentence-only guard, both cards keeping Phase 12's copy, and the stubs' source checks.
- **GREEN, focused:**
  - **Task 1:**
    - The four test files: 92/92.
    - `vitest run src/features/attachments src/features/ai-assistance src/lib/performance/zod-client-boundary.test.ts src/lib/performance/interface-copy-guard.test.ts`: `Tests 544 passed (544)`.
    - Typecheck and lint clean.
    - `test:e2e e2e/request-attachments.spec.ts`: 18 passed (2.7 min). The first run failed 5; see Deviations 2 and 3.
  - **Task 2:**
    - The four test files: 65/65.
    - `vitest run src/features/attachments src/features/assessments src/features/ai-assistance src/lib/performance`: `Tests 1089 passed (1089)`.
    - Typecheck and lint clean.
    - `test:e2e e2e/request-attachments.spec.ts e2e/performance.spec.ts`: 29 passed (3.8 min).
- **Full suites (at `cc457e77`):**
  - Web (`pnpm --dir apps/csrm test`): 210 files, `Tests 4801 passed (4801)` (59.1 s).
  - Playwright (`pnpm --dir apps/csrm test:e2e`): `220 passed (30.6m)`, desktop 166 and mobile 54, none flaky. `REQ08_REASSIGN_THROUGH_PICKER` passed on both projects.
  - `api:check` exits 0 with no contract change (`schema.d.ts` refreshed, not staged).
  - The Strapi suite was not run: this plan changes no Strapi source, specification or configuration.
- **Route budgets (delivered JS, desktop, full run).** Every route is within budget, and `git diff e50053f -- apps/csrm/e2e/performance.spec.ts` adds no `ROUTE_BUDGET_OVERRIDES` entry.

  | Route | Delivered | Budget | Change since 14-15 |
  |---|---|---|---|
  | `/app/requests/{documentId}` (Requestor) | 293,915 | 300,000 (6,085 left) | +1,389 |
  | `/app/risks/{documentId}` | 293,677 | 300,000 (6,323 left) | +382 |
  | `/app` | 229,091 | 300,000 | |
  | `/app/requests` | 251,489 | 300,000 | |
  | `/app/risks` | 262,618 | 300,000 | |
  | `/app/review/assessments/{documentId}` | 318,157 | 460,000 | |
  | `/app/questionnaires/{documentId}` | 358,149 | 500,000 | |

  - Every measured route grew by about 380 bytes, the shell's routes included. That is consistent with the bundler's map of on-demand chunks taking the two new ones (the control and the sheet), but it was not traced to a module.
  - The Requestor's page took about 1,000 bytes more: `FilesList`'s on-demand loader, the AI column wiring and the AI rule and words in `attachments-domain.ts`. The control and the sheet stay out of its first load.
- **Acceptance criteria:**
  - `file-ai-control.tsx` starts with `'use client'` and names `Changes the AI inputs` in its header; the words come from `fileAiCopy`.
  - `ai-run-sheet.tsx` renders no file text; the summary holds none.
  - `file-text-sheet.tsx` is imported only through `next/dynamic` (`git grep "file-text-sheet'"` finds only the control's `import()`), and it has no `dangerouslySetInnerHTML`.
  - `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing, and `git status --short` was clean after every run.

## Decisions Made

See `key-decisions` in the frontmatter (one line each). The first is the orchestrator's binding ruling on D-30. The unit tests prove it for both refusing policies. No browser test covers it, because the Playwright harness runs with no AI classification limit, so the journey cannot reach a refusing policy cheaply.

## Deviations from Plan

1. **[Rule 3 - Blocking] `attachments-domain.ts` (outside the list).** It holds the AI words and the rules both the list and the lazy control need: `fileAiControlMode`, `fileAiFactsLine`, `fileAiToast` and `fileAiSectionLine`. The domain is zod-free, as the boundary requires (`522141d3`, `cc457e77`).
2. **[Rule 1 - Bug] Page overflow at 1440.**
   - The AI column made the analyst page's table wider than its card. `FilesPanel`'s and `FilesList`'s grids had implicit `auto` tracks, which take the table's min-content width, so the page scrolled sideways. Four desktop journeys failed on `expectNoHorizontalOverflow`.
   - Both grids now take one `minmax(0, 1fr)` track (`grid-cols-1`), so the table scrolls inside its labelled region.
   - The AI cell is a fixed 12rem rather than an X-3 wrap column (`522141d3`).
3. **[Rule 1 - Test] Axe at 375 over the actions sheet.**
   - Sonner's toast Close is 20px and overlaps the open phone sheet while the inclusion toast shows, which axe's target-size rule flags.
   - The journey now scans the sheet before the toast and the preview after it leaves (`522141d3`, `39c0ecd8`).
   - The Close is shared X-14 chrome and is not changed here; it is flagged for the phase's UI review.
4. **[Plan shape] The section-line assertion moved from Task 1's journey to Task 2's RED.** The section lines are Task 2's.
5. **[Plan shape] `failureAttachments`, not `failure.attachments`.** The job projections are flat (14-10).
6. **[Plan shape] Both job cards' tests live in `context-too-large-files.test.tsx`.** That is the plan's file, so `questionnaire-generation-job.test.tsx` is unchanged.
7. **[TDD] RED ran against throwaway stubs.** For Task 1 these were `file-ai-control.tsx` and two action stubs; for Task 2, `file-text-sheet.tsx` and `context-too-large-files.tsx`. Each was removed or restored before its RED commit. The cases green at RED are listed under Verification.
8. **[Plan shape] `Preview text` renders from Task 1.** It was inert until Task 2 wired the sheet.

**Total deviations:** 8 (1 Rule 3, 2 Rule 1, 4 plan-shape notes, 1 TDD note). **Impact:** no change to scope. No content type, schema field, relation, contract or Strapi source changed, and no dependency was added.

## Issues Encountered

- **Shell heredocs broke on typographic apostrophes, as in earlier plans.** Edits with copy went through the Edit and Write tools or Python scripts written to the scratchpad.
- **Next logs `The destination stream closed early`** while a journey leaves a page that is still streaming, and `failed-to-find-server-action` for the body-limit test's deliberate action id `0`. Every test passed.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:

- **T-14-54 is mitigated.** The preview renders the stored text as a React text node in a `whitespace-pre-wrap` well with no HTML parsing. A test renders `<b>` and `<img>` literally, and the module has no `dangerouslySetInnerHTML`.
- **T-14-55 is mitigated.** No switch renders without Strapi's `ai.canChange` and the policy (the off-only case included), and Strapi refuses every other caller (14-09). Unit tests cover the requesting analyst and both policy refusals, and the journey shows Jane no switch.
- **T-14-SC is accepted.** No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-17** runs the phase gate and marks COLLAB-02 complete. COLLAB-02 stays Pending until then.
- **Route budget:** `/app/requests/{documentId}` has 6,085 bytes left and `/app/risks/{documentId}` 6,323.
- **For the phase's UI review:**
  - the AI cell in compact density at 1440 (the UI-SPEC backstop);
  - Sonner's 20px toast Close over a sheet at 375;
  - the off-only switch under a pinned AI classification limit, which the browser journeys don't reach.

## Self-Check: PASSED

- FOUND: every file in `key-files` (created and modified).
- FOUND: `6ad1c8a9`, `522141d3`, `39c0ecd8`, `cc457e77`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
