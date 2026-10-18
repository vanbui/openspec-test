# Phase 08 — UI Review

**Audited:** 2026-09-26 (tree at `d11f469`, after the phase code-review fixes)
**Baseline:** `08-UI-SPEC.md` (approved; §3.3 request rows amended 2026-09-26 by WR-03), `08-CONTEXT.md`, and `docs/design/csrm-design-direction.md` with its Phase 8 extensions (X-1 scroll cues, X-2 region behaviour, X-3 long-text columns, X-4 Print, X-5 tone vocabulary, CSV import rows), under ADR 0001.
**Method:**
- Headless Chromium (Playwright 1.58.2) scripts against the development servers (`next dev` 16.3.6 on :3000, Strapi on :1337). Each actor ran in a fresh context: Security Analyst, Requestor, Secondary Requestor and a signed-out visitor.
- Captures at 375 and 1440 for every surface, and at 768, 1024 and 1280 where the UI-SPEC defines mid-width layouts (the Risk Register filter bar and the scroll regions).
- axe-core 4.11.4 (through `@axe-core/playwright` 4.11.0) on every capture, with the five WCAG A/AA tags plus `label-content-name-mismatch`. Computed-style and geometry measurements. Print emulation at 794px, with A4 PDFs at 0.4in margins.
- **Nothing was written.** After sign-in every session aborted every non-GET request in the browser, and every session's blocked list stayed empty. Confirmation dialogs were opened and cancelled only.
- **The CSV review step was rendered from a synthetic preview.** The preview Server Action was answered inside the browser (`route.fulfill`), so no file reached Strapi.
- **Code only:** the global error (it cannot be triggered without breaking the root layout), the unavailable sign-in card (it needs a production build) and the analyst editors' Server Action validation messages.

**Screenshots:** captured. They are local audit artefacts under `apps/web/.tmp/audit/ui-review/out/` (gitignored) and are not committed; file names are cited below.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | The drafting copy is UI-SPEC §1.1 verbatim, provider-neutral and advisory. `Released`, the search labels, the denial headings and the Administration validation messages all read as specified. Minor: the development sign-in title names only the site. |
| 2. Visuals | 3/4 | One badge recipe across all five status families, one question list, and fallbacks in the sign-in card frame. However, the DataTable's sticky identifier hairline (the X-1 start-edge cue) disappears as soon as the table scrolls. |
| 3. Color | 2/4 | Every tone follows X-5 with the exact §3.5 values, ink is the only accent, and the fade uses the surface colour. However, the navigation sheet's `Close` control is #F6F5F2 on #FFFFFF (1.09:1), an axe `color-contrast` (serious) failure below 1024px for every actor. |
| 4. Typography | 3/4 | Phase 8 text resolves to §3.10 pairs: badges 12/16 at 500, captions 12/16 at 400, question text 14/20 at 500, mono section captions, errors 12/16 with a 14px icon. The section captions are `h3` siblings of the `Question editor` `h3` (open question 3). |
| 5. Spacing | 3/4 | The Risk Register filter tracks match UI-SPEC §4.1 to within a few pixels at 768, 1024, 1280 and 1440. However, filter labels sit 1px above their fields where §4 Forms asks 6px (the Administration forms measure 6px), and the sheet's `Search Risks` pill touches its input. |
| 6. Experience Design | 2/4 | Region semantics, keyboard scrolling, headed and titled denials, Label in Name and the fallbacks all hold. However: the draft card offers `Generate assessment draft` on a request whose assessment is already released (Strapi answers 409); the analyst review lists' denials show working filters and a pager; and the printed register cuts every Risk statement at two lines. |

**Overall: 16/24**

---

## Priority fixes before the phase closes

1. **B-1 (BLOCKER for the D-25 WCAG 2.2 AA bar). The navigation sheet's `Close` control is invisible (1.09:1).**
   - **Impact:** below 1024px every page's sheet opens with focus on a blank white pill, and its X icon is invisible too. Escape, the overlay and the links still close it, so navigation is not blocked. However, the phase's AA claim and the conformance record are not true for this state.
   - **Fix:** give the outline variant its own ink text: add `text-foreground` in `components/ui/button.tsx:16-17` (18.4:1 on white). Then scan the open sheet in `e2e/accessibility.spec.ts:508-535`, which opens it and never runs axe.
2. **W-1. The draft card offers generation on a request whose assessment is already released.**
   - **Impact:** on `Customer portal security assessment` (Approved, `ASM-2026-33SAEN` Released, `Next action: No action is required`), `Generate assessment draft` is the only primary action on the page. Strapi refuses it (409 `CSRM assessment draft already exists.`, `assessment-workflow.ts:703-707`). The card then shows `Status unavailable` / `This assessment changed. Reload and try again.` (`assessment-actions.ts:131`, `assessment-draft-job.tsx:224`), and a reload offers the same button again.
   - **Fix:** in `assessment-detail.tsx:80` render the card only while no assessment exists (`request.relationships?.assessment.availability !== 'available'`, the fact line 72 already reads).
