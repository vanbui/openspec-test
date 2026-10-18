# Phase 19 re-check (iteration 6), lane A: plans 19-02, 19-03, 19-04, 19-05, 19-06, 19-08

HEAD `bdd0f698`, 2026-10-16. Read-only. Scratch: `scratchpad/recheck6a/`.

**Verdict: PASSED with advisories.** All nine items are resolved. There are 0 new blockers and 0 warnings, plus 3 info items.

## Mechanical checks
- `verify plan-structure`: all six plans are valid, with no errors or warnings. Task counts: 02=3, 03=4, 04=3, 05=3, 06=4, 08=4.
- `frontmatter validate --schema plan`: all six are valid.
- `bash -n` on all 21 `<automated>` blocks (XML entities decoded): every block passes.
- `grep -c ProgramData`: 0 in each plan.

## Items

| Item | Status | Evidence |
|---|---|---|
| A-NB-1 (19-03) | Resolved | 19-03 Task 1 verify (`node -e` lock reader). Run alone against today's `pnpm-lock.yaml`, it exits 0; the lock's only entries are `fflate@0.8.3` at :5311 and :15213 and `fflate: 0.8.3` at :17654. On a copy with `fflate@0.8.2` it exits 1. An importer `fflate:` block whose `specifier:`/`version:` sit on the next lines does not match the regex, so it cannot add a false version. |
| A-W-1 (19-04) | Resolved | 19-04:137 makes `reason?` optional ("absent, never `null`") and cites security-event-log.ts:142. That line is confirmed: `if (event.reason !== undefined) line.reason = closed(String(event.reason), REASON, "INVALID_REASON")`. The formatter extension keeps the common head (:131-136) and today's attachment branch byte for byte, then adds one branch per family. Acceptance 19-04:196 adds three cases: no `reason` key, no `INVALID_REASON`, and the 255-character search cut. The attachment line is byte-identical. |
| A-I-3 (19-02 T3) | Resolved | The node walk in the 19-02:222 verify was run alone against today's tree and exits 0. It finds exactly `features/attachments/attachments-schema.ts` and `lib/api/transport/server-client.ts`, which matches the acceptance at 19-02:228. |
| A-I-4 (19-05) | Resolved | 19-05:119 says "on a draft (unreleased, editable) assessment … specification.json:25261", and the behaviour at 19-05:179 matches. |
| B-NB-1 (19-05, 19-08) | Resolved | Today's `analyst-insight-routes.unit.test.ts:81` holds the bare `"/export"`, and the loop at :152-156 checks every router, insight routers included. 19-05:124/:186/:198 replace it with `'"/v1/alerts/export"'` and `'"/v1/reports/:reportKey/export"'`. 19-08:143 and :259 remove only the alerts literal, and 19-09:147 removes the reports literal. Route paths each later plan mounts: 19-07 `/v1/assessment_requests/export`, `/v1/my_requests/export`; 19-08 `/v1/questionnaires/export`, `/v1/my_questionnaires/export`, `/v1/alerts/export` (served in the same commit that drops its literal); 19-09 `/v1/reports/:reportKey/export`; 19-10 `/v1/risk_assessments/export`, `/v1/my_risk_assessments/export`, `/v1/risk_assessments/:assessmentId/export`; 19-14 `/v1/{segment}/export` for the four reference collections. None of these contains a fragment still on the list at that point (`"/v1/alerts/:`, the two dashboard aliases, `/acknowledge`, plus the unserved literal). The `"/v1/alerts/export"` literal does not contain `"/v1/alerts"` followed by a closing quote, so the "declared elsewhere" check at :140-148 also holds. |
| B-W-1 (19-08) | Resolved | 19-08:144-146 adds the entry with `underlyingRead: CSRM_ANALYST_INSIGHT_OPERATIONS.listAlerts`. The assertion stays a single `deepEqual`, and `underlyingRead` is added only when the entry declares it (an `"underlyingRead" in served` check). `insightPolicies` spreads the key rather than passing `undefined`, which matches the deepStrictEqual at :115-117. `catalogueUrl("GET","/v1/alerts/export")` equals the operation at :118. `CSRM_ANALYST_INSIGHT_EXPORT_OPERATIONS` does not match the `/CSRM_ANALYST_INSIGHT_OPERATIONS/` regex at :150. |
| B-W-3 (19-06) | Resolved | 19-06 Task 1 `<files>` (:192) includes `strapi-capabilities.test.ts` and `docs/references/served-operations.json`. The action at :218-219 regenerates the inventory in that commit. The verify runs `src/lib/capabilities` and `contract-operation-chain.test.ts`. Task 3 (:286) says the work is done in Task 1. The served-anchor check at `strapi-capabilities.test.ts:47-60` is extended to strip `?…`. |
| Header action order (19-06) | Resolved | 19-06:132-134 puts Export last in DOM order and does not reorder visually, and passes a multi-action header as one wrapper. Checked against `page-header.tsx:25`: the `page-header-actions contents` div is confirmed, and `.page-header` uses space-between (`globals.css:1023-1029`). Also checked against `administration-workspace.tsx:271`: the `flex w-full flex-col gap-2 md:w-auto md:flex-row-reverse` wrapper is confirmed. The plan's statement that "Export [is] to their left" on desktop is correct for row-reverse. |
| Pilot ruling 3 | Resolved | 19-05:115 makes `format` a required query parameter (`enum csv, xlsx`). 19-08:140 adds `format` to all three spec paths, and the 400 on `format=pdf` is at :274. No phase-19 plan claims that only the register export carries `?format`. The only related text is 19-01:185 ("the catalogue reserves only the register and report exports"), a true statement about the catalogue, which the live catalogue confirms. |

## New blockers
None.

## Warnings
None.

## Info
- **I-1 (19-04).** Adding `ImportSecurityEvent` (no `reason`) and `ExportSecurityEvent` (no `requestId` and similar fields) to the `SecurityEvent` union breaks the property reads that are not narrowed:
  - `securityEventLevel`'s `event.reason` (security-event-log.ts:124);
  - the attachment field reads in the formatter, unless they move inside the `event.name` branch.

  Under strict TS these give TS2339. The plan's "one branch per family" covers the formatter, but it says nothing about `securityEventLevel`. Correct work must narrow there too, or declare `reason?: never` on the import event. `tsc` would catch the omission, so this does not block.
- **I-2 (cross-plan).** The catalogue anchor shape is mixed:
  - 19-05 and 19-14 carry `?format={format}`;
  - 19-07, 19-08 and 19-10 do not (for example `GET:/api/v1/alerts/export`), although every one of them takes the `format` query parameter.

  19-14's "uniform" claim covers only its four anchors. 19-06's generic strip handles both shapes, so this is consistent with the pilot's ruling as worded. The mix is recorded here so nobody later reads it as drift.
- **I-3 (19-02).** The importer guard counts `import { type X }` (an inline type specifier) as a value import, so it errs on the strict side. That is acceptable.
