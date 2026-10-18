---
phase: 14-request-attachments
plan: 02
subsystem: file-reading
tags: [zip, ooxml, pdf, xlsx, worker-threads, unpdf, read-excel-file, supply-chain, fixtures]
requires:
  - phase: 14-request-attachments
    provides: "14-01: the approved request attachments record (the D-31 to D-33 extraction rules) and PHASE_14_BASE"
provides:
  - "csrm/files/zip-archive.ts: the backend's one ZIP reader, refusing hostile archives from the central directory before inflating (Phase 19's guard calls it)"
  - "csrm/files/ooxml-text.ts: a DTD-free OOXML tokenizer, the main-part type and macro check, and DOCX and PPTX text"
  - "csrm/spreadsheets/xlsx-reader.ts: the one read-excel-file wrapper (readWorkbookSheets, xlsxCellText), bounded and refusing a DOCTYPE; Phase 19 extends it"
  - "csrm/files/extraction.ts and extraction-worker.ts: probePdf and extractAttachmentText in a single-slot worker with heap and time limits, giving normalised, capped text"
  - "unpdf 1.8.1, read-excel-file 9.3.10 and @strapi/provider-upload-aws-s3 5.51.0 as exact pins in apps/backend"
  - "Six committed fixtures with a README, deterministic builders (PDF, password PDF, scanned PDF, DOCX, XLSX, PPTX, PNG, JPEG stub, hostile ZIPs) and the .gitattributes binary rule"
affects: [14-03, 14-04, 14-09, 14-16, 14-17, 19]
actuals:
  tokens: 36946
  tasks: 3
  commits: 9
plan_head_before: 54002814c2efe46b689e877524f4d14a09123f52
plan_head_after: e54b6392c43d24b39d6d2ab17b60ee3f9d149c71
tech-stack:
  added: ["unpdf 1.8.1", "read-excel-file 9.3.10", "@strapi/provider-upload-aws-s3 5.51.0"]
  patterns:
    - "Hostile-file parsing runs in a worker_threads Worker with maxOldGenerationSizeMb and a wall-clock terminate(). One worker runs at a time, and a call settles only after its worker has exited."
    - "Every inflate goes through CSRM's ZIP reader (declared size, ratio, size and CRC-32 checks). Third-party parsers get the bytes only after it."
    - "Each committed binary fixture is byte-for-byte its builder's output, and a unit test checks it."
key-files:
  created:
    - apps/backend/src/csrm/files/zip-archive.ts
    - apps/backend/src/csrm/files/ooxml-text.ts
    - apps/backend/src/csrm/spreadsheets/xlsx-reader.ts
    - apps/backend/src/csrm/files/extraction.ts
    - apps/backend/src/csrm/files/extraction-worker.ts
    - apps/backend/tests/helpers/attachment-fixtures.ts
    - apps/backend/tests/zip-archive.unit.test.ts
    - apps/backend/tests/attachment-extraction.unit.test.ts
    - apps/backend/tests/fixtures/attachments/README.md
    - apps/backend/tests/fixtures/attachments/vendor-security-pack.pdf
    - apps/backend/tests/fixtures/attachments/data-flow.docx
    - apps/backend/tests/fixtures/attachments/vendor-questionnaire.xlsx
    - apps/backend/tests/fixtures/attachments/architecture-deck.pptx
    - apps/backend/tests/fixtures/attachments/diagram.png
    - apps/backend/tests/fixtures/attachments/photo.jpg
  modified:
    - apps/backend/package.json
    - pnpm-lock.yaml
    - .gitattributes
    - apps/backend/tests/tsconfig.json
key-decisions:
  - "The pilot approved the three exact pins at the package-legitimacy checkpoint: unpdf@1.8.1, read-excel-file@9.3.10 and @strapi/provider-upload-aws-s3@5.51.0, with saxen@11.2.0 accepted as a transitive dependency (G-7, T-14-SC)."
  - "One worker at a time for both extraction and the PDF open check (one single-slot queue). The bytes are copied once into a fresh ArrayBuffer that is transferred, so the caller's buffer, or a pooled Buffer's, is never detached."
  - "available and kept are counted after normalisation, in the worker, page by page for PDF. Text that is empty or only whitespace after normalisation is ATTACHMENT_TEXT_UNAVAILABLE."
  - "readWorkbookSheets bounds every part read-excel-file inflates (.xml and .xml.rels, not only worksheets and shared strings). It reads each part through readZipEntry (exact size and CRC-32) and refuses a DOCTYPE or ENTITY before the library sees the bytes."
  - "read-excel-file/universal resolves under the backend's node10 resolution through its folder package.json, so no fallback entry was needed. It is loaded lazily, and EXTRACTOR_VERSION uses XLSX_READER_ENGINE so that xlsx-reader.ts is the only source file naming the library."
