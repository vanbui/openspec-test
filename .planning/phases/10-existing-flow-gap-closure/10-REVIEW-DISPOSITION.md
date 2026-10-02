---
phase: 10
review: 10-REVIEW.md
titles: json
findings:
  - id: CR-101
    severity: critical
    disposition: fixed
    title: "A questionnaire replacement is not serialised with governance mutations, so governance events can be lost and D-09 does not hold"
  - id: CR-201
    severity: critical
    disposition: fixed
    title: "Mitigation-control saves compare against values from page load, so a reverted field is never saved"
  - id: CR-401
    severity: critical
    disposition: open
    title: "UX06_JOB_STATUS_ON_RETURN can never fail on the regression it names"
  - id: WR-101
    severity: warning
    disposition: fixed
    title: "The seed reconciliation does not keep an operator's cleared description, or operator edits to the other control fields"
  - id: WR-102
    severity: warning
    disposition: fixed
    title: "A replacement refused by the governance log fails with a generic code, and the discard count reads 0 on a malformed log"
  - id: WR-103
    severity: warning
    disposition: fixed
    title: "`verify-csrm-seed-runtime.mjs` now contains a raw NUL byte and was converted to CRLF line endings"
  - id: WR-201
    severity: warning
    disposition: fixed
    title: "Next action reverts to a stale \"Generate the questionnaire.\" / \"Draft the assessment.\" once a job completes"
  - id: WR-202
    severity: warning
    disposition: fixed
    title: "Questionnaire polling can stop permanently when a refreshed seed arrives during a slow poll"
  - id: WR-203
    severity: warning
    disposition: fixed
    title: "A thrown generation Server Action leaves the card stuck pending, and poll rejections go unhandled"
  - id: WR-204
    severity: warning
    disposition: fixed
    title: "`OwnerCombobox` lets Enter submit the surrounding form when the query is empty"
  - id: WR-205
    severity: warning
    disposition: fixed
    title: "Assessment-draft and generation refusals still use the misleading \"changed, reload\" copy and the wrong nouns"
  - id: WR-206
    severity: warning
    disposition: fixed
    title: "Optional suggestion and label reads block the whole analyst editor"
  - id: WR-207
    severity: warning
    disposition: fixed
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
    disposition: fixed
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
    disposition: fixed
    title: "`canRetry` means \"initiated by this viewer\", not \"may retry\""
  - id: IN-102
    severity: info
    disposition: fixed
    title: "The title file's strict checks can stop a seeded Strapi start, contrary to its comment"
  - id: IN-103
    severity: info
    disposition: skipped
    title: "The seed verifiers no longer check the catalogue list independently"
  - id: IN-104
    severity: info
    disposition: deferred
    title: "The control text bounds are declared in four places"
  - id: IN-105
    severity: info
    disposition: fixed
    title: "The D-09 race test claims more than it proves"
  - id: IN-201
    severity: info
    disposition: fixed
    title: "The \"released\" hint is shown for questionnaires that are not released"
  - id: IN-202
    severity: info
    disposition: fixed
    title: "`releaseReadinessPresentation` still builds an em-dash label that nothing reads"
  - id: IN-203
    severity: info
    disposition: fixed
    title: "The focus-after-transition flag can fire on a later, unrelated status change"
  - id: IN-204
    severity: info
    disposition: fixed
    title: "Unknown third-party involvement reads as \"No\""
  - id: IN-205
    severity: info
    disposition: fixed
    title: "The readiness summary groups Risks by display number instead of identity"
  - id: IN-206
    severity: info
    disposition: fixed
    title: "The analyst's read-only details show the raw ISO date"
  - id: IN-207
    severity: info
    disposition: fixed
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
open: 31
total: 56
recorded: 2026-10-02T19:39:25.663Z
---

