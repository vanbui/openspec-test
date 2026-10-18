# Phase 10: Existing-flow gap closure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-09-27
**Phase:** 10-existing-flow-gap-closure
**Mode:** `--auto`. Every area was selected automatically, and each question took the recommended option with no user prompt. The orchestrator seeded the contract boundary, the progress-count default, the control-library dependency, the autosave approach and the copy and time rules. The code read during the scout confirmed or corrected each seed before it was recorded.
**Areas discussed:** Question placement and the governance editor; The released questionnaire for the analyst; Regeneration safeguards; Unsaved-answer protection; The Requestor's first screen; Radio keyboard behaviour; Actions, refusals and reasons; Analyst routes opened by a Requestor; Generation status on return; Assessment editing pickers and feedback; Release readiness; The released assessment's content; Reference data display and content; Local time and question names; Interface copy; Contract boundary.

---

## Question placement and the governance editor (UAT-005, UAT-016)

| Option | Description | Selected |
|--------|-------------|----------|
| Section chooser, with placement computed from the complete question set | Edit in place and add at the end of the section. Choose an existing section or name a new one. Placement comes from every question, removed ones included. Contract unchanged | ✓ |
| Server-assigned placement | `order` becomes optional on add and the server appends. The contract's section shape still requires `order`, so the semantics would be implicit | |
| Keep the free-text section title and match existing titles | Still sends a derived key; titles are not unique, and renaming a section breaks sibling metadata | |

**Choice:** `[auto] Governance editor: Q: "How does an added question get its section and position?"` → the section chooser with placement from the complete question set (recommended default).
**Notes:** The scout confirmed the UAT's reading: `blankQuestion` sends key `general` at order 0. It also found two related causes. The web question parser drops removed questions, whose orders the server still checks. The edit form's free-text "Section title" breaks any section with more than one question. The form opens where it was invoked, with focus in its first field, and errors show beside Save.

---

## The released questionnaire for the analyst (UAT-020)

| Option | Description | Selected |
|--------|-------------|----------|
| Released questions read-only plus the answered count | Uses the `progress` the summary already serves; no answer content | ✓ |
| Also show draft answer content | Contradicts the default for the operator's open decision and the Phase 3 masking decision | |
| Count only | Leaves the analyst unable to read what was released | |

**Choice:** `[auto] Released questionnaire: Q: "What does the analyst see before submission?"` → questions read-only and "N of M answered" (recommended default).
**Notes:** No API change is needed: `projectQuestionnaire` already serves `progress` to analysts.

---

## Regeneration safeguards (UAT-019)

| Option | Description | Selected |
|--------|-------------|----------|
| "Replace questionnaire" with a discard count, a `regenerated` event, question-text snapshots, and refusal while released | Makes the cost visible, keeps history meaningful, and removes an implicit un-release | ✓ |
| Version question keys and soft-delete the replaced questions | Collides with the definition's section and order checks; heavy | |
| Forbid regeneration once any analyst edit exists | Removes a working capability the operator's intended product wants | |

**Choice:** `[auto] Regeneration: Q: "How is replacing a questionnaire made safe?"` → the recommended option.
**Notes:** Found in research: replacing a released but unanswered questionnaire keeps its release fact, so AI questions would reach the Requestor without analyst review. Refusal follows 06.8 D-15.

---

## Unsaved-answer protection (UAT-021)

| Option | Description | Selected |
|--------|-------------|----------|
| Debounced autosave, a visible saved state, and a leave warning while a save is pending, in flight or failed | The orchestrator's seed. Fits the existing full-batch save and Strapi's per-questionnaire serialisation | ✓ |
| Warning only | Keeps the loss risk on reload and close | |
| Autosave only | Silent failures and fast navigations still lose input | |

**Choice:** `[auto] Unsaved answers: Q: "How are typed answers protected?"` → autosave plus a leave warning (recommended default).
**Notes:** The leave warning uses the Next 16.3 `onNavigate` guard for in-app links and `beforeunload` for hard navigation. The autosave action must not revalidate the page being edited. "Save draft" stays.

