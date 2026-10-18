---
quick_id: 260805-qzp
status: complete
description: "extend the CSRMRisk object with two more attributes: isExempted:Boolean and exemptionReviewDate:dateTime"
---

# Quick Task Summary

Added the requested optional CSRM Risk attributes:

- `isExempted` — Strapi boolean
- `exemptionReviewDate` — Strapi datetime

Updated Strapi-generated content type declarations. OpenAPI regeneration was attempted but could not complete because the backend boot path requires an unavailable Keycloak network connection; no specification diff was produced.

## Verification

- `yarn verify:csrm-model` — passed
- `yarn verify:schema` — passed
- `yarn check-types` — passed
- `yarn workspace backend strapi ts:generate-types` — passed

## Commits

- Implementation commit: `867b9f0`
