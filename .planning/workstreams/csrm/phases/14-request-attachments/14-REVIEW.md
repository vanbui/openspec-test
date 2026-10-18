---
phase: 14-request-attachments
reviewed: 2026-10-10T14:22:10Z
depth: standard
diff_base: e50053f
reviewed_head: d3f265df
lanes: 7
operator_pass: none
files_reviewed: 219
files_reviewed_list:
  - .gitattributes
  - CONTEXT.md
  - apps/backend/.env.example
  - apps/backend/README.md
  - apps/backend/config/middlewares.ts
  - apps/backend/config/plugins.ts
  - apps/backend/package.json
  - apps/backend/src/api/csrm-ai-run/controllers/csrm-ai-run.ts
  - apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment-request/services/request-summary-facts.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
  - apps/backend/src/api/csrm-request-attachment/content-types/csrm-request-attachment/schema.json
  - apps/backend/src/api/csrm-request-attachment/controllers/request-attachments.ts
  - apps/backend/src/api/csrm-request-attachment/operations.ts
  - apps/backend/src/api/csrm-request-attachment/routes/request-attachments.ts
  - apps/backend/src/api/csrm-request-attachment/services/attachment-ai-signal.ts
  - apps/backend/src/api/csrm-request-attachment/services/attachment-event-log.ts
  - apps/backend/src/api/csrm-request-attachment/services/attachment-projection.ts
  - apps/backend/src/api/csrm-request-attachment/services/attachment-rules.ts
  - apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/backend/src/csrm/ai/ai-inputs-signal.ts
  - apps/backend/src/csrm/ai/assessment-context-loader.ts
  - apps/backend/src/csrm/ai/assessment-context.ts
  - apps/backend/src/csrm/ai/prompt-sections.ts
  - apps/backend/src/csrm/audit/security-event-log.ts
  - apps/backend/src/csrm/conflict-reasons.ts
  - apps/backend/src/csrm/files/attachment-config.ts
  - apps/backend/src/csrm/files/attachment-policy.ts
  - apps/backend/src/csrm/files/clamav-scanner.ts
  - apps/backend/src/csrm/files/content-check.ts
  - apps/backend/src/csrm/files/extraction-worker.ts
  - apps/backend/src/csrm/files/extraction.ts
  - apps/backend/src/csrm/files/ooxml-text.ts
  - apps/backend/src/csrm/files/private-local-provider.ts
  - apps/backend/src/csrm/files/register-attachment-storage.ts
  - apps/backend/src/csrm/files/rescan-scheduler.ts
  - apps/backend/src/csrm/files/scanner.ts
  - apps/backend/src/csrm/files/screen-attachment.ts
  - apps/backend/src/csrm/files/send-stored-file.ts
  - apps/backend/src/csrm/files/storage-port.ts
  - apps/backend/src/csrm/files/zip-archive.ts
  - apps/backend/src/csrm/prompt-data.ts
  - apps/backend/src/csrm/spreadsheets/xlsx-reader.ts
  - apps/backend/src/index.ts
  - apps/backend/src/middlewares/csrm-multipart-cleanup.ts
  - apps/backend/src/policies/csrm-authorization.ts
  - apps/backend/tests/ai-inputs-signal.unit.test.ts
  - apps/backend/tests/ai-provenance.unit.test.ts
  - apps/backend/tests/ai-provider-guardrails.unit.test.ts
  - apps/backend/tests/ai-run-boot.unit.test.ts
  - apps/backend/tests/ai-run.integration.test.ts
  - apps/backend/tests/analyst-insight-authorization.unit.test.ts
  - apps/backend/tests/assessment-context.integration.test.ts
  - apps/backend/tests/assessment-context.unit.test.ts
  - apps/backend/tests/assessment-workflow.integration.test.ts
  - apps/backend/tests/attachment-ai-input.integration.test.ts
  - apps/backend/tests/attachment-ai-signal.unit.test.ts
  - apps/backend/tests/attachment-config.unit.test.ts
  - apps/backend/tests/attachment-content-check.unit.test.ts
  - apps/backend/tests/attachment-extraction.unit.test.ts
  - apps/backend/tests/attachment-policy.unit.test.ts
  - apps/backend/tests/attachment-quarantine.integration.test.ts
  - apps/backend/tests/attachment-rescan.unit.test.ts
  - apps/backend/tests/attachment-rules.unit.test.ts
  - apps/backend/tests/attachment-scanner.unit.test.ts
  - apps/backend/tests/attachment-storage-s3.integration.test.ts
  - apps/backend/tests/attachment-storage.unit.test.ts
  - apps/backend/tests/authorization-matrix.integration.test.ts
  - apps/backend/tests/authorization-policy.unit.test.ts
  - apps/backend/tests/conflict-reasons.unit.test.ts
  - apps/backend/tests/contract-catalogue.integration.test.ts
  - apps/backend/tests/fixtures/attachments/README.md
  - apps/backend/tests/fixtures/attachments/architecture-deck.pptx
  - apps/backend/tests/fixtures/attachments/data-flow.docx
  - apps/backend/tests/fixtures/attachments/diagram.png
  - apps/backend/tests/fixtures/attachments/photo.jpg
  - apps/backend/tests/fixtures/attachments/vendor-questionnaire.xlsx
  - apps/backend/tests/fixtures/attachments/vendor-security-pack.pdf
  - apps/backend/tests/fixtures/authorization-matrix.ts
  - apps/backend/tests/helpers/attachment-fixtures.ts
  - apps/backend/tests/helpers/fake-clamd-server.ts
  - apps/backend/tests/helpers/fake-object-store.ts
  - apps/backend/tests/helpers/strapi-http-harness.ts
  - apps/backend/tests/http-hardening.integration.test.ts
  - apps/backend/tests/keycloak-provisioning.unit.test.ts
  - apps/backend/tests/questionnaire-generation.integration.test.ts
  - apps/backend/tests/questionnaire-workflow.integration.test.ts
  - apps/backend/tests/request-attachments-scanning.integration.test.ts
  - apps/backend/tests/request-attachments.integration.test.ts
  - apps/backend/tests/security-event-log.unit.test.ts
  - apps/backend/tests/served-operations.integration.test.ts
  - apps/backend/tests/tsconfig.json
  - apps/backend/tests/zip-archive.unit.test.ts
  - apps/backend/types/generated/contentTypes.d.ts
  - apps/csrm/app/(app)/app/requests/[documentId]/edit/page.tsx
  - apps/csrm/app/(app)/app/requests/[documentId]/loading.tsx
  - apps/csrm/app/(app)/app/requests/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/requests/new/page.tsx
  - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/review/requests/[documentId]/loading.tsx
  - apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx
  - apps/csrm/e2e/request-attachments.spec.ts
  - apps/csrm/next.config.ts
  - apps/csrm/playwright.config.ts
  - apps/csrm/proxy.ts
  - apps/csrm/src/components/csrm/confirm-dialog.tsx
  - apps/csrm/src/components/csrm/data-table.test.tsx
  - apps/csrm/src/components/csrm/data-table.tsx
  - apps/csrm/src/components/csrm/navigation-guard.test.tsx
  - apps/csrm/src/components/csrm/navigation-guard.tsx
  - apps/csrm/src/components/csrm/status-badge.test.tsx
  - apps/csrm/src/components/csrm/status-badge.tsx
  - apps/csrm/src/components/shell/app-shell.tsx
  - apps/csrm/src/features/ai-assistance/ai-assistance-domain.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-service.ts
  - apps/csrm/src/features/ai-assistance/ai-generation-facts-schema.ts
  - apps/csrm/src/features/ai-assistance/ai-inputs-changed.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-inputs-changed.tsx
  - apps/csrm/src/features/ai-assistance/ai-run-sheet.test.tsx
  - apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx
  - apps/csrm/src/features/ai-assistance/test-fixtures.ts
  - apps/csrm/src/features/assessments/assessment-draft-job.tsx
  - apps/csrm/src/features/assessments/assessment-request-link.tsx
  - apps/csrm/src/features/assessments/assessment-schema.ts
  - apps/csrm/src/features/assessments/assessment-service.test.ts
  - apps/csrm/src/features/assessments/assessment-service.ts
  - apps/csrm/src/features/assessments/questionnaire-generation-job.tsx
  - apps/csrm/src/features/assessments/request-context-lines.test.tsx
  - apps/csrm/src/features/assessments/request-context-lines.tsx
  - apps/csrm/src/features/attachments/attachments-actions.test.ts
  - apps/csrm/src/features/attachments/attachments-actions.ts
  - apps/csrm/src/features/attachments/attachments-domain.test.ts
  - apps/csrm/src/features/attachments/attachments-domain.ts
  - apps/csrm/src/features/attachments/attachments-schema.ts
  - apps/csrm/src/features/attachments/attachments-service.test.ts
  - apps/csrm/src/features/attachments/attachments-service.ts
  - apps/csrm/src/features/attachments/composer-hand-off.tsx
  - apps/csrm/src/features/attachments/context-too-large-files.test.tsx
  - apps/csrm/src/features/attachments/context-too-large-files.tsx
  - apps/csrm/src/features/attachments/file-ai-control.test.tsx
  - apps/csrm/src/features/attachments/file-ai-control.tsx
  - apps/csrm/src/features/attachments/file-chip.test.tsx
  - apps/csrm/src/features/attachments/file-chip.tsx
  - apps/csrm/src/features/attachments/file-field.test.tsx
  - apps/csrm/src/features/attachments/file-field.tsx
  - apps/csrm/src/features/attachments/file-store.test.tsx
  - apps/csrm/src/features/attachments/file-store.tsx
  - apps/csrm/src/features/attachments/file-text-sheet.test.tsx
  - apps/csrm/src/features/attachments/file-text-sheet.tsx
  - apps/csrm/src/features/attachments/files-list.test.tsx
  - apps/csrm/src/features/attachments/files-list.tsx
  - apps/csrm/src/features/attachments/files-section.test.tsx
  - apps/csrm/src/features/attachments/files-section.tsx
  - apps/csrm/src/features/attachments/files-skeleton.tsx
  - apps/csrm/src/features/attachments/upload-queue-model.ts
  - apps/csrm/src/features/attachments/upload-queue.test.tsx
  - apps/csrm/src/features/attachments/upload-queue.tsx
  - apps/csrm/src/features/contract-response-parity.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-domain.ts
  - apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts
  - apps/csrm/src/features/questionnaires/questionnaire-schema.ts
  - apps/csrm/src/features/questionnaires/questionnaire-service.test.ts
  - apps/csrm/src/features/request-notes/note-composer.test.tsx
  - apps/csrm/src/features/request-notes/note-composer.tsx
  - apps/csrm/src/features/request-notes/note-item.test.tsx
  - apps/csrm/src/features/request-notes/note-item.tsx
  - apps/csrm/src/features/request-notes/notes-domain.ts
  - apps/csrm/src/features/request-notes/notes-section.test.tsx
  - apps/csrm/src/features/request-notes/notes-section.tsx
  - apps/csrm/src/features/request-notes/notes-thread.test.tsx
  - apps/csrm/src/features/request-notes/notes-thread.tsx
  - apps/csrm/src/features/request-notes/unsent-note-well.test.tsx
  - apps/csrm/src/features/request-notes/unsent-note-well.tsx
  - apps/csrm/src/features/requests/request-actions.test.ts
  - apps/csrm/src/features/requests/request-actions.ts
  - apps/csrm/src/features/requests/request-domain.ts
  - apps/csrm/src/features/requests/request-form.test.tsx
  - apps/csrm/src/features/requests/request-form.tsx
  - apps/csrm/src/features/requests/request-hub.test.tsx
  - apps/csrm/src/features/requests/request-hub.tsx
  - apps/csrm/src/features/requests/request-schema.ts
  - apps/csrm/src/features/requests/request-service.test.ts
  - apps/csrm/src/features/requests/request-summary-schema.ts
  - apps/csrm/src/features/requests/request-workflow-actions.tsx
  - apps/csrm/src/features/requests/request-workflow.test.tsx
  - apps/csrm/src/lib/api/conflict-reasons.test.ts
  - apps/csrm/src/lib/api/conflict-reasons.ts
  - apps/csrm/src/lib/api/generated/schema.d.ts
  - apps/csrm/src/lib/api/refusal-copy.test.ts
  - apps/csrm/src/lib/api/refusal-copy.ts
  - apps/csrm/src/lib/api/transport/server-client.test.ts
  - apps/csrm/src/lib/api/transport/server-client.ts
  - apps/csrm/src/lib/files/file-response.test.ts
  - apps/csrm/src/lib/files/file-response.ts
  - apps/csrm/src/lib/files/format-file-size.test.ts
  - apps/csrm/src/lib/files/format-file-size.ts
  - apps/csrm/src/lib/files/save-file.test.ts
  - apps/csrm/src/lib/files/save-file.ts
  - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
  - apps/csrm/src/lib/security/action-body-limit.test.ts
  - apps/csrm/src/lib/security/action-body-limit.ts
  - docs/contract-gaps/phase-14-request-attachments.md
  - docs/design/csrm-design-direction.md
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/served-operations.json
  - docs/references/specification.json
  - docs/security/phase-08-residual-risks.md
  - docs/security/strapi-http-hardening.md
  - pnpm-lock.yaml
findings:
  critical: 3
  warning: 37
  info: 53
  total: 93
status: issues_found
---
# Phase 14: Code Review

## Summary

