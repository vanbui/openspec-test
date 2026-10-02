---
phase: 10
review: 10-REVIEW.md
titles: json
findings:
  - id: CR-101
    severity: critical
    disposition: open
    title: "A questionnaire replacement is not serialised with governance mutations, so governance events can be lost and D-09 does not hold"
  - id: CR-201
    severity: critical
    disposition: open
    title: "Mitigation-control saves compare against values from page load, so a reverted field is never saved"
  - id: CR-401
    severity: critical
    disposition: open
    title: "UX06_JOB_STATUS_ON_RETURN can never fail on the regression it names"
  - id: WR-101
    severity: warning
    disposition: open
    title: "The seed reconciliation does not keep an operator's cleared description, or operator edits to the other control fields"
  - id: WR-102
    severity: warning
    disposition: open
    title: "A replacement refused by the governance log fails with a generic code, and the discard count reads 0 on a malformed log"
  - id: WR-103
    severity: warning
    disposition: open
    title: "`verify-csrm-seed-runtime.mjs` now contains a raw NUL byte and was converted to CRLF line endings"
  - id: WR-201
    severity: warning
    disposition: open
    title: "Next action reverts to a stale \"Generate the questionnaire.\" / \"Draft the assessment.\" once a job completes"
  - id: WR-202
    severity: warning
    disposition: open
    title: "Questionnaire polling can stop permanently when a refreshed seed arrives during a slow poll"
  - id: WR-203
    severity: warning
    disposition: open
    title: "A thrown generation Server Action leaves the card stuck pending, and poll rejections go unhandled"
  - id: WR-204
    severity: warning
    disposition: open
    title: "`OwnerCombobox` lets Enter submit the surrounding form when the query is empty"
  - id: WR-205
    severity: warning
    disposition: open
    title: "Assessment-draft and generation refusals still use the misleading \"changed, reload\" copy and the wrong nouns"
  - id: WR-206
    severity: warning
    disposition: open
    title: "Optional suggestion and label reads block the whole analyst editor"
  - id: WR-207
    severity: warning
    disposition: open
    title: "A failed control-library read on the Risk Type form shows every saved control as \"Control not found\""
  - id: WR-301
    severity: warning
    disposition: open
    title: "A rejected record-picker search leaves the picker stuck on \"Searching…\" with no retry"
  - id: WR-302
    severity: warning
    disposition: open
    title: "\"Retry search\" cannot be reached from the keyboard"
  - id: WR-303
    severity: warning
    disposition: open
    title: "The combobox does not expose the record already chosen"
  - id: WR-304
    severity: warning
    disposition: open
    title: "`LocalInstant` server and client output can differ, causing a hydration mismatch on every page with a time"
  - id: WR-305
    severity: warning
    disposition: open
    title: "The development role switcher bypasses the leave guard and loses or misroutes unsaved answers"
  - id: WR-306
    severity: warning
    disposition: open
    title: "A mitigation-control save that succeeded is reported as \"not changed\", and Save again creates a duplicate"
  - id: WR-307
    severity: warning
    disposition: open
    title: "A stale `openForm` lets the governance editor pull focus to \"Add question\" on later renders"
  - id: WR-308
    severity: warning
    disposition: open
    title: "Release and Return-to-review errors persist after dismissal and are announced twice"
  - id: WR-309
    severity: warning
    disposition: open
    title: "Administration list columns still force the table wide with unbounded long text"
  - id: WR-401
    severity: warning
    disposition: open
    title: "A hub unit test locks in a Next action that names a control the page no longer offers"
  - id: WR-402
    severity: warning
    disposition: open
    title: "Two attribute assertions quietly become presence checks when an id is missing"
  - id: WR-403
    severity: warning
    disposition: open
    title: "`settleElementWidth` has no loop bound, so an oscillating layout hangs until the test timeout"
  - id: WR-404
    severity: warning
    disposition: open
    title: "The new Risk detail route tests have no refused-viewer case for their new reads"
  - id: WR-405
    severity: warning
    disposition: open
    title: "An `every()` over a possibly empty list makes \"the existing Risk shows no confirmation\" vacuous"
  - id: WR-406
    severity: warning
    disposition: open
    title: "\"Each Risk row says what is missing\" checks only the first row"
  - id: IN-101
    severity: info
    disposition: open
    title: "`canRetry` means \"initiated by this viewer\", not \"may retry\""
  - id: IN-102
    severity: info
    disposition: open
    title: "The title file's strict checks can stop a seeded Strapi start, contrary to its comment"
  - id: IN-103
    severity: info
    disposition: open
    title: "The seed verifiers no longer check the catalogue list independently"
  - id: IN-104
    severity: info
    disposition: open
    title: "The control text bounds are declared in four places"
  - id: IN-105
    severity: info
    disposition: open
    title: "The D-09 race test claims more than it proves"
  - id: IN-201
    severity: info
    disposition: open
    title: "The \"released\" hint is shown for questionnaires that are not released"
  - id: IN-202
    severity: info
    disposition: open
    title: "`releaseReadinessPresentation` still builds an em-dash label that nothing reads"
  - id: IN-203
    severity: info
    disposition: open
    title: "The focus-after-transition flag can fire on a later, unrelated status change"
  - id: IN-204
    severity: info
    disposition: open
    title: "Unknown third-party involvement reads as \"No\""
  - id: IN-205
    severity: info
    disposition: open
    title: "The readiness summary groups Risks by display number instead of identity"
  - id: IN-206
    severity: info
    disposition: open
    title: "The analyst's read-only details show the raw ISO date"
  - id: IN-207
    severity: info
    disposition: open
    title: "\"Return to draft\" is offered beside \"Questionnaire generation is in progress\""
  - id: IN-301
    severity: info
    disposition: open
    title: "The picker reports `aria-expanded=\"true\"` while no listbox exists"
  - id: IN-302
    severity: info
    disposition: open
    title: "The introduction's question count can disagree with the completion card after Back or Forward"
  - id: IN-303
    severity: info
    disposition: open
    title: "The session-record comparison rule lives in a JSX module"
  - id: IN-304
    severity: info
    disposition: open
    title: "The `pagehide` and unmount flush may never reach the server"
  - id: IN-305
    severity: info
    disposition: open
    title: "The Requestor's timeline summary can render an empty list"
  - id: IN-306
    severity: info
    disposition: open
    title: "Editing a select question re-derives every choice value from its label (pre-existing, unchanged in Phase 10)"
  - id: IN-307
    severity: info
    disposition: open
    title: "The Risk Register filter combobox keeps a stale active option and can hang on a rejected search"
  - id: IN-401
    severity: info
    disposition: open
    title: "Red-phase scaffolding left in unit tests"
  - id: IN-402
    severity: info
    disposition: open
    title: "The \"leaving times labelled UTC\" assertion holds whatever the sync does"
  - id: IN-403
    severity: info
    disposition: open
    title: "A stale comment and vacuous negatives after the D-23 route gate"
  - id: IN-404
    severity: info
    disposition: open
    title: "A spied getter leaks into later tests when its assertion fails"
  - id: IN-405
    severity: info
    disposition: open
    title: "The Requestor refusal on the request route checks fewer reads than its siblings"
  - id: IN-406
    severity: info
    disposition: open
    title: "The overflow test proves only that the last option scrolls into view"
  - id: IN-407
    severity: info
    disposition: open
    title: "The picker proof depends on the server's unspecified default sort"
  - id: IN-408
    severity: info
    disposition: open
    title: "The \"unchanged save sends nothing\" listener stops at the first UI change"
  - id: IN-409
    severity: info
    disposition: open
    title: "`.first()` hides duplicate owner options"