patterns-established:
  - "Worker isolation: extraction.ts runWorker (resourceLimits, timer, terminate, drained output, closed-code replies)"
  - "Fixture builders plus a --write entry, and a byte-equality test against the committed files"
requirements-completed: []  # COLLAB-02 is traced here but completes at the 14-17 gate
coverage:
  - id: D1
    description: "Bounded, dependency-free ZIP reader and DTD-free DOCX and PPTX text (Task 1)"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/zip-archive.unit.test.ts; apps/backend/tests/attachment-extraction.unit.test.ts (tokenizeXml, ooxmlMainPart, docxText, pptxText)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three exact-pinned dependencies, verified (fflate 0.8.3 only, no install scripts, audit 0 over their tree, pnpm's supply-chain policy passing)"
    requirement: COLLAB-02
    verification:
      - kind: other
        ref: "pnpm --dir apps/backend why fflate; npm audit over the three packages' lockfile; install-script scan over the 90 newly locked packages"
        status: pass
    human_judgment: false
  - id: D3
    description: "Worker-isolated PDF, DOCX, XLSX, PPTX, CSV and TXT extraction with the 20,000-character cap, normalisation and the heap, wall-clock and queue limits"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-extraction.unit.test.ts"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend test (997/997)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Six committed fixtures equal to their builders, with a README and the .gitattributes binary rule"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-extraction.unit.test.ts#the committed fixtures are exactly the builders' output, and the README names each with its builder"
        status: pass
    human_judgment: false
duration: 55min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 02: Bounded File Reading, Dependencies and Fixtures Summary

**CSRM now reads attached files safely. An Office package goes through CSRM's own bounded ZIP reader and DTD-free OOXML scanner. A PDF goes through pdf.js (from `unpdf` 1.8.1, `isEvalSupported: false`). An XLSX goes through the one `read-excel-file` 9.3.10 wrapper. All of it runs in a worker with a 768 MB heap limit, a 30 s wall clock and one extraction at a time, giving NFC-normalised text capped at 20,000 characters. The three dependencies are exactly pinned and passed every supply-chain check.**

PHASE_14_BASE=e50053f

## Performance

- **Duration:** about 55 min of executor time across two sessions. Task 1 ran 2026-10-10 03:05 to 03:13 +11:00. Task 3 and this summary ran 03:17 to 04:35 +11:00, after the pilot's answer, including two 17-minute full Strapi suites.
- **Completed:** 2026-10-10
- **Tasks:** 3 of 3 (Task 2 was the pilot's checkpoint)
- **Files:** 19 (3,300 lines added, 3 removed, the lockfile included)

## Accomplishments

- **ZIP reader** (`zip-archive.ts`, `node:` only). It finds the end record in the last 65,557 bytes. Before inflating anything, it refuses:
  - ZIP64 (`ZIP64_UNSUPPORTED`);
  - more than 10,000 entries (`ZIP_TOO_MANY_ENTRIES`);
  - more than 1 GiB declared (`ZIP_TOO_LARGE`);
  - more than 200:1 for any entry (`ZIP_RATIO`);
  - the encryption flag (`ZIP_ENCRYPTED`);
  - a method other than stored or deflate (`ZIP_METHOD_UNSUPPORTED`);
  - bad offsets, duplicates or overlaps (`ZIP_MALFORMED`).

  Each inflate is bounded (`ZIP_INFLATE_LIMIT`) and checked against its declared size and CRC-32.
- **OOXML scanner** (`ooxml-text.ts`):
  - `tokenizeXml` refuses `<!DOCTYPE` and `<!ENTITY`.
  - `ooxmlMainPart` gives the main type and whether the package has macros.
  - `docxText` reads paragraphs, tables as tab-separated rows and insertions. It never reads deleted text, comments, field instructions or `mc:Fallback`.
  - `pptxText` reads slides in `p:sldIdLst` order and never reads speaker notes.
- **Dependencies:** `unpdf` 1.8.1, `read-excel-file` 9.3.10 and `@strapi/provider-upload-aws-s3` 5.51.0, exact pins in `apps/backend/package.json`. Nothing was added to `apps/csrm`.
- **XLSX reader** (`xlsx-reader.ts`):
  - It checks the archive, then the declared size of every part the library inflates against 128 MiB.
  - It reads each of those parts itself (exact size and CRC-32, no DOCTYPE or ENTITY).
  - Only then does it call `read-excel-file/universal` with `trim: false`. It returns typed cells: text, numbers, booleans, UTC dates and `null`. Formulas give their cached values.
  - `xlsxCellText` gives `YYYY-MM-DD`, `TRUE`/`FALSE` and `String(n)`.
- **Extraction** (`extraction.ts`, `extraction-worker.ts`):
  - `EXTRACTION_LIMITS` is `{ heapMb: 768, wallClockMs: 30_000, pdfProbeMs: 10_000 }`.
  - A single-slot queue runs one worker at a time. The bytes are transferred to it.
  - On overrun, `terminate()` stops the worker, and a call settles only after its worker has exited.
  - `probePdf` gives `ok`, `password` or `invalid`.
  - `extractAttachmentText` gives `{ text, available, kept, truncated, extractor }` or `ATTACHMENT_TEXT_UNAVAILABLE`.
  - PDF pages are read one at a time with `cleanup()`. unpdf's `extractText` is never called.
  - CSV and TXT are decoded as UTF-8, or as UTF-16LE/BE after their byte order mark.
  - `normaliseExtractedText` converts CRLF and CR to LF, removes C0, C1 and DEL except tab and line feed, and applies NFC.
  - `EXTRACTOR_VERSION` is `csrm-extract/1 unpdf/1.8.1 read-excel-file/9.3.10`.
- **Fixtures:** `vendor-security-pack.pdf` (with UAT-013's fact), `data-flow.docx`, `vendor-questionnaire.xlsx`, `architecture-deck.pptx`, `diagram.png` and `photo.jpg`. All six were written once by `attachment-fixtures.js --write`. The README names each file's builder and known text. `.gitattributes` now has `apps/backend/tests/fixtures/attachments/** binary`.

## Checkpoint: package legitimacy (Task 2)

The pilot's answer, verbatim:

> approved — install exactly `unpdf@1.8.1`, `read-excel-file@9.3.10` and `@strapi/provider-upload-aws-s3@5.51.0`, then continue 14-02 Task 3.
>
> The pilot's legitimacy answer, checked on 2026-10-10 against the npm registry's metadata and the published files. Record it verbatim in 14-02-SUMMARY.md:
>
> - **`@strapi/provider-upload-aws-s3@5.51.0`: legitimate.**
>   - Source and maintainers: published from the official `strapi/strapi` monorepo by Strapi's maintainers (pierreburgy, alexandrebodin, convly and others).
>   - Version: it matches the installed `@strapi/strapi` 5.51.0 (G-7). Its "too-new" flag comes only from newer releases of the same package.
>   - Dependencies: `lodash` 4.18.1 and the official AWS SDK v3 packages (`client-s3`, `lib-storage`, `s3-request-presigner` 3.1023.0, `types` 3.973.6).
>   - Scripts: none run at install (only lint, build and test).
>   - Licence: its "SEE LICENSE IN LICENSE" points to Strapi's standard LICENSE, which is MIT Expat for everything outside an `ee/` directory. The published package has 15 files and none under `ee/` (checked with unpkg's file listing), so the package is MIT.
> - **`saxen@11.2.0` (transitive, through `read-excel-file`'s `^11.1.0`): legitimate.**
>   - MIT, from `nikku/saxen` (the bpmn-io maintainer).
>   - Published 2026-09-21, 19 days before the install. 11.1.1 (2026-07-27) also exists.
>   - Install-time scripts: none. Its `prepare` script never runs for a registry tarball. Accepted at 11.2.0, pinned with its integrity hash by the lockfile.
> - **`read-excel-file@9.3.10` and `unpdf@1.8.1`:** MIT, from reputable maintainers (catamphetamine; unjs/johannschopplich), with no install-time scripts.
>
> Keep to the plan's own checks:
> - exact pins;
> - `pnpm why fflate` at 0.8.3;
> - no package running an install script (do not add any to `allowBuilds`);
> - `npm audit` as the plan says;
> - the pnpm supply-chain verification passing.
>
> If pnpm's policy refuses a package, stop and report rather than adding an exception.

Before the install: `git diff e50053f -- apps/backend/package.json pnpm-lock.yaml` was empty, and the tree was clean.

## Install and supply-chain checks

- **Command:** `pnpm --dir apps/backend add unpdf@1.8.1 read-excel-file@9.3.10 @strapi/provider-upload-aws-s3@5.51.0 --save-exact` (pnpm 11.24.0, Node 24.19.0). Exit 0, with 90 packages added. pnpm's policy refused nothing.
- **Exact versions in `apps/backend/package.json`:** `"@strapi/provider-upload-aws-s3": "5.51.0"`, `"read-excel-file": "9.3.10"`, `"unpdf": "1.8.1"`. `apps/csrm/package.json` is unchanged.
- **Resolved transitives:** `saxen` 11.2.0, `fflate` 0.8.3, `unzipper-esm` 0.13.3, `worker-f` 0.1.20, and the AWS SDK v3 packages at 3.1023.0.
  - **2026-10-11, stage B (IN-708):** `unzipper-esm` 0.13.3 (MIT; `catamphetamine/node-unzipper`, an ESM fork of `unzipper` whose `package.json` names Ziggy Jonsson as author; it depends on `graceful-fs` 4.2.11 and `node-int64` 0.4.0) and `worker-f` 0.1.20 (MIT; by catamphetamine, `gitlab.com/catamphetamine/worker-f`; no dependencies) declare no install-time script. CSRM loads only `read-excel-file/universal`, whose code path never uses them: its reachable requires and imports name only `fflate` (and `saxen` on the ESM path); only the package's Node, browser and web-worker entries require them. 14-02-PLAN's dependency justification carries the same line.
- **`pnpm --dir apps/backend why fflate`**, verbatim:

  ```
  fflate@0.8.3
  └─┬ read-excel-file@9.3.10
    └── @csrm/strapi@0.1.0 (dependencies)

  Found 1 version of fflate
  ```

- **Install scripts:** none of the 90 newly locked packages declares a `preinstall`, `install` or `postinstall` script or has a `binding.gyp`. Each package's `package.json` in the store was checked. `pnpm-workspace.yaml` (and so `allowBuilds`) is unchanged.
- **`npm audit`:** I ran it the way the research did, over a scratch `package-lock.json` holding only the three packages (`npm install --package-lock-only --ignore-scripts`). Result: `{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}` over 117 packages. `pnpm --dir apps/backend audit --prod` covers the whole workspace and reports 71 advisories (4 low, 40 moderate, 23 high, 4 critical). None is on any of the 90 newly locked packages, and none has a path through the three new dependencies. They are on packages already in the tree (for example `next` and `dompurify`).
- **pnpm supply-chain verification:** the install's run and a later `pnpm install --frozen-lockfile` both printed `✓ Lockfile passes supply-chain policies` ("verified 1m ago", meaning the new lockfile was verified during the add).
- **One lockfile re-key:** `openai` stays at 7.15.0. Only its lockfile key changed, because its optional peers (`@aws-sdk/credential-provider-node`, `@smithy/hash-node`, `@smithy/signature-v4`) are now present through the S3 provider.

## Measurements

| Input | Worker wall time | Peak worker heap |
|---|---|---|
| `vendor-security-pack.pdf` (1,457 bytes, 288 characters) | 68 ms (69 ms through `extractAttachmentText`) | 10.4 MB |
| `vendor-questionnaire.xlsx` (3,647 bytes) | 53 ms | 9.1 MB |
| A 300-page PDF, 3,000,000 characters (3.3 MB) | 805 ms | 112.6 MB |

I measured these with `worker.getHeapStatistics()` on Node 24.19.0, on the compiled worker with the 768 MB limit.

**`read-excel-file` entry:** `read-excel-file/universal`, the plan's choice. It resolves under the backend's CommonJS / node10 resolution through `universal/package.json` (`types: ./index.d.ts`, `main: index.cjs`), so no fallback was needed. It is loaded lazily with `import()`, which compiles to `require`.

## Task Commits

1. **Task 1** (previous session):
   - `50c2a7f`: test, expect a bounded ZIP reader and DTD-free Office text (RED)
   - `1fcfc76`: feat, the ZIP reader and OOXML scanner (GREEN)
2. **Task 2:** checkpoint:human-verify (blocking-human), answered "approved" by the pilot. No executor commit. The orchestrator's checkpoint records are `3a9d06e` and `4c40bd4`.
3. **Task 3:**
   - `fa1cdda`: build, add unpdf, read-excel-file and the Strapi S3 upload provider (with the justification table)
   - `af9207b`: test, expect bounded worker extraction for every text-bearing type (RED)
   - `adb0b24`: feat, extract file text in a bounded worker through the shared readers (GREEN)
   - `2420445`: test, expect an XLSX whose XML declares a DOCTYPE to be refused (RED, deviation 7)
   - `e54b639`: fix, refuse a DOCTYPE in any XLSX part before the library parses it (GREEN)

Commit count: `git rev-list --count 5400281..HEAD` is 9 before this summary's commit. That includes the orchestrator's `3a9d06e` and `4c40bd4`. The plan's own commits, counted by their `(14-02)` scope, are 7. `plan_head_before` is `5400281`, the parent of the plan's first commit.

## Verification

- **RED for Task 3:** I compiled against throwing stubs of the three new modules and got `# tests 33 / # pass 12 / # fail 21`. All 21 new tests failed on their assertions, and Task 1's 12 passed. As committed in `af9207b`, `tsc` fails because the modules do not exist yet. The DOCTYPE test's RED was `# tests 48 / # pass 47 / # fail 1` ("Missing expected rejection").
- **Focused files** (`zip-archive.unit.test.js`, `attachment-extraction.unit.test.js`): **`# tests 48 / # pass 48 / # fail 0`**.
- **Backend typecheck:** `tsc --noEmit` and `tsc -p tests/tsconfig.json` are clean.
- **Full Strapi suite** (`pnpm --dir apps/backend test`): **`# tests 997 / # pass 997 / # fail 0`** (1,009 s), run on the final code at `e54b639`. The run before the DOCTYPE fix, at `adb0b24`, was 996/996/0.
- **EICAR guard:** `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing.
- **Acceptance criteria:**
  - `git grep -l "read-excel-file" -- apps/backend/src` lists only `apps/backend/src/csrm/spreadsheets/xlsx-reader.ts`.
  - `extraction-worker.ts` contains `isEvalSupported: false` and no `extractText(`.
  - `.gitattributes` has the binary rule, and `git check-attr` reports `binary: set` on the fixtures.
    - **2026-10-11, stage B (WR-305, IN-706):** the rule covered the whole folder, README included, so the EICAR guard above (`-I` skips every file git treats as binary) could not see the folder, and diffs showed the README as binary. The rule now names the six fixture types, which still report `binary: set` with unchanged blobs, and the README has no attribute. The gate is now `git grep -n -a -E 'EICAR-STANDARD|ANTIVIRUS-TEST' -- apps`.
  - The README lists all six fixtures.
  - The committed fixtures equal `git show HEAD:` byte for byte.
- **Dev servers:** `netstat` showed no listener on 1337 or 3000 before either suite.

## Decisions Made

See the `key-decisions` frontmatter. Also:

- The XLSX text format is a `Sheet: {name}` line, then rows with their cells joined by tabs and trailing empty cells dropped. Sheets are separated by a blank line, like slides in `pptxText`.
- A failed worker posts only a closed code (`ZIP_*`, `XLSX_*`, `DOCTYPE_REFUSED`, `EXTRACTION_FAILED` and so on), never an error message. Its stdout and stderr are drained and discarded, so no file content reaches a log (G-3).
- `extractAttachmentText` throws on a programming error (a type outside the six text-bearing types, or a cap that is not a positive integer) rather than answering unavailable.

## Deviations from Plan

### Task 1 (previous session, recorded here)

1. **[Rule 2 - Security] Duplicate and overlapping entries are refused as `ZIP_MALFORMED`.** Overlapping entries are how a small archive declares the same data many times, and a duplicate name makes "which part is read" ambiguous. (`1fcfc76`)
2. **[Rule 2 - Security] Each entry is checked against its declared size and CRC-32.** `readZipEntry` requires the inflated output to equal the declared size and CRC-32. (`1fcfc76`)
3. **[Rule 2 - Security] Each inflate is bounded by the entry's declared size.** `maxOutputLength` is the smaller of the caller's bound and the declared size, so a part that lies about its size stops at what it declared. (`1fcfc76`)
4. **[Rule 2 - Correctness] `w:del` and `w:moveFrom` are skipped in DOCX, as well as `w:delText`.** Moved-from text is a tracked deletion too. (`1fcfc76`)
5. **[Rule 1 - Test data] The `maxOutputLength` test was changed to use varied text.** It had used `"x"` repeated 4,096 times, which deflates past 200:1 and was rightly refused as `ZIP_RATIO`. (`1fcfc76`)

### Task 3

6. **[Rule 3 - Verify command] pnpm 11 prints `fflate@0.8.3`, not `fflate 0.8.3`.** The plan's `grep -q "fflate 0.8.3"` therefore exits 1 even though only 0.8.3 is installed. I ran the same check in pnpm 11's form (`grep -q "fflate@0.8.3"`: exit 0), and the older-version grep with `[ @]` found nothing. The intent holds: only 0.8.3. A future verify should match `fflate[ @]0\.8\.3`.
7. **[Rule 2 - Security] XLSX parts with a DOCTYPE or ENTITY are refused, and every part read-excel-file inflates is bounded.**
   - The must-have reads "XML with a DOCTYPE or ENTITY declaration is refused". The library's `saxen` parser only skips a DTD (it maps a fixed set of five entities and never expands a declared one), so CSRM now refuses it itself.
   - `readWorkbookSheets` reads each `.xml` and `.xml.rels` part through `readZipEntry` (exact size and CRC-32) before calling the library.
   - The `maxInflated` bound covers all of those parts, not only `xl/worksheets/*` and `xl/sharedStrings.xml`.
   - Committed test first (`2420445`, then `e54b639`), after `adb0b24`, so the full suite ran again (997/0).
8. **[Rule 2 - Correctness] The bytes are copied once before they are transferred.** The plan transfers the caller's buffer. Transferring detaches it, and for a small Buffer it would detach Node's shared allocation pool. A test checks that the caller's bytes stay usable.
9. **[Rule 2 - Observability for tests] `extractAttachmentText` takes an optional third `observer` argument (`onWorkerStart`, `onWorkerExit`).** The tests use it to prove that the worker is terminated before an overrun settles, and that two calls never overlap. Callers omit it.
10. **[Design] `XLSX_READER_ENGINE` lives in `xlsx-reader.ts`, and `EXTRACTOR_VERSION` is built from it.** This keeps the acceptance criterion that only the XLSX reader names `read-excel-file`. The value equals the plan's constant, and a test checks both versions against the installed packages.
11. **[Rule 1 - Bug, found before commit]** The first GREEN run failed one test: `Buffer#slice()` is a view, so `read-excel-file` was given the whole 8 KB pool. Fixed with an explicit copy before `adb0b24`.

**Impact on plan:** none on scope. Deviations 7 and 8 tighten D-32 and T-14-06, and deviation 6 is the verify command's text only.

## Issues Encountered

None blocking. pnpm's policy accepted every package. Nothing was added to `allowBuilds`, and no override or exception was introduced.

## Threat Flags

None beyond the plan's register. The worker parses untrusted bytes (T-14-03, T-14-04, T-14-05, T-14-06, all mitigated as planned). The S3 provider is installed but not yet wired (14-04).

## User Setup Required

None.

## Next Phase Readiness

- 14-03's content check can use `readZipDirectory`, `ooxmlMainPart`, `OOXML_MAIN_TYPES`, `probePdf` and the fixture builders.
- 14-09 can call `extractAttachmentText({ type, bytes, cap: 20_000 })` outside the lock.
- Phase 19 reuses `zip-archive.ts` and `xlsx-reader.ts` and adds only `write-excel-file`.
- 14-04 can wire `@strapi/provider-upload-aws-s3` 5.51.0.

## Self-Check: PASSED

- FOUND: apps/backend/src/csrm/files/zip-archive.ts, ooxml-text.ts, extraction.ts, extraction-worker.ts; apps/backend/src/csrm/spreadsheets/xlsx-reader.ts
- FOUND: apps/backend/tests/fixtures/attachments/ (README.md and the six fixtures)
- FOUND: 50c2a7f, 1fcfc76, fa1cdda, af9207b, adb0b24, 2420445, e54b639

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
