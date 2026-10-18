import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UnreadCount, UnreadDot } from './unread-marker';

/* X-17: unread is a personal fact, so it is marked in ink with words, never a status hue (13-UI-SPEC Color). */
describe('the unread marker (X-17)', () => {
  it('marks one item with an 8px ink dot and the word New', () => {
    const { container } = render(<UnreadDot />);
    expect(screen.getByText('New')).toBeInTheDocument();
    const dot = container.querySelector('[data-unread-dot]');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).toHaveClass('size-2', 'rounded-full', 'bg-foreground');
    expect(container.firstElementChild).toHaveClass('text-xs', 'font-medium', 'text-foreground');
  });

  it('marks a count with a 12px MessageSquareDot and {k} new, in tabular figures', () => {
    const { container } = render(<UnreadCount count={3} />);
    expect(container.textContent).toBe('3 new');
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveClass('size-3');
    expect(container.firstElementChild).toHaveClass('tabular-nums', 'font-medium', 'text-foreground');
  });

  it('renders nothing for a count of zero', () => {
    const { container } = render(<UnreadCount count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('never uses a status hue', () => {
    const { container } = render(<><UnreadDot /><UnreadCount count={1} /></>);
    expect(container.innerHTML).not.toMatch(/(danger|warning|success|info|destructive)/);
  });
});
