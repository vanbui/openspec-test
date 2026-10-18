import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const listStateTargets = [
  'src/features/requests/request-table.tsx',
  'src/features/questionnaires/questionnaire-list.tsx',
  'src/features/questionnaires/questionnaire-review-list.tsx',
  'src/features/assessments/assessment-list.tsx',
  'src/features/assessments/released-assessment.tsx',
  'src/features/risks/risk-register.tsx',
  'src/features/administration/administration-workspace.tsx',
  'src/features/home/requestor-home.tsx',
];

const sharedStateImport = /import\s*\{[^}]*\b(?:EmptyState|ErrorState|LoadingState|PermissionDeniedState)\b[^}]*}\s*from\s*['"][^'"]*components\/states\/states['"]/s;
const localListStateHelper = /(?:function|const)\s+(?:\w*(?:Empty|Error|Loading|Permission)\w*(?:State|View)|(?:Empty|Error|Loading|Permission)\w*(?:State|View))\s*[=(]/;
const inlineStateMarkup = /<(?:section|div|article|p|h[1-6])\b/;

/**
 * Returns each DataTable `stateSlots` object (prop or spread form), bounded by
 * brace matching, so only markup inside the slots is inspected. Detail-page
 * alerts elsewhere in the same file are legitimate content, not list states.
 */
function stateSlotBlocks(source) {
  const blocks = [];
  for (const match of source.matchAll(/stateSlots\s*[=:]\s*\{/g)) {
    let depth = 0;
    for (let index = match.index + match[0].length - 1; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.slice(match.index, index + 1));
          break;
        }
      }
    }
  }
  return blocks;
}

const sharedStatePrimitives = new Set(['EmptyState', 'ErrorState', 'LoadingState', 'PermissionDeniedState']);

/** Index just past the bracket that closes the one at `openIndex`, or -1. */
function matchBracket(source, openIndex, open, close) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    else if (source[index] === close) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

/**
 * Body of a same-file component declaration (`function Name(...) {...}` or
 * `const Name = (...) => ...`), or null when the component is not declared here.
 */
function componentBody(source, name) {
  const declaration = new RegExp(`(?:function\\s+${name}\\s*(?:<[^>]*>)?\\s*\\(|const\\s+${name}\\s*=\\s*(?:\\([^)]*\\)|\\w+)?\\s*)`).exec(source);
  if (!declaration) return null;
  let cursor = declaration.index + declaration[0].length;
  if (source[cursor - 1] === '(') {
    const paramsEnd = matchBracket(source, cursor - 1, '(', ')');
    if (paramsEnd < 0) return null;
    cursor = paramsEnd;
  }
  const rest = source.slice(cursor);
  const bodyStart = rest.search(/[{(<]|=>/);
  if (bodyStart < 0) return null;
  let start = cursor + bodyStart;
  if (source.startsWith('=>', start)) start = cursor + bodyStart + 2 + (source.slice(start + 2).search(/\S/));
  if (source[start] === '{') return source.slice(start, matchBracket(source, start, '{', '}'));
  if (source[start] === '(') return source.slice(start, matchBracket(source, start, '(', ')'));
  return source.slice(start, source.indexOf(';', start) + 1 || undefined);
}

/**
 * A slot may render a shared primitive directly, or a same-file wrapper whose body renders a
 * primitive and no state markup of its own. Anything else — inline markup, a neutrally named
 * local component, or an imported component — is a feature-owned state.
 */
function slotOwnsState(source, block) {
  if (inlineStateMarkup.test(block)) return true;
  const components = [...block.matchAll(/<([A-Z]\w*)/g)].map((match) => match[1]);
  return components.some((name) => {
    if (sharedStatePrimitives.has(name)) return false;
    const body = componentBody(source, name);
    if (!body) return true;
    const rendersPrimitive = [...sharedStatePrimitives].some((primitive) => body.includes(`<${primitive}`));
    return !rendersPrimitive || inlineStateMarkup.test(body);
  });
}

const directStateContainer = { test: (source) => stateSlotBlocks(source).some((block) => slotOwnsState(source, block)) };

export function findSharedListStateViolations(sources) {
  return Object.entries(sources).flatMap(([file, source]) => {
    if (!listStateTargets.includes(file)) return [];
    const hasSharedStateImport = sharedStateImport.test(source);
    const violations = [];

    if (localListStateHelper.test(source)) violations.push('local list-state helper');
    if (directStateContainer.test(source)) violations.push('direct list-state container');
    if (violations.length > 0 && !hasSharedStateImport) {
      return [`${file}: ${violations.join(' and ')} must use a shared state primitive`];
    }
    if (violations.length > 0) {
      return [`${file}: ${violations.join(' and ')} must not be feature-owned`];
    }
    return [];
  });
}

export function verifySharedListStates(rootDirectory) {
  const sources = Object.fromEntries(listStateTargets.map((file) => [file, readFileSync(resolve(rootDirectory, file), 'utf8')]));
  const violations = findSharedListStateViolations(sources);
  if (violations.length > 0) throw new Error(`Shared list-state guard failed:\n${violations.join('\n')}`);
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  verifySharedListStates(resolve(scriptPath, '../..'));
}
