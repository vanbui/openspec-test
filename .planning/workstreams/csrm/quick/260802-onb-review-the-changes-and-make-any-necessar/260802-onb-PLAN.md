---
quick_id: 260802-onb
slug: review-the-changes-and-make-any-necessar
status: complete
created: 2026-08-02
---

# Quick Task 260802-onb: review the changes and make any necessary adjustments

## Task

Review the CSRM control data-model split and make any necessary corrections before completion.

## Plan

1. Inspect the changed Strapi schemas, generated artifacts, verifier, documentation, and example JDL for consistency.
2. Fix any model gaps found during review.
3. Regenerate generated artifacts and run the backend verification checks.

## Verification

- `yarn verify:csrm-model`
- `yarn workspace backend check-types`
- `.\node_modules\.bin\turbo.cmd run check-types`
