# Phase 15: Steerable questionnaire AI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 15-steerable-questionnaire-ai
**Mode:** `--auto`, one pass.
- Every area was selected automatically. Each question took the recommended option with no user prompt: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005), at the G-4 premium bar, consistent with `NEXT-WAVE-DECISIONS.md` and the post-demo decisions G-11 to G-18.
- **The orchestrator seeded:**
  - QUES-11 and QUES-12, UAT-017 and UAT-018, and decisions 4 and 5, G-3 and the advisory-AI rule;
  - a proposal operation and job, human-analyst-only, on Phase 12's run record, reviewed per question with visible "Confirm";
  - nothing reaching the Requestor before release;
  - "Rewrite in plain language", and follow-ups after a marked note;
  - instruction, time and analyst in the revision timeline;
  - concurrency with a Requestor who is answering;
  - API changes only unless a content-type change is found.
- **The scout confirmed or corrected each seed:**
  - **Confirmed: the rule decision 4 reverses.** `persistGeneratedQuestionnaire` refuses `QUESTIONNAIRE_ANSWERED` once any answer evidence exists, and hard-deletes the replaced question rows.
  - **Confirmed: questions change only in analyst review.** `assertQuestionnaireInAnalystReview` allows it only while the questionnaire is unreleased and no assessment exists, so confirmations belong there.
  - **Confirmed: answers are private before submission.** The analyst's question read masks every answer unless the whole active batch is submitted (`projectQuestions`), and a return to analyst review turns submitted answers back into drafts. What the AI may see therefore follows that rule (Phase 10 D-07, T-10-21).
  - **Corrected: the save path does not re-check the release.** The Requestor's answer save checks the release fact only in the policy, before its transaction, so a save can land just after a return to analyst review. D-25 closes it.
  - **Corrected: no content-type change is needed.** The open-proposal state derives from Phase 12's runs, so the seed's "API changes only" holds, with two dated amendments to approved records and an approval checkpoint.
  - **Corrected: replacement discards analyst work.** Phase 10's "Replace questionnaire" still discards analyst changes after a confirmation. Decision 4 narrows it (D-09).
- **Rulings that landed during the discussion** were folded in:
  - the orchestrator's 2026-10-01 confirmations in `16-CONTEXT.md` settle one closed "no longer open" code, Phase 12's, so this phase adds no `AI_PROPOSAL_NOT_OPEN`, and confirm visible "Confirm" across Phase 16;
  - G-19 moves the in-app notification centre to the new Phase 19.1, which runs after this phase.
- No todo matched the phase (`todo.match-phase 15`: 0). No `.continue-here.md`, SPEC.md or checkpoint existed, no discuss hooks were active, no spike or sketch findings exist, and no codebase maps exist (grep fallback).
- The discussion completed in one pass, so no `15-DISCUSS-CHECKPOINT.json` remains.

**Areas discussed:**
1. What changes the schema
2. Where the open-proposal state lives
3. Proposals or replacement
4. What "answered" means, and how answered questions stay fixed
5. When proposals can be requested and decided
6. Where confirmation happens
7. Open proposals and the next workflow step
8. "Replace questionnaire" after this phase
9. The questionnaire-wide operation
10. "Rewrite in plain language"
11. An instruction on first generation
12. What a proposal item holds
13. What the context holds
14. Wire shape, adapter and deterministic provider
15. Jobs
16. The instruction slot
17. The instruction validator and the Requestor-text guard
18. Where the instruction is logged and shown
19. The proposal item core
20. The decision operation
21. Edit before confirming
22. Applying a confirmed item
23. Undo
24. Several runs at once
25. Concurrency with the Requestor
26. The revision timeline
27. Question origin
28. Notes and the AI-input signal
29. Answer privacy and the data policy
30. Grants
31. A requesting analyst on their own request
32. Surfaces, copy and extensions
33. The premium bar and the route
34. Verification and plan shape

---

## 1. What changes the schema (G-6)

