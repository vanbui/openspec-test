# Phase 15 pilot rulings

**Date:** 2026-10-12. **Pilot:** the operator's main session. **At:** `d6e93d6` (15-14 Tasks 1 to 3 done; phase gate green: web unit 5,381/5,381, Strapi 1,624/0/0, Playwright 236/236, `api:check`, typecheck and lint clean).

## Rulings carried from execution

- **IN-306 (host heap bound).** The pilot reproduced on the Linux build host that a `worker_threads` Worker with `resourceLimits.maxOldGenerationSizeMb: 32` grows to about 300 MB unstopped. Ruled a real gap in the extraction bound, not a test exception: quick task 261012-isn added a parent-side heap watchdog beside `resourceLimits` (`f00725f`..`4b113b4`). The IN-306 test passes unchanged.
- **`scripts/verify-csrm-model.mjs` and `scripts/verify-keycloak-provisioning.mjs`.** Accepted as the worker found them: no package script runs them, and several assertions are stale against deliberate changes (Phase 10 D-44; `6c7d167`). Neither script changes in Phase 15 (recorded in `15-14-SUMMARY.md`).
- **The Keycloak path static check.** Seven Keycloak-named paths differ from `15eb830b`. The pilot traced all seven to the operator's own commit `d32bb25` (the move from `idp/` to `docker/` plus ClamAV), merged before this session's starting commit `f06811d`. No Phase 15 commit touches a Keycloak path. Accepted as an operator change outside the phase. Later phases take the check from the phase's own commits (`<PHASE_BASE>..HEAD`, excluding commits authored by the operator outside GSD), and the pilot reviews any hit.

## The pilot's browser walk (2026-10-12): 15-14 Task 4's answer

This section is the answer to 15-14 Task 4's resume signal: **issues found** (not "approved"). Record it verbatim in `15-14-SUMMARY.md`, and the check table in `15-UAT.md`.

**How it ran.**
- **Servers:** Strapi `develop` and Next `dev` at `d6e93d6`, dev identity, OIDC off, both Keycloak flags off, the deterministic provider.
- **Database:** `apps/backend/.tmp/pilot-walk-15.db` (gitignored), seeded with the core and CSRM development fixtures; the operator's database untouched.
- **The agent:** an independent agent drove Node Playwright at 1440x900 and 375x812, with `@axe-core/playwright`.
- **Records:** RAR-2026-F20S74 / QNR-2026-D5HD2B (`Pilot walk 15 — 1440`), RAR-2026-2G7HBA / QNR-2026-DV801A (`Pilot walk 15 — 375`) and RAR-2026-F20FGX (`Pilot walk 15 — 1440 requesting analyst`, raised by Bob). No other record was touched.
- **Results:** axe found 0 serious or critical violations on every scan; no horizontal overflow at 375 or 1440. `git status --short` empty afterwards; no server left running.

### The browser check table

