---
quick_task: 260823-fro
description: Fix the Submit request confirmation dialog rendering vertically with one letter per line and overflowing the viewport.
status: ready
---

# Quick Task Plan

1. Fix the shared confirmation-dialog width in `apps/csrm/src/components/ui/request-form-primitives.tsx`. Tailwind 4 currently compiles `max-w-lg` to `max-width: 24px` because the project defines the semantic spacing token `--spacing-lg: 24px`; combined with `p-xl` and the inherited `overflow-wrap: anywhere`, that collapses the dialog content column and produces the one-letter-per-line overflow. Replace only that ambiguous max-width utility with an explicit collision-safe 32rem maximum while retaining the existing `w-[calc(100%-2rem)]` viewport inset, Radix portal/focus behavior, responsive action layout, padding, and semantic colours. Do not change the global spacing tokens or wrapping default, because those are shared throughout the CSRM application.
2. Extend `apps/csrm/e2e/request-workflow.spec.ts` around the real Submit request confirmation path with a reusable browser-layout assertion. Exercise the valid dialog at the existing 1440px viewport, cancel it, reopen it at 390px, and prove that its bounding box is wider than the collapsed regression, remains inside 16px viewport gutters and the viewport height, gives the title and description usable horizontal content width with no internal or document-level horizontal overflow, and preserves Cancel-first focus plus successful confirmation. Restore the desktop viewport before the remainder of the existing workflow assertions. Verify with `yarn workspace @idambox/csrm test:e2e request-workflow.spec.ts --grep "Jane persists, submits, withdraws, and discovers a request through real Strapi"`, then run `yarn workspace @idambox/csrm verify` and `git diff --check`.
