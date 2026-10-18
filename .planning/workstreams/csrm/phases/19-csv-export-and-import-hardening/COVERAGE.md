# API Coverage — Phase 19 (CSV export and import hardening)

No external API integration: Phase 19 adds CSRM's own Strapi operations and a local spreadsheet library (write-excel-file); it integrates no external API or service.

## Notes

- The coverage detector fires on CSRM's own operation names: the exports of the lists, the reports and the released assessment, and each Administration collection's import template, error report and reference-list export. Each is a Strapi operation served under `/api/v1`, published in `docs/references/specification.json`, catalogued as a FunctionApi and listed with its web caller in `docs/references/served-operations.json`; none calls a third party.
- `write-excel-file@4.1.1` (with its `fflate` 0.8.3 dependency) is the one dependency Phase 19 adds, in `apps/backend` only (19-03); it writes workbooks in process and makes no network call. `apps/csrm` loses `csv-parse` (19-15), which `apps/backend` keeps.
- Every suite pins the deterministic AI provider; Phase 19 sends no data to a hosted provider.
