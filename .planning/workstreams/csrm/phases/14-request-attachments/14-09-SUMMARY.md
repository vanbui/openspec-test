---
phase: 14-request-attachments
plan: 09
subsystem: api
tags: [strapi, attachments, ai-inclusion, text-extraction, ai-data-policy, human-analyst-only, request-lock, openapi, openapi-fetch, zod]
requires:
  - phase: 14-request-attachments
    provides: "14-02 extractAttachmentText and EXTRACTOR_VERSION; 14-03 TEXT_BEARING_ATTACHMENT_TYPES, ATTACHMENT_LIMITS.textCapCharacters and logSecurityEvent; 14-06 the content type, the projection and the event log; 14-07 readVerifiedStoredFile; 14-08 removal ending inclusion"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "evaluateAiDataPolicy, readAiDataPolicyConfiguration and the harness's withAiDataClassificationCeiling"
  - phase: 13-request-pick-up-and-notes
    provides: "canUseRequestNotes (the readers), withRequestLock, the note ai_input precedent (OWN_REQUEST as 403, the WR-102 fact)"
provides:
  - "PUT /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input (CSRM_REQUEST_ATTACHMENT_OPERATIONS.setAiInput, handler setAiInput, function.risk_assessment_requests.attachment_ai_input_api.api.01)"
  - "GET /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text (getAiText, .api.02)"
  - "The Function function.risk_assessment_requests.attachment_ai_input_api, granted both ways to role.security_analyst alone in both catalogue copies; both operations as literals in HUMAN_ANALYST_ONLY_OPERATIONS and its matrix mirror (17 + insights)"
  - "The policy fact canUseAttachmentAiInputs (an eligible person holding the inclusion through the human Security Analyst role)"
  - "attachment-rules.ts: aiInputRefusalFor, aiPolicyRefusalFor, AttachmentAiInputRefusal, AttachmentAiPolicyRefusal; AttachmentCaller.aiInputs"
  - "request-attachments.ts: setRequestAttachmentAiInput, readRequestAttachmentAiText"
  - "attachment-projection.ts: the optional ai field (projectAttachmentAi), the list's meta.aiPolicy (projectAttachmentAiPolicy), parseAttachmentAiTextFacts"
  - "Spec: both paths; RequestAttachmentAiInputRequest, RequestAttachmentAiFacts, RequestAttachmentAi, RequestAttachmentAiPolicy, RequestAttachmentAiTextResponse; RequestAttachment.ai and RequestAttachmentListMeta.aiPolicy optional"
  - "Web: setRequestAttachmentAiInput and getRequestAttachmentAiText (attachments-service.ts), registered in the parity guard; the AI schemas in attachments-schema.ts"
affects: [14-10, 14-11, 14-12, 14-13, 14-14, 14-17, 15, 16, 17, 22]
actuals:
  tokens: 36200
  tasks: 3
  commits: 7
plan_head_before: 3ff4cf86610c3b9d49a488b8b79c7094511f9203
plan_head_after: e8578694edbdc259061acad71770dc9a9b04cd55
tech-stack:
  added: []
  patterns:
    - "Opt-in extraction: read the verified bytes and extract in the bounded worker outside the lock, then under withRequestLock re-read the request, the file and the AI data policy, re-check the rule and write the facts with their event"
    - "A request-level refusal (who, the window, the policy) shared by the per-file rule and the section's line, so the section never promises what each file would be refused"
    - "AI facts served on the inclusion's own grant (canUseAttachmentAiInputs), never on the attachments grant"
key-files:
  created:
    - apps/backend/tests/attachment-ai-input.integration.test.ts
  modified:
    - apps/backend/src/api/csrm-request-attachment/operations.ts
    - apps/backend/src/api/csrm-request-attachment/routes/request-attachments.ts
    - apps/backend/src/api/csrm-request-attachment/controllers/request-attachments.ts
    - apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts
    - apps/backend/src/api/csrm-request-attachment/services/attachment-rules.ts
    - apps/backend/src/api/csrm-request-attachment/services/attachment-projection.ts
    - apps/backend/src/policies/csrm-authorization.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/attachment-rules.unit.test.ts
    - apps/backend/tests/request-attachments.integration.test.ts
    - apps/backend/tests/authorization-policy.unit.test.ts
    - apps/backend/tests/analyst-insight-authorization.unit.test.ts
    - apps/csrm/src/features/attachments/attachments-schema.ts
    - apps/csrm/src/features/attachments/attachments-service.ts
    - apps/csrm/src/features/attachments/attachments-service.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
