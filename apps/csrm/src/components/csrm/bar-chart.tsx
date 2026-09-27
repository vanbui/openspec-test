import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Ink for every category, or the rating's own severity when the category is a Risk rating (§3.14). */
export type BarChartTone = 'ink' | 'risk-low' | 'risk-moderate' | 'risk-high' | 'risk-critical';

type BarChartDatumBase = {
  key: string;
  /** Visible category label: plain text, or a `RiskRatingBadge`. */
  label: ReactNode;
  /** The label as words, used in link names. */
  labelText: string;
  value: number;
  tone?: BarChartTone;
  /** An incomplete period, such as the current month to date. */
  partial?: boolean;
};

export type BarChartLinkedDatum = BarChartDatumBase & { href?: string };
/** A figure's rows never link: the figure is hidden and its table is the text alternative. */
export type BarChartFigureDatum = BarChartDatumBase & { href?: never };

export type BarChartUnit = { one: string; other: string };

type BarChartName = { ariaLabel: string; labelledBy?: never } | { labelledBy: string; ariaLabel?: never };

type BarChartScale = {
  /** The value a full-length mark stands for. Charts compared side by side share one. */
  scaleMax?: number;
};

/** Dashboard form: a named list whose direct labels and values are the text equivalent. */
export type LabelledValuesBarChartProps = BarChartScale &
  BarChartName & {
    presentation: 'labelled-values';
    orientation?: 'bar';
    data: readonly BarChartLinkedDatum[];
    unit: BarChartUnit;
  };

/** Report form: a hidden graphic beside a visible table that carries the same figures. */
export type FigureWithTableBarChartProps = BarChartScale & {
  presentation: 'figure-with-table';
  orientation?: 'bar' | 'column';
  data: readonly BarChartFigureDatum[];
  /** Legend copy for a partial period; the legend shows only when a partial datum exists. */
  partialLabel?: string;
};

export type BarChartProps = LabelledValuesBarChartProps | FigureWithTableBarChartProps;

const valueFormat = new Intl.NumberFormat('en-AU');

/* Severity marks fill with the rating's fg token: the subtle tints fail WCAG 1.4.11 on white (§3.14). */
const toneFillClassNames = {
  ink: 'bg-chart-1',
  'risk-low': 'bg-risk-low',
  'risk-moderate': 'bg-risk-medium',
  'risk-high': 'bg-risk-high',
  'risk-critical': 'bg-risk-critical',
} satisfies Record<BarChartTone, string>;

/* A partial period is unfilled, outlined by a dashed ink hairline, never a new hue. */
const partialMarkClassName = 'border border-dashed border-chart-1';

function largestValue(data: readonly BarChartDatumBase[]) {
  return data.reduce((largest, datum) => Math.max(largest, datum.value), 0);
}

/** A mark's length as a share of the scale, or null when there is nothing to draw. */
function markShare(value: number, scaleMax: number) {
  if (!(value > 0) || !(scaleMax > 0)) return null;
  const share = Math.min(value / scaleMax, 1);
  return `${Math.round(share * 10_000) / 100}%`;
}

function markClassName(datum: BarChartDatumBase) {
  return datum.partial ? partialMarkClassName : toneFillClassNames[datum.tone ?? 'ink'];
}

function unitFor(value: number, unit: BarChartUnit) {
  return value === 1 ? unit.one : unit.other;
}

/*
 * One bar row: the label and value on the first line, the mark beneath. There is no track and no
 * gridline; the direct label replaces the axis. Marks are square-ended and never animate.
 */
function BarRowContent({ cue, datum, scaleMax }: { cue: 'chevron' | 'space' | 'none'; datum: BarChartDatumBase; scaleMax: number }) {
  const share = markShare(datum.value, scaleMax);

  return (
    <>
      <span className="flex min-h-5 items-center gap-2">
        <span className="min-w-0 flex-1 break-words text-sm text-foreground">{datum.label}</span>
        {/* A word break between label and value: the flex row draws none, but the text then reads as drawn (SC 2.5.3). */}
        {' '}
        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground" data-slot="bar-chart-value">
          {valueFormat.format(datum.value)}
        </span>
        {cue === 'chevron' ? <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : null}
        {/* Keeps values in one column when only some rows link. */}
        {cue === 'space' ? <span aria-hidden="true" className="size-4 shrink-0" /> : null}
      </span>
      <span aria-hidden="true" className="block h-chart-bar-thickness" data-slot="bar-chart-track">
        {share ? (
          <span
            className={cn('block h-full min-w-chart-bar-min-length', markClassName(datum))}
            data-slot="bar-chart-mark"
            style={{ inlineSize: share }}
          />
        ) : null}
      </span>
    </>
  );
}

