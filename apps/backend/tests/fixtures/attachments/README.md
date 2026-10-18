# Attachment fixtures (14-02; D-39)

Small, deterministic files for the content check, text extraction and the Playwright attachment journeys. Each was written once by `writeAttachmentFixtures` in `tests/helpers/attachment-fixtures.ts`:

```bash
# from apps/backend, after pnpm exec tsc -p tests/tsconfig.json
node .tmp/tests-dist/tests/helpers/attachment-fixtures.js --write tests/fixtures/attachments
```

`attachment-extraction.unit.test.ts` checks that every committed file is byte-for-byte its builder's output, so a change to a builder must rewrite the fixtures. `.gitattributes` marks the fixture types (`*.pdf`, `*.docx`, `*.xlsx`, `*.pptx`, `*.png`, `*.jpg`) `binary`, so `core.autocrlf` never rewrites them. This README is text, so diffs show it and a text-only search sees it (WR-305, IN-706).

| File | Builder | Known text |
| --- | --- | --- |
| `vendor-security-pack.pdf` | `buildPdf(VENDOR_PACK_PAGES)` | Three pages; page 2 has UAT-013's fact, "The vendor's offshore support team has administrator access." |
| `data-flow.docx` | `buildDocx(DATA_FLOW_PARAGRAPHS, { table: DATA_FLOW_TABLE })` | "Employee records flow nightly from the HR system to the vendor over SFTP.", then a Data / Classification table |
| `vendor-questionnaire.xlsx` | `buildXlsx(VENDOR_QUESTIONNAIRE_SHEETS)` | Sheets "Controls" ("MFA for administrators", a `SUM(C2:D2)` formula cached as 3, the date 2026-09-30) and "Vendors" |
| `architecture-deck.pptx` | `buildPptx(ARCHITECTURE_DECK_SLIDES, { notes: ARCHITECTURE_DECK_NOTES })` | Two slides, the second "SFTP from the HR system, nightly"; slide 1's speaker notes are never extracted |
| `diagram.png` | `buildPng()` | None: a valid 4x4 RGB image |
| `photo.jpg` | `buildJpegStub()` | None: a JFIF signature stub (start of image, APP0, end of image) |

No fixture contains a malware test string; hostile variants are built in memory by tests/helpers/attachment-fixtures.ts.
