---
quick_task: 260823-fcv
subsystem: request-form
tags: [react, accessibility, validation, vitest]
status: complete
commits:
  - 5d98509
---

# Quick Task 260823-fcv Summary

**Request-form validation now appears and focuses its summary only after save or submit attempts, while field edits retain keyboard focus.**

## Accomplishments

- Replaced focus-on-any-error-change with an explicit focus request issued by save, submit, or returned validation errors.
- Removed cleared error keys instead of retaining `undefined` entries, preventing ordinary typing from rendering an empty validation summary.
- Added regression coverage for action-triggered validation and continued typing after an invalid submit attempt.

## Verification

- `yarn workspace @idambox/csrm test src/features/requests/request-form.test.tsx` — passed (8 tests)
- `yarn workspace @idambox/csrm check-types` — passed
- `yarn workspace @idambox/csrm lint` — passed

## Files Modified

- `apps/csrm/src/features/requests/request-form.tsx`
- `apps/csrm/src/features/requests/request-form.test.tsx`

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Removed empty error keys during field edits**
   - Ordinary typing had added `undefined` error keys, rendering an empty validation summary.
   - The stale-error clear path now removes the edited field key completely.

## Task Commit

- `5d98509` — `fix(260823-fcv): preserve request field focus during validation`
