import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it('is 20px tall: a 16px caption line, 1px padding and a 1px border above and below (W-11)', () => {
    // Direction section 4 Status & risk badges: 20px height, --text-caption at 500, 8px horizontal padding.
    // py-0.5 made every badge 22px, and every status and severity now shares this badge.
    render(<Badge variant="info">Draft</Badge>);
    const badge = screen.getByText('Draft');
    expect(badge).toHaveClass('py-px', 'px-2', 'text-xs', 'border');
    expect(badge).not.toHaveClass('py-0.5');
  });
});
