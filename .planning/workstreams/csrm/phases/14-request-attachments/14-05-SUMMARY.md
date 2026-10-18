---
phase: 14-request-attachments
plan: 05
subsystem: api-contract
tags: [conflict-reasons, error-schema, openapi, transport, refusal-copy, malware, attachments]
requires:
  - phase: 10-assessment-workflow
    provides: "10-06: CONFLICT_REASONS (Strapi and web), isConflictReason, both error schemas' reason enums, TransportError.reason; 10-07: refusal-copy.ts"
  - phase: 13-request-collaboration
    provides: "OWN_REQUEST, REQUEST_NOT_SUBMITTED and HISTORY_UNAVAILABLE on the one list; family M's OWN_REQUEST sentence"
provides:
  - "24 Phase 14 refusal codes in Strapi's CONFLICT_REASONS, the web's list and both spec enums, with their statuses in the Strapi module comment"
  - "AssessmentWorkflowErrorResponse.error.details.detection (string, ^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$); details stay additionalProperties: false"
  - "TransportError.detection; normalizeTransportError keeps a validated reason on any 4xx and the detection only beside ATTACHMENT_MALWARE_FOUND"
  - "refusal-copy.ts: AttachmentRefusalKind, attachmentAddRefusal (N), attachmentFileRefusal and AttachmentFileAction (O), downloadCheckFailedMessage, downloadFailureTitle, attachmentAiRefusal (P)"
affects: [14-06, 14-07, 14-08, 14-09, 14-10, 14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17]
actuals:
  tokens: 12163
  tasks: 2
  commits: 4
plan_head_before: 444aa9d47d49dd787e39781ef1a71cf392dfa0d4
plan_head_after: ce2cb34008dcd86056988232960c0ed2f73dff02
tech-stack:
  added: []
  patterns:
    - "One contract change carries a closed error vocabulary in four places (Strapi list, two spec enums, web list), proven equal by a test on each side."
    - "A data value beside a closed reason (the detection) crosses the transport only beside its one reason and only when it matches the spec's pattern."
    - "Copy families with optional values keep their words and drop the value clause when the value is unknown (as aiPolicyRefusalCopy does)."
key-files:
  created: []
  modified:
    - apps/backend/src/csrm/conflict-reasons.ts
    - apps/backend/tests/conflict-reasons.unit.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/lib/api/conflict-reasons.ts
    - apps/csrm/src/lib/api/conflict-reasons.test.ts
    - apps/csrm/src/lib/api/transport/server-client.ts
    - apps/csrm/src/lib/api/transport/server-client.test.ts
    - apps/csrm/src/lib/api/refusal-copy.ts
    - apps/csrm/src/lib/api/refusal-copy.test.ts
key-decisions:
  - "14-05: the transport keeps a closed-list reason on any 4xx (400 to 499), because 13-04's widening was not built; a 5xx, a missing status and a thrown error carry none."
  - "14-05: the detection crosses only beside ATTACHMENT_MALWARE_FOUND and only when it matches the spec pattern; the spec describes it as served with that reason alone."
  - "14-05: in families N, O and P, an unlisted 400 or 409 reads the family's 403 sentence (family L's pattern); family N reads any other unreasoned 4xx as its 400 row."
  - "14-05: family N's 404 reads 'This request is no longer available.' (blocked), Phase 10's locked request refusal, while the page shows its not-found state on refresh; family P's 404 reads family O's 404 row."
  - "14-05: the too-large, malware and classification sentences drop their value clause when the size, detection or classification and ceiling are unknown."
patterns-established:
  - "Attachment refusal copy: reason first, then status; network, timeout and 5xx retryable."