---

## The Requestor's first screen (UAT-023)

| Option | Description | Selected |
|--------|-------------|----------|
| Introduction, then the first section. Attention list after a submit attempt, in form order. History below the questions, counted per round | Every part of the UAT recommendation that needs no new data | ✓ |
| Also add analyst-authored help text | The question read does not project `helpText`; Phase 12 (QUES-10) owns help text | |

**Choice:** `[auto] First screen: Q: "What does the Requestor see first?"` → the recommended option. Help text is deferred to Phase 12.

---

## Radio keyboard behaviour (UAT-064)

| Option | Description | Selected |
|--------|-------------|----------|
| Handle the arrow keys in the shared radio wrapper so selection follows focus deterministically; same for the segmented control | Fixes the Radix timing race at its source for every radio group | ✓ |
| Replace with native radio inputs | A new primitive; shadcn-first rule | |
| Leave it (Radix intends to select) | A fast key release (automation, some assistive technology) still moves focus without selecting | |

**Choice:** `[auto] Radio groups: Q: "How do arrow keys select?"` → the shared-wrapper fix (recommended).
**Notes:** The root cause differs from the UAT's reading. Radix selects only when the keyup arrives after its deferred focus move; the existing segmented-control test holds the key to avoid this.

---

## Actions, refusals and reasons (UAT-036, UAT-037, UAT-022)

| Option | Description | Selected |
|--------|-------------|----------|
| Actions from the server's own rules (shared predicates on the served relationships), closed reason codes on 409s, plain messages, and dialogs that say what happens next | Covers both actors, and races still get a true message | ✓ |
| Hide actions only | A race still says "changed, reload" | |
| Reason codes only | Still offers actions that cannot succeed | |

**Choice:** `[auto] Refusals: Q: "How do offered actions and refusals tell the truth?"` → the recommended option.
**Notes:** UAT-037's root cause is stale local state after an in-page submit, not a missing refresh.

---

## Analyst routes opened by a Requestor (UAT-062)

| Option | Description | Selected |
|--------|-------------|----------|
| Capability gate before any read on the three analyst detail routes, rendering the route's existing permission state | Same pattern as the analyst dashboard; keeps existing denial copy and proofs | ✓ |
| Redirect Requestors to the Requestor route | Hides the refusal; an unreleased questionnaire has no Requestor route | |
| Rely on Strapi only | Today's behaviour: analyst actions render and fail | |

**Choice:** `[auto] Analyst routes: Q: "What does a Requestor see on an analyst URL?"` → the capability gate (recommended).

---

## Generation status on return (UAT-041)

| Option | Description | Selected |
|--------|-------------|----------|
| One new read of a request's generation jobs, human analyst only, seeding both job panels | Status in place of Generate; retry stays initiator-only; the queue already discloses "in progress" | ✓ |
| Initiator-only read by request | A second analyst still sees Generate while a job runs | |
| Web-only "in progress" from the queue bucket | No status, progress or failure detail | |

**Choice:** `[auto] Generation status: Q: "What shows when the analyst returns mid-job?"` → the new read (recommended).
**Notes:** It covers the draft job too, because UX-06 criterion 2 says "generation job" generally and the draft panel has the same missing `initialJob`. Phase 13 widens reads and retry by job id.

---

## Assessment editing pickers and feedback (UAT-006, UAT-009, UAT-010, UAT-034)

| Option | Description | Selected |
|--------|-------------|----------|
| One shared server-backed single-record picker for control, system and asset in both editors; the owner combobox for the control owner; applicable controls and request scope first; the date input for exemption review; inline save status | Generalises the 06.3 pattern and removes the 2,646-option and 25-row lists | ✓ |
| Client-side filtering of loaded lists | Today's Risk Register stopgap; unbounded payload, and the 25-row cap hides records | |

