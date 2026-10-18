---
quick_id: 260902-ed0
status: complete
completed: 2026-09-02
primary_commit: ffa5b0f
---

# Phase 6 round-2 remediation summary

All nine verified findings in `06-REVIEW-FINDINGS-ROUND2.md` were remediated exactly as decided. Phase 6 remains in verification; Phase 7 was not touched and nothing was pushed.

## Findings closed

- **R1:** Restored global Formidable caps of 52,428,800 bytes per file and 262,144,000 bytes total, with no global file-count cap. The import workflow still enforces exactly one `file` up to 5,242,880 bytes with mounted zero-write regressions.
- **R2:** Allowed only canonical `page`/`pageSize` pagination under the implicit picker grant, retained analyst-only search/sort/filter access, and made both web inventory pickers validate metadata and aggregate every page at pageSize 100 under a 1,000-page hard cap.
- **R3:** Documented that every active IdamBox user receives the implicit Requestor birthright and can read the closed Administration list projection through the two inventory picker grants.
- **R4:** Added the genuine multi-create repository call-count regression. Mutation checking demonstrated three reads when a per-row rescan was reintroduced; the shipped path asserts exactly one commit-time collection read.
- **R5:** Added serialized preview/commit capacity checks that accept exactly 65,536 records and reject cap plus one with `409 IMPORT_RECORD_LIMIT_EXCEEDED` before writes.
- **R6:** Added a mounted HTTP preview regression backed by 5,001 direct database fixtures. Mutation checking demonstrated that a restored 5,000-record repository limit misclassified the target; the shipped repository classifies it as `update`.
- **R7:** Replaced raw token-literal counting with per-route structural auth-block checks. A hostile missing gate plus compensating comment now fails.
- **R8:** Rewrote the contract-gap record to describe the 22 explicit analyst operations and the two implicit-birthright inventory picker branches truthfully.
- **R9:** Ignored `apps/web/.tmp/` and restored `apps/web/tsconfig.json` to its canonical include set after the full E2E run.

## Commits

- `ffa5b0f` — `fix(phase-06): close round-two import and picker gaps`
- `450e8af` — `chore(web): ignore Playwright temp output`

## Verification

- Focused RED: R1 multipart values absent; R2 pagination returned 403 and web stopped after page one; R5 cap plus one was accepted; R7 hostile comment masked the missing gate.
- Mutation RED: R4 reported three repository reads after a temporary per-row rescan; R6 reported zero updates after a temporary 5,000-record repository cap. Both temporary mutations were removed before GREEN.
- Focused GREEN: multipart, call-count, capacity, mounted picker authorization, mounted beyond-window classification, request-service pagination, and hostile integrity regressions all passed.
- Full Strapi gate: `npm test` — 127 passed.
- Full web gate: `pnpm typecheck` passed; `pnpm test` — 287 passed; `pnpm api:check` passed; `pnpm test:e2e` — 16 passed.
- Final integrity audit: frozen content-type hashes, catalogue byte identity/counts, token-only route gates, anti-escape checks, dependency allowlist, and generated API contract all passed.

## Scope preservation

Frozen content-type schemas and both catalogue copies were unchanged. Token-only outer authentication remains on all 24 Administration operations. No dependency, schema, catalogue, Phase 7, or release-state change was introduced.