requirements-completed: []
coverage:
  - id: D1
    description: "Phase 14's 24 refusal codes are one closed list in Strapi, both spec error schemas and the web"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/conflict-reasons.unit.test.ts#the conflict reason list Strapi raises is the list both conflict response schemas publish"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/api/conflict-reasons.test.ts#match the closed list %s publishes"
        status: pass
    human_judgment: false
  - id: D2
    description: "A 422 malware refusal keeps its reason and bounded detection through the transport"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/api/transport/server-client.test.ts#a malware refusal"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/conflict-reasons.unit.test.ts#the assessment error schema publishes the malware detection as a bounded string beside the reason"
        status: pass
    human_judgment: false
  - id: D3
    description: "Families N, O and P give every 14-UI-SPEC §8 row verbatim with its kind, the unreasoned 413 and no Accept"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/api/refusal-copy.test.ts#attachmentAddRefusal (family N, every row)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/api/refusal-copy.test.ts#file refusals (families N, O and P)"
        status: pass
    human_judgment: false
duration: 27min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 05: Attachment Refusal Vocabulary Summary

**Phase 14's 24 refusal codes are now one closed list in Strapi, both spec error schemas and the web. A 422 `ATTACHMENT_MALWARE_FOUND` keeps its bounded `detection` name through the transport, and families N, O and P give every refusal its 14-UI-SPEC §8 sentence.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-09T19:11:34Z
- **Completed:** 2026-10-09T19:39:14Z (UTC)
- **Tasks:** 2 (both TDD, RED then GREEN)
- **Files modified:** 10

## Accomplishments