key-decisions:
  - "The policy fact canUseAttachmentAiInputs (eligible person, inclusion held through the human Security Analyst role; WR-102's pattern) gates both operations' services (403 without it) and whether any AI fact is served."
  - "Rule order: OWN_REQUEST (403), REQUEST_NOT_SUBMITTED, ATTACHMENTS_CLOSED; then an exclusion or a change to the current value is allowed; then the file's state, its type and the AI data policy apply to an inclusion only."
  - "Exclusion is allowed whatever the policy or the file's state while the window is open, so text can always be taken away from the AI (an included file whose bytes vanish can still be excluded)."
  - "A file already as asked answers 200 with nothing read, extracted, written or logged (PUT is idempotent, as 14-08's removal)."
  - "An inclusion with no policy decision fails closed with AI_POLICY_NOT_CONFIGURED."
  - "Including reads the bytes through readVerifiedStoredFile: missing bytes are 409 ATTACHMENT_UNAVAILABLE, and a digest mismatch is 409 ATTACHMENT_INTEGRITY_FAILED with a warning-level attachment.integrity_failed line."
  - "A full or unreadable history refuses (409 HISTORY_UNAVAILABLE) before extraction and again under the lock."
  - "aiTextFacts is stored as { available, kept, truncated, extractor, extractedAt } and parsed closed on read; a damaged record reads as having no stored text."
  - "The preview has no window (it reads the record), applies OWN_REQUEST and the inclusion fact, and writes and logs nothing."
  - "Every refused AI change of a file the caller can see (all but a 404) is one attachment.refused line, as 14-08's removal."
  - "An included file's ai.canChange stays true under a refusing policy (exclusion is allowed); meta.aiPolicy.canChange speaks for inclusion."
  - "The requesting analyst is served the AI facts with canChange false and meta.aiPolicy.refusal OWN_REQUEST, so the UI can show UI-SPEC §5.1's G-1 line."
  - "unavailableReason puts ATTACHMENT_NOT_TEXT_BEARING before ATTACHMENT_QUARANTINED (the permanent reason first); the rule refuses by state first, in the plan's order."
  - "An analyst's upload, removal and restore answers carry ai too, so a row the UI replaces keeps its AI facts; the Requestor's answers never do."
