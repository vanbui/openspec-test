import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/*
 * D-31 (13-UI-SPEC §17, UI-D10): at 375px the header holds Menu, the Search control and the role tag. The development
 * `Second Security Analyst` tag is too long for one line beside them, so from 375px to 767px a tag that cannot fit
 * wraps onto a second line inside the header instead of scrolling the page sideways, its full text shown. Below 375px
 * the tag still shrinks with an ellipsis (UI-D10), and the Search control never shrinks below its touch target.
 *
 * jsdom lays nothing out, so these tests read the declarations in globals.css and are named for that (IN-403); that the
 * header fits at 375px with the full tag shown is measured in the browser (the 13-19 walk's B1).
 */
describe('the header role tag’s declared rules at phone widths (a guard; the 375px fit is checked in the browser)', () => {
  const globals = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

  function block(query: string): string {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return globals.match(new RegExp(`@media ${escaped} \\{\\s*\\.header-role \\{([^}]*)\\}`))?.[1] ?? '';
  }

  it('declares the wrap rule from 375px to 767px: a tag too long for one line wraps, never scrolls or truncates', () => {
    const rule = block('(min-width: 375px) and (max-width: 767px)');

    expect(rule).toMatch(/flex:\s*0 1 auto;/);
    expect(rule).toMatch(/white-space:\s*normal;/);
    expect(rule).not.toMatch(/text-overflow/);
    expect(rule).not.toMatch(/overflow:\s*hidden/);
  });

  it('declares the ellipsis below 375px only, and the Search control at its own size', () => {
    expect(block('(max-width: 374px)')).toMatch(/text-overflow:\s*ellipsis;/);
    expect(globals.match(/\n\.header-search \{([^}]*)\}/)?.[1] ?? '').toMatch(/flex:\s*none;/);
  });
});