# Phase 10: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-101 | critical | fixed | e5ee253 (test), 96013ae (fix): replacement, release, return to review, question add, edit and delete, and the Requestor's answer mutations all lock the request row then the questionnaire row before reading (questionnaire-row-locks.ts); D-09 re-checked under both. Mounted tests interleave a release, a question add and a replacement into the other's transaction window with PostgreSQL row locks emulated (SQLite has one connection), plus a lock-order test across seven mutations. SQLite proves the protocol, not PostgreSQL's blocking (R-08-37). |
| CR-201 | critical | fixed | 4c4ca1a (test), 4ec499c (fix): the Risk and mitigation control forms compare each save with the record last saved (Strapi's answer, or a newer record from the page), never the page-load record; the page applies each save's answer (details, Risk, mitigation control, a created Risk) before it reads the assessment again, so a failed re-read leaves no stale baseline and hides no new Risk, and the read-only view after release names a control re-pointed in the session. Tests: Planned, Implemented, Planned sends twice and the store ends Planned; a Risk field and the details set back after a failed re-read are sent; a new Risk shows. The pilot-accepted rule holds (an unchanged in-review save sends nothing, a drafted one still records the review). The Risk not saved test now makes a real change before its failing save. Release readiness stays as last read when the re-read fails (display only; Strapi re-checks on release). |
| CR-401 | critical | open | - |
| WR-101 | warning | fixed | 45726c0 (test), d9eb46e (fix): the seed-owned-value rule now covers controlReference, description, framework, frameworkVersion and frameworkSource against the stored catalogue entry and framework; an operator's edit or clear (null) is kept, a seed-written value still follows the catalogue; comment matches. The runtime verifier's stale fixture stores the earlier framework beside the value it wrote. |
| WR-102 | warning | fixed | 160cf3c (test), ee93a02 (fix): a full or unreadable log fails the replacement job with HISTORY_UNAVAILABLE; an unreadable log gives no change count (null), the analyst revision omits it and the web says any; the web words the new failure with the UI-SPEC G copy. No contract change. |
| WR-103 | warning | fixed | 7a9da03: the NUL byte is now the \u0000 escape, LF restored (git diff 5ea2b77 is 44 insertions, 35 deletions), scripts/*.mjs marked text in .gitattributes; pnpm verify:csrm-seed passes. A file-encoding defect has no test. |
| WR-201 | warning | fixed | 896e162 (test), 73369f4 (fix), 5b7ace4 (comment), with WR-401: a card that follows a job from queued or running to completed asks the page to refresh once; until a newer request arrives the hub names no next action (walkthrough fix 4's rule), then the served one returns (Review and release the questionnaire. after a generation). |
| WR-202 | warning | fixed | a78e788 (test), 88e3786 (fix): the questionnaire card always schedules the next check when one settles, so a tick skipped during a slow check is never lost; the draft card no longer clears the in-flight flag on a new seed, so two checks never overlap. |
| WR-203 | warning | fixed | a8efa7a (test), 49cf876 (fix): settleGenerationAction turns a thrown or rejected Server Action into the operation's unavailable sentence; both cards use it for start, replacement, retry and both status reads, so the buttons and the in-flight flag always restore, the error shows where the analyst acted (inside the replacement dialog too), and a rejected poll reads Status unavailable instead of going unhandled. |
| WR-204 | warning | fixed | 8f127db (test), e31dacf (fix): Enter in OwnerCombobox is always default-prevented; it chooses the active option, or the first result when there is a query (UI-SPEC 13.1). |
| WR-205 | warning | fixed | 06c38e4 (test), aac23e7 (fix): a new assessmentDraft refusal family (QUESTIONNAIRE_NOT_SUBMITTED reads the 12.2 precondition, ASSESSMENT_STARTED the 10.2 E and F wording, fallback An assessment draft can't be generated for this questionnaire in its current state.) replaces This assessment changed. Reload and try again. for draft start and retry; questionnaire generation, both job reads and the request jobs read name the request, the questionnaire or the generation for 403, 404 and other failures (generation-failure-copy.ts, added to the interface copy guard). Decision: these sentences are not in 10-UI-SPEC. Strapi serves no reason on a draft 409 today, so the fallback shows; serving one is a lane 1 contract change, not made. |
| WR-206 | warning | fixed | e4bcfb9 (test), 1515b41 (fix): the Risk Types read always blocks; the Risk list blocks for a read-only assessment and when Strapi refuses it (403, never hidden); a failed or refused request read leaves the editor with no suggestions, as the Risk page does; a failed Risk list read leaves saved systems and assets reading Name not available (16.4), never an id. New route test analyst-assessment-route.test.tsx. |
| WR-207 | warning | fixed | c4beb33 (test), c570f0f (fix): a failed control library read shows We couldn't load this Risk Type. and no form, so no saved control reads Control not found and none can be removed on the failed read; a refused read shows the permission state. The whole-library read itself stays; a bounded hydrate read of the saved ids belongs with Phase 22 (Admin-owned reference data). |
| WR-301 | warning | open | - |
| WR-302 | warning | open | - |
| WR-303 | warning | open | - |
| WR-304 | warning | open | - |
| WR-305 | warning | open | - |
| WR-306 | warning | open | - |
| WR-307 | warning | open | - |
| WR-308 | warning | open | - |
| WR-309 | warning | open | - |
| WR-401 | warning | fixed | 896e162 (test), 73369f4 (fix), with WR-201 (lane 2 fix, lane 4 test): the hub test that required the stale Generate the questionnaire. line now expects one refresh on completion, no Generate line or link beside Review generated questionnaire, and the served Review and release the questionnaire. once the refreshed request arrives; a draft twin expects no Draft the assessment. beside Open assessment draft. |
| WR-402 | warning | open | - |
| WR-403 | warning | open | - |
| WR-404 | warning | open | - |
| WR-405 | warning | open | - |
| WR-406 | warning | open | - |
| IN-101 | info | fixed | 1296d8a: canRetry documented as the initiator fact (true whatever the status; retry still refuses a job that has not failed) in the specification, the regenerated schema.d.ts and the registry comments. The catalogue copies keep their wording, byte-identical. |
| IN-102 | info | fixed | 6a8c58a: the comment now says the stale-entry checks fail fast and stop a seeded start until the title file is corrected; both are tested in control-titles.unit.test.ts. |
| IN-103 | info | skipped | Not a defect: verify-csrm-seed.mjs also checks the seed's list against the controls directory listing (an orphan or unlisted file fails) and the fixed 2,646 count, and an unparseable declaration fails loudly (CSRM seed must declare ...). 10-23's one-list decision (ac34d19) stands. |
| IN-104 | info | deferred | Phase 22 (Admin role and configurable lists, Admin-owned reference data): one exported bounds table with a specification comparison test. The four bounds agree today (10,000, 500, 255, 2,000 against ControlsAdministrationRecord). |
| IN-105 | info | fixed | e5ee253: the race test's comment now says it proves the before-transaction check, and the CR-101 window test covers a release inside the transaction. |
| IN-201 | info | fixed | e49058d (test), 6e56c85 (fix): questionnaireGenerationAction returns exists for a submitted, state-less or unopenable questionnaire; the card says A questionnaire already exists for this request. (decision: not in 10-UI-SPEC) and offers no replacement; the released hint shows only for a questionnaire served as released. |
| IN-202 | info | fixed | 0fbca73 (test), 3948f9e (refactor): releaseReadinessHref replaces releaseReadinessPresentation; the unused em-dash label is gone. |
| IN-203 | info | fixed | 2802d2c (test), d2efecc (fix): the focus effect runs for each request the route serves, so a same-status refresh settles the transition and a later, unrelated change never moves focus. |
| IN-204 | info | fixed | 2ac1faf (test), 676cb3b (fix): third-party involvement that was not served reads Not provided. |
| IN-205 | info | fixed | cec8389 (test), 4b31e72 (fix): readiness groups key on each Risk's destination and keep the number for display; the editor keys readiness rows on their link. |
| IN-206 | info | fixed | ebd6349 (test), 59761bd (fix): the analyst's read-only Next review date uses formatCalendarDate (1 December 2026); none reads Not provided. |
| IN-207 | info | fixed | 4da5a54 (test), 98da7ef (fix): the hub withholds Return to draft while questionnaire generation is queued or running, and until the page catches up with a job that completed; it is offered again once the job fails. |
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
