# Phase 17: Mitigation response and residual reassessment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 17-mitigation-response-and-residual-reassessment
**Mode:** `--auto`, one pass.
- Every area was selected automatically, and each question took the recommended option with no user prompt: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005; ISO/IEC 27001:2022 clause 6.1.3) at the G-4 premium bar, consistent with `NEXT-WAVE-DECISIONS.md` decisions 1 to 18, G-1 to G-10 and the post-demo G-11 to G-18.
- The orchestrator seeded the requirements, the three contract-gap records, owner nomination, the participant read, responses in rounds, the people search, the reassessment, the notification centre, the guard, the fixtures, the journey and the size question. The code read during the scout confirmed or corrected each seed (CONTEXT.md, "Seeds confirmed or corrected").
- No todo matched the phase (`todo.match-phase 17`: 0), no `.continue-here.md`, SPEC.md or checkpoint existed, and no discuss hooks were active.
- The discussion completed in one pass, so no `17-DISCUSS-CHECKPOINT.json` remains. Per the stage rules, no commit, STATE.md update or auto-advance was run.

**Areas discussed:**
1. How the response stage appears in the published vocabulary
2. Who opens and closes rounds
3. What a round locks
4. Release-for-response readiness
5. The participant gate fact
6. The response unit
7. What a proposed control holds
8. Drafts and lost input
9. When and how the analyst decides
10. Owner nomination paths
11. Separation of duties for named owners
12. Who the participants are, and what they read
13. Unreviewed AI values between rounds
14. Where participants read, and analysts who participate
15. My risk assessments, Home and the holder
16. Exports and print before release
17. Residual reassessment
18. The people search's callers and log
19. The notification model
20. Notification readability and wording
21. Events for an unassigned request
22. Delivery, refresh and email
23. Development fixtures and Keycloak files
24. The authorisation matrix
25. The journey slice and "the analyst cannot accept"
26. Phase size

---

