import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { AssignmentEvent } from './assignment-domain';
import { AssignmentHistory } from './assignment-history';

const bob = { documentId: 'u1', displayName: 'Bob Doe' };
const sam = { documentId: 'u4', displayName: 'Sam Analyst' };

/* Newest first, as Strapi serves it. */
const events: AssignmentEvent[] = [
  { action: 'reassign', by: bob, at: '2026-10-09T03:00:00.000Z', from: bob, to: sam, reason: 'Sam covers this system.\nBack next week.' },
  { action: 'pick-up', by: bob, at: '2026-10-09T01:00:00.000Z', from: null, to: bob, reason: null },
];

describe('the assignment history (UI-SPEC §5.3, D-09)', () => {
  it('toggles a named list, newest first, with each reason quoted on its own caption line', async () => {
    const user = userEvent.setup();
    render(<AssignmentHistory events={events} />);
    const toggle = screen.getByRole('button', { name: 'Show assignment history (2)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'Assignment history' })).not.toBeInTheDocument();

    await user.click(toggle);
    const hide = screen.getByRole('button', { name: 'Hide assignment history' });
    expect(hide).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('list', { name: 'Assignment history' });
    expect(list.tagName).toBe('OL');
    expect(hide).toHaveAttribute('aria-controls', list.id);
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Reassigned from Bob Doe to Sam Analyst by Bob Doe');
    expect(items[1]).toHaveTextContent('Picked up by Bob Doe');
    const reason = within(items[0] as HTMLElement).getByText(/^Reason: “Sam covers this system\./);
    expect(reason.textContent).toBe('Reason: “Sam covers this system.\nBack next week.”');
    expect(reason).toHaveClass('whitespace-pre-wrap');
    expect(within(items[0] as HTMLElement).getByText(/2026/).closest('time')).toHaveAttribute('dateTime', '2026-10-09T03:00:00.000Z');
    expect(within(items[1] as HTMLElement).queryByText(/^Reason:/)).not.toBeInTheDocument();

    await user.click(hide);
    expect(screen.getByRole('button', { name: 'Show assignment history (2)' })).toHaveFocus();
    expect(screen.queryByRole('list', { name: 'Assignment history' })).not.toBeInTheDocument();
  });

  it('shows no toggle when the log is malformed or empty (fail safe)', () => {
    const { container, rerender } = render(<AssignmentHistory events={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AssignmentHistory events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders names and reasons as text, never as markup (T-13-33)', async () => {
    const user = userEvent.setup();
    const hostile = { documentId: 'u9', displayName: '<img src=x onerror=alert(1)>' };
    render(<AssignmentHistory events={[{ action: 'assign', by: hostile, at: '2026-10-09T03:00:00.000Z', from: null, to: sam, reason: '<b>bold</b>' }]} />);
    await user.click(screen.getByRole('button', { name: 'Show assignment history (1)' }));
    expect(screen.getByText('Assigned to Sam Analyst by <img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText('Reason: “<b>bold</b>”')).toBeInTheDocument();
    expect(document.querySelector('img, b')).toBeNull();
  });
});
