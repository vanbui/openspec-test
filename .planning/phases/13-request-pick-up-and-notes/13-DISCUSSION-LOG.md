# Phase 13: Request pick-up and notes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 13-request-pick-up-and-notes
**Mode:** `--auto`, one pass.
- Every area was selected automatically. Each question took the recommended option, judged as a mature second-line cyber-governance function would (Three Lines; ISO/IEC 27005) at the G-4 bar, with no user prompt.
- The orchestrator seeded REQ-08 and COLLAB-01, the assignment rules, the assigned-analyst predicate, the deferred Phase 11 items, notes and their unseen fact, the risk owners' reach, the AI-inputs mark and the contract-gap records. The code read during the scout confirmed or corrected each seed before it was recorded.
- No todo matched the phase (`todo.match-phase 13`: 0). No `.continue-here.md`, SPEC.md or checkpoint existed, and no discuss hooks were active.
- The discussion completed in one pass, so no `13-DISCUSS-CHECKPOINT.json` remains. Per the Stage 2 rules, nothing was committed and STATE.md was not updated.

**Areas discussed:**
1. Where assignment lives
2. The assignment operation and who may assign
3. Who can be assigned
4. G-1 for the acting analyst
5. When the assignment can change
6. The assigned-analyst predicate and unassigned requests
7. The queue model
8. Sidebar counts and the Assigned to me view
9. The analyst Home
10. Where the Requestor sees the assignee
11. Following generation jobs
12. R-08-36 and O-5
13. Where notes live (JDL first)
14. When notes can be added
15. Who reads notes
16. The unseen fact
17. Who marks "changes the AI inputs"
18. Which notes the AI reads
19. The run record and the "inputs changed" signal
20. Grants and the catalogue
21. A second analyst for the proofs
22. The notes presentation baseline
23. Verification and plan shape

---

## 1. Where assignment lives (REQ-08, decision 10)

| Option | Description | Selected |
|--------|-------------|----------|
| Current facts on the request (`assignedAnalyst`, `assignedAt`, `assignedBy`) plus an append-only, versioned `assignmentLog` | The 06.8 fact-plus-log posture: gates read the relation, and the log carries history. One record, no new table, and Phase 21 can read the versioned log | ✓ |
| The relation alone | REQ-08 criterion 1 needs who and when for every pick-up, reassignment and release; the latest change alone loses the history | |
| A separate assignment-event entity | Queryable, but a second new table for a handful of events per request, and a competing audit entity the 06.1 and 06.8 records argued against | |

**Choice:** `[auto] Assignment storage: Q: "Where do the assignee and its history live?"` → current facts plus the log (recommended default).
**Notes:** The JDL request has `requestor`, `sponsor` and `revertedBy` only (UAT-014). The record is `docs/contract-gaps/phase-13-request-assignment.md`, with an approval checkpoint (G-6).

---

## 2. The assignment operation and who may assign (decision 10)

| Option | Description | Selected |
|--------|-------------|----------|
| One `PUT …/assignee` for pick-up, assign, reassign and unassign, with compare-and-set on the assignee the caller saw, an optional reason, any eligible analyst acting, editing non-exclusive, and an Undo toast | One grant, one matrix row, no silent overwrite when two analysts pick up at once; decision 10's "any Security Analyst assigns" | ✓ |
| Separate pick-up, assign and release operations | Three grants and rows for one concept, with the same rules | |
| Last write wins | Two analysts could each believe they hold the request | |
| A lead role that assigns | Not in decision 10; a new IdamBox Role is unwarranted | |

**Choice:** `[auto] Operation: Q: "How does an analyst pick up, assign or release a request?"` → one compare-and-set operation (recommended default).
**Notes:** "Release" is avoided for unassigning, because "Released" names the assessment's state (decision 16; root `CONTEXT.md`).

---

## 3. Who can be assigned (G-1, G-11)

| Option | Description | Selected |
|--------|-------------|----------|
| Active human Security Analysts only: never the service agent or a user holding its role, never the request's requestor. One predicate that Phase 17 extends with G-11's risk-owner exclusion, and an eligible-analyst read returning exactly that set | Pickers never offer a refused person; one place to extend | ✓ |
| Anyone holding an analyst-shaped grant | Would admit the service agent (G-1) | |
| Reuse the general user search | Lists Requestors and inactive users, and is not request-specific | |