**Choice:** `[auto] Pickers: Q: "How are controls, systems, assets and owners chosen?"` → the shared picker (recommended).
**Notes:** Putting applicable controls first needs a bounded applicable-control summary on the picker's Risk Type list (an API change). The exemption review date is a datetime in the frozen schema, so it is stored at 00:00 UTC.

---

## Release readiness (UAT-011)

| Option | Description | Selected |
|--------|-------------|----------|
| Summary: outstanding assessment items, then one row per risk with its count and link; met items on demand | Web only; served requirements already carry scope and risk | ✓ |
| An accordion per risk showing every field | Still long; many tab stops | |
| Keep the flat list | 146 rows for ten risks | |

**Choice:** `[auto] Readiness: Q: "How is readiness summarised?"` → the summary (recommended).

---

## The released assessment's content (UAT-033)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the shared risk read with the brief §8 treatment and ownership facts, and add a control summary to control implementations | One projection for both actors; the Risk Register's `RiskDetailControl` is the precedent | ✓ |
| A Requestor-only projection variant | Two shapes for one screen | |

**Choice:** `[auto] Released view: Q: "Where do the released facts come from?"` → extend the shared reads (recommended).
**Notes:** This corrects the UAT's reading. The released reads carry five risk fields and a control id only, so this is an API change, not "UI only".

---

## Reference data display and content (UAT-007, UAT-053)

| Option | Description | Selected |
|--------|-------------|----------|
| One control label rule; the system owner's name and list columns; corrected public APP titles; user-facing Risk Type descriptions; licensed titles and the asset owner deferred | Fixes the display now and leaves licensing and the datamodel to their owners | ✓ |
| Wait for decision 15 before changing anything | Leaves repeated numbers and IDs on screen | |

**Choice:** `[auto] Reference data: Q: "What does Phase 10 change in the library?"` → the recommended option.

---

## Local time and question names (UAT-024)

| Option | Description | Selected |
|--------|-------------|----------|
| Viewer time zone in a cookie set by a Server Action; one shared instant formatter; UTC with an explicit label as the fallback; question text from snapshots or resolution | No inline script (nonce CSP); server and client render the same value | ✓ |
| Client-only formatting after mount | Flash on every load and hydration mismatch risk | |
| UTC with an explicit label only | Meets the letter of "an explicit zone", not "local time" | |

**Choice:** `[auto] Time and names: Q: "How do timelines show time and questions?"` → the recommended option.

---

## Interface copy (UAT-054)

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite the listed strings and internal terms on Phase 10 surfaces, with exact strings in the UI-SPEC; dashboard and report wording with Phase 11 | Keeps Phase 11's exposure labels in one rewrite | ✓ |
| Rewrite every surface now | Two rewrites of the Phase 11 surfaces | |

**Choice:** `[auto] Copy: Q: "How far does the copy sweep go?"` → the recommended option.

---

## Contract boundary

| Option | Description | Selected |
|--------|-------------|----------|
| No content-type change; seven named API changes through the established pattern; the governance-log envelope amended in the 06.8 contract-gap record | The orchestrator's seed, verified against the code | ✓ |

**Choice:** `[auto] Contract: Q: "What may change in the contract?"` → the recommended default.

## Planner's Discretion

- Component decomposition and placement: the shared picker, the time-zone helper, the navigation guard and the request context component.
- The debounce value (about 1-2 seconds) and the picker page size.
- Reason-code names within the families research proposes, and the new read's envelope within the closed job schema.

## Deferred Ideas

- The Information Asset owner (needs a content-type change).
- Licensed and descriptive control titles (decision 15).
- List column choice (Phase 11 and 18).
- Question help text (Phase 12).
- Regulatory requirements in the AI context (Phase 12).
- Job reads and retry by id for any analyst (Phase 13).
- Dashboard and report "contextual" wording and other UTC instants (Phase 11).
- Keyboard jump to the risks (Phase 18).
- Versioned question keys (Phase 15 if needed).
- Section rename and reordering.
- The "other party" wording and the split Requestor summary (Phase 11).
