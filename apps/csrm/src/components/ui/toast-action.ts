import type { Action } from "sonner"

/*
 * A toast's action (`Undo`, `Try again`, `Refresh page`; X-14). Activating it first moves focus out of the toast region,
 * because the toast closes as it acts and would otherwise take the focused element with it; then it acts once. This is
 * the pattern of `features/ai-assistance/use-ai-decisions.ts`, which keeps its own copy so the Risk editor's first load
 * does not change (Phase 12's route budget); Phase 13's assignment and notes toasts share this one.
 */

function leaveToastRegion(): void {
  const active = document.activeElement
  if (active instanceof HTMLElement && active.closest("[data-sonner-toaster]")) active.blur()
}

export function toastAction(label: string, act: () => void): Action {
  return {
    label,
    onClick: () => {
      leaveToastRegion()
      act()
    },
  }
}
