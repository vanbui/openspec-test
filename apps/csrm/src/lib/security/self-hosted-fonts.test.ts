import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import type localFont from 'next/font/local';
import { describe, expect, it, vi } from 'vitest';

/*
 * The self-hosted type families (G-10, closes R-08-24). The Google loader fetched the three families
 * from a third-party host on every build and dev compile; app/fonts.ts now loads byte-identical copies
 * of the @fontsource 5.3.0 files through next/font/local. This file guards:
 * - the loader options: six calls, a preloaded latin face and an on-demand latin-ext companion per
 *   family, each with its unicode-range, swap display and the Google-era fallback font;
 * - the export contract the root layout and the global error UI read;
 * - the committed bytes: every font and licence file hashes to its row in app/fonts/README.md;
 * - that no code or CSS in apps/csrm imports the Google loader or names a Google font host;
 * - the order of the three font tokens in globals.css (each companion ahead of its family).
 * The browser proof on the production build is e2e/design-system-conformance.spec.ts.
 */

type LocalFontOptions = Parameters<typeof localFont>[0];
type LoaderResult = { className: string; style: { fontFamily: string }; variable: string };

const loaderCalls = vi.hoisted(() => [] as Array<{ options: LocalFontOptions; result: LoaderResult }>);

vi.mock('next/font/local', () => ({
  default: (options: LocalFontOptions) => {
    const name = String(options.variable).replace(/^--font-/, '');
    const result = { className: `${name}-font`, style: { fontFamily: name }, variable: `${name}-variable` };
    loaderCalls.push({ options, result });
    return result;
  },
}));

const fontsModule = await import('../../../app/fonts');

const webRoot = process.cwd();
const repoRoot = resolve(webRoot, '..', '..');
const appRoot = join(webRoot, 'app');
const fontsDirectory = join(appRoot, 'fonts');
const thisFile = resolve(webRoot, 'src', 'lib', 'security', 'self-hosted-fonts.test.ts');
const display = (path: string) => relative(repoRoot, path).split(sep).join('/');

const skippedDirectories = new Set(['node_modules', '.next', '.tmp', 'test-results']);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return skippedDirectories.has(entry.name) ? [] : walk(path);
    return [path];
  });
}

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const filesIn = (extension: string) => readdirSync(fontsDirectory).filter((name) => name.endsWith(extension)).sort();

/* The ranges Google Fonts and @fontsource use for the two subsets (RESEARCH.md section 3). */
const latinRange =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const latinExtRange =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

const face = (file: string, weight: string) => ({ path: `./fonts/${file}`, weight, style: 'normal' });

/* The expected call per CSS variable: latin preloaded with the Google-era fallback, latin-ext on demand. */
const expectedCalls = {
  '--font-jakarta': {
    src: ['400', '500', '600'].map((weight) => face(`plus-jakarta-sans-latin-${weight}-normal.woff2`, weight)),
    preload: true,
    adjustFontFallback: 'Arial',
    range: latinRange,
  },
  '--font-jakarta-latin-ext': {
    src: ['400', '500', '600'].map((weight) => face(`plus-jakarta-sans-latin-ext-${weight}-normal.woff2`, weight)),
    preload: false,
    adjustFontFallback: false,
    range: latinExtRange,
  },
  '--font-instrument': {
    src: [face('instrument-serif-latin-400-normal.woff2', '400')],
    preload: true,
    adjustFontFallback: 'Times New Roman',
    range: latinRange,
  },
  '--font-instrument-latin-ext': {
    src: [face('instrument-serif-latin-ext-400-normal.woff2', '400')],
    preload: false,
    adjustFontFallback: false,
    range: latinExtRange,
  },
  '--font-plex-mono': {
    src: ['400', '500'].map((weight) => face(`ibm-plex-mono-latin-${weight}-normal.woff2`, weight)),
    preload: true,
    adjustFontFallback: 'Arial',
    range: latinRange,
  },
  '--font-plex-mono-latin-ext': {
    src: ['400', '500'].map((weight) => face(`ibm-plex-mono-latin-ext-${weight}-normal.woff2`, weight)),
    preload: false,
    adjustFontFallback: false,
    range: latinExtRange,
  },
} as const;

const callFor = (variable: string) => loaderCalls.find((call) => call.options.variable === variable);

/** README table rows (lines starting with a pipe) that name a font or licence file: file name to SHA-256. */
function readmeHashes(): Map<string, string> {
  const rows = readFileSync(join(fontsDirectory, 'README.md'), 'utf8').split(/\r?\n/).filter((line) => line.startsWith('|'));
  const hashes = new Map<string, string>();
  for (const row of rows) {
    // Mixed case: the licence files are named <family>-OFL.txt.
    const files = [...row.matchAll(/`([A-Za-z0-9-]+\.(?:woff2|txt))`/g)].map((match) => match[1]!);
    if (files.length === 0) continue;
    const values = [...row.matchAll(/`([0-9a-f]{64})`/g)].map((match) => match[1]!);
    expect(files, `README row names exactly one file: ${row}`).toHaveLength(1);
    expect(values, `README row for ${files[0]} carries exactly one SHA-256`).toHaveLength(1);
    expect(hashes.has(files[0]!), `README lists ${files[0]} once`).toBe(false);
    hashes.set(files[0]!, values[0]!);
  }
  return hashes;
}

