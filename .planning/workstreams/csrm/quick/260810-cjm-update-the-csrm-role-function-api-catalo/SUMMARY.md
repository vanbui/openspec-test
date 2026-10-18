---
quick_id: 260810-cjm
slug: update-the-csrm-role-function-api-catalo
status: complete
---

# Summary

Updated the CSRM authorization catalogue with four Administration Functions and 14 FunctionApi grants, including CSV import grants for all four Administration list screens. Synchronized the backend seed catalogue, Security Analyst Agent parity, and frontend capability registry.

## Verification

- `node apps/csrm/scripts/verify-capabilities.mjs`
- `node scripts/verify-csrm-seed.mjs`
- JSON parsing and `git diff --check`
