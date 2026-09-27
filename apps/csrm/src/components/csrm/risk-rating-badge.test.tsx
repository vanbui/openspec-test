import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RiskRatingBadge } from './risk-rating-badge';

describe('RiskRatingBadge', () => {
  it.each([
    ['Low', 1, 'risk-low'],
    ['Moderate', 2, 'risk-medium'],
    ['High', 3, 'risk-high'],
    ['Critical', 4, 'risk-critical'],
  ] as const)('uses the semantic ordered severity presentation for %s', (rating, position, token) => {
    render(<RiskRatingBadge rating={rating} />);
    const badge = screen.getByLabelText(`Severity: ${rating.toLowerCase()} (${position} of 4)`);
    expect(badge).toHaveTextContent(rating);
    expect(badge.className).toContain(`text-${token}`);
    expect(badge.className).not.toContain('info');
    expect(badge.className).not.toContain('destructive/');
  });

  it('leaves the naming to an enclosing link that already names the rating, so the link’s text is the rating’s word', () => {
    const { container } = render(<RiskRatingBadge labelled={false} rating="Critical" />);
    const badge = container.querySelector('[data-slot="badge"]');

    expect(badge).toHaveTextContent('Critical');
    expect(badge).not.toHaveAttribute('aria-label');
    expect(badge?.className).toContain('text-risk-critical');
  });
});
