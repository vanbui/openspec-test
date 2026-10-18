---
quick_task: 260823-fcv
description: Fix the New request form so field validation and the Check the highlighted fields summary run only on submit or save draft, preserving text-field focus while typing.
status: ready
---

# Quick Task Plan

1. Add focused regression coverage in `apps/csrm/src/features/requests/request-form.test.tsx`: ordinary typing before an action must not show field errors or the `Check the highlighted fields` summary; invalid Save draft and Submit request attempts must show the relevant validation and focus the summary; after an invalid attempt, refocusing a text field and typing multiple characters must keep focus in that field without rerunning summary focus until the next save or submit action.
2. Update `apps/csrm/src/features/requests/request-form.tsx` so validation-result presentation and summary focus are explicitly requested only by `onSaveDraft`, `onBeginSubmit`, or an error returned from those actions. Decouple the focus effect from ordinary `errors` object changes, while retaining per-field stale-error clearing and ARIA error state as the user edits, so typing cannot steal focus back to the summary.
3. Verify the regression with `yarn workspace @idambox/csrm test src/features/requests/request-form.test.tsx`, then run `yarn workspace @idambox/csrm check-types` and `yarn workspace @idambox/csrm lint` as separate checks.
