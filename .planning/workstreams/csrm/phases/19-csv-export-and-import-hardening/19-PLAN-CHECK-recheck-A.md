# Phase 19 plan re-check, lane A (19-01 to 19-05), iteration 4

Checked on 2026-10-16 against HEAD `bdd0f698`. Read-only: only greps, `bash -n`, gsd-tools, `node -e` reads of JSON, and `pnpm why` were run.

**Verdict: ISSUES FOUND. 1 blocker, 1 warning, 4 info.**

## Mechanical checks
- `verify plan-structure`: valid for all five plans, with no errors or warnings. Task counts: 3, 3, 4, 3, 3.
- `frontmatter validate --schema plan`: valid for all five.
- `bash -n`: passes on all 15 automated commands.
- `grep -c ProgramData`: 0 in each of 19-01 to 19-05.
- Dependency chain: 01 (wave 1), then 02, 03, 04, 05. It is linear with no cycle.

## Iteration-2 findings

| Finding | Status | Evidence |
|---|---|---|
| B1 preamble | Resolved | Every pnpm verify starts with the `node -e` check (major 24, minor 19 or later) and `pnpm --version >/dev/null`, for example 19-02:166, 19-03:191, 19-05:186. The Hard-rules bullet is host-neutral (19-01:148). No ProgramData remains. |
| B2 ledger | Resolved | The Hard-rules bullet accepts the modified `.verification-ledger.json` line in each plan (19-01:149, 19-02:126, 19-03:148, 19-04:157, 19-05:144) and in 19-01 Task 3's criterion (:275). |
| B3 pilot-written approval | Resolved | 19-01 Task 2 has the pilot write all four lines (:221, :246). Task 3 only checks them and makes no commit (:266, :269, :274). Both regexes appear verbatim (:110, :269). The preconditions name both records in 19-02:145 and 19-05:161. Regex test: both pass on simulated pilot lines. Both fail on an awaiting line, on the old executor-written form and on a status line outside the Phase 19 section. The record regex passes on phase-14-request-attachments.md:410. The phase-06 and phase-07 records have no awaiting status today, and both use CRLF endings, which the unanchored regexes tolerate. |
| B4 Affected Workstreams | Resolved | Covered at 19-01:26, :112-114 and :194, and the Task 1 verify checks the section in each record and amendment (:202). Grep A over the iam tree prints 10 files and grep B prints nothing; both re-measured today and both match the plan. Each change states its backward-compatibility position. |
| B5 human-only count | Resolved | 19-05:120, :243 and :246 raise the literal at authorization-matrix.integration.test.ts:264 (`31 + insightOperations.size`, which is still there) to 32. The quoted literal is added (:108). The test is in files_modified (:18). |
| A-W1 | Resolved | No new constant; `isEligiblePerson` decides (19-05:105-107). Today `csrm-authorization.ts` has 0 quoted occurrences of "Security Analyst Agent", and the constant lives at eligible-person.ts:5. The acceptance check is at :226. |
| A-W2 IAM exclusions | Resolved | The content-type freezes carry the three exclusions: 19-02:229, 19-03:289, 19-04:277, 19-05:253. |
| A-W3 written-ahead headers | Resolved | All are restated against `bdd0f698` (19-01:91, 19-02:84, 19-03:101, 19-04:100, 19-05:90). |
| A-W4 `today` | Resolved | 19-04:133 and :140 match risk-register.ts:78-79. The fake-repository case asserts that one `today` reaches every call (:193). |
| A-W5 Withdrawn | Resolved | 19-04:129 maps the riskState family to Withdrawn, matching risk-domain.ts:69-73. The withdrawn and default cases are at 19-04:194, with the check at :210. The database proof is at 19-05:118 and :176. |
| A-W6 catalogue placement and counts | Resolved | 19-05:115 and :121-122. The seed's idambox-csrm assertion is at served-operations test :693. Unserved rows: 54 today. Asserts at :611 and :631 hold. designNotes has 13 entries and the new note goes last. The next free admin FunctionApi number is .api.05 (each admin Function has .01 to .04). |
| B-W5 export 403 messages | Resolved | All three exact strings are in 19-01:137-139 and 19-05:107-110. The humanAnalystDenialMessage branch for every SERVICE_IDENTITY_REFUSED_OPERATIONS member sits before the fall-through at csrm-authorization.ts:157. The policy order works: the effective-operation check (:406), then the new service-identity check, then the human-only check (:409). The unit cases iterate the exported set (19-05:210). 19-07 to 19-10 and 19-14 quote the same strings. |
| Media types | Resolved | 19-04:136 defines EXPORT_MEDIA_TYPES. The 19-05 spec has exactly two keys, each contentMediaType equal to its key, enforced by a node check (:186). 19-06:120 and :281 use the same strings. No other spelling appears in any plan. |
| C-I5 family S | Resolved | The copy is in features/exports/export-refusal-copy.ts and features/administration/import-refusal-copy.ts, and refusal-copy.ts is unchanged (19-02:102, :172, :227). The importer assertion holds at HEAD: the 19-02 Task 3 grep prints exactly attachments-schema.ts and server-client.ts. 19-11 and 19-15 import from the new modules. |
| PHASE_19_BASE | Resolved | 19-01:115, :180 and :202 read the line from 19-PLAN-CHECK.md (line 73: PHASE_19_BASE=bdd0f698), check it is a commit and copy it to 19-01-SUMMARY.md (:308). 19-02:222 reads it back. |