open: 56
total: 56
recorded: 2026-10-02T19:39:25.663Z
---

# Phase 10: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-101 | critical | open | - |
| CR-201 | critical | open | - |
| CR-401 | critical | open | - |
| WR-101 | warning | open | - |
| WR-102 | warning | open | - |
| WR-103 | warning | open | - |
| WR-201 | warning | open | - |
| WR-202 | warning | open | - |
| WR-203 | warning | open | - |
| WR-204 | warning | open | - |
| WR-205 | warning | open | - |
| WR-206 | warning | open | - |
| WR-207 | warning | open | - |
| WR-301 | warning | open | - |
| WR-302 | warning | open | - |
| WR-303 | warning | open | - |
| WR-304 | warning | open | - |
| WR-305 | warning | open | - |
| WR-306 | warning | open | - |
| WR-307 | warning | open | - |
| WR-308 | warning | open | - |
| WR-309 | warning | open | - |
| WR-401 | warning | open | - |
| WR-402 | warning | open | - |
| WR-403 | warning | open | - |
| WR-404 | warning | open | - |
| WR-405 | warning | open | - |
| WR-406 | warning | open | - |
| IN-101 | info | open | - |
| IN-102 | info | open | - |
| IN-103 | info | open | - |
| IN-104 | info | open | - |
| IN-105 | info | open | - |
| IN-201 | info | open | - |
| IN-202 | info | open | - |
| IN-203 | info | open | - |
| IN-204 | info | open | - |
| IN-205 | info | open | - |
| IN-206 | info | open | - |
| IN-207 | info | open | - |
| IN-301 | info | open | - |
| IN-302 | info | open | - |
| IN-303 | info | open | - |
| IN-304 | info | open | - |
| IN-305 | info | open | - |
| IN-306 | info | open | - |
| IN-307 | info | open | - |
| IN-401 | info | open | - |
| IN-402 | info | open | - |
| IN-403 | info | open | - |
| IN-404 | info | open | - |
| IN-405 | info | open | - |
| IN-406 | info | open | - |
| IN-407 | info | open | - |
| IN-408 | info | open | - |
| IN-409 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
