---
quick_task: 260822-tdg
description: Check the CSRM Engineering Rules in apps/csrm/AGENTS.md and make any code adjustments accordingly.
status: complete
---

# Quick Task Summary

## Completed

- Reused the CSRM shadcn `Button` primitive for account, mobile-navigation, and sidebar controls.
- Replaced the hand-rolled navigation-group toggle with the existing shadcn/Radix `Collapsible` primitive.
- Moved development identity display options into the fixture configuration instead of defining them in `AppShell` JSX.
- Added a focused `Collapsible` test double to match the existing Radix test-boundary isolation pattern.

## Verification

- `yarn workspace @idambox/csrm lint` — passed.
- `yarn workspace @idambox/csrm check-types` — passed.
- `yarn workspace @idambox/csrm test src/components/shell/shell.test.tsx` — passed (11/11).
- `yarn workspace @idambox/csrm verify:runtime` — passed.
- Full `yarn workspace @idambox/csrm test` remains blocked by pre-existing assertions expecting 23 capabilities while the committed registry currently contains 27. No unrelated authorization changes were made.

## Files Changed

- `apps/csrm/src/components/shell/account-menu.tsx`
- `apps/csrm/src/components/shell/app-shell.tsx`
- `apps/csrm/src/components/shell/mobile-navigation.tsx`
- `apps/csrm/src/components/shell/navigation-group.tsx`
- `apps/csrm/src/components/shell/sidebar.tsx`
- `apps/csrm/src/components/shell/shell.test.tsx`
- `apps/csrm/src/lib/fixtures/identities.ts`