/* Written with escaped slashes and dots so neither pattern can match its own source text. */
const googleLoaderSpecifier = /['"`](?:@?next)\/font\/google(?:\/[^'"`]*)?['"`]/;
const googleFontHost = /fonts\.(?:googleapis|gstatic)\.com/;

describe('the self-hosted type families (G-10, R-08-24)', () => {
  it('loads each family through next/font/local: latin preloaded, latin-ext on demand, swap display', () => {
    expect(loaderCalls).toHaveLength(6);
    expect(loaderCalls.map((call) => call.options.variable).sort()).toEqual(Object.keys(expectedCalls).sort());

    for (const [variable, expected] of Object.entries(expectedCalls)) {
      const call = callFor(variable);
      expect(call, `a call for ${variable}`).toBeDefined();
      const { options } = call!;
      expect(options.src, `${variable} src`).toEqual(expected.src);
      expect(options.display, `${variable} display`).toBe('swap');
      expect(options.preload, `${variable} preload`).toBe(expected.preload);
      expect(options.adjustFontFallback, `${variable} adjustFontFallback`).toBe(expected.adjustFontFallback);
      expect(options.declarations, `${variable} declarations`).toEqual([{ prop: 'unicode-range', value: expected.range }]);
    }
  });

  it('exports the three latin faces and the six variable classes for the html element, and nothing else', () => {
    expect(Object.keys(fontsModule).sort()).toEqual(['fontVariableClassName', 'instrument', 'jakarta', 'plexMono']);
    expect(fontsModule.jakarta).toBe(callFor('--font-jakarta')?.result);
    expect(fontsModule.instrument).toBe(callFor('--font-instrument')?.result);
    expect(fontsModule.plexMono).toBe(callFor('--font-plex-mono')?.result);
    expect(fontsModule.fontVariableClassName).toBe(
      'jakarta-variable jakarta-latin-ext-variable instrument-variable instrument-latin-ext-variable plex-mono-variable plex-mono-latin-ext-variable',
    );
  });

  it('serves only committed files that hash to their README rows, with the OFL text beside them', () => {
    const hashes = readmeHashes();
    const committed = [...filesIn('.woff2'), ...filesIn('.txt')].sort();
    const listed = [...hashes.keys()].sort();
    expect(committed.filter((name) => !hashes.has(name)), 'files in app/fonts the README does not list').toEqual([]);
    expect(listed.filter((name) => !committed.includes(name)), 'README files missing from app/fonts').toEqual([]);

    const sourceFiles = loaderCalls.flatMap((call) => (Array.isArray(call.options.src) ? call.options.src : [{ path: call.options.src }]));
    for (const { path } of sourceFiles) {
      const file = resolve(appRoot, path);
      expect(existsSync(file), `${path} exists`).toBe(true);
      expect(sha256(file), `${path} matches its README SHA-256`).toBe(hashes.get(basename(file)));
    }
    expect(sourceFiles.map(({ path }) => basename(path)).sort(), 'every committed woff2 file is loaded').toEqual(filesIn('.woff2'));

    const licences = filesIn('.txt');
    expect(licences).toEqual(['ibm-plex-mono-OFL.txt', 'instrument-serif-OFL.txt', 'plus-jakarta-sans-OFL.txt']);
    for (const licence of licences) {
      const path = join(fontsDirectory, licence);
      expect(sha256(path), `${licence} matches its README SHA-256`).toBe(hashes.get(licence));
      expect(readFileSync(path, 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    }

    const woff2 = filesIn('.woff2');
    const subsetFile = /^([a-z-]+?)-latin(-ext)?-(\d{3})-normal\.woff2$/;
    for (const name of woff2) {
      const match = subsetFile.exec(name);
      expect(match, `${name} is a latin or latin-ext file`).not.toBeNull();
      const [, family, ext, weight] = match!;
      const partner = ext ? `${family}-latin-${weight}-normal.woff2` : `${family}-latin-ext-${weight}-normal.woff2`;
      expect(woff2, `${name} has its partner ${partner}`).toContain(partner);
    }
  });

  it('leaves no Google loader import or Google font host in apps/csrm code or CSS', () => {
    const rootFiles = readdirSync(webRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:ts|mjs|js|cjs)$/.test(entry.name))
      .map((entry) => join(webRoot, entry.name));
    const files = [...['app', 'src', 'e2e', 'scripts'].flatMap((directory) => walk(join(webRoot, directory))), ...rootFiles]
      .filter((path) => /\.(?:ts|tsx|js|jsx|mjs|cjs|css)$/.test(path))
      .filter((path) => path !== thisFile);
    expect(existsSync(thisFile)).toBe(true);

    const loaderImports: string[] = [];
    const fontHosts: string[] = [];
    for (const path of files) {
      const source = readFileSync(path, 'utf8');
      if (googleLoaderSpecifier.test(source)) loaderImports.push(display(path));
      if (googleFontHost.test(source)) fontHosts.push(display(path));
    }

    expect(files.length).toBeGreaterThan(100);
    expect(loaderImports, 'files that import the Google font loader').toEqual([]);
    expect(fontHosts, 'files that name a Google font host').toEqual([]);
  });

  it('lists each latin-ext companion ahead of its family in the three font tokens', () => {
    const css = readFileSync(join(appRoot, 'globals.css'), 'utf8');
    const token = (name: string) => {
      const matches = [...css.matchAll(new RegExp(`${name}:([^;]+);`, 'g'))];
      expect(matches, `${name} is declared once`).toHaveLength(1);
      return matches[0]![1]!.replace(/\s+/g, ' ').trim();
    };

    expect(token('--font-sans')).toBe('var(--font-jakarta-latin-ext), var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif');
    expect(token('--font-display')).toBe(
      'var(--font-instrument-latin-ext), var(--font-instrument), "Instrument Serif", "Plus Jakarta Sans", system-ui, serif',
    );
    expect(token('--font-mono')).toBe('var(--font-plex-mono-latin-ext), var(--font-plex-mono), "IBM Plex Mono", ui-monospace, monospace');
  });
});
