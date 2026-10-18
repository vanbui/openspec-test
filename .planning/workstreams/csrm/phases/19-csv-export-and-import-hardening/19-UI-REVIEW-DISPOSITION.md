---
phase: "19"
status: complete
implementation_blockers: 0
verification_warnings: 1
ui_review: 19-UI-REVIEW.md
rulings: the pilot's, 2026-10-17 (UI-01 to UI-04 and UI-07 to UI-12 fixed test-first; UI-05 fixed, not an exception; UI-06 cited and captured, 768 and paper left to the operator)
---

# Phase 19 UI review disposition

The independent UI audit (`19-UI-REVIEW.md`, 2026-10-17, committed in `eb4399a7`) scored 20/24 against `19-UI-SPEC.md` (with review amendments R1 and R2) and the design direction: Copywriting 4, Visuals 3, Color 4, Typography 3, Spacing 3 and Experience Design 3. It was a code-only audit at `f673dcb7`, after the stage A code review. No server was started, so nothing was rendered. It found no blocker and 12 warnings, UI-01 to UI-12. All approved R1 and R2 copy is in the code word for word, and no colour is hard-coded. The header action order, with Export last in DOM order inside the reversed wrapper, is the pilot's ruling of 2026-10-16 and was not raised.

The pilot ruled on 2026-10-17. UI-01 to UI-04 and UI-07 to UI-12 are fixed test-first, since they are the G-4 bar and none needs new copy. UI-05 is fixed, not recorded as an exception: on screen the document title is an `h2` under the page's single `h1`, and in print it is the `h1`. For UI-06, the e2e runs that cover these states at 375 and 1440 are cited, and the final gate keeps a print-emulation PDF of the report and git-ignored screenshots. The 768 visual review and the physical A4 print stay in `19-UAT.md` as operator items.

**One RED commit and one GREEN commit for all eleven fixes.**
- RED, `6e748eeb`: 11 unit tests failed on the code before the fix (the run is quoted per row below).
- GREEN, `536d3856`: they all pass after it.

**Focused checks after the fix:**
- web typecheck and lint: clean;
- `src/components/csrm`, `src/features/administration`, `src/features/assessments` and `src/features/exports`: 52 files and 1,260 tests, all passed.

**No new copy.** Every string the fixes render was already approved. The `Choose one file to check.` line and the error report refusal only gain an icon or a live region.

**Route budgets.** The fixes touch the export dialog, the column choice, the import flow, the report document and the shared `SegmentedControl`. Only `SegmentedControl` (two optional props) reaches either tight route. Both budgets are measured in the final gate (`19-15-SUMMARY.md`, "Phase gate (final run, after the code review)").

