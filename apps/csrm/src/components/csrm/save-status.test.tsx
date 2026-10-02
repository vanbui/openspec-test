import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TimeZoneProvider } from './local-time';
import { SaveStatus, type SaveStatusValue } from './save-status';

/* UI-SPEC §6.1 and the design direction's X-1 Save status. */

const normalised = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim();

function renderStatus(status: SaveStatusValue, props: Partial<Parameters<typeof SaveStatus>[0]> = {}) {
  return render(
    <TimeZoneProvider zone="Australia/Sydney">
      <SaveStatus status={status} {...props} />
    </TimeZoneProvider>,
  );
}

/** True when the element sits inside anything a screen reader announces on change. */
function insideLiveRegion(element: Element): boolean {
  return element.closest('[role="status"], [role="alert"], [aria-live]') !== null;
}

describe('SaveStatus', () => {
  it('idle renders an empty polite region of reserved height, and nothing else', () => {
    const { container } = renderStatus({ kind: 'idle' });

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('min-h-5');
  });

  it('saving shows Saving… visibly, outside any live region', () => {
    renderStatus({ kind: 'saving' });

    const saving = screen.getByText('Saving…');
    expect(insideLiveRegion(saving)).toBe(false);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('saved announces Saved at the local time politely, with the success icon', () => {
    renderStatus({ kind: 'saved', at: '2026-09-28T01:00:05.000Z' });

    const status = screen.getByRole('status');
    expect(normalised(status.textContent)).toBe('Saved at 11:00 am');
    expect(status.querySelector('time')).toHaveAttribute('dateTime', '2026-09-28T01:00:05.000Z');
    const icon = status.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveClass('text-success');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a record form can name what it saved', () => {
    renderStatus({ kind: 'saved', at: '2026-09-28T01:00:05.000Z' }, { savedLabel: (time) => <>Risk saved at {time}</> });

    expect(normalised(screen.getByRole('status').textContent)).toBe('Risk saved at 11:00 am');
  });

  it('a retryable failure is announced once with Retry save', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderStatus({ kind: 'failed', failure: 'retryable' }, { onRetry });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Your latest answers weren’t saved.');
    expect(alert.querySelector('svg')).toHaveClass('text-destructive');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await user.click(screen.getByRole('button', { name: 'Retry save' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Refresh page' })).not.toBeInTheDocument();
  });

  it('a blocked failure is announced once with its message and Refresh page', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const message = 'This questionnaire is no longer open for answers, so your latest answers weren’t saved.';
    renderStatus({ kind: 'failed', failure: 'blocked', message }, { onRefresh });

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    await user.click(screen.getByRole('button', { name: 'Refresh page' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Retry save' })).not.toBeInTheDocument();
  });

  it('a visual echo shows the same words without announcing them again', () => {
    const { container } = renderStatus({ kind: 'saved', at: '2026-09-28T01:00:05.000Z' }, { announce: false });

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[role], [aria-live]')).toBeNull();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(normalised(screen.getByText(/Saved at/).textContent)).toBe('Saved at 11:00 am');
  });

  it('a visual echo of a failure carries no control a hidden region could trap focus in', () => {
    const { container } = renderStatus({ kind: 'failed', failure: 'retryable' }, { announce: false, onRetry: vi.fn() });

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container).toHaveTextContent('Your latest answers weren’t saved.');
    expect(container.querySelector('button')).toBeNull();
  });
});
