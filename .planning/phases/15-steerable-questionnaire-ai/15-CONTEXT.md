# Phase 15: Steerable questionnaire AI - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`, one pass. Every gray area took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005 risk identification and communication; decision 6's record of what the AI proposed and what a person decided), at the G-4 premium bar. The decisions are grounded in:
- the product gap UAT (`.planning/uat/product-gaps/`: UAT-017 and UAT-018, JOURNEYS.md area 2, REPORT.md §8 and §9);
- the delegated decisions in `.planning/NEXT-WAVE-DECISIONS.md` (#4, #5, #6, #10, G-1, G-3, G-4, G-6, G-7, and the post-demo G-11 to G-18 where they touch this phase);
- the orchestrator's seeds for this unit, each confirmed or corrected against the code;
- the planned outputs of Phase 10 (CONTEXT and 23 plans), Phase 12 (CONTEXT with its Orchestrator Confirmations, RESEARCH, UI-SPEC and PATTERNS), Phase 13 (CONTEXT) and Phase 16 (CONTEXT, which reuses this phase's instruction slot and validator);
- a read of today's code in `apps/backend` and `apps/csrm`.

There is no SPEC.md for this phase. The discussion log is `15-DISCUSSION-LOG.md`.

**Plans are written ahead.** Phase 15 executes after Phases 10 to 14 (execution order 10, 11, 12, 13, 14, 15, 16). Its plans are written against today's code plus the planned outputs of those phases, name the earlier plans they rely on, and get a fresh plan check just before execution (STATE.md, "Next wave planning method"). Phase 12 is not built yet: `CsrmAiRun`, `apps/backend/src/csrm/ai/` and `apps/csrm/src/features/ai-assistance/` do not exist today.

<domain>
## Phase Boundary

Let a Security Analyst steer the questionnaire AI with an instruction, and have it propose additions, changes and removals, including follow-up questions once answers exist, without ever touching an answered question or its answer. Every proposal ends in an analyst's decision per question, is recorded with its instruction, initiating analyst, time and provider, and reaches the Requestor only when the analyst releases the questionnaire.

In scope:
- a questionnaire-wide proposal operation ("Suggest follow-up questions", optionally steered by an instruction) and a per-question "Rewrite in plain language", as human-analyst-only jobs on Phase 12's run record;
- the analyst instruction slot and its validator, shared with Phases 16 and 17, and the same optional instruction on first generation and on the narrowed replacement;
- the run-scoped proposal item core (states, decisions, bases and staleness, Undo), built first here and extended by Phases 16 and 17;
- the questionnaire decision operation, Phase 12 D-24's questionnaire counterpart;
- the rules that keep answered questions fixed and proposals away from the Requestor, including the concurrency rules with a Requestor who is answering;
- the revision timeline entries for proposals and confirmed changes;
- the gates that keep open proposals from being left behind, and the narrowed "Replace questionnaire";
- the dated amendments to two approved contract-gap records, their approval checkpoint, the grants, the authorisation proofs, the interface and the tests.

Out of scope:
- any content-type change (D-01);
- risk proposals, withdrawal and history (Phase 16), residual reassessment (Phase 17);
- notes and attachments themselves (Phases 13 and 14; this phase reads what they feed the context);
- notifications, including "AI proposals ready" (Phase 19.1's centre, decision 18 and G-19);
- changing what an analyst sees of answers before submission, beyond D-30's answered-or-not marker in analyst review;
- the questionnaire after its assessment draft exists (frozen, as today);
- manual question editing rules (Phase 10's), Keycloak, and live AI in any automated suite.
</domain>

<requirements>
## Requirements and Success Criteria This Phase Owns

**QUES-11:** A Security Analyst can instruct the AI to add, change or remove questions, and accept or reject each proposed change.
- (1) An instruction such as "add questions about offshore support" or "rewrite in plain language" returns a proposal of additions, edits and deletions: D-10, D-11, D-13.
- (2) Each proposed change is accepted or rejected on its own, and nothing changes until accepted: D-04, D-07, D-20 to D-23, D-33.
- (3) The run record and the revision timeline show the instruction, the initiating analyst, the time and the provider: D-19, D-26, D-28.
- (4) The instruction travels in its own slot, never mixed with Requestor text (decision 5): D-17, D-18.

**QUES-12:** After answers exist, a Security Analyst can ask the AI for follow-up questions that keep every answered question and its answer unchanged.
- (1) The proposal uses the request, the notes marked as changing the AI inputs (COLLAB-01) and the answered questions as fixed context, and adds or revises unanswered questions only: D-05, D-10, D-14, D-29.
- (2) No proposal changes or removes an answered question or its answer: D-05, D-21, D-22, D-25.
- (3) Revised questions reach the Requestor only when the analyst releases them: D-07, D-25.

**ROADMAP success criteria (Phase 15):**
1. After a note about offshore support, the analyst asks for follow-up questions and receives new questions only on that topic, with the answered ones untouched: D-05, D-06, D-10, D-14, D-15, D-29.
2. "Rewrite in plain language" on a question proposes a simpler version the analyst can accept or reject: D-11, D-21.
3. Every AI proposal shows its instruction, time and initiating analyst in the revision timeline: D-19, D-26, D-28.
4. Nothing reaches the Requestor until the analyst releases: D-07, D-25, D-31.

Each criterion is planned in the UI and the API, with its negative cases (see `<authorisation>`).

**Closes:** UAT-017 (the analyst cannot give the AI more information or ask it to add, change or remove questions) and UAT-018 (once any answer exists there is no AI re-run of the question list).
**Intent:** F4, A2 (the Phase 9 human-supervised workflow).
**Reverses:** the Pre-Phase 06.2 decision "regeneration replaces an unanswered questionnaire and is refused once any answer exists" (`.planning/milestones/v1.0-STATE.md`, line 46), by decision 4 (D-04). Narrows Phase 10 D-08 (D-09).
</requirements>

<decisions>
## Implementation Decisions

### Scope and contract boundary

- **D-01:** No content-type change, and no new contract-gap record. Nothing in `apps/backend/src/api/*/content-types/*` changes, and the content-type freeze check proves it.
  - **Where everything lives:**
    - proposals and their decisions: Phase 12's `CsrmAiRun` (`instruction`, `contextSummary`, `proposal`, `decisions`), which Phase 12 D-19 designed so Phases 15 to 17 need no schema change;
    - the timeline: the questionnaire's existing `governanceLog` (06.8);
    - question changes: the existing `CsrmQuestion` attributes and the `options` envelope's soft removal (06.8 D-07);
    - the open-proposal state: derived from the runs (D-20).
  - **Two approved records change, by dated amendments** (the Phase 10 D-01 precedent for an approved envelope):
    1. `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`: the two run operations, the questionnaire proposal envelope (items, bases, adjustments), the item decision events, the context summary's questionnaire section and instruction source, how open items are derived and which way a gate fails safe, and the caps.
    2. `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`: the AI proposal event, the AI source keys on question events, the `question-restored` kind, and the Requestor projection rules.
  - **Approval:** the first plan writes both amendments, then a `checkpoint:decision` where the executor stops and the orchestrator reviews and approves them, recording the approval in each record (G-6), before any code writes the new shapes. They change stored formats that Phases 16, 17 and 21 read.

  **Reversibility:** costly - versioned envelopes persisted in runs and governance logs, which every later reader must accept.
- **D-02:** Every new or changed endpoint follows the established chain (Phase 12 D-02, Phase 13 D-02):
  - exact Role → Function → FunctionAPI grants in both catalogue copies, byte-identical;
  - record-level checks in Strapi against the resolved IdamBox User, never branching on the auth mode;
  - the operation or schema in `docs/references/specification.json`, then `api:generate` and a clean `api:check`;
  - closed parsers registered in the contract parity guard;
  - a row in the six-actor authorisation matrix;
  - `docs/references/served-operations.json` regenerated with the dev servers stopped.

  The server shape and its web parser change in the same plan (the 06.9 lesson). Shared schemas change with every producer in one plan (Phase 12 Pitfall 17).
- **D-03:** The API changes are these, and no others. Names are proposals; research fixes them within these families.
  1. **Start a questionnaire-wide proposal:** `POST /api/v1/questionnaires/{questionnaireId}/ai_proposals`, body `{ instruction? }`, 202 with a job (D-10).
  2. **Start a question rewrite:** `POST /api/v1/questionnaires/{questionnaireId}/questions/{questionId}/rewrite`, body `{ instruction? }`, 202 with a job (D-11).
  3. **Proposal job read and retry:** `GET /api/v1/questionnaire_proposal_jobs/{jobId}` and `POST /api/v1/questionnaire_proposal_jobs/{jobId}/retry` (D-16).
  4. **Proposals read:** `GET /api/v1/questionnaires/{questionnaireId}/ai_proposals`: open items with their staleness, recently decided items, run facts, active jobs, the answered questions where D-06 shows them, and what this viewer may do now (D-20, D-33).
  5. **Decisions:** `POST /api/v1/questionnaires/{questionnaireId}/ai_proposal_decisions`, the questionnaire counterpart Phase 12 D-24 anticipated (D-21).
  6. **Questionnaire generation** (`POST /api/v1/assessment_requests/{requestId}/generate_questionnaire`) gains an optional `instruction` (D-12), and its replacement path gains two refusals (D-09).
  7. **Reads that change shape:**
     - the analyst questionnaire read's `generation` block (Phase 12 D-03 item 2, Phase 13 D-29) gains the open-proposal count;
     - Phase 12's question `aiOrigin` vocabulary gains the confirmed and edited-before-confirming origins (D-27);
     - Phase 12's `AiRun.operation` vocabulary gains the two operations;
     - the governance and timeline event schemas gain D-26's kinds and keys, in the analyst projection only.
  8. **Refusals on existing operations:**
     - questionnaire release, assessment draft generation and questionnaire replacement while proposals are open (D-08);
     - the Requestor's answer save and submit when the questionnaire is no longer released (D-25).
  9. **Closed conflict reasons** join Phase 10's list (both conflict response schemas): `AI_PROPOSALS_OPEN`, `AI_PROPOSAL_STALE`, `QUESTIONNAIRE_HAS_ANALYST_CHANGES`, `QUESTION_ANSWERED`, the instruction reasons (D-18) and the draft-in-progress reason (D-06).
     - **They reuse** Phase 10's `QUESTIONNAIRE_RELEASED`, `QUESTIONNAIRE_NOT_SUBMITTED`, `QUESTIONNAIRE_NOT_ANSWERABLE`, `ASSESSMENT_STARTED`, `QUESTION_REMOVED` and `HISTORY_UNAVAILABLE`, Phase 12's AI policy reasons and `CONTEXT_TOO_LARGE`, and Phase 13's `OWN_REQUEST`.
     - **One "no longer open" code:** a decision on an item that is no longer open (decided, superseded or lapsed) uses Phase 12's single closed code (`AI_PROPOSAL_ALREADY_DECIDED` in `12-RESEARCH.md`), whose meaning covers superseded and lapsed items too. No parallel `AI_PROPOSAL_NOT_OPEN` is added. This follows the orchestrator's confirmation of 2026-10-01 recorded in `16-CONTEXT.md`.
     - **Phase 16 reuses** `AI_PROPOSAL_STALE`, which Phase 15 introduces first (Phase 16 D-03 item 10).
  10. **Catalogue:** new human-analyst-only API Functions (D-31).

  **Reversibility:** costly - published operations, fields and reason codes.

### What the AI may change, and when (decision 4; QUES-12; UAT-018)

- **D-04:** Proposals, not replacements.
  - Once a questionnaire exists, every AI change to it is a proposal run of items. Each item is an addition, a change to one question or the removal of one question.
  - Nothing changes the questionnaire until a Security Analyst confirms an item (QUES-11 criterion 2).
  - **The reversal:** this is how decision 4 reverses the Pre-06.2 rule. The AI is no longer locked out once answers exist; it proposes. Whole replacement stays refused once any answer exists (`QUESTIONNAIRE_ANSWERED`, unchanged), and D-09 narrows it further.
- **D-05:** Answered questions are fixed (QUES-12 criteria 1 and 2).
  - **Answered** means an active question holding a non-empty answer value, draft or submitted. That is the rule the served progress count already uses (`questionnaire-scope.ts` `hasValue`), so "N of M answered" and the fixed set always agree.
  - **Three layers keep proposals off them:**
    1. the context marks every answered question as fixed, and the system instructions forbid changing or removing it;
    2. the adapter drops any item that targets an answered, removed or unknown question, recording an adjustment;
    3. confirmation re-checks inside the questionnaire's transaction and refuses (D-21).
  - **One pure answer-preservation predicate,** used by the adapter and at confirmation: after applying the item to a copy of the current definition, every answered question keeps every field, stays active and visible, and its answer stays valid. It catches indirect harm, such as a choice change on an unanswered controller question that would hide an answered dependent.
  - **No answer is ever written** by a confirmed item: it creates or changes only unanswered questions, so no `answer-cleared` event can come from the AI.
- **D-06:** When proposals can be requested and decided. Every row is enforced in Strapi and mirrored in the UI.

  | Questionnaire state | Start a proposal or a rewrite | Confirm, or undo a confirmation | Reject, or undo a rejection | Answer content sent to the AI | Answered questions shown to the analyst |
  |---|---|---|---|---|---|
  | In analyst review (never released, or returned to analyst review) | Yes | Yes | Yes | No: drafts stay private (D-30) | Yes, as "Answered", never the answer |
  | Released, and the Requestor has not submitted | No (`QUESTIONNAIRE_NOT_SUBMITTED`): wait for the submission, or return it to analyst review | No (`QUESTIONNAIRE_RELEASED`) | Yes | - | No: the count only (Phase 10 D-07) |
  | Released and submitted | Yes | No (`QUESTIONNAIRE_RELEASED`): return it to analyst review first | Yes | Yes: the analyst can read them | Yes, with the answers |
  | An assessment exists, or its draft job is queued or running | No (`ASSESSMENT_STARTED`, or the draft-in-progress reason) | No | No | - | - |

  - **Why "before and after Return to analyst review":** UAT-018 expects an AI route both on the submitted questionnaire and after a return to analyst review.
  - **Why not while the Requestor is still answering:** the proposals and their staleness would reveal which questions hold a draft answer, which Phase 10 D-07 keeps to a count. In that state the panel lists any open items read-only, with Reject only, and shows no staleness.
  - **A Requestor's revert to draft** (06.1) moves a submitted questionnaire to the second row; open items stay open.
- **D-07:** Confirmation happens only in analyst review, so nothing reaches the Requestor until release (QUES-12 criterion 3; success criterion 4).
  - Questions change only in analyst review (`assertQuestionnaireInAnalystReview`). A confirmed item therefore becomes a question of an unreleased questionnaire, and reaches the Requestor only through the 06.8 release, whose gate reads the dedicated `releasedAt` fact.
  - On a released questionnaire, the panel shows the proposals with Confirm unavailable, and offers Return to analyst review (reason required; the unchanged 06.8 flow).
  - The Requestor never reads a proposal, an instruction, a run or an AI event (D-26, D-31).
- **D-08:** Open proposals are decided before the questionnaire moves on (decision 6).
  - **Refused with `AI_PROPOSALS_OPEN`** while any item of the questionnaire is open, or a proposal job for it is queued or running:
    - questionnaire release;
    - assessment draft generation;
    - questionnaire replacement (D-09).
  - **The remedy is one step:** "Reject remaining" clears a run.
  - **Basis:** decision 6 records what the AI proposed and what a person decided, so no proposal is left without a decision once the Requestor sees the questionnaire or the draft freezes it. This matches Phase 16 D-42's "AI proposals decided".
  - **Fail-safe direction:** D-20's derivation never lets a damaged run block these steps.
- **D-09:** "Replace questionnaire" is narrowed by decision 4. This narrows Phase 10 D-08.
  - **Offered and allowed only while nothing would be lost:**
    - the questionnaire is in analyst review and not released (Phase 10 D-09);
    - it holds no answer (`QUESTIONNAIRE_ANSWERED`, unchanged);
    - it has no analyst change since the latest generation, by Phase 10 D-16's count, which includes confirmed AI changes and undos (else `QUESTIONNAIRE_HAS_ANALYST_CHANGES`);
    - it has no open proposal and no active proposal job (`AI_PROPOSALS_OPEN`).
  - **Checked twice:** at enqueue, and again in the replacement's locked transaction.
  - **Otherwise** the hub offers the proposals instead.
  - **Phase 10's machinery is kept:** its confirmation now always says no analyst change is discarded, and its `regenerated` event is unchanged.
  - **What it reverses:** Phase 10 D-08 discarded analyst changes after a confirmation. Under decision 4, analyst edits change only through a proposal the analyst confirms. It also matches Phase 16 D-24's reading of decision 4 for drafts.

### The operations (QUES-11, QUES-12; UAT-017, UAT-018)

- **D-10:** Questionnaire-wide proposals.
  - **Body** `{ instruction? }`.
  - **With an instruction,** the AI follows it within the rules: add, change or remove, never on an answered question (D-05).
  - **Without one,** it does the default task: propose the questions the questionnaire still needs, given the request, the marked notes and opted-in files, and the answered questions, focusing on what new information leaves open (QUES-12; success criterion 1). The UI-SPEC may word the default action "Suggest more questions" before any answer exists and "Suggest follow-up questions" after.
  - **Bounds:** at most 30 items per run, at most 15 of them additions (proposed; research confirms).
  - **Run:** one per provider call (Phase 12 D-19), operation `questionnaire-proposals`. It is declared context-wide (Phase 13 D-29).
- **D-11:** "Rewrite in plain language" (success criterion 2).
  - **Target:** one active, unanswered question. Refused on an answered question (`QUESTION_ANSWERED`) or a removed one (`QUESTION_REMOVED`), and not offered there.
  - **Body** `{ instruction? }`. Without one it rewrites in plain language, Phase 12 D-16's style: one thing per question, plain words, specialist terms explained in help text.
  - **Output:** exactly one change item. It may alter only the question text, the help text and the choice labels. The answer type, choice values, required flag, section, order and visibility stay, enforced by the adapter.
  - **No change:** an unchanged result completes with no item, and the panel says the AI found nothing to simplify.
  - **Run:** operation `question-rewrite`. It is question-scoped: it includes the marked notes but never clears the signal (Phase 13 D-29).
- **D-12:** An instruction on first generation and on replacement.
  - **Why:** UAT-017 records that "Generate and 'Replace unanswered questionnaire' take no input".
  - **What changes:** Phase 12's questionnaire generation operation and its narrowed replacement (D-09) accept the same optional instruction, through the same validator and slot (D-17, D-18).
  - **Where it shows:** the run records it, the "What the AI used" sheet shows it, and a replacement's `regenerated` event carries its snapshot.
  - **Review:** the generated set is still reviewed as a whole at release (Phase 12 D-22).
- **D-13:** What a proposal item holds.
  - **Kind** (add, change or remove), and the target question for a change or a removal. The target is named by the context's short key, which the adapter maps to its documentId.
  - **The proposed question,** for an addition or a change:
    - question text;
    - help text: one or two sentences, at most 2,000 characters;
    - answer type: never Boolean or File upload, so a yes/no question is Single select with Yes, No and Not sure (Phase 12 D-16);
    - choices, with "Not sure" ensured last on every select (Phase 12 D-16);
    - the required flag, judged per question.
  - **For an addition,** also:
    - its section: an existing section, or a new one by title;
    - an optional visibility rule on an earlier active question, answered or not. A follow-up shown when a given answer was chosen is the common pattern. An existing question never gains a dependency on a new one.
  - **Placement** is computed at confirmation and never reorders existing questions: an addition goes at the end of its section, and a new section goes after the last one.
  - **A short rationale and its sources:** context source ids (a request field, a marked note, an answered question, or the instruction), validated by the adapter. Unknown ids are dropped (Phase 12 D-14's posture). They show as X-12 citations.
  - **The base** the item was proposed against (D-20).
- **D-14:** What the context holds, built by Phase 12's assessment context builder (D-04 to D-08 there).
  - **Questionnaire-wide runs:**
    - the request part, minimised by Phase 12's field table;
    - the selected systems and assets;
    - the Risk Type library, for topics;
    - the marked notes (Phase 13 D-27) and the opted-in attachment text (Phase 14);
    - a questionnaire part: every active question with its short key, section, text, help text, answer type, choices, required flag, visibility, and whether it is answered;
    - answer content only when the analyst may read it at that moment, which is when the whole active batch is submitted (`projectQuestions`' rule; D-30);
    - the items still open from earlier runs, marked "already proposed";
    - items rejected earlier with their reasons, marked "rejected by the analyst";
    - removed questions, marked "removed by the analyst", so the AI repeats none of them.
  - **Rewrite runs:**
    - the target question and its section, and the other active question texts, with no answers;
    - the request part, and the marked notes and files (Phase 13 D-27);
    - not the Risk Type library.
  - **Delimiting and minimisation:** every Requestor-originated value goes in the untrusted data block, and the instruction in its own slot (D-17). No names, ids, dates or record numbers (Phase 12 D-04).
  - **Bounds:** Phase 12 D-06 applies: no silent truncation, and `CONTEXT_TOO_LARGE` before any provider call.
  - **The run's context summary** gains a questionnaire section, never Requestor text (G-3):
    - the questions offered, and how many are answered (fixed);
    - whether answer content was included or withheld;
    - the numbers of open, rejected and removed items listed;
    - the scope;
    - the instruction's source: the analyst, the plain-language preset or the default task.
- **D-15:** Wire shape, adapter, parser and providers (Phase 12 D-15, 06.7 D-14).
  - **The wire shape** is model-friendly and versioned, inside the Azure strict subset (Phase 12 D-06): no `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`, `format` or `const`, at most 100 object properties and five levels of nesting.
  - **The adapter** assigns every server-owned value. It drops what it cannot accept and records each drop as an adjustment the panel shows:
    - items on answered, removed or unknown questions;
    - a rewrite that touches anything but text, help text and labels;
    - an addition near-identical to an active question, an open or rejected item, or a removed question, scored by Phase 12's lexical ranker (`library-ranking.ts`), with thresholds set by research (Phase 16 D-32's posture);
    - an item that fails the answer-preservation check, or makes the definition invalid on its own;
    - items beyond the bounds ("left out", never silently).
  - **The closed context-aware parser** stays the gate (06.7 D-07).
  - **The deterministic provider's rules** read the marked notes, the instruction and the questions, so the suites prove:
    - follow-ups on the topic of a marked note (offshore support), in a new section, citing the note;
    - a plain-language change, and a removal;
    - a conditional follow-up on an answered question;
    - one attempted change to an answered question, dropped by the adapter;
    - one near-duplicate addition, dropped;
    - a rewrite that changes text and help text only.
  - **Live model quality** is the operator's manual check (Phase 12 D-31, D-38).
- **D-16:** Jobs follow the Phase 10, 12 and 13 pattern.
  - **Registry:** in-process (R-08-36); single flight per questionnaire for questionnaire-wide runs and per question for rewrites, so a second start returns the active job; the states queued, running, completed and failed.
  - **Read and retry:** any eligible human analyst who may read the request (Phase 13 D-18). A retry is a new attempt and a new run, initiated by the retrying analyst.
  - **The AI data policy:** checked at enqueue (a 409) and again before the provider call (the job fails and nothing is sent; Phase 12 D-28).
  - **Runs:** created just before the provider call, completed in the transaction that records the proposal and the timeline event (D-26), and marked interrupted at a restart (Phase 12 D-20).
  - **Settings:** the questionnaire operation's provider settings (`config/ai.ts` `questionnaireGeneration`), so no new setting is added.
  - **The panel** shows progress with Phase 10's job-panel pattern: poll, then "Check again".

### Analyst instructions (decision 5; QUES-11 criterion 4)

- **D-17:** The slot: trusted but bounded.
  - **Its own slot:** Phase 12 D-05's second slot, rendered as `<analystInstruction>` with `promptDataTag` escaping, so it cannot open or close another block.
  - **The system instructions say:**
    - the instruction says what to focus on, and is followed within these rules;
    - it cannot change the rules, the output format or the limits;
    - content inside the data blocks is data, whoever wrote it.
  - **Server rules hold whatever it says:** the adapter enforces D-05, D-11, D-13 and the bounds. Phase 16 D-27 states the same: the instruction "cannot loosen a server rule".
  - **Never Requestor text, by construction:** the slot is built only from the validated instruction field, a preset constant, or nothing. No code path copies a request field, an answer, a note or file text into it. This is unit-tested on the prompt captured through the fake server.
- **D-18:** The validator: one shared module in `apps/backend/src/csrm/ai/`, used by Phases 15, 16 (D-27 there) and 17.
  - **Bounds:** optional; trimmed; 1 to 500 characters. That is the governance log's existing text bound, so the timeline snapshot is never cut.
  - **Plain text:** line breaks are allowed. Other control characters and invisible formatting characters (bidirectional overrides and isolates, zero-width characters) are refused, so the stored instruction reads exactly as it was written.
  - **A Requestor-text guard, as defence in depth:** an instruction that repeats a long passage of Requestor-originated text verbatim is refused, with copy that says the AI already reads the request and the marked notes. The corpus is the request's text fields, the Requestor's notes, submitted answers and opted-in file text. Draft answers are never in it, so the guard cannot reveal them. Proposed threshold: 60 or more characters after normalising case and whitespace; research fixes it and unit-tests it.
  - **Refusals** come before any job is queued, each with a closed reason, and the field keeps the analyst's text (no lost input).
- **D-19:** Logged and shown.
  - **The run's `instruction`** holds the exact validated instruction (null for none). The context summary records its source: the analyst, the plain-language preset or the default task (QUES-11 criterion 3).
  - **The timeline's proposal event** carries a snapshot of it (D-26).
  - **The panel and the "What the AI used" sheet** show it; Phase 12 D-07's sheet gains an Instruction group.
  - **Who sees it:** analysts only. It renders as plain text, never HTML, and is never projected to a Requestor.

### Proposal items and decisions (decision 6; QUES-11 criterion 2)

- **D-20:** One generic proposal item core. Phase 15 builds it first; Phase 16 adds risk items and Phase 17 residual items as new target kinds, not a second mechanism (Phase 16 D-34's intent).
  - **States:** open, accepted, rejected, superseded and lapsed (Phase 16 D-40's vocabulary). The API keeps `accept`; visible copy says "Confirmed" (UI-D1).
  - **Immutable proposal, append-only decisions:** the run's `proposal` stays exactly what the AI proposed, with its adjustments. Every human or system act on an item appends an event to the run's `decisions` (Phase 12 D-19): actor, time, item, action, edited fields, reason, cause and resulting question.
  - **Derived state:** an item's state is a pure fold of its events. The proposals read and the gates compute a questionnaire's open items from its completed proposal runs, bounded (proposed: 100 proposal runs per questionnaire; research fixes the cap and its refusal).
  - **Fail-safe:** a run whose envelopes do not parse counts as having no open item and is logged. A damaged record can therefore never block a release or a draft, and its items can never be confirmed. A gate that protects no access fails open; access gates still read only dedicated facts (06.8).
  - **Base and staleness:**
    - a change or a removal records a fingerprint of its target (text, help text, type, choices, required flag, section, order, visibility and removal) and that the target was unanswered;
    - an addition records the questionnaire's generation, its section, and its visibility controller's fingerprint;
    - an item is stale when any base no longer holds or its target has become answered;
    - staleness is derived on every read ("Changed since proposed") and re-checked inside the decision transaction.
  - **Keys:** item keys are run-scoped, so a decision names the run and the item.
- **D-21:** The decision operation, the questionnaire counterpart of Phase 12 D-24.
  - **Shape:** `POST /api/v1/questionnaires/{questionnaireId}/ai_proposal_decisions`, human Security Analyst only, 1 to 200 decisions, each `{ runId, item, action, edits?, reason? }`.
  - **Actions:**
    - accept, optionally with edits (D-22);
    - reject, with an optional reason of at most 500 characters;
    - restore (D-23).

    Visible copy is "Confirm", "Reject" and "Undo" (Phase 12 UI-D1, the orchestrator's confirmation of 2026-10-01). The visible word "Accept" is reserved for the risk owner's decision.
  - **All or nothing:** one refused decision refuses the batch and leaves persistence deep-equal (Phase 16 D-09's posture). Repeating an applied decision is a no-op. A run of another questionnaire makes the whole batch a 404.
  - **Per state (D-06):** accept, and the restore of an accepted item, need analyst review (`QUESTIONNAIRE_RELEASED`, `ASSESSMENT_STARTED`). Reject, and the restore of a rejected item, are open until the draft.
  - **Refusals:** `AI_PROPOSAL_STALE`, Phase 12's "no longer open" code (D-03 item 9), `OWN_REQUEST` and `HISTORY_UNAVAILABLE`.
  - **Serialisation:** it runs inside the questionnaire's governance serialisation and row lock, and the run's decisions are appended there (Phase 12 Pitfall 10).
  - **No automatic path:** no automatic path ever applies an undecided item.
- **D-22:** Applying a confirmed item happens in one transaction with its decision event and its governance event.
  - **Addition:** a new question row.
    - Its key follows the governance editor's rule: unique among every key, removed questions included, and among keys allocated earlier in the same batch. This is Phase 12 D-18's allocator seam, and today's `questionKeyFromText` is the base.
    - Its placement follows D-13: the next free order, counting removed questions; a new section's key is derived uniquely and its order is the next free one (Phase 10 D-05).
    - It carries its help text and a null answer.
  - **Change:** the target's text, help text, answer type, choices and required flag, through the same validation as a manual edit (`candidateQuestion`, `validateDefinition`).
  - **Removal:** the existing soft removal (`options.deleted`), with its dependency and last-question rules.
  - **"Edit, then confirm"** (the seed's "accept, edit or reject"): the analyst's edits override the proposed values through the manual edit's payload rules (`parseQuestionMutationPayload`). The decision is recorded as accepted, with the edited fields.
  - **The answer-preservation check** (D-05) runs on the result; a failure refuses.
- **D-23:** Undo (restore), the G-4 X-14 pattern.
  - **A confirmation** can be undone while the questionnaire is still in analyst review, and the question still holds exactly what the confirmation wrote and is unanswered:
    - an addition is soft-removed;
    - a change is put back to its base values;
    - a removal is reversed, through a new `question-restored` event.

    The item returns to open.
  - **A rejection** can be undone while its run can still be decided. The item returns to open, and reads stale if its base has moved.
  - **Otherwise** restore is refused with a closed reason, and the copy names the manual step (the Phase 12 UI-D12 pattern).
  - **Every undo is recorded,** as a decision event and a governance event, so the history keeps both steps.
- **D-24:** Coexistence, supersession and lapse.
  - **Runs coexist:** a new questionnaire-wide run leaves earlier open items open, and its context lists them so it repeats none (Phase 16 D-31, D-40).
  - **A newer rewrite of the same question** supersedes the older open rewrite item. The supersession is recorded with the analyst who started the newer one (Phase 16 D-37).
  - **Two open items on one question** resolve by staleness: confirming one makes the other stale.
  - **Lapse:** an item whose run completes after its questionnaire can no longer change is recorded as lapsed (Phase 16 D-40). With D-06 and D-08 this is a guard, not an expected path.
- **D-25:** Concurrency with the Requestor (the seed).
  - **Proposals never touch an answered question** (D-05).
  - **A question answered while an item on it is open** makes that item stale. Confirming it is refused, with persistence unchanged.
  - **The Requestor's answer save and submit re-check the release fact inside their locked transaction,** refusing with `QUESTIONNAIRE_NOT_ANSWERABLE` when the questionnaire has returned to analyst review since their page loaded.
    - Today the policy reads the release fact only before the transaction (`requireQuestionnaireReleasedForRequestor`), and `saveAnswers` and `submitQuestionnaire` do not re-check it.
    - With the re-check, nothing the Requestor writes lands on a questionnaire in analyst review, so a confirmation and an answer never interleave.
    - The Requestor's page says the analyst is updating the questionnaire, and keeps the typed answers (no lost input).
  - **One lock:** Requestor saves and analyst governance share the questionnaire row lock. The planner may also give them one in-process serialisation; today they keep two separate per-questionnaire tails.
  - **Two analysts:** a second confirmation of the same item is a no-op, a conflicting decision is refused with Phase 12's "no longer open" code, and a confirmation that changed a question makes the other items on it stale.

### Provenance and the revision timeline (QUES-11 criterion 3; success criterion 3)

- **D-26:** The governance log amendment (the 06.8 envelope; the Phase 10 D-01 precedent).
  - **A new event kind** (proposed `ai-proposal`), appended in the transaction that completes a proposal run. It holds:
    - the initiating analyst (`by`) and the time;
    - the run id;
    - the scope: the whole questionnaire, or a question with its text snapshot (Phase 10 D-18);
    - the instruction snapshot, or the label of the preset or default task;
    - the provider and model snapshot;
    - the number of items.

    Every proposal therefore shows its instruction, time, initiating analyst and provider in the timeline, whatever later happens to its items.
  - **Question events written by a confirmation** (`question-added`, `question-edited`, `question-deleted`) carry the run and the item, and whether the analyst edited before confirming. `by` is the confirming analyst.
  - **Undo:** an undone confirmation writes the reverse event with the same source, and an undone removal writes `question-restored`.
  - **Projections:**
    - analysts get all of it;
    - a Requestor never gets the AI kind or keys;
    - a confirmation and its undo, both inside one analyst-review round, drop out of the Requestor's round summary, because the Requestor never saw either.
  - **Writes stay append-only;** a full log refuses with `HISTORY_UNAVAILABLE` (Phase 10).
- **D-27:** Question origin, extending Phase 12 D-22 with no schema change.
  - **A question added or changed through a confirmed item** reads as AI-written and confirmed. Through "edit, then confirm", it reads as AI-written and edited. Manual adds and edits keep their D-22 meanings, and the latest content event decides.
  - **The release dialog's count** of "{n} AI-proposed questions" (Phase 12 UI-D19) counts only generated questions still awaiting review, never confirmed ones.
  - **Phase 12's `generation.runId`** resolves the latest completed *generation* run (operation `questionnaire-generation`), never a proposal run, so the provenance header keeps pointing at the generation (seam for Phase 12's questionnaire reads).
- **D-28:** Where provenance shows.
  - **The analyst timeline:** Phase 10's timeline, with X-3 local times, actor names and question-text snapshots. It gains the proposal entries and the confirmed changes, each linked to its proposal.
  - **The panel:** each run's instruction, analyst, time, provider, item outcomes and adjustments, with "Show what the AI used" (Phase 12 X-13).
  - **The provenance header** (Phase 12 §1): the open-proposal count, as a figure link to the panel (X-10).
  - **The Requestor's view is unchanged:** Phase 12's disclosure that AI assisted and a Security Analyst reviewed; new questions appear after release, with Phase 10's per-round summary.

### Notes, the AI-input signal and the data policy

- **D-29:** The Phase 13 seam.
  - **Only notes marked "changes the AI inputs"** enter the context (Phase 13 D-27). Success criterion 1's scenario marks the offshore-support note first (Phase 13 seams).
  - **A completed questionnaire-wide run** is context-wide, so it clears the questionnaire's "AI inputs changed" signal (Phase 13 D-29): the AI has now read those inputs, whatever the analyst then decides. A rewrite includes the notes but never clears the signal.
  - **The action:** wherever the signal shows for the questionnaire (the hub and the questionnaire page), this phase attaches "Suggest follow-up questions" (Phase 13 D-29: "Phases 15 and 16 attach theirs"), in the states D-06 allows.
  - **Phase 14's opted-in file text** joins through Phase 12 D-08's extension point, and the signal gains files on Phase 13's rule.
- **D-30:** The data policy (G-3, G-7) and answer privacy (Phase 10 D-07).
  - **The classification ceiling** applies to every operation, the first generation's instruction included, at enqueue and before the provider call (Phase 12 D-26 to D-29).
  - **The run keeps no Requestor text.** The instruction is the analyst's own text.
  - **Answer content reaches the AI only when the analyst may read it,** which is the submitted batch. Draft answers are never sent, including answers turned back into drafts by a return to analyst review. Phase 10's control T-10-21 ("draft answers never cross to analysts") therefore holds for the AI too.
  - **The only widening of D-07:** in analyst review, the analyst sees which questions are answered, never the answer. Decision 4 makes those questions fixed, so the analyst must see what the AI may not change, and a manual edit already reveals it through "answer cleared". It is never shown while the Requestor is still answering a released questionnaire.
  - **Suites** pin the deterministic provider and the empty ceiling (Phase 12 D-31).

### Roles and separation of duties

- **D-31:** Grants.
  - **Every Phase 15 operation** (both starts, the job read and retry, the proposals read and the decisions) sits in new API-only Functions granted to `role.security_analyst` only (the `function.questionnaire_generation.*` pattern), and in `HUMAN_ANALYST_ONLY_OPERATIONS` as a second refusal. None is granted to the service agent or to the Requestor birthright.
  - **Record scope:** every human analyst may review every submitted request (Phase 13 D-23). Editing is non-exclusive (decision 10), so Phase 13's assignee does not narrow who may steer or decide.
  - **Accountability:** AI generation stays human-initiated (Phase 12 D-32), so every run names an accountable analyst.
- **D-32:** G-1 for a requesting analyst.
  - **On a request they raised,** a Security Analyst is its Requestor for every AI-steering control this phase adds:
    - they cannot start or retry proposals, read them, or decide them;
    - they cannot give an instruction to generation, though they can still generate without one, as Phase 12 allows.
  - **The refusal** is `OWN_REQUEST` (Phase 13 D-07's reason). The UI offers no such control, and says another Security Analyst handles the AI on that request.
  - **Basis:** steering what one is asked oneself is the conflict G-1 removes, read as Phase 13 D-07 read it for the AI-input mark.
  - **Manual question edits** by a requesting analyst stay as today (Phase 13 deferred that question).

### Interface

- **D-33:** Surfaces.
  - **The questionnaire page** (`/app/review/questionnaires/{documentId}`) gains an "AI proposals" panel in every state before the draft. It holds:
    - the start form: the instruction field and "Suggest follow-up questions";
    - the job state;
    - open items grouped by run, then the decided items;
    - the answered (fixed) questions, in the states D-06 shows them;
    - the state's guidance: return to analyst review, or wait for the submission.
  - **Each unanswered active question row** (in analyst review, and in the submitted view) offers "Rewrite in plain language", with an optional instruction.
  - **Each item shows:**
    - its kind;
    - for a change, the current and proposed question side by side, stacked on phones; for an addition, the proposed question and where it will go; for a removal, the question;
    - its rationale and citations, and any stale or adjustment note;
    - Confirm, "Edit, then confirm" (the X-5 in-place form) and Reject.
  - **Per run:** Reject remaining. There is no bulk confirm, because each question is reviewed on its own (QUES-11 criterion 2; Phase 12 UI-D6's reasoning).
  - **The hub** (`/app/review/requests/{documentId}`): the questionnaire card's entry to the panel, with the open count and the Phase 13 signal; "Replace questionnaire" only when D-09 allows; the instruction field on Generate and Replace.
  - **The timeline and the header:** D-28.
  - **The Requestor's surfaces** are unchanged.
- **D-34:** Copy and extensions.
  - **Values** come only from `docs/design/csrm-design-direction.md`.
  - **Visible verbs:** "Confirm" and "Confirmed" (UI-D1), "Reject" and "Undo"; never "Accept" or "Approve" for the analyst's review act. Exact strings are the UI-SPEC's.
  - **Reused extensions:** Phase 10's X-1 (save status), X-3 (dates and times) and X-5 (in-place edit form); Phase 11's X-10 (figure links); Phase 12's X-11 to X-14 (AI provenance markers, citations, side sheet, Undo toast); and Phase 13's note patterns.
  - **New patterns,** proposed by the UI-SPEC from the first free X-n the orchestrator gives:
    - the proposal item card with its before-and-after comparison, as one extension shared with Phase 16's field comparison (its D-46): whichever UI-SPEC lands first proposes it, and the other reuses it;
    - the instruction field;
    - the answered (fixed) question note.
  - **The glossary:** a plan extends the root `CONTEXT.md` entry for "AI proposal" (added by a Phase 12 plan) to cover questionnaire proposals, if that entry does not already.
- **D-35:** The G-4 bar and the route.
  - **The bar:**
    - a keyboard path for every action; focus moves to the next item's Confirm after a decision (Phase 12 UI-D7);
    - optimistic Confirm and Reject that roll back on error, with Undo toasts (X-14);
    - no confirmation dialog for these reversible acts, while release keeps its confirmation;
    - skeletons while loading, and empty states that say what to do next;
    - no lost input: the instruction and any "edit, then confirm" draft survive errors and navigation (Phase 10's navigation guard);
    - comfortable and compact density for the item list;
    - motion from the direction, honouring reduced motion;
    - phone cards and sheets;
    - every figure opens its records: the open count opens the panel, and an adjustment count opens its list.
  - **The route:** the panel's heavy parts load on demand with `next/dynamic` from a Client Component, client pieces stay zod-free (`zod-client-boundary.test.ts`), and decisions batch through one Server Action (Phase 12 Pattern 5).

### Verification and plan shape

- **D-36:** How the phase is proved. Each behaviour gets a failing test first at its seam.
  - **Strapi unit:**
    - the instruction validator and the Requestor-text guard;
    - the item core: the fold, bases and staleness;
    - the answer-preservation predicate;
    - placement and key allocation;
    - the envelope parsers, which fail safe;
    - the context builder's questionnaire part;
    - the adapter, tested with model-facing wire JSON through `apps/backend/tests/helpers/fake-openai-compatible-server.ts` (the 06.7 lesson);
    - the deterministic providers.
  - **Strapi integration** (mounted):
    - every new route and every refusal in the authorisation table;
    - D-06's state table;
    - the gates on release, draft generation and replacement;
    - staleness, with a Requestor answer landing between a held job and a confirmation;
    - answered question rows deep-equal before and after confirmations and the release;
    - the timeline events and their Requestor projection;
    - G-1;
    - the instruction slot and its escaping in the captured prompt;
    - the policy refusals;
    - the run lifecycle, single flight and retry attribution;
    - Undo, and batch all-or-nothing;
    - the Requestor's save re-check.
  - **The matrix:** a `humanAnalystOnly` row for each new route; `served-operations.json` regenerated; the catalogue copies byte-identical.
  - **Web unit (Vitest):**
    - the closed, nullable parsers and the zod-free domain module;
    - the panel's five-state contract and the items;
    - decisions: optimistic, rollback, Undo and focus;
    - the refusal copy, the instruction field and the hub entry;
    - the timeline's new kinds;
    - no AI proposal data anywhere in the Requestor's tree, and the requesting analyst's state.
  - **Playwright:** one new spec with its own records (UAT-A-like), at 375px and 1440px, with axe. It runs success criterion 1's scenario:
    - Jane submits; she adds a note about offshore support, and Bob marks it;
    - Bob asks for follow-ups on the submitted questionnaire;
    - he returns it to analyst review, confirms one item, edits then confirms another, and rejects one and undoes it;
    - he rewrites a question in plain language;
    - release is refused while items are open, then allowed;
    - Jane sees the new questions with her answers unchanged;
    - the timeline shows the instruction, time, analyst and provider.

    The Secondary Requestor is refused, and a requesting analyst sees no AI controls on their own request. Existing specs that change deliberately are named in their plans (`questionnaire-generation-workflow.spec.ts`, for Replace and the instruction). Phase 15 adds no slice to `risk-owner-journey.spec.ts`, which Phase 17 creates. A run leaves the tree clean (Phase 8 D-12, G-6).
  - **The live model check** is manual and the operator's.
- **D-37:** Plan shape.
  - **Wave order:**
    1. the two amendments and their approval checkpoint, with the pure modules alongside (validator, item core, preservation predicate, placement);
    2. envelope parsers and the context's questionnaire part;
    3. providers;
    4. jobs and runs;
    5. decisions, the gates and the Requestor re-check;
    6. reads, contract, catalogue and matrix;
    7. the UI;
    8. the E2E spec and the full gate.

    The full gate is `api:check`, typecheck, lint, web unit, Strapi and Playwright, then a clean `git status --short`, with the 375px and 1440px checks for the Requestor, the Secondary Requestor and both analysts.
  - **Serialised by shared files,** one owner per file per wave:
    - the specification and the generated client;
    - both catalogue copies, `served-operations.json`, the matrix and the parity and chain guards;
    - `csrm-authorization.ts`;
    - the Strapi hot files: `questionnaire-governance-workflow.ts`, `questionnaire-generation-workflow.ts`, `questionnaire-workflow.ts`, `questionnaire-scope.ts`, `questionnaire-governance-log.ts`, the questionnaire controller and routes, `assessment-workflow.ts` (the draft gate), `conflict-reasons.ts`, and Phase 12's `src/csrm/ai/*` and run-record module;
    - the web hot files: `questionnaire-service.ts`, `questionnaire-schema.ts`, `questionnaire-actions.ts`, `questionnaire-review.tsx`, `questionnaire-governance.tsx`, `questionnaire-revision-timeline.tsx`, `questionnaire-generation-job.tsx`, `assessment-detail.tsx` and `refusal-copy.ts`.
  - **Dev servers** are stopped for every plan that edits Strapi or runs Playwright.
  - **Size:** the top of M. The planner keeps each plan within its estimate and reports if the set needs more than the usual count.

### Planner's Discretion

- Module placement, for example:
  - `apps/backend/src/csrm/ai/analyst-instruction.ts` and `proposal-items.ts` (shared);
  - `apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposals*.ts`;
  - web `apps/csrm/src/features/questionnaire-ai/`, beside Phase 12's `features/ai-assistance/`.
- Names of operations, Functions, reason codes, run operations, event kinds and keys, within the families above.
- Exact bounds within the proposed values: items and additions per run, runs per questionnaire, decided items in the read, the quote-guard threshold and the near-duplicate threshold.
- The deterministic providers' rules and wording, within D-15.
- Whether the Requestor saves and analyst governance share one in-process serialisation, provided both take the row lock (D-25).
- How the work splits into plans, provided D-37's serialisation holds.
- Copy, layout and visuals: the UI-SPEC's.
</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/NEXT-WAVE-DECISIONS.md`; none is open.

| Decision | What it settles here | Implemented by |
|---|---|---|
| #4 AI re-runs once answers exist | Proposals add or change unanswered questions only; answered questions and their answers are kept as information; analyst edits change only through a proposal the analyst accepts; reverses the Pre-06.2 refusal | D-04 to D-09, D-14, D-22, D-25 |
| #5 Analyst instructions | Trusted but bounded: its own slot, logged in the run record, never holding Requestor text; Requestor text always delimited as untrusted | D-12, D-17 to D-19 |
| #6 Removing risks (its principle) | Record what the AI proposed and what a person decided; a rejected AI proposal is recorded as rejected | D-08, D-20, D-21, D-24 |
| #10 Pick-up and assignment | Editing is not exclusive; the assignee does not narrow who may steer or decide | D-31 |
| G-1 Separation of duties | No AI-steering control on a request the analyst raised; the service agent holds no human-analyst grant | D-31, D-32 |
| G-3 AI data policy | Minimal context, untrusted delimiting, a run per call with its context summary, refusal above the ceiling | D-14, D-16, D-30 |
| G-4 Premium bar | Keyboard, optimistic feedback, Undo, skeletons, empty states, no lost input, phone layouts, figures that open records | D-33 to D-35 |
| G-6 Housekeeping | The orchestrator approves the amended contract-gap records; Playwright leaves a clean tree | D-01, D-36 |
| G-7 Production infrastructure | Production fails closed until the ceiling is set; every suite stays deterministic | D-16, D-30 |
| G-12 Who reads the assessment | Participants never read the questionnaire, its notes or proposals; nothing here widens a participant read | D-31 |
| #18, G-18 and G-19 Notifications | No notification in this phase; the centre is Phase 19.1's, which runs after it | Out of scope; deferred |
| Orchestrator Confirmations of 2026-10-01 (in `12-CONTEXT.md` and `16-CONTEXT.md`) | Visible "Confirm", not "Accept", for the analyst's review of AI proposals; one closed "no longer open" code, Phase 12's, for decided, superseded and lapsed items; retries follow Phase 13 D-18 | D-03, D-16, D-21, D-25, D-34 |

The hosted provider's approval for production data stays the operator's and does not block this phase.
</operator_decisions>

<contract_gaps>
## Contract-Gap Records and the Approval Checkpoint

**No new record.** Phase 15 changes no content type, so it writes no `docs/contract-gaps/phase-15-*.md` record, and the content-type freeze check lists no schema file.

**Two dated amendments, written by the first plan,** each as a section `Phase 15 amendment (2026-10-01): ...` in the format of the record it amends:

1. **`docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`** (written by Phase 12's first plan; Phase 15 executes after it):
   - the run operations `questionnaire-proposals` and `question-rewrite`, and the instruction on `questionnaire-generation`;
   - the questionnaire proposal envelope: items, kinds, targets, proposed questions, rationale and sources, bases, and adjustments;
   - the item decision events and their states (D-20 to D-24);
   - the context summary's questionnaire section and the instruction source (D-14, D-19);
   - how open items are derived from runs, the bound on proposal runs per questionnaire, and the fail-safe direction (D-20);
   - that no Requestor text is stored.

   Phase 16's own amendment (its D-03) then extends this one rather than restating it.
2. **`docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`** (with Phase 10's amendment already in it):
   - the AI proposal event kind and its keys;
   - the AI source keys on question events, and the `question-restored` kind;
   - that the release gate still reads only `releasedAt` and `releasedBy`, never the log;
   - the Requestor projection rules (D-26);
   - that this is an envelope amendment, not a content-type change.

**Approval checkpoint:** a `checkpoint:decision` task straight after the amendments, at which the executor stops. Under G-6 the orchestrator reviews both amendments and records the approval in each record. No code that writes the new envelope versions runs before that.

**Migration:** none. Earlier runs and logs read unchanged through the closed parsers, which accept the earlier versions beside the new ones and fail safe on anything else.
</contract_gaps>

<authorisation>
## Authorisation Model

Keycloak authenticates. Strapi enforces Role → Function → FunctionAPI, then the record-level rule, then the state rule, against the resolved IdamBox User (`ctx.state` after the identity middlewares), identically under the development identity bridge and a Keycloak-verified user. Navigation visibility is not authorisation: every control the UI hides is also refused by Strapi.

**Grants:**
- **The Phase 15 operations** (start, rewrite, job read and retry, proposals read, decisions): the human Security Analyst only, held twice, by the grant and by `HUMAN_ANALYST_ONLY_OPERATIONS`.
- **The generation instruction:** the existing human-only generation grant (Phase 12 D-32).
- **The gates on release, draft generation, replacement and the Requestor's answer saves** change no grant: they are state refusals on existing operations.

**Record and state rules:**
- the run named in a decision belongs to the questionnaire in the path;
- the questionnaire's state allows the action (D-06);
- the item is open and not stale;
- the actor did not raise the request (D-32).

**AI boundary:** jobs write only the run and the timeline event. Nothing reaches a question without an analyst's confirmation, and nothing reaches the Requestor without a release.

**Positive cases:**
- any eligible human Security Analyst starts proposals and rewrites, reads them, follows and retries their jobs, and decides them, in the states D-06 allows;
- any eligible human Security Analyst gives an instruction to first generation and to an allowed replacement;
- the owning Requestor reads the questionnaire, with confirmed changes, after release.

**Negative cases** (each proven in the API by a Strapi integration test or a matrix row, and in the UI by a web unit test or Playwright):

| Case | API outcome | UI outcome |
|---|---|---|
| The request's own Requestor calls any proposal route (start, rewrite, read, decide, job read or retry) | 403 (no grant), persistence unchanged | No proposal, instruction, marker or AI event anywhere in the Requestor's views |
| The Requestor reads the questionnaire while it is back in analyst review holding confirmed changes | 403 (the existing release gate) | The existing "with the Security Analyst" state; no unreleased question |
| The Requestor's questionnaire read and timeline after release | No AI event kind or key, no instruction, no proposal | Only "questions added or changed" in the round summary |
| An unrelated Requestor (the Secondary Requestor) calls any proposal route or reads the questionnaire | 403 | The existing permission state; nothing of the questionnaire appears |
| The service agent calls any proposal route | 403 (human-only set) | Not applicable |
| A requesting analyst on their own request starts, rewrites, reads, decides, reads or retries a proposal job, or gives an instruction to generation | Refused with `OWN_REQUEST` | No AI-steering control on that request, and a line saying another Security Analyst handles it |
| Confirming, or undoing a confirmation, while the questionnaire is released | 409 `QUESTIONNAIRE_RELEASED` | Confirm not offered; the panel offers Return to analyst review |
| Starting a proposal or rewrite while the Requestor has not submitted a released questionnaire | 409 `QUESTIONNAIRE_NOT_SUBMITTED` | Not offered; the panel says what to do |
| Any start or decision once an assessment exists or its draft job is active | 409 `ASSESSMENT_STARTED`, or the draft-in-progress reason | Not offered |
| Confirming an item whose question was answered or changed since it was proposed | 409 `AI_PROPOSAL_STALE`, persistence deep-equal | "Changed since proposed", with Reject |
| Deciding an item that is no longer open (decided, superseded or lapsed) | 409 with Phase 12's "no longer open" code (`AI_PROPOSAL_ALREADY_DECIDED`) | The panel refreshes and shows the item's state |
| A decision batch naming another questionnaire's run | 404 for the whole batch, deep-equal | Not applicable |
| A rewrite of an answered or removed question | 409 `QUESTION_ANSWERED` or `QUESTION_REMOVED` | No rewrite control on that row |
| An instruction over 500 characters, with control or invisible formatting characters, or repeating a long passage of the Requestor's text | Refused with a closed reason, nothing queued | An inline error beside the field, with the text kept |
| Release, draft generation or replacement while an item is open or a proposal job is active | 409 `AI_PROPOSALS_OPEN` | Not offered; a line links to the panel |
| Replacement when analyst changes exist since the latest generation | 409 `QUESTIONNAIRE_HAS_ANALYST_CHANGES` | Not offered; the hub offers the proposals instead |
| A start, or generation with an instruction, above the classification ceiling, or with no ceiling outside development | 409 with Phase 12's policy reason; at execution the job fails with the same code and nothing is sent | The panel and the hub show the refusal in place of the action |
| A Requestor answer save or submit landing after a return to analyst review | 409 `QUESTIONNAIRE_NOT_ANSWERABLE`, persistence deep-equal | The Requestor is told the analyst is updating the questionnaire; typed answers are kept |
| Any path applying a proposal item without an analyst's confirmation | None exists: jobs write only the run and the timeline event, proven by tests | Not applicable |
| No identity, or no token | Per the matrix conventions: 403, or the token family's status | The sign-in path |
</authorisation>

<seams>
## Cross-Phase Seams

**The seams in `stage2-rules.md` §3:**
- **G-16 and G-13:** Phase 15 adds no due state and no status. The timeline's event presentation stays one extensible mapping.
- **Phase 13's assignee:** it gates nothing here. Editing is non-exclusive (D-31).
- **Phase 19's exports and record-read check, and Phase 14's files reused by Phase 20:** no questionnaire answers, proposals or instructions are exported (19-CONTEXT), and this phase adds no export.
- **The Phase 17 fixture identity, Phase 18's bulk edits and Phase 21's stage times:** not touched.
- **Phase 22's single configuration points:** Phase 15 adds no Admin-configurable value. The classification ceiling stays Phase 12's one policy module; the instruction bound and the proposal caps are code constants.
- **The post-demo journey** (`apps/csrm/e2e/risk-owner-journey.spec.ts`): Phase 15 adds no slice; it keeps its own spec (D-36).

**Phase seams:**
- **Phase 10** (executes first):
  - the governance editor's key and placement rules, which D-22 reuses (10-09);
  - question-text snapshots and the timeline (10-10);
  - the `regenerated` event and the change count, which D-09 reads, and the release refusal (10-11);
  - the hub's Replace confirmation (10-12), narrowed by D-09;
  - the generation-jobs read and job panels (10-13, 10-14);
  - the closed reasons and refusal copy (10-06, 10-07);
  - the navigation guard (10-08), and local time (10-01).

  Phase 10 D-08 is narrowed (D-09), and D-07 is widened only as D-30 states.
- **Phase 12** (executes first):
  - the context builder, slots, policy, run record, run read, provenance and question origin are this phase's foundation (D-14, D-16, D-17, D-27);
  - its record gains D-01's amendment;
  - its `generation.runId` must filter by the generation operation (D-27);
  - its "What the AI used" sheet gains the Instruction and Questionnaire groups (D-19);
  - its D-24 decision operation gets the questionnaire counterpart it anticipated (D-21).
- **Phase 13** (executes first):
  - marked notes enter the context (D-29), and questionnaire-wide runs clear its signal (D-29);
  - job access follows its D-18 (D-16);
  - G-1 is read as its D-07 reads it (D-32);
  - its "AI inputs changed" display gains this phase's action (D-29).
- **Phase 14** (executes first, planned input): opted-in attachment text joins the context and the signal (D-14, D-29); the Requestor-text guard's corpus includes it (D-18).
- **Phase 16:**
  - reuses the instruction slot and validator (its D-27, S-4) and the proposal item core (D-20), and extends the Phase 12 amendment rather than restating it;
  - reuses `AI_PROPOSAL_STALE`, and uses Phase 12's one "no longer open" code as Phase 15 does (its 2026-10-01 confirmation);
  - shares the before-and-after comparison extension (D-34);
  - uses the same visible "Confirm" (D-21).
- **Phase 17:** "Reassess residual risk" adds a target kind to the item core and uses the same instruction validator.
- **Phase 19.1** (the in-app notification centre, G-19; it runs after this phase): its closed kind vocabulary is extended by later phases, so an "AI proposals ready" kind could join it later (deferred). Phase 15 sends nothing.
- **Phase 17.1:** its G-1 pass over review acts may also decide whether a requesting analyst may open Phase 12's run read; D-32 covers only this phase's operations.
- **Phase 21:** AI assistance health can read the proposal runs and their decisions: proposed, confirmed, rejected and lapsed counts per operation.
- **Phase 22:** the Admin owns the AI data policy setting that decides when every Phase 15 operation is refused. The service agent's role review inherits D-31's exclusions.
</seams>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/uat/product-gaps/FINDINGS.md`: UAT-017 and UAT-018 in full; UAT-019 (the replacement this phase narrows), UAT-024 (timelines) and UAT-043 (plain-language style).
- `.planning/uat/product-gaps/JOURNEYS.md` area 2: the rows "F4 steer", "A2 regenerate unanswered", "A1 requestor adds information", "A2 re-run with answers", "A2 manual revision" and "A2 requestor re-answers".
- `.planning/uat/product-gaps/REPORT.md`: §8 (the Phase 15 proposal) and §9 (decisions 4 and 5 with their options).
- `.planning/uat/product-gaps/BRIEF.md` Appendix A: F4 and A2.

### Planning authority
- `.planning/ROADMAP.md`: the Phase 15 entry (goal, decisions, contract line, success criteria 1 to 4); the entries for Phases 12, 13, 14, 16, 17, 21 and 22 for the seams; the post-demo journey paragraph.
- `.planning/REQUIREMENTS.md`:
  - QUES-11 and QUES-12, with their acceptance criteria;
  - QUES-08, QUES-10, INT-05, INT-06, COLLAB-01, COLLAB-02 and ASSESS-10, for the seams.
- `.planning/NEXT-WAVE-DECISIONS.md`: decisions 4, 5, 6 and 10; G-1, G-3, G-4, G-6, G-7 and G-12.
- `.planning/POST-DEMO-BRIEF.md` §1 and §2 (overrides and dev-mode rules); `.planning/STATE.md` Decisions; `.planning/PROJECT.md`.
- `.planning/milestones/v1.0-STATE.md`: the Pre-Phase 06.2 rule (line 46) that decision 4 reverses; Pre-Phase 06.5 (only the two AI operations); 06.7 (wire shapes, the deterministic E2E Strapi); 06.8 (the release gate, D-05, D-13, D-15, D-16).

### Earlier phases this phase builds on
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-CONTEXT.md`:
  - D-04 to D-08 (context builder, slots, bounds, extension points), D-15 and D-16 (wire shapes, questionnaire style), D-18 (the key allocator seam);
  - D-19 to D-25 (run record, provenance, question origin, decision operation, run read), D-26 to D-29 (data policy) and D-31, D-32 (deterministic suites, human-initiated generation);
  - the Orchestrator Confirmations of 2026-10-01 (visible "Confirm").
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-RESEARCH.md`:
  - "The run record and provenance", "Envelopes (versioned, closed)", "The assessment context" (field table, delimiting, bounds, ranker);
  - "Wire shapes and adapters", including the portable schema subset and "Questionnaire wire v2";
  - "Contract changes" and "Plan grouping and wave order";
  - Pitfalls 1, 6, 10, 11, 12 and 17.
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-UI-SPEC.md`: §1 (provenance header), §2 ("What the AI used"), §6 (decisions, Undo, focus, refusal family J), §8 (questionnaire governance), X-11 to X-14, and UI-D1, UI-D6, UI-D7, UI-D12 and UI-D19.
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-PATTERNS.md`: the planned module map (`apps/backend/src/csrm/ai/*`, `apps/backend/src/api/csrm-ai-run/`, `apps/csrm/src/features/ai-assistance/`).
- `.planning/phases/13-request-pick-up-and-notes/13-CONTEXT.md`: D-07 (G-1 reading, `OWN_REQUEST`), D-18 (job access), D-23 (who reads notes), D-26 to D-29 (the AI-input mark, the context, the run summary, the signal), and its seams for Phases 15 and 16.
- `.planning/phases/16-risk-curation-and-targeted-ai-re-runs/16-CONTEXT.md`: D-22 and D-23 (the guard and the edit transition), D-27 and D-28 (instructions and new information), D-31 to D-42 (suggestions, rewrites, item lifecycle, decisions, readiness) and D-46 (the field comparison extension).
- `.planning/phases/10-existing-flow-gap-closure/10-CONTEXT.md`:
  - D-04, D-05 (governance editor and placement), D-07 (answer privacy before submission);
  - D-08 to D-10 (replacement), D-12 (navigation guard), D-16 to D-19 (change count, timelines, snapshots, local time);
  - D-22 (closed reasons), D-25 to D-27 (generation jobs) and D-41 (recorded extensions).
- Phase 10 plans:
  - `10-09-PLAN.md` (governance editor), `10-10-PLAN.md` (question-text snapshots, timeline), `10-11-PLAN.md` (`regenerated`, change count, release refusal), `10-12-PLAN.md` (hub Replace);
  - `10-13-PLAN.md` and `10-14-PLAN.md` (generation jobs), `10-06-PLAN.md` and `10-07-PLAN.md` (reasons and copy), `10-08-PLAN.md` (navigation guard), `10-01-PLAN.md` (local time);
  - `10-UI-SPEC.md` §1, §2, §4, §10.2 and §12.
- `.planning/phases/11-navigation-landing-and-list-clarity/11-UI-SPEC.md`: X-6 to X-10, and page names and recovery copy.
- `.planning/phases/06.8-workflow-visibility-and-questionnaire-governance/` and `.planning/phases/06.7-real-ai-provider-integration-for-questionnaire-and-assessmen/` CONTEXT files: 06.8 D-05, D-07, D-13 to D-16; 06.7 D-07, D-08, D-10 and D-14.

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md` §19 (AI architecture: provenance, review state, human modifications, audit history; untrusted content) and §20 (record gaps rather than competing models).
- `docs/references/idambox-datamodel.jdl`: `CsrmQuestionnaire`, `CsrmQuestion` (`helpText`, `options`, `answer`, `reviewComment`), `CsrmAssessmentRequest`.
- `CONTEXT.md` (repository root): the glossary ("Accept, Treat" reserves Accept for the risk owner; "Released").

### Contract, authorisation and records
- `docs/references/specification.json`:
  - `QuestionnaireSummary`, `QuestionnaireQuestion`, `QuestionnaireRevision`, `QuestionnaireGovernanceEvent`, `QuestionnaireRevisionTimelineEvent`, `QuestionnaireGenerationJob`;
  - the `generate_questionnaire` request body;
  - `QuestionnaireWorkflowErrorResponse` and `AssessmentWorkflowErrorResponse`;
  - Phase 12's `AiRun` once added.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`: byte-identical copies. `function.questionnaire_generation.*` and `function.questionnaire_governance.*` are the human-only API Function pattern; design notes 6, 7 and 9.
- `docs/references/served-operations.json`.
- `docs/contract-gaps/`:
  - `phase-03-questionnaire-json-contract.md` (definition and answer envelopes);
  - `phase-06.8-questionnaire-governance-facts.md` (amended, D-01);
  - `phase-06.2-questionnaire-generation-provenance.md` and `phase-06.7-ai-provider-provenance.md`;
  - `phase-12-ai-run-record-and-provenance.md` once written (amended, D-01).
- `docs/security/phase-08-residual-risks.md`: R-08-12, R-08-34 and R-08-36.
- `apps/backend/src/policies/csrm-authorization.ts`, `apps/backend/tests/fixtures/authorization-matrix.ts`, `apps/backend/tests/contract-catalogue.integration.test.ts`, `apps/backend/tests/served-operations.integration.test.ts`, `apps/csrm/src/features/contract-response-parity.test.ts` and `apps/csrm/src/features/contract-operation-chain.test.ts`.

### Design and framework
- `docs/design/csrm-design-direction.md` and `docs/adr/0001-adopt-bproton-design-system.md`: every UI value; Forms, Tags and chips, Dialogs, Toasts, Skeletons, Empty states, Record links, Motion, and the optimistic-UI rule.
- `apps/csrm/node_modules/next/dist/docs/01-app/02-guides/server-actions.md` (sequential dispatch; one response carries data and UI) and `01-app/02-guides/lazy-loading.md` (`next/dynamic` from Client Components).

### External
- Azure OpenAI structured outputs, "JSON Schema support and limitations", as cited in `12-RESEARCH.md`: the portable schema subset of D-15.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts`:**
  - `runGovernanceMutation` (serialisation, transaction, row lock);
  - `assertQuestionnaireInAnalystReview` (lines 237-243): the analyst-review rule D-06 and D-07 use;
  - `returnQuestionnaireToAnalystReview` (lines 278-335), which turns submitted answers back into drafts while keeping their values;
  - `releaseQuestionnaire` and `assertReleasable`, where D-08's gate joins;
  - `questionKeyFromText` (lines 402-409, the key allocator D-22 builds on), `candidateQuestion`, `validateDefinition` and `parseQuestionMutationPayload`;
  - `appendQuestionEvent` and `questionOptions`;
  - `deleteQuestionnaireQuestion`, the soft removal with its dependency and last-question rules.
- **`apps/backend/src/api/csrm-questionnaire/services/questionnaire-definition.ts`:** `parseQuestionnaireDefinition` (keys unique across removed questions; section and order uniqueness; visibility on earlier questions), `activeQuestionnaireDefinition`, `getVisibleQuestionKeys` and `isQuestionnaireValueValid`. The answer-preservation predicate builds on them.
- **`apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts`:** the closed, append-only log (kinds at lines 26-33, bounds at lines 57-60). Phase 10 adds `questionText` and `countAnalystChangesSinceGeneration`, which D-09 reads.
- **`apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts`:**
  - `hasValue` (the answered rule, D-05);
  - `projectQuestions`, whose analyst masking (line 427) is the privacy rule D-30 keeps;
  - `projectGovernanceEvents`' analyst and Requestor branches;
  - `governanceActorIds` and `governanceActorNames`.
- **`apps/backend/src/api/csrm-questionnaire/services/questionnaire-workflow.ts`:** `saveAnswers` and `submitQuestionnaire` (lines 305-339), where D-25's in-transaction release re-check goes; `revertQuestionnaireToDraft` (06.1).
- **`apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts`:**
  - `persistGeneratedQuestionnaire`: line 34 refuses `QUESTIONNAIRE_ANSWERED`, and line 35 hard-deletes the replaced question rows. D-09's refusals join the transaction;
  - `hasQuestionnaireAnswerEvidence`;
  - the registry wiring.
- **`questionnaire-generation-registry.ts`:** the in-process, single-flight job pattern D-16 follows.
- **`openai-compatible-questionnaire-generation-provider.ts`:** `toQuestionnaireGenerationProposal`, the wire-to-internal adapter pattern.
- **`apps/backend/src/csrm/prompt-data.ts`** (`promptDataTag`), **`openai-compatible-client.ts`** (`requestJsonCompletion`, `logCompletionDiagnostic`), **`tests/helpers/fake-openai-compatible-server.ts`** and **`tests/ai-provider-guardrails.unit.test.ts`** (hostile-text cases to extend).
- **`apps/backend/src/policies/csrm-authorization.ts`:** `HUMAN_ANALYST_ONLY_OPERATIONS` (lines 41-49) and `requireQuestionnaireReleasedForRequestor` (lines 383-385, the release gate the Requestor's routes use).
- **`apps/backend/config/ai.ts`:** the `questionnaireGeneration` block that the proposal operations reuse.
- **Phase 12's planned modules:**
  - `apps/backend/src/csrm/ai/` (`assessment-context.ts`, `assessment-context-loader.ts`, `prompt-sections.ts` with the empty instruction slot, `data-policy.ts`, `library-ranking.ts`);
  - `apps/backend/src/api/csrm-ai-run/` (`ai-run-record.ts`, the run read);
  - `apps/csrm/src/features/ai-assistance/` (markers, citations, the run sheet, the domain module).
- **Phase 10's planned modules:** `apps/backend/src/csrm/conflict-reasons.ts`, `apps/csrm/src/lib/api/conflict-reasons.ts`, `refusal-copy.ts`, the navigation guard, `formatInstant` and `LocalInstant`.
- **Web:**
  - `apps/csrm/src/features/questionnaires/questionnaire-review.tsx` (the analyst page's three states: `analyst-review`, `awaiting-submission`, `submitted`);
  - `questionnaire-governance.tsx` (the release and return controls);
  - `questionnaire-revision-timeline.tsx` (`eventPresentation`, the one extensible mapping);
  - `questionnaire-service.ts`, `questionnaire-schema.ts`, `questionnaire-actions.ts` and `questionnaire-domain.ts`;
  - `apps/csrm/src/features/assessments/questionnaire-generation-job.tsx` (the hub card with today's Replace confirmation, lines 190-199) and `assessment-detail.tsx`;
  - `apps/csrm/src/components/csrm/confirm-dialog.tsx` (reason fields).

### Established Patterns
- **Human-only API Functions**, plus `HUMAN_ANALYST_ONLY_OPERATIONS` as a second refusal (06.8, Phase 7 D-07, Phase 10 D-25, Phase 12 D-32).
- **The release gate reads a dedicated fact** (`releasedAt`), never the governance log; logs are closed, versioned and fail safe (06.8).
- **Current fact plus append-only log** (06.8, Phase 12 D-21). Here the item state is a pure fold of the run's append-only decisions, and the gates that read it fail open because they protect no access (D-20).
- **Model-friendly wire shape, server-owned values assigned by the adapter, and a closed context-aware parser as the gate** (06.7 D-14, Phase 12 D-15); deterministic providers as the test default.
- **Denials keep persistence deep-equal;** closed 409 reasons in `error.details.reason` with actor-neutral copy (Phase 10 D-22).
- **Questions are soft-removed** (`options.deleted`); keys are never reused, removed questions included.
- **Zod-free `*-domain.ts` modules** for client components; typed openapi-fetch services and Server Actions that revalidate; one batch Server Action per decision set (Next 16.3 dispatches actions one at a time).

### Integration Points
- **Strapi:**
  - the questionnaire routes, controller and services;
  - `generateAssessment` in `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts` (D-08's draft gate);
  - Phase 12's context builder, prompt sections and run record;
  - `csrm-authorization.ts`, the two catalogue copies and the bootstrap catalogue reconciliation.
- **Web:**
  - the analyst questionnaire page `apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx`;
  - the analyst request page `apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx` (the hub);
  - the Requestor questionnaire page (unchanged; its save path gains D-25's refusal copy).
- **Tests:**
  - `apps/backend/tests/questionnaire-governance.*`, `questionnaire-generation.*`, `questionnaire-workflow.*` and `ai-provider-*.unit.test.ts`;
  - the authorisation matrix;
  - Vitest beside each module;
  - a new Playwright spec under `apps/csrm/e2e/`.
</code_context>

<specifics>
## Specific Ideas

- **The yardstick is UAT-A with the offshore note.**
  - Jane submits her answers. She then learns that after-hours vendor support will come from an offshore team with administrator access, and adds a note on her request. Bob marks it "changes the AI inputs", and the questionnaire page says one note changed the AI inputs since the last AI run (Phase 13's scenario).
  - On the submitted questionnaire, Bob chooses "Suggest follow-up questions". The proposal adds a section of questions about the offshore team: where they are based, what administrator access they hold and how it is approved and logged, with "Not sure" on each select and help text on each. Each cites the note. Nothing touches Jane's answered questions; the adapter's record shows the one attempted change it dropped.
  - Bob returns the questionnaire to analyst review, confirms two questions, edits one before confirming, rejects a near-repeat with a reason, and releases.
  - Jane sees three new questions and her earlier answers unchanged, answers them and resubmits.
  - The timeline shows "Bob Doe asked the AI: 'Suggest follow-up questions'", with the time, provider and model, then each confirmed question.
- **UAT-017's own examples** are the instruction tests: "also cover tax file numbers and the offshore support team", and "drop the logging question" (a removal, allowed only while that question is unanswered).
- **UAT-018's manual revision row is the contrast.** It edited q-1's text, replaced q-2's choices (clearing an answer), repurposed q-9 and changed q-15's answer type (clearing another). The AI path never does what cleared those answers: it cannot target an answered question, and it adds new questions instead.
- **Plain language** on "Is MFA enforced for privileged and federated identities, including break-glass accounts?" proposes something like "Do administrators have to use multi-factor authentication (a second sign-in step) to log in?", with help text explaining break-glass accounts. The analyst confirms or rejects it.
- **The development database:** the catalogue grants reach the operator's development database only when the orchestrator restarts Strapi. Existing questionnaires (UAT-A, UAT-B, UAT-C and the seeds) have no proposals, and their logs read unchanged. Tests use their own databases.
</specifics>

<deferred>
## Deferred Ideas

- **Analysts keep seeing the last submitted answers after a return to analyst review**, which today turns them back into private drafts. Proposals made in analyst review would then use them too. This needs a decision on Phase 10 D-07 and an answer-envelope amendment (`phase-03-questionnaire-json-contract.md`); a later phase can take it.
- **A notification when AI proposals are ready:** not in decision 18's or G-18's event list. Phase 19.1's notification centre (G-19), whose kind vocabulary later phases extend, could add it.
- **Open-proposal counts on the questionnaire review list and the analyst Home:** not asked for. A candidate for Phase 21's analyst metrics.
- **A bulk "Confirm remaining":** withheld so each question is reviewed on its own (D-33). The UI-SPEC may revisit it with a recorded reason.
- **AI-proposed reordering of existing questions, and moving questions between sections:** not asked for. Placement never reorders (D-13).
- **"Why we are asking" text for the Requestor on follow-up questions:** the help text carries it for now.
- **G-1 on Phase 12's run read for a requesting analyst:** Phase 17.1's pass over review acts.
- **Local model evaluation of these operations:** backlog 999.1. The portable schema subset keeps it open.
</deferred>

## Orchestrator Confirmations (2026-10-01, post-demo Stage 2)

- **Phase 10 D-08 narrowed (accepted by the pilot):** D-09 narrows Phase 10 D-08's "Replace questionnaire". Phase 10 builds first: its plan 10-12 delivers D-08 as written, for Phase 10's own scope. This phase narrows it when it runs, and the Phase 15 plan that adds D-09's refusals changes 10-12's behaviour and tests in that plan.

---

*Phase: 15-steerable-questionnaire-ai*
*Context gathered: 2026-10-01*
