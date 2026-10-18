import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The semantic colour guard (AGENTS.md: "All styling must use semantic theme tokens"; "Never hard-code BProton
 * brand colours in feature components"). Every colour in the web source comes from a theme token in the stylesheet,
 * so no TypeScript module under app/ or src/ may write a literal hex, rgb(), hsl() or oklch() colour. It replaces
 * the Risk-only "semantic Risk colours" check of the retired scripts/verify-phase-05-integrity.mjs and covers every
 * module. Tests and declarations are not read.
 */

const webRoot = process.cwd();
/** A hex colour (3, 4, 6 or 8 digits, not part of a longer word such as a fragment id) or a colour function. */
const LITERAL_COLOUR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch)\s*\(/i;

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const sourceModules = [resolve(webRoot, 'app'), resolve(webRoot, 'src')]
  .flatMap((root) => walk(root))
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.endsWith('.d.ts'));

describe('semantic colour guard', () => {
  it('reads the web source', () => {
    expect(sourceModules.length).toBeGreaterThan(100);
  });

  it('writes no literal colour in any module of app/ or src/', () => {
    const violations = sourceModules.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .flatMap((line, index) => (LITERAL_COLOUR.test(line) ? [`${relative(webRoot, file).split(sep).join('/')}:${index + 1}`] : [])),
    );
    expect(violations).toEqual([]);
  });

  it('recognises the colour forms it refuses, and not a fragment id', () => {
    for (const literal of ['#fff', '#0a0b0c', '#0a0b0c80', 'rgb(0 0 0)', 'hsla(1, 2%, 3%, 0.5)', 'oklch(0.5 0.1 200)']) {
      expect(LITERAL_COLOUR.test(literal), literal).toBe(true);
    }
    for (const notColour of ['href="#decade-review"', '#risk-1', 'var(--risk-high)', 'text-risk-high']) {
      expect(LITERAL_COLOUR.test(notColour), notColour).toBe(false);
    }
  });
});