## 1. How the response stage appears in the published vocabulary (decision 3, G-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Derived stage: no stored enum change; a published `stage` vocabulary, a lifecycle step, a holder value and the queue buckets read the round facts | Follows 06.8's precedent for the stepper; leaves every status predicate (queues, notes window, assignment, release) unchanged; keeps the JDL vocabularies | ✓ |
| A new `CsrmAssessmentStatus` value (`released-for-response`) | Visible in the stored data, but the assessment's `draft`/`in-review` edit transition and v1's release would all need rework, and 17.1 would add another value | |
| A new `CsrmRequestStatus` value | Every request predicate (queues, `acceptsNotes`, Phase 13's assignment rules, the release transition from `under-review`) would change | |

**Choice:** `[auto] Stage: Q: "How does the response stage enter the published status vocabulary?"` → derived, published stage values (recommended default).
**Notes:** `REPORT.md` §8 asked for "a new assessment stage in the status vocabulary", citing 06.8 D-01's "state vocabulary is a published API/UI contract"; 06.8's record shows the published vocabulary can be a derived projection. G-12's four stage names become one closed `stage` vocabulary, which 17.1 extends with `awaiting-acceptance`.

---

## 2. Who opens and closes rounds (decision 3, decision 10, Phase 13 D-11)

| Option | Description | Selected |
|--------|-------------|----------|
| The assigned analyst only, through `assertAssignedAnalyst`; confirmation to open; confirmation to close only when someone has not responded | Disclosing the assessment is an accountable act; Phase 13 D-11 recommends reserving it; G-4 lists release for response as governance-significant | ✓ |
| Any human Security Analyst | Matches "editing is not exclusive", but opening a round decides who reads the record, which is not an edit | |
| Rounds close themselves when everyone has responded | Fewer clicks, but decision 3 makes the stage analyst-controlled, and the analyst may want to wait or chase | |

**Choice:** `[auto] Rounds: Q: "Who controls response rounds?"` → the assigned analyst, analyst-controlled closure (recommended default).
**Notes:** An optional analyst message travels with each round, as a covering note does with a draft report.

---

## 3. What a round locks (Phase 16 D-22's guard)

| Option | Description | Selected |
|--------|-------------|----------|
| While a round is open, every analyst content edit is refused; between rounds everything is editable | Participants respond to stable content, as management does to a draft report; matches the glossary's "the analyst can still edit the assessment between rounds"; one guard, one reason code | ✓ |
| No lock: the analyst edits during the round | Participants would see content change under their drafts | |
| A partial lock: risk content frozen, but decisions and nominations allowed | Decisions create control implementations and owner changes alter who may respond, so both change the content being responded to | |

**Choice:** `[auto] Lock: Q: "What may the analyst edit while a round is open?"` → nothing that changes content; reads, notes, reassignment and closing stay open (recommended default).
**Notes:** The acceptance-round lock stays with 17.1, in the same guard.

---

## 4. Release-for-response readiness (G-11, Phase 12 D-21, Phase 16 D-42)

| Option | Description | Selected |
|--------|-------------|----------|
| A readiness projection: active risks, each with a statement, ratings and an eligible owner; no unreviewed AI value or open proposal; no running AI job; assigned and editable | First-line people only ever see content an analyst has reviewed; no proposal lapses because a round opened | ✓ |
| Owners only (G-11's minimum) | Unreviewed AI values would reach the business as if they were the analyst's view | |
| Full release readiness | Too strict: nothing is final in the response stage, and the business's input changes the treatment fields | |

**Choice:** `[auto] Readiness: Q: "What must hold before release for response?"` → the dedicated readiness projection (recommended default).

---

## 5. The participant gate fact (G-12)

| Option | Description | Selected |
|--------|-------------|----------|
| A dedicated, never-cleared fact on the assessment (`sharedWithParticipantsAt` and `By`), written by the first release for response or 17.1's first submission | The gate reads one server-owned fact directly; list predicates stay simple; the name fits both writers | ✓ |
| Derive the gate from "a round exists" | Works for rounds but not for 17.1's skipped-stage case, and couples the read to the round table | |
| Reuse `CsrmRisk.riskCommunicationDate` | A JDL field, but per risk, analyst-writable today through the risk update, and so not a gate | |

**Choice:** `[auto] Gate: Q: "What opens the participant read?"` → the dedicated fact (recommended default).
**Notes:** The seed's "like 06.8's questionnaire release fact" holds only for "a dedicated fact the gate reads directly": 06.8's `releasedAt` is cleared by a return to analyst review, while this fact is never cleared.

---

## 6. The response unit (ASSESS-12)

| Option | Description | Selected |
|--------|-------------|----------|
| One response per participant per round, with per-risk content, created as `requested` when the round opens, submitted once | Each response is attributed; "who was asked" and "who has not responded" are stored facts; one submit and one notification per person | ✓ |
| One shared response per risk that the Requestor and the owner edit together | Collaborative, but edits collide and authorship blurs | |
| One response record per risk per person, each submitted separately | Many submissions and notifications for one person's answer | |

**Choice:** `[auto] Unit: Q: "What is a response?"` → one per person per round (recommended default).
**Notes:** Responses and their items are rows, not JSON, because each item carries its own decision and links to the control implementation it creates.

---

## 7. What a proposed control holds (decision 3)

| Option | Description | Selected |
|--------|-------------|----------|
| The business's own words: title, description, Existing or Planned, a control owner found by name, a due date when planned, an evidence statement when existing; the analyst maps to the library on acceptance | The first line says what it does; the second line owns the method and the control library | ✓ |
| A library control picker for first-line users | Needs a new birthright grant to the control library, and asks the business to speak the framework's language | |
| Every proposed control needs both evidence and a due date, literally | A control in place has no due date and a planned one has no evidence yet | |

**Choice:** `[auto] Proposal: Q: "What does a proposed mitigation control hold?"` → plain-language proposals, read by status (recommended default).
**Notes:** A response may also propose a different risk owner (with a reason) and carry a comment for the analyst.

---

## 8. Drafts and lost input (G-4)

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side autosave, private until submitted; an unsubmitted draft closes "not submitted" with the round and seeds the next round's draft | No lost input across devices or rounds; the analyst never sees unsubmitted content | ✓ |
| Browser-only drafts | Lost on another device, and nothing to carry forward | |
| Unsubmitted drafts discarded when the round closes | Loses the person's work | |

**Choice:** `[auto] Drafts: Q: "What happens to unsubmitted input?"` → autosaved and carried forward (recommended default).

---

## 9. When and how the analyst decides (ASSESS-12 criterion 2)

| Option | Description | Selected |
|--------|-------------|----------|
| After the round closes, per item, in one batch operation: accept (mapping to a library control, optionally changing values with a reason), or reject with a reason; Undo while unchanged | Matches the lock; decisions are communication back to the business, so rejections and changes carry reasons | ✓ |
| Decide as responses arrive, while the round is open | Accepting creates control implementations, changing content mid-round | |
| A reason for every decision | Friction on plain acceptances with no information gain | |

**Choice:** `[auto] Decisions: Q: "When and how does the analyst decide proposals?"` → after close, reasons for rejections and changes (recommended default).
**Notes:** "Responses decided" joins release readiness now and 17.1's submission readiness, but does not block opening another round. Items on a risk withdrawn while undecided lapse.

---

## 10. Owner nomination paths (G-11, ASSESS-21)

| Option | Description | Selected |
|--------|-------------|----------|
| A batch operation of (risk, owner) pairs for "one owner for every risk", multi-select and Undo, plus the existing risk update for one risk, both under one validation | One shape serves one-for-all, per-risk and Undo; the risk card keeps its field; Phase 18's bulk edits reuse the rules | ✓ |
| A dedicated operation only, removing `riskOwner` from the risk update | One write path, but breaks the risk editor and Phase 18's bulk edits for no governance gain | |
| The risk update only, one call per risk | No one-step nomination, and Undo would be many calls | |

**Choice:** `[auto] Nomination: Q: "How are owners nominated?"` → batch plus per-risk, one validation (recommended default).

---

## 11. Separation of duties for named owners (G-11, G-1)

| Option | Description | Selected |
|--------|-------------|----------|
| A named owner takes no analyst act on that assessment or its request (edits, AI, rounds, decisions, release, assignment, AI-input marks); the assignee is never named and a named owner never assigned | Nobody both assesses and owns the same risk; extends G-1 both ways as G-11 says; reads Phase 13 D-07 the same way | ✓ |
| Refuse only assessment content edits | Leaves a named owner able to steer the assessment through assignment or the AI inputs | |
| Refuse an analyst-role holder as an owner altogether | Stricter than G-11, which only excludes the assigned analyst, reviewer and peer approver | |

**Choice:** `[auto] SoD: Q: "What may a named owner who holds the analyst role do?"` → no analyst act on that assessment (recommended default).

---

## 12. Who the participants are, and what they read (G-12)

| Option | Description | Selected |
|--------|-------------|----------|
| The Requestor and the current owners of non-withdrawn risks read a closed projection: stage, parts, request summary, assessment fields, non-withdrawn risks with Phase 10's released fields, control implementations and every submitted response with its decisions | Need to know: those who must accept see what they accept; the request summary gives context without the questionnaire, notes or attachments | ✓ |
| Each owner reads only their own risks | Rejected by G-12: nobody can judge a risk without its context | |
| Participants read the analyst's projection | Leaks analyst-only facts (AI provenance, readiness, review facts, internal comments) | |

**Choice:** `[auto] Read: Q: "What do participants read?"` → the closed participant projection (recommended default).
**Notes:** Participation is current. An analyst who can read the assessment but calls a participant-only operation gets 403, not 404, because a 404 would be untrue.

---

## 13. Unreviewed AI values between rounds (INT-06, decision 5)

| Option | Description | Selected |
|--------|-------------|----------|
| A risk holding an unconfirmed AI value is listed to participants as being prepared, without its content, until an analyst confirms it | First-line people never read unreviewed AI output as the analyst's view | ✓ |
| Show the current record whatever its review state | Exposes AI proposals that no person has checked | |
| Freeze the participant view at the last round | A snapshot model: complex, and contrary to G-12's "the read lasts through the analyst's rework" | |

**Choice:** `[auto] AI between rounds: Q: "What do participants see of unreviewed AI content?"` → the risk shows as being prepared (recommended default).

---

## 14. Where participants read, and analysts who participate

| Option | Description | Selected |
|--------|-------------|----------|
| Widen the existing Requestor branches of the three read routes to the participant projection; an analyst who participates uses the analyst page plus their own response panel | No duplicate read operations; one predicate; the analyst-participant keeps the analyst view and responds through the birthright operations | ✓ |
| A separate participant read family under "my" URLs | Two ways to read the same record, with two predicates to keep equal | |
| Route analyst-participants to the participant page | Their analyst grant answers the shared read with the analyst projection, so the page would need a second read anyway | |

**Choice:** `[auto] Routes: Q: "Where do participants read?"` → the widened existing routes (recommended default).

---

## 15. My risk assessments, Home and the holder (Phase 11 D-19, D-20)

| Option | Description | Selected |
|--------|-------------|----------|
| "My risk assessments" lists participations with part, stage and "awaiting your response"; Home's "Needs your action" lists awaited responses; the holder gains a `participants` value for "waiting on another first-line person"; the queue buckets follow whose turn it is | Every figure opens an equal list; the Requestor's Home never says "With the Security Analyst" when a risk owner holds the work (UAT-003's lesson) | ✓ |
| Keep the holder at three values | After Jane submits and the owner has not, her request would read "With the Security Analyst", which is untrue | |
| A separate owner dashboard | A second landing page; Phase 11 settled one Home per actor | |

**Choice:** `[auto] Lists: Q: "How do lists, Home and the holder show the stage?"` → widened list, Home items and one new holder value (recommended default).

---

## 16. Exports and print before release (decision 12, Phase 19 D-14)

| Option | Description | Selected |
|--------|-------------|----------|
| Widen Phase 19's one predicate to "participant and released"; before release a participant gets 409 "available once released", a non-participant 404 | Exports follow the read in one place; the refusal is honest for someone who can read the record | ✓ |
| Let participants export during the response stage | Draft content would leave the system as a file before anything is final | |
| 404 for participants before release | Untrue for someone who can read the assessment (Phase 19 D-15's reasoning) | |

**Choice:** `[auto] Exports: Q: "When do participants export and print?"` → once released, through the one predicate (recommended default).

---

## 17. Residual reassessment (ASSESS-13, UAT-026)

| Option | Description | Selected |
|--------|-------------|----------|
| A risk-scoped AI operation on Phase 12's context and Phase 16's field-change mechanism: units for residual likelihood and consequence (with the derived rating) and the rationale, citing control implementations, capped at the inherent score, counting planned controls; decided with a visible "Confirm" | Reuses every foundation; a rating never derives inconsistently; AI never decides | ✓ |
| A free-text residual write-up the analyst pastes | No per-field decision, no citations, no run record | |
| Apply AI residual values automatically and let the analyst revert | Breaks the core value: analysts, not AI, decide | |

**Choice:** `[auto] Reassess: Q: "How does the AI reassess residual risk?"` → proposal units confirmed per field (recommended default).
**Notes:** One reassessment job per assessment at a time; a newer reassessment or rewrite supersedes an older open residual unit of the same risk.

---

## 18. The people search's callers and log (G-17)

| Option | Description | Selected |
|--------|-------------|----------|
| Harden in place (two to 100 characters, eligible people only, `documentId` and `displayName`, 20 results); refuse the service identity as a caller; log every search through Phase 19's event log | Least privilege and data minimisation; enumeration by automation is refused and every search is monitorable (Annex A 8.15, 8.16) | ✓ |
| Harden the results but keep the service identity as a caller | No agent workflow names people, and the matrix would keep an automation path to the directory | |
| A new directory operation for first-line users | Rejected by G-17: it duplicates a catalogued operation the Requestor already holds | |

**Choice:** `[auto] Search: Q: "Who may search people, and what is logged?"` → every active human; the service identity refused; every search logged (recommended default).

---

## 19. The notification model (decision 18, G-18)

| Option | Description | Selected |
|--------|-------------|----------|
| One row per recipient and event, with a closed kind vocabulary, the request (and questionnaire or assessment) it is about, an identifiers-only facts envelope, and `readAt`; written in the event's transaction | Per-user read state; kinds added by later phases without a schema change; nothing copied out of the records | ✓ |
| One row per event with a recipients list and a separate read-state table | Two tables and a join for every count | |
| Derived notifications computed on read from the records | No stable read state, and every event source re-queried on every page | |

**Choice:** `[auto] Model: Q: "How are notifications stored?"` → one row per recipient and event (recommended default).
**Notes:** Phase 17's kinds: request assigned, questionnaire released and submitted, response requested and submitted, assessment released, note added.

---

## 20. Notification readability and wording (NOTIFY-01 criterion 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Listed and counted only while the recipient may read the subject, by the same predicates as the reads; worded by the server at read time | Nobody is told about a record they may not read; a former owner's notifications disappear; titles stay current | ✓ |
| Store the wording and a snapshot of access at creation | Leaks titles after access is revoked, and goes stale on renames | |

**Choice:** `[auto] Readability: Q: "How does the centre respect access?"` → read-time readability and wording (recommended default).

---

## 21. Events for an unassigned request (Phase 13's deferral)

| Option | Description | Selected |
|--------|-------------|----------|
| No notification; the queue's unassigned pool is the team's channel | Notifications go to accountable people; the pool already counts unassigned work | ✓ |
| Fan out to every human Security Analyst | Noisy, and trains people to ignore the centre | |

**Choice:** `[auto] Unassigned: Q: "Who is told when no analyst is assigned?"` → nobody; the queue is the channel (recommended default).

---

## 22. Delivery, refresh and email (decision 18, G-7, do-not 9)

| Option | Description | Selected |
|--------|-------------|----------|
| In-app only; the count refreshes on server renders and after the person's actions, with no polling; channel-neutral so Phase 20 adds email as its own delivery facts | Matches decision 18's split and the direction's do-not 9; nothing leaves the machine before Phase 20's capture provider | ✓ |
| Poll the count every minute | Auto-refreshing visible content without a control, which the direction forbids | |
| Email from Phase 17 | Rejected by G-18: the email channel and its capture provider arrive in Phase 20 | |

**Choice:** `[auto] Delivery: Q: "How do notifications reach people in this phase?"` → in the app, refreshed on render (recommended default).

---

## 23. Development fixtures and Keycloak files (ADR 0004)

| Option | Description | Selected |
|--------|-------------|----------|
| Maya stays the unrelated Requestor; a new first-line risk owner persona with a fixed Keycloak id in `development-fixture-subjects.ts` and a matching realm user, changed together | The new persona is the flow's central first-line actor, so a local Keycloak sign-in can walk the whole flow; the existing unit test proves the files agree, and Keycloak is never started | ✓ |
| A persona with no Keycloak subject, as Maya and Phase 13's second analyst | Untouched ADR 0004 files, but the risk owner could not sign in to a local Keycloak | |
| Reuse Maya as the risk owner | The journey needs both a different owner and an unrelated Requestor | |

**Choice:** `[auto] Fixtures: Q: "Which personas, and do they get Keycloak subjects?"` → a new persona with consistent Keycloak fixtures (recommended default).

---

## 24. The authorisation matrix (Phase 8 D-16)

| Option | Description | Selected |
|--------|-------------|----------|
| A seventh caller, `riskOwner`, on every row | Proves for every route that participation opens the assessment reads and nothing else; later phases must state the caller's outcome for each new route | ✓ |
| Keep six callers and cover risk owners in integration tests | Cheaper, but a later route could leak to participants unnoticed | |

**Choice:** `[auto] Matrix: Q: "How is the participant class proven across routes?"` → a seventh matrix caller (recommended default).

---

## 25. The journey slice and "the analyst cannot accept" (stage rules §3)

| Option | Description | Selected |
|--------|-------------|----------|
| Create `risk-owner-journey.spec.ts` with the pick-up, nomination, release for response, both responses, decisions and a confirmed reassessment, with Maya refused at each step, the owner refused on Jane's risks, and the analyst refused a response | Every negative case the slice can carry before acceptance exists; 17.1 continues from its end | ✓ |
| Stop the slice at release for response | Leaves success criteria 3 to 5 out of the shared journey | |

**Choice:** `[auto] Journey: Q: "What does Phase 17's slice cover?"` → the full response stage with its negatives (recommended default).
**Notes:** Before 17.1, "the analyst cannot accept" reads as "the analyst cannot respond on a participant's behalf". A second phase spec covers success criterion 1's refusals, the search bounds, a second round, the editing pause, the interim release with the owner's print and export, and the notification centre.

---

## 26. Phase size

| Option | Description | Selected |
|--------|-------------|----------|
| Report the phase as beyond L and propose a split to the orchestrator, keeping the decisions grouped so the notification centre can move | Four new content types, a cross-cutting read with a new matrix caller, an AI operation, seven event hooks and three surfaces exceed Phase 10's 23-plan L | ✓ |
| Keep it at L silently | The plans would overrun | |
| Split it here | Out of this unit's remit (the stage rules leave splits to the orchestrator) | |

**Choice:** `[auto] Size: Q: "Does the phase fit L?"` → beyond L; a split proposed in the return (recommended default).

---

## Claude's Discretion

Recorded as the planner's discretion in CONTEXT.md: module placement; operation, Function, reason-code, kind and vocabulary names; bounds (rounds, items, text lengths, page sizes, risks per reassessment run); how notification readability is applied to counts; draft save granularity; the persona's name, email and label; the lifecycle step's skipped presentation; how plans split; copy, layout and visuals (the UI-SPEC's).

## Deferred Ideas

A response due date and reminders; "named as risk owner", control-owner and AI-proposals-ready notifications; files on responses; custom controls; participant access to the risk history and a rounds history view (17.2); team fan-out, real-time push, digests and preferences (NOTIFY-03); a notification retention setting (Phase 22); a 404 for a participant's request read; same-name disambiguation and rate limiting in the people search; reassessing the overall control effectiveness.
