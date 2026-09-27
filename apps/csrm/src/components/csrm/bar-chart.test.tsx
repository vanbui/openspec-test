import { render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

import { BarChart } from './bar-chart';
import { RiskRatingBadge } from './risk-rating-badge';

type FigureDatum = Extract<ComponentProps<typeof BarChart>, { presentation: 'figure-with-table' }>['data'][number];

const openRisks = { one: 'open Risk', other: 'open Risks' };

function marksIn(element: Element) {
  return Array.from(element.querySelectorAll<HTMLElement>('[data-slot="bar-chart-mark"]'));
}

function rowFor(list: HTMLElement, text: string) {
  const row = within(list)
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(text));
  if (!row) throw new Error(`No bar row mentions "${text}"`);
  return row;
}

describe('BarChart labelled values', () => {
  it('is a list named by its label whose rows expose label and value as text and hide the marks', () => {
    render(
      <BarChart
        ariaLabel="Open contextual Risks by residual rating"
        data={[
          { key: 'Critical', label: 'Critical', labelText: 'Critical residual rating', value: 2, tone: 'risk-critical' },
          { key: 'High', label: 'High', labelText: 'High residual rating', value: 5, tone: 'risk-high' },
        ]}
        presentation="labelled-values"
        unit={openRisks}
      />,
    );

    const list = screen.getByRole('list', { name: 'Open contextual Risks by residual rating' });
    // The markers are removed, and WebKit then drops list semantics, and the name with them, unless the role is stated.
    expect(list).toHaveAttribute('role', 'list');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/^Critical 2$/);
    expect(rows[1]).toHaveTextContent(/^High 5$/);
    expect(within(rows[0]).getByText('2')).toHaveClass('text-sm', 'font-medium', 'tabular-nums');

    for (const mark of marksIn(list)) {
      expect(mark.closest('[aria-hidden="true"]')).not.toBeNull();
    }
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('can take its name from a visible heading', () => {
    render(
      <>
        <h2 id="exposure-heading">Risk exposure</h2>
        <BarChart
          data={[{ key: 'Low', label: 'Low', labelText: 'Low residual rating', value: 1, tone: 'risk-low' }]}
          labelledBy="exposure-heading"
          presentation="labelled-values"
          unit={openRisks}
        />
      </>,
    );

    expect(screen.getByRole('list', { name: 'Risk exposure' })).toBeInTheDocument();
  });

  it('makes a linked row one link named by its label text, value and unit, with a trailing chevron', () => {
    render(
      <BarChart
        ariaLabel="Open contextual Risks by residual rating"
        data={[
          {
            key: 'Critical',
            label: <RiskRatingBadge labelled={false} rating="Critical" />,
            labelText: 'Critical',
            value: 2,
            tone: 'risk-critical',
            href: '/app/risks?residualRating=Critical&state=open',
          },
          {
            key: 'High',
            label: <RiskRatingBadge labelled={false} rating="High" />,
            labelText: 'High',
            value: 1,
            tone: 'risk-high',
            href: '/app/risks?residualRating=High&state=open',
          },
          { key: 'not-rated', label: 'Not rated', labelText: 'Not rated', value: 3 },
        ]}
        presentation="labelled-values"
        unit={openRisks}
      />,
    );

    const critical = screen.getByRole('link', { name: 'Critical: 2 open Risks' });
    expect(critical).toHaveAttribute('href', '/app/risks?residualRating=Critical&state=open');
    // The visible label and value sit inside the link as words, and open its name (SC 2.5.3): the text
    // reads as drawn, and nothing inside the link names itself in place of what it shows.
    expect(critical.textContent).toBe('Critical 2');
    expect(critical.getAttribute('aria-label')?.replace(/[^\w\s]/g, '').startsWith(critical.textContent ?? '')).toBe(true);
    expect(critical.querySelector('[aria-label]')).toBeNull();
    expect(critical.querySelector('svg.lucide-chevron-right')).toHaveAttribute('aria-hidden', 'true');
    expect(critical).toHaveClass('min-h-11', 'hover:bg-surface-hover');

    expect(screen.getByRole('link', { name: 'High: 1 open Risk' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);

    const notRated = rowFor(screen.getByRole('list'), 'Not rated');
    expect(within(notRated).queryByRole('link')).toBeNull();
    expect(notRated.querySelector('svg.lucide-chevron-right')).toBeNull();
  });

  it('renders no mark for a zero value while its label still reads 0', () => {
    render(
      <BarChart
        ariaLabel="Residual rating"
        data={[
          { key: 'Low', label: 'Low', labelText: 'Low residual rating', value: 0, tone: 'risk-low' },
          { key: 'High', label: 'High', labelText: 'High residual rating', value: 3, tone: 'risk-high' },
        ]}
        presentation="labelled-values"
        unit={openRisks}
      />,
    );

    const low = rowFor(screen.getByRole('list'), 'Low');
    expect(within(low).getByText('0')).toBeInTheDocument();
    expect(marksIn(low)).toHaveLength(0);
    expect(marksIn(rowFor(screen.getByRole('list'), 'High'))).toHaveLength(1);
  });

  it('sizes each mark as its share of the largest value, with a minimum length for non-zero values', () => {
    render(
      <BarChart
        ariaLabel="Treatment status"
        data={[
          { key: 'one', label: 'Not Started', labelText: 'Not Started', value: 1 },
          { key: 'two', label: 'In Progress', labelText: 'In Progress', value: 2 },
          { key: 'three', label: 'Complete', labelText: 'Complete', value: 3 },
          { key: 'four', label: 'Overdue', labelText: 'Overdue', value: 4 },
        ]}
        presentation="labelled-values"
        unit={openRisks}
      />,
    );

    const marks = marksIn(screen.getByRole('list'));
    expect(marks.map((mark) => mark.style.inlineSize)).toEqual(['25%', '50%', '75%', '100%']);
    for (const mark of marks) {
      expect(mark).toHaveClass('min-w-chart-bar-min-length', 'h-full');
    }
    expect(screen.getByRole('list').querySelector('[data-slot="bar-chart-track"]')).toHaveClass('h-chart-bar-thickness');
  });

  it('keeps two charts proportional when they share one scale maximum', () => {
    render(
      <>
        <BarChart
          ariaLabel="Inherent"
          data={[
            { key: 'Critical', label: 'Critical', labelText: 'Critical inherent rating', value: 2, tone: 'risk-critical' },
            { key: 'High', label: 'High', labelText: 'High inherent rating', value: 4, tone: 'risk-high' },
          ]}
          presentation="labelled-values"
          scaleMax={8}
          unit={openRisks}
        />
        <BarChart
          ariaLabel="Residual"
          data={[
            { key: 'Critical', label: 'Critical', labelText: 'Critical residual rating', value: 8, tone: 'risk-critical' },
            { key: 'High', label: 'High', labelText: 'High residual rating', value: 6, tone: 'risk-high' },
          ]}
          presentation="labelled-values"
          scaleMax={8}
          unit={openRisks}
        />
      </>,
    );

    expect(marksIn(screen.getByRole('list', { name: 'Inherent' })).map((mark) => mark.style.inlineSize)).toEqual(['25%', '50%']);
    expect(marksIn(screen.getByRole('list', { name: 'Residual' })).map((mark) => mark.style.inlineSize)).toEqual(['100%', '75%']);
  });

  it.each([
    ['ink', 'bg-chart-1'],
    ['risk-low', 'bg-risk-low'],
    ['risk-moderate', 'bg-risk-medium'],
    ['risk-high', 'bg-risk-high'],
    ['risk-critical', 'bg-risk-critical'],
  ] as const)('fills a %s mark with its foreground token and never a subtle tint', (tone, fillClass) => {
    render(
      <BarChart
        ariaLabel="Tones"
        data={[{ key: tone, label: tone, labelText: tone, value: 1, tone }]}
        presentation="labelled-values"
        unit={openRisks}
      />,
    );

    const [mark] = marksIn(screen.getByRole('list'));
    expect(mark).toHaveClass(fillClass);
    expect(mark.className).not.toMatch(/-subtle|rounded/);
  });

  it('fills a mark in ink when no tone is given', () => {
    render(
      <BarChart
        ariaLabel="Due state"
        data={[{ key: 'overdue', label: 'Overdue', labelText: 'Overdue', value: 2 }]}
        presentation="labelled-values"
        unit={openRisks}
      />,
    );

    expect(marksIn(screen.getByRole('list'))[0]).toHaveClass('bg-chart-1');
  });

  it('draws a partial mark as an unfilled dashed ink outline', () => {
    render(
      <BarChart
        ariaLabel="Released per month"
        data={[{ key: '2026-09', label: 'Sept', labelText: 'September 2026', value: 3, partial: true }]}
        presentation="labelled-values"
        unit={{ one: 'release', other: 'releases' }}
      />,
    );

    const [mark] = marksIn(screen.getByRole('list'));
    expect(mark).toHaveClass('border', 'border-dashed', 'border-chart-1');
    expect(mark.className).not.toMatch(/\bbg-/);
  });
});

describe('BarChart figure with table', () => {
  const linkedFigureDatum: FigureDatum = {
    key: 'overdue',
    label: 'Overdue',
    labelText: 'Overdue',
    value: 4,
    // @ts-expect-error A figure-with-table row cannot link: the section's table is its text alternative.
    href: '/app/alerts?kind=risk-treatment-overdue',
  };

  it('hides the whole figure from assistive technology and renders no focusable element, even when given a link', () => {
    const { container } = render(
      <BarChart
        data={[linkedFigureDatum, { key: 'later', label: 'Due later', labelText: 'Due later', value: 2 }]}
        presentation="figure-with-table"
      />,
    );

    const figure = container.firstElementChild;
    expect(figure).toHaveAttribute('aria-hidden', 'true');
    expect(figure?.querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(0);
    expect(figure).toHaveTextContent('Overdue');
    expect(figure).toHaveTextContent('Due later');
    expect(marksIn(figure as Element).map((mark) => mark.style.inlineSize)).toEqual(['100%', '50%']);
  });

  it('renders every category in the order given', () => {
    const { container } = render(
      <BarChart
        data={[
          { key: 'existing', label: 'Existing', labelText: 'Existing', value: 0 },
          { key: 'planned', label: 'Planned', labelText: 'Planned', value: 3 },
          { key: 'implemented', label: 'Implemented', labelText: 'Implemented', value: 1 },
        ]}
        presentation="figure-with-table"
      />,
    );

    expect(container.firstElementChild?.textContent).toBe('Existing 0Planned 3Implemented 1');
  });

  it('draws columns with the value above each column, a micro-label category below and a grid baseline', () => {
    const { container } = render(
      <BarChart
        data={[
          { key: '2026-08', label: 'Aug', labelText: 'August 2026', value: 3 },
          { key: '2026-09', label: 'Sept', labelText: 'September 2026', value: 1, partial: true },
        ]}
        orientation="column"
        partialLabel="Current month to date"
        presentation="figure-with-table"
      />,
    );

    const figure = container.firstElementChild as HTMLElement;
    expect(figure).toHaveAttribute('aria-hidden', 'true');
    expect(figure).toHaveClass('@container');

    const columns = figure.querySelector('[data-slot="bar-chart-columns"]');
    expect(columns).toHaveClass('hidden', '@md:flex');
    const columnItems = Array.from(columns?.querySelectorAll<HTMLElement>('[data-slot="bar-chart-column"]') ?? []);
    expect(columnItems).toHaveLength(2);

    for (const column of columnItems) {
      const value = column.querySelector('[data-slot="bar-chart-value"]') as Element;
      const mark = column.querySelector('[data-slot="bar-chart-mark"]') as Element;
      const category = column.querySelector('[data-slot="bar-chart-category"]') as Element;
      expect(value).toHaveClass('text-xs', 'font-medium', 'tabular-nums');
      expect(category).toHaveClass('micro-label');
      expect(value.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(mark.compareDocumentPosition(category) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(mark).toHaveClass('max-w-chart-column-max-width', 'min-h-chart-bar-min-length');
      expect(mark.parentElement).toHaveClass('h-chart-plot-height', 'border-b', 'border-chart-grid');
    }

    expect(columnItems.map((column) => column.querySelector('[data-slot="bar-chart-category"]')?.textContent)).toEqual([
      'Aug',
      'Sept',
    ]);
    expect(marksIn(columns as Element).map((mark) => mark.style.blockSize)).toEqual(['100%', '33.33%']);
    expect(marksIn(columns as Element)[1]).toHaveClass('border-dashed', 'border-chart-1');
  });

  it('falls back to bars below the medium container size', () => {
    const { container } = render(
      <BarChart
        data={[
          { key: '2026-08', label: 'Aug', labelText: 'August 2026', value: 3 },
          { key: '2026-09', label: 'Sept', labelText: 'September 2026', value: 1 },
        ]}
        orientation="column"
        presentation="figure-with-table"
      />,
    );

    const bars = container.querySelector('[data-slot="bar-chart-bars"]');
    expect(bars).toHaveClass('@md:hidden');
    expect(marksIn(bars as Element).map((mark) => mark.style.inlineSize)).toEqual(['100%', '33.33%']);
  });

  it('explains a partial period with a one-item legend, and shows no legend without one', () => {
    const partial = render(
      <BarChart
        data={[
          { key: '2026-08', label: 'Aug', labelText: 'August 2026', value: 3 },
          { key: '2026-09', label: 'Sept', labelText: 'September 2026', value: 0, partial: true },
        ]}
        orientation="column"
        partialLabel="Current month to date"
        presentation="figure-with-table"
      />,
    );

    const legend = partial.container.querySelector('[data-slot="bar-chart-legend"]');
    expect(legend).toHaveTextContent(/^Current month to date$/);
    expect(legend?.querySelector('span')).toHaveClass('size-3', 'border-dashed', 'border-chart-1');
    partial.unmount();

    const complete = render(
      <BarChart
        data={[{ key: '2026-08', label: 'Aug', labelText: 'August 2026', value: 3 }]}
        orientation="column"
        partialLabel="Current month to date"
        presentation="figure-with-table"
      />,
    );
    expect(complete.container.querySelector('[data-slot="bar-chart-legend"]')).toBeNull();
  });
});
