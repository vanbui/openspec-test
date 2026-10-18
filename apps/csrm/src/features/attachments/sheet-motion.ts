/*
 * The direction's drawer motion for Phase 14's own sheets (14-UI-SPEC Motion, "Sheets: §5 'Drawer / side panel'; fade
 * only under reduced motion"; direction §3.11 and §5, "Drawer / side panel / route swap | 260ms | expo | Fade + short
 * slide"; 14-UI-REVIEW UI-02). The animations are theme tokens in app/globals.css: each entrance is a short slide with a
 * fade at `--duration-slower` on `--ease-out-expo`, and each exit leaves at `--duration-base` on `--ease-in`, because
 * "exits always ≥25% shorter than entrances" (§3.11). Under reduced motion only the fade runs, and the global rule
 * shortens it. The shared Sheet primitive's classes are app-wide and are left as they are (.planning/WINDOWS.md).
 */

const reducedMotionFade = 'motion-reduce:data-[state=open]:animate-drawer-fade-in motion-reduce:data-[state=closed]:animate-drawer-fade-out';

/** A bottom sheet (the phone actions sheet, §3.3): a short slide up with a fade, and back down on close. */
export const bottomSheetMotion = `motion-safe:data-[state=open]:animate-drawer-in-bottom motion-safe:data-[state=closed]:animate-drawer-out-bottom ${reducedMotionFade}`;

/**
 * A sheet that fills the screen below 768px and is the X-13 side sheet at the end edge from 768px (the text preview,
 * §5.3): below 768px it slides up from the bottom, from 768px it slides in from the end.
 */
export const sideSheetMotion = 'motion-safe:max-md:data-[state=open]:animate-drawer-in-bottom motion-safe:max-md:data-[state=closed]:animate-drawer-out-bottom '
  + `motion-safe:md:data-[state=open]:animate-drawer-in-end motion-safe:md:data-[state=closed]:animate-drawer-out-end ${reducedMotionFade}`;

/** The scrim behind a sheet fades in and out at the sheet's timing. */
export const sheetOverlayMotion = 'data-[state=open]:animate-drawer-fade-in data-[state=closed]:animate-drawer-fade-out';
