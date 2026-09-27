import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { assessmentRatings } from '@/features/assessments/assessment-schema';
import { requestStatuses } from '@/features/requests/request-domain';

import { AlertUrgencyBadge } from './alert-urgency-badge';
import { RiskRatingBadge } from './risk-rating-badge';
import { StatusBadge } from './status-badge';

const urgencies = [
  ['overdue', 'danger', 'lucide-calendar-x-2', 'Overdue', 'text-destructive'],
  ['due-soon', 'warning', 'lucide-calendar-clock', 'Due soon', 'text-warning'],
  ['attention', 'info', 'lucide-flag', 'Needs attention', 'text-info'],
] as const;

function lucideIconNames(root: ParentNode) {
  return Array.from(root.querySelectorAll('svg')).flatMap((svg) =>
    Array.from(svg.classList).filter((name) => name.startsWith('lucide-')),
  );
}

describe('AlertUrgencyBadge', () => {
  it.each(urgencies)(
    'presents %s as the %s status badge with its own icon and a hidden Urgency prefix',
    (urgency, variant, iconName, label) => {
      render(<AlertUrgencyBadge urgency={urgency} />);

      const badge = screen.getByText(label, { exact: true });
      expect(badge).toHaveAttribute('data-slot', 'badge');
      expect(badge).toHaveAttribute('data-variant', variant);
      expect(badge).not.toHaveAttribute('aria-label');
      // Cards and rows have no column header, so the badge itself says what the word means.
      expect(badge).toHaveTextContent(`Urgency: ${label}`);
      expect(screen.getByText('Urgency:')).toHaveClass('sr-only');

      const icons = badge.querySelectorAll('svg');
      expect(icons).toHaveLength(1);
      expect(icons[0]).toHaveClass(iconName);
      expect(icons[0]).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it.each(urgencies)(
    'draws the dense %s marker as an icon and label in the urgency colour with no chip',
    (urgency, _variant, iconName, label, toneClass) => {
      render(<AlertUrgencyBadge density="dense" urgency={urgency} />);

      // The label is its own element holding the icon, so a table locator by exact text finds
      // the marker and its one icon, while the hidden prefix sits outside it.
      const marker = screen.getByText(label, { exact: true });
      expect(marker).toHaveTextContent(new RegExp(`^${label}$`));
      expect(marker).toHaveClass(toneClass);
      expect(marker.querySelectorAll('svg')).toHaveLength(1);
      expect(marker.querySelector('svg')).toHaveClass(iconName);
      expect(marker.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(marker.className).not.toMatch(/\bbg-|\bborder\b|rounded/);

      const outer = marker.parentElement as HTMLElement;
      expect(outer).toHaveTextContent(`Urgency: ${label}`);
      expect(outer.querySelector('.sr-only')).toHaveTextContent('Urgency:');
      expect(outer.querySelector('[data-slot="badge"]')).toBeNull();
    },
  );

  it('never reuses a severity icon or a request-status icon, so urgency cannot read as either', () => {
    const others = render(
      <>
        {assessmentRatings.map((rating) => <RiskRatingBadge key={rating} rating={rating} />)}
        {requestStatuses.map((status) => <StatusBadge key={status} status={status} />)}
      </>,
    );
    const taken = new Set(lucideIconNames(others.container));
    expect(taken).toContain('lucide-triangle-alert');
    expect(taken).toContain('lucide-send');

    const urgency = render(
      <>
        {urgencies.map(([value]) => (
          <span key={value}>
            <AlertUrgencyBadge urgency={value} />
            <AlertUrgencyBadge density="dense" urgency={value} />
          </span>
        ))}
      </>,
    );
    const used = lucideIconNames(urgency.container);
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((name) => taken.has(name))).toEqual([]);
  });
});
