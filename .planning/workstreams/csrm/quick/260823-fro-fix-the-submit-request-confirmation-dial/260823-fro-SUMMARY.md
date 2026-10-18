---
quick_task: 260823-fro
status: complete
completed: 2026-08-23
commit: bad2191
files:
  - apps/csrm/src/components/ui/request-form-primitives.tsx
  - apps/csrm/e2e/request-workflow.spec.ts
---

# Quick Task 260823-fro: Submit Confirmation Dialog Width Summary

Replaced the ambiguous semantic-spacing `max-w-lg` dialog cap with an explicit 32rem maximum, so confirmation dialogs retain their viewport inset without collapsing into a one-letter-wide column.

## Changes

- Kept the Radix portal, focus management, responsive actions, semantic styling, padding, and `w-[calc(100%-2rem)]` viewport inset intact.
- Added reusable Playwright layout assertions for the real Submit request dialog at desktop and 390px mobile widths, including bounds, usable title/description width, internal/document overflow, Cancel-first focus, cancellation, and successful submission.

## Verification

- Passed: `yarn workspace @idambox/csrm test:e2e request-workflow.spec.ts --grep "Jane persists, submits, withdraws, and discovers a request through real Strapi"`
- Passed: `git diff --check`
- Partially blocked: `yarn workspace @idambox/csrm verify` completed lint and TypeScript checks, then hit three unrelated pre-existing unit assertions that expect 23 capabilities while the current catalogue provides 27:
  - `src/config/capabilities.test.ts` (2 assertions)
  - `src/lib/fixtures/resolve-identity.test.ts` (1 assertion)

## Commit

- `bad2191` — `fix(260823-fro): prevent confirmation dialog collapse`
