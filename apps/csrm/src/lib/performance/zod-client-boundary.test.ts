import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
 *
 * The walk stops at a dynamic import(), so the AI assistance modules on the assessment editor route, whose run sheet
 * and source view load their bodies that way, are also walked from their own files (Phase 12 D-36, WR-407, below).
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

/**
 * Every import chain by which a client module reached from the entry files imports zod. An entry is server code until
 * a 'use client' directive says otherwise, unless `asClient` says the browser may load it whichever side renders it.
 */
function clientChainsToZodFrom(entries: readonly string[], asClient = false): string[] {
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
  for (const file of entries) visit(file, asClient, []);
  return chains;
}

/** Every import chain by which a client module rendered for the route reaches zod. */
function clientChainsToZod(routeDirectory: string): string[] {
  return clientChainsToZodFrom(segmentChain(routeDirectory));
}

/*
 * Every route under app/(app) whose pages validate nothing in the browser, with the directory of each page
 * (UI-SPEC Notes carried, plan 11-09). It began as the Phase 8 key routes (plan 08-13, D-24) and now lists every
 * route, so no route ships zod to the browser by accident. A route that validates in the browser by design is
 * listed in routesWithClientValidation instead, with why; the coverage test below fails on a route in neither.
 */
const routesWithoutClientValidation = [
  ['/app', '(app)/app'],
  ['/app/requests', '(app)/app/requests/(my-requests)'],
  ['/app/requests/{documentId}', '(app)/app/requests/[documentId]'],
  ['/app/questionnaires', '(app)/app/questionnaires'],
  ['/app/assessments', '(app)/app/assessments'],
  ['/app/assessments/{documentId}', '(app)/app/assessments/[documentId]'],
  // Phase 19 (19-12, D-23): the Requestor's print-ready report; its toolbar is its one new client module.
  ['/app/assessments/{documentId}/report', '(app)/app/assessments/[documentId]/report'],
  ['/app/review/assigned', '(app)/app/review/assigned'],
  ['/app/review/requests', '(app)/app/review/requests'],
  // The phase 8 code review found it carried zod through one import (WR-07, R-08-32).
  ['/app/review/requests/{documentId}', '(app)/app/review/requests/[documentId]'],
  ['/app/review/questionnaires', '(app)/app/review/questionnaires'],
  ['/app/review/questionnaires/{documentId}', '(app)/app/review/questionnaires/[documentId]'],
  ['/app/review/assessments', '(app)/app/review/assessments'],
  ['/app/review/assessments/{documentId}', '(app)/app/review/assessments/[documentId]'],
  // Phase 19 (19-12, D-23): the analyst's print-ready report, once released.
  ['/app/review/assessments/{documentId}/report', '(app)/app/review/assessments/[documentId]/report'],
  ['/app/risks', '(app)/app/risks/(register)'],
  ['/app/risks/{documentId}', '(app)/app/risks/[documentId]'],
  ['/app/alerts', '(app)/app/alerts'],
  ['/app/reports', '(app)/app/reports/(report-index)'],
  ['/app/reports/risk-exposure', '(app)/app/reports/[reportKey]'],
  ['/app/admin/controls', '(app)/app/admin/[collection]'],
] as const;

/*
 * The routes whose pages validate input in the browser by design, so zod is expected there: each renders a form
 * that checks its fields with the shared schema before the Server Action checks them again.
 * - The request form, to create a request and to edit a draft (request-form.tsx).
 * - The administration form, to create a record and to edit one (administration-form.tsx).
 * - The CSV import, which checks a file's rows before it sends them (csv-import-flow.tsx).
 * - The questionnaire a Requestor answers (questionnaire-renderer.tsx), proved below.
 */
const routesWithClientValidation = [
  '(app)/app/requests/new',
  '(app)/app/requests/[documentId]/edit',
  '(app)/app/admin/[collection]/new',
  '(app)/app/admin/[collection]/[documentId]',
  '(app)/app/admin/[collection]/import',
  '(app)/app/questionnaires/[documentId]',
] as const;

/** Every directory under app/(app) holding a page, relative to app/. */
function appRouteDirectories(): string[] {
  const directories: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(directory, entry.name));
    }
    if (moduleNamed(directory, 'page')) directories.push(relative(appDirectory, directory).split(sep).join('/'));
  };
  walk(resolve(appDirectory, '(app)'));
  return directories.sort();
}

