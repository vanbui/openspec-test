import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * A list's loading boundary wraps the list alone (quick 261018-1al). Next renders a segment's
 * loading.tsx around everything below that segment, so a list page whose loading.tsx sits in the
 * section directory also wraps the section's record routes: the record's first load then carries the
 * list skeleton's client code, and a record opened from another section flashes the list skeleton
 * first. On /app/risks/{documentId} that was the whole Risk Register table and its filters with
 * @tanstack/table-core (36,069 gzipped bytes), and on /app/requests/{documentId} the My requests
 * table (8,437), measured on the production build that Phase 19 closed with.
 *
 * The fix is the `(report-index)` pattern from Phase 18: the list's page and loading live in a route
 * group, which adds no URL segment, so the boundary wraps the list page only. The section's error.tsx
 * stays in the section directory, so a failure on a child route without its own error boundary (New
 * request, Edit request) still shows the section's error state.
 */

const appRoutes = resolve(process.cwd(), 'app', '(app)', 'app');
const display = (path: string) => relative(appRoutes, path).split(sep).join('/') || '.';
const isGroup = (name: string) => name.startsWith('(') && name.endsWith(')');

function directories(directory: string): string[] {
  return readdirSync(directory).filter((name) => statSync(join(directory, name)).isDirectory()).map((name) => join(directory, name));
}

function allDirectories(directory: string): string[] {
  return [directory, ...directories(directory).flatMap(allDirectories)];
}

/** A directory whose own page has its own loading boundary and that also holds child route segments. */
function listBoundariesWrappingChildRoutes(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const directory of allDirectories(appRoutes)) {
    if (!existsSync(join(directory, 'page.tsx')) || !existsSync(join(directory, 'loading.tsx'))) continue;
    const children = directories(directory).map((child) => child.slice(directory.length + 1)).filter((name) => !isGroup(name));
    if (children.length > 0) found.set(display(directory), children.sort());
  }
  return found;
}

/*
 * The list boundaries that still wrap their records, each with its reason. A new entry needs one: the
 * default is a route group. These routes are not under budget pressure today.
 */
const knownWrappingListBoundaries: Record<string, string> = {
  '.': 'Home renders only its page header there, a server component with no client code of its own',
  assessments: 'not yet moved into a route group',
  'assessments/[documentId]': 'the record skeleton around its report',
  questionnaires: 'not yet moved into a route group',
  'requests/[documentId]': 'the record skeleton around its edit form',
  'review/assessments': 'not yet moved into a route group',
  'review/assessments/[documentId]': 'the record skeleton around its report',
  'review/questionnaires': 'not yet moved into a route group',
  'review/requests': 'not yet moved into a route group',
};

describe('list loading boundaries (quick 261018-1al)', () => {
  it('wraps no record route beyond the known list', () => {
    const unexpected = [...listBoundariesWrappingChildRoutes()]
      .filter(([directory]) => !(directory in knownWrappingListBoundaries))
      .map(([directory, children]) => `${directory}/loading.tsx wraps ${children.join(', ')}`);
    expect(unexpected).toEqual([]);
  });

  it.each([
    ['risks', '(register)', ['[documentId]']],
    ['requests', '(my-requests)', ['[documentId]', 'new']],
    ['reports', '(report-index)', ['[reportKey]']],
  ])('keeps the %s list page and its loading boundary in %s, beside the records', (section, group, records) => {
    const sectionDirectory = join(appRoutes, section);
    expect(existsSync(join(sectionDirectory, group, 'page.tsx'))).toBe(true);
    expect(existsSync(join(sectionDirectory, group, 'loading.tsx'))).toBe(true);
    expect(existsSync(join(sectionDirectory, 'page.tsx'))).toBe(false);
    expect(existsSync(join(sectionDirectory, 'loading.tsx'))).toBe(false);
    for (const record of records) expect(existsSync(join(sectionDirectory, record)), `${section}/${record}`).toBe(true);
  });

  it.each(['risks', 'requests'])('leaves the %s error boundary in the section, so it still covers every child route', (section) => {
    expect(existsSync(join(appRoutes, section, 'error.tsx'))).toBe(true);
  });
});