requirements-completed: [COLLAB-02]  # traced here; COLLAB-02 stays Pending until the 14-17 phase gate
coverage:
  - id: D1
    description: "Bob includes the vendor security pack Jane posted with her note: 200 with ai { included, facts { available, kept, truncated: false }, canChange }; the record holds aiText with the offshore-access fact, aiTextFacts with EXTRACTOR_VERSION and an ai-included event; one attachment.ai_inclusion_changed line (from false, to true) without the text; the preview returns exactly the stored text and facts; excluding deletes both, appends ai-excluded and the preview then answers 409 ATTACHMENT_TEXT_UNAVAILABLE"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/attachment-ai-input.integration.test.ts#Bob includes the vendor security pack Jane posted with her note, previews exactly what the AI would read, and excludes it again (D-30, D-31, D-33, D-37)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Jane, the other Requestor and the service agent get 403 at both operations with nothing written and no text served; both operations are human-analyst-only literals, held by one Function granted to role.security_analyst alone (both ways, both copies, cmp silent), with matrix rows owner 403, other 403, analyst 200, serviceAgent 403, noIdentity 403, and served once each"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/attachment-ai-input.integration.test.ts#Jane, the other Requestor and the service agent get 403 at the AI inclusion and the preview, with nothing written and no text served (D-30, D-38)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts (130 rows; both new rows; HUMAN_ANALYST_ONLY_COUNT 17 + insights)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 14 attachment AI inclusion and preview are held by one human Security Analyst-only Function and published closed"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/authorization-policy.unit.test.ts (the mis-granted agent and the canUseAttachmentAiInputs fact)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every refusal with its reason and nothing written: OWN_REQUEST for the requesting analyst (inclusion, exclusion, preview) while the second analyst includes; REQUEST_NOT_SUBMITTED; ATTACHMENTS_CLOSED; ATTACHMENT_NOT_TEXT_BEARING, ATTACHMENT_QUARANTINED, ATTACHMENT_REMOVED, ATTACHMENT_BLOCKED, ATTACHMENT_UNAVAILABLE; ATTACHMENT_TEXT_UNAVAILABLE for a scanned PDF; ATTACHMENT_INTEGRITY_FAILED; AI_CLASSIFICATION_ABOVE_CEILING under a pinned ceiling while exclusion still works; AI_POLICY_NOT_CONFIGURED (unit); HISTORY_UNAVAILABLE; the idempotent repeat; 400 bodies and 404 foreign ids"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/attachment-ai-input.integration.test.ts (the nine 14-09 Task 2 tests)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/attachment-rules.unit.test.ts (the two aiInputRefusalFor tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A 30,000-character file keeps its first 20,000: facts available 30,000, kept 20,000, truncated true, and the preview sends exactly those characters"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/attachment-ai-input.integration.test.ts#a text file of 30,000 characters keeps its first 20,000, with 30,000 available and truncated, and the preview sends exactly those (D-33)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Analysts' lists carry each file's AI facts and meta.aiPolicy (canChange, refusal, classification, ceiling): the image and the quarantined file say why; the policy names AI_CLASSIFICATION_ABOVE_CEILING, OWN_REQUEST and ATTACHMENTS_CLOSED (facts and preview stay readable after release); a Requestor's list has no ai key and no aiPolicy"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/attachment-ai-input.integration.test.ts (the three 14-09 Task 3 tests)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#Jane lists her draft's file with the add facts, Bob sees it without the add, and a legacy request lists none (D-16, D-28)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The contract chain and the typed web calls: the spec, the regenerated client (api:check 0), the inventory, setRequestAttachmentAiInput and getRequestAttachmentAiText parsing closed responses, the list parser taking both shapes, and the parity guard"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/attachments/attachments-service.test.ts; apps/csrm/src/features/contract-response-parity.test.ts; apps/csrm/src/features/contract-operation-chain.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/backend test (1220/1220); pnpm --dir apps/csrm test (4451/4451); api:check; cmp"
        status: pass
    human_judgment: false
duration: 92min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 09: Attachment AI Inclusion and the Text Preview Summary

**A human Security Analyst who did not raise the request can now include a clean, text-bearing file's text in what the AI may read, see exactly how much is kept, and read the stored text before generating. `PUT …/attachments/{attachmentId}/ai_input` extracts the text on opt-in in the bounded worker outside the request lock, caps it at 20,000 characters with the counts and the extractor version, and refuses whatever generation would refuse. `GET …/ai_text` serves the stored text to the same analyst. Both are held by a new human-only Function. Analysts' lists now carry each file's AI facts and the section's AI policy; a Requestor sees neither.**

PHASE_14_BASE=e50053f. COLLAB-02 is traced here but stays Pending until 14-17's phase gate (`requirements-completed` copies the plan's array, as the template asks). REQUIREMENTS.md is unchanged.

## Performance

- **Duration:** 92 min (2026-10-10T01:03:45Z to 02:36:28Z). This includes two full Strapi suites (21.5 and 20 min); the second ran after the fix below.
- **Tasks:** 3 of 3, each test first (a RED commit, then a GREEN commit), plus one fix commit. Task 1 is the tracer. Its verify was re-run on the committed code (`cmp` silent, `api:check` 0, guards 192/192, typecheck clean, the five node files green), so expansion went ahead with no checkpoint (interactive, end-of-phase, automated-only verify).
- **Files:** 24 (1 created, 23 modified; 2,019 lines added, 31 removed).

## Accomplishments

- **The two operations.**
  - Inclusion: `PUT …/attachments/{attachmentId}/ai_input`, handler `setAiInput`, held by `function.risk_assessment_requests.attachment_ai_input_api.api.01` ("Set Assessment Request Attachment AI Input"). The body must be exactly `{ data: { included: boolean } }`; anything else is a 400.
  - Preview: `GET …/ai_text`, handler `getAiText`, held by `.api.02` ("Read Assessment Request Attachment AI Text"). It answers `{ data: { text, facts: { available, kept, truncated, extractor, extractedAt } } }`.
  - The Function is granted both ways to `role.security_analyst` alone, in both catalogue copies. Design note 6 records it.
  - Both operations are listed as literals in `HUMAN_ANALYST_ONLY_OPERATIONS`, with their own denial sentence, and in the matrix's mirror.