| # | Check | Actor | Width | Result | Evidence |
|---|---|---|---|---|---|
| 1a | Panel for analysts after restart (D-31) | Bob, Sam | both | pass | Region `AI proposals` for both |
| 1b | Requesting analyst gets no AI controls | Bob (own request) | both | pass (D7 aside) | Only `You raised this request, so another Security Analyst handles the AI for it.`; no hub proposals line |
| 1c | Requestor sees no AI | Jane | both | pass | No AI words in text or HTML; rejected question absent; history `4 changes to the questions` |
| 1d | Secondary Requestor gets nothing | Maya | both | pass | Permission copy or `Page not found`; no title, RAR, QNR or question text in the HTML |
| 1e | Direct calls to the six Phase 15 routes | Maya, Jane | — | pass | 12/12 refused 403; Sam's read 200; unknown job 404 |
| 2 | Submitted view order | Bob | both | pass | Header, `Return to draft`, h2 `AI proposals`, governance |
| 3 | Instruction fields and validation | Bob | both | pass (D1) | `Keep the instruction to 500 characters or fewer. It has {n}.`, `aria-invalid`, focus to the field, `aria-keyshortcuts` |
| 4 | Analyst-change line, narrowed Replace | Bob | both | pass | §8.3 copy with `Open AI proposals` (`#ai-proposals`); Replace gone after an analyst edit |
| 5 | Hub proposals line, job from the hub | Bob, Sam | both | **issue D2** | Line present in analyst review, absent once submitted; the card unmounts during a hub job |
| 6 | Draft gate, release gate | Bob | both | pass | Both gate lines exact; no Release while proposals are open |
| 7 | Refused save after take-back, restore after re-release | Jane, Bob | both | **issue D6** | 403, generic copy, no restore |
| 8a | Backstop: confirm toast, 255-character section title, 375 | Bob | 375 | blocked by D5 on real data; synthetic layout pass | Toast 343x288, no scroll, Undo 61x44 reachable and working |
| 8b | Backstop: compact card actions, 1440 | Bob | 1440 | pass | One row, 32px buttons, 8px gaps, no overlap |
| 8c | Backstop: rewrite popover from the last row, 1440 | Bob | 1440 | pass | Flips above, fully in the viewport, focus in and back on Escape |
| 9 | Keyboard decisions | Bob | both | **issue D4** (Confirm); rest pass | Reject and Undo (Alt+T, three Tabs) land per §5.5 |
| 10 | Live region, comparison headers | Bob | both | pass (NVDA risks below) | One change per state; `th[scope=col]`, `th[scope=row]`, caption |
| 11 | Touch targets, toast versus sheet at 375 | Bob | 375 | pass (D9 low) | Phone actions 44px; toasts above the sheet's controls |

**Manual-only results.** D-31 grants after restart: pass. D-35 premium bar: pass apart from D1 to D9. The live-model quality check, the production schema check and **NVDA speech: pending, the operator's** (no screen reader here).

### Rulings on the walk (fix test-first; record each under "Pilot walk, 2026-10-12" in `15-REVIEW-DISPOSITION.md`)

- **D2 (high).** Once the questionnaire is submitted the hub loses its questionnaire card (`assessment-detail.tsx`: only `GenerationSignalCard` renders when generation is not offered), so there is no `AI proposals: {n} open` line and a job started from the hub cannot be followed; the card unmounts mid-job and focus drops to `body`. §8.4 requires the line for every analyst except a requesting analyst, in every state where proposals can exist, and the "After a start from the hub" states. Fix: the hub keeps a questionnaire card (or a section of it) with the proposals line and `HubProposalJob` whenever a non-requesting analyst views a questionnaire in a state where proposals can be opened or decided, and never unmounts the element that holds focus during a job. Prove it in the browser at both widths for a submitted questionnaire: the line with 0 and 3 open, a job started from the hub through to `Review AI proposals`, and the focused element after the start.
- **D6 (high).** After a take-back the Requestor's save is refused with 403, so she sees the generic copy and her unsaved answer is not restored after re-release (§11.2). Ruling on the contract: the owning Requestor of a questionnaire she may read but not currently answer meets a **state** conflict, not an authorisation refusal. Strapi answers her with 409 `QUESTIONNAIRE_NOT_ANSWERABLE`, decided inside the policy against the resolved IdamBox User after her ownership is established. An unrelated Requestor, or anyone without read access, keeps the existing 403 (or 404) with no state disclosed: write that negative test first. Then the client shows §11.2's copy, keeps the typed answers on the page, and restores them after re-release in the same tab, as 15-13 intended. If the 409 requires a spec change, update `specification.json` and the generated client together (`api:check` clean). Prove it end to end in the browser at both widths with two contexts, including the reload.
- **D3 (medium, WCAG 2.4.3).** Focus drops to `body` after `Ask the AI` and `Suggest follow-up questions` start a job from the panel, and after the `Return questionnaire to analyst review?` dialog closes. Move focus to the job status line when the trigger is replaced (as §9.1 does for the signal action), and to the element that replaced the dialog's trigger on close. Browser-prove the focused element.
- **D4 (medium, §5.5).** After a keyboard Confirm (1440) and `Confirm with edits` (375) focus lands on `body`. It goes to the next open item's Confirm, or to the status line when none is left, exactly as Reject does. Browser-prove at both widths.
- **D5 (medium, §5.1).** The `Edit, then confirm` toast names the proposal's section, not the section the analyst chose (new or existing). Name the section the question was actually placed in. Then exercise backstop 8a on real data at 375 (a 255-character section title chosen in `Edit, then confirm`) in Playwright.
- **D1 (cosmetic).** The Replace dialog's hint (`questionnaire-generation-job.tsx:66`) must match §3.1's pinned copy exactly, for both Generate and Replace.
- **D7 (low, §12).** Show `You raised this request, so you can generate without an instruction. Another Security Analyst can give the AI one.` on the requesting analyst's hub Replace path and in the Replace dialog.
- **D8 (low, §9.1 and §1).** The header signal action lands on `section#ai-proposals` after passing through `body`; it lands on the job status line. The cross-page `Open AI proposals` link (hub to `…#ai-proposals`) lands through `useHashLanding`/`landOn` with focus where the UI-SPEC says. Browser-prove with `toBeInViewport()` and the focused element.
- **D9 (low, WCAG 2.5.8).** The `{n} answered questions stay as they are` (251x20) and `{n} left out` (51x16) toggles get at least a 24px target height. Don't rely on the spacing exception.
- **NVDA risks (accessibility).** The preparing paragraph is inserted already holding its text, so some screen readers miss it: keep the live region mounted and change its text. The comparison's row headers read "Question Changed": the row header names the field, and the change state is conveyed separately (visually hidden text in the cell or `aria-describedby`). Speech itself stays the operator's check.

