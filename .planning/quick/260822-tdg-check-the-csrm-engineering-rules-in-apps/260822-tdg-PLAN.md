---
quick_task: 260822-tdg
description: Check the CSRM Engineering Rules in apps/csrm/AGENTS.md and make any code adjustments accordingly.
status: ready
---

# Quick Task Plan

## Objective

Align the CSRM shell with its engineering rules by reusing the existing shadcn primitives, keeping fixture configuration outside JSX, and preserving the existing accessible responsive behavior.

## Tasks

1. Replace custom shell button/collapsible implementations with the existing CSRM `Button` and `Collapsible` primitives; retain semantic tokens, touch targets, keyboard behavior, and existing test contracts.
2. Move development identity display options into the fixture configuration and consume them from `AppShell`, keeping domain/configuration data out of JSX.
3. Run CSRM lint, strict type checking, unit tests, and the relevant production/runtime verification.

## Verification

- `yarn workspace @idambox/csrm lint`
- `yarn workspace @idambox/csrm check-types`
- `yarn workspace @idambox/csrm test`
- `yarn workspace @idambox/csrm verify:runtime`
