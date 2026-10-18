"use client"

import * as React from "react"

/*
 * The Phase 14 pilot's walk, D3: while a bottom sheet is open, its height is published on the document as
 * `--open-bottom-sheet-height`, so the toaster (`./sonner`) keeps its stack above the sheet and a toast never covers the
 * sheet's controls. A sheet that fills the screen leaves no room above it and publishes nothing, so the toasts keep
 * their corner. The tallest open bottom sheet wins; closing the last one withdraws the variable.
 */
export const OPEN_BOTTOM_SHEET_HEIGHT = "--open-bottom-sheet-height"

const openSheets = new Map<HTMLElement, number>()

function publish() {
  const height = Math.max(0, ...openSheets.values())
  const style = document.documentElement.style
  if (height > 0) style.setProperty(OPEN_BOTTOM_SHEET_HEIGHT, `${height}px`)
  else style.removeProperty(OPEN_BOTTOM_SHEET_HEIGHT)
}

/** Publishes `sheet`'s laid-out height (transforms aside, so its entrance does not count) while it is mounted. */
export function useBottomSheetRoom(sheet: HTMLElement | null, bottom: boolean): void {
  React.useLayoutEffect(() => {
    if (!sheet || !bottom) return undefined
    const measure = () => {
      const height = sheet.offsetHeight
      openSheets.set(sheet, height < window.innerHeight ? height : 0)
      publish()
    }
    measure()
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    observer?.observe(sheet)
    window.addEventListener("resize", measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", measure)
      openSheets.delete(sheet)
      publish()
    }
  }, [sheet, bottom])
}
