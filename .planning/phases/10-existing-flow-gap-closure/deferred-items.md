# Phase 10 deferred items

## Deferred Items

- The direct dependency `@radix-ui/react-dialog` (1.1.15) in `apps/csrm/package.json` is no longer imported by any app source after plan 10-08
  status: open
  **What:** 10-08 moved the mobile navigation sheet (`apps/csrm/src/components/shell/capability-navigation.tsx`) to the `radix-ui` build every other primitive uses, so the leave warning stacks above the sheet in one layer and focus stack. The older direct package now only adds a second Radix copy to the lockfile.
  **Where to resolve:** a dependency-hygiene change that removes it from `package.json` and refreshes `pnpm-lock.yaml`, with the full gate. 10-08 did not change dependencies (AGENTS.md: no dependency change without a concrete reason inside the plan's scope).

- A refused `Generate questionnaire` start shows its family I refusal under the title `Status unavailable`
  status: resolved
  **Resolved in:** plan 10-14 (`f865b2d`). A refused start or retry now shows under its own title, `Questionnaire generation couldn’t start` (and `Draft generation couldn’t start` on the draft card, which had the same defect). `Status unavailable` stays only for a failed status check. UI-SPEC §12 names no title for a refused start, so the copy is 10-14's decision (recorded in `10-14-SUMMARY.md`).
  **What:** found in plan 10-12. `QuestionnaireGenerationJob` routes a refused non-replacing start (`start(false)`) to the card's `formError` alert, whose title is `Status unavailable` (UI-SPEC §12.1's title for a failed status check). The description is the correct §10.2 I sentence, but the title says a status check failed when a start was refused. A refused replacement is unaffected: it shows inside the `Replace this questionnaire?` dialog. UI-SPEC names no title for a refused start.
  **Where to resolve:** plan 10-14, which rebuilds the card's states and adds the file to the copy guard; give a refused start its own title (for example `Questionnaire generation couldn’t start`) once the copy is fixed in the UI-SPEC.
