import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

import { RecordLink } from './record-link';

describe('RecordLink', () => {
  it('forwards the destination and owns the semantic record-navigation treatment', () => {
    render(<RecordLink href="/app/requests/REQ-001">REQ-001</RecordLink>);

    const link = screen.getByRole('link', { name: 'REQ-001' });
    expect(link).toHaveAttribute('href', '/app/requests/REQ-001');
    expect(link).toHaveClass('record-link');
  });

  it('preserves consumer layout classes without allowing them to replace its visual contract', () => {
    render(<RecordLink className="truncate text-destructive font-normal no-underline" href="/app/requests/REQ-001">REQ-001</RecordLink>);

    const link = screen.getByRole('link', { name: 'REQ-001' });
    expect(link).toHaveClass('truncate', 'text-destructive', 'font-normal', 'no-underline', 'record-link');
  });
});
