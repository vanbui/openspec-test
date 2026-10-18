---
phase: 08-production-integration-and-hardening
verified: 2026-09-26T12:09:58Z
verified_commit: 3ca0a3d
initially_verified: 2026-09-26T07:46:53Z
initially_verified_commit: d11f469
status: passed
score: "5/5 roadmap success criteria (criterion 2's Keycloak half deferred with INT-02); 3/3 in-scope requirements (INT-01, INT-03, INT-04; INT-02 deferred); 51/51 locked decisions (D-05 now verified: G2 closed); 55/55 plan must-have truths"
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "5/5 roadmap success criteria; 3/3 in-scope requirements; 50/51 locked decisions (D-05 partial: G2); 55/55 plan must-have truths"
  previous_verified_commit: dd2b25b
  previous_verified: 2026-09-26T11:28:48Z
  gaps_closed:
    - "G2: Nothing stays invisible to the contract parity guard (D-05), the answer envelope inside the questionnaire question list included. Closed by fc6a791 (the red-first rules) and f3dc30f (the fix), with the records in 4f8b4e2. Each envelope rejection is reported at its field, the blanket answer narrowing is gone, and a narrowing may no longer hide a rejection below it. A planted narrowing inside the envelope now fails the guard at its inner path (probes run in this session)."
  gaps_remaining: []
  new_gaps: []
  regressions: []
gaps: []
closed_gaps:
  - id: G2
    closed_in: "fc6a791 (the red-first rules), f3dc30f (the fix), 4f8b4e2 (R-08-18 and the security record), 3ca0a3d (the validation sign-off)"
    truth: "Nothing stays invisible to the contract parity guard (D-05): the answer envelope inside the questionnaire question list"
    status: closed
    status_at_dd2b25b: partial
    reason: "questionnaire-schema.ts checked each question's answer with a nested answerEnvelopeSchema(answerType).safeParse and reported any failure as one custom issue at answer. The four question-list registrations (getQuestionnaireQuestions, saveQuestionnaireDraft, submitQuestionnaire, revertQuestionnaireToDraft) narrowed exactly that path, for the reason 'an answer envelope that matches its answer type'. The narrowing therefore tolerated every rejection inside the envelope, not only the type match. A scratch probe on the registered parser showed four corruptions each reported at data.0.answer alone: a mistyped state, a 70,000-character value, an unrecognised envelope key and a wholly mistyped answer. Neither G1 rule reached the envelope: the field-path rule corrupts only the first field, and the question-key rule corrupts options.questionKey. Runtime was unaffected, because a refused envelope fails closed."
    artifacts:
      - path: "apps/web/src/features/questionnaires/questionnaire-schema.ts"
        issue: "Line 124 leaves answer as unknown. Lines 147-154 ran the nested safeParse and added one issue at ['answer'] for any failure, so every inner rejection lost its path."
      - path: "apps/web/src/features/questionnaires/questionnaire-service.ts"
        issue: "Lines 368-374 and 382-385: the four registrations narrowed data.0.answer and data.answers.0.answer, which tolerated the whole envelope."
      - path: "docs/security/phase-08-residual-risks.md"
        issue: "R-08-18 (line 79) said narrowing an inner field without a registration now fails the guard. Inside the answer envelope it did not."
    missing:
      - "Forward each envelope issue with its path under answer, as releasedAssessmentDetailForActorSchema does (assessment-schema.ts:358-362). The runtime result is unchanged."
      - "Re-run the parity file and replace the .0.answer narrowings with the exact inner paths the synthesised answer then breaks, each with its reason. Alternatively, give the synthesised Text question a Text answer."
      - "Correct R-08-18's closing claim and the STATE parity rule."
      - "Consider a guard rule that corrupts a leaf below every narrowed object path and requires the rejection at that leaf. It would have caught this, and it closes the data-level wrapper case in advisory."
      - "Alternatively, accept it with the override in the Gaps summary. It then counts as PASSED (override)."
    closure: "Each item of missing is done, except the STATE wording, which is the orchestrator's close. (1) questionnaire-schema.ts:150-157 forwards each envelope issue with its path under answer and keeps a refused key's name and code; unlike assessment-schema.ts:358-362, it does not recast issues as custom, because the guard names a refused key by its own path. The answer is refused in exactly the same cases. (2) The four registrations replace the blanket answer narrowing with the one path the guard now sees, …answer.submittedAt on a draft, with its reason (questionnaire-service.ts:369-376): the contract's single envelope leaves submittedAt optional in either state, and the server writes it only on a submitted answer (questionnaire-workflow.ts:55-67). The only other rejection now visible inside the envelope is boundary-long's text-answer cap, which the question list's grandfather reason now names; the count stays 43. (3) R-08-18 and the T-08-04-02 note say the closure covers the envelope (4f8b4e2). STATE.md:663's parity rule is in What remains. (4) The leaf-below-narrowing rule is contract-response-parity.test.ts:620."
    evidence: "RED on fc6a791, the new rules on the unfixed code: 5 failed, 128 passed. The answer-envelope rule (:574) saw each registration report the corrupted state only at …0.answer, and the hidden-narrowing rule (:620) found the four answer narrowings hiding a mistyped schemaVersion. GREEN on f3dc30f: parity 133/133; web 99 files, 1,892 tests; typecheck and api:check clean. Sensitivity: a 5-character cap planted on a text answer's value fails 8 of 133 on f3dc30f, the four contract-mode tests exactly at data.0.answer.value or data.answers.0.answer.value. On the pre-fix sources (7d89665) the same plant passes all 128 earlier tests, and only the five new rules fail. Data-level wrapper probes: on administration.getRiskType it fails the new rule and STALE_GRANDFATHER; on alerts.listAlerts, never grandfathered, it fails the new rule alone."
  - id: G1
    closed_in: "0a98c21 and 4eb9ffd (the red-first rules), 390247e and de40347 (the fixes), cf44ae0, b42f5f0 and 69e7b21 (the records)"
    truth: "No response parser stays invisible to the contract parity guard (D-05, D-40; 08-04 must-have truth 3)"
    status: closed
    status_at_d11f469: partial
    reason: "Nine response parsers (the eight administration.* parsers and risks.listRiskRegister) are registered through root-reporting responseParser wrappers with narrowedPaths: ['data'] and no reason beside that narrowing. The wrapper turns any inner rejection into one issue with an empty path, the guard reports an empty path as 'data', and 'data' is a registered narrowing, so no guard mode (minimal, maximal, nullable or either boundary mode) can see a field-level narrowing in them. They are outside the 33-entry grandfather list and its asserted count. The phase recorded this as residual R-08-18 and routed it through 08-13 and 08-14 to this verification, but no plan resolved it. The rest of D-05 and D-40 holds: IN-03 is closed by contract, the boundary modes run for every parser, the 33 older parsers are grandfathered one entry each with a reason, the count is asserted, and no Phase 7 parser can be grandfathered."
    artifacts:
      - path: "apps/web/src/features/administration/administration-service.ts"
        issue: "Lines 52-55: responseParser wraps each closed parser in z.unknown().superRefine and adds one issue with no path on any failure. Lines 62-69: all eight administration.* registrations carry narrowedPaths: ['data'] with no stated reason."
      - path: "apps/web/src/features/risks/risk-service.ts"
        issue: "Lines 30-33: the same root-reporting wrapper. Line 40: risks.listRiskRegister carries narrowedPaths: ['data'] with no stated reason."
      - path: "apps/web/src/features/contract-response-parity.test.ts"
        issue: "Lines 346-354: an issue with an empty path is reported as 'data', so a registered 'data' narrowing tolerates every inner rejection in every mode. Line 469 asserts the backlog count of 33, which does not include these nine."
      - path: "docs/security/web-headers.md"
        issue: "Line 143 says closed Zod parsers at every trust boundary are proven by the parity guard. At field level that is not true for these nine."
      - path: "docs/security/phase-08-residual-risks.md"
        issue: "Line 61 (R-08-18) counts ten wrapper parsers. getQuestionnaireGenerationJob is registered directly through responseOf (assessment-service.ts:66, :117-127), its inner issues keep their paths, and 08-04-SUMMARY tables its field-level boundary rejections, so the wrapper set is nine."
    missing:
      - "Let the guard see inside the nine parsers: register the underlying closed schemas directly, or make both wrappers forward the inner ZodError issues with their paths (the inner functions throw ZodError from schema.parse, administration-schema.ts:258 and :267, risk-schema.ts:161), and remove the blanket narrowedPaths: ['data'] from the nine registrations."
      - "Register each deliberate inner narrowing the guard then reports in narrowedPaths with its reason, or grandfather each parser that only the boundary modes reject with one entry and a reason, and move the asserted count from 33 on purpose."
      - "Correct docs/security/web-headers.md:143 and R-08-18 to match."
      - "Alternatively, if the operator accepts R-08-18 as this phase's backlog, record the override suggested in the Gaps summary. It then counts as PASSED (override)."
deferred:
  - truth: "Keycloak authorization-code authentication, and Strapi validation of token issuer, audience, signature and expiry (INT-02; the Keycloak half of roadmap success criterion 2)"
    addressed_in: "No later phase. Deferred by operator decision (2026-09-25); revisit when the operator provides a Keycloak environment."
    evidence: "08-CONTEXT.md D-01; REQUIREMENTS.md:71 and :110 (INT-02 unchecked, with the verbatim deferral wording); STATE.md:7 ('phase complete except INT-02'); residual rows R-08-01, R-08-02, R-08-03 and R-08-28. The phase added no Keycloak line under apps or the manifests."
