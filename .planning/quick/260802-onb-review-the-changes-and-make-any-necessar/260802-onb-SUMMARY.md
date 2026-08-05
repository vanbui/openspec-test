---
status: complete
quick_id: 260802-onb
slug: review-the-changes-and-make-any-necessar
completed: 2026-08-02
---

# Quick Task 260802-onb Summary

Reviewed the CSRM control split and found one model-strengthening adjustment: `CsrmControlImplementation` represents the implementation of a particular control for a particular risk, so both `control` and `risk` must be required.

## Changes

- Marked `CsrmControlImplementation.control` and `CsrmControlImplementation.risk` as required in the Strapi schema.
- Updated `verify:csrm-model` to assert both implementation relationships are required.
- Updated the example JDL relationships to mark `control` and `risk` required.
- Regenerated Strapi content type declarations and OpenAPI specification.

## Verification

- `yarn verify:csrm-model` passed.
- `yarn workspace backend check-types` passed.
- `.\node_modules\.bin\turbo.cmd run check-types` passed.

Root `yarn check-types` still does not resolve `turbo` in this shell, but the explicit local Turbo binary succeeds.
