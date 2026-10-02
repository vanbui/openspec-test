"use client"

import * as React from "react"
import { CircleIcon } from "lucide-react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

const NEXT_RADIO_KEYS = new Set(["ArrowDown", "ArrowRight"])
const PREVIOUS_RADIO_KEYS = new Set(["ArrowUp", "ArrowLeft"])

function isEnabledRadio(radio: HTMLElement) {
  return !radio.hasAttribute("disabled") && !radio.hasAttribute("data-disabled")
}

/**
 * Moves focus to the next (ArrowDown, ArrowRight) or previous (ArrowUp, ArrowLeft) enabled radio
 * in the same group, wrapping, and checks it. Arrows with a modifier and every other key are left
 * to Radix.
 *
 * Radix checks a radio on focus only while its document-level arrow flag is set, and its roving
 * focus moves in a deferred timeout, so a key released quickly moved focus without checking
 * (UAT-064). Preventing default here skips the roving handler, so focus moves once, and the radio
 * is checked through its own click, the path Radix's focus handler uses.
 */
function selectAdjacentRadio(event: React.KeyboardEvent<HTMLButtonElement>) {
  if (event.defaultPrevented) return
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
  const step = NEXT_RADIO_KEYS.has(event.key)
    ? 1
    : PREVIOUS_RADIO_KEYS.has(event.key)
      ? -1
      : 0
  if (step === 0) return

  const current = event.currentTarget
  if (event.target !== current) return
  const group = current.closest('[role="radiogroup"]')
  if (!group) return
  event.preventDefault()

  const radios = Array.from(
    group.querySelectorAll<HTMLElement>('[role="radio"]')
  ).filter((radio) => radio.closest('[role="radiogroup"]') === group)
  const start = radios.indexOf(current)
  if (start === -1) return
  let target: HTMLElement | undefined
  for (let offset = 1; offset < radios.length; offset += 1) {
    const index =
      (((start + step * offset) % radios.length) + radios.length) %
      radios.length
    const candidate = radios[index]
    if (candidate && isEnabledRadio(candidate)) {
      target = candidate
      break
    }
  }
  if (!target) return

  // While a key repeats, Radix's arrow flag is already set and its focus handler clicks the radio
  // itself. Click only when it did not, so each press reports exactly one change.
  let checkedOnFocus = false
  const noteClick = () => {
    checkedOnFocus = true
  }
  target.addEventListener("click", noteClick)
  target.focus()
  target.removeEventListener("click", noteClick)
  if (!checkedOnFocus) target.click()
}

function RadioGroupItem({
  className,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border border-input text-primary transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        selectAdjacentRadio(event)
      }}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem, selectAdjacentRadio }