- **Authorisation.**
  - The policy refuses the Requestor, the other Requestor and the service agent with 403 before anything is read.
  - The controller admits readers through `canUseRequestNotes`; anyone else, a missing request or a foreign file id gets 404.
  - The services require the new policy fact `canUseAttachmentAiInputs`; without it the answer is 403.
- **`setRequestAttachmentAiInput`.**
  1. It reads the file and the request's AI data policy, then applies `aiInputRefusalFor`.
  2. A file already as asked is answered unchanged, with nothing written.
  3. It checks that the history can take the event.
  4. Including reads the verified bytes and calls `extractAttachmentText` with the 20,000 cap, outside the lock.
  5. Under `withRequestLock` it re-reads the request, the file and the policy, re-checks the rule, then writes `aiTextIncluded`, `aiText` and `aiTextFacts` with an `ai-included` event. Excluding writes false and nulls with `ai-excluded`.
  - Each change logs one `attachment.ai_inclusion_changed` line (`from`, `to`, `included` or `excluded`), and every refusal but a 404 logs one `attachment.refused` line. No line carries the text or the file's name.
- **`aiInputRefusalFor`**, in order:
  1. 403 `OWN_REQUEST`;
  2. 409 `REQUEST_NOT_SUBMITTED`;
  3. 409 `ATTACHMENTS_CLOSED`;
  4. an exclusion, or the current value, is allowed;
  5. 409 `ATTACHMENT_REMOVED`, `ATTACHMENT_BLOCKED`, `ATTACHMENT_QUARANTINED` or `ATTACHMENT_UNAVAILABLE`;
  6. 409 `ATTACHMENT_NOT_TEXT_BEARING`;
  7. 409 `AI_CLASSIFICATION_ABOVE_CEILING` or `AI_POLICY_NOT_CONFIGURED`.
  - The service adds 409 `ATTACHMENT_TEXT_UNAVAILABLE`, `ATTACHMENT_INTEGRITY_FAILED` and `HISTORY_UNAVAILABLE`.
- **`readRequestAttachmentAiText`** applies `OWN_REQUEST`, then returns the stored text and its closed facts. A file that is not included, or a damaged record, answers 409 `ATTACHMENT_TEXT_UNAVAILABLE`. It has no window check, and it writes nothing.
- **The analysts' AI facts.** These are served only to a viewer with `canUseAttachmentAiInputs`:
  - each file's `ai`: `included`, `facts` (`available`, `kept`, `truncated`) or null, `unavailableReason` (`ATTACHMENT_NOT_TEXT_BEARING` or `ATTACHMENT_QUARANTINED`) and `canChange`;
  - the list's `meta.aiPolicy`: `canChange`, `refusal` (from `aiPolicyRefusalFor`, the rule's request-level part), `classification` and `ceiling`;
  - upload, removal and restore answers carry `ai` too.
- **The contract.**
  - The spec has both paths and five closed components; `RequestAttachment.ai` and `RequestAttachmentListMeta.aiPolicy` are optional.
  - The client is regenerated, and `api:check` exits 0.
  - The inventory has both rows (roles `role.security_analyst`; web caller `attachments-service.ts`).
- **The web.**
  - `setRequestAttachmentAiInput(requestId, attachmentId, included)` and `getRequestAttachmentAiText(requestId, attachmentId)` call the generated paths and parse closed responses (the preview is capped at 20,000).
  - Both are registered in the parity guard.
  - The list parser takes both shapes, and refuses an undeclared AI key or value.

## Matrix

There are 130 matrix rows, two of them new. Both new rows expect:

| owner | other | analyst | serviceAgent | noIdentity |
|---|---|---|---|---|
| 403 | 403 | 200 | 403 | 403 |

- The analyst's 200 is proven by the mounted inclusion test (`provenBy`), because the matrix's draft would answer 409.
- The PUT row checks that persistence is unchanged.
- `HUMAN_ANALYST_ONLY_COUNT` is now `17 + insightOperations.size`.