advisory:
  - finding: "SR-01 (blocker) held at the gate commit: on 0290f4f, a production build started with NODE_ENV=development offered the development sign-in with no attestation and without either D-11 variable, so D-11 and 08-02 truth 2 were false there."
    category: fixed
    reason: "Fixed after the review in fa4bc5b (test) and 151a443: resolveSessionRuntimeMode now keys the next dev branch on the compiled NODE_ENV (development-runtime.ts:28-37). production-hardening.spec.ts:243 proves the refused runtime, alongside the unattested proof at :193. Both passed in the post-review browser run on 117741f (82/82). The 08-02 summary, R-08-03 and web-headers.md residual 4 carry correction notes."
    evidence_status: "verified in source and in the post-review run"
    re_verification: "Still fixed at dd2b25b. development-runtime.ts is unchanged since d11f469, and the sign-in page changed its title only (ccf5fc1)."
  - finding: "08-VALIDATION.md's D-02 freeze pathspec 'apps/strapi/src/api/*/content-types' (lines 27 and 81; also 08-14-PLAN.md:72, :156, :165) matches no tracked file as a git pathspec: quoted, or passed literally from PowerShell, it prints nothing even over b4f3d88~1..HEAD, where a schema did change. It works only when an unquoted Git Bash glob expands it to directories first. The correct form is 'apps/strapi/src/api/*/content-types/*'."
    category: record
    reason: "D-02 was verified with the corrected pathspec: 15 schemas matched, 0 changed in a9394cf..HEAD, and the positive control finds b4f3d88 (06.8-01, 2026-09-20), the last schema change. The orchestrator corrects the file at validation sign-off."
    evidence_status: "confirmed by running both forms"
    re_verification: "Corrected in 3ca0a3d, the validation sign-off. The D-02 row and the gate row now read 'apps/strapi/src/api/*/content-types/*', quoted. Re-run from Git Bash and from PowerShell, it matches 15 schemas with 0 changed in a9394cf..HEAD, and the b4f3d88 control fires."
  - finding: "Other 08-VALIDATION.md wording that does not match the Windows gate host or the tools: 'pnpm --filter @csrm/web test -- <pattern>' runs the whole suite (lines 24, 53 and other rows; a targeted run is 'pnpm --filter @csrm/web exec vitest run <paths>'); '/opt/node24/bin', 'lsof' and PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright describe a Linux host (lines 22, 27); row 08-04-01 (line 103) expects eight failing Phase 7 labels where only four can fail, a deviation 08-04 recorded; the frontmatter is still status draft with nyquist_compliant false, and every per-task row is still pending."
    category: record
    reason: "Validation sign-off is the orchestrator's; none of these changes what was proven."
    evidence_status: "confirmed by direct reading"
    re_verification: "Corrected in 3ca0a3d. Every web command is now a targeted 'exec vitest run <path>'; the 30 targeted commands were re-run, and each exits 0. The host commands are host-neutral or given in both forms (lsof, Get-NetTCPConnection and netstat; the two Node paths). Row 08-04-01 names the four labels, and row 08-14-02 uses the keyed attribution-trailer form. D-36 to D-51 and the INT-02 deferral gain map rows. The frontmatter reads status complete, nyquist_compliant true, wave_0_complete true and completed 2026-09-26, and every row carries its verified state with evidence."
  - finding: "Records that trail the code. (1) docs/accessibility/phase-08-wcag22-conformance.md:114 describes expectFocusVisible as asserting 'a computed outline or ring', the helper before SR-04. Since e482a5c it requires focus to add a visible outline or shadow the resting control lacks, which is stronger, and the twelve call sites passed in the post-review runs. (2) The comment at apps/strapi/src/policies/csrm-authorization.ts:21-22 says the catalogue grants each human-analyst-only operation to role.security_analyst only. The assessment release FunctionAPI (function.risk_assessments.risk_assessment_details.api.08) sits in a Function that role.security_analyst_agent also holds, and has done since the initial catalogue."
    category: record
    reason: "(1) The claim still holds, with stronger evidence than the record describes. (2) D-17 holds in effect: the guard refuses the agent 'whatever the catalogue says' (csrm-authorization.ts:19, :270-273), the matrix row expects 403 for the agent on the release, and authorization-policy.unit.test.ts:419 proves the refusal. The comment, or a catalogue design note, should state the actual grant. The comment predates Phase 8 (b4f3d88)."
    evidence_status: "confirmed by direct reading and a script over the catalogue"
    re_verification: "Both corrected. (1) fd0ef46 rewrites the 2.4.7 row (phase-08-wcag22-conformance.md:114). (2) bab4f15 rewrites the comment (csrm-authorization.ts:18-40). A script over the catalogue confirms the new comment: the release reaches role.security_analyst and role.security_analyst_agent, and the other ten human-analyst-only operations reach role.security_analyst only."
  - finding: "Planning-state drift: STATE.md:285, :301 and :453 and deferred-items.md:19 and :36 still describe R-08-25 (the Risk Register journey date) and the 'Draft assistance' empty state as open, although WR-01 (d93b9f8) and WR-06 (8b7ab5c) closed both. The ROADMAP status line cites the 0290f4f counts (Playwright 81, Strapi 504, web 1677) rather than the post-review 82, 514 and 1793."
    category: record
    reason: "Tracking only; the orchestrator owns these files."
    evidence_status: "confirmed by direct reading"
    re_verification: "Mostly corrected (b42f5f0, 69e7b21): R-08-25, the draft copy and G1 now read closed in STATE and deferred-items.md. Still open, for the orchestrator's close: the ROADMAP status line (ROADMAP.md:665), and three entries the UI review has since resolved. STATE.md:304 and deferred-items.md:38 (the development sign-in title) were fixed by ccf5fc1, and deferred-items.md:21 (the h4 captions) by ae9c7da. Since G2 (second re-verification), two more want a line: STATE.md:663's parity rule ('a narrowing names a field, never a whole payload') and deferred-items.md:14 describe the G1 closure only. The G2 unit left STATE, ROADMAP and REQUIREMENTS to the orchestrator, as instructed."
  - finding: "The standing instruction to run 'git checkout --' on apps/web/next-env.d.ts and apps/web/tsconfig.json after a Playwright run is superseded by D-12. next-env.d.ts is untracked and ignored (.gitignore:6), so a checkout of it fails with 'pathspec did not match'. An isolated build points Next at tsconfig.e2e.json (next.config.ts:39), so tsconfig.json is no longer rewritten."
    category: other
    reason: "Operator and agent instructions may want updating; nothing in the repository needs to change."
    evidence_status: "confirmed by git ls-files and the config"
    re_verification: "adefa83 marks the instruction superseded in the nine older documents that carried it. Instructions outside the repository may still carry it."
  - finding: "The MVP goal fails gsd-sdk user-story.validate only because it reads 'I want production authentication…' rather than 'I want to…'. roadmap.get-phase 8 also returns an empty success_criteria array."
    category: other
    reason: "Verification proceeded against the outcome clause and the section's five criteria, as for Phase 7. Rewording the goal is optional."
    evidence_status: "confirmed by running user-story.validate and roadmap.get-phase"
    re_verification: "Unchanged: user-story.validate still returns false, and roadmap.get-phase 8 still returns an empty success_criteria array."
  - finding: "The parity guard's registry is opt-in. Four runtime response schemas have no registered counterpart: the CSV import preview and commit schemas (eight operations, csv-import-schema.ts), the two selected lookups (request-service.ts:126) and the Risk owners picker (risk-schema.ts, pickerResponseSchema('owners')). Four other assessment envelopes reuse item schemas that registered siblings check: the Risk and control-implementation create and update responses, the analyst detail and the release response. web-headers.md:143 still opens with 'at every trust boundary'."
    category: other
    reason: "All predate Phase 8, and none changed in it. 08-04 scoped the guard to registered parsers (its line 77), D-03 asks for registration of new or changed endpoints only, and the initial verification scored D-05 and D-40 over the registered set. The CSV journey previews and commits on the production build at both widths, so today's served shapes pass. A completeness check, requiring every transport payload parse to name a registered schema, would close the class."
    evidence_status: "confirmed by a sweep of every client call and response parse against the 58 registered labels"
  - finding: "The guard synthesises one branch per union. getAssessmentDraftJob names no branch, so only the queued state of the four-branch AssessmentDraftJob union is exercised. The flat QuestionnaireGenerationJob contract yields only queued."
    category: other
    reason: "This is the guard's stated design: a union is served by the named branch, or else the first. The generation job's shape is a recorded contract gap. One registration per branch would cover the draft job's other states, as getReleasedAssessment does for its two actors."
    evidence_status: "confirmed by reading the guard, the registrations and the contract"
  - finding: "The field-path rule accepts an enclosing path, so that union failures pass. It therefore does not catch a wrapper that reports at data rather than at the root, registered with a data narrowing. In a scratch probe such a wrapper hid a planted bound from the contract-mode, field-path and stale-narrowing tests. Only STALE_GRANDFATHER caught it, because that parser is grandfathered."
    category: other
    reason: "No registration does this today: there is no data narrowing and no wrapper. G2 is the same shape at field scope. A rule that corrupts a leaf below each narrowed object path would close both."
    evidence_status: "confirmed by a scratch probe against the real guard"
    re_verification: "Closed by the hidden-narrowing rule (fc6a791; contract-response-parity.test.ts:620). Where a narrowing names an object or a list, a mistyped field inside it must be reported inside it; a key the parser refuses outright is exempt. Scratch probes planted this item's data-level wrapper, registered with a data narrowing. On administration.getRiskType it failed the new rule and STALE_GRANDFATHER. On alerts.listAlerts, a Phase 7 parser that is never grandfathered, it failed the new rule alone (1 of 133): 'data hides the mistyped data.0.id (reported at data)'."
  - finding: "The security re-audit (recorded in dd2b25b) marks T-08-04-02 closed on the field-path and question-key rules. Both rest on the same visibility claim as R-08-18, which G2 qualifies for the answer envelope."
    category: record
    reason: "The security record is the auditor's, and it may want a note once G2 is fixed or accepted. The residual is low, because runtime fails closed."
    evidence_status: "confirmed by direct reading"
    re_verification: "Noted in 4f8b4e2. The T-08-04-02 note, the control coverage row and the R-08-18 log row in 08-SECURITY.md now say the closure covers the answer envelope too, citing the two new rules and the planted-cap evidence. The audit's own verdicts and its audit trail are unchanged."
  - finding: "The question list's cycle check reports at options.visibility with no question index (questionnaire-schema.ts:258, inside the list-level refinement), so the guard reads it as data.options.visibility or data.answers.options.visibility. Those registered narrowings name no payload path."
    category: other
    reason: "It hides nothing: no structural issue can carry that path, because data is a list, so the narrowing matches only this one custom issue. The hidden-narrowing rule skips it because the path holds nothing. Its only cost is that a cycle rejection does not say which question closes the cycle. With the index added, the issue would land on data.0.options.visibility, which is already a registered narrowing, and the index-less narrowing could go."
    evidence_status: "confirmed by direct reading and the scratch probes of this session"
---

# Phase 8: Production Integration and Hardening Verification Report

**Phase Goal:** As a CSRM operator, I want production authentication, verified server-side authorization, hardened security, accessibility, and broad end-to-end coverage, so that the critical risk-assessment workflow is trustworthy in production.
**Verified:** 2026-09-26T12:09Z (the second re-verification, which closes G2). The first re-verification (2026-09-26T11:28Z on `dd2b25b`) and the initial verification (2026-09-26T07:46Z on `d11f469`) are kept below as history.
**Verified commit:** `3ca0a3d`. Its code is that of `f3dc30f`, where this session's runs were made. The two later commits change records only (`4f8b4e2`, `3ca0a3d`). No Strapi file has changed since `665f642`, the last Strapi suite run. The only web change since `b3e22e8`, the last browser run, is the G2 closure.
**Status:** passed.
- **G2 is closed,** and running the guard proves its sensitivity: a narrowing planted inside the answer envelope now fails the guard at its inner path.
- **Nothing else is open.** INT-02 stays deferred by operator decision, together with criterion 2's Keycloak half. The advisory items are records or observations, not gaps.
- **The last step is the orchestrator's:** the final five-command gate on this tree, with `git status --porcelain` empty.

**Scope:** complete except INT-02, which is deferred by operator decision (2026-09-25), together with criterion 2's Keycloak half.
**Re-verification:** Yes, the second, after one set of changes: the G2 closure and its records, including the validation sign-off (`fc6a791..3ca0a3d`).

## Re-verification 2 (2026-09-26, `3ca0a3d`): G2 closed

### Method

- **Mode.** This is GSD re-verification (Step 0), focused on the one open gap. G2 had the full three-level check. Every previously verified truth that the four new commits touch had a regression read. The must-haves are those of the initial report.
- **What changed:**
  - `fc6a791`: the tests;
  - `f3dc30f`: `questionnaire-schema.ts`, `questionnaire-service.ts` and one grandfather reason in the parity guard;
  - `4f8b4e2`: R-08-18 and three rows of `08-SECURITY.md`;
  - `3ca0a3d`: `08-VALIDATION.md`.

  No Strapi file, contract, generated client, catalogue, grant or content-type schema changed.
- **Run in this session** (Node 24.19.0, vitest 4.1.11, dev servers stopped, no server started):
  - the parity guard on `fc6a791` (RED), on `f3dc30f` (GREEN) and under four scratch plants;
  - on `f3dc30f`: the whole web unit suite, the typecheck (incremental, and a full non-incremental `tsc`) and `api:check`;
  - the validation sign-off's 30 targeted web commands and its static checks (`08-VALIDATION.md` § Validation Audit 2026-09-26).
- **Not run, by instruction:** the Strapi suite and Playwright. Both are in the orchestrator's final gate. Taken from records: Strapi 526/526 on `665f642`, and Playwright 84/84 on `b3e22e8`.
- **Scratch discipline.** Each probe ran from an untracked copy of the guard, or from a plant reverted with `git checkout --`. `git status --porcelain` was empty after each.

### G2: closed

**Levels 1 to 3 (exists, substantive, wired):**

| Check | Evidence | Status |
|---|---|---|
| The envelope reports at its fields | `questionnaire-schema.ts:150-157` forwards each issue of the nested `answerEnvelopeSchema(answerType).safeParse` with its path under `answer`. It keeps each issue's code, so a refused key keeps its name (`unrecognized_keys`). The same parse decides, so it refuses exactly the payloads it refused before. | ✓ |
| The registrations read it | The service's list schema and all four registrations pipe the same `questionnaireDefinitionSchema` (`questionnaire-service.ts:89-111`, `:358-359`). The guard therefore reads the runtime parse. | ✓ |
| No blanket narrowing remains | The four registrations drop `…0.answer`. The one path the guard now sees inside the envelope is registered with its reason (`questionnaire-service.ts:369-376`): `…0.answer.submittedAt`, because a draft refuses `submittedAt`. The contract's single `QuestionnaireAnswerEnvelope` leaves `submittedAt` optional in either state, but the server writes it only on a submitted answer (`questionnaire-workflow.ts:55-67`). A probe shows the minimal, maximal and nullable modes reject nothing else inside the envelope. | ✓ |
| Boundary bounds stay truthful | One boundary-mode rejection is now visible inside the envelope: the 70,000-character value at `…answer.value` (`boundary-long`). The four entries' grandfathering covers it. `getQuestionnaireQuestions`' reason names it, and the three acknowledgements cite that reason. The count stays 43 (`:683`). | ✓ |
| The rules can fail | `:574` requires each registration to report a corrupted answer `state`, `updatedAt`, value or unrecognised key at that envelope field. `:620` requires a mistyped field below any narrowed object or list to be reported below it. The only exemption is a key the parser refuses outright, such as the generation job's `data.questionnaire`. Both rules were RED on `fc6a791` (below). | ✓ |
| The records match | R-08-18 and the T-08-04-02 note say the closure covers the envelope (`4f8b4e2`). `08-VALIDATION.md` cites the rules (`3ca0a3d`). | ✓, with `STATE.md:663` and `deferred-items.md:14` left for the orchestrator (What remains) |

**RED first.** On `fc6a791`, with the new rules and the unfixed code, the parity file gave 5 failed and 128 passed:
- `getQuestionnaireQuestions reports an answer envelope rejection at the envelope field`: expected `[ 'data.0.answer' ]` to include `'data.0.answer.state'`. The three acknowledgements failed the same way at `data.answers.0.answer`.
- `never lets a narrowing hide a rejection below it`: four entries, for example "getQuestionnaireQuestions: data.0.answer hides the mistyped data.0.answer.schemaVersion (reported at data.0.options.choices, data.0.answer, …)".

**GREEN.** After the forwarding alone, the guard saw exactly what the envelope narrows. The four contract-mode tests failed at `…answer.submittedAt` in the maximal mode, and the stale-narrowing test found `data.0.answer` rejected nowhere. With the narrowing registered, the guard passes 133 of 133 on `f3dc30f`.

**Sensitivity, checked by running the real guard:**

| Probe | Plant | Result |
|---|---|---|
| Inside the envelope, fixed code (`f3dc30f`) | A text answer's value capped at 5 characters in `valueSchemaFor`, with no registration | 8 of 133 fail. The four contract-mode tests fail exactly at `data.0.answer.value` and `data.answers.0.answer.value`. The envelope rule fails on its precondition, because the minimal payload is refused. After the revert with `git checkout --`, 133 of 133 pass again. |
| Inside the envelope, pre-fix sources (`7d89665`) | The same cap on the old `questionnaire-schema.ts` and `questionnaire-service.ts` | All 128 earlier tests pass, so no earlier rule sees the cap. Only the five new rules fail. Restored with `git checkout --`. |
| Data-level wrapper, grandfathered parser | `administration.getRiskType` behind a wrapper that reports every rejection at `data`, narrowed at `data`, with a 5-character name cap | 2 fail: the new rule ("data hides the mistyped data.documentId (reported at data)") and `STALE_GRANDFATHER`. |
| Data-level wrapper, parser never grandfathered | `alerts.listAlerts` behind the same wrapper, refusing any string longer than five characters | 1 fails: the new rule alone ("data hides the mistyped data.0.id (reported at data)"). Before the rule, such a parser was fully hidden (the advisory item, now closed). |

