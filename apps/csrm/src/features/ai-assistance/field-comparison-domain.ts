/*
 * The X-24 before-and-after comparison's rules (docs/design/csrm-design-direction.md, "AI proposal items", extended by
 * X-28 and X-29): which fields a proposal or a recorded change changes, and which words changed in a long value. Plain,
 * zod-free and React-free, so Phases 16, 17 and 17.2 reuse it for their own records.
 */

/** A field's value as the comparison shows it: already formatted text (a choice list one per line, `Yes` or `No`). */
export type DisplayValue = string;

export type ComparisonRow = {
  readonly label: string;
  readonly current: DisplayValue;
  readonly proposed: DisplayValue;
};

export type ComparedRow = ComparisonRow & { readonly changed: boolean };

/** Marks each row whose proposed value differs from its current one, keeping the rows' order. */
export function compareFields(rows: readonly ComparisonRow[]): readonly ComparedRow[] {
  return rows.map((row) => ({ ...row, changed: row.current !== row.proposed }));
}

/** The toggle's label for the unchanged rows, or null when every row changed. */
export function unchangedToggleLabel(count: number, expanded: boolean): string | null {
  if (count === 0) return null;
  if (expanded) return 'Hide unchanged fields';
  return `Show ${count.toLocaleString('en-AU')} unchanged ${count === 1 ? 'field' : 'fields'}`;
}

/** X-29: the compact history's toggle for one change's comparison. */
export function changedFieldsToggleLabel(count: number, expanded: boolean): string {
  if (expanded) return 'Hide changed fields';
  return `Show ${count.toLocaleString('en-AU')} changed ${count === 1 ? 'field' : 'fields'}`;
}

/* ---- Changed words (Phase 16, 16-UI-SPEC §4.3, §8.3; UI-D21), moved here from the risk curation domain by 16-12 ---- */

/** Over this many characters in either value, both show whole without marks (UI-D21). */
export const WORD_DIFF_MAX_LENGTH = 2_000;

export type WordDiffSegment = { readonly kind: 'same' | 'del' | 'ins'; readonly text: string };

const tokens = (text: string): string[] => text.match(/\s+|\S+/g) ?? [];

function pushSegment(segments: WordDiffSegment[], kind: WordDiffSegment['kind'], text: string): void {
  const last = segments[segments.length - 1];
  if (last && last.kind === kind) segments[segments.length - 1] = { kind, text: last.text + text };
  else segments.push({ kind, text });
}

/**
 * The changed words between two values, as `same`, `del` (only in `before`) and `ins` (only in `after`) segments in
 * reading order: a word-level longest common subsequence over words and the spaces between them, after the common
 * start and end are set aside. A missing value reads as empty. Null when either value is over 2,000 characters, so the
 * work stays bounded and both values show whole.
 */
export function wordDiff(before: string | null, after: string | null): WordDiffSegment[] | null {
  const from = before ?? '';
  const to = after ?? '';
  if (from.length > WORD_DIFF_MAX_LENGTH || to.length > WORD_DIFF_MAX_LENGTH) return null;
  const a = tokens(from);
  const b = tokens(to);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const rows = endA - start;
  const columns = endB - start;
  /* lengths[i][j]: the longest common run of a[start + i..endA) and b[start + j..endB), in one flat table. */
  const width = columns + 1;
  const lengths = new Uint16Array((rows + 1) * width);
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      lengths[i * width + j] = a[start + i] === b[start + j]
        ? lengths[(i + 1) * width + j + 1]! + 1
        : Math.max(lengths[(i + 1) * width + j]!, lengths[i * width + j + 1]!);
    }
  }
  const segments: WordDiffSegment[] = [];
  pushSegment(segments, 'same', a.slice(0, start).join(''));
  let i = 0;
  let j = 0;
  while (i < rows || j < columns) {
    if (i < rows && j < columns && a[start + i] === b[start + j]) {
      pushSegment(segments, 'same', a[start + i]!);
      i += 1;
      j += 1;
    } else if (j >= columns || (i < rows && lengths[(i + 1) * width + j]! >= lengths[i * width + j + 1]!)) {
      pushSegment(segments, 'del', a[start + i]!);
      i += 1;
    } else {
      pushSegment(segments, 'ins', b[start + j]!);
      j += 1;
    }
  }
  pushSegment(segments, 'same', a.slice(endA).join(''));
  return segments.filter((segment) => segment.text.length > 0);
}

/** One run of one side's text: marked (an inserted or removed run) or not. */
export type EmphasisPiece = { readonly text: string; readonly marked: boolean };

/**
 * One side of a word diff as it reads: `before` keeps the same and removed runs, `after` the same and inserted runs. A
 * space between two marked runs joins them into one, and a marked run's edge spaces read as unmarked, so the marks sit on
 * words. The pieces are text only, never markup (T-16-34).
 */
export function emphasisPieces(segments: readonly WordDiffSegment[], side: 'before' | 'after'): EmphasisPiece[] {
  const markedKind = side === 'before' ? 'del' : 'ins';
  const pieces: EmphasisPiece[] = [];
  const push = (text: string, marked: boolean) => {
    if (text.length === 0) return;
    const last = pieces[pieces.length - 1];
    if (last && last.marked === marked) pieces[pieces.length - 1] = { text: last.text + text, marked };
    else pieces.push({ text, marked });
  };
  for (const segment of segments) {
    if (segment.kind === 'same') push(segment.text, false);
    else if (segment.kind === markedKind) push(segment.text, true);
  }
  /* Join `marked, space, marked`, then move each marked run's edge spaces out of it. */
  const joined: EmphasisPiece[] = [];
  for (const piece of pieces) {
    const previous = joined[joined.length - 1];
    const beforePrevious = joined[joined.length - 2];
    if (piece.marked && previous && !previous.marked && /^\s+$/.test(previous.text) && beforePrevious?.marked) {
      joined.splice(joined.length - 2, 2, { text: beforePrevious.text + previous.text + piece.text, marked: true });
    } else {
      joined.push(piece);
    }
  }
  const result: EmphasisPiece[] = [];
  const add = (text: string, marked: boolean) => {
    if (text.length === 0) return;
    const last = result[result.length - 1];
    if (last && last.marked === marked) result[result.length - 1] = { text: last.text + text, marked };
    else result.push({ text, marked });
  };
  for (const piece of joined) {
    if (!piece.marked) {
      add(piece.text, false);
      continue;
    }
    const [, lead = '', body = '', trail = ''] = /^(\s*)([\s\S]*?)(\s*)$/.exec(piece.text) ?? [];
    add(lead, false);
    add(body, true);
    add(trail, false);
  }
  return result;
}
