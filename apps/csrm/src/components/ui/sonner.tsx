"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { OPEN_BOTTOM_SHEET_HEIGHT } from "@/components/ui/bottom-sheet-room"

/*
 * Sonner injects its own stylesheet outside any cascade layer, so it outranks every Tailwind utility (they all sit
 * in a layer); each utility below that replaces one of its declarations is therefore important.
 *
 * - A status toast has the direction's 4px left edge in its status colour, beside its status icon in the same
 *   colour (direction §4 Toasts). Colour is never the only signal: the icon's shape and the title carry it too.
 * - A toast's action (Undo, Try again, Refresh page) is an outline small pill (X-14; §4 Buttons: every button is a
 *   pill), at the touch-target height below 768px, with the focus ring. Sonner's own action is an ink fill with
 *   paper text, so an action restyled by its text colour alone read ink on ink (CR-301).
 * - A toast's Close (WR-602; WCAG 2.5.8) is a 24px circle on the toast's corner from 768px. Below 768px it is a circle
 *   at the touch-target size after the action, in the toast's own row, so it never covers the toast's words or the
 *   action (direction §4 Buttons: touch targets ≥44px below 768px).
 */
const toastClassNames = {
  success: "!border-l-4 !border-l-success",
  info: "!border-l-4 !border-l-info",
  warning: "!border-l-4 !border-l-warning",
  error: "!border-l-4 !border-l-destructive",
  actionButton: [
    "!h-8 !rounded-full !border !border-border !bg-surface !px-3 !text-button !text-foreground max-md:!min-h-11",
    "!transition-[translate,background-color] !duration-(--duration-fast) !ease-out-expo hover:-translate-y-px hover:!bg-surface-muted",
    "focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-ring",
  ].join(" "),
  closeButton: [
    "!size-6",
    "max-md:!static max-md:!order-last max-md:!size-11 max-md:!shrink-0 max-md:!transform-none",
    "focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-ring",
  ].join(" "),
}

/*
 * D3: the stack keeps the direction's bottom placement (§4 Toasts) at the page's gutter, raised by the height of any
 * open bottom sheet (`./bottom-sheet-room`), so a toast never covers the sheet's controls.
 */
const aboveOpenBottomSheet = (gutter: string) => `calc(var(${OPEN_BOTTOM_SHEET_HEIGHT}, 0px) + var(${gutter}))`

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      /*
       * The stack sits bottom-right, over whatever actions a short page ends
       * with, and hovering a toast pauses its dismiss timer. Without a close
       * control a toast can therefore sit on top of a button for as long as the
       * pointer rests there. The design direction already requires warning and
       * danger toasts to persist until dismissed, so the affordance has to exist
       * regardless.
       */
      closeButton
      offset={{ bottom: aboveOpenBottomSheet("--gutter-sm") }}
      mobileOffset={{ bottom: aboveOpenBottomSheet("--gutter-xs") }}
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{ classNames: toastClassNames }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
