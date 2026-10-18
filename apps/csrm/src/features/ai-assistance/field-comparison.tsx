'use client';

import { Equal, PenLine } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { emphasisPieces, unchangedToggleLabel, wordDiff, type ComparedRow } from './field-comparison-domain';

/*
 * The X-24 before-and-after comparison (docs/design/csrm-design-direction.md, "AI proposal items"). From 768px a table
 * whose row headers name the fields, with `Current` and `Proposed` columns and the DataTable's cell padding and hairlines;
 * below 768px each field stacks its current value above its proposed value. A changed field carries the `Changed` note in
 * its header, never colour alone; unchanged fields collapse behind a count. Values are React text with line breaks kept.
 * `renderEmphasis` lets a caller render a value its own way (a rating badge); Phase 15 shows whole values (UI-D31).
 *
 * Phase 16 extends it rather than forking it (16-UI-SPEC §4.3, §8.3; X-28, X-29; D-36, D-46, UI-D21), with every Phase 15
 * prop and behaviour kept:
 * - `columns` names the two value columns (`Before` and `After` in a history, `{risk number}` and `Proposed` to compare);
 * - `groups` replaces `rows` for a grouped comparison: each group is a `tbody` whose final cell, under a visually hidden
 *   `Decision` header, spans the group's rows and holds its decision; below 768px each group is a stacked card with its
 *   label, the current value above the proposed one, then the decision. Both layouts are in the markup, so a decision
 *   node renders in each, and the breakpoint shows one;
 * - `showSame` lists every row, a matching one reading `Same` in place of `Changed`;
 * - `emphasis` marks the changed words of a changed value with `ins` and `del`, unless either value is over 2,000
 *   characters (UI-D21). Where `renderEmphasis` renders a value, it decides that value.
 */
export type ComparisonGroup = {
  readonly key: string;
  /** The change's label: the stacked card's eyebrow and, for its decision's names, the caller's. */
  readonly label: string;
  readonly rows: readonly ComparedRow[];
  /** The change's decision (Confirm, Reject, a note), in the spanning cell; omitted in a read-only comparison. */
  readonly decision?: ReactNode;
};

type FieldComparisonBase = {
  caption: string;
  density: 'comfortable' | 'compact';
  renderEmphasis?: (row: ComparedRow, side: 'current' | 'proposed') => ReactNode;
  /** The value columns' labels; `Current` and `Proposed` by default. */
  columns?: { readonly before: string; readonly after: string };
  /** Lists every row, a matching one marked `Same` (X-28's compare). */
  showSame?: boolean;
  /** Marks changed words, on every changed row or on the rows the predicate names (long text, UI-SPEC §4.3). */
  emphasis?: boolean | ((row: ComparedRow) => boolean);
  /** What follows a value in both layouts, such as a proposed statement's sources (16-UI-SPEC §4.3); null for nothing. */
  afterValue?: (row: ComparedRow, side: 'current' | 'proposed') => ReactNode;
};

export type FieldComparisonProps = FieldComparisonBase & (
  | { rows: readonly ComparedRow[]; groups?: never }
  | { groups: readonly ComparisonGroup[]; rows?: never }
);

type Side = 'current' | 'proposed';