**Choice:** `[auto] Eligibility: Q: "Who may be named as the assignee?"` → the human-analyst predicate with its own read (recommended default).

---

## 4. G-1 for the acting analyst (O-5)

| Option | Description | Selected |
|--------|-------------|----------|
| On a request they raised, an analyst is its Requestor for this phase's controls: no pick-up, assign, reassign or unassign, no eligible list, and no AI-input mark; the UI explains | Choosing one's own assessor, or steering one's own AI inputs, is the conflict G-1 removes | ✓ |
| Only refuse assigning them | They could still pick their own assessor | |
| Refuse every analyst action on their own request | Wider than G-1, which leaves contribution open; Phase 17.1 adds the review, approval and release rules | |

**Choice:** `[auto] G-1: Q: "What may an analyst do about assignment on a request they raised?"` → nothing (recommended default).

---

## 5. When the assignment can change

| Option | Description | Selected |
|--------|-------------|----------|
| Only on submitted requests. A return to draft keeps the assignment untouched. Before release, everything is allowed; after release, reassign only. Phases 17 and 17.1 extend "reassign only" to the participant stages | Released work keeps an accountable analyst for G-16's escalations and NOTIFY-02's reminders | ✓ |
| Freeze the assignment at release | Staff turnover would strand escalations | |
| Allow everything at every status | A released request could lose its accountable analyst | |

**Choice:** `[auto] Lifecycle: Q: "When can the assignment change?"` → the recommended option.

---

## 6. The assigned-analyst predicate and unassigned requests (G-13; Phase 17.1)

| Option | Description | Selected |
|--------|-------------|----------|
| One `assertAssignedAnalyst`: the current assignee, still eligible at the moment of use, through the human grant. Built now, gating nothing new. On an unassigned request, reserved steps are refused and the UI offers Pick up. No unassigning once participants wait. No backfill | One rule for 17.1's Mark reviewed, submit, recall, and release and close | ✓ |
| Auto-assign the analyst who takes the step | Hidden accountability; G-1 would be bypassed silently | |
| Let any analyst take the step on an unassigned request | Contradicts G-13's assigned-analyst-only steps | |
| Gate the v1 release on assignment now | Churns the v1 release journeys that 17.1 replaces anyway | |

**Choice:** `[auto] Predicate: Q: "What is 'the assigned analyst', and what does unassigned mean later?"` → the recommended option.
**Notes:** Reserving Phase 17's release for response to the assigned analyst is recommended to Phase 17, not decided here. Phase 17.1 settles whether a review by a previous assignee carries over; the recommendation is that it does not.

---

## 7. The queue model (REQ-08 criterion 2; `REPORT.md` §4 "My work by stage")

| Option | Description | Selected |
|--------|-------------|----------|
| An orthogonal `assignee` filter (`me`, `unassigned`) beside the lifecycle buckets, a new `open` bucket, a `notes=unread` filter, and three item fields (assignee, may pick up, unread notes) | "My work by stage" is any bucket with `me`; one SQL definition feeds pages and counts | ✓ |
| Named buckets `assigned-to-me` and `unassigned` only | Cannot show my work by stage, and the assignee cannot be combined with "awaiting Requestor" | |
| Client-side filtering | Inexact totals; breaks Phase 7's exact predicates | |

**Choice:** `[auto] Queue: Q: "How does the queue express assignment?"` → the orthogonal filter (recommended default).
**Notes:** `requires-attention` keeps its value. Its label drops "my", as Phase 11 deferred.

---

## 8. Sidebar counts and the Assigned to me view (Phase 11 D-09 to D-13)

| Option | Description | Selected |
|--------|-------------|----------|
| Assigned to me is its own route with the matching heading. Its count is the viewer's assigned requests that need analyst action. The Requests count becomes the requests that need action and nobody has picked up | Label equals heading (D-09); personal work and the team's pick-up pool, with no double counting | ✓ |
| Keep the Requests count team-wide | Double counts the viewer's own work, and no count drives pick-up | |
| Count the whole open caseload on Assigned to me | Includes work waiting on the Requestor, which is not the viewer's to do now | |
| Make Assigned to me a filtered Requests page | Its heading would not equal its label | |