## Task Commits

1. **Task 1 (tracer):** `242b65fd` test (RED), `13b73f74` feat (GREEN)
2. **Task 2:** `de5c5025` test (RED), `3daee100` feat (GREEN)
3. **Task 3:** `141a3c9c` test (RED), `2fdd53ce` feat (GREEN)
4. **Fix:** `e8578694` (the policy decision's exact-shape tests, and proofs of the new fact)

`git rev-list --count 3ff4cf86..HEAD` is 7 before this summary's commit.

## Verification

- **RED evidence** (TAP reporter; `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for each task):
  - **Task 1:** Strapi, 5 files: `# tests 179 / # pass 170 / # fail 9`. The failures were the mounted inclusion (405, not mounted), the refusals, the inventory, matrix completeness, provenance, the human-only literal and both rows, and the catalogue Function. Web: 7 failures (the missing calls and spec paths).
  - **Task 2:** `# tests 21 / # pass 16 / # fail 5`. The state and image refusals, the integrity refusal, the ceiling, the repeat and history, and the rule's order failed as intended. The rest passed at RED; see Issues.
  - **Task 3:** Strapi, 3 files: `# tests 73 / # pass 68 / # fail 5`. The AI facts and policy were missing (lists, answers, catalogue, and the existing Bob-list case). Web: 2 failures (the `aiPolicy` meta parse and the spec reference).
- **GREEN, focused:**
  - Task 1:
    - node, 6 files (`attachment-ai-input`, `contract-catalogue`, `served-operations`, matrix provenance, matrix, `request-attachments`): `ℹ tests 212 / ℹ pass 212 / ℹ fail 0`;
    - vitest (parity, chain, `src/features/attachments`): `Tests 209 passed (209)`;
    - web typecheck and lint clean;
    - `cmp` silent, and `api:check` 0 after the commit.
  - Task 2 (`attachment-rules.unit`, `attachment-ai-input.integration`): `ℹ tests 21 / ℹ pass 21 / ℹ fail 0`.
  - Task 3:
    - node, 4 files (`attachment-ai-input`, `contract-catalogue`, `request-attachments`, `attachment-rules.unit`): `ℹ tests 82 / ℹ pass 82 / ℹ fail 0`;
    - vitest (parity, chain, `src/features/attachments`): `Tests 210 passed (210)`;
    - web typecheck clean; `api:check` 0 after the commit.
  - Fix (`authorization-policy.unit`, `analyst-insight-authorization.unit`): `ℹ tests 49 / ℹ pass 49 / ℹ fail 0`.
- **Full suites:**
  - Strapi, first run on `2fdd53ce`: `ℹ tests 1218 / ℹ pass 1210 / ℹ fail 8` (1,292 s). All 8 were exact-shape policy decision assertions; see Deviations.
  - Strapi, after `e8578694`: `ℹ tests 1220 / ℹ pass 1220 / ℹ fail 0` (1,204 s).
  - Web (`pnpm --dir apps/csrm test`): 196 files, `Tests 4451 passed (4451)`.
- **Acceptance criteria:**
  - Both catalogue copies hold the Function with `roleIds` exactly `["role.security_analyst"]`, and only `role.security_analyst`'s `functionIds` names it.
  - Each policy literal greps to 1.
  - The matrix test asserts `17 + insightOperations.size`.
  - `extractAttachmentText` is called before `withRequestLock` in `setRequestAttachmentAiInput`.
  - The integration and unit files have a test for every reason in the plan, plus the truncation facts.
  - `ai` and `meta.aiPolicy` are added only when the caller holds the inclusion.
- **EICAR guard:** `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing.
- **Playwright:** not run (the plan runs none).

## Decisions Made

See `key-decisions` in the frontmatter (one line each).

## Deviations from Plan

1. **[Rule 1 - Bug] Exact-shape policy tests broke on the new fact.** Eight `deepEqual` assertions in `authorization-policy.unit.test.ts` and `analyst-insight-authorization.unit.test.ts` lacked `canUseAttachmentAiInputs`. Only the full suite reads those files, so the focused runs missed them. The fix commit `e8578694` updates them and adds two proofs of the fact.
2. **[Rule 2 - Security] Integrity check before extraction.** Bytes are read through `readVerifiedStoredFile`, so tampered bytes are never parsed or sent to the AI. A mismatch is 409 `ATTACHMENT_INTEGRITY_FAILED` with a warning-level `attachment.integrity_failed` line (`3daee100`).
3. **[Rule 2 - Security] A policy fact, not the list grant, gates the AI facts.** `canUseAttachmentAiInputs` follows Phase 13's WR-102 pattern (`13b73f74`, `csrm-authorization.ts`, which is in the plan's file list).
4. **[Rule 3 - Blocking] Files outside the plan's list.**
   - `request-attachments.integration.test.ts`: the served-route test now admits the two AI routes, and Bob's list case expects `ai` and `aiPolicy`.
   - `attachments-service.test.ts` holds the web call tests, as 14-06 to 14-08 did.
   - Two policy unit test files (see 1).
5. **[Plan shape] The spec's `aiPolicy` landed in Task 3, not Task 1.** The parity guard ties every spec component to its parser, so the meta's `aiPolicy` went in with the web meta parser (`2fdd53ce`). Everything else of the spec landed in Task 1.
6. **[Plan shape] Truncation is proven with a TXT file, not a PDF.** PDF text extraction adds line breaks, so no PDF carries exactly 30,000 characters; a TXT file gives exact `available` and `kept` counts.
7. **[Plan shape] AI facts on the upload and removal answers too.** These were not asked for, but they keep the UI's row consistent after an analyst's upload, removal or restore. The Requestor's answers are unchanged.

**Total deviations:** 7 (1 Rule 1, 2 Rule 2, 1 Rule 3, 3 plan-shape notes). **Impact:** no change to scope. No content type, schema field or relation changed (only the approved attachment schema's existing `aiTextIncluded`, `aiText` and `aiTextFacts` are written), and no dependency was added.

## Issues Encountered

- **Several Task 2 cases passed at RED.** These were `OWN_REQUEST`, the draft and closed windows, the scanned PDF, truncation, and the malformed bodies and foreign ids. Task 1's GREEN applied the identity and window rules (the plan puts the rule in Task 1). Handling an unavailable extraction is required by its result type, and the cap was passed from the start. The other five failed as intended.
- **The Task 3 web list cases** failed at RED only on `aiPolicy`. The per-file `ai` was already in the parser from Task 1, because the PUT answer needs it.
- **Shell heredocs mangle quotes on this host** (as in 14-08). Every edit went through the Edit and Write tools or a Python script read from a file.
- **Line endings.** The catalogue copies use CRLF in the working tree; the spec and inventory use LF. The edit scripts follow each file's own ending.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- **T-14-33** is mitigated: no grant for the Requestor or the agent, both literals in `HUMAN_ANALYST_ONLY_OPERATIONS`, `OWN_REQUEST` as 403, and the matrix rows. The policy fact also excludes dual-role holders.
- **T-14-34** is mitigated: inclusion is refused while `evaluateAiDataPolicy` refuses, re-read under the lock, and a missing decision fails closed.
- **T-14-35** is mitigated: `aiText` stays private and is served only by the analyst preview; no event or list carries it; a Requestor's answers have no `ai` key.
- **T-14-36** is mitigated: extraction runs only on opt-in, in the single-slot bounded worker, outside the lock, and never for a no-op or a refused file.
- No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-10 and 14-11** (the AI context, the run summary v3 and the signal) can read `aiTextIncluded`, `aiText` and `aiTextFacts` (`parseAttachmentAiTextFacts`) as the only inclusion facts. Generation must re-check `evaluateAiDataPolicy`, as the inclusion does.
- **14-12 onwards** (the UI) can drive the control from each file's `ai`, take the section line from `meta.aiPolicy` (UI-SPEC §5.1), and fill the preview sheet from `getRequestAttachmentAiText`. Under a refusing policy, `ai.canChange` stays true for an included file (exclusion is allowed); the UI decides whether to offer it.
- **Phase 22** owns the AI ceiling the inclusion reads.

## Self-Check: PASSED

- FOUND: every file in `key-files`.
- FOUND: `242b65fd`, `13b73f74`, `de5c5025`, `3daee100`, `141a3c9c`, `2fdd53ce`, `e8578694`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