**Verdict:** G2 is closed as defined, and D-05 now holds in full. No registered parser, and no field inside the answer envelope, is invisible to the guard, and a narrowing can no longer hide a rejection below it.

### Regression check: the verified truths the new commits touch

| Must-have | What changed | Check | Status |
|---|---|---|---|
| D-02 schema freeze | Nothing under `apps/strapi` | `'apps/strapi/src/api/*/content-types/*'`: 15 matched, 0 changed in `a9394cf..HEAD`; the `b4f3d88` control fires | ✓ |
| D-03 endpoint pattern | No endpoint, contract or client change | `api:check` clean on `f3dc30f`; `cmp` of the catalogue copies silent | ✓ |
| D-40 grandfathering | One reason extended | 43 entries, asserted; `STALE_GRANDFATHER` and the Phase 7 rule pass | ✓ |
| D-21 closed parsers | The question list's answer check | It refuses the same payloads. The questionnaire unit tests pass: 8 files and 83 tests, run with the guard for 216 in all | ✓ |
| D-32 and the questionnaire journeys | The parse the review and the journeys use | The runtime refusal is unchanged. Playwright re-runs in the final gate | ✓ (by construction; F confirms) |
| The token rule, D-01 and D-07 | Nothing that bears on them | `7d89665..HEAD` changes no UI file, and no `CSRM_AI_*` or Keycloak line under `apps` or the manifests | ✓ |

### Scores now

- **Roadmap success criteria: 5 of 5.** Criterion 2's Keycloak half is deferred with INT-02.
- **In-scope requirements: 3 of 3** (INT-01, INT-03, INT-04). INT-02 is deferred.
- **Locked decisions: 51 of 51.** D-05 now holds.
- **Plan must-have truths: 55 of 55.**

### Behavioral spot-checks (this session)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Parity guard, RED | `vitest run src/features/contract-response-parity.test.ts` on `fc6a791` | 5 failed, 128 passed, as above | ✓ (fails for the stated reason) |
| Parity guard, GREEN | the same on `f3dc30f` | 133 passed | ✓ PASS |
| Guard and questionnaire tests | `vitest run src/features/contract-response-parity.test.ts src/features/questionnaires` | 9 files, 216 passed | ✓ PASS |
| Whole web unit suite | `pnpm --filter @csrm/web test` | 99 files, 1,892 passed | ✓ PASS |
| Typecheck | `pnpm --filter @csrm/web typecheck`; `tsc --noEmit --incremental false` | exit 0, both | ✓ PASS |
| Contract drift | `pnpm --prefix apps/web api:check` | exit 0; the spec and `schema.d.ts` unchanged | ✓ PASS |
| Planted narrowings | four scratch probes (the table above) | each fails where expected | ✓ PASS |
| Validation map | the 30 targeted commands and the static checks of `08-VALIDATION.md` | each exit 0 | ✓ PASS |
| Attribution | trailer and message greps over `7d89665..HEAD`; the keyed trailer check over `a9394cf..HEAD` | 0, 0 and 0 (218 commits) | ✓ PASS |
| Strapi suite, Playwright | not run | by instruction; the orchestrator's final gate | ? SKIP |

### What remains

No gap remains. The orchestrator's close:
- **The final five-command gate** on this tree: Strapi, web, typecheck, `api:check`, and the production-build Playwright suite in both projects, then `git status --porcelain` empty. This is the phase's last step, and it re-runs the questionnaire journeys over the G2 change.
- **ROADMAP, REQUIREMENTS and STATE**, which this unit did not touch:
  - the ROADMAP status line (`ROADMAP.md:665`) and the three resolved entries in advisory item 5;
  - `STATE.md:663`'s parity rule and `deferred-items.md:14`. Each should add the G2 closure (`fc6a791`, `f3dc30f`): no narrowing may hide a rejection below it, in the answer envelope too.

_Re-verified: 2026-09-26T12:09Z_
_Verifier: gsd-code-fixer, closing G2 for the orchestrator's review_

---

## Re-verification (2026-09-26, `dd2b25b`), kept as history

> The first re-verification follows as written, with its header moved here. The second re-verification above supersedes its status and scores, and closes its gap G2.

**Verified then:** 2026-09-26T11:28Z. **Verified commit then:** `dd2b25b`. Its code is that of `8035357`, where that session's runs were made: the one later commit adds the security re-audit record only. The web code at `8035357` is that of `b3e22e8`, the final browser run, and the Strapi code is that of `665f642`, the last Strapi suite run.
**Status then:** gaps_found.
- **G1 is closed,** and its sensitivity is proven by running the guard.
- **One narrow gap remains, G2.** Inside the questionnaire question list, each question's answer envelope is still checked by a nested parse that reports only at `answer`, a registered narrowing, so the guard sees nothing inside the envelope.
- **Closing it:** a small web-only fix, or an operator override.

**Re-verification then:** Yes, after three sets of changes:
- the security audit's ownership and CORS fixes (`4529705..3cdc2f0`);
- the G1 gap closure, the UI review resolution and the record corrections (`0a98c21..8035357`);
- the security re-audit record (`dd2b25b`).

### Method

- **Mode.** This is GSD re-verification (Step 0). G1 had the full three-level check. Every previously verified truth that a new commit touches had a regression read. The must-haves are those of the initial report:
  - the five roadmap criteria;
  - INT-01, INT-03 and INT-04;
  - D-01 to D-51;
  - the 55 plan truths.
- **Read-only.**
  - No Strapi suite, Playwright run or server was started, and the dev servers on 1337 and 3000 were left alone.
  - Nothing in the repository was edited except this file.
  - The sensitivity probes ran from a scratch directory outside the repository, through a scratch-only vitest configuration and a junction to `apps/web/node_modules`. None of their files is in the tree.
  - HEAD moved from `8035357` to `dd2b25b` during the session; that commit changes `08-SECURITY.md` only.
- **Run in this session** (Node 24.19.0, vitest 4.1.11):
  - `contract-response-parity.test.ts`: 128 of 128.
  - The unit tests of every surface the new commits touch, with the security, auth, testing and performance guards: 83 files, 1,670 tests.
  - The whole web unit suite: 99 files, 1,887 tests, the recorded figure.
  - Sensitivity probes against the real guard: a control at 128 of 128, and four plants, each failing exactly where expected (below).
  - git and script checks:
    - the schema freeze, the Keycloak grep and the catalogue `cmp`, each with its control;
    - the `CSRM_AI_` diff and the manifest diff;
    - the catalogue grants of the eleven human-analyst-only operations;
    - the 58 new commits for attribution;
    - the 64 changed source files for debt markers;
    - every cited hash resolves.
- **Taken from records, not re-run:**
  - Strapi 526 of 526 on `665f642`; no Strapi file changed after it (verified).
  - Playwright 84 of 84 on `b3e22e8`, 80 desktop and 4 mobile; no web file changed after it (verified).
  - Typecheck and `api:check` clean on `8687484`, whose code is that of `b3e22e8`.
  - The security re-audit at `8035357`, recorded in `dd2b25b`: status verified, 0 open threats.

### G1: closed

G1 was the finding that nine response parsers were invisible to the guard at field level:
- **The parsers:** the eight `administration.*` parsers and `risks.listRiskRegister`.
- **Why:** each was registered through a wrapper that reported every inner rejection at the root, with `narrowedPaths: ['data']`, so no guard mode could see a field-level narrowing in them.

**Levels 1 to 3 (exists, substantive, wired):**

| Check | Evidence | Status |
|---|---|---|
| The wrappers are gone | No root-reporting wrapper, catch-all `superRefine` or `z.custom` remains in any parser module (sweep). `risk-service.ts:36-43` and `administration-service.ts:90-103` register schemas directly. | ✓ |
| Each registered schema is the one its service parses with | **Administration:** the registrations call `administrationListPayloadSchema` and `administrationDetailPayloadSchema` (`administration-schema.ts:256, :262`), and so do `parseAdministrationListPayload` and `parseAdministrationDetailPayload` (`:268, :275`). **Risk:** `riskRegisterPayloadSchema` and `riskDetailPayloadSchema` (`risk-schema.ts:138, :233`) are the schemas `parseRiskRegisterPayload` and `parseRiskDetailPayload` use (`:161, :237`). **Questionnaire:** `getQuestionnaireQuestions` registers the schema it parses with (`questionnaire-service.ts:111, :269`). The draft-save, submit and revert registrations compose their envelope with the same list schema the runtime applies after it (`:358-359`, against `parseMutation` at `:273-283` and the revert at `:321-322`). | ✓ |
| No blanket narrowing remains | No registration narrows `data`, per a sweep of every `narrowedPaths`. The generation job's `data` narrowing became five per-state keys (`assessment-service.ts:127`). Every administration narrowing names a field and has its reason beside it (`administration-service.ts:52-88`). | ✓ |
| A root report can no longer hide anything | `issuePaths` reports a whole-payload rejection as `<root>`, which no narrowing can name, and each unrecognised key at its own path (`contract-response-parity.test.ts:412-416`). Every registered parser must report a mistyped first field at that field or at an enclosing path (`:500-522`, 58 tests). The four question-list registrations must refuse a mistyped question key at its path (`:524-540`). | ✓ |
| The rules were written red first | `0a98c21` and `4eb9ffd` add the two rules before their fixes. Their bodies record the failures: the nine wrapper parsers, `risks.getRiskDetail` and the four question-list registrations. | ✓ (records) |
| The backlog moves only on purpose | 43 grandfather entries, one reason each, asserted at `:591`. The ten added entries name their bounds: the eight administration parsers, `risks.listRiskRegister` and `getQuestionnaireQuestions`. `STALE_GRANDFATHER` and the Phase 7 rule still hold (`:561-581`). R-08-17's list matches the test's 43 by family: 5, 12, 13, 5 and 8. | ✓ |
| The records are corrected | **`web-headers.md:143`:** describes the guard's reach and G1. **R-08-18:** closed, and counts nine parsers, not ten. **R-08-17:** moves to 43. **`deferred-items.md` and STATE:** record the closure and the count. | ✓, with two overstatements left: R-08-18's closing claim (G2), and `web-headers.md:143`'s "at every trust boundary" (disconfirmation pass, item 3) |

**Sensitivity, checked by running the real guard.**
- **Recorded:** the commits record the red-first runs. R-08-18 records that "the same three narrowings passed unseen on `3cdc2f0`".
- **Repeated here:** each probe mocks one schema module with a planted narrowing, then loads the unmodified `contract-response-parity.test.ts`, so the guard's own 128 tests run against the plant.

| Probe | Plant | Result |
|---|---|---|
| Control | None | 128 of 128 pass |
| Administration | The Risk Type detail parser caps `name` at 5 characters, with no narrowing | 1 of 128 fails: `administration.getRiskType` rejects the contract payload at `data.name`. The contract permits `contract`, 8 characters. |
| Risk Register | Each row's `riskNumber` capped at 5 characters | 1 fails: `risks.listRiskRegister`, at `data.0.riskNumber` |
| Question list | A list rule refuses question text longer than 5 characters, reported at the question's field | 4 fail: `getQuestionnaireQuestions` at `data.0.questionText`; the draft-save, submit and revert acknowledgements at `data.answers.0.questionText` |
| The pre-G1 wrapper, registered again | `administration.getRiskType` wrapped again in a root-reporting `superRefine`, with `narrowedPaths: ['data']` | 3 fail: the contract-mode test (`<root>`), the field-path test (reported at `<root>`) and the stale-narrowing test (nothing rejects at `data` any more) |

On `d11f469` the first three plants would have passed unseen:
- the wrapper reported at the root, which the guard read as the narrowed `data`;
- the question-list registrations never parsed the list.

**Verdict:**
- G1 is closed as defined. All 58 registered parsers report their rejections at their fields, the blanket narrowings are gone, and a planted narrowing in each formerly hidden family fails the guard.
- D-40 and 08-04 truth 3 now hold.
- D-05 holds except for G2.

### G2: the answer envelope inside the question list (new, narrow)

The G1 closure made the question list visible. That exposed a field-level instance of the same pattern, one level down.

**The mechanism:**
- `questionnaire-schema.ts:124` leaves each question's `answer` as `unknown`.
- The question's refinement checks the answer with a nested `answerEnvelopeSchema(answerType).safeParse`. On any failure, it adds one custom issue at `['answer']` (`:147-154`).
- The four question-list registrations narrow exactly that path, `data.0.answer` and `data.answers.0.answer` (`questionnaire-service.ts:368-374`). The stated reason is "an answer envelope that matches its answer type".
- So the narrowing tolerates every rejection inside the envelope, not only the type match its reason names.

**The probe.** A scratch probe ran the registered `getQuestionnaireQuestions` parser on an otherwise valid Text question. Four corruptions of the envelope were each reported at `data.0.answer` alone, which the registration narrows:
- a mistyped `state`;
- a 70,000-character value;
- an unrecognised envelope key;
- a wholly mistyped answer.

All five assertions passed, the valid control included.