**Choice:** `[auto] Counts: Q: "What do the sidebar items count?"` → the recommended option.
**Notes:** This reverses Phase 11 D-10's Requests count, deliberately: "my" becomes true only with assignment.

---

## 9. The analyst Home (REQ-08 criteria 1 and 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Lead with the viewer's assigned work that needs action, the unassigned pool and the viewer's requests with new notes, and keep the team lifecycle figures, relabelled. Every figure opens an equal list | The analyst Home leads with "my next action" (Phase 11 D-18), and figures open their records (G-4) | ✓ |
| Add one "Assigned to me" tile and change nothing else | "Requires my attention" would stay misleading beside it | |

**Choice:** `[auto] Home: Q: "How does Home show assignment?"` → the recommended option; the UI-SPEC composes the tiles and rows.

---

## 10. Where the Requestor sees the assignee (Phase 11 D-21, D-27)

| Option | Description | Selected |
|--------|-------------|----------|
| The display name on the request page, the holder sentences, My requests and Home, with an honest "waiting to be picked up" while unassigned. Display name only | Ticketing practice; the Requestor sees analysts' names on notes anyway; minimal data | ✓ |
| Keep "the Security Analyst" | Phase 11 D-21 deferred naming to this phase | |
| Also show the assignment history to the Requestor | Not needed by the first line; minimal disclosure | |

**Choice:** `[auto] Requestor view: Q: "What does the Requestor see of the assignment?"` → the name only (recommended default).

---

## 11. Following generation jobs (REQ-08 criterion 3; Phase 10 D-25 to D-27; G-6)

| Option | Description | Selected |
|--------|-------------|----------|
| By-id reads and retries open to any human analyst who may read the request. `canRetry` means failed and allowed. A retry is attributed to the retrying analyst. The initiator's name is shown. Identifier bounds declared. No grant changes | Any analyst on the request follows the work, and every run names its accountable initiator (G-3) | ✓ |
| Widen reads but keep retry initiator-only | A colleague who picks up a failed job cannot recover it | |
| Restrict jobs to the assignee | Contradicts non-exclusive editing (decision 10) | |

**Choice:** `[auto] Jobs: Q: "Who can follow and retry a request's jobs?"` → any human analyst on the request (recommended default).

---

## 12. R-08-36 and O-5

| Option | Description | Selected |
|--------|-------------|----------|
| R-08-36 stays open, with no shared job store, its trigger unchanged and Phase 21 owning persisted history. O-5's self-review is settled by G-1. O-5's "analyst submits any draft" is closed: only a request's requestor submits it | Access widening does not need storage; least privilege removes an unused power | ✓ |
| Build a persisted job store now | Beyond this phase; the deployment is single-process | |
| Leave O-5's second consequence open | This phase owns O-5 (STATE, 2026-09-27), and no product path uses the power | |

**Choice:** `[auto] Residuals: Q: "What happens to R-08-36 and O-5?"` → the recommended option.

---

## 13. Where notes live (COLLAB-01; JDL first)

| Option | Description | Selected |
|--------|-------------|----------|
| A new `CsrmRequestNote`: plain text up to 5,000 characters, author, part, server time and the AI-input mark; append-only, never deleted; a request holding notes cannot be deleted | No JDL entity fits (catalogue note 6, brief §20); G-15 already names "Phase 13's note" | ✓ |
| Reuse `CsrmQuestion.reviewComment` or `CsrmRisk.comments` | Per-question and per-Risk fields with other meanings; neither belongs to the request | |
| A JSON notes log on the request | Unbounded growth, contended writes, and no per-note queries for flags | |
| Editable or deletable notes | Breaks the record the third line relies on | |

**Choice:** `[auto] Notes entity: Q: "Where do notes live?"` → the new entity (recommended default).
**Notes:** The record is `docs/contract-gaps/phase-13-request-notes.md`, with an approval checkpoint (G-6).

---

## 14. When notes can be added (the draft and cancelled cases)

