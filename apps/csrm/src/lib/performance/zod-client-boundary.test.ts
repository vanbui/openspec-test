import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Zod stays out of the browser on the key routes that validate nothing there (plan 08-13, D-24).
 * zod's classic API cannot be tree-shaken, so a client module that imports any value from a module
 * which also defines a zod schema downloads the whole library: 64,389 bytes delivered (284,738 raw)
 * on the Phase 8 baseline. The baseline found it on eight of the ten key routes, where each client
 * component needed only a constant, a formatter or a sibling component from such a module.
 *
 * For each route below the walk starts at the files Next renders for it (the page and every layout,
 * template, loading, error and not-found on its path), follows server imports into each
 * 'use client' boundary, and fails if any client module reaches zod through a static import. A
 * type-only import is erased, and a 'use server' module reaches the client as references only, so
 * neither counts. docs/performance/phase-08-baseline.md records the measured effect.
 */

const webRoot = process.cwd();
const appDirectory = resolve(webRoot, 'app');
const display = (path: string) => relative(webRoot, path).split(sep).join('/');

const segmentConventions = ['layout', 'template', 'loading', 'error', 'not-found', 'global-error'];
const moduleExtensions = ['.tsx', '.ts'];

function moduleNamed(directory: string, name: string): string | undefined {
  return moduleExtensions.map((extension) => join(directory, `${name}${extension}`)).find((path) => existsSync(path));
}

/** The files Next renders for the route whose page lives in `routeDirectory` (relative to app/). */
function segmentChain(routeDirectory: string): string[] {
  let directory = resolve(appDirectory, routeDirectory);
  const page = moduleNamed(directory, 'page');
  if (!page) throw new Error(`NO_PAGE:${routeDirectory}`);
  const files = [page];
  for (;;) {
    for (const name of segmentConventions) {
      const file = moduleNamed(directory, name);
      if (file) files.push(file);
    }
    if (directory === appDirectory) return files;
    directory = dirname(directory);
  }
}

/** An application module the specifier names, or undefined for a package. */
function resolveModule(from: string, specifier: string): string | undefined {
  const base = specifier.startsWith('@/')
    ? resolve(webRoot, 'src', specifier.slice(2))
    : specifier.startsWith('.') ? resolve(dirname(from), specifier) : undefined;
  if (!base) return undefined;
  const candidates = [base, ...moduleExtensions.map((extension) => `${base}${extension}`), ...moduleExtensions.map((extension) => join(base, `index${extension}`))];
  const found = candidates.find((path) => existsSync(path) && statSync(path).isFile());
  if (!found) throw new Error(`UNRESOLVED_IMPORT:${specifier} from ${display(from)}`);
  return found;
}

/** The source from its first statement on, so a directive after a leading comment is still seen. */
function fromFirstStatement(source: string): string {
  let rest = source.replace(/^﻿/, '');
  for (;;) {
    rest = rest.trimStart();
    if (rest.startsWith('//')) rest = rest.slice(rest.indexOf('\n') === -1 ? rest.length : rest.indexOf('\n') + 1);
    else if (rest.startsWith('/*')) rest = rest.slice(rest.indexOf('*/') === -1 ? rest.length : rest.indexOf('*/') + 2);
    else return rest;
  }
}

const hasDirective = (source: string, directive: string) => new RegExp(`^(['"])${directive}\\1`).test(fromFirstStatement(source));

// import/export … from '…' and bare import '…', at the start of a statement.
const importPattern = /(?:^|[\n;])\s*(?:import|export)\s+(type\s+)?(?:([^;'"]*?)\s+from\s+)?['"]([^'"]+)['"]/g;

/** The specifiers a module imports as values: `import type` and all-`type` named clauses are erased. */
function valueImports(source: string): string[] {
  return [...source.matchAll(importPattern)].flatMap(([, typeOnly, clause = '', specifier]) => {
    if (typeOnly) return [];
    const named = /^\{([\s\S]*)\}$/.exec(clause.trim());
    const bindings = named?.[1].split(',').map((binding) => binding.trim()).filter(Boolean) ?? [];
    return named && bindings.every((binding) => binding.startsWith('type ')) ? [] : [specifier];
  });
}

// The full API; the instrumentation's lean `zod/v4/core` config import is not it.
const isZod = (specifier: string) => specifier === 'zod' || (specifier.startsWith('zod/') && specifier !== 'zod/v4/core')
  || specifier.startsWith('@hookform/resolvers/zod');

/** Every import chain by which a client module rendered for the route reaches zod. */
function clientChainsToZod(routeDirectory: string): string[] {
  const chains: string[] = [];
  const visited = new Set<string>();
  const visit = (file: string, client: boolean, path: readonly string[]): void => {
    const key = `${client ? 'client' : 'server'}:${file}`;
    if (visited.has(key)) return;
    visited.add(key);
    const source = readFileSync(file, 'utf8');
    if (hasDirective(source, 'use server')) return;
    const inClient = client || hasDirective(source, 'use client');
    const here = [...path, display(file)];
    for (const specifier of valueImports(source)) {
      if (inClient && isZod(specifier)) chains.push([...here, specifier].join(' -> '));
      else if (!isZod(specifier)) {
        const target = resolveModule(file, specifier);
        if (target) visit(target, inClient, here);
      }
    }
  };
  for (const file of segmentChain(routeDirectory)) visit(file, false, []);
  return chains;
}

/* The key routes whose pages validate nothing in the browser, with the directory of each page. */
const routesWithoutClientValidation = [
  ['/app', '(app)/app'],
  ['/app/requests', '(app)/app/requests'],
  ['/app/requests/{documentId}', '(app)/app/requests/[documentId]'],
  ['/app/review', '(app)/app/review/(analyst-dashboard)'],
  ['/app/review/assessments/{documentId}', '(app)/app/review/assessments/[documentId]'],
  ['/app/risks', '(app)/app/risks'],
  ['/app/risks/{documentId}', '(app)/app/risks/[documentId]'],
  ['/app/reports/risk-exposure', '(app)/app/reports/[reportKey]'],
  ['/app/admin/controls', '(app)/app/admin/[collection]'],
  // Not a key route: the phase code review found it carried zod through one import (WR-07, R-08-32).
  ['/app/review/requests/{documentId}', '(app)/app/review/requests/[documentId]'],
] as const;

describe('zod in the browser', () => {
  it.each(routesWithoutClientValidation)('%s downloads no zod: no client module it renders imports it', (_route, directory) => {
    expect(clientChainsToZod(directory)).toEqual([]);
  });

  it('is found on the one key route that validates in the browser: the questionnaire a Requestor answers', () => {
    expect(clientChainsToZod('(app)/app/questionnaires/[documentId]')).toEqual(
      expect.arrayContaining([expect.stringMatching(/questionnaire-renderer\.tsx -> (zod|@hookform\/resolvers\/zod)$/)]),
    );
  });
});