describe('zod in the browser', () => {
  it('guards every route under app/(app): each is listed, or documented as validating in the browser', () => {
    const classified = [...routesWithoutClientValidation.map(([, directory]) => directory), ...routesWithClientValidation].sort();
    expect(classified).toEqual(appRouteDirectories());
  });

  it.each(routesWithoutClientValidation)('%s downloads no zod: no client module it renders imports it', (_route, directory) => {
    expect(clientChainsToZod(directory)).toEqual([]);
  });

  it('is found on the one key route that validates in the browser: the questionnaire a Requestor answers', () => {
    expect(clientChainsToZod('(app)/app/questionnaires/[documentId]')).toEqual(
      expect.arrayContaining([expect.stringMatching(/questionnaire-renderer\.tsx -> (zod|@hookform\/resolvers\/zod)$/)]),
    );
  });
});

/*
 * The AI assistance modules on the assessment editor route (Phase 12 D-36, WR-407). The route's own budget is now
 * 460,000 bytes (docs/performance/phase-08-baseline.md), so it would no longer catch the regressions D-36 guards
 * against: zod reaching the editor's AI code, or a body that loads on demand joining the first load. These checks do.
 *
 * The modules that import zod are listed, each with why the browser never loads it, in the manner of the parser-free
 * inventory (features/parser-free-modules.ts): an unlisted module that imports zod fails, and so does a listed one
 * that no longer does. Any other module may reach the browser, whichever side renders it, so none of them may reach zod
 * through a static import chain. The route walk above stops at a dynamic import(), so this walk is what keeps the run
 * sheet's and the source view's lazily loaded bodies zod-free.
 */
type AiZodModule = {
  readonly modulePath: string;
  readonly boundary: 'server-action' | 'server-only' | 'server-schema';
  readonly reason: string;
};

const aiAssistanceZodModules: readonly AiZodModule[] = [
  {
    modulePath: 'ai-assistance-actions.ts',
    boundary: 'server-action',
    reason: "A 'use server' module: the browser holds references to its actions, never their code.",
  },
  {
    modulePath: 'ai-assistance-schema.ts',
    boundary: 'server-schema',
    reason: 'The AI run and decision parsers: only the Server Action and the service import its values; components import its types.',
  },
  {
    modulePath: 'ai-assistance-service.ts',
    boundary: 'server-only',
    reason: "It starts with import 'server-only', so a build that pulls it into the browser fails.",
  },
  {
    modulePath: 'ai-generation-facts-schema.ts',
    boundary: 'server-schema',
    reason: 'The generation facts and AI-inputs signal parsers: only the assessment, questionnaire and request schemas import it, and the route walks above keep them out of the browser.',
  },
];

const aiAssistanceDirectory = resolve(webRoot, 'src', 'features', 'ai-assistance');
const aiAssistanceModules = readdirSync(aiAssistanceDirectory).filter((name) => /\.tsx?$/.test(name) && !/\.(test|spec)\./.test(name)).sort();
const aiSource = (name: string) => readFileSync(join(aiAssistanceDirectory, name), 'utf8');

/** Every module under the directory, its tests and declarations excepted. */
function sourceModules(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceModules(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') && !/\.(test|spec)\./.test(entry.name) ? [path] : [];
  });
}

/* The two bodies D-36 loads on demand, and the module that loads each; their frames load with the route (WR-307). */
const lazyBodies = [
  { body: 'ai-run-sheet', loader: 'ai-run-sheet-trigger.tsx' },
  { body: 'ai-source-popover', loader: 'ai-citations.tsx' },
] as const;