const barRowClassName = 'flex min-h-11 flex-col justify-center gap-1';

function BarRows({
  ariaLabel,
  className,
  data,
  labelledBy,
  linkUnit,
  scaleMax,
}: {
  ariaLabel?: string;
  className?: string;
  data: readonly BarChartLinkedDatum[];
  labelledBy?: string;
  linkUnit?: BarChartUnit;
  scaleMax: number;
}) {
  const linking = Boolean(linkUnit) && data.some((datum) => datum.href);

  // The list role is explicit: without markers, some screen readers drop list semantics and the list's name.
  return (
    <ul
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      className={cn('flex flex-col', className)}
      data-slot="bar-chart-bars"
      role="list"
    >
      {data.map((datum) =>
        linkUnit && datum.href ? (
          <li key={datum.key}>
            <Link
              aria-label={`${datum.labelText}: ${valueFormat.format(datum.value)} ${unitFor(datum.value, linkUnit)}`}
              className={cn(
                barRowClassName,
                // The hover tint reaches past the text edge while the text stays aligned with its neighbours.
                '-mx-2 rounded-md px-2 transition-colors duration-(--duration-micro) ease-standard hover:bg-surface-hover',
              )}
              href={datum.href}
            >
              <BarRowContent cue="chevron" datum={datum} scaleMax={scaleMax} />
            </Link>
          </li>
        ) : (
          <li className={barRowClassName} key={datum.key}>
            <BarRowContent cue={linking ? 'space' : 'none'} datum={datum} scaleMax={scaleMax} />
          </li>
        ),
      )}
    </ul>
  );
}

/*
 * Columns for a time series: the value above each column, the category below in a micro-label, and
 * a grid hairline for the baseline. The top padding holds the value label of the tallest column.
 */
function Columns({ data, scaleMax }: { data: readonly BarChartFigureDatum[]; scaleMax: number }) {
  return (
    <ul className="hidden pt-5 @md:flex" data-slot="bar-chart-columns">
      {data.map((datum) => {
        const share = markShare(datum.value, scaleMax);

        return (
          <li className="flex min-w-0 flex-1 flex-col" data-slot="bar-chart-column" key={datum.key}>
            <span className="flex h-chart-plot-height flex-col items-center justify-end border-b border-chart-grid px-1">
              <span className="mb-1 shrink-0 text-xs font-medium tabular-nums text-foreground" data-slot="bar-chart-value">
                {valueFormat.format(datum.value)}
              </span>
              {share ? (
                <span
                  className={cn('block w-full max-w-chart-column-max-width min-h-chart-bar-min-length shrink-0', markClassName(datum))}
                  data-slot="bar-chart-mark"
                  style={{ blockSize: share }}
                />
              ) : null}
            </span>
            <span className="micro-label mt-2 truncate px-1 text-center text-muted-foreground" data-slot="bar-chart-category">
              {datum.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The house bar and column chart (UI-SPEC §5.2): HTML marks with direct labels, ink or severity
 * fills only, no motion and no charting dependency.
 *
 * - `labelled-values` is a named list. Each row exposes its label and value as text; a row with
 *   `href` is one link named `{labelText}: {value} {unit}`. Its visible words open that name (SC 2.5.3),
 *   so `labelText` is the label's visible text, context goes in `unit`, and a label that names itself
 *   (a rating badge) is rendered unlabelled inside the link.
 * - `figure-with-table` hides the graphic from assistive technology; the section's visible table is
 *   its text alternative, so it can hold no link. Columns become bars below the `@md` container.
 */
export function BarChart(props: BarChartProps) {
  const scaleMax = props.scaleMax ?? largestValue(props.data);

  if (props.presentation === 'labelled-values') {
    return (
      <BarRows
        ariaLabel={props.ariaLabel}
        data={props.data}
        labelledBy={props.labelledBy}
        linkUnit={props.unit}
        scaleMax={scaleMax}
      />
    );
  }

  // Anything focusable inside a hidden figure would be a trap, so figure rows are drawn without links.
  const figureData = props.data.map(({ href: _href, ...datum }) => datum);
  const columns = props.orientation === 'column';
  const showLegend = Boolean(props.partialLabel) && figureData.some((datum) => datum.partial);

  return (
    <div aria-hidden="true" className={cn('min-w-0', columns && '@container')} data-slot="bar-chart">
      <BarRows className={columns ? '@md:hidden' : undefined} data={figureData} scaleMax={scaleMax} />
      {columns ? <Columns data={figureData} scaleMax={scaleMax} /> : null}
      {showLegend ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-foreground-secondary" data-slot="bar-chart-legend">
          <span className="size-3 shrink-0 border border-dashed border-chart-1" />
          {props.partialLabel}
        </p>
      ) : null}
    </div>
  );
}
