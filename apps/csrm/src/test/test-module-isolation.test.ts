import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Test modules stay apart (Phase 12 code review, IN-401). Importing a test file registers its describe blocks, mocks
 * and hooks in the importer: its tests run a second time under the wrong file, and the importer depends on another
 * suite's mocks. Data two suites share lives in a test fixtures module (`test-fixtures.ts`) instead, which is not a
 * test file and which only tests import, so its data never ships.
 */

const webRoot = process.cwd();
const display = (path: string) => relative(webRoot, path).split(sep).join('/');

function modules(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return modules(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

const isTestFile = (path: string) => /\.(test|spec)\.tsx?$/.test(path);
const sourceModules = [resolve(webRoot, 'app'), resolve(webRoot, 'src')].flatMap(modules);

/** The specifiers a module imports or re-exports, statically or with import(). */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)(['"])([^'"]+)\1/gm)].map(([, , specifier]) => specifier);
}

const namesTestFile = (specifier: string) => /\.(test|spec)(\.tsx?)?$/.test(specifier);
const namesTestFixtures = (specifier: string) => /(^|\/)test-fixtures(\.tsx?)?$/.test(specifier);

function importsOf(files: readonly string[], names: (specifier: string) => boolean): string[] {
  return files.flatMap((file) => importSpecifiers(readFileSync(file, 'utf8')).filter(names).map((specifier) => `${display(file)} -> ${specifier}`));
}

describe('test module isolation (IN-401)', () => {
  it('reads the web source', () => {
    expect(sourceModules.filter(isTestFile).length).toBeGreaterThan(100);
    expect(importSpecifiers("import a from './a';\nexport { b } from \"./b\";\nimport './c';\nconst d = await import('./d');")).toEqual(['./a', './b', './c', './d']);
  });

  it('imports no test file from another', () => {
    expect(importsOf(sourceModules.filter(isTestFile), namesTestFile)).toEqual([]);
  });

  it('imports a test fixtures module from tests only, so its data never ships', () => {
    expect(importsOf(sourceModules.filter((file) => !isTestFile(file)), namesTestFixtures)).toEqual([]);
  });
});
