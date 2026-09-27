import { expect, type Locator, type Page } from '@playwright/test';

/*
 * Keyboard focus proofs shared by the journeys and the accessibility sweep (D-25).
 *
 * WCAG 2.4.7 Focus Visible: a control reached by the keyboard shows a focus indicator. The control is
 * reached the way a keyboard user reaches it, by Tab from the stop before it, so the browser applies
 * :focus-visible exactly as it would for a person.
 *
 * The indicator is what focus changes (SR-04). The control's outline and box-shadow are read at rest,
 * while the stop before it holds focus, and again once Tab has reached it, each after the control's
 * transitions have settled (the direction's --focus-ring is an outline; the shadcn primitives draw a
 * ring with box-shadow). Focus is visible when it adds a visible outline the resting control lacks
 * (a style other than none, a non-zero width and a colour that is not transparent) or a visible
 * shadow layer it lacks. A shadow the control carries at rest, such as a primary button's, and an
 * outline drawn in a transparent colour are not indicators.
 */
type FocusIndicator = { outline: string | null; shadows: string[] };

async function settledIndicator(locator: Locator): Promise<FocusIndicator> {
  return locator.evaluate(async (element) => {
    await Promise.all(element.getAnimations()
      .filter((animation) => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
      .map((animation) => animation.finished.then(() => undefined, () => undefined)));

    /** The alpha of a computed colour: the fourth value of rgba(), or the value after the slash. */
    const alphaOf = (color: string): number => {
      if (color === 'transparent') return 0;
      const legacy = /^rgba\((?:[^,]+,){3}\s*([\d.]+)\s*\)$/.exec(color);
      if (legacy) return Number(legacy[1]);
      const slash = /\/\s*([\d.]+)(%?)\s*\)$/.exec(color);
      if (slash) return slash[2] === '%' ? Number(slash[1]) / 100 : Number(slash[1]);
      return 1;
    };
    /** A computed box-shadow split into its layers at the commas outside parentheses. */
    const layersOf = (shadow: string): string[] => {
      const layers: string[] = [];
      let depth = 0;
      let current = '';
      for (const character of shadow) {
        if (character === '(') depth += 1;
        if (character === ')') depth -= 1;
        if (character === ',' && depth === 0) {
          layers.push(current.trim());
          current = '';
        } else {
          current += character;
        }
      }
      if (current.trim()) layers.push(current.trim());
      return layers;
    };
    /** A layer draws something when its colour is not transparent and one of its lengths is not zero. */
    const drawsSomething = (layer: string): boolean => {
      const color = /^(?:[a-z-]+\([^)]*\)|[a-z]+)/i.exec(layer)?.[0] ?? '';
      const lengths = [...layer.slice(color.length).matchAll(/-?[\d.]+px/g)].map(([length]) => parseFloat(length));
      return alphaOf(color) > 0 && lengths.some((length) => length !== 0);
    };

    const style = getComputedStyle(element);
    const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 && alphaOf(style.outlineColor) > 0
      ? `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} offset ${style.outlineOffset}`
      : null;
    const shadows = style.boxShadow === 'none' ? [] : layersOf(style.boxShadow).filter(drawsSomething);
    return { outline, shadows };
  });
}