3. **W-2. The sticky identifier column loses its hairline while the table is scrolled.**
   - **Impact:** the X-1 start-edge cue is missing exactly when columns are hidden behind the sticky column, and scrolled cells slide under it with clipped glyphs.
   - **Cause:** the `border-r` on the sticky cells (`data-table.tsx:342, :389`) is painted by the collapsed-border table grid (Tailwind preflight `border-collapse: collapse`), so it stays at the column boundary and scrolls away.
   - **Fix:** do what the cross-tab does (`report-table.tsx:67`: `border-separate border-spacing-0`, rules drawn on the cells), or draw the hairline as an inset pseudo-element on the sticky cells. Adjust the print rule at `globals.css:972` to match.
4. **W-3. The analyst review lists' permission state keeps the list's working controls.**
   - **Impact:** a Requestor on `/app/review/requests`, `/app/review/assessments` or `/app/review/questionnaires` sees, around `You don't have access to …`: the search box, the status select, `0 results`, the density toggle and a pager. The request list adds its queue select and `Queue: Requires my attention`. Every other denial shows only the page header and the state.
   - **Fix:** return the permission state early, before `Controls` and the DataTable chrome, in `assessment-list.tsx` (both lists) and `questionnaire-review-list.tsx`, as `risk-register.tsx:121` does.
5. **W-4. The printed Risk Register truncates every Risk statement.**
   - **Impact:** the X-3 `line-clamp-2` on the statement link (`risk-register.tsx:125`) survives print. The A4 register prints "Phase 7 platform legacy file transfer service has been…", so the register's main content is lost on paper.
   - **Fix:** release the clamp in the print block (`globals.css:919-1006`), for example `main td [class*="line-clamp"] { display: block; -webkit-line-clamp: unset; line-clamp: none; overflow: visible; }`, and record the refinement in X-4.

After those, the small verdict fixes below (open questions 1, 3, 4a and 4c) and W-5 (label spacing).

---

## Measured Evidence

### Risk Register filter bar (Security Analyst)

