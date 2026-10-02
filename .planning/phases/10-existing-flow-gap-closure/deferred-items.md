# Phase 10 deferred items

## Deferred Items

- The direct dependency `@radix-ui/react-dialog` (1.1.15) in `apps/csrm/package.json` is no longer imported by any app source after plan 10-08
  status: open
  **What:** 10-08 moved the mobile navigation sheet (`apps/csrm/src/components/shell/capability-navigation.tsx`) to the `radix-ui` build every other primitive uses, so the leave warning stacks above the sheet in one layer and focus stack. The older direct package now only adds a second Radix copy to the lockfile.
  **Where to resolve:** a dependency-hygiene change that removes it from `package.json` and refreshes `pnpm-lock.yaml`, with the full gate. 10-08 did not change dependencies (AGENTS.md: no dependency change without a concrete reason inside the plan's scope).