- Strapi's `CONFLICT_REASONS`, the web's `CONFLICT_REASONS` and the `reason` enums of `AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse` each gain the same 24 codes. The Strapi module comment now describes the list as the closed 4xx refusal vocabulary and records each code's status (400, 403, 409, 413, 415, 422). The spec's `reason` description gives the same statuses.
- `AssessmentWorkflowErrorResponse.error.details` declares `detection` (string, `^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$`), described as served only beside `ATTACHMENT_MALWARE_FOUND`. The details object stays `additionalProperties: false`. No operation, grant or success schema changed, and no response was added to any operation (14-06 adds the upload's 413, 415 and 422).
- `TransportError.detection` exists. `normalizeTransportError` keeps a validated reason on any 4xx and keeps the detection only beside the malware reason, and only when it matches the pattern. A space, 129 characters, a leading punctuation mark, markup, or a non-string value drops the detection. A detection beside another reason, or beside an unknown reason, is dropped.
- `refusal-copy.ts` adds family N (`attachmentAddRefusal`, with `offerNewNote` for the two note reasons), family O (`attachmentFileRefusal(action, …)`, `downloadCheckFailedMessage`, `downloadFailureTitle`) and family P (`attachmentAiRefusal`), all with `AttachmentRefusalKind`. Every sentence is copied verbatim from 14-UI-SPEC §8.1 to §8.3, §1.2, §3.4 and §5.1. An unreasoned 413 reads the too-large sentence. Network failures, timeouts and 5xx responses are retryable. No sentence says Accept.

## Task Commits

1. **Task 1 (tracer): the malware refusal's reason and detection from Strapi to the screen**
   - RED `af9bcf26` test(14-05): expect the malware refusal's reason and detection to reach the person
   - GREEN `b3a777ae` feat(14-05): carry a malware refusal's reason and detection from Strapi to the screen
2. **Task 2: every family N, O and P row word for word**
   - RED `64b642d0` test(14-05): expect every file refusal to say what is wrong and what to do next
   - GREEN `ce2cb340` feat(14-05): word every file refusal with its fix

## Verification

- Task 1 verify: `api:check` clean (exit 0, with the regenerated `schema.d.ts` staged); vitest 3 files, 253/253; web typecheck clean; Strapi `conflict-reasons.unit.test.js` pass 2 / fail 0. The tracer gate re-ran the verify end to end before expansion, and it passed.
- Task 2 verify: vitest `refusal-copy.test.ts` and `interface-copy-guard.test.ts`, 322/322; typecheck and lint clean (exit 0).
- Full web suite: 194 files, `Tests 4399 passed (4399)`.
- Full Strapi suite: `ℹ tests 1135`, `ℹ pass 1135`, `ℹ fail 0` (17.5 min).
- `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing; tests use `Csrm.Test.Signature` as the detection name.

## Notes for the Orchestrator

- **`HISTORY_UNAVAILABLE`** in family O uses 14-UI-SPEC §8.2's row `This file’s history is full, so it can’t change any more. Contact your administrator.` (kind `blocked`). The row was added to §8.2 on 2026-10-01 during planning, for plan 14-05.
- **Flag: `ATTACHMENT_UNAVAILABLE` reuses §3.4's line.** §8.2 has no row for the stored bytes being gone, so family O reads §3.4's unavailable line `This file can’t be downloaded. Contact your administrator.` for every action, as the plan directs. On a remove or restore the sentence still says "downloaded". The server serves this reason on the download today (approved record, "Downloads"). If a later plan serves it on remove or restore, the UI-SPEC needs its own row.
- Family O's download-only rows (`ATTACHMENT_QUARANTINED`, `ATTACHMENT_BLOCKED`, `ATTACHMENT_REMOVED`, `ATTACHMENT_INTEGRITY_FAILED`) read the same §8.2 sentence for every action. The approved record serves them on the download only.
- §5.3's preview state `This file’s text is no longer included, so there’s nothing to preview.` is a preview-sheet state, not a family P row. It is left to the preview plan.

## Decisions Made

- **The transport widening (Rule 3 path the plan anticipated).** 13-04's "any 4xx" widening was not in the code: the transport kept reasons on 403 and 409 only. `normalizeTransportError` now keeps a validated reason on any 4xx, and its comment says so. Phase 13's test that dropped a 404's `OWN_REQUEST` and Phase 10's test that dropped a 400's reason were rewritten as the new 4xx rule. Strapi serves reasons only on 403 and 409 today, so no existing behaviour changes. The full web suite is green.
- **Fallbacks the UI-SPEC leaves open.** An unlisted 400 or 409 reads the family's 403 sentence, following family L. Family N reads any other unreasoned 4xx (an unreasoned 415 or 422, for example) as its 400 row. Family N's 404 reads Phase 10's `This request is no longer available.` (blocked), while the page shows its not-found state on refresh. Family P's 404 reads family O's `This file is no longer available. Refresh the page.`
- **Values unknown.** Without a size, the too-large sentence reads `Files can be up to 25 MB. Make it smaller or split it, then add it again.`. Without a detection, the malware sentence drops the parenthesis. Without both the classification and the ceiling, the classification line drops the values, as `aiPolicyRefusalCopy` already does.
- Family P's `OWN_REQUEST` reads family M's sentence from `refusalCopy.noteAiInput`, so the two cannot drift apart.

## Deviations from Plan

### Format differences (matched to the real output)

**1. node:test output format.** Node 24's default reporter prints `ℹ fail 0` and `✖` lines rather than TAP's `# fail`. The fail count was read from `ℹ fail N`.

**2. `api:check` compares against the index.** `api:check` runs `git diff --exit-code` on `schema.d.ts`, so it reports a diff until the regenerated file is staged. The file was staged (the contract really changed), and `api:check` then exited 0 before the GREEN commit.

**3. The web `lint` script** is `next typegen && tsc --noEmit`, so its output reads like the typecheck. Its exit code was 0.

### Auto-fixed Issues

None. Plan executed as written, apart from the fallback choices recorded above where the UI-SPEC is silent.

## Known Stubs

None.

## Threat Flags

None. T-14-17 is mitigated: only `isConflictReason` values cross, and `detection` crosses only beside `ATTACHMENT_MALWARE_FOUND` and only when it matches the pattern. T-14-18 is mitigated: no sentence echoes a file name, a URL or a served message. No package was added (T-14-SC).

## Next Phase Readiness

The operation plans 14-06 to 14-11 can raise any of the 24 codes without touching the vocabulary. 14-06 adds the upload's 413, 415 and 422 responses to its operation. The web actions in 14-12 to 14-16 call `attachmentAddRefusal`, `attachmentFileRefusal` and `attachmentAiRefusal` with the transport's `status`, `reason` and `detection`. COLLAB-02 stays open until 14-17.

## Self-Check: PASSED

- Files: all 10 modified files exist; `14-05-SUMMARY.md` written.
- Commits: `af9bcf26`, `b3a777ae`, `64b642d0`, `ce2cb340` are present on `csrm` (4 since `444aa9d4`).