| Width | Filter rows | `Search Risks` input | Selects | Labels on one line | Label to field | Button beside input |
|---|---|---|---|---|---|---|
| 1440 | 1 (four tracks) | 308px (spec ≈305) | 214px ×3 (spec 214) | yes | 1px | yes, 8px gap, bottoms aligned |
| 1280 | 1 | 244px (spec ≈240) | 182px ×3 (spec 182) | yes | 1px | yes |
| 1024 | 2 | 569px | 221px ×3 (spec 221) | yes | 1px | yes |
| 768 | 2 | 601px | 232px ×3 (spec 232) | yes | 1px | yes |
| 375 | `Filters (0)` sheet | 342px, label above | 44px-tall selects | n/a | 1px | no: the full-width pill sits under the input, 0px apart (by the UI-SPEC's unchanged sheet) |

Screenshots: `register-{1440,1024}-filters.png`, `register-375-filter-sheet.png`. At 1440 the first five headers end at 1292px against a visible edge of 1400px. Statement cells are `white-space: normal`, 224px (14rem), two lines (`register-1440-viewport.png`).

### Scroll regions and cue (X-1, X-2)

| Table | Width | `data-overflow` | Region | End fade | Sticky hairline at rest | Hairline while scrolled |
|---|---|---|---|---|---|---|
| Risk Register | 768 to 1440 | true (1544 in 718 to 1102) | `Risk Register results, scrolls horizontally`, tabindex 0 | 24px, removed at the end | shown | **not painted** (`zoom3-register-rest.png` vs `zoom3-register-scrolled.png`) |
| Alerts | 768 | true (825/718) | `Alerts, scrolls horizontally` | 24px | shown | **not painted** (`zoom3-alerts-scrolled.png`) |
| Alerts | 1440 | false | none, no tab stop | none | none | n/a |
| Risk-exposure cross-tab | 375 | true (512/301) | `Residual rating by treatment status, scrolls horizontally` | 24px at rest and part-way, none at the end | shown | kept (`crosstab-375-mid.png`) |
| Cross-tab | 1440 | false | none | none | none | n/a |
| CSV Guidance at 375 | risk types false; controls, systems, assets true | `{Label} CSV columns, scrolls horizontally` | shown | n/a | n/a | n/a |

- **Keyboard:** from the density toggle, Tab lands on the region at 768 to 1440, and two ArrowRight presses scroll it 80px.
- **Focus clearance:** `scroll-padding-inline-start` follows the sticky column (216px on the register).
- **Computed styles hide the hairline defect:** the sticky cell's computed `border-right-width` is 1px in both states, so no computed-style assertion can see it.

### Status badges (D-27, X-5)

Every badge observed carried its tone as `data-tone`, a 4px radius, 12/16 text at 500, 8px horizontal padding and a 12px `aria-hidden` icon. That covers 19 values: request (five), assessment (three), questionnaire (three), treatment (three) and CSV row (five, synthetic). Their colours are the §3.5 values exactly: for example info #EFF6FF/#1D4ED8/#B2CCFF, success #ECFDF3/#067647/#ABEFC6, and neutral #ECEAE5/#6B6962/#D8D5CD.

- **Request `Submitted` (WR-03):** success with `Send`, seen on the analyst queue.
- **Values absent from the development data:** request `Draft` and `Closed`, questionnaire `Draft`, assessment `Closed` and treatment `Overdue`. Their mapping is unit-tested; the request draft and submitted rows are at `status-badge.test.tsx:57-58, :192, :208`.
- **`Released` across surfaces:** the review list, the filter option (`approved=Released`), the editor header (`aria-live="polite"`), the Requestor's header, definition and chip `Status: Released`, and the Risk detail header.
- **Questionnaire review list:** the list shows `Analyst review` (warning), `Not started` (neutral) and `Submitted` (success). Its `Not started` filter returns both an `Analyst review` row and a `Not started` row under the chip `Status: Not started`, as UI-SPEC §3.4 predicts.

### Surfaces

- **Analyst questionnaire review, analyst-review state (375, 1440).**
  - Eight rows, and each question's text occurs once in `main`. There is no `Questionnaire submitted` text.
  - Four section captions, mono 11px uppercase.
  - Captions at 12/16 400 in #6B6962; question text at 14/20 500.
  - `Choices: …` lines under both select questions.
  - The revision timeline names Bob Doe. Screenshot: `questionnaire-analystReview-375.png`.
- **Draft card.** No card text anywhere contains `deterministic` or `assistance`.

  | Request | State | What the card shows |
  |---|---|---|
  | `Customer portal questionnaire awaiting release request` | Questionnaire in progress | the precondition sentence, no button |
  | `RAR-2026-H0NX4Y` | Risk assessment drafted, `ASM-2026-MWQA7E` Draft | `Generate assessment draft` |
  | `Customer portal security assessment` | Approved, `ASM-2026-33SAEN` Released | `Generate assessment draft` (W-1) |

  Screenshots: `request-*-{1440,375}(-card).png`.
- **Menu trigger (375 and 768).**
  - The name is `Menu`, with no `aria-label`; the pill is 85×44.
  - `aria-haspopup="dialog"`; `aria-expanded` goes from false to true; `aria-controls` equals the sheet's id.
  - Focus moves to `Close navigation` on open, and Escape returns it to `Menu`.
  - axe on the open sheet: `color-contrast`, `button[aria-label="Close navigation"]`, 1.09 (#f6f5f2 on #ffffff). Screenshots: `menu-open-375.png`, `menu-open-375-close-unfocused.png`.
- **Fallbacks.**
  - `/this-route-does-not-exist` and `/app/this-route-does-not-exist`, signed out and in: HTTP 404, the card frame, one h1 `Page not found`, title `Page not found | IdamBox CSRM`.
  - `/app/admin/not-a-collection` and four missing-record URLs: the in-shell not-found, HTTP 200, with the same title.
  - axe clean at both widths.
- **Denials.**
  - Requestor on eight analyst routes: the page `h1`, an `h2` naming the refusal, and route titles, axe clean.
  - Secondary Requestor on Jane's request: `Assessment request` / `Assessment Request | IdamBox CSRM`.
  - On Jane's questionnaire: `Questionnaire unavailable`.
  - On Jane's assessment: `Page not found` / `Page not found | IdamBox CSRM`. None of the three names the record.
- **Analyst dashboard.** All ten link rows' names begin with their visible words, for example `Critical 2` → `Critical: 2 open Risks by residual rating`. axe is clean with the label rule on.
- **Administration validation (four collections × two widths).**
  - Blurring the first required field shows `Enter a name.` or `Enter a control number.`.
  - An empty submit is stopped in the browser and shows per-field messages at 12/16 400 in #B42318 with a 14px icon, linked by `aria-describedby`. Focus lands on the first invalid field, and no request left the page.
  - Labels sit 6px above their fields.
- **CSV review step (synthetic preview, 375 and 1440).**
  - `Create` success/`Check`, `Update` success/`RefreshCw`, `Unchanged` neutral/`FileCheck2`, `Rejected` warning/`CircleX`, `Ambiguous` warning/`CircleQuestionMark`, matching the direction's CSV import rows entry. Screenshots: `import-preview-{1440,375}.png`.
  - Its only axe result, `target-size` on the breadcrumb at 375, is a scroll-position artefact: the step's focus scrolls the page 38px, so the breadcrumb sits under the sticky header. At scroll 0 the scan is clean (`admin3.json`). It is not counted.
- **Overlays.** The `Release questionnaire`, `Delete question` and `Return to draft` confirmations and the `More filters` popover are axe-clean at both widths. They were opened and cancelled only.
- **Console and overflow.** No console errors except the expected 404 resource messages on not-found URLs. No horizontal page overflow on any capture.

### Print (794px emulation and A4 PDFs)

- **Hidden:** chrome, filter rows, density toggles, pagers and header actions. Nothing inside `main` stays sticky, and badges keep their tints.
- **Register (`print-a4-register.pdf`).**
  - `12 results`, the chips (`Risk state: Open`) and `Page 1 of 1` print.
  - The 1100px table is scaled onto A4, with the `Related assessment` header chevron clipped at the right edge.
  - The long fixture Risk numbers break at hyphens into four lines, for example `RSK-E2E-P7-CLOSED-001`; `RSK-2026-B2QDZ6` takes two.
  - Statements are cut at two lines (W-4), and all eight sort chevrons print.
- **Analyst lists.** `Queue: Released` prints (it is outside the controls, `assessment-list.tsx:239`). The status and search filters do not print, and neither list renders chips (`print-a4-review-assessments-released.pdf`).
- **Detail pages.** The questionnaire analyst review prints `Release questionnaire`, `Add question` and eight `Edit`/`Delete` pairs (`print-a4-questionnaire-analyst-review.pdf`). The request review prints `Generate assessment draft`. The released assessment and Risk detail print clean.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Holds:**
- The draft card matches every UI-SPEC §1.1 string. The precondition sentence (WR-06) replaces the retired "Draft assistance" wording.
- `Released` everywhere, with `Approved` kept for requests.
- `Search assessment requests` and `Search risk assessments` (D-30), each with an equal `aria-label`.
- The locked fallback copy.
- The Administration messages say what is wrong and how to fix it.

**Findings:**
- **W-10 (open question 1).** The development sign-in is titled `IdamBox CSRM` (`app/sign-in/page.tsx:20`), the only swept page whose title does not name the page.
- **INFO: the draft card's description contradicts the precondition.** It says "Generate a draft Risk Assessment from the submitted questionnaire" while the card below it says no questionnaire is submitted (`request-precondition-375-card.png`). Consider: "Generate a draft Risk Assessment once the questionnaire is submitted."
- **INFO: the CSV review step.** These are pre-existing (06-09), but they sit on the audited row-state surface:
  - the mobile card reads `1 changes` (`csv-import-flow.tsx:178`);
  - issue lines repeat the key they are prefixed with (`name: Enter a name value.`; `controlNumber: controlNumber must be at most 255 characters.` from `csv-import.ts:166, :170` as rendered at `csv-import-flow.tsx:177`);
  - this is not the WR-04 voice the forms now use (`Use 255 characters or fewer.`).

### Pillar 2: Visuals (3/4)

**Holds:**
- **Hierarchy:** serif titles, then the status badge in the header's status slot, then cards.
- **Question editor:** it reads as one grouped list at both widths.
- **End fade:** it sits on the visible edge while scrolling (`register-1024-region-midscroll.png`).

**Findings:**
- **W-2** (priority fix 3): the sticky column's hairline scrolls away.
- **W-14 (minor, print).** Workflow action pills print on detail pages: `Release questionnaire`, `Add question`, `Edit`/`Delete`, `Generate assessment draft`.
  - X-4's list names header actions but not in-page actions, so no rule hides them.
  - Mark those action groups `data-print="hidden"`: the governance actions (`questionnaire-governance.tsx:82-83, :90`) and the draft card's action (`assessment-draft-job.tsx:221`).
- **INFO: the precondition has low salience.** It renders in the same muted `text-sm` as the description (`assessment-draft-job.tsx:222`), so an unavailable action looks like more description. Consider the bordered status row with `Clock3` that the queued state uses.

### Pillar 3: Color (2/4)

**Holds:**
- The tones follow X-5 on every family, and the colours are the §3.5 values.
- Ink is the only interactive colour.
- The fade blends to `--surface`.
- Severity and status never share a badge, and every badge has an icon and text (1.4.1).

**Findings:**
- **B-1 (priority fix 1).**
  - **Cause:** the outline variant (`button.tsx:16`) sets a surface fill but no text colour. Inside `.sheet-content`, whose colour is `--sidebar-foreground` (`globals.css:749`), the `Close` label and icon inherit #F6F5F2 on #FFFFFF: 1.09:1 against 4.5:1 (1.4.3); the icon also fails 1.4.11.
  - **Scope:** it affects every actor on every page below 1024px, and was measured at 375 and 768.
  - **Origin:** it dates from the BProton restyle (`6a1f1f3`, 2026-09-24). No sweep scanned the open sheet: `accessibility.spec.ts:508-535` drives it by keyboard without axe.
  - **Fix:** add `text-foreground` to the outline variant (which changes nothing on light surfaces) and add a scan with the sheet open.
- **INFO (needs human review): semantic tension in X-5 as written.**
  - In the analyst's `Requires my attention` queue, the two `Submitted` requests are green (success = "submitted"). Yet they are the rows waiting on the analyst, which X-5 also calls warning.
  - `Draft` also appears as info (request, questionnaire) and as warning (assessment).
  - Both follow the recorded vocabulary. They are noted for the product owner, not as defects.

### Pillar 4: Typography (3/4)

**Holds:**
- Every Phase 8 text measured resolves to a §3.10 pair: the badges, the question rows, the mono section captions and the Administration errors.
- The not-found `h1`s use the serif at 28px.
- The draft card title is `--text-heading-sm`.

**Findings:**
- **W-8 (open question 3).** The four section captions are `h3.micro-label` (`questionnaire-governance.tsx:89`), siblings in the outline of the `h3 Question editor` that visually contains them. The outline is `h2 Analyst review > h3 Question editor, h3 Service context, h3 Data and privacy …`.
- **INFO: the CSV summary counts are off-scale.** They use `text-2xl font-semibold`, 24/32 at 600 (`csv-import-flow.tsx:175`), which is not a §3.10 pair. KPI values are `--text-display` (30/36 at 600). This is pre-existing (06-09) but on the audited row-state step.

### Pillar 5: Spacing (3/4)

**Holds:**
- The filter tracks and rows follow UI-SPEC §4.1 at every width, and labels never wrap.
- The search button sits 8px after the input, end-aligned.
- The Menu pill meets the 44px touch target.
- The statement column sits at the X-3 minimum.

**Findings:**
- **W-5: labels sit 1px above their fields.**
  - **Where:** the Risk Register filter bar and sheet, and the analyst review lists' controls (`gaps.json`). The direction's §4 Forms asks 6px, which the Administration forms meet.
  - **Cause:** the labels are inline with `space-y-1` (`risk-register-filters.tsx:142, :187`; the sheet's `:210-211`; `assessment-list.tsx:65`). Their text is a text node and the field is the last child, so the utility adds nothing.
  - **The sheet:** `space-y-2` on the form cannot separate an inline label, so the `Search Risks` pill touches the input (0px, `register-375-filter-sheet.png`).
  - **Fix:** use `grid gap-1.5` on these labels and `grid gap-2` on the sheet's form.
- **W-11: badges are 22px tall.** The direction's §4 Status & risk badges says 20px. The cause is `py-0.5` plus the 1px border in `components/ui/badge.tsx:8`. `py-px` gives 20px. Now that every status shares this badge, the difference is everywhere.
- **W-12: the Risk detail's alert touches the next section.** The `Released assessment - read only` Alert sits 0px above the first section card (`risk-details.tsx:111-112`; `risk-detail-1440-giajyamk3n696kqzpwobayug.png`); section rhythm is 24 to 32px. Give the Alert a bottom margin, or put it inside the `grid gap-8`.
- **W-13: header actions do not stack full-width below 768px.** §4 Page header says they should. The in-shell not-found's `Return to workspace` is content-width at 375 (`shell-analyst-375-_app_admin_not-a-collection.png`), as are `New request` and the list search buttons. The only rule (`globals.css:835`, `.page-header .button-primary`) targets a class no shadcn button carries. Retarget it to the `PageHeader` action wrapper's children.

### Pillar 6: Experience Design (2/4)

**Holds:**
- Region semantics exist only while overflowing, and ArrowRight scrolls.
- One h1 per page on every denial and fallback, with truthful titles, including missing records (WR-05).
- Validation runs on blur, and focus goes to the first error.
- The Menu state and focus return.
- The draft card's submitted-questionnaire gate holds while the request is in progress.

**Findings:**
- **W-1, W-3 and W-4:** priority fixes 2, 4 and 5.
- **W-6 (open question 4a):** status and search do not print on the analyst lists.
- **W-7 (open question 4c):** unsorted sort chevrons print.
- **W-9: the question editor's buttons are indistinguishable.** It has eight `Edit` and eight `Delete` buttons with identical names (`questionnaire-governance.tsx:90`), and a screen reader's button list cannot tell them apart. Add visually hidden context after the visible word, for example `Edit<span class="sr-only"> question: {text}</span>`; Label in Name still holds because the visible word leads.

---

## Open UI questions: verdicts

1. **Development sign-in title `IdamBox CSRM` (08-12). Verdict: fix now.**
   - **Reasons:** every other page is titled `{Page} | IdamBox CSRM`. The page's own `h1` is `Development sign-in`. The page sits inside the D-25 sweep and the conformance record's 2.4.2 claim.
   - **Change:** `app/sign-in/page.tsx:20` → `{ title: 'Development sign-in | IdamBox CSRM' }`. Update the pins at `src/lib/auth/sign-in-page.test.tsx:82`, `e2e/accessibility.spec.ts:490` and `e2e/production-hardening.spec.ts:527-528`.
   - **Why it is safe:** the sign-in helpers assert the Dashboard heading, not this title.
2. **Exposure link names `{Rating}: {n} open Risks by residual rating` (08-12). Verdict: accept.**
   - **Checked in the browser at both widths:** each name begins with the visible `Critical 2`, keeps the residual qualifier the Phase 7 name carried, and passes axe with the label rule.
   - **To do:** add a dated amendment note at `07-UI-SPEC.md` §5.2 (line 525) and §7.2 (line 631), as WR-03 did for §3.3, so the approved contract states the shipped name.
3. **Section captions as `h3` (08-07). Verdict: fix now, to `h4`.**
   - **Reasons:** the sections are rendered inside the `Question editor` group and are subordinate to it visually. An `h4` makes the outline match (1.3.1, technique G141) and changes nothing visible.
   - **Change:** `questionnaire-governance.tsx:89` `<h3 className="micro-label …">` → `<h4 …>`; `questionnaire-governance.test.tsx:50` `{ level: 3 }` → `{ level: 4 }`; and amend UI-SPEC §7 item 3 to say `h4`.
4. **Print (08-09).**
   - **4a. Analyst lists print without filter context. Verdict: fix now.**
     - **What is actually missing:** narrower than recorded. `Queue: {label}` does print; the status and search filters do not.
     - **Change:** `ListFrame` in `assessment-list.tsx` passes the §4 DataTable chips, built as `request-table.tsx` builds its own: `Status: {label}` and `Search: {q}`, with `onClearFilter` and `onClearFilters`. The same chips then appear on screen, where the direction already requires them.
     - **Test follow-up:** scope the two unscoped `Clear filters` assertions at `assessment-navigation-lifecycle.spec.ts:287, :302`. 08-09 recorded them as lines 207 and 222; they have since moved.
   - **4b. Risk numbers wrap to four lines on A4. Verdict: accept.**
     - **Reason 1:** the four-line breaks come from the long E2E fixture numbers (`RSK-E2E-P7-RELEASED-001`). The product's own numbers (`RSK-2026-B2QDZ6`) print on two lines, breaking at the hyphen, so they stay legible and searchable.
     - **Reason 2:** `nowrap` would widen a table whose right edge is already at the limit of Chromium's print scaling.
     - **Note:** statement truncation (W-4) is the print defect that matters here.
   - **4c. Sort chevrons print. Verdict: fix now, unsorted only.**
     - **Change:** `data-table.tsx:109` → `<ChevronsUpDown aria-hidden="true" className="text-muted-foreground" data-print="hidden" />`.
     - **Effect:** the active `ChevronUp`/`ChevronDown` keeps printing the table's order, and seven icons leave the printed register header, which also frees the clipped right edge.
5. **Post-load prefetch, up to about 176 KB on `/app/review` (08-13). Verdict: accept.**
   - **When it happens:** it runs after hydration, is not first load, and stays outside the budgets.
   - **Why the figure overstates it:** the figure was measured with the HTTP cache disabled. A real session pays it once per build and then navigates to prefetched routes instantly.
   - **Where it happens:** the sidebar that drives it is hidden (`display: none`) below 1024px, so its links never enter the viewport there.
   - **Not re-measured here:** the development server does not prefetch (`next/dist/docs/01-app/03-api-reference/02-components/link.md:298`, "Prefetching is only enabled in production").
   - **Revisit:** under R-08-33's trigger, a bandwidth-constrained deployment, with `prefetch={false}` on the sidebar links.

---

## Observed outside the Phase 8 scope (not scored)

These pre-date Phase 8 and appeared on audited pages. They are recorded for a later polish pass.

- **Request lifecycle stepper at 1440** (`request-approved-1440.png`):
  - `xl:grid-cols-8` with `break-words` breaks "Questionnaire" mid-word into "Questionnair / e" in 121px steps (`request-lifecycle-stepper.tsx:39, :53`);
  - its heading is 18/28 at 600 (`:36`) and its step index 12/16 at 600 (`:51`), neither a §3.10 pair.
- **Off-scale radius:** `rounded-xl` (12px) on the governance card, the steppers and `ui/alert.tsx:7`; §3.8 has 4, 6, 8, 16 and full.
- **Touch targets:** buttons are 36px tall at 375 (`New request`, `Search`, `Filters (0)`, `Create Risk Type`) against the direction's "touch targets ≥44px below 768px". WCAG 2.5.8 (24px) is met.
- **Casing and dashes:**
  - the `h1` `Questionnaire Review` is title case among sentence-case siblings (`app/(app)/app/review/questionnaires/page.tsx:21, :31`, and its error and loading files);
  - em dashes remain in copy (`risk-details.tsx:97, :218`; `request-hub.tsx:75`).
- **Analyst editor field errors:** they render at 14px with a 16px icon (`risk-editor.tsx:230`, `control-implementation-editor.tsx:148`, `risk-detail-editor.tsx:219`). §4 Forms and the Administration `FormMessage` use caption size with a 14px icon. The WR-04 copy itself was checked in the schemas (`assessment-schema.ts:251, :265-268, :398-400`).
- **Select names:** `Filter by status` and `Filter by queue` contain their visible labels but end with them. They pass 2.5.3; they are not ideal.

## Registry safety

Registry audit: no third-party blocks (UI-SPEC "Registry safety": shadcn official only, none added), so this is not applicable.

---

## Files Audited

- **Shared components:**
  - `apps/web/src/components/csrm/{status-badge,data-table,horizontal-scroll-region,page-header,bar-chart}.tsx`
  - `apps/web/src/components/ui/{badge,button,input,form}.tsx`
  - `apps/web/src/components/shell/{capability-navigation,wordmark}.tsx`
- **App routes and styles:**
  - `apps/web/app/{globals.css,layout.tsx,not-found.tsx,global-error.tsx,sign-in/page.tsx}`
  - `apps/web/app/(app)/not-found.tsx`
  - `apps/web/app/(app)/app/review/questionnaires/page.tsx`
- **Features:**
  - `apps/web/src/features/risks/{risk-register,risk-register-filters,risk-details}.tsx`
  - `apps/web/src/features/assessments/{assessment-draft-job,assessment-detail,assessment-list,risk-editor}.tsx`, `assessment-actions.ts`, `assessment-schema.ts`
  - `apps/web/src/features/questionnaires/{questionnaire-governance,questionnaire-review,questionnaire-review-list}.tsx`
  - `apps/web/src/features/administration/{csv-import-flow,administration-form}.tsx`, `administration-schema.ts`
  - `apps/web/src/lib/schemas/validation-messages.ts`
  - `apps/web/src/features/analyst-dashboard/{analyst-dashboard.tsx,analyst-dashboard-presentation.ts}`
  - `apps/web/src/features/reports/report-table.tsx`
  - `apps/web/src/features/requests/request-lifecycle-stepper.tsx`
- **Strapi, read for behaviour only:**
  - `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` (the draft target guard)
  - `apps/strapi/src/api/csrm-administration/services/{administration-workflow,csv-import}.ts` (the preview persists nothing; the issue copy)
- **Tests read:** `apps/web/e2e/accessibility.spec.ts` (the sheet proof), `apps/web/src/components/csrm/status-badge.test.tsx`, `apps/web/src/features/questionnaires/questionnaire-governance.test.tsx`
- **Audit tooling (local, gitignored):** `apps/web/.tmp/audit/ui-review/*.mjs`, with outputs and screenshots in `apps/web/.tmp/audit/ui-review/out/`

---

_Reviewed: 2026-09-26_
_Reviewer: gsd-ui-auditor role, from browser measurements and code reading_

---

## Resolution (2026-09-26)

The pillar scores above stand as audited on `d11f469`; this section records what became of each finding and verdict, and does not re-score. Each fix has its commit, and each new browser proof failed on the build before its fix, except W-11's (see its row). The browser proofs are in the `e2e/` specs that each `test(08)` commit touches.

### Priority fixes and warnings

| Finding | Resolution | Commits |
|---|---|---|
| B-1 Close control 1.09:1 | Fixed. The outline variant sets the direction's `--color-text-primary` (`!text-foreground`; important, so tailwind-merge keeps `text-button`). Outline buttons on light grounds look the same; the DataTable density toggle and pager, which inherited the toolbar's muted text, now draw the Outline ink. The keyboard proof scans the open sheet at 375; before the fix it failed with `color-contrast` 1.09 (#f6f5f2 on #ffffff). | `e018f25`, `a5fff2f` |
| W-1 draft card on an assessed request | Fixed. With no job of the current session, the card renders nothing once the request has an assessment, available or not openable, so an assessed request never offers generation. As first fixed, the card was unmounted instead, and the full browser run showed that starting a draft revalidates the page, which re-rendered it after the in-process provider had created the assessment: the generating session lost its card and link. The card now stays mounted and takes the fact as a prop; a unit test re-renders the page with the new assessment after generation. | `7e8b1d0`, `082c5fe` |
| W-2 sticky hairline scrolls away | Fixed. DataTable uses separated borders with no spacing, as the cross-tab does, so each cell draws its own rules and the pinned cell paints its hairline wherever the table is scrolled. The print rule that drops the hairline still matches. The Risk Register journey reads the painted pixel at the pinned edge at 768 and 1024; before the fix it painted white once scrolled. | `493b5f3`, `d462e6b` |
| W-3 refusals keep working controls | Fixed. The request queue, the risk assessment list and the questionnaire review list return the permission state before their controls, as the Risk Register does. The sweep's permission guard now requires no search, filter, total, pager or density toggle on every refusal; before the fix it failed on exactly these three lists for both Requestors. | `4ecc149`, `c819ffd` |
| W-4 printed statements cut at two lines | Fixed. The print block releases any line clamp inside `main`, recorded first as an X-4 refinement in the direction document. The print proof requires no clamped element on paper; before the fix the register failed at 794 and 718px. | `e11169e`, `df06656`, `703e15e` |
| W-5 labels 1px above their fields; sheet button touching its input | Fixed, for every list's filter labels, not only the Risk Register and the analyst lists: grids with the direction's 6px gap, the sheet's search form a grid with 8px, and the relation pickers' gap from 4 to 6px. A source guard keeps the eight filter modules on the rule; the journey measures 6px on the bar at 768 to 1440 and in the sheet, and 8px from input to button. Before the fix the gaps measured -1 to 0px. The button gap is read by layout offsets, because a primary button lifts 1px under a resting pointer. | `8c0b14c`, `9dfc5b8`, `b3e22e8` |
| W-6 (open question 4a) | See verdict 4a. | |
| W-7 (open question 4c) | See verdict 4c. | |
| W-8 (open question 3) | See verdict 3. | |
| W-9 identical Edit and Delete names | Fixed. Each reads its visible word followed by visually hidden context, `Edit question: {text}` and `Delete question: {text}`; Label in Name holds, and the separating space sits outside the hidden span so every name computation keeps it. UI-SPEC §7 records the names. | `f5976ac` |
| W-10 (open question 1) | See verdict 1. | |
| W-11 badges 22px | Fixed: `py-px` makes the direction's 20px. A new conformance test measures every badge on the Risk Register and the risk assessment review list at 20px; it first ran after the fix, so its failing state was shown by the unit test and by this review's 22px measurement. | `392f973`, `79d55e5` |
| W-12 released notice touching the first section | Fixed. The notice is the first item of the section grid, so `gap-8` separates it. The journey measured 0px before the fix. | `ef7470c`, `d4787e1` |
| W-13 header actions content-width below 768px | Fixed, because the direction specifies it (section 4 Page header). PageHeader's actions wrapper carries `page-header-actions`, and below 768px each control inside it spans the stacked header; the Administration actions stack until 768px instead of 640px. The rule that targeted `.button-primary` is gone. A new conformance test failed at 700px before the fix. | `51410a1`, `0fb2347` |
| W-14 workflow actions print on detail pages | Fixed, after recording the X-4 refinement that in-page workflow actions do not print. The governance controls and the draft card's actions carry `data-print="hidden"`; the questions, captions and advisory copy still print. The print proof failed with all 18 governance actions printing. | `e11169e`, `5add96c`, `a3040d9` |

### The open UI questions: verdicts

| Verdict | Resolution | Commits |
|---|---|---|
| 1. Development sign-in title | Fixed: `Development sign-in \| IdamBox CSRM`, pinned by `sign-in-page.test.tsx`, the accessibility sweep and the production hardening sweep; the conformance record's open finding 1 is closed. | `ccf5fc1`, `7d288dc` |
| 2. Exposure link names | Accepted. 07-UI-SPEC §5.2 and §7.2 carry a dated amendment stating the shipped name; the conformance record's open finding 4 is closed. | `1456e49`, `37e5ad8` |
| 3. Section captions as `h3` | Fixed: `h4`. The two unit tests that read them and UI-SPEC §7 and Typography follow. | `ae9c7da` |
| 4a. Analyst lists print without filter context | Fixed. Both analyst review lists show the Search and Status chips, the status by the shared mapping's label; a chip's removal and the chip row's Clear filters clear only what the chips show and keep the queue. The two lifecycle assertions and their unit mirrors address the empty state's Clear filters. | `848c4fb`, `559463b` |
| 4b. Long Risk numbers wrap in print | Accepted, for the review's reasons: the four-line breaks come from the long E2E fixture numbers, the product's own numbers print on two lines at the hyphen, and `nowrap` would widen a table already at the limit of print scaling. | |
| 4c. Sort chevrons print | Fixed, unsorted only: the `ChevronsUpDown` cue is `data-print="hidden"`, and the sorted column's direction still prints; recorded in the X-4 refinement. The print proof failed with seven unsorted cues printing. | `e11169e`, `9ee6932`, `665f642` |
| 5. Post-load prefetch | Accepted, for the review's reasons: after hydration, outside the budgets, paid once per build with the cache on, and driven by a sidebar hidden below 1024px. Revisit under R-08-33. | |

### Informational notes and observations outside Phase 8

Not changed here, because none was in this resolution's scope, and each is copy, product meaning or a pre-Phase-8 surface for a later pass:

- **The draft card's description** ("from the submitted questionnaire") beside the not-yet-submitted precondition. The description is the locked UI-SPEC §1.1 string, so a change is a copy decision for the orchestrator.
- **The precondition's low salience** (the queued state's bordered row is the suggested model). A design choice, not a defect.
- **X-5's semantic tension** (submitted requests green in the analyst's queue; Draft as info and warning). This is for the product owner, as the review says.
- **CSV review step** copy (`1 changes`, key-prefixed issues) and its off-scale summary counts. Pre-existing from 06-09.
- **Outside the Phase 8 scope:** the stepper's mid-word wrap and off-scale type, the `rounded-xl` radius, the 36px buttons at 375 against the 44px touch height, the title-case `Questionnaire Review` heading and em dashes, the analyst editors' 14px field errors, and select names that end with their labels. The analyst editors' form labels also sit 8px above their fields (`grid gap-2`), against the direction's 6px; W-5 covered the filter labels only.

### Verification

- **Closing checks** on `8687484`, whose code is that of `b3e22e8`: the web unit suite passed 99 files and 1,887 tests (20.6s), the typecheck is clean, and `api:check` is clean, so the contract and the generated client did not change.
- **Strapi suite:** 526 of 526 passed (626.3s, on `665f642`). It ran because O-1 changed the served-operations scan in `apps/strapi/tests`; no Strapi source, schema or contract changed.
- **Failing states:** the new browser proofs first ran on the code before their fixes, in both projects: 27 tests, of which 8 failed, 17 passed and 2 did not run (serial mode), in 20.2m. W-13's proof then failed on its own at 700px, where `Create Risk Type` was 530.8px narrower than the header. W-11's proof first ran after its fix (see its row).
- **First full browser run** (desktop and mobile, on `69e7b21`): 82 of 84 passed (11.1m). Both failures came from this resolution's own changes:
  - the release journey never saw `Draft generation is queued`, because W-1's first fix unmounted the draft card when revalidation re-rendered the page (fixed by `082c5fe`);
  - the Risk Register journey read the sheet's button 7px below its input at 390px, because the primary button lifts 1px under the resting pointer (fixed by `b3e22e8`, which measures by layout).

  Both journeys then passed, the Risk Register's in both projects (3 tests, 2.0m).
- **Final full browser run** (on `b3e22e8`): 84 of 84 passed, 80 desktop and 4 mobile, in 11.3m.
- After the final run the working tree was clean and no server was left running.