Walk verdict for `15-UAT.md`: **pass after the walk fixes.** The pilot accepts browser assertions for D2, D3, D4, D5, D6 and D8 in the final gate as their re-verification.

## Then, in order

1. Stage A, the code review: parallel read-only `gsd-code-reviewer` lanes (or one reviewer per lane run in sequence, if agents can't be spawned) over every file changed since `15eb830b`, merged verbatim into `15-REVIEW.md` with an overlap note. Then the worker writes `15-REVIEW-DISPOSITION.md`: every Critical and Warning fixed test-first; Info items fixed or disposed with a reason; the walk defects above under "Pilot walk, 2026-10-12". The pilot delegates the review rulings for this phase to that disposition under these rules: never skip, weaken or delete a test; take the safer fix for a security finding; any finding that would change a content type, a grant or a published contract beyond D6's ruling stops for the pilot.
2. The walk fixes and the review fixes, test-first.
3. Regression: the full web and Strapi suites, plus Playwright for every spec the fixes touched (both projects).
4. `verify:post`: `/gsd-secure-phase 15 --ws csrm`, `/gsd-validate-phase 15 --ws csrm` and `/gsd-ui-review 15 --ws csrm`, with the UI review's disposition. Close every open threat or gap.
5. The verifier, writing `15-VERIFICATION.md`. Close every gap.
6. `15-UAT.md`, with the Manual-Only results and the walk table.
7. The final full gate (brief §5), recorded in `15-14-SUMMARY.md` as `## Phase gate (final run, after the code review)`, with the static checks against `15eb830b` and the Keycloak note above.
8. Bookkeeping: if `15-VERIFICATION.md` reads `passed`, or `human_needed` only for operator checks (NVDA speech, the live-model quality check, the production schema check), the pilot rules it passed now and the worker runs `phase complete 15 --ws csrm`, updates ROADMAP (status line and milestone line), REQUIREMENTS (QUES-11 and QUES-12 Traceability rows, closed 2026-10-12 or the actual date) and STATE (a "Phase 15 complete" block, Performance Metrics with the gate counts, and Session Continuity naming Phase 16's fresh plan check). Commit by explicit path; the pilot pushes.
