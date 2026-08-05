---
quick_id: 260805-qzp
description: "extend the CSRMRisk object with two more attributes: isExempted:Boolean and exemptionReviewDate:dateTime"
status: complete
---

# Quick Task: Extend CSRMRisk

## Tasks

1. Update `apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json` with `isExempted` as a boolean and `exemptionReviewDate` as a datetime.
2. Regenerate Strapi content type declarations and OpenAPI output if the repository tooling updates them.
3. Run the existing CSRM model, schema, and TypeScript checks, then commit the implementation atomically.

## Verification

- The CSRMRisk schema declares `isExempted` with `type: "boolean"`.
- The CSRMRisk schema declares `exemptionReviewDate` with `type: "datetime"`.
- `yarn verify:csrm-model`, `yarn verify:schema`, and `yarn check-types` pass.
