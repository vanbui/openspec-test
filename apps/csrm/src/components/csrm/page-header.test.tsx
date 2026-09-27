import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './page-header';

/*
 * A page header carries two kinds of thing beside its title: controls (links and buttons), which
 * are interaction-only and do not print, and status (badges, ratings), which is content and does
 * (direction section 4 Print, X-4).
 */
describe('PageHeader', () => {
  it('keeps its controls out of print and its status in it', () => {
    const { container } = render(
      <PageHeader
        action={<a href="/app/requests/new">New request</a>}
        description="Review and manage your assessment requests."
        status={<span data-slot="badge">Submitted</span>}
        title="Customer portal request"
      />,
    );

    const header = container.querySelector('.page-header');
    const control = screen.getByRole('link', { name: 'New request' });
    expect(control.closest('[data-print="hidden"]')).not.toBeNull();
    // The marker draws no box, so on screen the control keeps its place in the header's layout.
    expect(control.parentElement).toHaveAttribute('data-print', 'hidden');
    expect(control.parentElement).toHaveClass('contents');

    const status = screen.getByText('Submitted');
    expect(status.closest('[data-print]')).toBeNull();
    expect(status.parentElement).toBe(header);
  });

  it('stacks its controls full-width below 768px (direction section 4 Page header, W-13)', () => {
    render(<PageHeader action={<a href="/app/requests/new">New request</a>} description="Review and manage your assessment requests." title="My Requests" />);

    // The wrapper draws no box, so each control is the header's own flex item and takes the width rule.
    expect(screen.getByRole('link', { name: 'New request' }).parentElement).toHaveClass('page-header-actions', 'contents');
    const globals = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');
    const phone = /@media \(max-width: 767px\) \{([\s\S]*?)\n\}/.exec(globals)?.[1] ?? '';
    expect(phone).toMatch(/\.page-header-actions > \* \{\s*width: 100%;\s*\}/);
  });

  it('adds no print marker to a header without controls', () => {
    const { container } = render(<PageHeader description="Your authorised requests." status={<span>Released</span>} title="Dashboard" />);

    expect(container.querySelector('[data-print]')).toBeNull();
    expect(screen.getByText('Released')).toBeInTheDocument();
  });
});