**What the guard cannot see:**
- The contract declares one `QuestionnaireAnswerEnvelope`: schema version, value, state, `updatedAt` and `submittedAt`.
- The client narrows it by answer type and state. For example, a draft envelope refuses `submittedAt`, and a Text value is capped at 65,535 characters.
- No guard mode can see any of that, or any future drift in the envelope.

**Why neither G1 rule reaches it:**
- The field-path rule (`:500`) corrupts only the first field of each payload, and that field is not in the envelope.
- The question-key rule (`:524`) corrupts `options.questionKey`.

**Nothing else has this shape.** The only other nested parse inside a registered schema, `releasedAssessmentDetailForActorSchema`, forwards each inner issue with its own path (`assessment-schema.ts:358-362`).

**Impact.** Test visibility only, as with G1:
- At runtime, an envelope the client refuses fails closed, and the page shows its error state.
- The questionnaire journey parses served answer envelopes on the production build (84 of 84 on `b3e22e8`).
- The mounted Strapi questionnaire suites assert the served envelope's state and value (for example `questionnaire-governance.integration.test.ts:244-245`).
- What is lost is the guard's early warning if the contract and the client drift apart on the envelope.

**Affected must-have:** D-05, "Nothing stays invisible to the parity guard".
- R-08-18's closing claim, that narrowing an inner field without a registration now fails the guard, is not yet true inside the envelope.
- The security re-audit's T-08-04-02 note rests on the same two rules.

### MVP outcome

The User Flow Coverage table (history, below) stands. Its outcome row now reads: ✓ except INT-02 (deferred) and G2, a test-visibility gap with no runtime effect.

### Advisory items from the initial verification

| # | Item | Now | Evidence |
|---|---|---|---|
| 1 | SR-01, the unattested runtime | Still fixed | `development-runtime.ts` is unchanged since `d11f469`. The sign-in page changed its title only (`ccf5fc1`), and the three callers of `resolveSessionRuntimeMode` still gate on it. |
| 2 | The `08-VALIDATION.md` D-02 pathspec | Pending: the orchestrator's validation sign-off | The file is unchanged since `3d66619`. The corrected pathspec still matches 15 schemas, with 0 changed in `a9394cf..HEAD`. The positive control still finds `b4f3d88`, and the as-written form still matches nothing. |
| 3 | Other `08-VALIDATION.md` wording: `test -- <pattern>`, the Linux host commands, row 08-04-01, the draft status and 42 pending rows | Pending: the orchestrator's validation sign-off | As item 2 |
| 4a | The conformance record's 2.4.7 row | Corrected (`fd0ef46`) | `phase-08-wcag22-conformance.md:114` describes the resting-versus-focused comparison. |
| 4b | The policy comment on the release grant | Corrected (`bab4f15`) | `csrm-authorization.ts:18-40`. A script over the catalogue confirms it: the release FunctionAPI reaches both `role.security_analyst` and `role.security_analyst_agent`, and the other ten human-analyst-only operations reach `role.security_analyst` only. |
| 5 | Planning-state drift | Mostly corrected (`b42f5f0`, `69e7b21`); the rest is the orchestrator's close | R-08-25, the draft copy and G1 now read closed in STATE and the deferred items. Still open: the ROADMAP status line (`ROADMAP.md:665`: the `0290f4f` counts and "phase review is pending"), and three entries the UI review has since resolved. `STATE.md:304` and `deferred-items.md:38` (the development sign-in title) were fixed by `ccf5fc1`; `deferred-items.md:21` (the h4 captions) by `ae9c7da`. |
| 6 | The `git checkout --` restore instruction | Annotated in the nine older documents (`adefa83`) | Agent and operator instructions outside the repository may still carry it. |
| 7 | The MVP goal wording, and the empty `success_criteria` | Unchanged; optional | `user-story.validate` still returns false, and `roadmap.get-phase 8` still returns an empty array. |

### Regression check: the verified truths the new commits touch

The 58 new commits changed 90 files. Every must-have they touch still holds.

| Must-have | What changed | Check | Status |
|---|---|---|---|
| D-01 no Keycloak | Nothing that bears on it | 0 added or removed lines name Keycloak under `apps` and the manifests, over the phase and since `d11f469`. The control on `4e2f1e8` finds 1. | ✓ |
| D-02 schema freeze | The Strapi request controller and service, a deleted unused helper, a policy comment, a CORS utility and the middleware configuration | With the corrected pathspec, 0 schemas changed in `a9394cf..HEAD`. | ✓ |
| D-03 endpoint pattern | No endpoint was added. The spec, the generated client and both catalogue copies are unchanged since `d11f469`. | `cmp` finds the copies identical; `api:check` was clean on `8687484` (record). | ✓ |
| D-04 chain guard | O-1 widens both scans to generic-typed and spaced calls | The new pattern (`contract-operation-chain.test.ts:32`; `served-operations.integration.test.ts:245`) is a superset of the old, with a self-check of four forms (`contract-operation-chain.test.ts:151`). | ✓ (stronger) |
| D-07 no `CSRM_AI_*` change | The harness's environment snapshot list gains `CSRM_CORS_ALLOWED_ORIGINS` | The only two changed lines naming `CSRM_AI_` are that list, before and after. The harness still pins `CSRM_AI_PROVIDER = "deterministic"` (`strapi-http-harness.ts:436`), and `.env.example` gains only the CORS name. | ✓ |
| D-08 provider-neutral drafting copy | W-1 withholds the draft card once an assessment exists; the card's actions do not print. | `assessment-draft-job.tsx` and `assessment-detail.tsx` contain no provider name, "deterministic" or "assistance". The precondition copy is unchanged (`:47`). | ✓ |
| D-11 attested-only development session | The development sign-in's title | `app/sign-in/page.tsx:18-21` changes the title only; `development-runtime.ts` is unchanged. | ✓ |
| D-12 a run modifies no tracked file | Nothing that bears on it | `next-env.d.ts` is untracked and ignored (`.gitignore:6`). The tree was clean after the final run (record). | ✓ |
| D-15 shell-asserting sign-in | O-2 adds a standing guard | `e2e-sign-in-assertions.test.ts` parses every spec and helper. It requires the Dashboard heading and the banner role after every `Continue as` click, refuses the URL-only form, and self-checks a URL-only and a heading-only helper. `e2e` has 0 `toHaveURL(/\/app$/)`. | ✓ (stronger) |
| D-16, D-17 the matrix, My routes, and the agent never exercising a human-analyst grant | T-08-A1 and T-08-A2: every actor creates as a Requestor, and an analyst update writes only the published body | **Expectations:** unchanged (`everyIdentity(200)`, `OWNER_READ_OTHER_DENIED_403`). **Persistence:** the create row's snapshot adds the service agent. **Proofs:** four new ones cited, each present verbatim in `authorization.integration.test.ts`. **Refusals:** both paths return the safe 400 (`csrm-assessment-request.ts:156-157, :181-182`); the birthright and agent-release refusals remain (`authorization-policy.unit.test.ts:420, :436`). **Removed test lines:** fixture shortcuts through the old analyst `PUT` path, now built by `setRequestStatusFixture`. | ✓ (stronger) |
| D-19, D-22 headers, CSP and the chunk scan | The sweeps expect the new sign-in title | `production-hardening.spec.ts` changes two title strings only. | ✓ |
| D-20, D-39 Strapi middleware | CORS is deny-by-default | **Unchanged in `config/middlewares.ts`:** no `poweredBy`, `strapi::security` in place, body limits as before. **CORS:** `strapi::cors` grants only exact origins listed in `CSRM_CORS_ALLOWED_ORIGINS`, empty by default. A wildcard, `null`, a path or credentials stop the boot (`cors-allowed-origins.ts`). | ✓ (stronger) |
| D-23 dependency hygiene | O-3 | The `nodemailer` override is pinned exactly (9.1.1) in `pnpm-workspace.yaml` and the lockfile. No key was added or removed, and no manifest changed. | ✓ |
| D-25 accessibility sweep | W-3 and B-1 | The permission guard also requires no search, filter, total or pager on a refusal. The open navigation sheet is scanned at 375 with the sweep's own `scan`. | ✓ (stronger) |
| D-26 the `Menu` trigger | Nothing that bears on it | `capability-navigation.tsx:131-132`; 0 `Open navigation`. | ✓ |
| D-27 one tinted status recipe | W-11 (badge height) and verdict 4a (analyst list chips) | `status-badge.tsx` is unchanged, and `badge.tsx` changes `py-0.5` to `py-px` only. The new chips take the shared mapping's label (`assessment-list.tsx:347`). | ✓ |
| D-28 the Risk Register filter bar | W-5 | No assertion was removed from `risk-register-workflow.spec.ts` (+69, -0). The one-line labels, the input beside its button and the five columns at 1440 still run. | ✓ |
| D-29 overflow regions | W-2 separated borders | DataTable still wires `horizontalScrollRegionProps` and `horizontalOverflowAttributes` (`data-table.tsx:312-313`). | ✓ |
| D-30 search inputs named by their records | Verdict 4a | The inputs are `Search assessment requests`, `Search risk assessments` and `Search questionnaires`. `search collection` appears only in the absence test. | ✓ |
| D-32 each question rendered once | Verdict 3 (h4 captions), W-9 (names) and W-14 (print) | No second renderer; `questionnaire-review.tsx` is unchanged. | ✓ |
| D-33 print without the shell | W-4, W-14 and verdict 4c | The print block still hides the shell and honours `data-print="hidden"` (`globals.css:920-932`). It now also releases line clamps inside `main`. | ✓ |
| D-45 extensions recorded before code | The X-4 print refinement | `e11169e` is an ancestor of `df06656`, `9ee6932` and `5add96c`. | ✓ |
| The token rule | Every UI fix | No hex, rgb or hsl literal and no arbitrary pixel value was added under `app` or `src`. Spacing uses the scale (`gap-1.5`). | ✓ |
| Criterion 3, the release control | Nothing that bears on it | `assessment-workflow.ts`, the release route and the AI provider files are unchanged since `d11f469`. | ✓ |

No regression was found:
- the security fixes strengthen D-16 and D-17;
- the O-series strengthens D-04, D-15 and D-23.

### Scores now

- **Roadmap success criteria: 5 of 5.** Criterion 2's Keycloak half is deferred with INT-02.
- **In-scope requirements: 3 of 3** (INT-01, INT-03, INT-04). INT-02 is deferred.
- **Locked decisions: 50 of 51.** D-40 now holds; D-05 is partial (G2).
- **Plan must-have truths: 55 of 55.** 08-04 truth 3 now holds: 43 grandfathered parsers with a reason each, the count asserted, and no registered parser invisible to the guard.

### Behavioral spot-checks and probes (this session)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Parity guard | `vitest run src/features/contract-response-parity.test.ts` | 128 passed | ✓ PASS |
| Touched surfaces and guards | `vitest run src/components src/features/administration src/features/alerts src/features/assessments src/features/contract- src/features/questionnaires src/features/requests/request-table src/features/risks src/test src/lib` | 83 files, 1,670 passed | ✓ PASS |
| Whole web unit suite | `vitest run` | 99 files, 1,887 passed | ✓ PASS |
| Planted narrowings | Scratch probes, each mocking one schema module and loading the real guard | Control 128/128. Administration: 1 failure, at `data.name`. Risk Register: 1, at `data.0.riskNumber`. Question list: 4, at `…questionText`. The pre-G1 wrapper: 3. | ✓ PASS (each fails where expected) |
| Answer envelope | Scratch probe on the registered `getQuestionnaireQuestions` parser | Four envelope corruptions, each reported only at `data.0.answer`, a registered narrowing (5/5) | ✗ G2 |
| Data-level wrapper | Scratch probe: a wrapper reporting at `data`, narrowed at `data`, with a planted bound | 127 of 128 pass. Only `STALE_GRANDFATHER` fails, because the parser is grandfathered. | ℹ advisory |
| Freeze, Keycloak, catalogue, `CSRM_AI_` and manifests | git, `cmp` and scripts | As in the regression table | ✓ PASS |
| Attribution and debt markers | Message and diff greps over 58 commits; a marker grep over 64 changed source files, with a control | 0 and 0 | ✓ PASS |
| Suites, Playwright, `typecheck`, `api:check` | Not run | Skipped by instruction; taken from records | ? SKIP |

### Disconfirmation pass

1. **A requirement only partly met:** D-05, through G2.
2. **A test that passes without testing all of its claim.**
   - The field-path rule accepts an enclosing path, so that union failures can pass. As a result, it does not catch a wrapper that reports at `data` rather than at the root.
   - In the probe, a data-level wrapper narrowed at `data` hid a planted bound from the contract-mode, field-path and stale-narrowing tests. Only `STALE_GRANDFATHER` caught it, and only because that parser is grandfathered; a non-grandfathered parser would be fully hidden.
   - No registration does this today: the sweep found no `data` narrowing and no wrapper. G2 is the same shape at field scope.
   - A rule that corrupts a leaf below each narrowed object path would close both.