describe('the AI assistance modules on the editor route (D-36, WR-407)', () => {
  it('lists every AI assistance module that imports zod, each with why the browser never loads it', () => {
    const importingZod = aiAssistanceModules.filter((name) => valueImports(aiSource(name)).some((specifier) => isZod(specifier)));
    expect(importingZod).toEqual(aiAssistanceZodModules.map((module) => module.modulePath).sort());
    for (const module of aiAssistanceZodModules) expect(module.reason, module.modulePath).not.toBe('');
  });

  it('keeps each listed module where its reason puts it', () => {
    for (const { boundary, modulePath } of aiAssistanceZodModules) {
      const source = aiSource(modulePath);
      expect(hasDirective(source, 'use client'), modulePath).toBe(false);
      if (boundary === 'server-action') expect(hasDirective(source, 'use server'), modulePath).toBe(true);
      if (boundary === 'server-only') expect(fromFirstStatement(source), modulePath).toMatch(/^import\s+(['"])server-only\1/);
    }
  });

  it('reaches no zod from any other AI assistance module, whichever side renders it, the lazily loaded bodies included', () => {
    const listed = new Set(aiAssistanceZodModules.map((module) => module.modulePath));
    const entries = aiAssistanceModules.filter((name) => !listed.has(name)).map((name) => join(aiAssistanceDirectory, name));
    expect(entries.map(display)).toEqual(expect.arrayContaining(lazyBodies.map(({ body }) => `src/features/ai-assistance/${body}.tsx`)));
    expect(clientChainsToZodFrom(entries, true)).toEqual([]);
  });

  it.each(lazyBodies)('loads $body only through import(), so the editor’s first load never carries it', ({ body, loader }) => {
    expect(aiSource(loader)).toContain(`import('./${body}')`);
    const namesBody = new RegExp(`(^|/)${body}(\\.tsx)?$`);
    const staticImporters = [resolve(webRoot, 'app'), resolve(webRoot, 'src')].flatMap(sourceModules)
      .filter((file) => valueImports(readFileSync(file, 'utf8')).some((specifier) => namesBody.test(specifier)))
      .map(display);
    expect(staticImporters).toEqual([]);
  });
});

/*
 * The assign picker (13-UI-SPEC §6; Phase 13 WR-503). The analyst request page's assignment block loads it with
 * import(), where the route walk above stops, so it is walked here as a client entry: anything it reaches, through any
 * name, is downloaded when an analyst opens it. It may be loaded no other way, so the request page's first load never
 * carries it.
 */
describe('the lazily loaded assign picker (WR-503)', () => {
  const picker = resolve(webRoot, 'src/features/request-assignment/assign-picker.tsx');

  it('reaches no zod through any static import chain, whichever side renders it', () => {
    expect(clientChainsToZodFrom([picker], true)).toEqual([]);
  });

  it('is loaded only through import() from the assignment block', () => {
    expect(readFileSync(resolve(webRoot, 'src/features/request-assignment/assignment-block.tsx'), 'utf8')).toContain("import('./assign-picker')");
    const staticImporters = [resolve(webRoot, 'app'), resolve(webRoot, 'src')].flatMap(sourceModules)
      .filter((file) => valueImports(readFileSync(file, 'utf8')).some((specifier) => /(^|\/)assign-picker(\.tsx)?$/.test(specifier)))
      .map(display);
    expect(staticImporters).toEqual([]);
  });
});

/*
 * The attachments feature (Phase 14; IN-604). These replace the feature tests' source greps, which a multi-line import,
 * a re-export or an `import type` could pass or fail by accident: each claim is read from the module graph the walks
 * above use. The AI control and the text preview are client modules; the files variant of the context failure renders
 * on either side, so it carries no directive. None of them, nor the file store the shell loads on every route, reaches
 * zod through any static import chain. The preview sheet loads only through import(), where the route walks stop, so it
 * is walked as a client entry here and has no static importer. And the store reaches the queue's plain model only, never
 * the feature's words, its checks or the refusal copy they read, so the shell's first load on every route stays lean.
 */
describe('the attachments feature’s client modules (Phase 14; IN-604)', () => {
  const attachmentsDirectory = resolve(webRoot, 'src', 'features', 'attachments');
  const attachmentModule = (name: string) => join(attachmentsDirectory, name);
  const attachmentSource = (name: string) => readFileSync(attachmentModule(name), 'utf8');

  /** Every application module the entry reaches through static value imports; a 'use server' module's code stays on the server. */
  function valueImportClosure(entry: string): string[] {
    const reached = new Set<string>();
    const visit = (file: string): void => {
      if (reached.has(file)) return;
      reached.add(file);
      const source = readFileSync(file, 'utf8');
      if (hasDirective(source, 'use server')) return;
      for (const specifier of valueImports(source)) {
        const target = resolveModule(file, specifier);
        if (target) visit(target);
      }
    };
    visit(entry);
    return [...reached].map(display).sort();
  }

  it.each(['file-ai-control.tsx', 'file-text-sheet.tsx'])('%s is a client module', (name) => {
    expect(hasDirective(attachmentSource(name), 'use client')).toBe(true);
  });

  it('renders the files variant of the context failure on either side: it carries no directive', () => {
    expect(hasDirective(attachmentSource('context-too-large-files.tsx'), 'use client')).toBe(false);
    expect(hasDirective(attachmentSource('context-too-large-files.tsx'), 'use server')).toBe(false);
  });

  it('reaches no zod from the AI control, the text preview, the context failure or the file store, whichever side renders them', () => {
    const entries = ['file-ai-control.tsx', 'file-text-sheet.tsx', 'context-too-large-files.tsx', 'file-store.tsx'].map(attachmentModule);
    expect(clientChainsToZodFrom(entries, true)).toEqual([]);
  });

  it('loads the text preview only through import() from the AI control, so no request page’s first load carries it', () => {
    expect(attachmentSource('file-ai-control.tsx')).toContain("import('./file-text-sheet')");
    const staticImporters = [resolve(webRoot, 'app'), resolve(webRoot, 'src')].flatMap(sourceModules)
      .filter((file) => valueImports(readFileSync(file, 'utf8')).some((specifier) => /(^|\/)file-text-sheet(\.tsx)?$/.test(specifier)))
      .map(display);
    expect(staticImporters).toEqual([]);
  });

  it('keeps the shell’s file store to the queue’s plain model: never the attachments domain or the refusal copy', () => {
    const reached = valueImportClosure(attachmentModule('file-store.tsx'));
    expect(reached).toContain('src/features/attachments/upload-queue-model.ts');
    expect(reached).not.toContain('src/features/attachments/attachments-domain.ts');
    expect(reached).not.toContain('src/lib/api/refusal-copy.ts');
    expect(valueImports(attachmentSource('upload-queue-model.ts'))).toEqual([]);
  });
});

/*
 * Phase 16's risk curation client modules (16-UI-SPEC §6, §8; D-48; plan 16-12). The card actions, the withdraw form and
 * its hook, the withdrawn card and the history pill and frame load with the assessment editor; the history sheet's body
 * loads only through import() from its trigger, where the route walks stop, so it is walked as a client entry here. None
 * reaches zod through any static import chain, and none of the modules that load with the page reaches family R's
 * refusal copy, which only the lazily loaded history sheet reads.
 */
describe('the risk curation client modules (Phase 16; D-48)', () => {
  const curationDirectory = resolve(webRoot, 'src', 'features', 'risk-curation');
  const curationModule = (name: string) => join(curationDirectory, name);
  const firstLoad = ['risk-card-actions.tsx', 'withdraw-risk-form.tsx', 'use-risk-withdrawal.ts', 'withdrawn-risk-card.tsx', 'risk-history-trigger.tsx', 'risk-history-frame.tsx'];

  /** Every application module the entry reaches through static value imports; a 'use server' module's code stays on the server. */
  function valueImportClosure(entry: string): string[] {
    const reached = new Set<string>();
    const visit = (file: string): void => {
      if (reached.has(file)) return;
      reached.add(file);
      const source = readFileSync(file, 'utf8');
      if (hasDirective(source, 'use server')) return;
      for (const specifier of valueImports(source)) {
        const target = resolveModule(file, specifier);
        if (target) visit(target);
      }
    };
    visit(entry);
    return [...reached].map(display).sort();
  }

  it('reaches no zod from any of them, the lazily loaded history sheet included', () => {
    expect(clientChainsToZodFrom([...firstLoad, 'risk-history-sheet.tsx'].map(curationModule), true)).toEqual([]);
  });

  it('loads the history sheet only through import() from its trigger', () => {
    expect(readFileSync(curationModule('risk-history-trigger.tsx'), 'utf8')).toContain("import('./risk-history-sheet')");
    const staticImporters = [resolve(webRoot, 'app'), resolve(webRoot, 'src')].flatMap(sourceModules)
      .filter((file) => valueImports(readFileSync(file, 'utf8')).some((specifier) => /(^|\/)risk-history-sheet(\.tsx)?$/.test(specifier)))
      .map(display);
    expect(staticImporters).toEqual([]);
  });

  it.each(firstLoad)('%s reaches no refusal copy module', (name) => {
    const reached = valueImportClosure(curationModule(name));
    expect(reached).not.toContain('src/features/risk-curation/risk-curation-refusal-copy.ts');
    expect(reached).not.toContain('src/lib/api/refusal-copy.ts');
  });
});

/*
 * Plan 16-13's AI proposals and rewrite modules (16-UI-SPEC §2 to §5; D-48). The section's loader, the rewrite control,
 * the signal's Suggest more risks and the job hand-off load with the assessment editor; the section's body loads only
 * through next/dynamic from its loader, and the rewrite form's body only through next/dynamic from the control, where the
 * route walks stop, so they are walked as client entries here with the cards, the AI rewrite and the decisions hook that
 * they reach. None reaches zod, and none of the first-load modules reaches a refusal copy module.
 */
describe('the AI proposals and rewrite client modules (Phase 16 plan 16-13; D-48)', () => {
  const curationDirectory = resolve(webRoot, 'src', 'features', 'risk-curation');
  const curationModule = (name: string) => join(curationDirectory, name);
  const firstLoad = ['ai-proposals-section-loader.tsx', 'rewrite-form.tsx', 'suggest-more-risks-button.tsx', 'risk-proposal-job-handoff.ts'];
  const onDemand = ['ai-proposals-section-client.tsx', 'proposed-risk-card.tsx', 'rewrite-form-body.tsx', 'risk-rewrite.tsx', 'risk-proposal-job.tsx', 'use-risk-proposal-decisions.ts'];

  function valueImportClosure(entry: string): string[] {
    const reached = new Set<string>();
    const visit = (file: string): void => {
      if (reached.has(file)) return;
      reached.add(file);
      const source = readFileSync(file, 'utf8');
      if (hasDirective(source, 'use server')) return;
      for (const specifier of valueImports(source)) {
        const target = resolveModule(file, specifier);
        if (target) visit(target);
      }
    };
    visit(entry);
    return [...reached].map(display).sort();
  }

  it('reaches no zod from any of them, the on-demand bodies included', () => {
    expect(clientChainsToZodFrom([...firstLoad, ...onDemand].map(curationModule), true)).toEqual([]);
  });

  it.each([
    ['ai-proposals-section-client', 'ai-proposals-section-loader.tsx'],
    ['rewrite-form-body', 'rewrite-form.tsx'],
  ])('loads %s only through import() from %s', (body, loader) => {
    expect(readFileSync(curationModule(loader), 'utf8')).toContain(`import('./${body}')`);
    const staticImporters = [resolve(webRoot, 'app'), resolve(webRoot, 'src')].flatMap(sourceModules)
      .filter((file) => valueImports(readFileSync(file, 'utf8')).some((specifier) => new RegExp(`(^|/)${body}(\.tsx)?$`).test(specifier)))
      .map(display);
    expect(staticImporters).toEqual([]);
  });

  /*
   * 16-15: next/dynamic gives a body a Suspense boundary of its own only when it has `loading` (or ssr: false). A body
   * first rendered after an interaction without one suspends the page's boundary, hiding the whole editor behind its
   * skeleton and losing the scroll position, which left the rewrite popover anchored to nothing.
   */
  it.each([
    ['rewrite-form-body', resolve(curationDirectory, 'rewrite-form.tsx')],
    ['risk-rewrite', resolve(webRoot, 'src', 'features', 'assessments', 'assessment-editor.tsx')],
  ])('gives %s a Suspense boundary of its own (a loading option)', (body, loader) => {
    const source = readFileSync(loader, 'utf8');
    const start = source.indexOf(`/${body}')`);
    expect(start, `${body} is loaded through import()`).toBeGreaterThan(-1);
    const call = source.slice(source.lastIndexOf('dynamic', start), source.indexOf('\n});', start) + 4);
    expect(call).toContain('loading:');
  });

  it.each(firstLoad)('%s reaches no refusal copy module', (name) => {
    const reached = valueImportClosure(curationModule(name));
    expect(reached).not.toContain('src/features/risk-curation/risk-curation-refusal-copy.ts');
    expect(reached).not.toContain('src/lib/api/refusal-copy.ts');
  });
});
