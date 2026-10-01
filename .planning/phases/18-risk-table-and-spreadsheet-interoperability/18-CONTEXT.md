# Phase 18: Risk table and spreadsheet interoperability - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`, one pass. Every gray area took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005 risk analysis on the organisation's own criteria; audit-trail integrity) at the G-4 premium bar, consistent with every decision in `.planning/NEXT-WAVE-DECISIONS.md` (1 to 18, G-1 to G-20). Grounded in:
- the product gap UAT (UAT-008, UAT-039, UAT-050, UAT-055, UAT-056, UAT-057, UAT-063; `REPORT.md` §6 and §7);
- the orchestrator's seeds, each confirmed or corrected against the code (last section);
- the planned outputs of Phases 10, 11, 12, 13, 14, 16, 17, 17.1, 17.2, 19 and 19.1 (each CONTEXT with its Orchestrator Confirmations; Phases 16 and 19's RESEARCH, PATTERNS and UI-SPEC);
- a read of today's code (`<code_context>`).

There is no SPEC.md. The discussion log is `18-DISCUSSION-LOG.md`. Following stage2-rules §3a, upstream decisions are cited by number, not restated.

**Plans are written ahead.** Phase 18 executes after Phases 10 to 16, 19, 19.1, 17, 17.1 and 17.2 (order 10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22). Its plans are written against today's code plus those phases' planned outputs, name the earlier plans they rely on, and get a fresh plan check just before execution.

<domain>
## Phase Boundary

Give an assessment's risks one table that a Security Analyst reviews and edits like Excel or a SharePoint list: configurable columns, sort, filter, a frozen first column and saved views; inline editing with validation, one batch save, undo and conflict handling; the WCAG 2.2 AA grid keyboard model; copy and paste with Excel and SharePoint in both directions; likelihood and consequence on the organisation's 5 × 5 scales with a derived rating the analyst can override with a reason; and rows imported from and exported to CSV and XLSX. The released record and every participant's view use the same table, read-only and copyable. Phones get a card list.

### In scope
- Decision 7's grid spike, and the risk table in an editable and a read-only mode (D-04 to D-06).
- Columns and the column chooser, client-side sort, filter and search, server-side saved views, and the review lists' adoption of the column chooser (D-07 to D-10).
- Inline editing, the unsaved change set, one bulk save with per-cell conflict detection, Undo, rows and bulk actions (D-11 to D-16).
- The grid keyboard model, copy, and paste with mapping, conversion and preview (D-17 to D-19).
- Closed likelihood and consequence vocabularies on every write path, the rule for existing free text, the derived rating and its override (D-20 to D-22).
- Risk-row and mitigation-control import, and the current view's export (D-23, D-24).
- Grants, three contract-gap records and their checkpoint, the amendment to Phase 16's risk history, phones, performance and tests (D-01 to D-03, D-25 to D-30).

### Out of scope
- Any participant action or flow (responses, decisions, contest points: Phases 17, 17.1 and 17.2). Participant views gain only the read-only table.
- The Risk Register's column choice and saved views (Phase 20, RISK-03), Admin ownership of shared views and configurable scales (Phase 22), the heat map (Phase 21).
- Bulk decisions, bulk contest acts, and notifications for bulk edits (none in G-14, G-15 or G-18).
- Attachments on risks and a "Files" column (deferred by 14-CONTEXT), a portfolio import across assessments, request import (`REPORT.md` §6 item 9).
- Live co-editing or presence (no polling, as in Phase 19.1); any AI change; Keycloak.
</domain>

<requirements>
## Requirements and Success Criteria This Phase Owns

| Requirement | Acceptance (REQUIREMENTS.md, abridged) | Decisions |
|---|---|---|
| **ASSESS-15** A table with configurable columns, sort, filter, a frozen first column and saved views | (1) one row per risk, `REPORT.md` §7's default columns, every other field through a column chooser; (2) sort by any column, per-column filters, quick search, a row count, named saved views personal by default and shareable with analysts; (3) below 768px a card list with a detail sheet, no grid editing on phones; (4) 150 risks scroll and edit without visible lag at 1440px within the route budget or a recorded exception | D-04 to D-10, D-26, D-27 |
| **ASSESS-16** Inline editing with validation, batch save, undo and conflict handling | (1) editors fit the field type and apply the server's validation per cell; (2) changed cells marked, "Save changes" saves one batch through a Strapi bulk operation, Discard, undo and redo in the session; (3) a save with stale rows returns the conflicts, resolved per cell; (4) every change records who, when and the old and new values | D-11 to D-16 |
| **ASSESS-17** The WCAG 2.2 AA grid keyboard pattern, and copy and paste with Excel and SharePoint both ways | (1) grid role, roving focus, arrow and jump keys, Enter, F2 and Escape, announced changes, the risks reachable without tabbing through the readiness list; (2) a copied range is tab-separated text plus an HTML table with display values; (3) a range pastes from the active cell with mapping and conversion ("High", dd/mm/yyyy, names, control numbers), previewed, never applied partially without the analyst choosing; (4) released and Requestor views read-only but copyable | D-05, D-06, D-17 to D-19 |
| **ASSESS-18** Controlled scales with a derived rating the analyst can override with a reason | (1) decision 8's likelihood and consequence pick lists, enforced by the API on the existing string fields, with a recorded rule for existing free text; (2) the rating derives as values change, banded 1–4 Low, 5–9 Moderate, 10–16 High, 20–25 Critical, overridable with a recorded reason | D-20 to D-22 |
| **ASSESS-19** Import rows into, and export rows from, an assessment's risks | (1) CSV or XLSX import creates and updates risks by risk number, and imports control implementations by risk number and control number, through the five-step preview; (2) export writes the current view (visible columns, filters, sort) to CSV and XLSX with formula-injection protection | D-23, D-24 |

**ROADMAP success criteria, each planned in the UI and the API with its negative cases:**
1. Treatment owner, target date and status set on ten risks by keyboard in under a minute, in one batch (D-16, D-17, D-13; proof D-29).
2. A copied range pastes into Excel as rows and columns; a 3 × 4 Excel range pastes with a preview converting "High" and dd/mm/yyyy (D-18, D-19).
3. A paste with one invalid cell applies nothing until the analyst chooses; two analysts editing one risk see a conflict, not a silent overwrite (D-19, D-14).
4. Released and Requestor views read-only but copyable; rows import from and export to CSV and XLSX (D-05, D-18, D-23, D-24).
5. 150 risks scroll and edit without visible lag at 1440px; phones show a card list (D-27, D-26).

**Closes:** UAT-008, UAT-039 (the assessment half; its questionnaire half is Phase 10 D-04's in-place question form, re-checked here at 375px), UAT-050, UAT-055, UAT-056, UAT-057, UAT-063. **Intent:** Q4, Q3, F7.
</requirements>

<decisions>
## Implementation Decisions

### Scope and contract boundary

- **D-01:** The content-type changes are exactly two, each through its contract-gap record and the approval checkpoint (`<contract_gaps>`), before any schema file changes. Names are proposals; the records fix them.
  1. **On `CsrmRisk`:** `inherentRatingOverrideReason` and `residualRatingOverrideReason` (text, optional), the current fact that a rating departs from the matrix and why (D-22). The four likelihood and consequence fields keep their string type: their closed vocabularies are API rules (D-20).
  2. **A new `CsrmSavedView`** (D-09): its owner (many-to-one `IdamBoxUser`, unidirectional), `viewKey`, `name`, `visibility`, `definition` (versioned JSON) and timestamps. It is product configuration, like Phase 19.1's notification, and competes with no JDL entity.

  Phase 16's risk history gains its new sources and uses its reserved `batchId` through a dated amendment, with no schema change (D-13, D-23). **Reversibility:** one-way - two persisted columns holding audit facts and a new table; undoing them needs a data migration.
- **D-02:** Every new or changed operation follows the endpoint chain of Phase 12 D-02, Phase 16 D-02 and Phase 17.1 D-02, including a matrix row per new route for all seven callers (Phase 17 D-75's `riskOwner` included), and Phase 19's file-response mode of the parity guard for files (19 D-19).
- **D-03:** The API changes are these, and no others. Paths are proposals; research fixes them within these families.
  1. **Bulk risk changes:** `POST /api/v1/risk_assessments/{assessmentId}/risk_changes`: updates to existing risks (each changed cell with the value it was edited from), new risks, and planned mitigation controls added by control (D-13, D-14, D-19).
  2. **Single-risk writes:** `PATCH /api/v1/risks/{riskId}` takes optional per-field base values under the same conflict rule (D-14); it and `POST /api/v1/risk_assessments/{assessmentId}/risks` enforce D-20 and D-22.
  3. **Bulk withdrawal and reinstatement:** Phase 16's operations, unchanged (its D-09, D-10).
  4. **Import:** preview, commit, template and error report for an assessment's two tables, `risks` and `mitigation-controls` (D-23), in Phase 19's import shapes (19 D-03 item 3).
  5. **Export:** the risk table's current view (D-24), in Phase 19's export family (19 D-03 item 1).
  6. **Saved views:** list (own and shared, by view key), create, update and delete (D-09).
  7. **Reads that change shape:** the analyst assessment detail gains each risk's mitigation-control summary (count; each control's number, title and status) and the scale in use (D-20, D-27); every risk projection (analyst, participant, released) gains the two override reasons (D-22).
  8. **Closed conflict reasons** added to Phase 10's vocabulary (for example `RISK_CHANGES_CONFLICT`, `SCALE_VALUE_INVALID`, `RATING_SCALE_VALUES_REQUIRED`, `RATING_OVERRIDE_REASON_REQUIRED`, `RISK_IMPORT_DRIFTED`, `ASSESSMENT_RISK_LIMIT`, `NOT_VIEW_OWNER`), reusing Phase 16's, 17's and 17.1's codes, with a per-cell error list in the closed error details.
  9. **Catalogue:** new API-only Functions (D-25).

  **Reversibility:** costly - published operations, fields and error codes.

### The grid: approach and place (decision 7)

- **D-04:** The grid follows decision 7's spike, in two stages, with its four criteria pass or fail:
  - **On paper (research):** each candidate is scored on licence, maintenance, size, documented ARIA APG grid support and token theming, and the failures are eliminated (`REPORT.md` §7 already rules out AG Grid Community's Enterprise-only ranges and clipboard, MUI X's commercial tiers, Handsontable's licence and canvas grids such as Glide). The lean is to extend the DataTable (06.6 D-02: extended, never forked) on TanStack Table, already a web dependency at 9.2.4, so the table itself adds no dependency; react-data-grid (MIT) is the alternative to score.
  - **Measured (the first UI plan):** the leading candidate's grid on the real Risks route (D-06) with 150 and 1,000 risks, against the four criteria: axe, a scripted APG keyboard walk and a manual screen-reader pass by the pilot; the route's delivered JavaScript within 300,000 bytes in `performance.spec.ts`; D-27's lag measure; semantic tokens only. A `checkpoint:decision` records pass or fail. A fail moves to the next candidate, or records an exception with its reason.
  - **Virtualisation:** the direction virtualises "past ~1,000 client rows" (§4 DataTable) and an assessment holds at most 1,000 risks (`MAX_ASSESSMENT_RISKS`). So rows render unvirtualised with memoised cells unless the measurement fails at the cap; only then does the plan add TanStack Virtual (MIT), justified there, with `aria-rowcount` and `aria-rowindex`.
- **D-05:** One risk table component, extending the DataTable, in two modes:
  - **Editable:** an analyst on an assessment that the one guard lets them change now (Phase 16 D-22, in 17.1 D-23's order: released, a response round open, an acceptance round open, the actor a named owner or approver).
  - **Read-only, but navigable, selectable and copyable:** everywhere else. That covers a released assessment, an analyst refused by the guard (the reason in a banner, such as "Editing is paused while round {n} is open"), every participant at every stage they may read (Phase 17 D-23, D-25), and withdrawn rows (Phase 16 D-07).

  The mode comes from the server's allowed actions (17.1 D-48), never inferred by the web.
- **D-06:** Where the table lives:
  - **The analyst's assessment** becomes one record with local navigation between two routes. **Overview** keeps today's URL with the assessment details, the provenance header, readiness, and the review, round, participant and release panels of Phases 12 to 17.2, plus a risks summary whose figures open the table filtered to them (X-10). **Risks** (`/app/review/assessments/{documentId}/risks`) holds the full-width table.
  - Each route is gated like today's analyst detail route (Phase 10 plan 10-02) and budgeted on its own (D-27).
  - The per-risk card becomes the table's detail sheet (X-13), opened from a row or a deep link by risk number, holding every per-risk surface of Phases 12, 16, 17, 17.1 and 17.2 with its behaviour unchanged (`REPORT.md` §7 keeps the card as a detail panel; Phase 16 D-45 built its pieces for this). Assessment-wide risk actions (Suggest more risks, Set one owner, Set one executive approver, Reassess residual risk for all) move to the table's toolbar, and readiness rows link into the table (Phase 10 D-35).
  - A skip link and the grid's single tab stop reach the risks (UAT-063).
  - **The participant page** (`/app/assessments/{documentId}`) stays one page. The read-only table becomes how participants read, filter and copy the risks, keeping Phase 17's "Your risk" marker and own-risks filter. The UI-SPEC places it so that Phase 17's response views and Phase 17.1's decision views keep working unchanged.

  **Reversibility:** costly - routes, deep links, and the specs that drive the per-risk surfaces.

### Columns, finding risks and views

- **D-07:** Columns:
  - **Default:** `REPORT.md` §7's set, with Risk number first, frozen with the sticky header. Every other field the viewer may read comes through the column chooser, which is Phase 19's column-choice primitive (X-30, 19 D-06), with reorder and resize by keyboard as well as pointer.
  - **No wider disclosure (19 D-06):** a participant's columns are exactly the participant projection (17 D-25, 17.1 D-47), never AI values awaiting confirmation (17 D-26); an analyst's are the analyst detail's fields.
  - **Governance markers** come from earlier phases' facts, never recomputed: Phase 12's per-cell AI marker (X-11) until confirmed or edited, with "Confirm AI values" for selected cells through Phase 12's decision operation (its D-24 and G-1 rule; Undo by `restore`); a row's decision state and, between rounds, its "will stand or be voided" flag (17.1 D-33, D-40); open contest points (the 17.2 seam); response items awaiting a decision (the 17 seam).
  - **Before release,** the treatment fields are labelled as the Security Analyst's recommendation (17.1 D-20, D-43), and the exception fields are not offered (17.1 D-44).
  - **Dates are dates:** no due-soon or overdue marker from `targetDate` or any other date (G-16; Phase 20 owns the due state).
- **D-08:** Finding and ordering:
  - The table loads every risk of the assessment in one read (bounded by the 1,000-risk cap), and sorts (several columns), filters per column (text contains, pick list, date range, is empty), searches (number, statement, cause, people) and counts on the client, with "{n} risks" and "{k} selected" always shown.
  - There is no pagination, because ranges and pastes span rows; the UI-SPEC records this against the direction's pagination line.
  - Active and Withdrawn is a segmented filter (Phase 16 D-08, X-27); withdrawn rows appear only under it.
  - One pure filter-and-sort module defines the semantics, and Strapi holds a copy for the export (D-24), proven equal by a parity test over fixtures (the 19 D-29 pattern).
- **D-09:** Saved views (ASSESS-15 criterion 2), for human Security Analysts only:
  - **The definition:** columns (order and widths), sort and filters, under a closed, versioned envelope that Strapi parses; keys that are unknown or no longer offered drop on read (fail safe). A view never grants data: the rows always come from the read.
  - **Personal by default:** the owner may share a view with the analyst team (`visibility` `personal` or `analysts`). Only the owner renames, changes, shares, unshares or deletes it; others read a shared view and "Save as" a personal copy. Deleting confirms with an Undo toast (G-4). Names are unique per owner and view key.
  - **Built-in views** live in code and are read-only: the default, "Treatment plan", "Ratings review" and "Owners and dates" (`REPORT.md` §7), and "Acceptance" (owner, executive approver, recommendation, decision state). The UI-SPEC fixes their columns.
  - **The last view used** is remembered per browser, guarded by try and catch, falling back to the default.
  - **View keys** are a closed vocabulary: `assessment-risks` now, and Phase 20 adds the register's. Who may share a view is decided in one place, which Phase 22 can give to the Admin (decision 1: "shared register views").
  - **Participants** have no saved views; their column choice and sort are remembered per browser.
- **D-10:** The review lists adopt the column chooser (ROADMAP Phase 18; Phase 11 D-33): the Requests queue, Questionnaires and Risk assessments lists gain it as a DataTable capability, remembered per browser per list like density. Phase 13's assignee column is offered there (13-CONTEXT's seam), and the lists' exports default to the visible columns (19 D-06). Server-side views for these lists and the Risk Register belong to later phases.

### Editing and saving (ASSESS-16)

- **D-11:** Cell editors fit the field:
  - pick lists for closed vocabularies;
  - the X-2 record picker for people (two characters, the hardened search, 17 D-52 and D-55) and for systems, assets and Risk Types (Phase 10 D-28);
  - dates typed in the local format with the date input, dd/mm/yyyy accepted;
  - multi-line text in an expanding editor;
  - the control picker, which adds planned mitigation controls;
  - for each rating, a 5 × 5 matrix picker that sets likelihood and consequence together, shows the derived rating and offers the override with its reason (D-22).

  Validation mirrors the server's per cell. Fields that submission needs are flagged, not blocked, while drafting (17.1 D-19). The risk number, the control summary and the markers are read-only.
- **D-12:** The unsaved change set:
  - Changed cells are marked. An "{n} unsaved changes" bar offers Save changes and Discard, and says when saving will withdraw {name}'s current review (17.1 D-07); after the save, the rows show 17.1 D-40's "will stand or be voided" flag.
  - Undo and redo cover edits, fills and pastes within the session (Ctrl+Z, Ctrl+Y).
  - The change set survives a failed save and a reload (session storage, guarded by try and catch), and Phase 10's navigation guard (its D-12) warns before leaving, so no input is lost (G-4).
  - There is no autosave: a batch that withdraws a review is an explicit act.
- **D-13:** A save is one bulk call, applied all or nothing in one transaction under the assessment's serialisation and lock:
  - It passes the one guard with the actor once (`assertAssessmentEditable`, Phase 16 D-22 as 17 D-43 and 17.1 D-23 extend it), and takes the accepted-edit transition once (17.1 D-06, D-07). A batch whose cells all equal their current values writes nothing and withdraws nothing.
  - Each row goes through Phase 16's inner create and update functions, so the risk history (16 D-19), Phase 12's `edited` marking (its D-21), the withdrawn guard (16 D-07), owner and executive approver eligibility (17 D-16, D-17; 17.1 D-15 to D-17, including clearing an approver when the residual rating falls below High), the exception-field refusal (17.1 D-44) and D-20 to D-22 all apply unchanged, through no second code path.
  - Every history row of the batch carries the source `table` and one `batchId`, so the history reads as one act.
  - **Bounds:** every unsaved change goes in one call, up to the 1,000-risk cap and a payload bound research sets. A risk of another assessment fails the batch with 404 (16 D-09). Invalid cells return every invalid cell with its closed reason, and nothing applies.

  **Reversibility:** costly - the one write path for the table and the import.
- **D-14:** Conflicts are detected per cell (ASSESS-16 criterion 3):
  - Each changed cell carries the value it was edited from, and the server compares it with the current value inside the transaction. A mismatch refuses the batch and returns every conflicting cell with its current value, and who changed it and when, from the risk history (a narrative read, never a gate).
  - Edits to different cells of one risk merge without conflict. Derived ratings are never compared: they derive at apply time.
  - The table shows each conflict in its cell, with "Keep mine" (rebase on the current value, then save) and "Take theirs" (drop the edit), per cell and for all.
  - The single-risk PATCH takes the same optional bases and every web form sends them, so neither the detail sheet nor the Risk Register's form can silently overwrite another analyst's change. A caller without bases keeps today's behaviour.
  - There is no polling: other analysts' changes appear on save or reload.
- **D-15:** After a save, the table shows the saved state at once and rolls back with the reason if Strapi refuses it (G-4). The success toast offers Undo, which saves the inverse of the batch's updates through the same operation, with the saved values as bases, so it conflicts rather than overwrite a newer change. The risks and mitigation controls the batch created stay, and the toast says so: no persisted risk is deleted (decision 6), and they can be withdrawn or removed in the detail sheet.
- **D-16:** Rows and bulk actions:
  - "Add row" adds a new row, saved with the batch and discarded freely before then (Phase 16 D-17). "Duplicate" copies fields only, never the number, the controls or AI provenance.
  - Selected rows are withdrawn through Phase 16's batch operation (its D-09: up to 200, one reason, Undo, no confirmation) and reinstated under the Withdrawn filter (its D-10).
  - A value fills a selection: committing an edit with Ctrl+Enter, or pasting a single value, fills every selected editable cell of that column (SC1: one treatment owner for ten risks).
  - Nothing deletes a risk (decision 6; Phase 16 D-16): Delete clears editable cells, and the table offers no delete action.
  - The detail sheet never silently drops or overwrites the table's unsaved changes to its risk; the UI-SPEC designs how it shows them.

### Keyboard and clipboard (ASSESS-17)

- **D-17:** The keyboard model is the ARIA APG grid (`REPORT.md` §7):
  - `role="grid"` with row and column headers, and one tab stop with roving focus;
  - arrows, Home and End, Ctrl+Home and Ctrl+End, Page Up and Page Down;
  - Enter or F2 edits, Escape cancels, Enter commits and moves down, and Tab commits and moves across;
  - Shift with an arrow or a click extends a range, Ctrl+A selects all, and rows and columns can be selected;
  - Ctrl+C, Ctrl+X and Ctrl+V;
  - changes, errors and conflicts are announced in a polite live region;
  - the active cell shows visible focus, and targets are at least 24px.

  Read-only modes keep navigation, selection and copy. The UI-SPEC fixes the keymap and the announcements.
- **D-18:** Copy: a copied range goes on the clipboard as tab-separated text and as an HTML table, with the header row when whole columns are copied. Cells carry display values: names, dates that Excel reads as dates, rating and scale labels, and controls as number and title, never an id. Copy works in every mode, participants included, with no server call and no log, because it carries only what the viewer already sees. Cut is a copy followed by clearing the editable cells.
- **D-19:** Paste:
  - **Mapping:** from the active cell, by position; by header when the first pasted row matches column headers (Phase 19's header matching, 19 D-27, mirrored in the web). A "Risk number" column matches rows by number instead of by position. Rows past the end become new risks; an unknown risk number is an error. Read-only target cells are skipped and listed.
  - **Conversion:** Phase 19's value-conversion module, extended as 19 D-29 anticipates: dates (dd/mm/yyyy, d/m/yyyy and ISO); scale labels in any case and, for likelihood and consequence, the scores 1 to 5; rating labels; people by a display name unique among eligible people (the hardened search, each search logged, G-17); and control numbers into the mitigation-controls column as added planned controls, never removing any. Strapi holds the authoritative converters for import; the web mirror for the preview is parity-tested.
  - **Preview:** every change (cell, old value, new value) and every error per cell, before anything applies. "Apply" is offered only when nothing is in error; otherwise the analyst chooses "Apply the {k} valid changes" explicitly, or cancels. Nothing applies partially without saying so. A pasted rating that differs from the derived one asks for an override reason in the preview (D-22).
  - Applied pastes join the unsaved change set (D-12) and save with it, and Strapi validates them as any edit.

### Scales and the derived rating (ASSESS-18; decision 8)

- **D-20:** Closed scales (UAT-008):
  - Every write path (single update and create, bulk, import) accepts exactly the canonical labels of Phase 12's `apps/backend/src/csrm/risk-scale.ts` (its D-10) for the four likelihood and consequence fields, and refuses anything else with `SCALE_VALUE_INVALID`. Other spellings, case and scores convert only in paste and import (D-19, D-23).
  - The analyst read publishes the scale in use (labels, scores, bands and descriptions). The web derives and labels with it, never with a hard-coded copy, so Phase 22's configuration reaches the table with no web change; a parity test proves the web derivation equals the server's on the published scale.
  - `risk-scale.ts` gains decision 8's default descriptions (each likelihood level, and each consequence level across financial, operational, regulatory and legal, reputational, privacy and safety impact), shown in the matrix picker and the import template's Notes sheet. Phase 22 makes them Admin-editable behind the same functions (17.1 D-58).
- **D-21:** The recorded rule for existing free text:
  - No stored value is rewritten, so `apps/backend/database/migrations/` stays empty.
  - One function in `risk-scale.ts` reads a stored value as its scale label when it equals one after trimming and case-folding. Anything else is "not on the scale" and shows verbatim with a marker. Every reader uses that function: the table, submission readiness, exports and Phase 21's heat map.
  - An unreleased risk with a value off the scale, or with a stored rating that differs from the derived one and has no override reason, is outstanding in submission readiness ("Ratings follow the scale"; 17.1 D-19), with "Use {rating}" and the matrix picker as its fixes.
  - Released risks keep their stored values (decision 9) and show them as recorded.
- **D-22:** The derived rating and its override:
  - The server writes each rating as the band of the likelihood score times the consequence score whenever both are on the scale. Without both there is no rating to write (`RATING_SCALE_VALUES_REQUIRED`), and the cell reads "Set likelihood and consequence".
  - **An override** sets a different rating with a reason (1 to 500 characters, Phase 16's reason parser) in the same write, stored as that rating's override reason (D-01). A differing rating without a reason is refused (`RATING_OVERRIDE_REASON_REQUIRED`). Setting the derived rating, or clearing the reason, removes the override.
  - **A change of inputs:** changing a rating's likelihood or consequence clears its override and re-derives it, because the reason explained the old inputs. The response and the history say so, the save's Undo restores it, and the analyst sets it again if it still holds. The edit carries the rating and its reason as bases, so it never clears an override its author did not see (D-14). Accepting an AI residual reassessment unit (17 D-49) follows the same rule.
  - **Who sees it:** the override reason shows beside its rating to analysts and participants (17.1 D-47: "everything a decision rests on"), and in the released record, its export and its report.
  - **The overall rating** stays the analyst's conclusion, with Phase 16 D-15's hint; there is no assessment-level override in this phase.

  **Reversibility:** costly - stored ratings and reasons follow the rule from deployment on.

### Import and export (ASSESS-19; UAT-050)

- **D-23:** Import, for human Security Analysts only, from the table's toolbar, as Phase 19's five-step flow on its own route under Risks:
  - **Two tables:**
    - **Risks**, matched by risk number: a blank number creates; an unknown number, a withdrawn risk or another assessment's risk is a row error.
    - **Mitigation controls**, matched by risk number and control number: a row creates or updates that control's implementation on that risk, and never removes one.

    The analyst chooses the table. An XLSX file is read from the sheet named for it, or else its first sheet (Phase 14's reader, extended to read a named sheet).
  - **Machinery:** Phase 19's reader, encoding refusals, header matching, value conversion with D-19's converters, clear token, mark stripping, templates with a Notes sheet (the allowed scale values with their descriptions), error reports and bounds (19 D-26 to D-33), plus the 1,000-risk cap.
  - **Preview:** retained by Strapi and bound to the actor (the Phase 6 and 19 preview records), classifying each row as create, update, unchanged or rejected, with each update's field changes from old to new.
  - **Commit:** the valid rows, all together, through D-13's bulk core in one transaction, with the source `import` and one `batchId`, logged through the security event log (19 D-18). The confirm step states how many rows apply and that the rejected ones will not. If any target risk changed after the preview, the commit is refused (`RISK_IMPORT_DRIFTED`) and the analyst previews again.
  - **The guard:** an import is refused, like a save, while editing is paused or once the assessment is released.
- **D-24:** Export:
  - The table's Export (X-30) writes the current view (visible columns in order, filters, sort and search) to CSV or XLSX through Phase 19's export module unchanged. Strapi parses the view definition with D-09's parser and applies D-08's semantics, and keeps the cap, the neutraliser, typed cells, the About sheet (naming the saved view and the filters in words), the file name (`{assessment number}-risks-{local date}`) and the log line (19 D-07 to D-11, D-17, D-18).
  - Analysts export at any stage (19 D-15); withdrawn risks appear only under the Withdrawn filter (Phase 16 seam S-8).
  - Participants export only the released record, through Phase 19's released-assessment export as Phases 17 and 17.1 widened it (17 D-29). Before release they copy (D-18).

### Grants

- **D-25:** Every new operation is an API-only Function in both catalogue copies, granted to `role.security_analyst` only and listed in `HUMAN_ANALYST_ONLY_OPERATIONS`; the export is also in Phase 19's `SERVICE_IDENTITY_REFUSED_OPERATIONS` and requires its underlying read (19 D-13). The record rules: the analyst's assessment scope; every risk resolved to the path's assessment; the one guard for every write; view changes by their owner only. Editing stays non-exclusive (decision 10), and the analyst who raised the request may edit (17.1 D-57: every edit withdraws the review). The read-only table needs no new grant: it reads through the existing analyst and participant reads.

### Phones, performance and the premium bar

- **D-26:** Phones (ASSESS-15 criterion 3; UAT-039): below 768px the Risks route and the participant page show a stacked card list with the key fields (number, statement, residual rating badge, owner, treatment status), search, filters and sort in a sheet, the saved-view choice, Export, and for analysts Import. A card opens the detail sheet, where an analyst edits one risk with the card's form. There is no grid editing, range selection, fill or paste on phones.
- **D-27:** Performance and the route budget (ASSESS-15 criterion 4; SC5):
  - **One read:** the analyst detail projects each risk's mitigation-control summary from the controls it already loads (`loadAnalystAssessmentRiskDetails` populates them). That ends today's per-risk control-implementation reads on the page, and the table no longer needs the whole control library.
  - **Client cost:** rows and cells are memoised; editors, the detail sheet, the paste preview, the column chooser and the views menu load on demand with `next/dynamic` from a Client Component; client modules stay zod-free (08-13).
  - **Budget:** the Risks route joins `performance.spec.ts` with the 300,000-byte budget, and the Overview route stays within its own. An exception needs a recorded reason.
  - **"Without visible lag"** is a measured threshold that research defines (for example, the interaction latency of a cell commit, and long frames while scrolling, in Playwright at 1440px with 150 risks), asserted by a phase spec.
- **D-28:** Every value comes from `docs/design/csrm-design-direction.md`.
  - **Reused extensions:** X-1, X-2, X-3, X-4, X-10, X-11, X-12, X-13, X-14, X-27, X-28, X-29 and X-30, X-19 and X-32 for the import's states, Phase 17.1's markers, and the one status mapping for every state label (G-13).
  - **New extensions,** numbered from the first free X-n the orchestrator gives: at least the editable grid and its cell states (active, editing, changed, error, conflict, read-only, range); the unsaved-changes bar; the paste preview; conflict resolution; the matrix picker with the derived rating and override; the record's local navigation; the views menu; and the table without pagination.
  - **The G-4 bar:**
    - a keyboard path for every action;
    - Undo for a save, a withdrawal and a view deletion (toasts), and for edits, fills and pastes (the undo stack);
    - no confirmation dialog, because nothing here is irreversible or governance-significant; the import keeps its confirm step;
    - skeletons that mirror the columns and density;
    - empty states that say what to do next ("Add a row, paste from Excel or import a file"; "No risks match these filters");
    - comfortable (44px) and compact (36px) density;
    - motion from the direction, honouring reduced motion;
    - cards and sheets on phones;
    - every figure opens its records (the Overview's risk figures open the filtered table).

### Verification and plan shape

- **D-29:** How the phase is proved:
  - **Strapi unit:** the scale reading and the derivation over all 25 cells; the override rules; compare-and-set; the all-or-nothing bulk core; the view-definition parser; the filter-and-sort module; the converters (dates, scales, people, controls); the import classification.
  - **Strapi integration** (`apps/backend/tests/*.integration.test.ts`, node:test):
    - every grant and refusal in `<authorisation>`;
    - history rows with their source and batch id, in the batch's transaction;
    - a review withdrawn by a bulk save;
    - a bulk save refused while a round is open;
    - at resubmission, a void for a risk the table changed and none for an untouched one (17.1 D-38);
    - legacy free text read, and refused on write;
    - the import's preview, commit and drift;
    - the export's scope, columns and file;
    - saved-view ownership and sharing.
  - **Web unit (Vitest):** the keyboard model, range selection and fill; the change set with undo and redo; the clipboard formats; paste mapping, conversion parity and preview; conflict resolution; both modes; the column chooser and views; every refusal state.
  - **Playwright** (`apps/csrm/e2e/`), at 1440px and 375px, each journey on its own records, leaving the tree clean (Phase 8 D-12, G-6):
    - **SC1:** by keyboard alone, on ten UAT-C-like risks, with one save request and a bounded keystroke count that the UI-SPEC sets as the proxy for "under a minute";
    - **SC2:** copy (the clipboard formats), and a 3 × 4 Excel-shaped paste with its preview;
    - **SC3:** an invalid cell held for a choice, and two analysts (Bob and Phase 13's second analyst persona, its D-31) on one risk;
    - **SC4:** the released and participant tables read-only but copyable, an unrelated Requestor refused, and the CSV and XLSX round trip;
    - **SC5:** 150 risks within the lag threshold, and the phone card list, with UAT-039's questionnaire half at 375px.

    The 150-risk fixture is created through this phase's own import or bulk operation, never a shared seed.
  - **Existing specs:** Phase 18 adds no slice to `apps/csrm/e2e/risk-owner-journey.spec.ts`, but updates its analyst steps that move to the Risks route and the detail sheet, so the journey stays green. Every other spec that changes deliberately (`assessment-release-workflow.spec.ts`, the Phase 12, 16, 17, 17.1 and 17.2 specs that drive risk cards, `performance.spec.ts`, and fixtures that write a rating without scale values) is named in the plan that changes it.
  - **Manual checks** are the pilot's: a screen-reader pass (D-04), and a paste into and out of desktop Excel.
- **D-30:** Plan shape:
  - **Serialised by shared files,** one owner per file per wave:
    - the specification and the generated client;
    - both catalogue copies and `served-operations.json`;
    - the matrix, and the parity and chain guards;
    - the Strapi hot files: `assessment-workflow.ts` and its guard, `assessment-scope.ts`, the assessment and risk controllers and routes, `risk-workflow.ts`, `control-implementation-workflow.ts`, `risk-scale.ts`, the risk history writer, `conflict-reasons.ts`, `csrm-authorization.ts`, and Phase 19's spreadsheet and export modules;
    - the web hot files: `data-table.tsx`, `assessment-schema.ts`, `assessment-service.ts`, `assessment-actions.ts`, `assessment-editor.tsx`, `risk-editor.tsx`, `released-assessment.tsx`, the participant page, and `status-badge.tsx`.

    Dev servers are stopped for every plan that edits Strapi or runs Playwright.
  - **Wave order:**
    1. The three records and their checkpoint, with pure modules alongside (the scale reading and derivation, compare-and-set, the filter-and-sort module and the view-definition parser, the converters).
    2. The measured spike and its checkpoint.
    3. The schema.
    4. The bulk core and the single-risk rules.
    5. Import and export.
    6. Saved views.
    7. The UI: the grid; then the Overview and Risks split, with the per-risk surfaces moved into the sheet; then the read-only and phone modes and the review lists.
    8. The E2E specs and the full gate (`api:check`, typecheck, lint, web unit, Strapi, Playwright, then a clean `git status --short`) with the 375px and 1440px checks.
  - **Size:** L, at the top of the band. If the plan count exceeds L, the seam is ASSESS-19 (import and export, D-23 and D-24) against the rest; the orchestrator decides, as it did for 17.1.

### Planner's Discretion

- Operation paths, Function names, reason codes, history source names, the view definition's shape, and bounds, within the families above.
- Module placement: for example web `apps/csrm/src/features/risk-table/`; Strapi `apps/backend/src/csrm/risk-table/` for the filter-and-sort module and compare-and-set; and Phase 19's `csrm/spreadsheets/` for the converters.
- The export's method (GET with an encoded view, or POST as Phase 19's report export is).
- Whether the export's XLSX holds the mitigation controls as a second sheet, so that the round trip feeds both import tables.
- The built-in views' columns, the keymap's details, the copy, the layout and the visuals: the UI-SPEC's.
</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/NEXT-WAVE-DECISIONS.md`; none is open.

| Decision | What it settles here | Implemented by |
|---|---|---|
| #7 Risk table approach | A spike with four pass-or-fail criteria; the lean is to extend the DataTable on TanStack Table | D-04, D-27 |
| #8 Scales, matrix and appetite | The 5 × 5 vocabulary, the product-banded rating derived automatically, an override with a recorded reason, defaults the Admin can change | D-20 to D-22 |
| #6 Removing risks | No delete from the table; withdrawal through Phase 16's batch operation | D-15, D-16 |
| #1 Admin role | Scales and "shared register views" become the Admin's from Phase 22, each in one place | D-09, D-20 |
| #9 After release | The released record is read-only and keeps its stored values | D-05, D-21 |
| #10 Pick-up and assignment | Editing is not exclusive | D-25 |
| #12 Exports | The current view through Phase 19's logged, neutralised, scoped module; participants export the released record | D-24 |
| G-1 Separation of duties | Human-only operations; the requesting analyst may edit, and confirms no AI value | D-07, D-25 |
| G-3 AI data policy (by analogy) | Columns and exports disclose nothing wider than the viewer's read | D-07, D-24 |
| G-4 Premium bar | Keyboard, Undo, no lost input, skeletons, density, phone cards and sheets | D-12, D-15, D-26, D-28 |
| G-6 Housekeeping | The pilot approves each record; Playwright leaves the tree clean | `<contract_gaps>`, D-29 |
| G-11 Nominated risk owners | Named owners and approvers are refused analyst edits through the guard; bulk naming uses the same eligibility | D-05, D-13 |
| G-12 Who reads the assessment | Participants read and copy only their projection | D-05, D-07, D-18 |
| G-13 Rounds, release and close | Bulk edits and imports honour the acceptance-round lock; state labels go through one mapping | D-05, D-13, D-23, D-28 |
| G-14 Accept or Treat | Treatment fields shown as the analyst's recommendation before release; exception fields not offered | D-07 |
| G-15 Contest and rework | A risk the table changed has its decision voided at resubmission by fingerprint; untouched risks keep theirs | D-12, D-13, D-29 |
| G-16 Treatment tracking | No due state from any date in the table | D-07 |
| G-17 People search | People convert through the hardened search, each search logged | D-11, D-19 |
| G-18 Notifications | None for bulk edits | `<domain>` |

**Conflicts:** none between the ROADMAP entry and these decisions. Two readings are recorded rather than conflicts:
- Decision 7's lean names TanStack Virtual, but the direction virtualises only "past ~1,000 client rows" and an assessment holds at most 1,000 risks, so Virtual is added only if the measurement needs it (D-04).
- The ROADMAP's contract line does not name a schema change for the rating override. Decision 8's "recorded reason" needs a current fact a gate can read, which is two attributes through a contract-gap record (D-01, D-22).
</operator_decisions>

<contract_gaps>
## Contract-Gap Records and Their Approval Checkpoint

Each record follows the format of `docs/contract-gaps/phase-06.1-revert-audit-facts.md`, `phase-06.8-questionnaire-governance-facts.md` and the Phase 12, 16, 17 and 17.1 records: Gap, Approved Compatibility Extension, Write Discipline, What This Extension Does Not Add, Audit Semantics and Limitation, and Migration.

1. **`docs/contract-gaps/phase-18-risk-scales-and-rating-override.md`**
   - **The gap:** the JDL stores likelihood and consequence as unconstrained strings (UAT-008), and has no fact for an overridden rating.
   - **The extension:** the two override-reason attributes on `CsrmRisk` (D-01).
   - **The API rules:** the closed vocabularies on the existing string fields (D-20), the derivation, the override and its clearing (D-22).
   - **The recorded rule for existing free text** (D-21).
   - **Write discipline:** the reasons are written only through the risk create, update, bulk and import paths, by the one parser; the AI never writes an override (Phase 12 D-10).
   - **Not added:** a stored vocabulary change, a schema change for likelihood or consequence, an assessment-level override, a data migration.
   - **Dated amendments, summarised:** `phase-17-participant-read.md` and the 17.1 acceptance record. The override reasons join the participant projection, so 17.1's decision fingerprint takes a new version, which never voids a decision on its own (17.1 D-37).
2. **`docs/contract-gaps/phase-18-saved-views.md`**
   - **The extension:** `CsrmSavedView` (D-01, D-09): its owner, visibility and view-key vocabulary, and how Phase 20 extends the vocabulary.
   - **The definition envelope** and its fail-safe parser.
   - **Grants:** human analysts only, with changes by the owner only.
   - **Retention:** an owner deletes their own view; a view is configuration, not an audit record.
   - **Phase 22's seam** for who may share.
3. **`docs/contract-gaps/phase-18-bulk-risk-changes-and-import.md`** (no schema change)
   - **The bulk change contract** (D-13, D-14): per-cell compare-and-set, all or nothing, bounds, the guard and the transition, and the single PATCH's optional bases.
   - **The import family** for an assessment's two tables (D-23): keys, preview records, drift, and the commit through the bulk core.
   - **The export view** (D-24).
   - **Dated amendments, summarised:**
     - `phase-16-risk-withdrawal-and-history.md`: the sources `table` and `import`, the `batchId`, and the override-reason fields in the change list;
     - `phase-19-import-tolerance.md`: the risk-row and mitigation-control import, and the named-sheet read;
     - `phase-19-exports-and-export-log.md`: the risk-table view.

**Approval checkpoint:** the first plan writes the three records, then a `checkpoint:decision` task at which the executor stops. Under G-6 the pilot reviews and approves each record, recording the approval in the record itself. Each record's schema, catalogue and specification work runs only after its own approval.

The changes are additive: Strapi's schema sync creates the columns and the table, and `apps/backend/database/migrations/` stays empty (the 06.1, 06.8, 12, 16, 17 and 17.1 precedent). The proof boots a fresh test database; existing risks read with null reasons, and their free text reads under D-21. The operator's development database shows the changes after the orchestrator's next Strapi start, and the content-type freeze check lists exactly `csrm-risk/schema.json` and the new saved-view type.
</contract_gaps>

<authorisation>
## Authorisation Model and Negative Cases

Keycloak authenticates. Strapi enforces Role → Function → FunctionAPI, then the record rule, against the resolved IdamBox User in `ctx.state`, identically for the development identity bridge and a Keycloak-verified user, never branching on the auth mode (POST-DEMO-BRIEF §2). Navigation visibility is not authorisation: every control the UI hides, Strapi also refuses.

**Positive cases:**
- Any human Security Analyst on an assessment the guard allows saves batches, pastes, fills, imports, and adds and withdraws rows.
- Any human analyst exports the current view at any stage, and creates, shares and deletes their own views.
- Every participant reads and copies their projection in the read-only table at every stage they may read.

**Negative cases** (each proven in the API by a Strapi integration test or a matrix row, and in the UI by Vitest or Playwright):

| Case | API outcome | UI outcome |
|---|---|---|
| An unrelated Requestor (Maya) at any Phase 18 operation | 403 from the grant, which discloses nothing; the assessment reads 404 (17 D-24); persistence unchanged | The not-found page; no table |
| The request's Requestor, a risk owner or an executive approver at a bulk save, import, table export or saved view | 403 | A read-only table: no edit, paste, fill, import, save or views; copy works |
| The service identity at every Phase 18 operation | 403 (human-only; `SERVICE_IDENTITY_REFUSED_OPERATIONS` for the export) | Not applicable |
| Any analyst saving or importing on a released assessment | 409 `ASSESSMENT_NOT_MUTABLE` | Read-only; copy and export work |
| Any analyst while a response or acceptance round is open | 409 `RESPONSE_ROUND_OPEN` or `ACCEPTANCE_ROUND_OPEN` (17 D-43, 17.1 D-23) | "Editing is paused" banner; copy and export work |
| An analyst named as a risk owner or executive approver on that assessment | 409 `ACTOR_IS_RISK_OWNER` or `ACTOR_IS_EXECUTIVE_APPROVER` | Read-only, with the reason |
| A batch that touches a withdrawn risk | 409 `RISK_WITHDRAWN`; nothing applies | Withdrawn rows read-only, under the filter only |
| A batch naming a risk of another assessment | 404 for the whole batch; persistence deep-equal | Not reachable from the table |
| A stale cell | 409 `RISK_CHANGES_CONFLICT` with every conflicting cell; nothing applies | Each conflict in its cell, with "Keep mine" and "Take theirs" |
| Invalid cells: off the scale, a bad date, an empty statement, an ineligible owner or the assigned analyst as owner (17 D-17), an executive approver not eligible or not needed (17.1 D-16, D-17), the exception fields (17.1 D-44), a rating without scale values, an override without a reason | 400 or 409 with every invalid cell and its closed reason; nothing applies | Each error in its cell and the row status |
| An import commit after a target risk changed, over the 1,000-risk cap, or by anyone but the previewing analyst | 409 `RISK_IMPORT_DRIFTED` or `ASSESSMENT_RISK_LIMIT`, or the preview record's refusal | Preview again, with the reason |
| Another analyst's personal view; changing or deleting a view one does not own | 404 (no enumeration); 403 `NOT_VIEW_OWNER` on a shared view | Not listed; a shared view offers "Save as" only |
| "Confirm AI values" by the analyst who raised the request | Phase 12's and 16's G-1 refusal | Not offered |
| Deleting a persisted risk, by any route | No route serves it (Phase 16 D-16's proof stands) | No delete action |
| No identity, or no token | The matrix conventions | The sign-in path |
</authorisation>

<seams>
## Cross-Phase Seams

- **Phase 10** (executes first): closed reasons and refusal copy (its D-22); the navigation guard (D-12); the record picker (D-28) and save status (D-33); the readiness summary that links into the table (D-35); the in-place question form for UAT-039's other half (D-04); X-1 to X-5.
- **Phase 11** (executes first): the column chooser it deferred (its D-33, D-10 here); the one status mapping (the G-13 seam); the DataTable, density and lists; X-6 to X-10.
- **Phase 12** (executes first): `risk-scale.ts` (its D-10), enforced here and published to the web (D-20); per-cell AI markers and "Confirm AI values" through its decision operation (its D-21, D-24; D-07); its UI-D28 left the derived rating to this phase.
- **Phase 13** (executes first): the second analyst persona for the conflict proof (its D-31); the assignee column offered by the chooser (D-10).
- **Phase 14** (executes first): the XLSX reader (`csrm/spreadsheets/xlsx-reader.ts`, `read-excel-file`), extended to read a named sheet; the file-transfer helpers for templates, error reports and exports; the security event log.
- **Phase 16** (executes first): the guard and the transition (its D-22, D-23); the inner create and update functions; the withdrawn guard; batch withdrawal and reinstatement (D-09, D-10); the risk history with its reserved `batchId`, amended here (its S-9); the active-risk rule; X-27 to X-29.
- **Phase 17** (executes first): the response-round lock and the owner rules in the guard (its D-18, D-43); eligibility and owner history with a batch source (D-16, D-17, D-19); the participant projection the read-only table shows (D-25, D-26); its seam ("response-sourced control implementations shown like any other").
- **Phase 17.1** (executes first): the acceptance-round lock (its D-23); review withdrawal by bulk edits (D-07); executive approver eligibility and clearing (D-15 to D-17); voids at resubmission by fingerprint, so the table needs no special handling (D-37, D-38); the "will stand or be voided" flag (D-40); the recommendation labelling (D-20, D-43); the exception fields (D-44); its fingerprint takes a new version for the override reasons (D-37).
- **Phase 17.2** (executes first): edits between rounds honour the lock; the table may show contest markers; there are no bulk contest acts (its seam).
- **Phase 19** (executes first): the export module, the column-choice primitive (X-30), the reader, header matching, value conversion extended here (its D-29), templates, error reports, the cap, the neutraliser and the log (D-05 to D-33); the released-record export for participants (D-14, as 17 and 17.1 widened it); the analyst's unreleased export arrives here (D-15).
- **Phase 19.1:** no notification for bulk edits (its seam).
- **Phase 20:** the register's column choice and saved views through `CsrmSavedView`'s view-key vocabulary (RISK-03); the due state, never in this table (G-16); post-release changes stay with the register, since the released table is read-only.
- **Phase 21:** the heat map reads D-21's scale function; overrides can be counted from the stored reasons; withdrawn risks excluded (Phase 16 D-14).
- **Phase 22:** scales, bands and descriptions become Admin settings behind `risk-scale.ts` (D-20, 17.1 D-58); who may share a view may move to the Admin (decision 1); the Admin holds no analyst grant, so it never edits the table.
- **The post-demo journey** (`apps/csrm/e2e/risk-owner-journey.spec.ts`): no slice here; its analyst steps move to the Risks route and the detail sheet, and it stays green (D-29).
</seams>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/uat/product-gaps/FINDINGS.md`: UAT-008, UAT-039, UAT-050, UAT-055, UAT-056, UAT-057 and UAT-063 in full; UAT-011, UAT-027, UAT-032, UAT-035 and UAT-049 for the neighbouring phases' parts.
- `.planning/uat/product-gaps/REPORT.md`: §6 (import and export requirements), §7 (the risk table: the default columns, editing, keyboard, copying, pasting, rows, files, constraints and candidate grids), §8 (the Phase 18 proposal) and §9 (decisions 7 and 8).
- `.planning/uat/product-gaps/JOURNEYS.md`: area 7 (the ten-risk update, and the copy and paste captures), area 11 (keyboard only) and area 3 (phone).
- `.planning/uat/product-gaps/BRIEF.md` Appendix A: Q4, Q3 and F7.

### Planning authority
- `.planning/ROADMAP.md`: Phase 18 (goal, five success criteria, contract line, the review lists' adoption), and the Phase 17.1, 17.2, 19, 20, 21 and 22 entries for the seams.
- `.planning/REQUIREMENTS.md`: ASSESS-15 to ASSESS-19; ASSESS-20, ASSESS-22 and ASSESS-24 (the read, the lock and the voids); CSV-01 and CSV-02; UX-09; RISK-03; ADMIN-07.
- `.planning/NEXT-WAVE-DECISIONS.md`: decision notes 7 and 8; decisions 1, 6, 9, 10 and 12; G-1, G-3, G-4 and G-6; G-11 to G-18.
- `.planning/POST-DEMO-BRIEF.md` §1 and §2; `.planning/STATE.md` Decisions (the planning method, the extension numbering, "mitigation control" as the display term).
- `.planning/phases/16-risk-curation-and-targeted-ai-re-runs/16-CONTEXT.md` (D-07 to D-11, D-13 to D-23, D-45, D-48, seams S-8 and S-9, and its Orchestrator Confirmations), `16-RESEARCH.md` (the guard and inner functions, the history entity with `sourceKind` and `batchId`) and `16-UI-SPEC.md` (X-27 to X-29).
- `.planning/phases/19-csv-export-and-import-hardening/19-CONTEXT.md` (D-03, D-05 to D-19, D-25 to D-33, D-36, and its Orchestrator Confirmations), `19-RESEARCH.md`, `19-PATTERNS.md` (the `csrm/spreadsheets/`, `csrm/exports/` and `csrm/audit/` modules) and `19-UI-SPEC.md` (X-30 to X-32; `components/csrm/export/column-choice.tsx`).
- `.planning/phases/17.1-review-peer-approval-and-risk-acceptance/17.1-CONTEXT.md` (D-06, D-07, D-15 to D-20, D-23, D-33, D-37 to D-40, D-43, D-44, D-47, D-48, D-57, D-58, and its Phase 18 seam).
- `.planning/phases/17-mitigation-response-and-residual-reassessment/17-CONTEXT.md` (D-16 to D-19, D-23 to D-26, D-29, D-43, D-49, D-52, D-55, D-75, and its Phase 18 seam); `.planning/phases/17.2-contest-points-and-rework-rounds/17.2-CONTEXT.md` (its Phase 18 seam).
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-CONTEXT.md` (D-10, D-21, D-24, and both Orchestrator Confirmations), `12-UI-SPEC.md` (X-11, X-12, UI-D28) and plan `12-02-PLAN.md` (`risk-scale.ts`'s exports).
- `.planning/phases/11-navigation-landing-and-list-clarity/11-CONTEXT.md` (D-29 to D-33) and `11-UI-SPEC.md` ("No list gains a column chooser").
- `.planning/phases/10-existing-flow-gap-closure/10-CONTEXT.md` (D-04, D-12, D-22, D-28, D-33 to D-35) and `10-UI-SPEC.md` (X-1 to X-5).
- `.planning/phases/13-request-pick-up-and-notes/13-CONTEXT.md` (D-31 and its Phase 18 note); `.planning/phases/14-request-attachments/14-CONTEXT.md` (D-24, D-37, and its shared modules); `.planning/phases/19.1-in-app-notification-centre/19.1-CONTEXT.md` (its Phase 18 seam).

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md`: §8 (risk content), §9 (make duplicate or ambiguous matches visible), §12 (phone layouts), §20 (record gaps rather than competing models) and §21 (keyboard operability).
- `docs/references/idambox-datamodel.jdl`: `CsrmRisk` (the likelihood, consequence, rating and rationale strings; the treatment and exception fields), `CsrmControlImplementation`, `CsrmTreatmentAction`, `CsrmTreatmentStatus`.
- `CONTEXT.md` (repository root): Withdrawn, Risk owner, Executive approver, Accept and Treat, Confirm (AI proposal), Released, Released for response.

### Contract, authorisation and records
- `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`, `phase-19-import-tolerance.md` and `phase-19-exports-and-export-log.md` (each amended here, once written); `phase-06-administration-import-contract.md` (preview records); `phase-17-participant-read.md` and the 17.1 acceptance record (the projection and the fingerprint); `phase-12-ai-run-record-and-provenance.md`; `phase-06.1-revert-audit-facts.md` and `phase-06.8-questionnaire-governance-facts.md` (format).
- `docs/references/specification.json`: `AnalystAssessmentDetail`, `AnalystRiskDetail`, `RequestorReleasedAssessmentDetail` and the participant projection; `assessment-workflow/update-risk`, `assessment-workflow/create-assessment-risk` and `assessment-workflow/get-risk-assessment`; `AssessmentWorkflowErrorResponse`; the import schemas.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` (byte-identical); `docs/references/served-operations.json`.
- `apps/backend/src/policies/csrm-authorization.ts`, `apps/backend/tests/fixtures/authorization-matrix.ts`, `apps/backend/tests/contract-catalogue.integration.test.ts`, `apps/csrm/src/features/contract-response-parity.test.ts` and `apps/csrm/src/features/contract-operation-chain.test.ts`.
- `docs/security/phase-08-residual-risks.md`: R-08-34 (route budgets) and R-08-36 (process-local preview records).

### Design and framework
- `docs/design/csrm-design-direction.md` and `docs/adr/0001-adopt-bproton-design-system.md`: §4 DataTable (row heights, density, the sticky identifier column, selection and the bulk-action bar, the row detail sheet, "Virtualize past ~1,000 client rows", pagination), Forms, Dialogs, Toasts, Skeletons, Empty states, Record links and Print; §5 Motion; §6 Do-not list.
- `apps/csrm/node_modules/next/dist/docs/01-app/02-guides/server-actions.md` (sequential dispatch; the body limit) and `01-app/02-guides/lazy-loading.md` (`next/dynamic` from Client Components).

### External
- WAI-ARIA Authoring Practices, the grid pattern (data grid with editing); WCAG 2.2 AA: 2.1.1, 2.4.1 (bypass blocks), 2.4.3, 2.4.7, 2.5.8 and 4.1.3 (status messages).
- The Clipboard API and the `copy` and `paste` events (`text/plain` and `text/html`).
- ISO/IEC 27005:2022 and ISO 31000 (risk criteria and analysis on the organisation's scales).
- TanStack Table v9 and TanStack Virtual, and react-data-grid: their licences and versions, checked at research time.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/csrm/src/components/csrm/data-table.tsx`: the DataTable on `@tanstack/react-table` 9.2.4 (`useTable`, `tableFeatures`), with manual sorting, filtering and pagination, filter chips, density persisted per user in local storage, a sticky identifier column while it overflows, and mobile cards. Its `<table>` semantics become a grid in editable and read-only modes.
- `apps/csrm/src/features/assessments/risk-editor.tsx` and `control-implementation-editor.tsx` (the card that becomes the detail sheet), `owner-combobox.tsx` (the picker pattern behind X-2), `released-assessment.tsx` (the released read the read-only table replaces at 768px and above), `assessment-editor.tsx` (the Overview's content).
- `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts`: `parseWritableRiskFields` and `RISK_WRITABLE_FIELDS` (the four likelihood and consequence fields are free strings today; ratings are already checked against `ASSESSMENT_RATINGS`), `withMutableAssessmentMutation` and `assertMutableAssessment` (which Phase 16 turns into `assertAssessmentEditable` with the actor).
- `apps/backend/src/api/csrm-risk/services/risk-workflow.ts`: `createAssessmentRisk` and `updateRisk` (last write wins today: no base values, no version), `resolveRelations` (the active-user check), `loadAnalystAssessmentRiskDetails` (populates `controlImplementations` with their controls, which the projection drops) and `MAX_ASSESSMENT_RISKS` (1,000).
- `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts`: `projectAnalystRiskDetail` and `RISK_DETAIL_FIELDS`, where the control summary and the override reasons join.
- Planned modules from earlier phases: Phase 12's `risk-scale.ts`; Phase 16's `assertAssessmentEditable`, inner create and update functions, the history writer (`csrm-risk-history-event`, `sourceKind`, `batchId`) and the reason parser; Phase 17's eligible-person predicate and people picker; Phase 17.1's markers, guard order and fingerprint module; Phase 19's `csrm/spreadsheets/` (`xlsx-writer.ts`, `csv-writer.ts`, `header-match.ts`, `value-convert.ts`, `neutralise.ts`, `file-sniff.ts`, `zip-guard.ts`), `csrm/exports/` (`export-cap.ts`, `labels.ts`) and `components/csrm/export/` (`column-choice.tsx`); Phase 14's `xlsx-reader.ts`, `csrm/audit/security-event-log.ts` and the web's `lib/files` helpers.

### Established Patterns
- One write path per aggregate under the assessment's serialisation, lock and guard; denials leave persistence deep-equal; an unreadable record is 404, and a policy denial is 403.
- Current fact plus append-only history (06.8, Phase 16): gates read facts, the history narrates.
- Batch operations are all or nothing, because Next 16.3 dispatches Server Actions one at a time.
- Closed parsers and closed reason codes; the server words and the web formats; zod-free `*-domain.ts` modules for client components.
- Web mirrors of server rules are parity-tested (`report-definitions.ts` against `report-copy.json`; 19 D-29's converters).

### Integration Points
- **Strapi:** the assessment and risk routes and controllers (bulk changes, import, export, the changed PATCH); a new saved-view API folder; `assessment-scope.ts` projections; `risk-scale.ts`; the history writer; `csrm-authorization.ts`; both catalogue copies.
- **Web:** `apps/csrm/app/(app)/app/review/assessments/[documentId]/` (a shared layout, the Overview page and the new `risks/` and `risks/import/` routes), `apps/csrm/app/(app)/app/assessments/[documentId]/page.tsx` (the participant page), the three review lists, the Risk Register's `risk-detail-editor.tsx` (bases and the scale pickers), `assessment-schema.ts`, `assessment-service.ts` and `assessment-actions.ts`.
- **Today's page cost:** the analyst page reads every risk's control implementations in a separate call, and loads the whole control library (`apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx`). D-27 removes both from the table's path.
- **A pitfall for research:** `createWithRiskNumber` retries on a unique conflict. Inside one bulk or import transaction on PostgreSQL, a failed statement aborts the transaction, so research checks that risk-number allocation for many creates stays safe (pre-checked numbers, or savepoints).
</code_context>

<specifics>
## Specific Ideas

- **UAT-C's ten risks (SC1).** Today, setting treatment owner, target date and status on ten risks took 60 clicks, 110 keystrokes, about 36,800px of scrolling and ten saves. In the table, Bob selects the Treatment owner cells of the ten rows, picks the person once and fills them with Ctrl+Enter, does the same for the target date (typed `30/11/2026`) and the status, and presses Save changes: one request, one batch in the history.
- **UAT-057's range (SC2).** Risk statement, inherent rating, residual rating and treatment owner, three rows by four columns, as Excel copies them (tab-separated text plus an HTML table). The preview converts "high" to High, matches it against each risk's derived rating or asks for an override reason, finds the owner by name, and adds the rows past the end as new risks.
- **UAT-056's copy.** The same ten rows copied out paste into Excel as ten rows and the visible columns, with names, dates and labels, never ids.
- **A legacy value.** A seeded residual consequence of "Low" is not on the consequence scale; it shows verbatim with the marker and blocks submission readiness until the analyst picks a level.
- **Two analysts (SC3).** Bob and Phase 13's second analyst open the same risk. Both change the residual likelihood; the second save gets a conflict naming who changed it and when, and "Keep mine" saves knowingly. A change to a different field of the same risk saves without conflict.
- **Development database.** The schema changes and the grants reach the operator's development database only when the orchestrator restarts Strapi; tests use their own databases. Existing risks keep their stored values.
</specifics>

<deferred>
## Deferred Ideas

- **The Risk Register's column choice and saved views** ("Project" and "BAU"): Phase 20, on `CsrmSavedView` (RISK-03).
- **Admin-owned shared views and configurable scales, bands and descriptions:** Phase 22 (decision 1, ADMIN-07).
- **Saved views for participants**, and server-side views for the review lists: not asked.
- **Autosave**, **live co-editing or presence**, **formulas**, and **group-by or pivots** in the table: not asked.
- **An assessment-level override of the overall rating:** Phase 16 D-15's hint stands.
- **A "Files" column and attachments on risks or control implementations:** 14-CONTEXT's later work.
- **A portfolio import across assessments, and request import:** `REPORT.md` §6 item 9 keeps request intake form-based.
- **Importing people by email:** names only, as exports write them (19 D-07).
- **Bulk decisions and bulk contest acts:** not in G-14 or G-15.
</deferred>

## Seeds Confirmed or Corrected

- **ASSESS-15 to ASSESS-19; closes UAT-008, UAT-039, UAT-050, UAT-055, UAT-056, UAT-057 and UAT-063:** confirmed. **Precision:** UAT-039's questionnaire half is Phase 10 D-04's in-place form; this phase delivers the assessment half and re-checks both at 375px.
- **Decision 7, a spike with pass-or-fail criteria leaning to the DataTable on TanStack Table:** confirmed (D-04). **Corrected against the code:** TanStack Table 9.2.4 is already a web dependency, so the table adds none. TanStack Virtual is added only if the measurement needs it, because the direction virtualises past about 1,000 rows and an assessment caps at 1,000 risks.
- **Decision 8, the 5 × 5 scales, the product-banded rating and an override with a reason, in one configuration point Phase 22 takes over:** confirmed (D-20 to D-22) in Phase 12's `risk-scale.ts`. **Added:** the reason needs two risk attributes (a record, D-01); a change of inputs clears the override; the web derives with the scale the server publishes.
- **Decision 6, no hard delete, with bulk withdrawal through Phase 16's batch operation:** confirmed (D-16), at up to 200 risks per call.
- **Saved views personal by default and shareable with analysts:** confirmed (D-09), as a server-side entity; participants have none.
- **The contract:** bulk update and create with exact grants (confirmed, with per-cell compare-and-set, D-13 and D-14); closed vocabularies on the existing string fields (confirmed, with the recorded rule for free text, D-21); the risk change history as Phase 16's, by an amending record (confirmed: sources `table` and `import` on its reserved `batchId`); server-side saved views behind a record and its checkpoint (confirmed); any grid dependency justified by the spike (confirmed).
- **The seams:**
  - ASSESS-24 is confirmed: bulk edits pass 17.1 D-23's guard, and voids happen at resubmission by fingerprint (17.1 D-38), so the table needs no void logic of its own and shows 17.1 D-40's flag.
  - Phase 19's modules and Phase 14's reader are confirmed, extended for dates, scales, people, controls and named sheets.
  - The conflict rule is confirmed, and extended to the single-risk PATCH so that no form overwrites silently.
  - Released and Requestor views read-only but copyable: confirmed, for every participant.
  - 150 risks: confirmed, with today's per-risk control reads removed.
  - Phones: confirmed.
- **Added from the ROADMAP's contract line:** the review lists adopt the column chooser (D-10).

---

*Phase: 18-risk-table-and-spreadsheet-interoperability*
*Context gathered: 2026-10-01*
