import type { Locator } from '@playwright/test';

/*
 * The space between a field's label text and the field (direction section 4 Forms: labels sit 6px
 * above their fields). The label wraps its text and its field, so the text's line box starts at the
 * label's top and is one computed line-height tall; the gap runs from the end of that line box to
 * the field's top. Measuring the line box rather than the glyphs keeps font metrics out of it.
 */
export async function labelToFieldGap(field: Locator): Promise<number> {
  return field.evaluate((element) => {
    const label = element.closest('label');
    if (!label) throw new Error('FIELD_HAS_NO_WRAPPING_LABEL');
    const lineHeight = Number.parseFloat(getComputedStyle(label).lineHeight);
    const paddingTop = Number.parseFloat(getComputedStyle(label).paddingTop) || 0;
    return element.getBoundingClientRect().top - (label.getBoundingClientRect().top + paddingTop + lineHeight);
  });
}
