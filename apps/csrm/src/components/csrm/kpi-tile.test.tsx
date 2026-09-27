import { render, screen, within } from '@testing-library/react';
import { CalendarClockIcon, CalendarX2Icon, FlagIcon, InboxIcon } from 'lucide-react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

import { KpiTile, KpiTileSkeleton, KpiTileStrip } from './kpi-tile';

function tileFor(caption: string) {
  const tile = screen.getByText(caption).closest('[data-slot="kpi-tile"]');
  if (!(tile instanceof HTMLElement)) throw new Error(`No KPI tile holds the caption "${caption}"`);
  return tile;
}

describe('KpiTile', () => {
  it('makes a linked tile one link named by its caption, value and supporting line in DOM order', () => {
    render(
      <KpiTile
        caption="Overdue"
        href="/app/alerts?urgency=overdue"
        icon={CalendarX2Icon}
        iconTone="danger"
        supportingText="Past a due, target or review date"
        value={3}
      />,
    );

    const link = screen.getByRole('link', { name: 'Overdue 3 Past a due, target or review date' });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(link).toHaveAttribute('href', '/app/alerts?urgency=overdue');
    expect(link).toHaveAttribute('data-slot', 'kpi-tile');
    // The name comes from the visible content, so nothing inside the tile relabels it.
    expect(link).not.toHaveAttribute('aria-label');
    expect(link.querySelectorAll('[aria-label]')).toHaveLength(0);

    const chevron = link.querySelector('svg.lucide-chevron-right');
    expect(chevron).not.toBeNull();
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Overdue').compareDocumentPosition(chevron as Element)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('lifts a linked tile on hover with the link-card treatment and leaves a plain tile still', () => {
    render(
      <>
        <KpiTile caption="Requires my attention" href="/app/review/requests" value={7} />
        <KpiTile caption="Due within 30 days" value={5} />
      </>,
    );

    const linked = screen.getByRole('link', { name: 'Requires my attention 7' });
    expect(linked).toHaveClass('hover:border-line-ink-20', 'motion-safe:hover:-translate-y-px', 'duration-(--duration-fast)', 'ease-out-expo');

    const plain = tileFor('Due within 30 days');
    expect(plain.className).not.toMatch(/hover:|translate/);
  });

  it('renders an unlinked tile as a plain block with no link and no chevron', () => {
    const { container } = render(<KpiTile caption="Rated Ineffective" value={4} />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('svg.lucide-chevron-right')).toBeNull();
    expect(tileFor('Rated Ineffective').tagName).toBe('DIV');
  });

  it('renders zero as 0 and keeps the tile linked', () => {
    render(<KpiTile caption="Overdue" href="/app/alerts?urgency=overdue" value={0} />);

    const link = screen.getByRole('link', { name: 'Overdue 0' });
    expect(within(link).getByText('0')).toHaveAttribute('data-slot', 'kpi-tile-value');
  });

  it('renders an unavailable value as Not available at body size, never as zero or a dash', () => {
    render(
      <KpiTile
        caption="Median days to release"
        supportingText="No release in this period has a submission date."
        value={null}
      />,
    );

    const value = tileFor('Median days to release').querySelector('[data-slot="kpi-tile-value"]');
    expect(value).toHaveTextContent(/^Not available$/);
    expect(value).toHaveClass('text-sm', 'text-foreground-secondary');
    expect(value).not.toHaveClass('text-display');
    expect(tileFor('Median days to release').textContent).not.toMatch(/0|—|–/);
  });

  it('formats the value in en-AU with tabular display figures', () => {
    render(<KpiTile caption="Control Implementations" value={1234} />);

    const value = screen.getByText('1,234');
    expect(value).toHaveAttribute('data-slot', 'kpi-tile-value');
    expect(value).toHaveClass('text-display', 'tabular-nums', 'text-foreground');
  });

  it('draws the caption as a micro-label and the supporting line as a secondary caption', () => {
    render(<KpiTile caption="Needs attention" supportingText="Untreated Critical Risks and ineffective Control Implementations" value={2} />);

    expect(screen.getByText('Needs attention')).toHaveClass('micro-label', 'text-muted-foreground');
    expect(screen.getByText('Untreated Critical Risks and ineffective Control Implementations')).toHaveClass(
      'text-xs',
      'text-foreground-secondary',
    );
  });

  it.each([
    ['danger', CalendarX2Icon, 'lucide-calendar-x-2', 'text-destructive'],
    ['warning', CalendarClockIcon, 'lucide-calendar-clock', 'text-warning'],
    ['info', FlagIcon, 'lucide-flag', 'text-info'],
    ['muted', InboxIcon, 'lucide-inbox', 'text-muted-foreground'],
  ] as const)('hides the %s caption icon from assistive technology and tints it with its tone', (tone, Icon, iconClass, toneClass) => {
    const { container } = render(<KpiTile caption="Caption" icon={Icon} iconTone={tone} value={1} />);

    const icon = container.querySelector(`svg.${iconClass}`);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveClass(toneClass, 'size-3');
  });

  it('defaults the caption icon to the muted tone', () => {
    const { container } = render(<KpiTile caption="Requires my attention" icon={InboxIcon} value={7} />);

    expect(container.querySelector('svg.lucide-inbox')).toHaveClass('text-muted-foreground');
  });
});

describe('KpiTileStrip', () => {
  it('renders a list whose direct children are list items, one per tile', () => {
    render(
      <KpiTileStrip className="sm:grid-cols-2">
        <KpiTile caption="Overdue" value={3} />
        <KpiTile caption="Due within 14 days" value={5} />
        {false}
        {null}
      </KpiTileStrip>,
    );

    const list = screen.getByRole('list');
    expect(list.tagName).toBe('UL');
    // The markers are removed, and WebKit then drops list semantics unless the role is stated.
    expect(list).toHaveAttribute('role', 'list');
    expect(list).toHaveClass('sm:grid-cols-2');
    expect(Array.from(list.children).map((child) => child.tagName)).toEqual(['LI', 'LI']);

    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Overdue');
    expect(items[1]).toHaveTextContent('Due within 14 days');
  });
});

describe('KpiTileSkeleton', () => {
  it('mirrors the tile frame with skeleton blocks for the caption, value and supporting lines', () => {
    const { container } = render(<KpiTileSkeleton />);

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });

  it('omits the supporting-line block for tiles without a supporting line', () => {
    const { container } = render(<KpiTileSkeleton hasSupportingText={false} />);

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
  });
});