| Finding | Disposition | Evidence |
|---|---|---|
| UI-01 | Fixed, `6e748eeb` (RED), `536d3856` (GREEN) | **The pressed button keeps focus while it runs** (§2.6, WCAG 2.4.3). `Export file`, both template downloads and `Download error report` are now `aria-disabled` while they run, as `Try again` already was. Each handler ignores a second press (`submit`, `downloadTemplate`, `downloadErrorReport`). `Export file` stays truly `disabled` only in the states before a request (empty, over the limit, no column), where it never holds focus from a press.<br><br>**The dialog's choices stay focusable and read-only.** `fieldset disabled` is gone. The Format control (`SegmentedControl readOnly`), the CSV `Table` group and the column checkboxes and pills (`ColumnChoice readOnly`) carry `aria-readonly`, and their handlers change nothing while pending.<br><br>**Tests:**<br>- `export-dialog.test.tsx :: shows Exporting… with the controls read-only and Cancel enabled, …` failed before with `Received element is not enabled`.<br>- `administration-workflow.test.tsx :: UI-01 keeps focus on a pending template button, …` and `UI-01 and UI-11 keep focus on a pending error report button, …` failed the same way.<br>- The two existing pending assertions (`Downloading…`, `Preparing error report…`) now expect `aria-disabled`, and failed before with `Expected the element to have attribute`. |
| UI-02 | Fixed, same commits | The similar-rows panel is `Alert role={undefined}` (the FE4-03 pattern), so it is a persistent panel and not an assertive live region. Its `{d} of {k} decided` count stays `aria-live="polite"`. The ignored-columns alert (`:588`, optional) is unchanged: it arrives once with the step.<br><br>**Tests:**<br>- `UI-02 and UI-03 make the similar panel no alert, …` failed before with `Expected the element not to have attribute`.<br>- The e2e `similar name held` now finds the panel by `data-slot="alert"` and asserts it has no `role="alert"`. |
| UI-03 | Fixed, same commits | The gate line has an id (`useId`). While it is shown, every undecided `Decision for row {n}` group lists that id in `aria-describedby`, and a decided group drops it. Focus then lands on a radio whose group says why (3.3.1). The test above checks both rows before a choice, and then that row 3 drops the line once decided and row 4 keeps it. |
| UI-04 | Fixed, same commits | The `Columns` fieldset's `aria-describedby` adds the error id while no column is checked. The Format hint has an id, and `SegmentedControl describedBy` passes it to the radio group. Test: `export-dialog.test.tsx :: describes the Format choice by its hint, and the Columns group by its error once none is checked` failed before with `Expected element to have accessible description`. |
| UI-05 | Fixed, same commits (pilot ruling: not an exception) | On screen the document title is an `h2` (`print:hidden`, still the article's name) under the toolbar's `Print report` `h1`. A print-only `h1` (`hidden print:block`) carries the same approved words on paper, where the toolbar is hidden.<br><br>**Tests:**<br>- `assessment-report.test.tsx :: gives the screen one h1, with the document title an h2 there and the h1 only in print (UI-05)` failed before with `expected [ 'Print report', …(1) ] to deeply equal [ 'Print report' ]`.<br>- The X-31 order test now lists the title first among the `h2`s.<br>- The e2e `print report` asserts one visible `h1` in each medium: `Print report` on screen, and the document title in print. |
| UI-06 | Cited, with captures from the final gate; 768 and paper left to the operator (`19-UAT.md`) | **Covered at 375 and 1440, with `expectNoOverflow` and axe, by the `@journey` tests in `exports-and-imports.spec.ts`** (both Playwright projects run them):<br>- `register export` (the dialog and the phone full-screen sheet);<br>- `list exports` (the report and My requests dialogs);<br>- `released assessment export` (the released view and its dialog);<br>- `print report` (the report on screen and in print emulation; the A4 PDF on desktop);<br>- `import tolerance`, `error report round trip` and `similar name held` (the review, refusals and decision radios).<br><br>**Captures from the final gate's run** (git-ignored, under `apps/csrm/test-results/`; Playwright replaces them on its next run): see "Captures" below.<br><br>**Not covered, and left to the operator:** the visual review at 768 (`19-UAT.md` test 6) and the printed 25-risk A4 sheet (`19-UAT.md` test 4). |
| UI-07 | Fixed, same commits | Both forms of the summary figure use `text-heading-md`: 20px, with the token's weight of 600. `text-2xl font-semibold` is gone. Test: `UI-07 to UI-10 keep the review on the §3.9 and §3.10 scales` failed before with `Expected the element to have class`. |
| UI-08 | Fixed, same commits | The phone row cards at Review and Results write `<span className="font-medium">File row {n}</span>` instead of `<strong>`, which renders at 700. The same test checks every card label. |
| UI-09 | Fixed, same commits | The step body is `CardContent className="grid gap-6"`, so the import warnings sit 24px apart, as the Spacing table asks. Same test. |
| UI-10 | Fixed, same commits | A similar row's decision sits `mt-4` (16px) below its details. The column error line is `gap-2`, matching the import gate line. Same test, plus the UI-04 dialog test. |
| UI-11 | Fixed, same commits | (a) The error report refusal is `role="alert"`. It does not take focus, so this does not repeat the FE4-03 double announcement.<br>(b) `Choose one file to check.` renders as the browser refusal does: a 16px `AlertCircle` at `flex items-center gap-2`, with `role="alert"`.<br><br>**Tests:** `UI-01 and UI-11 …` (the refusal is inside an alert) and `UI-11 and UI-12 announce Choose one file to check. with its icon, …`. |
| UI-12 | Fixed, same commits | The field is a `role="group"` named by the `File to import` label (`aria-labelledby`), so the label is spoken when focus reaches `Choose file`. The button keeps the name `Choose file` (2.5.3). The unit tests reach the hidden input with `getByLabelText('File to import', { selector: 'input' })`, and the e2e keeps its `input[type="file"]` locator. |

## Captures (final gate)

These come from the final gate's Playwright run at `31d7c70d` (`19-15-SUMMARY.md`, "Phase gate (final run, after the code review)"), in which all 268 tests passed, 0 of them flaky. Every journey below passed at 1440 (desktop) and 375 (mobile) with `expectNoOverflow` and axe.

Each file was copied from `apps/csrm/test-results/<test>/` into the git-ignored `apps/csrm/.tmp/ui-review-19/`, where the next Playwright run will not replace it.

| File | Journey | What it shows |
|---|---|---|
| `export-dialog-desktop.png`, `export-dialog-mobile.png` | `register export` | The Risk register export dialog; at 375 it is the full-screen sheet with `Close`, the scope, the Format control and its hint, the column checklist, and `Export file` above `Cancel` |
| `released-export-dialog-desktop.png`, `released-export-dialog-mobile.png` | `released assessment export` | The released assessment's dialog, with its fixed tables and no column choice |
| `report-screen-desktop.png`, `report-screen-mobile.png` | `print report` | The report route on screen: the toolbar's `Print report` `h1`, then the document card with its title as an `h2` (UI-05) |
| `report-print-desktop.png`, `report-print-mobile.png` | `print report` | The same page under print emulation: the shell and toolbar hidden, the document title the one `h1` |
| `report-a4.pdf` | `print report` (desktop) | The A4 PDF, `preferCSSPageSize`, 2 pages (`REPORT_PDF_PAGES[desktop]=2`) |
| `import-decisions-desktop.png`, `import-decisions-mobile.png` | `similar name held` | The Review rows step with the similar panel, a decided `Update` radio group, and the phone row card at 375 |

Not covered, and left to the operator:
- **The 768 visual review** (`19-UAT.md` test 6): no project runs at 768.
- **The printed 25-risk A4 sheet** (`19-UAT.md` test 4): the e2e report holds the journey's own released assessment, not 25 risks.
