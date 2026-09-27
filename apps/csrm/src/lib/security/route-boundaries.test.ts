import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The route boundary inventory (D-21, T-08-09-01, T-08-09-04).
 *
 * - Every page renders inside an error boundary with safe copy: the nearest error.tsx in its own
 *   directory or an ancestor within app/ (route groups count as directories), or, for a page no
 *   segment boundary covers, app/global-error.tsx. A page inside the signed-in shell must resolve
 *   to an error.tsx inside app/(app), so a failure renders in the shell.
 * - The root has not-found.tsx and global-error.tsx. The shell has its own not-found.tsx: once a
 *   root not-found exists, Next stops injecting its built-in not-found at the first route group
 *   (next-app-loader), so without app/(app)/not-found.tsx a notFound() under app/(app) would fall
 *   through to the root card and drop the shell.
 * - No boundary reads what it receives: no error message, digest or stack reaches the page.
 */

const appRoot = resolve(process.cwd(), 'app');
const shellRoot = join(appRoot, '(app)');

type NamesAt = (directory: string) => readonly string[];

function isWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}${sep}`);
}

/** The nearest file named by `namesAt` in `start` or an ancestor directory, up to and including `root`. */
function nearest(start: string, root: string, namesAt: NamesAt, exists: (path: string) => boolean): string | null {
  for (let directory = start; isWithin(directory, root); directory = dirname(directory)) {
    const found = namesAt(directory).map((name) => join(directory, name)).find(exists);
    if (found) return found;
    if (directory === root) return null;
  }
  return null;
}

/** Only the root may fall back to global-error, which replaces the root layout. */
const errorBoundaryNames: NamesAt = (directory) => directory === appRoot ? ['error.tsx', 'global-error.tsx'] : ['error.tsx'];
const notFoundNames: NamesAt = () => ['not-found.tsx'];

function filesNamed(directory: string, names: readonly string[]): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesNamed(path, names);
    return names.includes(entry.name) ? [path] : [];
  });
}

const display = (path: string) => relative(process.cwd(), path).split(sep).join('/');

const pages = filesNamed(appRoot, ['page.tsx']);
const shellPages = pages.filter((page) => isWithin(page, shellRoot));
const boundaries = filesNamed(appRoot, ['error.tsx', 'global-error.tsx']);

describe('the route boundary inventory', () => {
  it('finds the pages inside and outside the signed-in shell', () => {
    expect(pages.map(display)).toEqual(expect.arrayContaining([
      'app/page.tsx',
      'app/sign-in/page.tsx',
      'app/(app)/app/page.tsx',
      'app/(app)/app/assessments/[documentId]/page.tsx',
      'app/(app)/app/admin/[collection]/import/page.tsx',
    ]));
    expect(shellPages.length).toBeGreaterThan(20);
    expect(boundaries.length).toBeGreaterThan(20);
  });

  it('keeps the root fallbacks and the in-shell not-found', () => {
    for (const file of ['global-error.tsx', 'not-found.tsx', '(app)/not-found.tsx']) {
      expect(existsSync(join(appRoot, file)), `app/${file}`).toBe(true);
    }
  });

  it.each(pages.map((page) => [display(page), page]))('%s renders inside an error boundary', (_name, page) => {
    const boundary = nearest(dirname(page), appRoot, errorBoundaryNames, existsSync);

    expect(boundary, 'a page with no error.tsx above it and no root fallback').not.toBeNull();
    if (isWithin(page, shellRoot)) {
      expect(display(boundary!), 'a failure inside the shell renders in the shell').toMatch(/^app\/\(app\)\/(.+\/)?error\.tsx$/);
    }
  });

  it.each(shellPages.map((page) => [display(page), page]))('%s resolves notFound() to a not-found inside the shell', (_name, page) => {
    const notFound = nearest(dirname(page), appRoot, notFoundNames, existsSync);

    expect(notFound).not.toBeNull();
    expect(isWithin(notFound!, shellRoot), `${display(notFound!)} renders outside the shell`).toBe(true);
  });

  it('reports a page with no boundary, and a shell page only the root would catch', () => {
    const files = new Set([join(appRoot, 'global-error.tsx'), join(appRoot, 'not-found.tsx')]);
    const exists = (path: string) => files.has(path);
    const shellPage = join(shellRoot, 'app', 'unguarded', 'page.tsx');

    expect(nearest(dirname(shellPage), appRoot, errorBoundaryNames, exists)).toBe(join(appRoot, 'global-error.tsx'));
    expect(nearest(dirname(shellPage), appRoot, notFoundNames, exists)).toBe(join(appRoot, 'not-found.tsx'));
    files.delete(join(appRoot, 'global-error.tsx'));
    expect(nearest(dirname(shellPage), appRoot, errorBoundaryNames, exists)).toBeNull();
  });
});

describe('the error boundaries', () => {
  // Reads of the error's internals, with or without optional chaining, and any rendering of the whole error.
  const internals = [
    /\berror\s*\??\.\s*(?:message|digest|stack)\b/,
    /JSON\.stringify\(\s*error\b/,
    /\bString\(\s*error\b/,
    /\$\{\s*error\b/,
  ];

  it.each(boundaries.map((file) => [display(file), file]))('%s is a client component that never reads error.message, error.digest or error.stack', (_name, file) => {
    const source = readFileSync(file, 'utf8');

    expect(source).toMatch(/^\s*['"]use client['"]/);
    for (const pattern of internals) expect(source).not.toMatch(pattern);
    // The default export never takes the error binding, so no alias of it can reach the markup.
    const parameters = source.match(/export\s+default\s+function\s*\w*\s*\(\s*(\{[^}]*\})?/);
    expect(parameters, 'a default-exported function component').not.toBeNull();
    expect(parameters![1] ?? '').not.toMatch(/\berror\b/);
  });

  it('gives the global error its own document, stylesheet and fonts', () => {
    const source = readFileSync(join(appRoot, 'global-error.tsx'), 'utf8');

    expect(source).toMatch(/import\s+['"]\.\/globals\.css['"]/);
    expect(source).toMatch(/import\s+\{[^}]*\bfontVariableClassName\b[^}]*\}\s+from\s+['"]\.\/fonts['"]/);
    expect(source).toMatch(/<html\b/);
    expect(source).toMatch(/<body\b/);
  });
});