Phase 14 is reviewed from `e50053f` (`PHASE_14_BASE`, the HEAD before any Phase 14 code) to `d3f265df` (14-17's STATE commit, after the phase gate). The scope is every file the range added, modified or renamed outside `.planning/` (`git diff --name-only --diff-filter=AMR e50053f..HEAD -- . ':(exclude).planning'`): 219 files. The range deletes none.

Seven `gsd-code-reviewer` lanes reviewed the whole scope in parallel. Every lane worked at standard depth, diffed from `e50053f`, read-only, and wrote its own report.
- **Intended behaviour:** every lane read AGENTS.md, Phase 14's CONTEXT.md (D-01 to D-40 and the Orchestrator Confirmations), the approved contract-gap record `docs/contract-gaps/phase-14-request-attachments.md` and the plan summaries for its area. The web lanes also read the 14-UI-SPEC and the design direction.
- **Common focus:**
  - record-level authorisation (404 to everyone but the readers) and downloads only through the authorised operation;
  - private storage, the content allow-list, the 25 MB and 20-file limits and quarantine until a scan passes;
  - the digest check and the hardened download headers;
  - recorded soft removal;
  - the human-analyst-only AI opt-in under the classification ceiling, with file text treated as untrusted data in the prompt;
  - the security event log, the request lock and the closed refusal vocabulary;
  - the AGENTS.md rules, the G-4 premium bar and WCAG 2.2 AA.
- **Large files:** these were reviewed by their Phase 14 diff only: the contract, the catalogue, the served inventory, the generated types (`contentTypes.d.ts`, `schema.d.ts`) and the lockfile. The six binary fixtures were not read.
- **No operator pass.**
- **Read-only throughout:** no lane ran a test suite, a `tsc` build, Playwright, a server or a package manager. The phase gate had already run green (14-17-SUMMARY.md, `## Phase gate`).
- **Lane split:** this follows the pilot's five areas, with Strapi source and web source each split in two because of their size and the security weight of the file pipeline. Lane 1 holds the Strapi API, authorisation and AI context; Lane 2 the file pipeline, storage, scanning and their config; Lane 3 the Strapi tests and harness; Lane 4 the web attachments feature, file responses, the body-limit gate and the routes; Lane 5 the web integrations; Lane 6 the web unit tests and the Playwright spec; Lane 7 the docs, the contract and config.
- **Known items given to every lane:** lanes did not re-report these unless they found a new defect in them.
  - The orchestrator's decisions during execution:
    - D-30's off-only switch for an included file under a refusing AI policy;
    - the list's `meta.total` counts files not removed;
    - the analyst pages' file figures use the human-analyst check;
    - the 14-11 re-opening for WCAG 2.5.8 (`7f42b392`, `cfa23fb5`, `323d1082`).
  - The request read's 403 to an unrelated Requestor (carried to Phase 17, G-12).
  - The Keycloak path static check.
  - The shared Sonner toast's 20 px Close at 375 px.

This file keeps each lane report verbatim, one after another. Each report's frontmatter is merged into the frontmatter above, its title line becomes a level-two heading naming its lane, and its other headings move down one level. Finding IDs keep each lane's hundreds (1xx to 7xx).

| Source | Files | Critical | Warning | Info | Total |
|---|---|---|---|---|---|
| Lane 1 (1xx): Strapi API, authorisation and AI context | 30 | 0 | 3 | 5 | 8 |
| Lane 2 (2xx): Strapi file pipeline, storage, scanning and config | 19 | 1 | 5 | 10 | 16 |
| Lane 3 (3xx): Strapi tests, fixtures and harness | 47 | 0 | 8 | 7 | 15 |
| Lane 4 (4xx): web attachments feature, file responses, body-limit gate and routes | 30 | 2 | 5 | 9 | 16 |
| Lane 5 (5xx): web integrations: AI assistance, assessments, notes, requests, shared components and the API layer | 37 | 0 | 6 | 6 | 12 |
| Lane 6 (6xx): web unit tests, the Playwright spec and playwright.config.ts | 43 | 0 | 5 | 7 | 12 |
| Lane 7 (7xx): docs, the contract and config | 13 | 0 | 5 | 9 | 14 |
| All | 219 | 3 | 37 | 53 | 93 |

The counts are per source and are not deduplicated. A finding that repeats or extends another still counts in its own lane, and the "Overlaps" list below names each one. Lane severities are reviewer claims until they are adjudicated. Nothing is fixed yet (stage A). The dispositions, the pilot's rulings and the stage B fixes go in `14-REVIEW-DISPOSITION.md`.

## Overlaps

**The same defect reported by two lanes** (fix once; disposition both IDs)

- **CR-401 (Lane 4) and WR-601 (Lane 6), the first bypass:** the body-limit gate keys on the `Next-Action` header. Next still parses a multipart POST without that header as a Server Action at the raised 26 MB (`action-body-limit.ts:35`). Lane 6 adds that `action-body-limit.test.ts:56-59` asserts the bypass. The lanes grade it differently: Critical in Lane 4, Warning in Lane 6.
- **CR-402 (Lane 4) and WR-601 (Lane 6), the second bypass:** a `purpose: prefetch` or `next-router-prefetch` header makes the proxy matcher's `missing` rule skip `proxy()`, and the gate with it (`proxy.ts:77-86`). Lane 4 traced the action path through Next 16.3.6; Lane 6 did not confirm it.
- **IN-209 (Lane 2) and WR-705 (Lane 7):** the S3 endpoint accepts plain `http:` (`attachment-config.ts:109`). Lane 7 adds that neither the README nor `.env.example` requires TLS.
- **IN-404 (Lane 4) and WR-604 (Lane 6):** `formatFileSize` rounds megabytes to the nearest tenth, so a file 1 byte over 25 MB reads "Files can be up to 25 MB, and this one is 25.0 MB". Lane 6 adds that the boundary test was loosened so it cannot catch this.
- **WR-305 (Lane 3) and IN-706 (Lane 7):** `.gitattributes:9` marks the whole `fixtures/attachments/` folder binary, README included, so `git grep -I` (14-17's EICAR check) cannot see it. The orchestrator re-ran the check after the review with `git grep --text "ANTIVIRUS-TEST" -- apps`, which reads binary-marked files as text: it found nothing. No EICAR string is committed; the gate's method is what is weak.
- **WR-503 (Lane 5) and IN-606 (Lane 6):** family O's single reason table gives the remove and restore refusals download sentences ("…so it can't be downloaded."). Lane 6 adds that the tests pin that wording.

**Related findings** (one fix may close several; disposition each ID)

- **The body-limit gate's scope and proof:**
  - IN-401 (Lane 4): the 26 MB raise covers every Server Action on the four pages, not only the upload;
  - IN-602 (Lane 6): the E2E "inside" check passes on Next's "action not found" 404 before any body is read.
- **Infected bytes that are never deleted (D-21):**
  - WR-101 (Lane 1): at the 200-event cap the re-scan cannot record a verdict, so a blocked file's bytes stay. Exclusion and removal are refused too.
  - WR-702 (Lane 7): under the README's required S3 versioning a delete only adds a marker, and noncurrent versions are kept for 7 years.
- **ZIP and spreadsheet parsing (D-32):**
  - CR-201 (Lane 2): the ZIP end-record differential lets `read-excel-file`/`fflate` inflate a directory CSRM never validated;
  - WR-201 (Lane 2): `fflate` starts unbounded worker threads even for validated archives;
  - IN-708 (Lane 7): the lockfile pulls in `unzipper-esm` and `worker-f`, which the recorded legitimacy check did not name;
  - IN-306 (Lane 3): the heap-limit test cannot tell a worker that never started from an overrun.
- **Scan before access:** WR-203 (Lane 2) shows that pdf.js parses every PDF before the malware scan, and WR-204 (Lane 2) that the extraction queue is unbounded. R-08-43 covers storing unscanned bytes, not parsing them.
- **The detection name:**
  - WR-501 (Lane 5): the contract pattern rejects underscores, so real ClamAV names such as `Win.Test.EICAR_HDB-1` are dropped;
  - IN-704 (Lane 7): the list's `detection` is not held to the 422's pattern.
- **Refusal copy for AI, remove and restore:** WR-502 (Lane 5), with WR-503 and IN-606 above.
- **Refusal logging and "by any URL":**
  - WR-103 (Lane 1): 404s for foreign ids and the download's state refusals are not security event lines (D-11, D-37);
  - WR-603 (Lane 6): criterion 2 is proven in the browser for page URLs only. No test replays a Server Action under the Secondary Requestor's session.
- **The context loader's filter:**
  - IN-101 (Lane 1): an included file whose stored text is null is skipped silently, while the signal and counts still show it as included;
  - WR-303 (Lane 3): no test covers the loader's "clean and not removed" filter.
- **The AI-inclusion gate in tests and UI:**
  - WR-302 (Lane 3): no mounted test of the dual-role holder at inclusion and preview;
  - WR-308 (Lane 3): the foreign-file refusal snapshots the wrong request;
  - WR-404 (Lane 4): the switch stays operable while a change is pending, so the off-only switch can send an inclusion the policy refuses.
- **Re-scans and timers:**
  - WR-102 (Lane 1): a failed boot-time listing becomes an unhandled rejection;
  - IN-210 (Lane 2): `stop()` cannot abort a running scan, and an upload can wait twice the ClamAV timeout;
  - WR-307 and IN-304 (Lane 3): the fake clamd's size-limit reply timing, and real timers and port reuse in the ClamAV-booted suites.
- **Kept files and leave warnings ("never lose a chosen file"):** WR-401 and WR-402 (Lane 4); WR-504, WR-505, IN-501 and IN-502 (Lane 5).
- **Focus after actions:** WR-403 (Lane 4) and IN-504 (Lane 5).
- **Target size and axe coverage:**
  - WR-405 (Lane 4): the queue row's `X` and the sheet's AI switch fall below the touch-target height;
  - WR-602 (Lane 6): the axe scans were reordered around the shared Sonner toast's 20 px Close at 375 px. This was a known item; Lane 6 grades it a Warning because the phase ships it on every phone inclusion;
  - WR-605 (Lane 6): the pending, blocked and closed states are never scanned.
- **Invisible characters in the name rules:** IN-205 (Lane 2) and IN-403 (Lane 4) find literal invisible characters in the regexes, and the server rule misses other format characters.
- **The contract against the approved record:**
  - WR-701 (Lane 7): the specification changes existing endpoints the record does not list (`failureAttachments`, `requestId` on the run's file entries, the required `files` key on the Requestor's summaries);
  - IN-104 (Lane 1): the record names the column `sha256` (it is `sha_256`);
  - IN-703 and IN-705 (Lane 7).
- **The Media Library residual:** IN-702 (Lane 7) and IN-209 (Lane 2): R-08-44's wording does not match the shipped configuration or S3.
- **The harness environment:** WR-306 and IN-303 (Lane 3): Strapi's `dotenv` can refill deleted variables, and the boot fakes validate against the ambient environment.

## Phase 14: Code Review Report, Lane 1 (Strapi API, authorisation and AI context)

**Reviewed:** 2026-10-11
**Depth:** standard (each file's Phase 14 diff `e50053f..d3f265df`, with call chains followed into `rescan-scheduler.ts`, `request-lock.ts`, `request-notes-policy.ts`, `storage-port.ts`, `send-stored-file.ts`, `extraction.ts`, `attachment-policy.ts` and `clamav-scanner.ts`)
**Files Reviewed:** 30
**Status:** issues_found

### Summary

The record-level authorisation holds on every path I traced. Every handler admits through `admit()` → `canUseRequestNotes(readersRequestFacts, readersCallerFacts)`, so no participant fact can reach the predicate. Another Requestor, the service agent on a request it did not raise, and a missing request all get the same 404. Every attachment lookup filters on `documentId` and `assessmentRequest.documentId` together (`readRequestAttachmentContent`, `setRequestAttachmentRemoval`, `attachmentOnRequest`), so an id from another request is a 404. The upload, removal and restore, AI-inclusion, re-scan and request-delete paths all re-read their facts under `withRequestLock` before writing. The count, the lifetime bound, the window and the note are re-checked under the lock, and bytes stored before a late refusal are deleted.

The AI operations are guarded three ways:
- the catalogue grants (the two copies are byte-identical; the agent holds neither Function, and the Requestor holds only `attachments_api`);
- both literals are in `HUMAN_ANALYST_ONLY_OPERATIONS`;
- the `canUseAttachmentAiInputs` fact (eligible person plus the inclusion held through the human role), with `OWN_REQUEST` as a 403.

Only included, clean, unremoved files with stored text reach the prompt. Each sits in its own escaped `<attachment>` block inside `<requestorData>`, and `promptDataBlock` accepts only code-constant attributes, so no name, person, id or time can enter the prompt. The v3 summary parser is closed (exact keys, digest pattern, the bound per operation, no duplicates, the character totals). The run read names a file only from a record on the run's own request. The security event line is built from an allow-list and never carries a name or text. The content type matches the approved record: no core router, no inverse attribute, and `sha256` stored as `sha_256`.

The defects are in robustness and in places where the code does not do what the decisions say:
1. The event-log cap can permanently stop an analyst from taking a file's text out of the AI inputs.
2. The fire-and-forget boot of the re-scans can crash the process with an unhandled rejection.
3. Refusal logging misses the refusals D-11 requires, including the cross-Requestor probe that criterion 2 is about.

I found no exploitable authorisation flaw.

### Warnings

#### WR-101: The 200-event cap can make an included file's text impossible to exclude or remove, and a pending file's verdict impossible to record

**File:** `apps/backend/src/api/csrm-request-attachment/services/attachment-event-log.ts:135`; `apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts:540-552, 619, 700-709, 758, 802, 967, 982`

**Issue:** Every change appends through `appendAttachmentEvent`, which refuses at the cap:

```ts
if (current.length + 1 > ATTACHMENT_EVENT_LOG_MAX_EVENTS) throw new AttachmentEventLogError();
```

The callers map that to 409 `HISTORY_UNAVAILABLE`, and that includes the changes that take text away from the AI:
- the exclusion (`appendAiInclusionEvent`, lines 700-709, run before extraction at 758 and again under the lock at 802);
- the removal (`appendRemovalEvents` appends `ai-excluded` and `removed`, two events, line 619).

The cap is reachable by an ordinary caller. A Requestor can remove and restore their own file (2 events per cycle), so 1 upload event plus 99 cycles leaves the file active with 199 events. When an analyst then includes it (the 200th event), nobody can ever exclude or remove it: both appends overflow. Its text then goes to every later generation (and to Phases 15 to 17, which reuse the builder). If the analysts' included text is over `ATTACHMENT_CONTEXT_BOUNDS`, every generation fails `CONTEXT_TOO_LARGE`, with no way to fix it in the API.

This contradicts 14-09's own decision ("Exclusion is allowed whatever the policy or the file's state while the window is open, so text can always be taken away from the AI") and G-3's minimisation. A malformed `eventLog` has the same effect.

The same cap stops the re-scan too. Its `clean` and `blocked` appends (lines 967 and 982) throw inside the lock. The scheduler logs a generic failure and retries until 24 attempts, so a pending file whose log is full stays quarantined forever. If it is infected, its bytes are never deleted, contrary to D-21.

**Fix:** Keep headroom so the changes that withdraw text, and the system's verdicts, always fit. Refuse only the changes that add (`restored`, `ai-included`) once the log is within the reserve:

```ts
export const ATTACHMENT_EVENT_LOG_RESERVE = 3; // ai-excluded + removed, or one verdict
const WITHDRAWING: ReadonlySet<AttachmentEventType> = new Set(["ai-excluded", "removed", "scan-verdict", "blocked"]);

export function appendAttachmentEvent(value: unknown, event: unknown): AttachmentEventLog {
  const current = parseAttachmentEventLog(value);
  const appended = parseAttachmentEvent(event);
  const limit = WITHDRAWING.has(appended.type)
    ? ATTACHMENT_EVENT_LOG_MAX_EVENTS
    : ATTACHMENT_EVENT_LOG_MAX_EVENTS - ATTACHMENT_EVENT_LOG_RESERVE;
  if (current.length + 1 > limit) throw new AttachmentEventLogError();
  return { schemaVersion: ATTACHMENT_EVENT_LOG_SCHEMA_VERSION, events: [...current, appended] };
}
```

Add tests: exclusion and removal of an included file at 199 and 200 events, and a re-scan verdict on a pending file at the cap.

#### WR-102: A database error in the boot-time re-scan listing becomes an unhandled rejection that can terminate Strapi

**File:** `apps/backend/src/index.ts:62`; `apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts:1041-1055`; root cause in `apps/backend/src/csrm/files/rescan-scheduler.ts:74-76, 117`

**Issue:** `bootstrap()` fires the re-scans without awaiting them (`void startAttachmentRescans(strapi);`). `startAttachmentRescans` wraps `await scheduler.start()` in try/catch, but `start()` returns `track(work)`, and `track` derives a second promise that nothing handles:

```ts
const track = (work: Promise<void>): Promise<void> => {
  inFlight.add(work);
  void work.finally(() => inFlight.delete(work));   // re-rejects when `work` rejects; unhandled
  return work;
};
```

When `options.listPending()` (`listPendingAttachments`, a Document Service read) rejects, for example on a transient database error at boot, `work` rejects. The `try/catch` handles `work`, but the promise returned by `.finally` rejects with no handler. Node's default (`--unhandled-rejections=throw`) then ends the process. Neither Strapi's core nor `apps/backend/src` installs an `unhandledRejection` handler. So the start that the comment says must never be held up by the re-scans can be brought down by them.

**Fix:** Handle the derived promise in `track`:

```ts
const track = (work: Promise<void>): Promise<void> => {
  inFlight.add(work);
  work.then(() => inFlight.delete(work), () => inFlight.delete(work));
  return work;
};
```

Also attach a final handler at the call site:

```ts
void startAttachmentRescans(strapi).catch(() => strapi.log.error("csrm.attachment_rescan: start failed"));
```

Add a scheduler unit test where `listPending` rejects, asserting that no `unhandledRejection` event fires.

#### WR-103: Refusal logging misses what D-11 and D-37 require, and is inconsistent between operations

**File:** `apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts:401, 470-480, 633, 816, 862-873`; `apps/backend/src/api/csrm-request-attachment/controllers/request-attachments.ts:69`

**Issue:** D-11 says "every refusal is a security event line (D-37)". The implementation leaves out the refusals that matter most for monitoring (ISO/IEC 27001 A.8.16), and is not consistent with itself:
- **The readers-rule 404 is never logged** on list, download, removal, AI inclusion or preview (`admit()` throws before any line, and the services say "a 404 is not logged"). This is exactly another Requestor probing Jane's request, or a foreign attachment id: success criterion 2's attack. Yet the same 404 is logged when it happens under the upload lock (line 401, `throw await refused(strapi, context, error)` for any `RequestAttachmentsError`, the 404 at line 359 included).
- **Download state refusals are not logged.** 409 `ATTACHMENT_QUARANTINED`, `ATTACHMENT_BLOCKED`, `ATTACHMENT_REMOVED` and `ATTACHMENT_UNAVAILABLE` (lines 478-480 and 484) are thrown with no line. The same reasons from removal or AI inclusion are logged (lines 633 and 816). A reader repeatedly fetching a blocked (malware) file leaves no trace.
- **Preview refusals are not logged.** The 403 `OWN_REQUEST`, the 403 for a caller without the AI fact, and the 409 `ATTACHMENT_TEXT_UNAVAILABLE` (lines 865-873) have no line, while the same 403s on `ai_input` are logged.

The 14-06 and 14-07 summaries record "404 not logged" and "other download refusals are not logged" as plan decisions. Both narrow a locked CONTEXT decision without an orchestrator confirmation.

**Fix:** Log one `attachment.refused` line for every refusal after the policy, with `outcome: "refused"` and the reason. For the readers-rule 404, use a closed reason such as `NOT_FOUND`, and name only the requested ids (closed by `IDENTIFIER`). Wrap the download and preview bodies the way removal and AI inclusion are wrapped, so their 409 and 403 refusals go through `refused()`. Make the upload lock path follow the same rule as the others. If the 404 is deliberately not logged, record that exception against D-11 in the contract-gap record and remove the upload path's 404 line.

### Info

#### IN-101: The context loader silently drops an included file whose stored text is null, contrary to its own rule; the signal and counts still treat it as included

**File:** `apps/backend/src/csrm/ai/assessment-context-loader.ts:110`; `apps/backend/src/api/csrm-request-attachment/services/attachment-ai-signal.ts:32-34`

**Issue:** The loader's comment and 14-10's decision say that "an included file that cannot be read as one fails the context rather than being left out". But the query filters on `aiText: { $notNull: true }`, so a damaged record (`aiTextIncluded: true`, `aiText: null`) is left out without a word. Meanwhile `isIncluded` (signal and analyst counts) and the projection (`ai.included: true`) still report it as in the AI inputs, so the hub's "N in the AI inputs" and the signal disagree with what is sent. An empty string does fail the context, a null does not.

**Fix:** Remove the `aiText` filter from the query and let `contextAttachment` throw for a null or empty text. Alternatively, add the same `aiText` predicate to `isIncluded` and to the analyst counts so the three agree.

#### IN-102: Upload bookkeeping after the commit can fail silently, and lock-time refusal lines lose the screened file facts

**File:** `apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts:398-433`

**Issue:**
1. A refusal raised under the lock (line 401) is logged with `refused(strapi, context, error)`, without the type, size and digest that `screen` already holds. The pre-lock screening refusal does pass `screen` (line 350), so the line for a 21st-file race carries less evidence than every other upload refusal.
2. After the lock commits the record, `countAttachments`, `aiViewOf` and `actorOf` (lines 405-407) run before `schedule(...)` (line 420) and the `attachment.uploaded` and `attachment.quarantined` lines. If any of them throws, the client gets a 500 for a file that was stored. A pending file then gets no re-scan until the next start, and no uploaded or quarantined line is written.

**Fix:** Pass `screen` to `refused` in the catch. Schedule the re-scan, and write the two event lines, right after the commit and before any further read, each in its own try/catch.

#### IN-103: D-16's "one predicate" `acceptsAttachments`, and `isActiveAttachment`, are dead; the rule they define is re-implemented elsewhere

**File:** `apps/backend/src/api/csrm-request-attachment/services/attachment-rules.ts:65-70, 155-157`

**Issue:** No production code and no test calls `acceptsAttachments` or `isActiveAttachment` (a repository grep finds only their definitions). The add window is decided by `addRefusalFor` (lines 89-103), and the active count by the query in `countAttachments` (`request-attachments.ts:133`). So the window and "active" each have two definitions that can drift, which is the risk D-16's single predicate exists to prevent.

**Fix:** Either make `addRefusalFor` call `acceptsAttachments` for its window and caller decision, and test that `isActiveAttachment` agrees with the count query's filter, or delete both exports.

#### IN-104: The approved contract-gap record still names the column `sha256`

**File:** `docs/contract-gaps/phase-14-request-attachments.md:378` (the schema is `apps/backend/src/api/csrm-request-attachment/content-types/csrm-request-attachment/schema.json:17`)

**Issue:** Strapi snake-cases `sha256` to the column `sha_256` (14-06's decision, pinned by `request-attachments.integration.test.ts:111-114`). The approved record's Migration proof list still says `sha256`, and the R-08-37 PostgreSQL checklist will be built from it. The attribute name is correct; only the record's column name is now wrong.

**Fix:** Amend the record's Migration bullet to `sha_256`, with a dated note that the attribute is unchanged.

#### IN-105: The upload answer projects actions against the request read before the lock

**File:** `apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts:405-406`

**Issue:** `projectAttachment(created, { caller, request, activeCount }, await aiViewOf(strapi, request, caller))` uses `request` from `admit()`, not the `current` that the lock re-read. The removal path uses `outcome.current` (line 637). If the request changed status in between (returned to draft, or released), the 201's `actions.remove` and `ai.canChange` can contradict the server's rules until the next read.

**Fix:** Return `current` from the lock callback along with the created record, and project against it, as `setRequestAttachmentRemoval` does.

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer), Lane 1_
_Depth: standard_

## Phase 14: Code Review Report, Lane 2 (Strapi file pipeline, storage, scanning and config)

**Reviewed:** 2026-10-11
**Depth:** standard, with call chains followed into the installed `read-excel-file` 9.3.10, `fflate` 0.8.3, `@strapi/upload` 5.51.0, `@strapi/provider-upload-aws-s3` 5.51.0 and `@strapi/core` 5.51.0 body middleware
**Files Reviewed:** 19
**Status:** issues_found

### Summary

Most of the pipeline holds up. The CSRM ZIP reader checks the central directory before it inflates anything, with bounds on entries, ratio, total size, overlaps, duplicates, ZIP64 and encryption. The OOXML tokenizer refuses DTDs. Screening fails closed. The ClamAV adapter treats limits replies as "not scanned". The storage port validates keys before it touches the disk. The S3 block sends no ACL header, uses SSE-KMS and refuses a `baseUrl`. The download hashes the bytes before it sends any. The multipart cleanup sits directly after `strapi::body`. Boot validation rejects the development double outside the development key.

The serious defect is in the hand-off from CSRM's validated archive to `read-excel-file`. That library unzips through `fflate`, which picks a different end-of-central-directory record than CSRM does. A crafted `.xlsx` can therefore pass every CSRM bound and still make `fflate` inflate a central directory CSRM never read. The memory this uses is outside the worker's heap limit, and the inflation runs in extra worker threads that have no limits at all. The other main concerns:
- extraction and probe workers inherit a copy of `process.env`, secrets included;
- pdf.js parses unscanned bytes before the malware scan runs;
- the single extraction queue has no bound, and a Requestor can starve it with refused PDFs that are never stored;
- Office active content beyond VBA is not refused.

ISM-2059 (quarantine stores unscanned bytes) and the reverse-proxy body limits (R-08-04) are accepted residuals and are not re-reported here.

### Critical Issues

#### CR-201: Parser differential in the ZIP end record. `read-excel-file` inflates a central directory CSRM never validated, and D-32's ZIP-bomb bounds and DOCTYPE refusal are bypassed

**File:** `apps/backend/src/csrm/files/zip-archive.ts:84-92`, `apps/backend/src/csrm/spreadsheets/xlsx-reader.ts:61-92`, `apps/backend/src/csrm/files/extraction-worker.ts:103`

**Issue:** The two readers choose the end-of-central-directory (EOCD) record differently.

CSRM's `findEndRecord` accepts only the EOCD whose comment ends the buffer exactly. It skips every other signature:
```ts
for (let offset = buffer.length - END_LENGTH; offset >= lowest; offset -= 1) {
  if (buffer.readUInt32LE(offset) !== END_SIGNATURE) continue;
  if (offset + END_LENGTH + buffer.readUInt16LE(offset + 20) === buffer.length) return offset;
}
```
`readWorkbookSheets` then hands the same bytes to `read-excel-file` (`readXlsxFile(input.buffer, …)`, line 92). That library unzips with `fflate.unzip`, which takes the first signature it finds scanning back from `length - 22` and never checks the comment length (`node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs:2590-2596`):
```js
var e = data.length - 22;
for (; b4(data, e) != 0x6054B50; --e) { if (!e || data.length - e > 65558) { … } }
var lft = b2(data, e + 8); … var o = b4(data, e + 16);
```
`fflate` also follows a ZIP64 locator found at that record (lines 2602-2609), which CSRM refuses.

**The attack:** the real EOCD carries a comment of 22 bytes or more. The last 22 bytes of that comment are a fake EOCD whose own comment-length field is non-zero.
- CSRM skips the fake record, because its comment does not end the buffer, and validates the real, benign directory. The content check passes (main type `…spreadsheetml.sheet.main+xml`). `readWorkbookSheets` checks only the real directory's parts against the 128 MiB bound, CRC-32 and the DOCTYPE rule.
- `fflate` uses the fake record. Its central directory can sit in the comment or in any gap between entries. It can list up to 65,535 `*.xml` entries, each declaring up to 4 GiB, all pointing at one deflate-bomb stream. `fflate` does not check for overlapping entries.

**What happens next:** for each such entry, `fflate` starts a new `worker_threads` Worker with `{ eval: true }` and no `resourceLimits` (`index.mjs:24`, `2647`). Each one allocates `new u8(su)` (`gopt`, `index.mjs:913-916`) and inflates into it. Typed-array memory is external, so the extraction worker's `maxOldGenerationSizeMb: 768` does not bound it. The `ZIP_EXTRACTION_MAX_INFLATED` bound (128 MiB) never applies to these entries. The Strapi process exhausts memory and threads within the 30 s wall clock and is OOM-killed, taking the whole API down.

**Who can trigger it:** a Requestor uploads the file, and the attack runs when any Security Analyst opts it into the AI context. A Requestor is any authenticated user, by birthright.

**Scope:** the 14-02 SUMMARY deviation 7 relies on "every part read-excel-file inflates is bounded", which is false under this differential. The xlsx-reader header says Phase 19's imports will reuse the reader, and that path will be triggered directly by the uploader. The same ambiguity also means Office may open a different package than the one the content check approved.

**ClamAV:** in production, a correctly limited `clamd` may flag the file incidentally, because its unzip also scans from the end. That is configuration-dependent. It is not D-32's control, and the development double never parses archives.

**Fix:** remove the ambiguity in the reader, and stop giving the library raw bytes.
```ts
// zip-archive.ts, in readZipDirectory after findEndRecord: Office never writes an archive comment, so require none.
// The accepted record is then at length - 22, where fflate (and ClamAV) begin their scan, so all readers agree.
if (buffer.readUInt16LE(end + 20) !== 0) throw new ZipArchiveError("ZIP_MALFORMED", "archive comment");
```
Also, in `readWorkbookSheets`, rebuild a canonical archive from the parts CSRM has already inflated and verified. Give it method 0 (stored), no comment and no extra fields, and pass that to `readXlsxFile` instead of `bytes`. `fflate` then takes its synchronous `slc` path: no inflation and no workers (see WR-201). Add a unit test that builds the fake-EOCD archive and asserts `ZIP_MALFORMED`.

### Warnings

#### WR-201: XLSX extraction starts unlimited worker threads, so D-32's heap isolation does not hold even for validated archives

**File:** `apps/backend/src/csrm/spreadsheets/xlsx-reader.ts:87-92`, `apps/backend/src/csrm/files/extraction.ts:126-132`

**Issue:** `read-excel-file/universal` calls the asynchronous `fflate.unzip`. For every part of at least 512 KiB with `sc <= 0.8 * su`, that starts a new Worker (`fflate/esm/index.mjs:2638-2647`, `wk` at line 24) without `resourceLimits`.

Within CSRM's own 128 MiB bound, a validated workbook can hold about 256 such parts. That means up to 256 simultaneous V8 isolates, each with a default heap ceiling, nested inside the extraction worker. Their memory and threads count against the Strapi process, not against the 768 MB limit that `runWorker` sets. "Extraction runs in a worker thread with memory and time limits" (D-32) is therefore not true for XLSX. The inflated output is also held twice: once by CSRM's verification pass and once by `fflate`.

**Fix:** use the CR-201 fix. Feed `read-excel-file` a re-packed archive of stored (method 0) entries, which `fflate` copies synchronously in the extraction worker, so no nested workers start. If that is not acceptable, call the library's lower-level parsing with the part map CSRM has already inflated. Add a test that counts `worker_threads` creation during an XLSX extraction.

#### WR-202: Extraction and PDF-probe workers inherit Strapi's environment, secrets included, while they parse hostile files

**File:** `apps/backend/src/csrm/files/extraction.ts:126-132`

**Issue:**
```ts
worker = new Worker(WORKER_PATH, { workerData: request, transferList: [request.bytes],
  resourceLimits: { maxOldGenerationSizeMb: heapMb }, stdout: true, stderr: true });
```
No `env` option is passed, so Node gives the worker a copy of `process.env`. That includes database credentials, `APP_KEYS`, JWT and API-token salts, AI provider keys and S3 credentials. A worker thread also has the full Node API (`fs`, `net`, `child_process`). It is a resource boundary, not a privilege boundary.

The worker runs pdf.js, `read-excel-file`/`saxen`/`fflate` and CSRM's own parsers on attacker-supplied bytes. A future script-execution bug like CVE-2024-4367 in any of these would get the secrets and the network directly. `isEvalSupported: false` closes only that one known vector.

**Fix:** pass `env: {}` (and `execArgv: []`) to the Worker, and set `process.env` to nothing the worker needs. Add a unit test asserting that `process.env` inside the worker holds no `DATABASE_*`, `APP_KEYS` or `*_SECRET` keys. Record in the residual register that worker isolation is resource-only.

#### WR-203: pdf.js parses every uploaded PDF before the malware scan, contrary to "scan before it is accessed"

**File:** `apps/backend/src/csrm/files/screen-attachment.ts:67-72`

**Issue:**
```ts
const content = await checkAttachmentContent({ fileName: name, bytes: input.bytes }, { probePdf: dependencies.probePdf ?? probePdfInWorker });
if (!content.ok) return { outcome: "refused", … };
…
const verdict = await scanFailClosed(dependencies.scanner, input.bytes, dependencies.signal);
```
The order is "cheapest refusal first", but the PDF open check, a full pdf.js parse in the extraction worker, is the riskiest step and runs on bytes no scanner has seen. D-09 cites the ASD ISM basis "content is scanned before it is accessed".

The accepted ISM-2059 residual covers *storing* unscanned bytes in quarantine when the scanner is down. It does not cover *parsing* them with a large third-party parser on every upload. Together with WR-202, a parser exploit runs pre-scan with Strapi's secrets.

**Fix:** keep the cheap signature, ZIP and text checks first. Run the malware scan before `probePdf`, and call `probePdf` only when the verdict is `clean`. For `not-scanned`, defer the PDF open check to the re-scan that releases the file. Add a test asserting the order: the scanner is called before `probePdf`.

#### WR-204: The single extraction queue has no bound, and refused PDFs cost the uploader nothing, so one Requestor can starve all PDF uploads and all AI extraction

**File:** `apps/backend/src/csrm/files/extraction.ts:93-100,174-179`, `apps/backend/src/csrm/files/screen-attachment.ts:67`

**Issue:** `exclusively()` chains every probe and extraction onto one global promise, with no depth limit:
```ts
const run = queueTail.then(task, task);
queueTail = run.then(() => undefined, () => undefined);
```
Each upload of a `.pdf` waits for a 10 s probe slot (`pdfProbeMs`). A PDF crafted to keep pdf.js busy until the timeout is answered `invalid` and refused as `ATTACHMENT_CONTENT_MISMATCH`. Refused files are never stored, so they count toward neither the 20-active nor the 60-stored bound.

An authenticated Requestor, on any of their drafts, can therefore keep the queue full indefinitely:
- every other user's PDF upload waits behind them and times out at the proxy or Server Action;
- every analyst's AI inclusion, which shares the queue for its 30 s extraction, does the same;
- each queued upload holds its 25 MiB buffer in memory while it waits.

This is resource exhaustion driven by crafted files.

**Fix:**
- Bound the queue (for example 4 waiting tasks) and refuse beyond it with a retryable closed reason (`ATTACHMENT_BUSY`, 503) instead of waiting.
- Give probes and extractions separate slots, so uploads cannot starve AI inclusion.
- Count refused screening attempts per user in the security event log and rate-limit them (for example N refusals per minute).

#### WR-205: Office active content beyond VBA is accepted: external OLE/template relationships, ActiveX and Excel 4.0 macro sheets

**File:** `apps/backend/src/csrm/files/ooxml-text.ts:209-223`, `apps/backend/src/csrm/files/content-check.ts:148-164`

**Issue:** `ooxmlMainPart` flags macros only through `vbaProject.bin`, the `application/vnd.ms-office.vbaproject` content type and a `macroEnabled` main type. A macro-free `.docx` can still carry code-execution vectors:
- **External relationships.** For example `word/_rels/document.xml.rels` with `Type=".../oleObject" TargetMode="External" Target="http://…!"`, which is the Follina vector (CVE-2022-30190). Another is `settings.xml.rels` `attachedTemplate` pointing to a remote `.dotm`, which is remote template injection.
- **ActiveX parts** (`application/vnd.ms-office.activeX+xml`).
- **XLM macro sheets in an `.xlsx`** (`application/vnd.ms-excel.macrosheet+xml`, `…intlmacrosheet+xml`).

These packages pass as "allowed, not macro-enabled", and analysts are the people who download and open them. D-09's intent behind refusing macro-enabled files is "no active code in an accepted Office file". ClamAV coverage of these techniques is signature-dependent.

**Fix:** extend `ooxmlMainPart`, or add a sibling check that reads every `*.rels` part through the bounded `PartReader` budget. Refuse with `ATTACHMENT_MACRO_ENABLED`, or a new closed reason such as `ATTACHMENT_ACTIVE_CONTENT`, when:
- any `Relationship` has `TargetMode="External"` with a type ending `/oleObject`, `/attachedTemplate`, `/frame` or `/subDocument`;
- any content type matches `/activex|macrosheet|vbaproject|vbadata/i`.

Add fixtures for each case.

### Info

#### IN-201: The per-file text cap has two sources of truth

**File:** `apps/backend/src/csrm/files/extraction.ts:36`, `apps/backend/src/csrm/files/attachment-policy.ts:56`

**Issue:** `EXTRACTION_TEXT_CAP = 20_000` duplicates `ATTACHMENT_LIMITS.textCapCharacters`. The service passes the policy value explicitly, so the two can drift silently.

**Fix:** define `EXTRACTION_TEXT_CAP` as `ATTACHMENT_LIMITS.textCapCharacters`, or import it.

#### IN-202: ZIP bound refusals (ratio, entries, size) are reported as "content does not match the name"

**File:** `apps/backend/src/csrm/files/content-check.ts:150-154`, `apps/backend/src/csrm/files/zip-archive.ts:57-61,178-180`

**Issue:** Every refusal from `readZipDirectory` other than `ZIP_ENCRYPTED` maps to `ATTACHMENT_CONTENT_MISMATCH`. A genuine `.xlsx` with one very repetitive part (above 200:1, which the 14-02 SUMMARY's own test data hit) is refused with copy telling the person the file is not what its name says. That copy is wrong and gives no next step.

**Fix:** map `ZIP_RATIO`, `ZIP_TOO_MANY_ENTRIES` and `ZIP_TOO_LARGE` to a distinct closed reason, for example `ATTACHMENT_UNSUPPORTED_STRUCTURE`, with its own copy. Consider measuring real-world ratios before keeping 200.

#### IN-203: The OOXML check does not prove the main part exists, so any ZIP payload with a one-line `[Content_Types].xml` is accepted as DOCX, XLSX or PPTX

**File:** `apps/backend/src/csrm/files/ooxml-text.ts:209-223`

**Issue:** Only the declared `ContentType` is compared. The Override's `PartName` is not resolved to an entry, and `_rels/.rels` (the `officeDocument` relationship) is not checked. A ZIP holding arbitrary files plus a 200-byte `[Content_Types].xml` passes as `report.docx`. This matches D-09's wording, but it makes "checked by content" weak.

**Fix:** require the Override `PartName` of the main type to name an existing entry (case-insensitive), and require `_rels/.rels` to point to it.

#### IN-204: Duplicate part names are compared case-sensitively, but OPC part names are case-insensitive

**File:** `apps/backend/src/csrm/files/zip-archive.ts:173-174`, `apps/backend/src/csrm/files/ooxml-text.ts:199-201`

**Issue:** `names.has(name)` and `findZipEntry` are exact-match. An archive containing both `[Content_Types].xml` and `[CONTENT_TYPES].XML` passes. CSRM reads the first, while an OPC consumer may resolve either one, which is another parser differential.

**Fix:** keep a set of `name.toLowerCase()` and refuse case-insensitive duplicates as `ZIP_MALFORMED`.

#### IN-205: The name rule misses other invisible and format characters, and the regex holds literal invisible characters

**File:** `apps/backend/src/csrm/files/attachment-policy.ts:88-90`

**Issue:** The character class contains raw U+200E, U+200F, U+061C, U+202A-U+202E and U+2066-U+2069 bytes. The class is correct, but these characters are invisible in review (the repository's injection scanner flags this line). The rule does not remove:
- zero-width characters (U+200B-U+200D, U+2060, U+FEFF inside a name);
- line and paragraph separators (U+2028, U+2029);
- interlinear annotation characters (U+FFF9-U+FFFB);
- tag characters (U+E0000 block).

Windows reserved stems (`CON`, `NUL`, `COM1` and so on) and trailing dots or spaces before the extension are also kept. These matter only for display and download names, but the lane brief lists them.

**Fix:** write the class with `\u` escapes and widen it, for example `/[\p{Cc}\p{Cf}  ￹-￻]/gu`. Optionally prefix reserved device stems with `_`.

#### IN-206: The text rule refuses legitimate text that starts with "MZ"

**File:** `apps/backend/src/csrm/files/content-check.ts:24,47`

**Issue:** `EXECUTABLES` includes the two-byte prefix `4D 5A`. A TXT or CSV starting with "MZ" (for example "MZ Holdings report" or `MZ,Mozambique`) is refused as a content mismatch. A real PE file is never valid UTF-8 anyway.

**Fix:** check `MZ` only together with a non-UTF-8 body, or check for `MZ` plus a valid `e_lfanew` and `PE\0\0` header. Keep the ELF check, because `\x7F` is valid UTF-8.

#### IN-207: The xlsx DOCTYPE check is weaker than "tokenizeXml's rule" that it claims to mirror

**File:** `apps/backend/src/csrm/spreadsheets/xlsx-reader.ts:47-48,78-82`

**Issue:** The xlsx check uses `/<!(DOCTYPE|ENTITY)/i` on a `toString("utf8")` decode. `ooxml-text.ts` uses `/<!\s*(?:DOCTYPE|ENTITY)/i` after a BOM-aware UTF-16 or UTF-8 decode. A UTF-16 part slips past this check. It is not exploitable today, because `saxen` never expands declared entities, but the comment overstates the guarantee.

**Fix:** reuse `decodeXml` and `DTD_DECLARATION` from `ooxml-text.ts`, exporting them.

#### IN-208: `zlib.crc32` needs Node 22.2 or later, but the backend's engine range admits 22.0

**File:** `apps/backend/src/csrm/files/zip-archive.ts:231`

**Issue:** `apps/backend/package.json` declares `"node": ">=22.0.0 <=26.x.x"`. On 22.0 or 22.1, `zlib.crc32` is undefined and the call throws a `TypeError`. Every Office upload is then refused as a content mismatch, and every DOCX, PPTX or XLSX extraction is unavailable. The root `package.json` pins 24.19 or later, so this only matters if the backend runs standalone.

**Fix:** raise the backend engine floor to `>=22.2.0`, or guard `zlib.crc32` with a clear boot failure.

#### IN-209: Private storage hardening: file modes, an unbounded local read, and an `http:` S3 endpoint

**File:** `apps/backend/src/csrm/files/private-local-provider.ts:74-76`, `apps/backend/src/csrm/files/storage-port.ts:102,196-197`, `apps/backend/src/csrm/files/attachment-config.ts:91,109`

**Issue:**
- **File modes:** `mkdir` and `writeFile` use the default modes, so under umask 022 the attachments are world-readable (0644) to other users on the host.
- **Unbounded local read:** the local `read` uses `readFile` with no size bound, while the S3 path enforces 25 MiB.
- **`http:` endpoints:** `presignedUrl` and the endpoint validation accept `http:`, so an S3-compatible store can be reached in cleartext, with the bytes and the SigV4 query in transit.
- **The `public/` check:** it uses a hard-coded `<appRoot>/public`, not `strapi.dirs.static.public`, and compares case-insensitively only on Windows. That leaves a gap on macOS's case-insensitive filesystem.
- **Media Library under S3:** `ACL: undefined` makes the S3 provider's `isPrivate()` return false. The upload plugin therefore never signs Media Library URLs, so the recorded residual "administrators still see attachment files in the Media Library" is inaccurate for S3. They see broken links.

**Fix:**
- write files with `{ mode: 0o600, flag: "wx" }` and create the directory with `mode: 0o700`;
- `stat` the file and refuse a size above 25 MiB before reading;
- require `https:` outside development;
- compare against `strapi.dirs.static.public` with a case-folded comparison on darwin too;
- correct the residual's wording.

#### IN-210: ClamAV and re-scan timing: `timeoutMs` is not the whole bound, and stop() cannot abort a scan

**File:** `apps/backend/src/csrm/files/clamav-scanner.ts:158-174`, `apps/backend/src/csrm/files/rescan-scheduler.ts:126-131`

**Issue:**
- **Two timed exchanges:** `scan()` runs an uncached `zVERSION` exchange, then `zINSTREAM`, each with its own full `timeoutMs`. The option is documented as "the whole exchange's bound", but an upload can wait up to twice that (120 s at the default, 20 minutes at the maximum).
- **No caching on failure:** a failed VERSION exchange is not cached, so while `clamd` is down every scan pays two connect timeouts.
- **stop() waits:** `stop()` awaits re-scans in flight, but `rescanAttachment` calls `scanner.scan(bytes)` without an `AbortSignal`. A Strapi shutdown can therefore hang for the full scan timeout.
- **Plain TCP:** the adapter speaks unauthenticated TCP to `clamd`. A spoofed `stream: OK` releases a file, so the README should require loopback or a private network.

**Fix:**
- share one deadline across both exchanges, or fetch VERSION after INSTREAM;
- cache the fallback engine name for a short time;
- give the scheduler an `AbortController` that `stop()` aborts and that `rescanAttachment` passes to `scan()`;
- document the network requirement.

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer), Lane 2_
_Depth: standard_

## Phase 14: Code Review Report, Lane 3 (Strapi tests, fixtures and harness)

**Reviewed:** 2026-10-11
**Depth:** standard (each file's `git diff e50053f..d3f265df`, plus the code under test where a test's claim depended on it)
**Files Reviewed:** 47 (binary fixture contents skipped; described through the README and the builders)
**Status:** issues_found

### Summary

The Phase 14 Strapi test suite is broad and mostly strict. Most refusal tests check the status, the closed reason, persistence across the whole database (attachment rows, plugin file records, stored files) and the security event line. The fakes listen on 127.0.0.1 only. The harness pins both Keycloak flags to false, the deterministic AI provider, the development scanner and a per-process storage directory, and the S3 boot gets dummy credentials with IMDS disabled. I found no harness path that can reach a real AWS, ClamAV, Keycloak or hosted-model endpoint. I also found no live authorisation defect hidden by a test gap: the controls I traced (the service's `caller.aiInputs` gate, the loader filter, the lock) are present in the code.

The weaknesses are tests that cannot fail for what they claim, and locked decisions with no mounted proof:
- The count race cannot detect a missing lock on SQLite.
- No mounted test covers the dual-role holder at the AI operations.
- No test covers the context loader's "clean and not removed" filter.
- The temporary-file test probes only refused requests, although its title claims both refused and accepted ones.
- The EICAR grep gate cannot see the fixture folder.
- The harness's "cleared" variables can be refilled from `apps/backend/.env`.
- The fake clamd never sends clamd's mid-stream size-limit reply.
- One AI refusal's snapshot misses the record it targets.

The `keycloak-provisioning.unit.test.ts` change still proves that Keycloak writes nothing: the filter drops only the attachment summary line, and info and error are still compared. It now depends on the ambient attachment environment, though (IN-303).

### Warnings

#### WR-301: The count race passes on SQLite whether or not uploads go through `withRequestLock`, and restoring at 19 has no race test

**File:** `apps/backend/tests/request-attachments.integration.test.ts:525-548` (with `apps/backend/tests/helpers/strapi-http-harness.ts:1536-1545`)
**Issue:** The test fires two `fetch` uploads with `Promise.all` (`simultaneousRequests`) and checks the result: 20 rows, one 409 `ATTACHMENT_LIMIT_REACHED`, the late file's bytes deleted. On SQLite, Strapi's single connection serialises every transaction (`request-lock.ts`'s own header says so). So if the upload's final count and insert ran in a plain `strapi.db.transaction` without `withRequestLock`'s in-process tail and `FOR UPDATE`, the test would still pass, even though PostgreSQL would then allow 21.

14-06-SUMMARY line 292 confirms this: "The race test passed at Task 2 RED … On SQLite it proves that outcome, not the lock." The VALIDATION row "D-10 (race)" and threat T-14-21 nonetheless cite this test as the proof.

The interleaving is also left to the event loop: nothing forces both requests to read 19 before either inserts. No test races a restore at 19 against an upload, although `canRestoreAttachment`'s limit is the same invariant.
**Fix:** Add a deterministic hold, as the harness already does with `withHeldAiContext`. Give the harness a hook that pauses the first upload inside the request lock, after `countAttachments`. Fire the second upload. Assert that it has not reached its own count while the first is held. Release the first, then assert the 201 and the 409. Add the same probe for a restore racing an upload at 19. Keep the current test as the end-to-end check, and change its comment and the VALIDATION row so they no longer cite it as proof of the lock (R-08-37 holds the PostgreSQL half).

#### WR-302: No mounted test covers the dual-role holder at the AI inclusion and preview, so removing the service's only gate would not fail any test

**File:** `apps/backend/tests/attachment-ai-input.integration.test.ts:219-240`, `apps/backend/tests/authorization-policy.unit.test.ts:742-756`
**Issue:** The unit test proves that the policy admits a holder of both the Security Analyst and the Security Analyst Agent roles to `PUT …/ai_input` and `GET …/ai_text` (`dual.allowed === true`), and that it sets `canUseAttachmentAiInputs: false`. After that, the only barrier is the service: `request-attachments.ts:748` and `:865` (`if (caller.aiInputs !== true) throw … 403`).

The mounted tests cover only Jane, the other Requestor and the service agent. All three are refused earlier, by the policy (no grant), so they never reach those lines. The requesting analyst is refused by `aiInputRefusalFor` (`OWN_REQUEST`). If either service line were deleted, a dual-role automation identity could include file text and read it back, and no test would fail.

Phase 13 has the equivalent mounted proof for notes (`request-notes.integration.test.ts:716-729`, `dual-role-notes`). Phase 14 does not.
**Fix:** In `attachment-ai-input.integration.test.ts`, register a dual-role identity the Phase 13 way (`harness.createUserFixture` with both roles, then `harness.registerTestIdentity`). On a submitted request that has a file, assert that `PUT …/ai_input` (both `true` and `false`) and `GET …/ai_text` answer 403, that `persisted(requestId)` is unchanged, and that no text appears in the body. Also assert that this caller's list carries no `ai` key and no `aiPolicy`.

#### WR-303: No test covers the context loader's "clean and not removed" filter, so a quarantined, blocked or removed file still marked included could reach the provider unseen

**File:** `apps/backend/tests/attachment-ai-input.integration.test.ts:579-607`, `apps/backend/tests/assessment-context.unit.test.ts` (Phase 14 block); code under test `apps/backend/src/csrm/ai/assessment-context-loader.ts:110`
**Issue:** The loader selects `aiTextIncluded = true AND scanStatus = 'clean' AND removedAt IS NULL AND aiText IS NOT NULL`. The only provider-level proof of "excluded files never reach the provider" uses a file that was never included (the data-flow DOCX).

`git grep "aiTextIncluded: true" apps/backend/tests` shows no test that sets a file included and then pending, blocked or removed, and builds the context. The removal test (`request-attachments.integration.test.ts:1029`) checks the stored flags only; it never builds a context. Two of the loader's four conditions could therefore be deleted with every test still green. The success criterion "quarantined/removed files never included" would then rest on the write paths alone, with nothing checking the read path.

`attachment-ai-signal.unit.test.ts:71` does assert this behaviour, but for the signal only, not for the loader.
**Fix:** Add a mounted case. Upload and include two text files. Use `updateFixtureDocument` to make one `pending` and the other `removedAt` set, both keeping `aiTextIncluded: true` and their `aiText`; add a third, `blocked`, set the same way. Call `buildAssessmentContextFixture` and assert that none of their texts or `documentId`s appear in `userPrompt` or in `summary.attachments.included`.

#### WR-304: The temporary-file test claims to cover accepted requests too, but every probe is a refusal

**File:** `apps/backend/tests/http-hardening.integration.test.ts:295-315`
**Issue:** The title is "no multipart temporary file survives a request, whatever the part name and whether the caller was refused". All three probes are refused: two to the unmounted `/api/upload` (405) and one CSV import refused by the policy. The loop also asserts `response.status >= 400`, so an accepted probe could not be added without failing.

The `request-attachments.integration.test.ts:606` check also runs only on refusals. No test checks the OS temporary directory after a 201 upload. That is the path that handles real user files (D-11: "formidable's temporary file is always deleted"; 14-04-02: "no temporary file survives a request, refused or not").
**Fix:** Add an accepted probe: upload a `PROBE_PART_BYTES`-sized `.txt` to a fresh draft's `…/attachments` as the owner. Assert 201, then assert `temporaryProbeFiles(since)` is empty. Change the loop's assertion to the expected status per probe.

#### WR-305: The EICAR grep gate cannot see the attachment fixtures, because `.gitattributes` marks the whole folder binary and the gate uses `git grep -I`

**File:** `apps/backend/tests/fixtures/attachments/README.md:10` (the `.gitattributes` claim), `.gitattributes:9` (`apps/backend/tests/fixtures/attachments/** binary`)
**Issue:** The phase gate's EICAR check (14-VALIDATION, "EICAR grep": `test -z "$(git grep -n -I 'ANTIVIRUS-TEST' -- apps)"`) skips every file git treats as binary. `**` covers every file in the folder, the README included, and those are exactly the committed files most likely to carry a test string.

I confirmed the gate is blind there: `git grep -n -I "Attachment fixtures" -- apps/backend/tests/fixtures/attachments` returns nothing, while the same command without `-I` reports `Binary file …/README.md matches`. A fixture holding the string in clear would pass the gate.

The byte-equality test (`attachment-extraction.unit.test.ts:410`) ties the six known fixtures to the text builders, but not a seventh file. The README is also hidden as "Bin" from every diff and review.
**Fix:** Run the gate with `git grep -n -a -E 'EICAR-STANDARD|ANTIVIRUS-TEST' -- apps`, without `-I` (I ran it with `-a` and it found nothing today). Narrow the attribute to the binary types (`apps/backend/tests/fixtures/attachments/*.{pdf,docx,xlsx,pptx,png,jpg} binary`) so the README stays text. Optionally add a unit test that reads every file in the folder and asserts it does not contain the decoded EICAR prefix.

#### WR-306: The harness "clears" attachment and AWS variables by deleting them, but Strapi's own `dotenv.config()` runs afterwards and can refill them from `apps/backend/.env`

**File:** `apps/backend/tests/helpers/strapi-http-harness.ts:715-746`
**Issue:** The comment says "Every attachment variable is pinned or cleared … so a developer's .env never changes an outcome". The harness deletes all 18 variables in `ATTACHMENT_ENVIRONMENT` (line 720) and only then calls `require("@strapi/strapi")` (line 746). Loading `@strapi/core/dist/configuration/index.js` runs `dotenv.config({ path: process.env.ENV_PATH })` at module evaluation. With `ENV_PATH` unset, that reads `.env` from the working directory (`apps/backend`), and dotenv fills every variable that is unset.

So any deleted variable the developer's `.env` sets comes back. That includes `CSRM_ATTACHMENT_S3_REGION`, `CSRM_ATTACHMENT_S3_ENDPOINT`, `CSRM_CLAMAV_TIMEOUT_MS` (when a test passes no `timeoutMs`), `AWS_SESSION_TOKEN`, `AWS_PROFILE`, `AWS_ENDPOINT_URL` and `AWS_ENDPOINT_URL_S3`. Only the variables the harness sets to a value are really pinned.

I found no path to a real AWS endpoint today: the explicit `endpoint` and the env credentials take precedence, and `AWS_EC2_METADATA_DISABLED=true` is set. But the isolation the comment claims does not hold, and a refilled `AWS_SESSION_TOKEN` would be sent to the fake.
**Fix:** Set the cleared variables to `""` rather than deleting them. Dotenv never overrides an existing key, and `attachment-config.ts`'s `setting()` already reads `""` as unset. Alternatively, point `process.env.ENV_PATH` at a non-existent file inside the harness before the `require`, and restore it on close. Then assert in a harness self-test that `process.env.AWS_SESSION_TOKEN` and the cleared `CSRM_*` keys are empty after boot.

#### WR-307: The fake clamd answers "size limit exceeded" only after the terminator, so the real clamd behaviour (reply mid-stream, then close) is never tested

**File:** `apps/backend/tests/helpers/fake-clamd-server.ts:13`, `:61`, `:105-121`; used by `apps/backend/tests/attachment-scanner.unit.test.ts` ("size-exceeded")
**Issue:** A real clamd checks `StreamMaxLength` per chunk. As soon as the stream exceeds it, clamd writes `INSTREAM size limit exceeded. ERROR` and closes, while the client is still writing. The adapter has a dedicated path for this: `clamav-scanner.ts` `exchange()` comment, "A reply that arrived before the connection failed is still read, because clamd answers a stream over its limit and then closes while the client is writing", which `socket.on("error")` / `"close"` implement with `size > 0`.

The fake reads the whole stream and replies only `if (stream.terminated)`. That path, an EPIPE or ECONNRESET after a partial reply, is therefore never exercised. If it regressed, a real over-limit file would be classified `unavailable` instead of `limits`, and the D-12 "error logged naming the deployment requirement" outcome (`attachment-quarantine.integration.test.ts:229`) would go silent in production.
**Fix:** Add a fake mode, for example `size-exceeded-early:<bytes>`. Once that many payload bytes have arrived, it writes `INSTREAM size limit exceeded. ERROR\0` and calls `socket.destroy()` before the terminator. Add a unit test that scans a payload of several chunks against it and asserts `{ kind: "not-scanned", cause: "limits" }`.

#### WR-308: The AI inclusion's foreign-file refusal snapshots the wrong request, so a write to the targeted record would go unseen

**File:** `apps/backend/tests/attachment-ai-input.integration.test.ts:425-438`
**Issue:** `foreign` lives on `otherRequest`, but the snapshot is `persisted(requestId)`. That covers `requestId`'s records plus the database-wide row, file-record and storage counts. An `ai_input` that resolved the foreign attachment and wrote `aiTextIncluded`, `aiText` or an event before answering 404 updates a row on `otherRequest`. No count changes, so `UNEXPECTED_WRITE_INVALID` cannot fail. That record is exactly the one a cross-request bug would write to.

The removal equivalent (`request-attachments.integration.test.ts:860-875`) gets this right, because it snapshots the request that owns the file.
**Fix:** Snapshot both requests, `harness.snapshot([() => harness.listRequestAttachments(requestId), () => harness.listRequestAttachments(otherRequest), …counts])`. Also assert that the foreign file's stored `aiTextIncluded` is still `false` and its `eventLog` unchanged after the 404s.

### Info

#### IN-301: The fake object store accepts any signature and ignores expiry, and the harness comment says it checks SigV4

**File:** `apps/backend/tests/helpers/fake-object-store.ts:68`, `:95`; `apps/backend/tests/helpers/strapi-http-harness.ts:737`
**Issue:** A GET is accepted when `X-Amz-Signature` is present, whatever its value. `X-Amz-Expires` is never recorded, so D-06's "short expiry" is proven only by the config unit test (`params.signedUrlExpires === 60`), not on the wire. I checked that `@strapi/provider-upload-aws-s3@5.51.0` reads `config.params.signedUrlExpires`, so it is honoured today. The harness comment "Dummy credentials for the fake store's SigV4 checks" is inaccurate.
**Fix:** Record `X-Amz-Expires` and `X-Amz-Credential` in `FakeObjectStoreRequest`. In the S3 test, assert `Number(expires) <= 60` and that the credential starts with `csrm-test-access-key/`. Correct the comment.

#### IN-302: `seedRequestAttachments` writes impossible records: `uploaderPart: "requestor"` even when the uploader is an analyst

**File:** `apps/backend/tests/helpers/strapi-http-harness.ts:2390-2420` (line 2406)
**Issue:** `submittedWithFiles([owner, analyst])` (`request-attachments.integration.test.ts:903-917`) and the second-analyst seeds produce analyst-uploaded files on Jane's submitted request in the requestor part. The current rules key on `uploadedBy`, so no test is wrong today. But any later rule or projection that reads `uploaderPart` would be tested against data the upload path can never produce.
**Fix:** Take the part as a parameter, or derive it: `"requestor"` when `uploadedBy` is the request's requestor, otherwise `"security-analyst"`.

#### IN-303: The Keycloak and AI boot fakes now run attachment validation against the ambient `process.env`

**File:** `apps/backend/tests/keycloak-provisioning.unit.test.ts:108-112`, `:210-212`; `apps/backend/tests/ai-run-boot.unit.test.ts:48-52`
**Issue:** `application.register` calls `assertAttachmentConfiguration(strapi)` before `registerIdamboxUserProvisioning`, with `process.env`. `withKeycloakEnv` pins only the Keycloak keys. A shell that exports, for example, `CSRM_ATTACHMENT_SCANNER=development` without `NODE_ENV=development` makes register throw `AttachmentConfigurationError` first. That fails "register skips Keycloak entirely" and masks "refuses to start … incomplete configuration", which expects a `KeycloakProvisioningConfigurationError`.

The loosened log check still proves Keycloak writes nothing: info and error are both compared, and the fake has no `warn`, so a warning would throw. But the check no longer pins how many attachment lines are written.
**Fix:** In both fakes, clear the `CSRM_ATTACHMENT_*`, `CSRM_CLAMAV_*`, `NODE_ENV` and `CSRM_ENVIRONMENT` keys around `application.register`, or set them to the development defaults. Assert that exactly one `CSRM attachments` line is logged.

#### IN-304: Flake risks from real timers and port reuse in the ClamAV-booted suites

**File:** `apps/backend/tests/helpers/fake-clamd-server.ts:138-147`; `apps/backend/tests/request-attachments-scanning.integration.test.ts:87,124`; `apps/backend/tests/attachment-quarantine.integration.test.ts`
**Issue:**
- `setMode` from `down` back to a listening mode re-binds the same ephemeral port. Another process may have taken it in the meantime, giving `EADDRINUSE`.
- Pending uploads schedule real one-minute re-scans while later tests switch the shared fake to `found:` or `clean`. If a file run (or a debugger pause) passes 60 s, earlier files are re-scanned under another test's mode, which interleaves log lines with `captureLogs`/`captureSecurityEvents` windows.
**Fix:** Keep the server bound and make `down` refuse by `socket.destroy()` on connect, or retry the re-listen on a new port and expose it. Stop the scheduler (`stopAttachmentRescans`) at the end of each test that leaves a pending file, or inject the scheduler's timers.

#### IN-305: The same helpers are copied into four integration files

**File:** `request-attachments.integration.test.ts:66-105`, `attachment-ai-input.integration.test.ts:112-154`, `request-attachments-scanning.integration.test.ts:57-83`, `attachment-quarantine.integration.test.ts:101-122`
**Issue:** `captureSecurityEvents`/`captureLogs`, `persisted`, `attachmentsPath`, `refusalOf` and `seedRequest` are copied with small drifts. For example, the quarantine copy records every line, and the snapshot lists differ. A fix such as WR-308's would have to be repeated four times.
**Fix:** Move them into `tests/helpers/attachment-http.ts`, parameterised by the harness promise.

#### IN-306: The heap-limit extraction test cannot tell a worker that never started from an overrun during extraction

**File:** `apps/backend/tests/attachment-extraction.unit.test.ts:390-396`
**Issue:** With `heapMb: 8`, the worker most likely dies while loading pdf.js, before any extraction, so the test proves "a tiny heap gives unavailable". It does not prove "an extraction that exceeds its heap is terminated and gives unavailable". It does still fail if the limits are not applied, so it is not vacuous.
**Fix:** Use the `onWorkerStart` and `onWorkerExit` observer to assert the worker reached its message handler. Pick a heap that loads the parser but cannot hold the 300-page document, or have the worker report a "ready" event before parsing.

#### IN-307: Minor actor and storage cases with no proof

**File:** `apps/backend/tests/request-attachments.integration.test.ts`, `apps/backend/tests/attachment-storage-s3.integration.test.ts`
**Issue:** No test covers:
- the service agent on a request it raised itself (D-19: its Requestor birthright reaches its own requests);
- the inactive analyst at any attachment route;
- the digest check (`ATTACHMENT_INTEGRITY_FAILED`) on the S3 read path, which is proven only on local storage.
**Fix:** Add a mounted case for an agent-raised draft (list and upload as Requestor; AI operations 403). Add an inactive-analyst 403 or 404 row. Add an S3 tamper case that edits `store.objects` and asserts 409 `ATTACHMENT_INTEGRITY_FAILED` on download.

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer), Lane 3_
_Depth: standard_

## Phase 14: Code Review Report, Lane 4 (web attachments feature, file responses, body-limit gate and routes)

**Reviewed:** 2026-10-11
**Depth:** standard (with call-chain reads into the installed Next 16.3.6 action handler, `request-form.tsx`, `notes-thread.tsx`, `note-item.tsx`, `refusal-copy.ts` and the backend's `attachment-rules.ts` / `attachment-projection.ts`)
**Files Reviewed:** 30
**Status:** issues_found

### Summary

Range `e50053f..d3f265d`. The typed-API boundary holds: every Strapi call goes through `attachments-service.ts` (openapi-fetch, closed zod parsers, `server-only`); the Server Actions validate their input (zod for everything except the upload's FormData, see IN-409); there is no Route Handler and no raw `fetch`; names, detections and the preview text render as React text; `File` objects never reach browser storage; the download is checked server-side by `validateFileResponse` (type, safe name, 26,214,400-byte bound, signature) before any byte is returned, and the object URL is revoked. `fileAiControlMode` correctly implements the orchestrator's D-30 ruling (off-only switch for an included file under a refusing policy, no switch for a not-included file, none for the requesting analyst), and matches the backend's refusal order (`OWN_REQUEST` first, exclusion always allowed in the window).

The serious problems are in the D-25 body-limit gate. Next's `serverActions.bodySizeLimit` and `proxyClientMaxBodySize` are now 26 MB for the whole application, and the path-scoped gate in `proxy.ts` that is meant to keep every other route at 6 MB can be bypassed with crafted headers in two independent ways (CR-401, CR-402). Either one gives every route, for an unauthenticated caller, the 26 MB ceiling that T-14-49 claims is confined to the four attachment pages. The upload queue and file store also have two no-lost-input gaps, one focus-loss path after Remove, and a few touch-target and copy deviations from the UI-SPEC.

### Critical Issues

#### CR-401: The body-limit gate ignores multipart POSTs without `Next-Action`, which Next still parses as Server Actions at the raised 26 MB limit

**File:** `apps/csrm/src/lib/security/action-body-limit.ts:35` (with `apps/csrm/next.config.ts:33-38`, `apps/csrm/proxy.ts:23`)
**Issue:** The gate only looks at requests that carry the `next-action` header:
```ts
if (request.method !== 'POST' || !request.headers.has('next-action')) return false;
```
Next 16.3.6 does not need that header to treat a request as a Server Action. `node_modules/next/dist/server/lib/server-action-request-meta.js` sets `isMultipartAction = req.method === 'POST' && contentType.startsWith('multipart/form-data')` and `isPossibleServerAction = isFetchAction || isURLEncodedAction || isMultipartAction`. For a multipart POST with no `Next-Action` header (the progressive-enhancement "MPA action" path), `app-render/action-handler.js` (around lines 712-751, "Multipart POST, but not a fetch action") pipes the whole body through `sizeLimitTransform` (limited by `serverActions.bodySizeLimit`, now `'26mb'`) into `fakeRequest.formData()`. That buffers up to 26 MB in memory before it knows whether any action exists, then `decodeAction` runs whatever action the `$ACTION_ID_<id>` field names. All of this happens before any page renders or any session check runs.

So any caller, signed in or not, can POST a 26 MB `multipart/form-data` body to any route (`/app/risks/x`, `/sign-in`, `/`) and Next will accept and buffer it. Before Phase 14 the global ceiling was 6 MB, so this phase made the exposure on every route four times larger. The unit test codifies the bypass: `action-body-limit.test.ts:58` asserts that a 27 MB POST without `next-action` is let through. T-14-49 ("the proxy refuses an oversized or unmeasured action post outside the attachment pages") does not hold.
**Fix:** Gate every request Next could treat as a possible action, not just the ones with the header. The simplest robust rule is every POST outside the attachment paths:
```ts
export function exceedsActionBodyLimit(request: Pick<NextRequest, 'method' | 'headers' | 'nextUrl'>): boolean {
  if (request.method !== 'POST') return false;            // Next only dispatches actions on POST
  if (ATTACHMENT_ACTION_PATHS.some((p) => p.test(request.nextUrl.pathname))) return false;
  const declared = request.headers.get('content-length');
  const length = declared === null || declared.trim() === '' ? Number.NaN : Number(declared);
  return !Number.isInteger(length) || length < 0 || length > DEFAULT_ACTION_BODY_LIMIT_BYTES;
}
```
If some non-action POST (for example Auth.js under `/api/auth/*`) must stay unmeasured, list it explicitly. Replace the test at line 58 with cases for a header-less `multipart/form-data` POST and an `application/x-www-form-urlencoded` POST, each over 6 MB, that expect `true`. Add a header-less multipart case to the `ACTION_BODY_LIMIT_OUTSIDE_ATTACHMENT_PAGES` journey.

#### CR-402: A `purpose: prefetch` or `next-router-prefetch` header skips the proxy entirely, and the body-limit gate with it

**File:** `apps/csrm/proxy.ts:77-86` (gate at line 23)
**Issue:** The gate lives inside `proxy()`, but the matcher only runs `proxy()` when both prefetch headers are absent:
```ts
matcher: [{ source: '/((?!_next/static/|_next/image$|icon\\.png$).*)',
  missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }]
```
Per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` ("You can also bypass Proxy for certain requests by using the `missing` … arrays"), any request that carries either header never reaches `proxy()`. Next does not treat such a request as a prefetch unless it also carries `RSC: 1`: `app-render.js:199` reads `isPrefetchRequest = isRSCRequest && headers['next-router-prefetch'] === '1'`, and `purpose` is ignored. Without `RSC: 1`, a POST with `Next-Action: <id>`, `Purpose: prefetch` and a 26 MB body goes straight to `handleAction` (`app-render.js:1721-1724`). There it is parsed with the global `'26mb'` limit on any route. This is a second, independent way to widen the 6 MB ceiling to every route with a crafted header. The bypass existed only for CSP before. Phase 14 made it a bypass of a security control by putting the gate behind this matcher.
**Fix:** Make sure the gate runs for every request, whatever headers it carries. Then skip only the CSP work for prefetches, inside the function:
```ts
export const config = { matcher: [{ source: '/((?!_next/static/|_next/image$|icon\\.png$).*)' }] } satisfies ProxyConfig;

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (exceedsActionBodyLimit(request)) return new NextResponse(null, { status: 413 });
  const prefetch = request.headers.has('next-router-prefetch') || request.headers.get('purpose') === 'prefetch';
  if (prefetch && request.method === 'GET') return NextResponse.next();
  ...
}
```
Alternatively, add matcher entries with `has:` for the two headers that run only the gate. Add a unit case that runs `config.matcher` against a POST carrying `purpose: prefetch` and expects 413. Record this, and CR-401, in the R-08-04 reverse-proxy residual, because the per-path limit at the reverse proxy is the only layer that stops either bypass today.

### Warnings

#### WR-401: Kept "not added" rows become invisible and impossible to remove once the add control turns into a locked line, while `beforeunload` stays armed on every page

**File:** `apps/csrm/src/features/attachments/files-section.tsx:111,141-151`; `apps/csrm/src/features/attachments/file-store.tsx:39,65-66`
**Issue:** The draft's queue (the only place its kept rows render) mounts only while Strapi says files can be added:
```tsx
const addsOnDraft = add.canAdd && add.window === 'intake' && !add.needsNote && draftOwnerKey !== null;
...
{addsOnDraft ? <UploadQueue … scope="draft" /> : null}
{locked && LockedIcon ? <p …>{locked.text}</p> : null}
```
The store, however, arms `beforeunload` for any kept row: `keeps = row.stage !== 'added' && row.stage !== 'pending'`, so `useUnloadWarning(holdsFiles)`. A concrete path: a draft holds 19 files and the Requestor chooses 2. The pre-check gives one `waiting` row and one `refused` row (`ATTACHMENT_LIMIT_REACHED`). The first is added and the queue refreshes the page. The read now says `canAdd: false` (20 active), so `FilesPanel` replaces the queue with the §1.2 line. The refused row is still in the store, so every page in the tab warns on reload or close, but the row is never rendered anywhere and its `Remove from list` cannot be reached. The same happens to a `failed` row awaiting Retry, or a `waiting` row, when the window or the configuration changes (`ATTACHMENT_LIFETIME_LIMIT_REACHED`, `ATTACHMENTS_NOT_CONFIGURED`). §1.5 says kept rows "return with their reason and actions wherever that record lists it". Here they don't, and the person is left with an unexplained leave warning.
**Fix:** Render the queue whenever the store holds rows for the draft, not only while `canAdd` holds. Hide only its field when adding is closed:
```tsx
const keptForDraft = useKeptFiles(...) // or pass a flag from a small client wrapper
{(addsOnDraft || hasKeptDraftRows) ? <UploadQueue field={addsOnDraft} … scope="draft" /> : null}
```
Alternatively, have the queue dispatch `remove` for rows it can no longer show and drop them from `holdsFiles`. Add a test: 19 files plus 2 chosen ends with the refused row still listed with `Remove from list`.

#### WR-402: On the new-request form, a save with only pre-check-refused files left drops them silently and navigates away

**File:** `apps/csrm/src/features/attachments/upload-queue.tsx:211,214` (caller `apps/csrm/src/features/requests/request-form.tsx` `saveDraft`)
**Issue:** `hasWork` ignores `refused` rows:
```ts
hasWork: () => rows.some((row) => row.stage === 'chosen' || row.stage === 'failed' || isInFlight(row)),
```
Before the draft exists, those rows live only in the queue's local `useReducer` (`chosenRows`). If every chosen file failed the browser pre-check (for example a `.docm` and a 30 MB PDF), `saveDraft` takes the `!pending?.hasWork()` branch and calls `createRequestAction(values)` without `stayOnPage`. The server redirects to the draft and the refused rows vanish: there is no §2.2 alert, they are not "listed on the draft", and nothing warns. This contradicts §2.2 step 5 ("Any not added: the page stays. A danger Alert …") and 14-14's recorded decision ("A save with only refused files left saves and moves to the draft, where they stay listed"). That decision only holds once the rows are in the store. The pre-draft leave guard (`rows.some((row) => row.stage === 'chosen')`, line 211) also ignores refused rows, so an in-app link loses them without a dialog, against §10's rule that "no row loses a chosen file without a warning".
**Fix:** Treat any row before binding as work: `hasWork: () => rows.some((row) => row.stage !== 'added' && row.stage !== 'pending' && !row.listed)`, so the stay-on-page path binds refused rows into the draft's store and shows the alert. Guard leaving on `target === null && rows.length > 0`. Add a request-form test: only a refused file chosen, then Save draft, should keep the page with the alert.

#### WR-403: Focus is lost after Remove when the neighbouring file offers no button

**File:** `apps/csrm/src/features/attachments/files-list.tsx:312-322,398-402`
**Issue:** `remove` picks the neighbour by position only:
```ts
const neighbour = active[index + 1] ?? active[index - 1];
focusIntent.current = neighbour ? { kind: 'file', id: neighbour.documentId } : { kind: 'heading' };
```
The effect then looks for `[data-file-actions=…] button`. A neighbour that is `pending`, `blocked` or `unavailable` and that this viewer cannot remove has no button. For example, a Requestor after submission looking at an analyst's file waiting for its malware check: `actions` all false and no AI control. The `querySelector` returns null, so `focusIntent` is never cleared and the removed row's focused `Remove` button unmounts, which drops focus to `<body>`. The intent also stays armed and can pull focus on a later unrelated `shown` change. §3.5 says "the next row's `Download` (or its first action), else the previous row's, else the section heading". This fails WCAG 2.4.3.
**Fix:** Choose the neighbour among files that render an action, and fall back to the heading when no target is found:
```ts
const actionable = (f: ShownFile) => f.actions.download || f.actions.remove || hasAiActions(f);
const neighbour = active.slice(index + 1).find(actionable) ?? active.slice(0, index).reverse().find(actionable);
// in the effect: if (!target) { focusIntent.current = null; document.getElementById('files')?.focus(); }
```

#### WR-404: The AI switch stays operable while its change is pending, so an off-only switch can send an inclusion the policy refuses

**File:** `apps/csrm/src/features/attachments/file-ai-control.tsx:120-154,169-175`
**Issue:** The `Switch` has no `disabled` and `onCheckedChange` does not check `pending`. Under the D-30 off-only ruling, an analyst turns an included file off: `show(false)` runs, but `served` still says included, so `mode.kind` stays `'switch'` until Strapi answers. A second press calls `change(true, false, true)`, which PUTs `included: true`. Strapi refuses it with `AI_CLASSIFICATION_ABOVE_CEILING`, and a danger toast appears for an action the off-only switch must never offer. In normal mode, toggling during `Reading the file’s text…` queues an include and an exclude back to back, with two contradictory success toasts, each with its own Undo.
**Fix:** Ignore input while a change is in flight, and never send an inclusion from an off-only switch:
```tsx
<Switch disabled={pending} … onCheckedChange={(next) => { if (pending || (mode.offOnly && next)) return; change(next, false, mode.offOnly); }} />
```
(If `disabled` would drop focus, use `aria-disabled` and keep focus.)

#### WR-405: Phone touch targets below the UI-SPEC's touch-target height (queue row `X`, AI switch in the actions sheet)

**File:** `apps/csrm/src/features/attachments/upload-queue.tsx:395-399`; `apps/csrm/src/features/attachments/file-ai-control.tsx:164-176`
**Issue:** §1.4 at 375 says each queue row's "actions at full width and the touch-target height". The chosen or waiting row's `Remove {name} from the list` is `size="icon-xs"` (24px) with only `max-md:self-end`, while its sibling actions get `max-md:min-h-11 max-md:w-full`. §3.3 says the phone actions sheet holds "the AI switch with its line and `Preview text`, each at full width and the touch-target height". The sheet layout wraps the switch in `flex min-h-11 w-fit`, but the pressable targets are the 32×18.4px `Switch` (`data-[size=default]:h-[1.15rem]`) and its text label. Neither is full width or 44px high, and the 44px wrapper is not itself pressable.
**Fix:** Give the X `max-md:min-h-11 max-md:w-full` (with a visible `Remove` label at that width if needed). In the sheet layout, make the whole row a full-width `label` (`min-h-11 w-full`) that toggles the switch, so the pressable area meets the touch-target height.

### Info

#### IN-401: The 26 MB raise is scoped by path, not by action

**File:** `apps/csrm/src/lib/security/action-body-limit.ts:27-36`
**Issue:** On the four attachment paths, every Server Action in those pages' worker accepts 26 MB, not just `uploadAttachmentAction`: `createRequestAction`, `updateRequestAction`, `addRequestNoteAction`, `submitRequestAction`, the relation searches and so on. Each body is buffered by Next before zod rejects it. D-25 accepts path scoping, but the residual should name this.
**Fix:** Record it in the R-08-04 residual, or have the gate admit large bodies only for `multipart/form-data` posts on those paths.

#### IN-402: The download check trusts the client's `fileType` and never compares the name or size with the recorded file

**File:** `apps/csrm/src/features/attachments/attachments-actions.ts:95,109-113`
**Issue:** The "recorded type" that `validateFileResponse` checks against arrives from the browser (`fileType: z.enum(attachmentTypes)`). The returned name is Strapi's `Content-Disposition` name, which is pattern-checked but not compared with the listed `fileName` or `byteSize`. A dishonest client can only hurt its own download, but D-24's "against the attachment's recorded type" is really "against what the caller claims".
**Fix:** Optionally re-read the attachment's facts server-side (the list read) and pass `recordedType`, `fileName` and `byteSize` from Strapi, or document that the type is the caller's claim.

#### IN-403: `UNSAFE_NAME` embeds literal invisible bidi characters

**File:** `apps/csrm/src/lib/files/file-response.ts:62`
**Issue:** The class holds raw U+200E, U+200F, U+061C, U+202A–U+202E and U+2066–U+2069 (verified by code-point dump). They are invisible in review and easily lost by an editor or formatter, which would silently weaken the RLO check.
**Fix:** `/[/\\\u0000-\u001f\u007f-\u009f‎‏؜‪-‮⁦-⁩]/u`.

#### IN-404: `formatFileSize` boundary and copy defects

**File:** `apps/csrm/src/lib/files/format-file-size.ts:12-14`
**Issue:** 1,048,575 bytes reads `1024 KB`. Counts are not grouped (`1023 bytes`), against the voice rule's en-AU grouping. A file just over the limit (26,214,401 to about 26,267,000 bytes) reads `25.0 MB`, so the family N refusal says "Files can be up to 25 MB, and this one is 25.0 MB".
**Fix:** Promote ≥1,023.5 KB to MB, format with `Intl.NumberFormat('en-AU')`, and round sizes above the limit up (`Math.ceil(x*10)/10`) so an oversize file never reads as 25.0 MB.

#### IN-405: `saveFile` revokes the object URL on the next tick

**File:** `apps/csrm/src/lib/files/save-file.ts:26`
**Issue:** `setTimeout(() => URL.revokeObjectURL(url), 0)` is the earliest possible revocation. WebKit is known to fail blob downloads that are revoked before the download has read the blob, which matters for 25 MB files on iOS Safari at 375. The journeys run on Chromium, so they would not show it.
**Fix:** Revoke after a generous delay (for example 30-60 s, as FileSaver.js does), still once per call, so nothing leaks.

#### IN-406: Dead code: unused Server Action and an ignored prop

**File:** `apps/csrm/src/features/attachments/attachments-actions.ts:61-68`; `apps/csrm/src/features/attachments/files-list.tsx:182,461`
**Issue:** `listRequestAttachmentsAction` has no caller, yet it is an exported action and so a callable endpoint. `FilesListProps.empty.title` is never read (the heading comes from `EmptyState`'s `noun`/`kind`), so the domain's `filesEmptyState().title` can drift from what renders.
**Fix:** Remove the action (or wire it to the §3.7 `Try again`). Render `empty.title`, or drop it from the type.

#### IN-407: Raw motion value instead of the token

**File:** `apps/csrm/src/features/attachments/file-field.tsx:113`
**Issue:** `duration-80` hard-codes the 80 ms that the direction names `--duration-micro`. AGENTS.md asks for semantic tokens.
**Fix:** `duration-(--duration-micro)`.

#### IN-408: An optimistic restore shows a pending file as available

**File:** `apps/csrm/src/features/attachments/files-list.tsx:114-119`
**Issue:** `optimisticRemoval(file, false)` forces `state: 'available'`. Undoing the removal of a file still waiting for its malware check briefly drops its `Waiting for malware check` badge and line until Strapi answers.
**Fix:** Restore to the state the file had before removal (keep it on the change or on `answered`), not `'available'`.

#### IN-409: The upload action has no schema at its boundary, and a duplicate replacement file is ignored silently

**File:** `apps/csrm/src/features/attachments/attachments-actions.ts:75-82`; `apps/csrm/src/features/attachments/upload-queue.tsx:296-297`
**Issue:** `uploadAttachmentAction` calls `form.get` on an unvalidated argument, so a crafted call with a non-FormData argument throws a 500 instead of returning family N's 400. The input is checked with `typeof` rather than the shared schema, which only runs later in the service. Separately, `Choose another file` with a file already in the queue makes `precheckChosenFiles` return nothing, and `replaced` returns with no feedback.
**Fix:** Guard with `if (!(form instanceof FormData))` and parse `{ requestId, file, noteId }` with `uploadAttachmentInputSchema` in the action. In `replaced`, keep the refused row and focus it (or say it is already listed) when the replacement is a duplicate.

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer), Lane 4_
_Depth: standard_

## Phase 14: Code Review Report, Lane 5 (web integrations: AI assistance, assessments, notes, requests, shared components and the API layer)

**Reviewed:** 2026-10-11
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

### Summary

I reviewed each file's Phase 14 diff (`git diff e50053f..HEAD`) and read the surrounding code and the call chains it depends on. Those chains run into `features/attachments` (upload-queue, file-store, files-list, attachments-actions), the Strapi attachment service (`request-attachments.ts`), `specification.json`, and the 14-CONTEXT and 14-UI-SPEC sections named in the brief.

These parts hold up:
- **Transport.** The transport keeps a closed-list reason on any 4xx. It keeps `detection` only beside `ATTACHMENT_MALWARE_FOUND` and only when it is pattern-checked. No served message reaches the copy. Every consumer of `error.reason` outside attachments branches on status first, and Strapi sets `details.reason` only through the conflict/forbidden helpers and the attachment controller, so widening reasons from 403/409 to every 4xx changes nothing elsewhere.
- **Refusal copy.** Families N, O and P match §8 word for word.
- **Read schemas.** The new read schemas are strict and match the contract: `RequestSummaryFiles`, `AiInputsChanged.files`, `AiRunContextAttachments`, `GenerationJobFailureAttachment` and `RequestAttachmentSummary`.
- **Job cards.** Both job cards read the flat `failureAttachments`.
- **`request-context-lines.tsx`.** It stays a server component, and each of its three links is a 24 px flex box.
- **`DataTable`.** `paginated` defaults to true and `headerHidden` is opt-in, so the other tables do not change.
- **Note posting.** The note is posted first, and a failed post gives back both its text and its files.

The defects are these:
- **Malware detection names.** The contract's detection pattern rejects real ClamAV names (EICAR included).
- **Family P fallbacks.** Two family P fallbacks read as a permission refusal.
- **Family O on restore.** Family O shows a download-only sentence for a refused restore.
- **Stale queue handle.** `Save draft` holds a stale queue handle across its server round trip. It can lose or revive files, and it can leave the form stuck on `Adding files…`.
- **No leave dialog for a posting note.** No in-app leave dialog guards a note's files while the note is being posted.
- **Dead links.** Every link to a removed file goes to an anchor that does not exist.

### Warnings

#### WR-501: The detection pattern rejects real ClamAV names, so the malware copy and the blocked line drop the detection in production

**File:** `apps/csrm/src/lib/api/transport/server-client.ts:147` (the same pattern is in `docs/references/specification.json` `AssessmentWorkflowErrorResponse.error.details.detection`, `apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts:291` `SERVED_DETECTION`, and `apps/backend/src/csrm/audit/security-event-log.ts:88` `DETECTION`)

**Issue:** The pattern is

```ts
const detectionPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
```

It has no underscore, and ClamAV signature names use underscores routinely. The official database reports the EICAR test file as `Win.Test.EICAR_HDB-1`. Strapi drops such a name before it serves the 422 (`screeningError`, `storedDetection`), and the web would drop it again here. The upload refusal therefore reads `This file contains malware and wasn’t added. …` with no detection, and a blocked file's line has no name. The development double's names (`Eicar-Test-Signature`, `Csrm.Test.Signature`) contain no underscore, so every suite passes and the defect shows only against real `clamd`.

This breaks D-11 ("names the detection") and 14-UI-SPEC §3.4 and §8.1 ("A detection name is shown verbatim as data"). On the Strapi side the same pattern turns the security event's detection into `INVALID_DETECTION` (security-event-log.ts:122), so the warning-level log line loses its detection too. That half belongs to the backend lane.

**Fix:** Allow `_` in all four places together, so the contract, Strapi and the web stay in parity. Keep the rules on leading character, no space, no markup and length:

```ts
const detectionPattern = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,127}$/; // add `_` (and `+` if desired); no space, `<` or `>`
```

Add a transport test and a Strapi test with `Win.Test.EICAR_HDB-1`, built in memory.

#### WR-502: Family P reads two non-permission refusals as "You can’t change the AI inputs on this request."

**File:** `apps/csrm/src/lib/api/refusal-copy.ts:509-537`

**Issue:** Strapi's AI-inclusion operation (`setRequestAttachmentAiInput`) raises `409 HISTORY_UNAVAILABLE` when the file's event log is full or unreadable. When including, it also raises `409 ATTACHMENT_INTEGRITY_FAILED` when the stored bytes fail their digest (request-attachments.ts:705, 780). Neither reason is in `attachmentAiReasons`, so both fall through to:

```ts
return blocked('You can’t change the AI inputs on this request.');
```

That tells an eligible analyst they lack the right, when the real causes are a full history and tamper evidence. The tamper case is the warning-level integrity event that D-23 wants surfaced to an administrator.

`ATTACHMENT_UNAVAILABLE` (the stored bytes are gone) reads `This file can’t be included any more. Refresh the page.`, which sends the analyst to a refresh that cannot help. The brief asks for fallbacks that do not mislead.

**Fix:** Map these reasons in family P to the family O words that already exist:

```ts
HISTORY_UNAVAILABLE: 'This file’s history is full, so it can’t change any more. Contact your administrator.',
ATTACHMENT_INTEGRITY_FAILED: 'This file doesn’t match the one that was added, so CSRM won’t read it. Contact your administrator.',
ATTACHMENT_UNAVAILABLE: 'This file can’t be read. Contact your administrator.', // §3.4's unavailable line
```

Then record the additions in §8.3, as plan 14-05 did for `HISTORY_UNAVAILABLE` in §8.2.

#### WR-503: Family O shows download-only sentences for a refused restore

**File:** `apps/csrm/src/lib/api/refusal-copy.ts:455-485`

**Issue:** `attachmentFileRefusal(action, …)` reads one `attachmentFileReasons` table for download, remove and restore. Strapi's `canRestoreAttachment` refuses with `409 ATTACHMENT_BLOCKED` (request-attachments.ts:555). That happens, for example, when a re-scan blocks a file between `Remove` and the toast's `Undo`. A restore refused that way, or an `Undo` under `Couldn’t undo`, reads:

```ts
ATTACHMENT_BLOCKED: 'Malware was found in this file, so it can’t be downloaded.',
```

That sentence answers a question the person did not ask, since they were restoring the file. `ATTACHMENT_REMOVED` (`… so it can’t be downloaded. Refresh the page.`) and `ATTACHMENT_QUARANTINED` have the same download wording. They are only served on download today, but the table applies them to every action, which is the trap the brief names. The `ATTACHMENT_UNAVAILABLE` example the brief gives is not live: Strapi raises it only on download and AI inclusion, never on removal or restore.

**Fix:** Key the reason sentences per action, with the shared sentences in one place:

```ts
if (action === 'restore' && reason === 'ATTACHMENT_BLOCKED') return blocked('Malware was found in this file, so it can’t be restored.');
const listed = reason === undefined ? undefined : (action === 'download' ? downloadReasons : changeReasons)[reason] ?? attachmentFileReasons[reason];
```

Add the restore sentence to §8.2.

#### WR-504: `Save draft` holds a stale queue handle across the save round trip (files lost or revived; the form can stay on `Adding files…`)

**File:** `apps/csrm/src/features/requests/request-form.tsx:211-237`

**Issue:**

```ts
const pending = queue.current;            // handle of this render: its closure holds `rows` and `target` as they are now
…
const result = creating ? await createRequestAction(values, { stayOnPage: true }) : await updateRequestAction(…, { stayOnPage: true });
…
const settled = await pending.sendAll(savedId);   // the old closure's rows
```

`useImperativeHandle` (upload-queue.tsx:213-233) replaces the handle whenever `rows` changes, but the form calls `sendAll` on the handle it captured before the `await`. Nothing disables the queue's `Choose files`, `Remove from list` or `Retry` during `Saving draft…`.

- **New-request form.** `sendAll` moves the old `rows` into the store (`binding.current = moving`). A file the person removed during the save is uploaded anyway, which sends a file they took back. A file they chose during the save is never moved, so it disappears once `target` is set. That is lost input, against G-4 and D-26.
- **Draft edit form (immediate queue).** Next.js runs Server Actions one at a time, so `updateRequestAction` waits behind a file that is still `Adding…`. If that file is refused, its row settles and no refresh follows, because `unlisted` is false. `pending.sendAll` then checks the stale `rows`, still sees a row `adding`, sets `waiter`, and never resolves: the effect that resolves it runs only when `rows` changes again. `Save draft` stays disabled on `Adding files…` with its spinner, and the person can only reload, which drops the refused row that §1.5 promises to keep.

**Fix:** Read the handle after the save, and keep the queue from changing while the save is in flight:

```ts
const result = creating ? await createRequestAction(values, { stayOnPage: true }) : await updateRequestAction(…);
…
const current = queue.current;            // fresh closure
if (!current) return;
const settled = await current.sendAll(savedId);
```

In `sendAll`, also judge `failed`/in-flight from a ref that tracks the latest `rows` instead of a closure value. Pass a `disabled` prop to `UploadQueue` while `form.formState.isSubmitting`. Add a test that refuses a file while `updateRequestAction` is pending and asserts the save resolves.

#### WR-505: No in-app leave dialog while a note's files wait for the note to be posted (§10 row 1)

**File:** `apps/csrm/src/features/request-notes/notes-thread.tsx:205-247` (with `note-item.tsx` `WaitingRows`)

**Issue:** §10's first row requires the product dialog for "Any file waiting or being added (form, section, composer, note)". While the note posts, its files exist only in `pending.files` and render through `WaitingRows` (upload-queue.tsx:358), a display-only list that registers no guard. The composer arms only `beforeunload` (`useUnloadWarning(… || inFlight …)`), and the queue's `useLeaveGuard(inFlight, 'waiting', filesLeaveCopy)` does not exist until the note has an id. So an in-app link pressed while the note posts leaves without the `Leave while files are being added?` dialog.

If the note then succeeds, its files go into `note:{id}` as `waiting` with no mounted queue to send them. They come back later only as failed rows (`restore` turns `waiting` into `failed`), and after 60 minutes Retry is refused with `ATTACHMENT_NOTE_INVALID`.

**Fix:** Register the files' guard in the thread while a note carrying files is in flight:

```ts
useLeaveGuard(Boolean(pending && !pending.leaving && pending.files.length > 0), 'waiting', filesLeaveCopy);
```

#### WR-506: Links to removed files go to anchors that do not exist (signal, run sheet, too-large failure)

**File:** `apps/csrm/src/features/ai-assistance/ai-inputs-changed.tsx:108-114`, `apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx:198-203`, `apps/csrm/src/features/attachments/context-too-large-files.tsx:37` (called from `assessment-draft-job.tsx:98-99` and `questionnaire-generation-job.tsx:335-336`)

**Issue:** Each of these links every file to `/app/review/requests/{id}#file-{fileId}`, including files the same line says were removed: the signal's `Removed since` items and the run sheet's ` · Removed since` rows. But `#file-{id}` exists only on main-list rows and cards (`files-list.tsx:256`, `:546`). `RemovedFile` (files-list.tsx:492-505) has no `id`, and its group starts collapsed. Following the link loads the request page and lands nowhere.

That breaks 14-UI-SPEC §12 ("Every figure opens its records") and is a broken link for keyboard and screen-reader users. `note-item.tsx` already handles the same case by rendering a removed file's name as plain text (`href = file.state === 'removed' ? undefined : …`).

**Fix:** Either render removed files as plain names, which matches note-item:

```tsx
{file.change === 'removed' ? <span className="text-sm">{file.fileName}</span> : <RecordLink …>{file.fileName}</RecordLink>}
// run sheet: file.fileName && file.requestId && !file.removed ? <Close asChild><RecordLink…/></Close> : (file.fileName ?? sheetUnnamedFile)
```

Or give each `RemovedFile` its `id="file-{id}"` with `tabIndex={-1}`, and have a `#file-` hash open the removed group before it lands.

### Info

#### IN-501: The leave dialog takes the first registered copy, whatever the other guards' reasons

**File:** `apps/csrm/src/components/csrm/navigation-guard.tsx:114`

**Issue:** `registeredCopy = Object.values(guards).find((entry) => entry.copy)?.copy` ignores `reason`. If a page holds a `failed` guard without copy (Phase 10's unsaved-answers dialog) and a copy-carrying guard (an upload queue in flight) together, the dialog shows the files' words and drops the failed-save warning. Insertion order also decides which copy wins, because re-registering moves an id to the end. No page combines them today.

**Fix:** Prefer the default `failed` copy when any guard is `failed`, or pick copy by a fixed priority.

#### IN-502: After the new-request form has saved its draft, its leave dialog says the request and files "haven’t been saved"

**File:** `apps/csrm/src/features/requests/request-form.tsx:194`

**Issue:** Once the first save has created the draft (`draftId` set, mode still `create`), editing a field re-arms `requestLeaveCopy` (`Your request and its files haven’t been saved. If you leave now, they’ll be lost.`). That includes the §2.2 alert's `Go to draft`. In fact the draft is saved and the files not added are kept for the tab (§1.5); only the new field edits would be lost.

**Fix:** Once `draftId !== null`, use edit-style words, for example `Your changes to this request haven’t been saved.`, or suppress the files clause.

#### IN-503: The §2.2 alert is announced more than once

**File:** `apps/csrm/src/features/requests/request-form.tsx:275-283`

**Issue:** The shadcn `Alert` renders `role="alert"` (components/ui/alert.tsx:32), and the form also focuses it after every failing save. Its title recounts live as rows are retried or removed, and each recount is an assertive announcement. §2.2 and the accessibility contract (4.1.3) say "announced once".

**Fix:** Pass `role={undefined}` (or `role="group"` with `aria-labelledby`) and rely on the focus move. Alternatively, keep `role="alert"` and do not move focus.

#### IN-504: The closed-notes well with files only loses focus on Undo, and its toasts say "Note text"

**File:** `apps/csrm/src/features/request-notes/notes-thread.tsx:321-326, 382-384`; `apps/csrm/src/features/request-notes/unsent-note-well.tsx:73-84`

**Issue:** With files and no text, `Discard note` empties `composerFiles`, so the condition `(unsent || composerFiles.length > 0)` unmounts the well. The toast's `Undo` re-adds the files, and a new well mounts with `focusAfterRestore` false and no `Copy text` button, so focus falls to `body` (2.4.3). The toasts still read `Note text discarded.` and `Note text restored.` when only files were discarded.

**Fix:** Keep the well mounted while its discard toast is live, or have the thread focus the remounted well's `Discard note`. Use file-aware toast words (`Note discarded.` / `Note restored.`) when `files.length > 0`.

#### IN-505: `RequestAttachmentSummary` is declared twice, with no parity guard

**File:** `apps/csrm/src/features/requests/request-domain.ts:184-195`

**Issue:** The domain type copies `requestAttachmentSummarySchema` by hand (`attachments-schema.ts:86-89`), including the closed `refusal` and `allowedTypes` unions. Unlike `RequestSummaryFiles` (request-summary-schema.ts `filesParserMatchesTheDomainType`), nothing proves the two agree, so a contract change can update one and not the other without a compile error.

**Fix:** Add `true satisfies SameType<z.output<typeof requestAttachmentSummarySchema>, RequestAttachmentSummary>`, adjusting for `readonly`, or derive the domain type from the schema with a type-only import.

#### IN-506: The attachment status family adds five icons to every route that renders a status badge, the assessment editor included

**File:** `apps/csrm/src/components/csrm/status-badge.tsx:17-26, 136-142`

**Issue:** `statusPresentation` is one eager object, so `ShieldCheck`, `ShieldEllipsis`, `ShieldX`, `FileX` and `ArchiveX` now ship wherever `StatusBadge` is imported. That includes `assessment-editor.tsx`, whose first load D-27 and R-08-34 say this phase leaves untouched. The cost is small (lucide icons are tree-shaken), and 14-13 reports `performance.spec.ts` green, but the editor's budget has in fact grown, and neither 14-11 nor 14-13 records it.

**Fix:** Record the measured first-load change for the editor route in the route-budget notes. Alternatively, pass the attachment icons by name and resolve them in the attachments feature, keeping the labels in the one mapping.

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer), Lane 5_
_Depth: standard_

## Phase 14: Code Review Report, Lane 6 (web unit tests, the Playwright spec and playwright.config.ts)

**Reviewed:** 2026-10-10T14:18:09Z
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

### Summary

Scope: the Phase 14 changes (`e50053f..d3f265df`) to the web unit tests, `e2e/request-attachments.spec.ts` and `playwright.config.ts`. For each file I read the diff and, where a test's claim depended on it, the code under test. That code included `attachments-actions.ts`, `attachments-service.ts`, `file-response.ts`, `format-file-size.ts`, `refusal-copy.ts`, `server-client.ts`, `action-body-limit.ts`, `proxy.ts`, `files-list.tsx`, `sonner.tsx` and the installed Next 16.3.6 action handler.

**Harness pins (`playwright.config.ts`).** These are sound:
- Strapi is pinned to `CSRM_ATTACHMENT_STORAGE=local`, `CSRM_ATTACHMENT_SCANNER=development` and a storage directory under the run's own `mkdtemp` root, outside the tree and outside `public/`.
- Both Keycloak flags are `false`, `CSRM_AI_PROVIDER=deterministic` is set, and the run has its own ports, SQLite file and Next dist directory.
- Because storage and scanner are pinned, a developer's S3 or ClamAV variables are never read (`attachment-config.ts:87-133`).
- No EICAR string is present (`git grep` is empty). The spec carries only CSRM's own test signature.

I found no route by which the harness could reach a real store, scanner, model or IdP.

**The journeys.** They are well built: each creates its own uniquely titled request, there is one worker, and nothing uses a fixed sleep. Strong points:
- Criteria 1, 4 and 5 are proven at both widths. Downloads are compared byte for byte with the fixtures.
- The "Restore only for the remover" check is negative for Bob in both removal journeys.

**Main concerns:**
1. The Server Action body gate (D-25, T-14-49) can be bypassed through request headers. Its unit test asserts the bypass as intended behaviour.
2. The axe scans in the AI-inclusion journeys are ordered to avoid a real WCAG 2.5.8 target-size failure that the phase's own phone flow produces.
3. Success criterion 2 ("by any URL") is proven in the browser only for page URLs. No test at the web layer replays a Server Action with another Requestor's ids.
4. A boundary test is loosened so that it hides a contradictory refusal sentence.
5. The UI-SPEC's automated axe contract (pending, blocked and closed states) is never exercised in a browser.

Known items were not re-reported: the D-30 off-only switch is unit-only, and `REQ08_REASSIGN_THROUGH_PICKER` flakes.

### Warnings

#### WR-601: The 6 MB Server Action body gate can be bypassed by omitting or adding a header, and its unit test asserts the bypass

**File:** `apps/csrm/src/lib/security/action-body-limit.ts:35`, `apps/csrm/src/lib/security/action-body-limit.test.ts:56-59`, `apps/csrm/proxy.ts:78-84`, `apps/csrm/e2e/request-attachments.spec.ts:934-942`

**Issue:** `exceedsActionBodyLimit` returns `false` (admit) for any POST without a `next-action` header. Next 16.3.6 does not need that header to treat a POST as a Server Action. In `node_modules/next/dist/server/lib/server-action-request-meta.js:38`, `isMultipartAction` is set for any POST whose content type starts with `multipart/form-data`. For such a request without the header, `action-handler.js:711-735` reads the whole body through `fakeRequest.formData()` up to the global `bodySizeLimit`, now `'26mb'`. It does this before it checks whether any `$ACTION_ID_*` field is valid.

So a multipart POST of up to 26 MB without `next-action` reaches every page, `/sign-in` and `/app/risks` included. The gate never fires. This contradicts the property D-25 and the test file's header claim: "keeps the 6 MB ceiling everywhere else".

The proxy matcher adds a second hole. Its `missing` clause (`next-router-prefetch`, or `purpose: prefetch`) skips the proxy entirely, so a POST that carries either header never runs the gate. I did not verify whether Next then handles such a POST as an action.

**How the tests encode it:**
- The unit test at line 58 asserts that a 27 MB POST without `next-action` is admitted, labelled "a POST that is not a Server Action".
- The E2E test posts only with `next-action: '0'`, so neither bypass is exercised.

**Impact:** No new authorisation hole. The attachment paths already admit 26 MB for any action id. But the T-14-49 mitigation is ineffective as built, and the tests give false assurance. The real control is the reverse proxy's per-path limit (R-08-04, README), which keys on path only.

**Fix:** Gate on what Next treats as a possible action, not on the header alone, and test both bypasses:

```ts
export function exceedsActionBodyLimit(request: Pick<NextRequest, 'method' | 'headers' | 'nextUrl'>): boolean {
  if (request.method !== 'POST') return false;
  const type = request.headers.get('content-type')?.toLowerCase() ?? '';
  const possibleAction = request.headers.has('next-action')
    || type.startsWith('multipart/form-data')
    || type === 'application/x-www-form-urlencoded';
  if (!possibleAction) return false;
  // ...path and length checks as now
}
```

Also:
- Drop the prefetch `missing` exemption for non-GET methods. For example, return early for `request.method !== 'GET'` only after the gate, or move the gate into a matcher with no `missing` clause.
- Change line 58 to assert that a 27 MB `multipart/form-data` POST without `next-action` to `/app/requests` is refused.
- Add a POST carrying `next-router-prefetch: 1` to the E2E `ACTION_BODY_LIMIT_OUTSIDE_ATTACHMENT_PAGES`.

#### WR-602: The axe scans are reordered to avoid a real WCAG 2.5.8 failure that the phase ships at 375 px

**File:** `apps/csrm/e2e/request-attachments.spec.ts:610-611, 621-624, 776-777, 782-783`, `apps/csrm/src/components/ui/sonner.tsx:22-31, 47`

**Issue:** Both AI-inclusion journeys run `expectNoSeriousViolations` on the phone actions sheet before switching the file on. They then wait up to 20 s for the inclusion toast to leave before scanning the preview sheet. The comments give the reason: "Sonner's 20px Close sits over the phone actions sheet while a toast shows".

The defect is real and reachable in Phase 14's own flow. At 375 px the AI switch exists only in the actions sheet (14-UI-SPEC §5.1). Switching it on always raises the Undo toast over that open sheet. `sonner.tsx` turns on `closeButton` but enlarges only `actionButton` (`max-md:!min-h-11`), so the Close control stays 20 px. Axe's `target-size` rule flags it, as 14-16 recorded.

The UAT-012 journey claims "Axe runs at every page change". In fact it skips a scan at each moment a toast is visible after step 5:
- after the second analyst's removal (step 8);
- after the restore (step 10).

**Impact:**
- The contract row "2.5.8 Target size … phone actions meet the touch-target height" is not met.
- The defect is only "flagged for the UI review" (14-16 and 14-17 summaries). It is not a residual, and no test records it, so a fix would never be noticed and the gap is invisible to the gate.

**Fix:** Give Sonner's Close the target size, then scan with the toast showing:

```ts
const toastClassNames = {
  // ...
  closeButton: "!size-6 max-md:!size-11",
}
```

```ts
await packSwitch.click();
await expect(toastWith(page, `${PACK} included in the AI inputs.`)).toBeVisible({ timeout: 30_000 });
await expectNoSeriousViolations(page, `Bob’s AI control with the inclusion toast over the sheet at ${width}px`);
```

If the fix is deferred, record the defect explicitly instead of routing around it, for example with a scan that `disableRules(['target-size'])` and an annotation naming the residual. Correct the "every page change" comment either way.

#### WR-603: Success criterion 2 ("cannot list or download them by any URL") is proven in the browser only for page URLs; no test replays a Server Action with another Requestor's ids

**File:** `apps/csrm/e2e/request-attachments.spec.ts:210-255, 875-892`, `apps/csrm/src/features/attachments/attachments-actions.test.ts:105-175`

**Issue:** Both Secondary-Requestor checks prove the same three things:
- `GET /app/requests/{janesId}` shows the not-found state;
- `GET /app/review/requests/{janesId}` hits the role gate. That gate "answers before any read", so it never exercises the record-level rule;
- her Home and list hold none of Jane's names.

The attachment Server Actions are invocable by anyone with a session. Their ids are public in the client bundle, and every one of them takes `requestId` and `attachmentId` from client input: `listRequestAttachmentsAction`, `downloadAttachmentAction`, `setAttachmentRemovalAction` and `getAttachmentAiTextAction`. Nothing at the web layer proves that the Secondary Requestor, replaying one of them with Jane's ids, gets not-found and no bytes:
- The E2E comment defers this to "the Strapi suite".
- The unit tests mock `attachments-service`, so they cannot observe identity forwarding.
- `downloadAttachmentAction`'s tests cover no 404 at all. Only the list action's 404 is tested.

Today `createStrapiClient` forwards the session's own identity (`server-client.ts:113-118`), so I can show no live defect. But criterion 2's "any URL" includes the action endpoint, and that is the path an attacker would use. Any later change to how the web resolves identity for actions (a cached client, or a service-token fallback) would not be caught by any web or E2E test.

**Fix:** In `COLLAB02_OTHER_REQUESTOR_NOT_FOUND`:
1. Have the Secondary Requestor open her own draft's request page, where the actions are bound.
2. Intercept her own `Download` or list action with `page.route`, rewrite the `requestId` and `attachmentId` in the Flight body to Jane's (taken from Jane's step), and continue the request.
3. Assert that the response shows the not-found or family O sentence and that no `download` event fires.

Then add 404 cases to `attachments-actions.test.ts` for download, removal and AI input, asserting the exact `This file is no longer available. Refresh the page.` sentence and the absence of `bytes`.

#### WR-604: The oversize boundary test is loosened so it cannot catch a contradictory refusal sentence (criterion 3's "clear message")

**File:** `apps/csrm/src/features/attachments/attachments-domain.test.ts:117-120`, `apps/csrm/src/lib/files/format-file-size.ts:14`, `apps/csrm/src/lib/files/format-file-size.test.ts:20-25`

**Issue:** The test pins the 30 MB sentence exactly. For the file one byte over the limit (26,214,401 bytes) it asserts only the prefix `/^Files can be up to 25 MB, and this one is /`.

`formatFileSize` rounds megabytes to the nearest tenth (`toFixed(1)`), while it rounds kilobytes up. So 26,214,401 bytes, and everything up to about 26,266,000 bytes, reads `25.0 MB`. The person sees "Files can be up to 25 MB, and this one is 25.0 MB. Make it smaller or split it". That is self-contradictory copy for exactly the files nearest the limit. The prefix match cannot fail for it.

**Fix:** Round megabytes up, consistent with X-23's kilobyte rule, and pin the boundary sentence:

```ts
return `${(Math.ceil((bytes / MEGABYTE) * 10) / 10).toFixed(1)} MB`;
```

```ts
expect(justOver!.refusal).toBe('Files can be up to 25 MB, and this one is 25.1 MB. Make it smaller or split it, then add it again.');
expect(formatFileSize(26_214_401)).toBe('25.1 MB');
```

If the UI-SPEC prefers another wording, pin whatever it says. Do not leave a prefix match.

#### WR-605: The UI-SPEC's automated accessibility contract (pending, blocked and closed states, and the new-request form with a refused row) is never scanned in a browser

**File:** `apps/csrm/e2e/request-attachments.spec.ts` (whole spec), against 14-UI-SPEC "Accessibility contract", row "Automated"

**Issue:** The contract requires zero serious or critical axe violations at 375 and 1440 on several surfaces. The spec covers them like this:

| Surface the contract names | Covered in the browser? |
|---|---|
| Request pages, populated | Yes |
| Request pages, removed group open | Yes |
| Request pages, pending | No |
| Request pages, blocked | No |
| Request pages, closed (released) | No |
| The new-request form with a queue including a refused row | No. The form is scanned with three good files (line 405); the refused rows are scanned on a draft's request page (line 144) |

The harness cannot reach pending or blocked: the development double has no not-scanned or re-scan path (`scanner.ts`), and D-14 puts quarantine in the Strapi suite. So the `Waiting for malware check` and `Blocked` badges, their lines and the read-only closed section have no browser axe proof at either width. The jsdom tests cannot measure contrast or target size.

**Fix:** Add a desktop+mobile journey that renders those states. Two options:
- Seed them through the attestation-gated E2E UI-state harness (`CSRM_E2E_UI_STATE_HARNESS`, as other phases do).
- Seed attachment rows with `scanStatus: 'pending' | 'blocked'` on a request fixture, plus a released fixture.

Then scan each one. Add a scan of the new-request form after choosing a `tool.exe` beside a good file. If seeding is out of scope, record the gap in VALIDATION as an accepted partial proof rather than leaving the contract row looking satisfied.

### Info

#### IN-601: The transport test now asserts that a 404 keeps a rule name, which removes the web's only guard that D-18's "looks missing" refusal carries no reason

**File:** `apps/csrm/src/lib/api/transport/server-client.test.ts:298`

**Issue:** Phase 14 deleted `expect(normalizeTransportError(forbiddenBody({ reason: 'OWN_REQUEST' }), 404)).toEqual({ … status: 404 })`. It replaced it with `[404, 'OWN_REQUEST']` asserting that the reason is kept.

The copy functions branch on a listed reason before status. `attachmentFileRefusal` returns, for example, `ATTACHMENT_REMOVED`'s sentence ahead of the 404 row. So a reason-bearing 404 from Strapi would turn the existence-hiding "no longer available" into a sentence that confirms the record. The case also pins a nonsensical pair: OWN_REQUEST on a 404.

**Fix:** Keep the widening for 400, 413, 415 and 422, but strip reasons on 404. Restore the deleted assertion: a 404 with any reason normalises to `{ status: 404 }`.

#### IN-602: `ACTION_BODY_LIMIT … inside` is satisfied by Next's "action not found" 404 before any body is read

**File:** `apps/csrm/e2e/request-attachments.spec.ts:940-941`

**Issue:** With `next-action: '0'`, `action-handler.js:776-780` answers 404 from `getActionModIdOrError` before reading the body. `.not.toBe(413)` therefore proves only that the proxy admitted the request, not that a large body is accepted. `COLLAB02_LARGE_UPLOAD` (12 MiB) carries that claim.

**Fix:** Assert `toBe(404)` so that a 500 or a truncation cannot pass silently, and say in the title that the gate, not Next's limit, is under test.

#### IN-603: `COLLAB02_NOTE_WITH_FILES` leaves Jane's note New for the second analyst

**File:** `apps/csrm/e2e/request-attachments.spec.ts:546-551`

**Issue:** Read state is per reader (`csrm-request-note-read-state`). Bob reads the note, but Sam Analyst never does. Each project run therefore leaves one request flagged "new notes" for Sam. That breaks the WR-602 hygiene rule this suite and `request-notes.spec.ts` rely on ("a journey that leaves a note new to someone has that person read it"). No current spec counts Sam's flags, but a later exact-count journey for the second analyst would inherit them.

**Fix:** End the journey as UAT-012 does: `switchTo(page, 'Second Security Analyst')`, `goto(#notes)` and `expectNoneNewOnNextRender`.

#### IN-604: Several tests are source-text greps, not behaviour

**File:** `apps/csrm/src/features/attachments/file-ai-control.test.tsx:225-240, 325-336`, `context-too-large-files.test.tsx:64-67`, `file-text-sheet.test.tsx:129-139`, `file-store.test.tsx:170-183`, `apps/csrm/src/features/request-notes/notes-section.test.tsx:33-37`, `apps/csrm/src/lib/security/action-body-limit.test.ts:78-89`

**Issue:** Regexes such as `/^import \{[^}]*\} from '\.\/attachments-schema'/m` and `/<NotesSection[^>]*filesByNote=\{/` miss a multi-line import, an `import type` re-export or `filesByNote={{}}`. The `exceedsActionBodyLimit` ordering check uses `indexOf` on the source. File-store's "never in web storage" covers `sessionStorage` and `localStorage` but not IndexedDB, which the plan names. The behaviour tests nearby already carry most of these claims, and the boundary rules are owned by `zod-client-boundary.test.ts`.

**Fix:** Prefer the existing boundary guard or a module-graph check. For `filesByNote`, render the page content with a fixture and assert a note's chip.

#### IN-605: "Jane sees no switch" is vacuous at 375 px

**File:** `apps/csrm/e2e/request-attachments.spec.ts:665`

**Issue:** Below 768 px the switch renders only inside the phone actions sheet, which this step never opens. `page.getByRole('switch')` is therefore zero at 375 even for Bob. Line 666's check of the card's facts line carries the claim at that width.

**Fix:** At `< 768`, open Jane's `More actions for {PACK}` sheet and assert that it holds no switch and no `AI inputs` text. Alternatively, note that line 666 is the proof.

#### IN-606: Family O's tests pin download-worded sentences for remove and restore, and "change" wording for a refused download

**File:** `apps/csrm/src/lib/api/refusal-copy.test.ts:486, 502-507`

**Issue:** The loop `for (const action of actions)` pins these sentences:
- restoring a blocked file reads "Malware was found in this file, so it can’t be downloaded.";
- removing an already removed file reads "…so it can’t be downloaded. Refresh the page.";
- a 403 on a download reads "You can’t change this request’s files."

This follows §8.2's reason-keyed table literally, but the copy reads wrongly for the action taken.

**Fix:** Raise it with the UI-SPEC owner. If the per-action wording changes, pin each action separately.

#### IN-607: The harness deletes the run's attachment store even when it keeps the failed run's database for debugging

**File:** `apps/csrm/playwright.config.ts:56-58, 112-135, 247`

**Issue:** `CSRM_ATTACHMENT_LOCAL_DIR` lives under `e2eRuntimeRoot`, and `process.once('exit')` always removes that directory. Meanwhile the run's SQLite database and builds are kept when the run fails (`keep-failed`). A kept database then references stored objects that no longer exist, and every file reads `File unavailable` when a developer replays the failure. The working tree stays clean either way.

**Fix:** Place the attachment store beside the run's database, among `runArtifactPaths`, so that it follows the same keep-or-remove disposition. Also print its path in the "kept for debugging" report.

---

_Reviewed: 2026-10-10T14:18:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Phase 14: Code Review Report, Lane 7 (docs, the contract and config)

**Reviewed:** 2026-10-11
**Depth:** standard (each file reviewed by its `e50053f..d3f265df` diff; the specification, catalogue, served-operations and lockfile by their Phase 14 diff only, with the implementation read wherever a claim needed checking)
**Files Reviewed:** 13
**Status:** issues_found

### Summary

These checks passed:

- **Grants.** The catalogue grants `function.risk_assessment_requests.attachments_api` only to `role.requestor` and `role.security_analyst`, and `attachment_ai_input_api` only to `role.security_analyst`. `role.security_analyst_agent` holds neither (checked by parsing the roles). Both operations of `attachment_ai_input_api` are in `HUMAN_ANALYST_ONLY_OPERATIONS` (`csrm-authorization.ts:86-87`). The two catalogue copies are byte-identical (`cmp` exits 0).
- **Served operations.** `served-operations.json` adds the six new routes with the right FunctionApi ids and roles. It drops the five upload plugin routes and rewords the documented-unserved reasons.
- **Specification against the code.**
  - The paths, methods, closed bodies and `additionalProperties: false` match the router (`routes/request-attachments.ts`) and the controller's body parsers.
  - The download's four header constants match `send-stored-file.ts`.
  - The reason enum matches `conflict-reasons.ts`, and each reason's status matches the service (400, 403, 409, 413, 415, 422).
  - The `detection` pattern equals `SERVED_DETECTION`.
- **Contract-gap record.** The attribute table matches `schema.json` attribute for attribute. The pilot's approval line is verbatim. Affected Workstreams names `csrm` only.
- **Design direction.** X-19 to X-23 are verbatim copies of the 14-UI-SPEC wording (checked by string comparison).
- **Glossary.** The `Attachment` entry uses JDL terminology and introduces no competing entity.
- **Dependencies.**
  - `package.json` adds exactly three exact pins.
  - In the lockfile, `fflate` resolves only to 0.8.3. No added package has `requiresBuild`. The only removed lines are `openai`'s lockfile re-key.

No grant or deployment instruction exposes files publicly, so there is no Critical finding. The defects found are in three areas:

- **The README's S3 storage guidance.** Under the versioning it requires, malware is never actually deleted. The lifecycle advice can make files impossible to download. The IAM list breaks the cleanup of failed multipart uploads.
- **Contract changes beyond the approved record.**
- **A set of smaller inaccuracies** in the residual register, the hardening document and the spec descriptions.

### Warnings

#### WR-701: The specification changes existing endpoints that the approved record does not list, and contradicts the record on the Requestor's shapes

**File:** `docs/references/specification.json:25881`, `:27154`, `:26851`, `:27202`, `:25976`; `docs/contract-gaps/phase-14-request-attachments.md:110`, `:363-369`, `:410`

**Issue:** The pilot approved "the operations exactly as this record states them" (record line 410). The record's "changes to existing endpoints" (lines 363-369) lists five changes, and "What the pilot checked" (line 419) repeats them. The shipped contract changes more than that:

1. **`failureAttachments` on two existing job reads.** A `failureAttachments` array (`GenerationJobFailureAttachment`: `documentId` plus the current `fileName`) is added to `AssessmentDraftJobFailed` (`:25881`) and to `QuestionnaireGenerationJob` (`:27154`). Those are the existing generation-job and draft-job reads. Neither the record nor the pilot's checklist mentions this field. The record only says that the failure *message* names the files (line 310).
2. **`files` is now required on the Requestor's shapes.** `files` becomes a required key on `AssessmentRequestSummary` (`:26851`) and on the questionnaire's request summary (`:27202`), served as `null` to the Requestor. The implementation does this too (`files: requestFacts?.files ?? null` in `questionnaire-scope.ts` and `assessment-scope.ts`). The record says twice that "The Requestor's shapes are unchanged" (lines 110 and 367), which is false: every Requestor read of those summaries now carries a new required key.
3. **`requestId` on `AiRunContextAttachment`.** `AiRunContextAttachment` (`:25976`) serves `requestId`, which the record's v3 shape (lines 316-321) and "Names at read time" (line 325) do not mention. Only the read-time `fileName` and `removed` are covered.

Each change is additive and reaches only `csrm`, but the approval is scoped to the record as written. The closed parsers (`additionalProperties: false`) make the second change a shape change for any strict reader.

**Fix:** Amend the record's "Affected Workstreams" and the "What the pilot checked" list with:

- `failureAttachments` on the two job schemas;
- the `files: null` key on the Requestor's summaries;
- `requestId` on the v3 attachment entry.

Then get the pilot's dated acknowledgement for the amendment (G-6), or remove the unapproved fields.

#### WR-702: Under the required versioning, malware is not deleted for at least 7 years, which contradicts D-21, the record and R-08-43

**File:** `apps/backend/README.md:146-148,151`; `docs/security/phase-08-residual-risks.md:114`; `docs/contract-gaps/phase-14-request-attachments.md:215`

**Issue:** Three documents say the infected bytes are deleted:

- the record (line 215): "A re-scan's infected verdict deletes the stored bytes";
- R-08-43's compensating control (line 114): "an infected one blocks it and deletes its bytes and plugin file record (D-21)";
- D-21 itself.

In production this is not true:

- **Step 4** of the README makes versioning mandatory.
- **The provider's `delete`** sends a plain `DeleteObject` with no `VersionId`, so S3 only adds a delete marker.
- **Step 5** then requires that noncurrent versions expire "no earlier than 7 years".

The README admits this at line 151 ("leaves a noncurrent version"). The result is that confirmed-malicious content stays in the attachment bucket for at least 7 years. Anyone with `s3:GetObjectVersion`, a restore or a replication rule can read it. Neither the residual register nor the record shows this, and R-08-43 tells an assessor the opposite.

**Fix:** Choose one:

- Delete the specific version for blocked files. Grant `s3:DeleteObjectVersion` on the prefix and pass the `VersionId` from the upload response.
- Tag the object at block time (for example `csrm-blocked=true`) and add a lifecycle rule that expires noncurrent versions with that tag after one day.

Then correct R-08-43 and the record line. If the 7-year retention of blocked bytes is accepted, record it as its own residual with an owner.

#### WR-703: The lifecycle guidance allows storage classes that make downloads and AI extraction fail with 500

**File:** `apps/backend/README.md:147`

**Issue:** Step 5 says to use lifecycle rules "to move objects to a colder storage class" with no restriction.

- **S3 refuses the read.** An object moved to S3 Glacier Flexible Retrieval or Deep Archive (or to Intelligent-Tiering's archive tiers) answers `GetObject` with 403 `InvalidObjectState` until it is restored.
- **CSRM turns that into a 500.** The storage port accepts only a 200 (`storage-port.ts:124`) and throws `STORAGE_READ_FAILED`. `readVerifiedStoredFile` rethrows anything other than missing or a bad key (`send-stored-file.ts:37`).
- **What breaks.** Every download of an archived file becomes a 500 rather than a closed refusal. AI inclusion and extraction of it fail. Files on long-running requests would hit this as soon as the rule transitions them, well inside the 7-year retention.

**Fix:** Restrict step 5 to storage classes with immediate `GetObject`: S3 Standard-IA, Glacier Instant Retrieval, or Intelligent-Tiering without the opt-in archive tiers. State explicitly that Glacier Flexible Retrieval and Deep Archive must not be used for current objects.

#### WR-704: The IAM scope omits `s3:AbortMultipartUpload`, and no lifecycle rule cleans up incomplete multipart uploads

**File:** `apps/backend/README.md:147-148`

**Issue:** `@strapi/provider-upload-aws-s3` 5.51.0 stores every file through `@aws-sdk/lib-storage`'s `Upload` (`dist/index.js:268`). Above its 5 MiB default part size, that is a multipart upload, so most attachments (the limit is 25 MiB) are uploaded in parts.

- **Abort is denied.** When an upload fails part-way, `lib-storage` calls `AbortMultipartUpload`, because `leavePartsOnError` defaults to false. The README's least-privilege list (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`) does not include `s3:AbortMultipartUpload`, so the abort fails.
- **The parts are kept.** Uploaded parts of screened attachment bytes stay in the bucket indefinitely. They are invisible to listings, versioning and the lifecycle rules in step 5, they cost money, and CSRM can never delete them.

**Fix:**

- Add `s3:AbortMultipartUpload` on `arn:aws:s3:::<bucket>/csrm/attachments/*` to step 6.
- Add an `AbortIncompleteMultipartUpload` lifecycle rule (for example after 1 day) to step 5.

#### WR-705: The S3 endpoint may be plain HTTP, and nothing in the deployment guidance requires TLS

**File:** `apps/backend/README.md:126`; `apps/backend/.env.example:61-62`; implementation `apps/backend/src/csrm/files/attachment-config.ts:109`

**Issue:** `CSRM_ATTACHMENT_S3_ENDPOINT` accepts an `http:` URL (`attachment-config.ts:109` admits both `http:` and `https:`), and the README and `.env.example` describe it without any transport requirement. An operator pointing at an internal S3-compatible store over `http://` would send every attachment's bytes, and every 60-second presigned read, in cleartext.

The README's bucket steps also lack the usual `aws:SecureTransport` deny statement, so nothing on the bucket side forces TLS either.

**Fix:**

- **Documentation:** state in the README's settings table and in the `.env.example` comment that the endpoint must be `https://`. Add a bucket-policy step that denies `s3:*` when `aws:SecureTransport` is `false`.
- **Configuration:** have `attachment-config.ts` refuse `http:` outside the development key, so a mistake stops the boot like every other invalid S3 setting. This is a change for the implementation lane.

### Info

#### IN-701: The hardening document's middleware table, edited in this phase, still leaves out the Keycloak identity middleware

**File:** `docs/security/strapi-http-hardening.md:15-25`; `apps/backend/config/middlewares.ts:9`

**Issue:** "Middleware order as configured" now numbers 11 entries and places `global::csrm-multipart-cleanup` at 8. The configuration has 12: `global::csrm-keycloak-identity` sits between the development identity middleware and `strapi::security`. Phase 14 renumbered rows 8 to 11 without restoring the missing row, so every number from 4 onwards is off by one against the file the table claims to mirror.

**Fix:** Insert `global::csrm-keycloak-identity` as row 4 and renumber the rows below it.

#### IN-702: R-08-44 says administrators can download attachments, which is not what the shipped configuration does; it also omits that Media Library uploads land unscanned beside attachments

**File:** `docs/security/phase-08-residual-risks.md:115`; `apps/backend/README.md:181`

**Issue:** R-08-44 says "an administrator with Media Library rights can download or delete one". Neither provider allows a download:

- **S3:** the provider's `isPrivate()` returns `config.params.ACL === 'private'` (`dist/index.js:328`), and CSRM sets `ACL: undefined`. The admin panel therefore uses the stored, unsigned object URL, which Block Public Access answers with 403.
- **Local:** the private provider records a `/csrm-private/` URL that nothing serves.

So administrators can delete files but not download them. The residual overstates the exposure, which errs on the safe side, but it is still inaccurate.

The row also does not record that an administrator's Media Library upload is never content-checked or malware-scanned by CSRM, and is stored under the same `csrm/attachments/` prefix and IAM scope.

**Fix:** Correct the wording to "can see and delete". Add the unscanned Media Library uploads sharing the prefix, with the same super-admin recommendation.

#### IN-703: The `AiRunContextSummary` description says it holds no file free text, but v3 serves the uploader's file name

**File:** `docs/references/specification.json:25944-25946`, `:25976-25992`

**Issue:** The description reads "with no Requestor, note or file free text". The v3 `AiRunContextAttachment` serves `fileName`, which is uploader-supplied free text, resolved when the run is read. The stored envelope holds no name, which matches G-3, but the served schema the description documents does.

**Fix:** Reword, for example: "the stored summary holds no free text; on the read, each file's current name is resolved from its attachment record".

#### IN-704: `RequestAttachment.detection` is not held to the 422's detection pattern, and the projection's fallbacks can serve values outside the schema

**File:** `docs/references/specification.json:25532` (and `fileName`, `byteSize` and `uploadedAt` in the same schema); implementation `apps/backend/src/api/csrm-request-attachment/services/attachment-projection.ts:136-148`

**Issue:**

- **Detection.** The list serves a blocked file's `detection` to every reader, the Requestor included, with only `maxLength: 128`. The same value on the 422 is bound by `^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$`, and the projection passes `scanDetection` through without that check.
- **Fallbacks.** The projection falls back to `fileName: ""`, `uploadedAt: ""`, `byteSize: 0` and `fileType: "txt"` for a malformed record. Those values violate the published `minLength: 1`, `format: date-time` and `minimum: 1`, and `"txt"` silently mislabels the file.

**Fix:**

- Give `RequestAttachment.detection` the same `pattern`, and serve `null` when the stored value does not match it.
- Make the projection skip or refuse a malformed record rather than invent values.

#### IN-705: The new controller writes `data: null` beside `error`, although the error schema is closed

**File:** implementation `apps/backend/src/api/csrm-request-attachment/controllers/request-attachments.ts:49`; `docs/references/specification.json:25762` (`AssessmentWorkflowErrorResponse`: `additionalProperties: false`, properties `error` only)

**Issue:** R-08-38 accepts `data: null` as a quirk of Strapi's framework error envelope. Here, CSRM's own hand-written `refuse()` builds `{ data: null, error: … }`, which every one of the six new operations' published error responses forbids. R-08-38 was not amended to cover new code that reproduces the quirk on purpose.

**Fix:** Drop `data: null` from `refuse()`, or declare `data: null` in the error schema and amend R-08-38.

#### IN-706: The binary rule also marks the fixtures' README as binary

**File:** `.gitattributes:9`

**Issue:** `apps/backend/tests/fixtures/attachments/** binary` covers `README.md`. `git check-attr` reports `binary: set`, `diff: unset` and `text: unset` for it, so every change to the README, which records how each fixture was built and its known text, appears as "Binary files differ" in diffs and reviews.

**Fix:** Add `apps/backend/tests/fixtures/attachments/README.md text diff` after the rule, or scope the rule to the fixture extensions (`*.pdf`, `*.docx`, `*.xlsx`, `*.pptx`, `*.png`, `*.jpg`).

#### IN-707: The `.env.example` S3 example values look like real names in a global namespace

**File:** `apps/backend/.env.example:58,60`

**Issue:** `CSRM_ATTACHMENT_S3_BUCKET=csrm-attachments` and `CSRM_ATTACHMENT_S3_KMS_KEY_ID=alias/csrm-attachments` are plausible real names. S3 bucket names are global, so an operator who uncomments the block unchanged would address whichever account owns `csrm-attachments`.

SSE-KMS under the operator's own key limits what that owner could read. If the IAM policy was written with the same example name, though, the uploads would still leave the operator's account.

**Fix:** Use obvious placeholders (`<your-bucket>`, `<kms-key-arn>`). In README step 6, recommend an `s3:ResourceAccount` condition so the role can never write to a bucket in another account.

#### IN-708: The lockfile adds two low-profile transitive packages that the recorded legitimacy check does not cover

**File:** `pnpm-lock.yaml` (snapshots `read-excel-file@9.3.10`, `unzipper-esm@0.13.3`, `worker-f@0.1.20`, `node-int64@0.4.0`)

**Issue:** `read-excel-file` brings in `unzipper-esm` 0.13.3 and `worker-f` 0.1.20 (plus `node-int64` and `graceful-fs`).

- **Not used at runtime.** CSRM loads only `read-excel-file/universal`, which does not reference them; only the package's Node entry does. They still ship in production `node_modules`.
- **Not assessed.** The pilot's verbatim legitimacy answer in the 14-02 summary covers `saxen` by name but not these two packages. The plan's checks cover them only collectively: no install scripts across the 90 new packages, and an audit with zero findings.

**Fix:** Add a line to 14-02's justification naming both packages, their maintainers and licences, and stating that the code path CSRM loads never uses them. Alternatively, record them on the next dependency pass's watch list.

#### IN-709: The retention statements overstate what lifecycle rules do, and the README misses one case where CSRM deletes bytes

**File:** `docs/contract-gaps/phase-14-request-attachments.md:272`; `apps/backend/README.md:147`

**Issue:**

- **Lifecycle cannot enforce a minimum.** The record says "In production the bucket's lifecycle rules enforce retention (G-7)". S3 lifecycle rules can only expire or transition objects. Only Object Lock can enforce a minimum retention. The README's own step 5 correctly says the rules must merely never expire current objects. Nothing prevents early deletion: Strapi's role holds `s3:DeleteObject` on the whole prefix, and only versioning makes a deletion recoverable.
- **A third deletion case.** The README says CSRM deletes a file's bytes "only for a blocked (infected) file and when the Media Library deletes one". It also deletes them when a refusal under the request lock arrives after storage (D-10, the count race; record line 223).

**Fix:**

- Reword the record: "lifecycle rules never expire current objects; versioning makes a deletion recoverable". Note that Object Lock is not used because blocked files must be deletable.
- Add the late-refusal case to the README sentence.

---

_Reviewed: 2026-10-11_
_Reviewer: Claude (gsd-code-reviewer), Lane 7_
_Depth: standard_