function ChangedNote({ className }: { className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 text-foreground-secondary', className)}><PenLine aria-hidden="true" className="size-3" />Changed</span>;
}

function SameNote({ className }: { className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 text-foreground-secondary', className)}><Equal aria-hidden="true" className="size-3" />Same</span>;
}

function RowNote({ className, row, showSame }: { className?: string; row: ComparedRow; showSame: boolean }) {
  if (row.changed) return <ChangedNote className={className} />;
  return showSame ? <SameNote className={className} /> : null;
}

/* UI-D21: one side's changed words, marked from text pieces only; null when the value shows whole. */
function markedWords(row: ComparedRow, side: Side): ReactNode {
  const segments = wordDiff(row.current, row.proposed);
  if (!segments) return null;
  return emphasisPieces(segments, side === 'current' ? 'before' : 'after').map((piece, index) => {
    if (!piece.marked) return <Fragment key={index}>{piece.text}</Fragment>;
    return side === 'current'
      ? <del className="text-foreground-secondary line-through" key={index}>{piece.text}</del>
      : <ins className="rounded-sm bg-surface-muted font-medium no-underline" key={index}>{piece.text}</ins>;
  });
}

export function FieldComparison(props: FieldComparisonProps) {
  const { afterValue, caption, columns, density, emphasis = false, renderEmphasis, showSame = false } = props;
  const [showUnchanged, setShowUnchanged] = useState(false);
  const grouped = props.groups !== undefined;
  const groups: readonly ComparisonGroup[] = props.groups ?? [{ key: 'rows', label: '', rows: props.rows ?? [] }];
  const allRows = groups.flatMap((group) => group.rows);
  const unchanged = showSame ? 0 : allRows.filter((row) => !row.changed).length;
  const shownRows = (rows: readonly ComparedRow[]) => (showSame || showUnchanged ? rows : rows.filter((row) => row.changed));
  const shownGroups = groups.map((group) => ({ ...group, rows: shownRows(group.rows) })).filter((group) => group.rows.length > 0);
  const hasDecision = grouped && groups.some((group) => group.decision !== undefined);
  const before = columns?.before ?? 'Current';
  const afterLabel = columns?.after ?? 'Proposed';
  const after = (row: ComparedRow, side: Side): ReactNode => {
    const content = afterValue?.(row, side);
    return content === null || content === undefined ? null : <div className="mt-2 whitespace-normal">{content}</div>;
  };
  const marks = (row: ComparedRow) => row.changed && (typeof emphasis === 'function' ? emphasis(row) : emphasis);
  const value = (row: ComparedRow, side: Side): ReactNode => {
    if (renderEmphasis) {
      const rendered = renderEmphasis(row, side);
      if (rendered !== null && rendered !== undefined) return rendered;
    }
    return (marks(row) ? markedWords(row, side) : null) ?? row[side];
  };
  const toggle = unchangedToggleLabel(unchanged, showUnchanged);
  const cell = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const valueCell = cn('whitespace-pre-wrap align-top text-sm [overflow-wrap:anywhere]', cell);

  const tableRow = (row: ComparedRow, decision?: { node: ReactNode; span: number }) => (
    <TableRow className="hover:bg-transparent" key={row.label}>
      <th className={cn('text-left align-top text-sm font-medium text-foreground', cell)} scope="row">{row.label}</th>
      <TableCell className={valueCell}>{value(row, 'current')}{after(row, 'current')}</TableCell>
      <TableCell className={valueCell}><RowNote className="mb-1 text-xs font-normal" row={row} showSame={showSame} />{value(row, 'proposed')}{after(row, 'proposed')}</TableCell>
      {decision ? <TableCell className={cn('w-px align-top whitespace-normal', cell)} rowSpan={decision.span}>{decision.node}</TableCell> : null}
    </TableRow>
  );

  const stackedPair = (row: ComparedRow) => (
    <>
      <p className="micro-label text-foreground-secondary">{before}</p>
      <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]" data-comparison-value="">{value(row, 'current')}</p>
      {after(row, 'current')}
      <p className="micro-label text-foreground-secondary">{afterLabel}</p>
      <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]" data-comparison-value="">{value(row, 'proposed')}</p>
      {after(row, 'proposed')}
    </>
  );

  return (
    <div className="grid gap-2">
      <div className="hidden md:block" data-comparison-layout="table">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn('micro-label w-40', cell)} scope="col"><span className="sr-only">Field</span></TableHead>
              <TableHead className={cn('micro-label', cell)} scope="col">{before}</TableHead>
              <TableHead className={cn('micro-label', cell)} scope="col">{afterLabel}</TableHead>
              {hasDecision ? <TableHead className={cn('micro-label w-px', cell)} scope="col"><span className="sr-only">Decision</span></TableHead> : null}
            </TableRow>
          </TableHeader>
          {grouped
            ? shownGroups.map((group) => (
              <TableBody className="border-b border-border last:border-b-0" data-comparison-group={group.key} key={group.key}>
                {group.rows.map((row, index) => tableRow(row, hasDecision && index === 0 ? { node: group.decision ?? null, span: group.rows.length } : undefined))}
              </TableBody>
            ))
            : <TableBody>{shownGroups.flatMap((group) => group.rows).map((row) => tableRow(row))}</TableBody>}
        </Table>
      </div>
      {grouped ? (
        <ul aria-label={caption} className="grid gap-3 md:hidden" data-comparison-layout="stacked">
          {shownGroups.map((group) => (
            <li className={cn('grid gap-2 rounded-lg border border-border', density === 'compact' ? 'p-3' : 'p-4')} data-comparison-group={group.key} key={group.key}>
              <p className="micro-label text-foreground">{group.label}</p>
              {group.rows.map((row) => (
                <div className="grid gap-1" key={row.label}>
                  {group.rows.length > 1
                    ? <p className="flex flex-wrap items-center gap-2"><span className="micro-label text-foreground">{row.label}</span><RowNote className="micro-label" row={row} showSame={showSame} /></p>
                    : <RowNote className="micro-label" row={row} showSame={showSame} />}
                  {stackedPair(row)}
                </div>
              ))}
              {group.decision !== undefined ? <div className="grid w-full gap-2" data-comparison-decision="">{group.decision}</div> : null}
            </li>
          ))}
        </ul>
      ) : (
        <ul aria-label={caption} className="grid gap-3 md:hidden" data-comparison-layout="stacked">
          {shownGroups.flatMap((group) => group.rows).map((row) => (
            <li className="grid gap-1 border-b border-border pb-3 last:border-b-0" key={row.label}>
              <p className="flex flex-wrap items-center gap-2"><span className="micro-label text-foreground">{row.label}</span><RowNote className="micro-label" row={row} showSame={showSame} /></p>
              {stackedPair(row)}
            </li>
          ))}
        </ul>
      )}
      {toggle ? <Button className="w-fit max-md:min-h-11" data-print="hidden" onClick={() => setShowUnchanged(!showUnchanged)} size="sm" type="button" variant="outline">{toggle}</Button> : null}
    </div>
  );
}