3. **Coverage the guard never reaches, outside G1's definition** (advisory, not scored).
   - **The registry is opt-in.** Four runtime response schemas have no registered counterpart. All are pre-Phase-8 and unchanged by it:
     - the CSV import preview and commit schemas (eight operations; `csv-import-schema.ts`);
     - the two `selected` lookups (`request-service.ts:126`);
     - the Risk owners picker (`risk-schema.ts`, `pickerResponseSchema('owners')`).
   - **Four other assessment envelopes are covered through their siblings.** They reuse item schemas that registered siblings check:
     - the Risk create and update responses (`listAssessmentRisks`);
     - the control-implementation create and update responses (`listControlImplementations`);
     - the analyst assessment detail (the `getReleasedAssessment` analyst branch);
     - the release response (the same union's released-detail check).
   - **Why this is not a gap:**
     - 08-04 scoped the guard to registered parsers (its line 77), and D-03 asks for registration of new or changed endpoints only.
     - The CSV journey previews and commits on the production build at both widths, so today's served shapes pass.
   - **One record still overstates:** `web-headers.md:143` opens with "at every trust boundary".
   - **The guard synthesises one branch per union.**
     - `getAssessmentDraftJob` names no `branch`, so only the queued state of a four-branch contract union is exercised.
     - The flat generation-job contract yields only `queued`, a recorded contract gap.
     - `getReleasedAssessment` shows the pattern that covers every branch: one entry per branch.

### Human verification

None required.
- **Print legibility (D-33)** was the initial report's one item. The UI review closes it:
  - `08-UI-REVIEW.md` § Print audited A4 PDFs and 794px captures of eleven pages: the register (twice, open and all), the risk exposure report, the released Risk detail and seven others.
  - The audit's own measurements show no shell, nothing sticky, and the report's tables within the page.
  - Its print defects (W-4, W-14, verdicts 4a and 4c) are fixed. Each print proof failed first and passes in the final run on `b3e22e8`. Verdict 4b is accepted, with reasons.
- **The development-only hot-update check** under the CSP on `next dev` stays with the orchestrator's browser pass, as before.

### What remains

- **G2,** closed by option A or B below.
- **The orchestrator's next steps (not gaps):**
  - `08-VALIDATION.md` sign-off: the D-02 pathspec, the command wording and the per-task rows (advisory items 2 and 3);
  - the ROADMAP, REQUIREMENTS and STATE close, including the three stale entries in advisory item 5;
  - the final five-command gate re-run, with `git status --porcelain` empty.

### Gaps summary

**G1 is closed. One narrow gap remains: G2.**

**Option A, fix (recommended).** Web only; no Strapi, contract or grant change.
1. **Forward the envelope's issues.** In `questionnaire-schema.ts:147-154`, forward each envelope issue with its path under `answer`, as `assessment-schema.ts:358-362` does. The parse still fails in the same cases, so the runtime result is unchanged.
2. **Name what the guard then sees.** Re-run the parity file. Replace the `.0.answer` narrowings (`questionnaire-service.ts:368-374`) with the exact inner paths the guard's synthesised answer then breaks, each with its reason. Alternatively, give the synthesised Text question a Text answer.
3. **Correct the records.** Fix R-08-18's closing claim and the STATE parity rule.
4. **Harden the guard (optional).** Consider the leaf-below-narrowing rule from the disconfirmation pass.
5. **Verify.** Run the parity file, the questionnaire unit tests, the web suite and typecheck.

**Option B, accept.** Add this to the frontmatter and re-run verification. G2 then counts as PASSED (override):

```yaml
overrides:
  - must_have: "Nothing stays invisible to the contract parity guard (D-05): the answer envelope inside the questionnaire question list"
    reason: "The client checks each answer envelope against its question's own answer type, which the contract's single QuestionnaireAnswerEnvelope cannot express, and reports a mismatch at answer, which the four question-list registrations narrow with that reason. The envelope fails closed at runtime, the questionnaire journey parses served envelopes on the production build, and the mounted Strapi questionnaire suites assert the served state and value. Forwarding the envelope's issue paths goes to the next contract pass with R-08-18."
    accepted_by: "{operator}"
    accepted_at: "{ISO timestamp}"
```

**Everything else holds on the code as it stands:**
- the five roadmap criteria and the three in-scope requirements;
- 50 of 51 decisions and all 55 plan truths;
- the security audit's fixes, re-audited as verified;
- the UI review's fixes, each proven first-failing in the browser.

_Re-verified: 2026-09-26T11:28Z_
_Verifier: gsd-verifier_

---

## Initial verification (2026-09-26T07:46Z, `d11f469`), kept as history

> The initial report follows as written, with its headings moved down one level. Its citations are `path:line` at `d11f469`. Its status and scores are superseded by the re-verification above, and its gap G1 is closed.

**Phase Goal:** As a CSRM operator, I want production authentication, verified server-side authorization, hardened security, accessibility, and broad end-to-end coverage, so that the critical risk-assessment workflow is trustworthy in production.
**Verified:** 2026-09-26T07:46Z
**Verified commit:** `d11f469`. Its code is identical to `3251a0c`, the last post-review run: the one later commit adds `08-REVIEW-FIX.md` only.
**Status:** gaps_found. One must-have is partly met, from one root cause (D-05 and D-40, the parity guard's nine wrapper-registered parsers). A small fix closes it, or an operator override accepts residual R-08-18.
**Scope:** complete except INT-02, which is deferred by operator decision (2026-09-25). Criterion 2's Keycloak half is deferred with it; its Strapi token, capability and record-enforcement half is in scope and verified.
**Re-verification:** No, initial verification.

### Method

- **Goal-backward, anchored to one commit.** Every citation is `path:line` at `d11f469`. SUMMARY claims were checked against the code, not accepted.
- **Must-haves.**
  - The five roadmap success criteria, taken from the section text: `roadmap.get-phase 8` returned an empty `success_criteria` array.
  - INT-01, INT-03 (re-verification) and INT-04. INT-02 is deferred.
  - Decisions D-01 to D-51 in `08-CONTEXT.md`.
  - The 55 plan frontmatter truths: 08-01 to 08-14 carry 3, 5, 5, 4, 4, 2, 4, 4, 3, 4, 4, 4, 4 and 5.
- **Read-only, as instructed.** No Strapi suite, Playwright run or server was started, and the dev servers on 1337 and 3000 were left alone. Neither `typecheck` nor `api:check` was run, because both rewrite files (`next-env.d.ts`, `schema.d.ts`). The tree was clean before and after (`git status --porcelain`: 0 lines).
- **Independent checks run in this session:**
  - **vitest, on Node 24.19.0:** 32 files and 1,077 tests passed:
    - `contract-operation-chain.test.ts` and `contract-response-parity.test.ts`: 74;
    - everything under `src/lib/security`, `src/lib/auth`, `src/lib/testing` and `src/lib/performance`: 19 files, 831;
    - the three INT-03 web files: 46;
    - `status-badge`, `horizontal-scroll-region`, `data-table`, `mobile-navigation`, `questionnaire-governance` and `questionnaire-revision-timeline`: 126.
  - **`gsd-sdk query verify.artifacts`:** 46 of 46. The working-tree plans are CRLF, which the SDK's frontmatter parser cannot read, so it ran on LF copies in a scratch directory.
  - **Key links:** 38 of 40 by pattern, with two false positives explained below. The SDK's `verify.key-links` refuses paths outside the repository, so an equivalent read-only script was used.
  - **Node scripts** over `served-operations.json`, the catalogue and `specification.json`.
  - **git checks:**
    - the freeze diff and the Keycloak added-line grep, each with a positive control;
    - `cmp` of the two catalogue copies;
    - the `CSRM_AI_` diff and the manifest diff;
    - all 156 commit hashes the summaries and the fix record cite resolve;
    - attribution: no trailer or tool name in the 156 phase commits.
  - **grep sweeps** for debt markers, colour literals, raw `fetch`, HTML sinks, `Open navigation` and `Search collection`.
- **Evidence taken from records, not re-run:**
  - the 08-14 gate on `0290f4f`;
  - the post-review runs on `117741f` (all five commands) and `3251a0c` (web, typecheck, `api:check` and Playwright; no Strapi file changed after `117741f`);
  - the orchestrator's browser audits.
- **MVP mode.** The roadmap marks the phase `mode: mvp`. The goal fails the strict story format on wording only (see `advisory`), so the User Flow Coverage below follows its outcome clause.

### User Flow Coverage (MVP)

User story: «As a CSRM operator, I want production authentication, verified server-side authorization, hardened security, accessibility, and broad end-to-end coverage, so that the critical risk-assessment workflow is trustworthy in production.»

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| 1. Production authentication | Keycloak authorization-code sign-in | Deferred with INT-02 by operator decision. Meanwhile the development sign-in exists only in a `next dev` compilation or inside the attested E2E runtime. A production build refuses it, including one started with `NODE_ENV=development` (`development-runtime.ts:28-37`; `production-hardening.spec.ts:193, :243`). | Deferred |
| 2. Verified server-side authorization | Every served operation states and proves each actor's outcome; record-level IDOR is refused | 113-row six-actor matrix with a completeness guard (`authorization-matrix.integration.test.ts:117-139`); 403, 403 and 404 for another Requestor's request, questionnaire and assessment (`fixtures/authorization-matrix.ts:653-668, :747-780, :916-925`); the browser proof at both widths (`assessment-navigation-lifecycle.spec.ts:156-239`) | ✓ |
| 3. Hardened security | Headers, CSP, error envelope, no server-only leak, unmounted IAM surface, registration off, audited dependencies | The nonce CSP and the static headers (`proxy.ts`, `next.config.ts:10-24`); the Strapi bare 500 envelope and no `X-Powered-By` (`http-hardening.integration.test.ts:55-96`); the chunk scan (`production-hardening.spec.ts:611-635`); seven routers `only: []`; `allow_register: false` at boot (`index.ts:23`); audit at 0 critical and 1 recorded high | ✓ |
| 4. Accessibility | WCAG 2.2 AA on every route, actor and width, plus a record for what axe cannot decide | `accessibility.spec.ts:103-134`; `docs/accessibility/phase-08-wcag22-conformance.md` | ✓ |
| 5. Broad end-to-end coverage | Six critical journeys at 1440 and 375 on the production build | Two Playwright projects (`playwright.config.ts:175-187`); 82 tests, 78 desktop and 4 mobile, in the post-review runs | ✓ |
| **Outcome:** "trustworthy in production" | Every served operation is documented, granted and authorised by Strapi; the workflow is proven on the production build | Holds for everything the phase owns. Production authentication waits on INT-02, so the phase closes "complete except INT-02". One guard coverage gap (G1) affects test visibility, not runtime behaviour: the nine parsers fail closed. | ✓ except INT-02 and G1 |

### Goal Achievement

#### Roadmap success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Frontend production services call the documented Strapi OpenAPI operations; missing operations, including imports, are implemented and recorded in the contract and catalogue. | ✓ VERIFIED | **Inventory:** `docs/references/served-operations.json` holds 76 served operations (75 web-called). Every served operation has a `specOperationId`, FunctionAPIs and roles. It also holds 34 unserved and 78 spec-only entries, each with a reason; 0 uncatalogued; 0 collisions; and the `GET /api/roles` probe (script, this session). **Guards:** `served-operations.integration.test.ts` rebuilds the inventory from the mounted Strapi and fails on drift (in Strapi 514/514 on `117741f`). `contract-operation-chain.test.ts:125-199` scans every web module for every receiver: `NOT_IN_SPEC`, `NOT_SERVED`, `NOT_CATALOGUED`, `FETCH_OUTSIDE_TRANSPORT`, `CLIENT_OUTSIDE_SERVICE_LAYER`, and a floor of more than 60 calls; 8 of 8 in this session. **Imports:** the eight CSV import operations are specified, served, granted to `role.security_analyst` only and called from `administration-service.ts` alone (`:190-199`). No operation was missing: the phase unmounted routes and added none. |
| 2 | Keycloak authorization-code authentication and Strapi token, capability and record enforcement are verified, including Requestor birthright behaviour and IDOR denial. | ✓ VERIFIED (Strapi half); Keycloak half deferred | **Token:** the matrix's `noToken` actor gives 401 on the 52 content-api-token routes and 403 on the 24 default-strategy routes (`MISSING_TOKEN_STATUS_BY_FAMILY`, `fixtures/authorization-matrix.ts:56`). **Capability:** six actors on every served operation and plugin route, with per-actor provenance for each success the matrix does not issue (`authorization-matrix.integration.test.ts:150-160`; `helpers/matrix-provenance.ts`). The human-analyst-only guard denies the owner, the other Requestor and the service agent (`:162-177`). **Record and IDOR:** the rows cited above, persistence snapshots around every guarded denied mutation, and the browser proof at both widths in both projects. **Birthright:** `authorization-policy.unit.test.ts:403, :419, :431` and `ownedRecordTotal` (analyst and agent `total: 0`). **Keycloak:** deferred with INT-02; no Keycloak line added (D-01). |
| 3 | The AI provider adapter preserves provenance, status, retries, human edits, and mandatory analyst release control. | ✓ VERIFIED | **Hermetic re-verification (D-07):** 97 Strapi tests in nine files and 39 web tests in three on `0290f4f` (08-14 evidence block). The same nine Strapi files ran inside Strapi 514/514 on `117741f`, and the three web files pass 46 of 46 here, now including the WR-04 and WR-06 cases. **Release control:** `releaseAssessment` (`assessment-workflow.ts:509`) is the only writer of `assessmentStatus: "approved"`. It has one caller, the controller action (`controllers/csrm-assessment.ts:212-224`), and one route, `POST /v1/risk_assessments/:assessmentId/release` (`routes/csrm-assessment.ts:45-47`), which is in `HUMAN_ANALYST_ONLY_OPERATIONS` (`csrm-authorization.ts:34-42`). No provider or job imports it. **D-09:** one comparator for the parser (`assessment-draft-provider.ts:87-93, :116`), the deterministic provider (`:146`) and the adapter (`:52`). No `CSRM_AI_*` line changed in the phase. |
| 4 | Automated critical journeys cover desktop and mobile request, questionnaire, assessment-release, read-only viewing, Risk Register, and CSV import flows. | ✓ VERIFIED | **Projects:** `desktop` at 1440×900 runs every spec; `mobile` at 375×812 with touch runs the `@journey` test of four files (`playwright.config.ts:175-187`). **Both projects:** request (`requestor-request-workflow.spec.ts:115`), read-only viewing (`assessment-navigation-lifecycle.spec.ts:109`), Risk Register (`risk-register-workflow.spec.ts:289`) and CSV import (`administration-workflow.spec.ts:256`, which previews and commits at the project's width). **One-shot journeys:** the questionnaire and release journeys run in `desktop` and checkpoint 375 and 1440 inside the pass, as D-41 decides (`questionnaire-workflow.spec.ts:153-294`; `assessment-release-workflow.spec.ts:41-45, :190, :250`). **Every journey:** the CSP collector is attached, and every sign-in asserts the shell. |
| 5 | WCAG 2.2 AA, security headers, input, output and error handling, performance, and dependency hygiene receive documented validation. | ✓ VERIFIED | **Records:** `phase-08-wcag22-conformance.md`, `web-headers.md` (header set, CSP, output safety, D-21 validation), `strapi-http-hardening.md`, `dependency-audit-phase-08.md`, `phase-08-baseline.md` and `phase-08-residual-risks.md` (38 rows plus R-08-39). **Proofs:** each record cites a test: the axe sweep, the hardening spec, `route-boundaries.test.ts`, `output-safety.test.ts`, `server-only-boundary.test.ts`, `performance.spec.ts` and the audit runs. One sentence overstates the parity guard's reach (`web-headers.md:143`, part of G1). |

**Score:** 5 of 5 roadmap criteria verified, with criterion 2's Keycloak half deferred with INT-02.

#### Requirements coverage

| Requirement | Source plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| INT-01 | 03, 04, 14 | The production web service calls Strapi operations defined in the OpenAPI contract; missing operations are documented and added. | ✓ SATISFIED | Criterion 1. The parity-guard coverage gap (G1) is a D-05 and D-40 test-visibility defect, not a call to an undocumented operation. |
| INT-02 | 14 (deferral record only) | Keycloak authorization-code authentication; Strapi validates token issuer, audience, signature, expiry and effective authorization. | Deferred | Operator decision, 2026-09-25. `REQUIREMENTS.md:71` keeps it unchecked with the verbatim deferral wording, and `:110` records it as Deferred. |
| INT-03 | 06, 07, 14 | AI integrations preserve provenance, review state, human modifications and safe failure and retry, and never release an assessment automatically. | ✓ SATISFIED (re-verified) | Criterion 3. `REQUIREMENTS.md:108` cites the re-verification: 136 tests, deterministic provider only. |
| INT-04 | 01, 02, 05, 07 to 14 | Critical journeys, responsive behaviour, WCAG 2.2 AA, security controls, performance and IDOR protection are verified. | ✓ SATISFIED | Criteria 2 (Strapi half), 4 and 5. |

`REQUIREMENTS.md` maps only INT-01 to INT-04 to Phase 8 (lines 108 to 110). Every one is claimed by a plan, so no requirement is orphaned.

#### Locked decisions (D-01 to D-51)

| Group | Decision | Status | Evidence |
|-------|----------|--------|----------|
| Scope guards | D-01 no Keycloak code, configuration or package | ✓ | `git diff a9394cf..HEAD -- apps package.json pnpm-workspace.yaml pnpm-lock.yaml`: 0 added and 0 removed lines naming Keycloak. The grep matches 1 line on `4e2f1e8`, which added the `index.ts` mention, so it can fail. No Keycloak package in any manifest. |
| | D-02 no content-type schema change | ✓ | Corrected pathspec `'apps/strapi/src/api/*/content-types/*'`: it matches 15 schemas, and 0 changed in `a9394cf..HEAD`. Over `b4f3d88~1..HEAD` it finds `csrm-questionnaire/.../schema.json`, so it can fail. The as-written pathspec is vacuous (see `advisory`). |
| | D-03 the endpoint pattern | ✓ | No endpoint was added. The spec changed by nine bound lines (08-04), and D-36 and D-44 unmount routes. The catalogue copies are byte-identical (`cmp`), with design note 9 in both. `api:check` was clean on `0290f4f`, `117741f` and `3251a0c`. |
| INT-01 | D-04 test-enforced inventory | ✓ | The inventory, and the two guards in criterion 1. The SR-03 fix widened both scans to every module and every receiver (`1005bd9`). |
| | D-05 IN-03 resolved; nothing invisible to the guard | ⚠ PARTIAL | IN-03 is closed by contract: `minLength` 1 with `maxLength` 255 on eight identifiers and 512 on `AlertItem.id` (script), and 0 `.trim()` in the three Phase 7 schema modules. "Nothing stays invisible" fails for nine wrapper-registered parsers (G1). |
| | D-06 CSV imports are documented, served operations | ✓ | Criterion 1, "Imports". |
| INT-03 | D-07 hermetic re-verification, no `CSRM_AI_*` change | ✓ | Criterion 3; 0 `CSRM_AI_` lines changed under `apps`. |
| | D-08 provider-neutral drafting copy | ✓ | `assessment-draft-job.tsx:213-221`. No "deterministic" or "assistance" in `assessment-draft-job.tsx` or `assessment-detail.tsx`. The empty state reads "Draft generation can begin only after the linked questionnaire is submitted." (`:47`, WR-06). |
| | D-09 one Risk Type ordering rule | ✓ | Criterion 3. |
| INT-04 harness | D-10 `next build` then `next start`; Strapi `develop` | ✓ | `playwright.config.ts:191` (`develop`), `:223-225` (`exec next build && … next start`, `NODE_ENV: 'production'`); the 08-14 gate log line 171 |
| | D-11 attested-only development session, failing closed | ✓ (since `151a443`) | `development-runtime.ts:28-37`. Its three callers are `server-client.ts:71`, `development-session-adapter.ts:39` and `sign-in/page.tsx:15`. Unit tests are in the 831 run here. Strapi's own gate still requires `NODE_ENV=development` (`development-identity-enabled.ts`, unchanged in the phase). False on `0290f4f` (SR-01, `advisory`). |
| | D-12 a run modifies no tracked file | ✓ | `next-env.d.ts` is untracked and ignored (`.gitignore:6`). `tsconfig.json`'s `include` has no `.tmp` entry. `tsconfig.e2e.json` extends only, and `next.config.ts:39` selects it. The tree was clean after the gate, and after both post-review runs except for the report being written. |
| | D-13 settled destinations before axe | ✓ | `e2e/helpers/settle.ts`; `accessibility.spec.ts:123`; `--repeat-each 5`: 55 of 55 (08-12); WR-11 state guards (`3251a0c`) |
| INT-04 journeys | D-14 six journeys at 1440 and 375 | ✓ | Criterion 4. 82 tests in 11.4 min, inside the 30-minute ceiling. |
| | D-15 shell-asserting sign-in | ✓ | `signInAs` (`e2e/helpers/navigation.ts:12-19`) and the five local helpers (`analyst-insights`, `app-shell`, `design-contract`, `design-system-conformance`, `production-hardening`) each assert the level-one Dashboard heading and the role in the banner. No `toHaveURL(/\/app$/)` remains in any spec. |
| INT-04 IDOR | D-16 spec-driven matrix with completeness guard | ✓ | Criterion 2. The SR-02 fix makes provenance per actor (`8e260c6`). |
| | D-17 My routes owner-scoped for every actor; birthright only; agent never a human-analyst grant | ✓ | Criterion 2. In effect the agent never exercises a human-analyst grant: the guard refuses it and the matrix and the policy unit test prove it. The catalogue listing is noted in `advisory`. |
| | D-18 browser IDOR at both widths | ✓ | `assessment-navigation-lifecycle.spec.ts:156-239`. Maya gets the request's permission state under `Assessment request`, `Questionnaire unavailable`, and the in-shell `Page not found` titled `Page not found \| IdamBox CSRM`. Ten protected values and every record-identifier prefix are absent; 08-11 ran sensitivity checks. |
| INT-04 security | D-19 documented header set; zero CSP violations | ✓ | `next.config.ts:10-24, :42`; `proxy.ts:19-35` with the anchored matcher `:46-52` (SR-05); `content-security-policy.ts:37-58` (nonce with `'strict-dynamic'`; `'unsafe-eval'` only when `development`); `production-hardening.spec.ts:331` (headers and nonce), `:532`, `:542`, `:555` (sweeps); the collector on every journey |
| | D-20 Strapi middleware documented; safe 500 envelope | ✓ | `config/middlewares.ts` (no `strapi::poweredBy`); `http-hardening.integration.test.ts:55, :71, :86`; `strapi-http-hardening.md` |
| | D-21 closed parsers, no unsafe HTML, error boundaries, safe copy | ✓ | `output-safety.test.ts`, `route-boundaries.test.ts` and `root-fallbacks.test.tsx` pass here. `app/global-error.tsx`, `app/not-found.tsx` and `app/(app)/not-found.tsx` exist. 0 `dangerouslySetInnerHTML` and 0 `fetch(` outside the transport. The closed-parser claim is overstated for the nine parsers of G1. |
| | D-22 no server-only value in the client | ✓ | `server-only-boundary.test.ts` passes here. The chunk scan requires at least 10 files and checks 16 needles: the nine environment names the web reads, the identity header, the run's token, attestation nonce and Strapi base URL, and three fixture emails (`production-hardening.spec.ts:611-635`). |
| | D-23 dependency hygiene | ✓ | 0 critical and 1 high (`vite` GHSA-fx2h-pf6j-xcff, a major beyond Strapi's pin, dev server only), recorded. No dependency key added or removed across the phase (manifest diff, this session). `vitest` and `turbo` are re-pinned exactly (SR-06). The `sharp` override crosses a 0.x pin (R-08-39). |
| INT-04 performance | D-24 production-build baseline with budgets | ✓ | `performance.spec.ts:55` (300,000 bytes, 500 ms, 2,500 ms), `:74-76` (one reasoned override), `:169`; `performance-metrics.test.ts` passes here; `phase-08-baseline.md` mirrors both tables |
| INT-04 accessibility | D-25 five tags on every route, actor and width; the record | ✓ | `accessibility.spec.ts:103-112` asserts that `runOnly` equals the five tags and that `label-content-name-mismatch` and `target-size` ran. `:119-134` checks settled, one h1, zero violations, no overflow and no CSP violation. The conformance record covers the nine undecidable criteria plus dialogs and sheets. |
| | D-26 the `Menu` trigger | ✓ | `capability-navigation.tsx:121-134`: no `aria-label`, visible `Menu`. 0 `Open navigation` under `src`, `app` or `e2e`. |
| Follow-ups | D-27 one tinted status recipe | ✓ | `status-badge.tsx:66-109`: five families (request, assessment, questionnaire, treatment, importRow), each `satisfies Record`, and every badge carries `data-tone`. The only outline `Badge`s left are an attempt counter and a missing-rating marker, which are not statuses. |
| | D-28 Risk Register filter bar and statement column | ✓ | `risk-register-workflow.spec.ts:159-177` (search width, one-line labels, input beside its button) and `:242` (five columns visible at 1440); the orchestrator's `5a9420d` |
| | D-29 overflow-only focusable, labelled regions with the cue | ✓ | `horizontal-scroll-region.tsx`; DataTable, ReportTable and the CSV flow use it (key links); the unit tests pass here |
| | D-30 search inputs named by their records | ✓ | `assessment-list.tsx:241, :296`. The only `search collection` match is the absence assertion in `assessment-list.test.tsx:135`. |
| | D-31 the timeline names the acting analyst | ✓ | `csrm-questionnaire.ts:142-151`: analyst readers only, one `findMany` over distinct ids, active users only, `documentId` and `displayName` only. Used at `:369`. |
| | D-32 each question rendered once | ✓ | `questionnaire-review.tsx:67-75`: the analyst-review branch has no renderer. In the released state the governance view renders only the return-to-review control (`questionnaire-governance.tsx:94`). |
| | D-33 print without the shell | ✓ | `globals.css:919`; the print proof in `design-system-conformance.spec.ts`. Visual legibility is a human check (below). |
| Process | D-34 the UI-SPEC defers values | ✓ | `08-UI-SPEC.md` "Binding inputs and value authority" |
| | D-35 serialised plans; the full gate | ✓ | 14 plans in one chain. Gate green on `0290f4f`; the post-review runs cover the final code. The final re-run is the remaining step. |
| Post-research | D-36 IAM routers unmounted; dead call removed | ✓ | `function`, `function-api`, `idambox-user`, `role` and `application` routes are `only: []`; `features/shell` is removed |
| | D-37 registration disabled at bootstrap | ✓ | `disable-users-permissions-registration.ts:15-20`, first in `bootstrap` (`index.ts:23`) |
| | D-38 the `/api/roles` probe; test-only middleware only in the harness | ✓ | The `probes` entry: no layer and 404 after D-36; one layer, `api::role.role.find`, before (08-03). No collision existed. `http-hardening.integration.test.ts:44` scans `apps/strapi/src` for the sentinel. |
| | D-39 `poweredBy` removed; `strapi::security` defaults documented | ✓ | As D-20. D-39 names `08-SECURITY.md`; the record is `docs/security/strapi-http-hardening.md`, which the phase security audit (running in parallel) reads. |
| | D-40 boundary mode; older parsers grandfathered with reasons; count recorded; nothing invisible | ⚠ PARTIAL | Five modes run for every parser; 33 entries with reasons (`contract-response-parity.test.ts:56`); count asserted (`:469`); `STALE_GRANDFATHER`; Phase 7 labels never grandfathered (`:132`, `:447`). **Backlog count: 33** (request 5, questionnaire 11, assessment and reference data 13, Risk 4). "No parser stays invisible" fails for nine parsers (G1). |
| | D-41 in-spec checkpoints for the questionnaire and release journeys | ✓ | Criterion 4 |
| | D-42 TLS directives | ✓ | `upgrade-insecure-requests` only when `https` (`content-security-policy.ts:55`); HSTS without `preload` (`next.config.ts:17-18`); the TLS assumption is `web-headers.md` residual 5 |
| | D-43 browsers are not reinstalled | ✓ (host-adapted) | `playwright.config.ts:27-30`. The Windows gate host used Playwright's default Chromium without `PLAYWRIGHT_BROWSERS_PATH`, and no summary reinstalls browsers. |
| | D-44 generic information system and asset reads unmounted | ✓ | Both routers `only: []`; `unserved` rows with the D-44 reason |
| | D-45 extensions recorded before code | ✓ | Each docs commit is an ancestor of its code commit: `be3ad80` → `e6457f6` (X-5), `93b33e9` → `b6564e6` (X-1 to X-3), `414ea8f` → `941116e` (X-4). The WR-08 `importRow` family went into the direction document in the same commit as the code. |
| | D-46 `expect.timeout` 15 s | ✓ | `playwright.config.ts:147` |
| | D-47 cookie `Secure` keyed on protocol | ✓ | `development-session-adapter.ts:51, :79-84`: `secure` from `x-forwarded-proto`, with `httpOnly` and `lax` |
| | D-48 Server Action origin check, asserted | ✓ | `production-hardening.spec.ts:648-681`: foreign fetch action 500, same origin 404; forged form post without a cookie, genuine post 303 with one cookie |
| | D-49 plan shape | ✓ | 14 serial plans; the research's P06 and P07 merged into 08-06 |
| | D-50 root `CONTEXT.md` glossary | ✓ | `CONTEXT.md`: Released maps to `approved` |
| | D-51 open questions measured | ✓ | Build 34 s and timeouts (08-02); the analyzer output shape (08-13, `phase-08-baseline.md`); missing-token status per family (`fixtures/authorization-matrix.ts:56`) |

**Score:** 49 of 51 decisions verified. D-05 and D-40 are partial from one root cause.

#### Plan must-have truths

| Plan | # | Truth (short form) | Status | Evidence |
|------|---|--------------------|--------|----------|
| 08-01 | 1 | 0 critical and 0 high, or each residual recorded with its id and reason | ✓ | `dependency-audit-phase-08.md`: After and the gate re-run (same 15 ids) |
| | 2 | No new runtime dependency | ✓ | Manifest diff over the phase: three versions, four overrides, scripts; no key added or removed |
| | 3 | Every suite green on the patched tree | ✓ | 08-01 runs (Strapi 350, web 834) and every later gate |
| 08-02 | 1 | `next build` + `next start` under `NODE_ENV=production`; Strapi `develop` | ✓ | `playwright.config.ts:191, :223-225` |
| | 2 | Each gate alone fails closed; the unattested build shows the unavailable card and redirects | ✓ (since `151a443`) | D-11 row; `production-hardening.spec.ts:193, :243` |
| | 3 | A full run leaves `git status` empty | ✓ | D-12 row |
| | 4 | The sweep scans only settled destinations | ✓ | D-13 row |
| | 5 | `next dev` is unchanged | ✓ | `development-runtime.ts:32` |
| 08-03 | 1 | Checked-in inventory with reasons, rebuilt and drift-checked | ✓ | Criterion 1 |
| | 2 | Web chain guard: literal, specified, served once, catalogued; no `fetch(` outside the transport | ✓ | `contract-operation-chain.test.ts:125-199`, 8 of 8 here |
| | 3 | IAM and generic finds unmounted; dead call gone; registration disabled | ✓ | D-36, D-37 and D-44 rows |
| | 4 | `/api/roles` recorded before and after; users-permissions answers after | ✓ (premise corrected) | No collision existed: before, one layer (`api::role.role.find`, 200); after, no layer (404). The users-permissions role routes mount under `/api/users-permissions`. D-38 asks only that the probe be made and recorded, and it was. |
| | 5 | Design note 9 in both byte-identical copies | ✓ | `cmp`; note 9 names D-36, D-44 and D-37 |
| 08-04 | 1 | Boundary mode feeds every parser the contract's shortest and longest strings | ✓ | Five modes per label; 66 of 66 here. The invisibility clause is scored under truth 3. |
| | 2 | Phase 7 narrowings resolved by contract; headers truthful | ✓ | D-05 row, IN-03 part |
| | 3 | Older parsers grandfathered with reasons; count recorded; no parser invisible | ⚠ PARTIAL | D-40 row; G1 |
| | 4 | `api:check` clean after the contract change | ✓ | Gate and both post-review runs |
| 08-05 | 1 | Six-actor matrix for every served operation; completeness guard | ✓ | `authorization-matrix.integration.test.ts:117-139, :224-229`; 116 of 116 inside Strapi 514/514 |
| | 2 | Maya refused Jane's request (403), questionnaire (403) and assessment (404); persistence unchanged | ✓ | Fixture rows; the probe loop `:180-221` |
| | 3 | My routes owner-scoped for every actor; birthright only; agent never human-analyst; policy proofs run | ✓ | D-17 row; the test script runs only `.tmp/tests-dist/tests/*.test.js`; the CommonJS file is deleted |
| | 4 | Bare 500 envelope, helmet headers, no `X-Powered-By`, configuration documented | ✓ | D-20 row |
| 08-06 | 1 | One exported ordering rule; a mixed-case proposal passes | ✓ | D-09 row |
| | 2 | The timeline names the analyst; unknown or inactive ids stay null; Requestors see no actor | ✓ | D-31 row; 08-06 mounted proofs |
| 08-07 | 1 | One tinted mapping for every status; `approved` displays as Released | ✓ | D-27 and D-50 rows |
| | 2 | Analyst review renders each question once and no Submitted alert | ✓ | D-32 row |
| | 3 | Drafting copy names the action and the analyst, never a provider | ✓ | D-08 row |
| | 4 | The glossary maps `approved` to Released | ✓ | `CONTEXT.md` |
| 08-08 | 1 | Overflow-only focusable, named regions with the cue; no inner container scrolls | ✓ | D-29 row |
| | 2 | `Download CSV template` on four import pages; no overflow at 375 | ✓ | `administration-workflow.spec.ts:288-304` |
| | 3 | Filter bar at 768, 1024, 1280 and 1440; statement wraps and clamps | ✓ | D-28 row |
| | 4 | Search inputs named by their records | ✓ | D-30 row |
| 08-09 | 1 | Trigger named `Menu`; every test addresses it so | ✓ | D-26 row |
| | 2 | Every segment has or inherits a boundary; root fallbacks with locked copy | ✓ | D-21 row |
| | 3 | Print drops the shell and controls; wrapped, static tables | ✓ | D-33 row |
| 08-10 | 1 | The documented header set on every response | ✓ | D-19 and D-42 rows |
| | 2 | Zero CSP violations for both actors on every route | ✓ | `production-hardening.spec.ts:532, :542, :555` |
| | 3 | No server-only name or value in client chunks; transport modules are server-only | ✓ | D-22 row |
| | 4 | No unsafe HTML sink; cross-origin Server Action refused | ✓ | D-21 and D-48 rows |
| 08-11 | 1 | Six journeys at 1440 and 375, populated, inside 30 min | ✓ | Criterion 4 |
| | 2 | Every sign-in helper asserts the shell, never the URL | ✓ | D-15 row |
| | 3 | Maya's URLs to Jane's records show no record data at both widths | ✓ | D-18 row |
| | 4 | The CSP collector on every journey, zero violations | ✓ | All six journey specs attach it and assert zero violations |
| 08-12 | 1 | Zero violations under five tags plus Label in Name on every route, actor and width | ✓ | D-25 row |
| | 2 | Conformance record for the undecidable criteria | ✓ | The record; its 2.4.7 row trails SR-04 (`advisory`) |
| | 3 | Five consecutive isolated passes and the full run | ✓ | 55 of 55; the full runs |
| | 4 | Exactly one level-one heading on every route; the Administration denial gains its title | ✓ | `accessibility.spec.ts:124`; `AdministrationAccessDenied` at 12 call sites |
| 08-13 | 1 | Ten key routes measured five times on the production build | ✓ | `performance.spec.ts`; `phase-08-baseline.md` |
| | 2 | Fails on a budget breach; budgets recorded with their derivation | ✓ | D-24 row |
| | 3 | Analyzer corroboration run once, output shape recorded | ✓ | `phase-08-baseline.md` § Corroboration |
| | 4 | No dependency added for measurement | ✓ | Manifest diff |
| 08-14 | 1 | Five-command gate green in both projects; tree clean | ✓ | `0290f4f`, then the post-review runs on `117741f` and `3251a0c`. The orchestrator's final re-run is the remaining step. |
| | 2 | No schema change, no Keycloak line, identical catalogue copies | ✓ | D-01 to D-03 rows (D-02 on the corrected pathspec) |
| | 3 | INT-03 re-verified with counts; no `CSRM_AI_*` change | ✓ | Criterion 3 |
| | 4 | REQUIREMENTS and STATE record "complete except INT-02" | ✓ | `REQUIREMENTS.md:70-73, :108-110`; `STATE.md:7, :25, :30` |
| | 5 | Every residual in one register; contract-gap outcome recorded | ✓ | `phase-08-residual-risks.md`; its R-08-18 count is noted under G1 |

**Score:** 54 of 55 plan truths verified; 08-04 truth 3 is partial.

#### Required artifacts and key links

- **`verify.artifacts`:** 46 of 46 pass on all fourteen plans. Every plan artifact exists with its required export, content or minimum length. Every Wave 0 file `08-VALIDATION.md` names is tracked (35 of 35).
- **Key links:** 38 of 40 match their patterns. Both misses are false positives:
  - 08-01 expects `"vitest": "^4.1`. The review fix `117741f` (SR-06) pins exactly `"vitest": "4.1.11"`, which meets the truth ("major 4 at or above 4.1.11").
  - 08-11's `from` is the glob `apps/web/e2e/*.spec.ts`. The truth covers journeys, and all six journey specs attach and assert the collector, as do `accessibility`, `production-hardening` and `performance`. The seven specs without it are not D-14 journeys.

#### Data-flow trace (Level 4)

| Artifact | Data | Source | Produces real data | Status |
|----------|------|--------|--------------------|--------|
| `served-operations.json` | the served, unserved, plugin and spec-only sets | `served-operations.integration.test.ts` builds it from the mounted Strapi's route registries and koa layers | Yes. The web guard and the matrix completeness guard read it. | ✓ FLOWING |
| `authorization-matrix.integration.test.ts` | the expected status per actor | `fixtures/authorization-matrix.ts` rows keyed to the inventory | Yes. Mounted HTTP requests against the harness Strapi, with persistence snapshots. | ✓ FLOWING |
| `questionnaire-revision-timeline.tsx` | `by.displayName` | `timelineActorNames` → one Document Service `findMany` on `api::idambox-user.idambox-user` (`csrm-questionnaire.ts:142-151`) | Yes. "Bob Doe" in the mounted proof; null for unknown or inactive ids. | ✓ FLOWING |
| Every page's CSP | the nonce | `proxy.ts:20` (`crypto.randomUUID`) → request header → Next's scripts | Yes. A fresh nonce per document is asserted on the production build. | ✓ FLOWING |
| `performance.spec.ts` | medians against budgets | browser timings and CDP bytes → `performance-metrics.ts` | Yes. Five cache-disabled samples per route. | ✓ FLOWING |

#### Gate evidence (recorded, not re-run here)

| Run | Commit | Strapi | Web unit | Typecheck and `api:check` | Playwright (both projects) | Tree |
|-----|--------|--------|----------|---------------------------|----------------------------|------|
| 08-14 phase gate | `0290f4f` | 504/504 | 91 files, 1677 | clean | 81/81 (77 desktop, 4 mobile), 0 flaky, 11.0 min; `next start` confirmed in the log | empty |
| After the server-scope fixes | `117741f` | 514/514 | 94 files, 1756 | clean | 82/82 (78 desktop, 4 mobile), 11.1 min | only the fix report in progress |
| After the web-scope fixes | `3251a0c` | not run; no Strapi file changed since `117741f` (verified here: 0 files) | 95 files, 1793 | clean | 82/82 (78 desktop, 4 mobile), 0 flaky, 11.4 min | only the fix report in progress |

- **Consistency with the tree at HEAD:**
  - 95 web unit test files (matches);
  - 41 Strapi test files under the compiled glob (40 plus the SR-02 provenance unit test);
  - 16 spec files with 60 static `test(` declarations; the loop-generated tests make up the 82.
- **The one remaining step** is the orchestrator's re-run of the full five-command gate, with `git status --porcelain` empty, after the parallel security and UI audits and any fixes they cause. It is recorded here as outstanding, not as a failure.

#### Browser verification (orchestrator)

- The orchestrator audited every list and first detail route for the three actors at 1440 and 375, at every plan from 08-05 on:
  - 104 pages;
  - zero axe violations, zero horizontal overflow and zero console errors;
  - exactly one level-one heading and a specific document title on every page.
- These audits found and fixed:
  - the desktop Search Risks input overlapping its button (`90a2565`, `5a9420d`);
  - the Risk Register loading fallback throwing on a refused URL (`e34dce8`, `15dcacf`).
- This verification did not repeat the audits.

#### Behavioral spot-checks (read-only)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Contract chain and parity guards | `vitest run contract-operation-chain contract-response-parity` | 74 passed | ✓ PASS |
| Security, auth, harness and zod-boundary guards | `vitest run src/lib/security src/lib/auth src/lib/testing src/lib/performance` | 19 files, 831 passed | ✓ PASS |
| INT-03 web files | `vitest run` the three files | 46 passed | ✓ PASS |
| UI primitives and governance | `vitest run` six files | 126 passed | ✓ PASS |
| Inventory completeness | node over `served-operations.json` | 76/75/34/37/78/0/0; every row with an operationId, grants and roles; every reason present | ✓ PASS |
| Catalogue copies | `cmp` | identical | ✓ PASS |
| Schema freeze, as-written against corrected pathspec | `git ls-files` and `git diff` with a positive control | 0 files matched as written; 15 matched corrected; 0 changed in the phase | ✓ PASS (with the pathspec defect recorded) |
| Keycloak absence | added-line grep with a positive control | 0 in the phase; 1 on `4e2f1e8` | ✓ PASS |
| Cited commits | `git cat-file -e` for 156 hashes | 156 resolve | ✓ PASS |
| Suites, Playwright, `typecheck`, `api:check` | not run | Skipped by instruction: the orchestrator's dev servers are running, and `typecheck` and `api:check` rewrite files | ? SKIP |

#### Probe execution

No plan or summary declares a probe, and the repository has no `scripts/*/tests/probe-*.sh`. Step 7c: SKIPPED.

#### Code review findings and fixes (regression read)

`08-REVIEW.md` raised 21 findings: 1 blocker, 8 warnings and 12 info. `08-REVIEW-FIX.md` records all 21 as fixed. Each fix was read in source here, and the post-review runs above cover them.

| Finding | Fix | Read here |
|---------|-----|-----------|
| SR-01 production build started with `NODE_ENV=development` | `fa4bc5b`, `151a443` | Resolver keyed on the compiled `NODE_ENV`; refused-runtime proof `production-hardening.spec.ts:243` |
| SR-02 matrix successes asserted without observation | `8e260c6` | Per-actor `provenBy` enforced by `helpers/matrix-provenance.ts`; two new mounted proofs; the rule's own unit test |
| SR-03 chain guard blind outside `*-service.ts` | `1005bd9` | Every module and receiver scanned; `CLIENT_OUTSIDE_SERVICE_LAYER`, `CLIENT_METHOD_DETACHED`, `WEB_CALLS_UNSERVED` |
| SR-04 focus helper passed a resting shadow | `e482a5c` | Compares the resting and focused states (`focus.ts:10-16`) |
| SR-05 unanchored proxy matcher | `52ec2c2`, `c226881` | `proxy.ts:46-52` |
| SR-06 `sharp` pin crossing; caret ranges | `117741f` | Audit record corrected; R-08-39; `vitest` 4.1.11 and `turbo` 2.11.3 exact |
| SR-07 maintenance switches silence two guards | `4e7423f` | `scripts/refuse-maintenance-switches.mjs` runs first in the `test` script |
| SR-08 open redirect through control characters | `856319c`, `0d260a8` | `return-to` tests are among the 831 here |
| SR-09 artifacts never removed | `d43f576` | `e2e-run-artifacts` tests are among the 831 here |
| SR-10 ephemeral-range ports | `d97858d` | `e2e-harness-ports` tests are among the 831 here |
| WR-01 journey date collision | `d93b9f8` | Equal-bounds step asserts invariants (`risk-register-workflow.spec.ts:341`); R-08-25 closed |
| WR-02 `Status: approved` chip | `faa241e`, `f33a157` | Chip label from `statusLabel` |
| WR-03 request tones against X-5 | `f2fd6ea`, `14a8dab` | Request draft info, submitted success; UI-SPEC §3.3 amended |
| WR-04 zod default messages | `a9fe609`, `1f9d4c9` | `validation-messages.ts`; bounds unchanged (`administration-schema.ts` diff) |
| WR-05 route titles for a missing id | `bb2540f`, `c2a30a1` | Seven record routes use `recordRouteMetadata` |
| WR-06 "Draft assistance" copy | `c94a620`, `8b7ab5c` | `assessment-draft-job.tsx:47`, the card's precondition |
| WR-07 zod on the analyst request review | `1342f6e`, `f6694e8` | `request-hub.tsx:2` imports the zod-free domain module |
| WR-08 CSV row states outside the mapping | `c890149`, `cf71029` | `importRow` family (`status-badge.tsx:103-109`); direction document first |
| WR-09 deprecated `priority` | `f2d3be3`, `9bf9af9` | `wordmark.tsx:14` uses `preload` |
| WR-10 repeated parameter in the loading state | `12ed8a3`, `8f27220` | Per the fix record; covered by the web runs |
| WR-11 order-dependent governed scans | `3251a0c` | State guards before each governed scan |

No fix touched a content-type schema, the specification, a grant or a policy, as the freeze diff, `cmp` and the unchanged policy directory show.

#### `08-VALIDATION.md` requirement-to-test map

Every row's proof exists, and every Wave 0 file is tracked (35 of 35).

- **The map's own defects** are listed in `advisory`:
  - the D-02 pathspec;
  - the `test -- <pattern>` form;
  - the Linux host commands;
  - row 08-04-01's eight labels;
  - the draft status.
- **The six manual-only rows:**
  - **Covered by automation or the orchestrator's audit:** the filter bar at 1280 (browser geometry, plus the orchestrator's fix); five register columns at 1440 (`risk-register-workflow.spec.ts:242`); the cross-tab fade at 375 (the hit-test probe in `analyst-insights.spec.ts`); the unavailable sign-in (`production-hardening.spec.ts:193`, copy asserted); console clean (the 104-page audit and the CSP collector).
  - **Human judgement still needed:** print legibility (below).

#### Anti-patterns found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/features/administration/administration-service.ts`, `apps/web/src/features/risks/risk-service.ts` | 52-69; 30-40 | Root-reporting parser wrapper with a blanket `narrowedPaths: ['data']` and no reason | ⚠️ Warning (gap G1) | The parity guard cannot see nine parsers' field-level narrowings; at runtime they fail closed |
| `docs/security/web-headers.md` | 143 | Record overstates the parity guard's reach | ℹ️ Info (part of G1) | Misleads the security audit about D-21's evidence |
| `docs/accessibility/phase-08-wcag22-conformance.md` | 114 | Record describes the pre-SR-04 focus helper | ℹ️ Info | Understates the evidence; the claim holds |
| `apps/strapi/src/policies/csrm-authorization.ts` | 21-22 | Comment says the catalogue grants these operations to the human role only; false for the assessment release | ℹ️ Info, pre-existing (`b4f3d88`) | The guard refuses anyway; the comment misdescribes the catalogue |
| `apps/web/src/features/requests/request-form.tsx`, `apps/web/src/features/risks/mitigation-control-list.tsx`, `apps/web/src/features/risks/risk-detail-editor.tsx` | 283; 189; 179 | Arbitrary pixel widths (`min-[560px]`, `max-w-[640px]`) | ℹ️ Info, pre-existing (present at `a9394cf`) | Outside Phase 8's diff; for a later UI pass |

- **Debt markers:** no `TBD`, `FIXME`, `XXX`, `TODO` or `HACK` appears in any of the 202 source files the phase added or changed, so the debt-marker gate passes. The positive control matches 32 of those files.
- **Other sweeps:** no hex, rgb or hsl literal in changed web source; no `fetch(` outside the transport; no `dangerouslySetInnerHTML`.

#### Disconfirmation pass

1. **A requirement only partly met.** D-05 and D-40 (G1). The phase closed IN-03 exactly as planned, but the stricter clause, that no parser stays invisible to the guard, was deferred plan to plan (08-04, then 08-13, then 08-14) and landed here unresolved. In the same area, 08-04 truth 1's purpose clause (a stricter parser "can no longer stay invisible") holds for 49 of the 58 registered parsers (the parity file runs 66 tests: one per parser, plus eight others).
2. **A test that passes without testing the stated behaviour.** The SR-02 provenance rule checks that a cited test names the actor's harness identity, not that the cited request is the operation the row covers. `08-REVIEW-FIX.md` records this limitation. D-16 permits citing existing proofs, so this is informational. Separately, D-17's "never holds a human-analyst grant" is true in effect, not in the catalogue (see `advisory`).
3. **An error path with no test.** R-08-08: the prerendered `/_global-error` copy (`pages/500.html`) is served without a nonce when Next fails outside rendering, so its "Try again" does nothing. No test reaches it, because a healthy build never serves it. It is accepted in the register.

#### Human verification required

##### 1. Print legibility (D-33; `08-VALIDATION.md` manual-only row "Print emulation")

**Test:** At A4 with default margins, open the print preview (Ctrl+P) of `/app/risks?state=open`, `/app/reports/risk-exposure` and a Risk detail, signed in as Security Analyst.
**Expected:**
- No sidebar, header, filters, density toggle or pager.
- The register prints its eight header labels, with tinted badges, no vertical rule after `Risk number`, and all eight columns on the page.
- The report prints its KPI tiles, tinted bars and all three tables.
- The Risk detail prints its number and ratings.
- Samples from 08-09 are in `apps/web/.tmp/audit/08-09/`.

**Why human:** The browser proof asserts the computed print layout. Whether the result is legible on paper is a visual judgement. The parallel UI audit may already cover this; if it does, cite it and close this item. R-08-29 and R-08-30 are UI-review decisions on the same surface.

The development-only hot-update check under the CSP on the operator's `next dev` (08-10, register "Open items") is outside the production goal and is left to the orchestrator's browser pass.

#### Deferred items

| # | Item | Addressed in | Evidence |
|---|------|--------------|----------|
| 1 | INT-02: Keycloak authorization-code authentication and Strapi token issuer, audience, signature and expiry validation; the Keycloak half of criterion 2 | No later phase; deferred by operator decision (2026-09-25) until the operator provides a Keycloak environment | D-01; `REQUIREMENTS.md:71, :110`; `STATE.md:7`; R-08-01, R-08-02, R-08-03, R-08-28. Phase 9 is unplanned and names no INT-02 work. |

#### Gaps summary

**One gap, from one root cause: the parity guard cannot see inside nine parsers (G1).**

- **Affected must-haves:** D-05 ("Nothing stays invisible to the parity guard"), D-40 ("no parser stays invisible to the guard") and 08-04 must-have truth 3.
- **The parsers:** the eight `administration.*` parsers and `risks.listRiskRegister`.
- **Why the guard is blind:** each is registered through a wrapper that reports any failure as one issue with no path (`administration-service.ts:52-55`; `risk-service.ts:30-33`). Each also carries `narrowedPaths: ['data']` (`administration-service.ts:62-69`; `risk-service.ts:40`), and the guard maps an empty path to `data` (`contract-response-parity.test.ts:346-354`). So every guard mode tolerates every inner rejection.
- **Why the phase has not already covered it:**
  - the parsers are not among the 33 grandfathered entries, and the asserted count of 33 (`:469`) excludes them;
  - the phase recorded the blind spot as R-08-18, but it moved from 08-04 to 08-13 to 08-14 and on to this verification without a fix;
  - two records describe it inaccurately: `web-headers.md:143` claims the guard proves closed parsers at every boundary, and R-08-18 counts ten rather than nine.
- **Impact:** it bounds what the guard can detect, not what the product does. A served value one of these parsers refuses still fails closed, so the page shows its error state and discloses nothing. The mounted Strapi suites and `risk-schema.test.ts` and `administration-schema.test.ts` pin today's shapes. The parsers predate Phase 8; this phase changed only their messages (WR-04) and moved their vocabularies (08-13), with every bound unchanged.

**Closing it, option A (fix), recommended. A small gap-closure plan in the web only:**
1. **Let the guard see inside the nine.** Register the underlying closed schemas directly, or let each wrapper forward the inner `ZodError` issues with their paths (the inner functions call `schema.parse`: `administration-schema.ts:258, :267`; `risk-schema.ts:161`). Remove the nine `narrowedPaths: ['data']`.
2. **Account for what the guard then reports.** Register each deliberate inner narrowing in `narrowedPaths` with its reason, or grandfather each parser that only the boundary modes reject with one entry and a reason. Move the asserted count from 33 on purpose.
3. **Correct the records.** Fix `web-headers.md:143` and R-08-18.
4. **Verify.** `vitest run contract-response-parity administration risk`, then the web suite and `typecheck`. No Strapi, contract or grant change is needed.

**Closing it, option B (accept).** If the operator accepts R-08-18 as this phase's backlog, add this to the frontmatter and re-run verification. The item then counts as PASSED (override):

```yaml
overrides:
  - must_have: "No response parser stays invisible to the contract parity guard (D-05, D-40; 08-04 must-have truth 3)"
    reason: "Nine pre-Phase-8 parsers (administration.* and risks.listRiskRegister) sit behind root-reporting wrappers with narrowedPaths ['data']. Their narrowings fail closed, the mounted suites and the schema tests pin the served shapes, and residual R-08-18 carries them to the next contract pass. The Phase 7 parsers and every parser this phase added or changed are fully visible."
    accepted_by: "{operator}"
    accepted_at: "{ISO timestamp}"
```

**Everything else holds on the code as it stands:**
- the five roadmap criteria (criterion 2's Keycloak half deferred with INT-02);
- INT-01, INT-03 and INT-04;
- 49 of 51 decisions and 54 of 55 plan truths;
- all 21 review findings, fixed and covered by the post-review runs.

**What remains:**
- G1, closed by option A or B;
- the print-legibility check, unless the UI audit covers it;
- the orchestrator's re-run of the full five-command gate after the parallel audits;
- the tracking corrections in `advisory` (`08-VALIDATION.md`, STATE, deferred items and the ROADMAP status line).

---

_Verified: 2026-09-26T07:46Z_
_Verifier: gsd-verifier_