## New blockers

**NB-1. [verify format] 19-03 Task 1's fflate check fails on a correct install under pnpm 11.**
- Plan: 19-03:191 (and :186).
- Required property: the verify passes on a correct install and fails when fflate is outside 0.8.3.
- Evidence: the repo pins packageManager pnpm@11.24.0. At HEAD, `pnpm --dir apps/backend why fflate` prints `fflate@0.8.3` (with an at sign, not a space), followed by `Found 1 version of fflate`. So the grep for "fflate 0.8.3" never matches and the verify fails on correct work. The negative check for "fflate 0.8.[0-2]" would also miss fflate@0.8.2.
- Example fix (non-binding): accept either separator in both the positive and the negative pattern, or require the "Found 1 version of fflate" line together with 0.8.3.

## Warnings

**W-1. [data contract] 19-04 export events typed with a null reason would log INVALID_REASON with the formatter as it is today.**
- Plan: 19-04:137 (the ExportSecurityEvent reason type includes null).
- Evidence: formatSecurityEventLine emits reason whenever it is not undefined and closes it to the upper-case pattern (security-event-log.ts:142). String(null) is "null", so every export.completed line would carry reason INVALID_REASON. The formatter also emits only the attachment fields today (:136-145), so the export and import keys need their own branch.
- Required property: an export or import line carries no reason key unless a closed reason applies, plus every listed field in its fixed order.
- Example fix (non-binding): make reason optional (absent rather than null), and state the formatter extension in the action.

## Info
- **I-1.** The duplicated closing output tags came back at 19-01:309-310 and 19-02:263-264. This is cosmetic.
- **I-2.** PHASE_19_BASE=bdd0f698 exists only in the uncommitted working copy of 19-PLAN-CHECK.md. The revised plans and the lane files are also uncommitted. They must be committed before 19-01 runs: Task 1 reads the line, and the clean-status rule would otherwise reject the tree.
- **I-3.** The importer guard in 19-02 Task 3 matches only single-quoted lines that start "import {" or "} from". A multi-line type import from conflict-reasons in a new module would falsely fail it. A double-quoted value import would pass silently. The project uses single quotes, so the risk is low.
- **I-4.** 19-05 Task 1's Withdrawn case withdraws a draft Risk through risk_withdrawals. That endpoint requires an unreleased, editable assessment (specification.json:25261), so the fixture's second Risk must sit in a draft assessment, as the plan's "draft risk" wording implies.

## Cross-plan consistency (19-06 to 19-15)
- The three 403 strings are identical in 19-07, 19-08, 19-09, 19-10 and 19-14.
- No other media-type spelling appears in any plan. Only 19-PATTERNS.md:254 has an unrelated client Blob literal.
- The count chain is 32, 33, 35, 36, 37, 41, and each plan states its from and to.
- The family S paths are the same in 19-02, 19-06, 19-11 and 19-15.
- The five export Function ids are spelt the same way everywhere. The admin .api.05 to .api.07 are in 19-14:119.