export async function expectFocusVisible(locator: Locator, label = 'the control'): Promise<void> {
  await locator.evaluate((element) => {
    const focusable = Array.from(document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((candidate) => candidate.offsetWidth > 0 && candidate.offsetHeight > 0);
    const index = focusable.indexOf(element as HTMLElement);
    if (index < 1) throw new Error('FOCUS_VISIBLE_NO_PRECEDING_STOP: the control has no keyboard stop before it.');
    focusable[index - 1]!.focus();
  });
  const atRest = await settledIndicator(locator);
  await locator.page().keyboard.press('Tab');
  await expect(locator, `${label} is reached by Tab`).toBeFocused();
  const focused = await settledIndicator(locator);

  const addsOutline = focused.outline !== null && focused.outline !== atRest.outline;
  const addsShadow = focused.shadows.some((layer) => !atRest.shadows.includes(layer));
  const describe = (indicator: FocusIndicator) => `outline ${indicator.outline ?? 'none'}; shadow ${indicator.shadows.join(', ') || 'none'}`;
  expect(
    addsOutline || addsShadow,
    `${label} shows a keyboard focus indicator it does not have at rest (at rest: ${describe(atRest)}; focused: ${describe(focused)})`,
  ).toBe(true);
}

type ObscuringGeometry = {
  describe: string;
  headerOverlap: { elementTop: number; headerBottom: number } | null;
  stickyColumnOverlap: { elementLeft: number; stickyRight: number } | null;
};

/*
 * WCAG 2.4.11 Focus Not Obscured (Minimum). Two things in the product stick over scrolled content: the
 * application header at the top of the page, and, while a DataTable scrolls sideways, its identifier
 * column at the start edge. A focused element that shares the header's columns must start at or below
 * the header's bottom edge; a focused element in a later column of a scrolling table must start at or
 * beyond the sticky cell's end edge. The header's own controls, the sidebar beside it, the skip link
 * and open dialogs or popovers sit above the header by design, so they are not checked against it.
 *
 * This checks whatever holds focus now, read from document.activeElement rather than a :focus
 * selector: while Tab moves through a date input's own fields, focus sits in the input's internal
 * shadow tree and no selector matches the input, although it is the active element. It returns false
 * when nothing in the document holds focus (Tab has left the page).
 */
export async function expectActiveElementNotObscured(page: Page, label = 'the focused element'): Promise<boolean> {
  const geometry = await page.evaluate((): ObscuringGeometry | null => {
    const element = document.activeElement;
    if (!element || element === document.body || element === document.documentElement) return null;
    const rect = element.getBoundingClientRect();
    const describe = `${element.tagName.toLowerCase()}${element.getAttribute('role') ? `[role=${element.getAttribute('role')}]` : ''} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 60)}"`;
    const header = document.querySelector<HTMLElement>('.header');
    const aboveTheHeader = element.closest('.header, .sidebar, .skip-link, [role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]');
    let headerOverlap: ObscuringGeometry['headerOverlap'] = null;
    if (header && !aboveTheHeader && getComputedStyle(header).position === 'sticky') {
      const headerRect = header.getBoundingClientRect();
      const sharesColumns = rect.right > headerRect.left && rect.left < headerRect.right;
      if (sharesColumns) headerOverlap = { elementTop: rect.top, headerBottom: headerRect.bottom };
    }
    let stickyColumnOverlap: ObscuringGeometry['stickyColumnOverlap'] = null;
    const firstCell = element.closest('[data-slot="data-table-desktop"] tr')?.firstElementChild;
    if (firstCell instanceof HTMLElement && !firstCell.contains(element) && getComputedStyle(firstCell).position === 'sticky') {
      stickyColumnOverlap = { elementLeft: rect.left, stickyRight: firstCell.getBoundingClientRect().right };
    }
    return { describe, headerOverlap, stickyColumnOverlap };
  });
  if (!geometry) return false;
  if (geometry.headerOverlap) {
    expect(
      geometry.headerOverlap.elementTop,
      `${label} (${geometry.describe}) starts at or below the sticky header's bottom edge`,
    ).toBeGreaterThanOrEqual(geometry.headerOverlap.headerBottom - 1);
  }
  if (geometry.stickyColumnOverlap) {
    expect(
      geometry.stickyColumnOverlap.elementLeft,
      `${label} (${geometry.describe}) starts at or beyond the sticky identifier column's end edge`,
    ).toBeGreaterThanOrEqual(geometry.stickyColumnOverlap.stickyRight - 1);
  }
  return true;
}

/* The same check for a given control: it is focused first, unless it already has focus. */
export async function expectFocusNotObscured(page: Page, locator: Locator, label = 'the focused element'): Promise<void> {
  if (!(await locator.evaluate((element) => element === document.activeElement))) await locator.focus();
  await expect(locator, `${label} has keyboard focus`).toBeFocused();
  expect(await expectActiveElementNotObscured(page, label), `${label} holds focus`).toBe(true);
}