| Option | Description | Selected |
|--------|-------------|----------|
| From first submission until release or closure (the reviewable statuses). No new note on a draft, returned or never submitted. Read-only once released or closed. No cancellation exists. One `acceptsNotes` predicate | Context establishment ends at release; post-release information belongs to the register (Phase 20) | ✓ |
| Allow notes on returned drafts | The Requestor edits the request itself, and analysts do not work on drafts | |
| Allow notes after release | Released requests close the context; Phase 20's progress notes carry treatment news | |

**Choice:** `[auto] Window: Q: "When can notes be added?"` → the recommended option.

---

## 15. Who reads notes (COLLAB-01 criterion 4; G-12)

| Option | Description | Selected |
|--------|-------------|----------|
| The requestor and human analysts only, through a notes predicate separate from the request read. Participants are never included (G-12 confirmed), nor the service agent. Everyone else gets 404 | Need to know; Phase 17's participant read cannot widen it silently; contest points are the risk owners' channel | ✓ |
| Follow the request read, which Phase 17 widens | Nominated risk owners would read notes, contradicting G-12 | |
| 403 for another Requestor | Discloses existence; the seed asks for the refusal a missing record gets | |

**Choice:** `[auto] Readers: Q: "Who reads a request's notes?"` → the recommended option.
**Notes:** G-11's "propose a different owner in a note" is therefore the Requestor's path only, recorded as a shared-file clarification.

---

## 16. The unseen fact (COLLAB-01 criterion 2; decision 18)

| Option | Description | Selected |
|--------|-------------|----------|
| A per-person, per-request `lastReadAt`. Unread means written in the other part, not by you, after it. Advanced only by an explicit, monotonic "mark read through note N" | Minimal, composable with Phase 17's per-notification read state; exact queue flags and filters; no GET side effects | ✓ |
| Per-side read markers on the request | One analyst's read would clear the flag for the assignee | |
| Per-note read receipts | Heavier, and discloses who read what | |
| Wait for Phase 17's notification centre | COLLAB-01 needs the flag now | |

**Choice:** `[auto] Unseen: Q: "What records that a note was seen?"` → the per-person read state (recommended default).

---

## 17. Who marks "changes the AI inputs" (COLLAB-01 criterion 3; G-3; decisions 2 and 5)

| Option | Description | Selected |
|--------|-------------|----------|
| Security Analysts only: off by default when posting, changeable later on any note, recorded, with Undo. The Requestor never sets or sees it | The second line owns the AI inputs; data minimisation; decision 2's analyst opt-in; untrusted Requestor text | ✓ |
| The author marks at posting, and nobody changes it later | A mistaken or missing mark could not be fixed | |
| Both actors mark, and analysts can override | The Requestor would see their mark change under them; AI jargon in the Requestor's form | |

**Choice:** `[auto] Mark: Q: "Who decides that a note changes the AI inputs?"` → the analyst (recommended default).

---

## 18. Which notes the AI reads (INT-05; Phase 12 D-04, D-05, D-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Only the marked notes, in posting order, in a delimited untrusted block labelled by part and sequence, with no names, times or ids, the same classification check, sent whole, failing loudly over budget | G-3 minimisation and decision 5's delimiting; every builder-based operation inherits them | ✓ |
| Every note | Conversation and personal details reach the provider; more injection surface | |
| Analyst notes in a trusted slot | Analyst notes can quote the Requestor; decision 5 keeps the trusted slot for instructions | |

**Choice:** `[auto] AI context: Q: "Which notes reach the AI, and how?"` → the marked notes as untrusted data (recommended default).
**Notes:** INT-05 criterion 1, COLLAB-01 criterion 3 and QUES-12 criterion 1 say "the notes". That is read as "the marked notes" (G-3), and is recorded as a shared-file clarification.

---

## 19. The run record and the "inputs changed" signal (Phases 12, 15 and 16)

| Option | Description | Selected |
|--------|-------------|----------|
| The run's context summary lists the included notes (ids, parts and sizes, no text). The signal, per target, is the notes whose mark differs from their inclusion in the latest context-wide run. Risk-scoped runs never clear it. It is shown to analysts only, with no re-run action here | Exact even when a note arrives during a run; Phases 15 and 16 attach their actions to it | ✓ |
| Compare note times with the run's start time | Races with notes posted during a run; misses unmarking | |
| One request-wide signal | A questionnaire run would hide the assessment's stale inputs | |

