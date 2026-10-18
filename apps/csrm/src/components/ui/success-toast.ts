import { toast, type Action } from "sonner"

/*
 * The paused success toast lives apart from the Toaster (`./sonner`), which the root layout renders on every route:
 * only the review decisions use it, so the routes without them never load its code (performance.spec.ts budgets every
 * route's first load; stage B, 2026-10-08).
 */

/* Direction §4 Toasts: an info or success toast closes after 5s. */
export const SUCCESS_TOAST_DURATION_MS = 5_000

let successToastCount = 0

/* Whether a node sits in a toast region: a toast, its Close or action, or the list Alt+T focuses. */
function inToastRegion(node: EventTarget | null): boolean {
  return node instanceof Element && node.closest("[data-sonner-toaster]") !== null
}

/*
 * A success toast on the direction's timing that pauses while the pointer is over the toast region, while focus is
 * inside it, or while the page is hidden, and then resumes with the time it had left (X-14; WCAG 2.2.1). Sonner pauses
 * its own timer on hover and on Alt+T, but not when Tab brings focus into a toast, so this toast keeps no timer of
 * Sonner's (`duration: Infinity`) and closes itself with `toast.dismiss`. Its timer ends when its action runs, or when
 * Sonner dismisses it (Close, a swipe).
 */
export function successToast(message: string, { action }: { action?: Action } = {}): string {
  const id = `csrm-success-toast-${++successToastCount}`
  const listening = new AbortController()
  let hovered = document.querySelector("[data-sonner-toaster]:hover") !== null
  let remaining = SUCCESS_TOAST_DURATION_MS
  let startedAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let ended = false

  function end() {
    ended = true
    clearTimeout(timer)
    timer = undefined
    listening.abort()
  }
  function sync() {
    if (ended) return
    if (hovered || document.hidden || inToastRegion(document.activeElement)) {
      if (timer === undefined) return
      clearTimeout(timer)
      timer = undefined
      remaining -= Date.now() - startedAt
    } else if (timer === undefined) {
      startedAt = Date.now()
      timer = setTimeout(() => {
        end()
        toast.dismiss(id)
      }, Math.max(remaining, 0))
    }
  }
  /* Focus leaves one element before it reaches the next, so read where it landed once the move is over. */
  const syncAfterFocusMove = () => {
    setTimeout(sync, 0)
  }
  const trackPointer = (event: MouseEvent) => {
    hovered = inToastRegion(event.type === "mouseover" ? event.target : event.relatedTarget)
    sync()
  }
  const signal = { signal: listening.signal }
  document.addEventListener("focusin", syncAfterFocusMove, signal)
  document.addEventListener("focusout", syncAfterFocusMove, signal)
  document.addEventListener("mouseover", trackPointer, signal)
  document.addEventListener("mouseout", trackPointer, signal)
  document.addEventListener("visibilitychange", sync, signal)

  toast.success(message, {
    id,
    duration: Infinity,
    action: action && {
      ...action,
      onClick: (event) => {
        end()
        action.onClick(event)
      },
    },
    onDismiss: end,
  })
  sync()
  return id
}