| Option | Description | Selected |
|--------|-------------|----------|
| No content-type change; dated amendments to the Phase 12 run-record record and the 06.8 governance-facts record, approved at one checkpoint | Phase 12's run record was designed for Phases 15 to 17; the governance log and the question envelope already hold everything else; the amendments change stored formats later phases read, so G-6 approval applies | ✓ |
| A new `aiProposals` JSON attribute on `CsrmQuestionnaire`, with a contract-gap record and checkpoint | A current fact on the aggregate, like Phase 16's assessment count; but a schema change the ROADMAP does not expect, for state the runs already hold | |
| Amendments without a checkpoint (Phase 10 D-01's precedent) | Faster, but the proposal envelope is a stored audit format that Phases 16, 17 and 21 depend on | |

**Choice:** `[auto] Contract: Q: "Does Phase 15 change a content type, and how are its stored formats approved?"` → no content-type change; two dated amendments with an approval checkpoint (recommended default).

---

## 2. Where the open-proposal state lives

| Option | Description | Selected |
|--------|-------------|----------|
| An item's state is a pure fold of the run's append-only decision events; gates and reads compute open items from the questionnaire's completed proposal runs (bounded), failing safe | No schema change; the AI's proposal stays immutable; a damaged run never blocks a release or a draft, and its items can never be confirmed | ✓ |
| Mutable item states inside the run's `proposal` envelope | One read per run, but blurs "what the AI proposed" with "where it stands" | |
| A per-questionnaire current fact (a new attribute) | Needs a schema change (area 1) | |

**Choice:** `[auto] State: Q: "How do gates know a questionnaire has open proposals?"` → folded from the runs' decision logs (recommended default).
**Notes:** 06.8's rule that gates never parse a log protects access decisions, which must never deny a legitimate read. These gates protect no access, so failing open is the safe direction for them.

---

## 3. Proposals or replacement (decision 4)

| Option | Description | Selected |
|--------|-------------|----------|
| Every AI change to an existing questionnaire is a run of items (add, change, remove), each confirmed or rejected by an analyst | Decision 4 verbatim; per-change human decisions recorded (decision 6); the AI is no longer locked out once answers exist | ✓ |
| Allow whole regeneration once answers exist, keeping answered questions | Still discards analyst edits wholesale; decision 4 rejects option (c) "regenerate everything" | |
| Keep the refusal once answers exist (today) | The finding itself (UAT-018) | |

**Choice:** `[auto] Model: Q: "How does the AI change a questionnaire that already exists?"` → proposals only (recommended default).

---

## 4. What "answered" means, and how answered questions stay fixed (QUES-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Answered is a non-empty value, draft or submitted (the progress rule); three layers (context, adapter, confirmation) and one answer-preservation predicate | "N of M answered" and the fixed set agree; indirect harm (a controller change hiding an answered dependent) is caught | ✓ |
| Answered means submitted only | A draft answer the Requestor is writing could be invalidated by an AI change | |
| Any answer envelope counts, even an empty one (`hasQuestionnaireAnswerEvidence`) | Freezes questions the Requestor cleared, which lose nothing if changed | |
| The AI is trusted to leave answered questions alone | Decision 5 makes the server, not the instruction or the model, the authority | |

**Choice:** `[auto] Fixed: Q: "Which questions can the AI never touch, and how is that enforced?"` → the progress rule, enforced three times (recommended default).

---

## 5. When proposals can be requested and decided

| Option | Description | Selected |
|--------|-------------|----------|
| Request in analyst review and on a submitted questionnaire; confirm only in analyst review; reject until the draft; nothing once the draft exists or starts | UAT-018 asks for an AI route "before and after Return to analyst review"; nothing reveals which questions hold a draft answer while the Requestor is still answering | ✓ |
| Request at any time before the draft, including while the Requestor is answering | Proposals and staleness would reveal which questions hold a draft answer (Phase 10 D-07 keeps a count only) | |
| Request and decide only in analyst review | Simple, but the AI could never use submitted answers, because a return turns them back into private drafts | |

**Choice:** `[auto] States: Q: "In which questionnaire states can proposals be requested and decided?"` → the D-06 table (recommended default).

---

## 6. Where confirmation happens (QUES-12 criterion 3; success criterion 4)

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm only in analyst review; a confirmed item reaches the Requestor only through the 06.8 release | Reuses the existing gate (`releasedAt`); "nothing reaches the Requestor until release" holds structurally | ✓ |
| Confirm on a released questionnaire, staging the change until the next release | Needs a per-question pending state, and touches the Requestor's projection, progress and submission rules | |
| Confirming on a released questionnaire returns it to analyst review automatically | Hides a governance step (the return needs a reason, 06.8 D-16) inside another action | |

**Choice:** `[auto] Confirmation: Q: "Where can an analyst confirm a proposal?"` → analyst review only (recommended default).

---

## 7. Open proposals and the next workflow step (decision 6)

| Option | Description | Selected |
|--------|-------------|----------|
| Release, draft generation and replacement are refused while an item is open or a proposal job runs; "Reject remaining" clears a run in one step | Every proposal ends in a person's decision before the questionnaire moves on; parity with Phase 16 D-42 | ✓ |
| No gate; open items stay open and lapse when the draft freezes the questionnaire | Low friction, but leaves proposals with no human decision on record | |
| Gate release only | The draft could still strand items requested on a submitted questionnaire | |

**Choice:** `[auto] Gates: Q: "What happens to undecided proposals when the questionnaire moves on?"` → refuse until decided (recommended default).

---

## 8. "Replace questionnaire" after this phase (decision 4; Phase 10 D-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it only while nothing would be lost: unreleased, no answer, no analyst change since the latest generation, no open proposal | Decision 4: analyst edits change only through a proposal the analyst confirms; a clean "start again" stays for an untouched questionnaire; matches Phase 16 D-24's reading | ✓ |
| Keep Phase 10's version (discard analyst changes after a confirmation) | Contradicts decision 4's protection of analyst edits | |
| Retire it entirely | Loses the clean restart for an untouched questionnaire, which proposals would turn into many soft removals | |

**Choice:** `[auto] Replace: Q: "What happens to whole replacement once proposals exist?"` → narrowed to when nothing is lost (recommended default).
**Notes:** This narrows Phase 10 D-08, which Phase 10 builds before this phase. Phase 10's confirmation and its `regenerated` event remain; the confirmation now always says no analyst change is discarded.

---

## 9. The questionnaire-wide operation (QUES-11; QUES-12; success criterion 1)

| Option | Description | Selected |
|--------|-------------|----------|
| One operation with an optional instruction; with none, the default task proposes what new information and the answers leave open; additions, changes and removals, bounded | Serves "add questions about offshore support" and "suggest follow-up questions" with one contract | ✓ |
| Separate "steer" and "follow-up" operations | Two grants, rows and parsers for one concept | |
| Instruction required | "Suggest follow-up questions" from a marked note is the main QUES-12 path and needs no typing | |

**Choice:** `[auto] Operation: Q: "What does the questionnaire-wide AI action take and return?"` → one operation, optional instruction (recommended default).

---

## 10. "Rewrite in plain language" (success criterion 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Per unanswered question; one change item limited to text, help text and choice labels; optional instruction, plain language by default | Simplifies wording without changing what the question collects | ✓ |
| A questionnaire-wide preset only | The criterion names one question | |
| Let the rewrite change type and choices too | Would change what an answer means; a structural change belongs in the questionnaire-wide operation | |

**Choice:** `[auto] Rewrite: Q: "What can a plain-language rewrite change?"` → wording only (recommended default).

---

## 11. An instruction on first generation (UAT-017)

| Option | Description | Selected |
|--------|-------------|----------|
| The generation operation and the narrowed replacement take the same optional instruction, through the same validator and slot | UAT-017 records that "Generate and 'Replace unanswered questionnaire' take no input"; the slot Phase 12 left empty is filled once for every operation | ✓ |
| Steering only after generation | Leaves half of UAT-017's "Actual" open | |

**Choice:** `[auto] Generation: Q: "Can the first generation be steered?"` → yes, optionally (recommended default).

---

## 12. What a proposal item holds

| Option | Description | Selected |
|--------|-------------|----------|
| Kind, target, the proposed question in Phase 12's style (help text, "Not sure", no Boolean or File upload), placement at the end of a section or in a new section, optional visibility on an earlier question, rationale and sources, and its base | Reviewable, citable and safe to apply; no reordering of existing (possibly answered) questions | ✓ |
| Free placement anywhere, reordering others | Reordering would change answered questions' options | |
| No sources | The analyst could not check why a question is proposed (INT-06's posture) | |

**Choice:** `[auto] Item: Q: "What does each proposed change contain?"` → the full item (recommended default).

---

## 13. What the context holds (INT-05; G-3)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 12's builder plus marked notes and opted-in files; the questionnaire with each question's answered state; answer content only when the analyst may read it; open, rejected and removed items listed so nothing repeats; a smaller rewrite context | QUES-12 criterion 1, data minimisation, and Phase 10 D-07's privacy control holding for the AI too | ✓ |
| Always send every answer, drafts included | The analyst would see draft content through the AI's output; breaks T-10-21 | |
| Never send answer content | The AI could never follow up on what the Requestor actually said | |

**Choice:** `[auto] Context: Q: "What does the AI receive for a proposal?"` → the minimised context, with answers only when readable (recommended default).

---

## 14. Wire shape, adapter and deterministic provider (06.7 D-14; Phase 12 D-15)

| Option | Description | Selected |
|--------|-------------|----------|
| A model-friendly wire shape in the Azure strict subset; the adapter assigns server values and drops what it cannot accept, recording each drop; the closed parser is the gate; a rule-based deterministic provider | The established pattern; every guarantee is server-side; hermetic suites | ✓ |
| Trust the model's targets and validate only at confirmation | Invalid items would reach the analyst | |

**Choice:** `[auto] Providers: Q: "How is model output made safe and testable?"` → the established pattern (recommended default).

---

## 15. Jobs (R-08-36)

| Option | Description | Selected |
|--------|-------------|----------|
| In-process registry, single flight per questionnaire and per question, read and retry by any eligible analyst, retry as a new run by the retrier, policy at enqueue and execution, reusing the questionnaire provider settings | Matches Phase 10, 12 and 13; no new setting | ✓ |
| Synchronous calls | 20 to 25 second provider calls in a Server Action | |
| A persisted job store | R-08-36 stays open until a multi-process deployment | |

**Choice:** `[auto] Jobs: Q: "How do proposal runs execute?"` → the registry pattern (recommended default).

---

## 16. The instruction slot (decision 5)

| Option | Description | Selected |
|--------|-------------|----------|
| Its own escaped slot; system instructions say it steers but cannot change rules, format or limits; the server enforces every rule whatever it says; built only from the analyst's field, a preset or nothing | Decision 5 made structural, and testable on the captured prompt | ✓ |
| Treat the instruction as untrusted data | The model would ignore the analyst's steer | |
| Put the instruction in the system prompt | Gives analyst text system authority, unbounded | |

**Choice:** `[auto] Slot: Q: "How is the analyst's instruction placed in the prompt?"` → trusted but bounded slot (recommended default).

---

## 17. The instruction validator and the Requestor-text guard

| Option | Description | Selected |
|--------|-------------|----------|
| One shared validator: 1 to 500 characters, plain text, control and invisible formatting characters refused, and a guard against pasting a long passage of the Requestor's own text; reused by Phases 16 and 17 | "Bounded" and "never holding Requestor text" become enforceable; the stored instruction reads as written | ✓ |
| Length only | "Never holding Requestor text" stays a policy nobody checks | |
| Classify instructions with the model | Non-deterministic, and a second untrusted channel | |

**Choice:** `[auto] Validator: Q: "What does the shared instruction validator check?"` → bounds, characters and the quote guard (recommended default).
**Notes:** The guard's corpus excludes draft answers, so a refusal can never reveal them. The threshold (proposed 60 characters) is research's.

---

## 18. Where the instruction is logged and shown (QUES-11 criterion 3)

| Option | Description | Selected |
|--------|-------------|----------|
| The run's `instruction` with its source (analyst, preset or default), a snapshot in the timeline event, the panel and the run sheet; analysts only, plain text | The run record and the timeline both carry it, as criterion 3 asks | ✓ |
| Run record only | Success criterion 3 needs it in the timeline | |

**Choice:** `[auto] Logging: Q: "Where is the instruction recorded?"` → run and timeline (recommended default).

---

## 19. The proposal item core

| Option | Description | Selected |
|--------|-------------|----------|
| Built generically here first (states, append-only decisions, bases and staleness, supersede and lapse, caps), with question items as its first target kind; Phase 16 and Phase 17 add target kinds | Phase 15 executes before Phase 16; one mechanism across the product | ✓ |
| Questionnaire-specific now, generalised in Phase 16 | Two mechanisms, or a rewrite of this phase's code a phase later | |

**Choice:** `[auto] Core: Q: "Is the proposal lifecycle questionnaire-specific or shared?"` → shared, built here (recommended default).

---

## 20. The decision operation (Phase 12 D-24)

| Option | Description | Selected |
|--------|-------------|----------|
| One batch operation per questionnaire: accept (optionally with edits), reject (optional reason) and restore; all or nothing; repeats are no-ops; inside the questionnaire's serialisation | The questionnaire counterpart Phase 12 anticipated; one Server Action per batch | ✓ |
| Extend Phase 12's assessment decision operation to questionnaires | The record-level check belongs to the record being changed | |
| One operation per action | More grants, rows and parsers for one concept | |

**Choice:** `[auto] Decisions: Q: "What does deciding a proposal call?"` → the per-questionnaire batch operation (recommended default).
**Notes:**
- Visible copy is "Confirm", following Phase 12 UI-D1 and the orchestrator's confirmation of 2026-10-01; the API keeps `accept`.
- A decision on an item that is no longer open uses Phase 12's single closed code, per the orchestrator's 2026-10-01 confirmation in `16-CONTEXT.md`; `AI_PROPOSAL_STALE` is new here and reused by Phase 16.

---

## 21. Edit before confirming (the seed's "accept, edit or reject")

| Option | Description | Selected |
|--------|-------------|----------|
| "Edit, then confirm": the analyst's edits apply with the confirmation, through the manual edit's rules, recorded as accepted with the edited fields | One step; the origin reads "edited"; no intermediate state | ✓ |
| Confirm, then edit with the governance editor | Two steps, and a moment where the unedited version is the record | |

**Choice:** `[auto] Edit: Q: "How does an analyst adjust a proposal?"` → edit then confirm (recommended default).

---

## 22. Applying a confirmed item

| Option | Description | Selected |
|--------|-------------|----------|
| Additions use the governance editor's key rule and placement at the end of a section; changes use the manual edit's validation; removals use the existing soft removal; the answer-preservation check runs on the result | No parallel write path; keys never collide, removed ones included (Phase 12 D-18's seam) | ✓ |
| `q-N` keys continuing the generation's sequence | Collides with removed or analyst-added keys unless the same allocator checks them all | |

**Choice:** `[auto] Apply: Q: "How does a confirmed item change the questionnaire?"` → through the existing governance rules (recommended default).

---

## 23. Undo (G-4, X-14)

| Option | Description | Selected |
|--------|-------------|----------|
| Undo a confirmation while in analyst review and the question is unchanged and unanswered: an addition is soft-removed, a change reverts, a removal is restored (`question-restored`); undo a rejection while the run can be decided; every undo recorded | G-4 asks for Undo on reversible acts; the history keeps both steps | ✓ |
| Hard-delete an undone addition | Removes evidence the timeline already names | |
| No Undo for removals | Inconsistent with Undo everywhere else | |

**Choice:** `[auto] Undo: Q: "What does Undo do after a decision?"` → restore with a recorded reverse (recommended default).

---

## 24. Several runs at once

| Option | Description | Selected |
|--------|-------------|----------|
| Runs coexist and a new run's context lists open items; a newer rewrite of the same question supersedes the older; conflicts resolve by staleness; late completions lapse | Nothing the analyst has not decided is lost; parity with Phase 16 D-31, D-37 and D-40 | ✓ |
| A new run supersedes all open items | Clicking "Rewrite" on one question would discard undecided follow-ups | |
| Refuse a new run while items are open | Friction with no governance value | |

**Choice:** `[auto] Coexistence: Q: "What happens when the analyst asks again before deciding?"` → coexist, with supersede for rewrites (recommended default).

---

## 25. Concurrency with the Requestor (the seed)

| Option | Description | Selected |
|--------|-------------|----------|
| A question answered while an item on it is open makes the item stale and refused at confirmation; the Requestor's save and submit re-check the release fact inside their transaction; both sides share the row lock | Closes the race the scout found, where a save could land just after a return to analyst review | ✓ |
| Staleness only | The race stays; a confirmation and an answer could interleave | |

**Choice:** `[auto] Concurrency: Q: "How do proposals and a Requestor who is answering stay consistent?"` → staleness plus the re-check (recommended default).

---

## 26. The revision timeline (success criterion 3; Phase 10 D-17, D-18)

| Option | Description | Selected |
|--------|-------------|----------|
| One AI proposal event per completed run (instruction, analyst, time, provider and model, scope, item count), and AI source keys on the question events a confirmation writes; the Requestor sees none of it | Every proposal shows in the timeline whatever happens to its items; the question changes stay where Phase 10 counts them | ✓ |
| Resolve the instruction from the run at read time | The timeline would depend on a second record and a second lookup | |
| One event per rejected item too | Rejections change nothing on the questionnaire; the run record keeps them (decision 6) | |

**Choice:** `[auto] Timeline: Q: "What does the revision timeline record for AI proposals?"` → a run event plus sourced question events (recommended default).

---

## 27. Question origin (Phase 12 D-22)

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmed and edited-before-confirming origins derived from the sourced events; the release dialog counts only questions still awaiting review; `generation.runId` resolves the latest generation run | Confirmed AI questions read as reviewed; the provenance header keeps pointing at the generation | ✓ |
| Treat confirmed items as analyst-added | Hides that the AI wrote them (INT-06) | |

**Choice:** `[auto] Origin: Q: "How does a confirmed AI question read?"` → AI-written and confirmed (recommended default).

---

## 28. Notes and the AI-input signal (Phase 13 D-27, D-29)

| Option | Description | Selected |
|--------|-------------|----------|
| Marked notes only; questionnaire-wide runs clear the questionnaire's signal; rewrites do not; this phase attaches "Suggest follow-up questions" to the signal | Phase 13's rule exactly; success criterion 1 marks the offshore note first | ✓ |
| Every note enters the context | Contradicts Phase 13 D-27 (only marked notes) and G-3 | |

**Choice:** `[auto] Notes: Q: "Which notes reach the AI, and what clears the signal?"` → Phase 13's rules (recommended default).

---

## 29. Answer privacy and the data policy (G-3; Phase 10 D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Answer content only when the analyst may read it; in analyst review the analyst sees which questions are answered, never the answer; the policy applies to every operation | The narrowest widening that lets an analyst see what the AI may not change; a manual edit already reveals it | ✓ |
| Show no per-question answered state | The analyst could not see why questions are fixed (decision 4) | |
| Show draft answers to analysts in analyst review | Breaks Phase 10 D-07 and T-10-21 | |

**Choice:** `[auto] Privacy: Q: "What may the AI and the analyst see of the Requestor's answers?"` → the narrow rule (recommended default).
**Notes:** Keeping submitted answers visible after a return to analyst review is recorded as a deferred idea; it needs its own decision.

---

## 30. Grants (G-1; Phase 12 D-32)

| Option | Description | Selected |
|--------|-------------|----------|
| New API-only Functions for the human Security Analyst only, plus `HUMAN_ANALYST_ONLY_OPERATIONS`; no service agent; the assignee does not narrow who decides (decision 10) | Every run names an accountable human; a later catalogue edit cannot reach automation | ✓ |
| Reuse the questionnaire governance Functions | Mixes grants for different capabilities | |

**Choice:** `[auto] Grants: Q: "Who may request and decide proposals?"` → human analysts, through new human-only Functions (recommended default).

---

## 31. A requesting analyst on their own request (G-1; Phase 13 D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| No AI-steering control on a request they raised (start, read, decide, retry, an instruction on generation), refused with `OWN_REQUEST`; generating without an instruction stays as Phase 12 allows | Steering what one is asked oneself is the conflict G-1 removes, read as Phase 13 read it for the AI-input mark | ✓ |
| No restriction | Inconsistent with Phase 13 D-07 | |
| Also refuse manual question edits | Beyond this phase; Phase 13 deferred it | |

**Choice:** `[auto] G-1: Q: "Can an analyst steer the AI on a request they raised?"` → no (recommended default).

---

## 32. Surfaces, copy and extensions

| Option | Description | Selected |
|--------|-------------|----------|
| An "AI proposals" panel on the questionnaire page in every state before the draft, a rewrite action on each unanswered row, the hub's entry with the signal and open count; "Confirm", "Reject" and "Undo"; Confirm per item, "Reject remaining" per run; reuse X-1, X-3, X-5, X-10 to X-14; the before-and-after comparison shared with Phase 16 | Each question reviewed on its own (QUES-11 criterion 2); one comparison pattern across the product | ✓ |
| A bulk "Confirm remaining" | Undermines per-question review; the UI-SPEC may revisit with a reason | |
| Proposals in a modal over the hub | Separates proposals from the questions they change | |

**Choice:** `[auto] Interface: Q: "Where do proposals appear, and in what words?"` → the panel, per-item decisions (recommended default).

---

## 33. The premium bar and the route (G-4)

| Option | Description | Selected |
|--------|-------------|----------|
| Keyboard path, optimistic decisions with rollback and Undo, no confirmation for reversible acts, skeletons, empty states, no lost input, density, reduced motion, phone cards and sheets, figures that open records; heavy parts on demand and zod-free | G-4 item by item, and the route stays light | ✓ |

**Choice:** `[auto] Bar: Q: "How does the interface meet G-4?"` → the full bar (recommended default).

---

## 34. Verification and plan shape

| Option | Description | Selected |
|--------|-------------|----------|
| RED first at each seam; mounted proofs of every refusal and state; matrix rows; web units; one new Playwright spec with its own records at 375px and 1440px; existing specs named where they change; no slice of the post-demo journey; amendments and their checkpoint first; serialised by shared files; size at the top of M | Hermetic; every criterion and negative case proven in the API and the UI | ✓ |

**Choice:** `[auto] Verification: Q: "How is the phase proved and sequenced?"` → the recommended option.

---

## Claude's Discretion

- Module placement for the shared instruction validator and proposal item core, the questionnaire proposal services and the web feature folder.
- Names of operations, Functions, reason codes, run operations, event kinds and keys, within the proposed families.
- Exact bounds: items and additions per run, runs per questionnaire, decided items in the read, and the quote-guard and near-duplicate thresholds.
- The deterministic providers' rules and wording.
- Whether Requestor saves and analyst governance share one in-process serialisation.
- How the work splits into plans, given the serialisation by shared files.
- Copy, layout and visuals, which the UI-SPEC fixes.

## Deferred Ideas

- Analysts keep seeing the last submitted answers after a return to analyst review, so proposals made there could use them (a decision on Phase 10 D-07 and an answer-envelope amendment).
- A notification when AI proposals are ready (Phase 19.1's notification centre, G-19).
- Open-proposal counts on the questionnaire review list and the analyst Home (Phase 21).
- A bulk "Confirm remaining" (the UI-SPEC may revisit it with a recorded reason).
- AI-proposed reordering of existing questions and moving questions between sections.
- "Why we are asking" text for the Requestor on follow-up questions.
- G-1 on Phase 12's run read for a requesting analyst (Phase 17.1).
- Local model evaluation of these operations (backlog 999.1).