**Choice:** `[auto] Signal: Q: "What do Phases 15 and 16 read?"` → the per-target signal (recommended default).

---

## 20. Grants and the catalogue

| Option | Description | Selected |
|--------|-------------|----------|
| Three API-only Functions: assignment (human analyst); notes (Requestor birthright and Security Analyst); the AI-input mark (human analyst). None to the agent. Assignment and the mark join `HUMAN_ANALYST_ONLY_OPERATIONS` | Exact grants; a second refusal for automation; the dual-actor notes keep their record check | ✓ |
| Fold everything into the Request Details menu Function | It is shared with the service agent | |
| Put the notes operations in the human-only set | Would refuse every Requestor, because the birthright holds the grant | |

**Choice:** `[auto] Grants: Q: "Which roles hold the new operations?"` → the recommended option.

---

## 21. A second analyst for the proofs

| Option | Description | Selected |
|--------|-------------|----------|
| Seed a second development Security Analyst like the Secondary Requestor: development and E2E only, no Keycloak fixture subject, offered by the development sign-in. Strapi tests use Phase 10's `second-analyst` | UI proofs of following another analyst's job, reassignment and per-person flags; ADR 0004 and the realm stay unchanged | ✓ |
| Prove the second analyst in Strapi tests only | The UI side of success criteria 1 and 2 would go unproven | |
| Add a Keycloak fixture subject too | Not needed; the Secondary Requestor has none | |

**Choice:** `[auto] Persona: Q: "How is 'another analyst' proved in the UI?"` → the seeded development persona (recommended default).

---

## 22. The notes presentation baseline (G-4)

| Option | Description | Selected |
|--------|-------------|----------|
| The thread and composer on both request pages; a server-rendered summary on the questionnaire and assessment pages; optimistic posting with rollback; permanence stated; Ctrl+Enter or ⌘+Enter; drafts kept for the session plus the navigation guard; local times; phone cards; the Requestor told that analysts may include notes in AI assistance | Meets the bar without touching the editor's route budget (R-08-34) | ✓ |
| A confirmation before every note | Friction on an ordinary message; G-4 keeps confirmations for governance steps | |
| A notes composer in the assessment editor | The route is near its JavaScript budget | |

**Choice:** `[auto] Presentation: Q: "What baseline does the UI-SPEC build on?"` → the recommended option; the UI-SPEC fixes the values and extensions.

---

## 23. Verification and plan shape

| Option | Description | Selected |
|--------|-------------|----------|
| RED first at each seam: Strapi unit and mounted integration for every operation and refusal, matrix rows, web units for the refusal states, Playwright journeys at 1440px and 375px with their own records. Contract-gap checkpoints before the schema plan. Serialised by shared files. A clean tree after every run | The Stage 2 test rules; every negative case proven in the API and the UI | ✓ |

**Choice:** `[auto] Verification: Q: "How is the phase proved?"` → the recommended option.

---

## Planner's Discretion

- Module placement, and whether the notes routes live under the request API or their own API folder.
- The names of reason codes, Functions, operations, fields and envelope versions, within the families recorded.
- The bounds (note length against Phase 12's budget, per-request note cap, assignment-log cap, eligible-list size), and the SQL and indexes, provided the totals are exact.
- The second analyst persona's name and email.
- How the work splits into plans, provided the serialisation holds.
- Copy, layout, routes and visuals, which the UI-SPEC fixes.

## Deferred Ideas

- A filter by a named analyst, sorting by assignee, bulk assignment and workload balancing.
- Auto-assignment on first action (a candidate Phase 22 setting).
- Internal analyst-only notes, mentions, per-question comments (COLLAB-03), note redaction, and read receipts.
- Assignee columns on the questionnaire and assessment lists (Phase 18), and recent-activity entries (Phase 21).
- Team fan-out of events on unassigned requests (Phase 17).
- A 404 for another Requestor's request read (a Phase 17 candidate).
- A requesting analyst's contributions (G-1's scope; Phase 17.1).
- A shared job store (R-08-36, Phase 21).
