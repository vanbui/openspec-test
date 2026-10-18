import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AiFieldMarker } from './ai-field-marker';

describe('AiFieldMarker', () => {
  it('keeps Confirm outside the label and identifies the marker for a control description', () => {
    const onConfirm = vi.fn();
    const { container } = render(<div><label htmlFor="field">Issue statement</label><AiFieldMarker field="issueStatement" id="marker" label="Issue statement" onConfirm={onConfirm} state="proposed" /><input aria-describedby="marker" id="field" /></div>);
    expect(screen.getByText('AI proposed')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Issue statement' })).toHaveAccessibleDescription('AI proposed');
    const button = screen.getByRole('button', { name: 'Confirm Issue statement' });
    expect(button.closest('label')).toBeNull();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(container.querySelector('#marker')).toBeTruthy();
  });

  /* 12-UI-SPEC §6.2 (WR-301): Confirm names its field, so focus can move to the next Confirm in field order. */
  it('names its field on Confirm', () => {
    render(<AiFieldMarker field="issueStatement" id="marker" label="Issue statement" onConfirm={vi.fn()} state="proposed" />);
    expect(screen.getByRole('button', { name: 'Confirm Issue statement' })).toHaveAttribute('data-ai-confirm', 'issueStatement');
  });

  /*
   * 12-UI-SPEC Motion (walk D13(d)): the pending opacity applies without a transition; leaving it eases back at
   * --duration-base, as a rollback does.
   */
  it('takes the pending opacity without a transition', () => {
    const { container, rerender } = render(<AiFieldMarker field="issueStatement" id="marker" label="Issue statement" onConfirm={vi.fn()} pending state="accepted" />);
    const marker = container.firstElementChild;
    expect(marker).toHaveAttribute('data-pending', 'true');
    expect(marker).toHaveClass('data-[pending=true]:opacity-60', 'data-[pending=true]:transition-none', 'transition-opacity', 'duration-(--duration-base)', 'ease-standard');
    rerender(<AiFieldMarker field="issueStatement" id="marker" label="Issue statement" onConfirm={vi.fn()} state="proposed" />);
    expect(container.firstElementChild).toHaveAttribute('data-pending', 'false');
  });

  /* IN-402: each reviewed state offers no Confirm, and a field with no AI fact renders nothing at all. */
  it('shows the reviewed and unsaved states without a decision button, and nothing without an AI fact', () => {
    const onConfirm = vi.fn();
    const { container, rerender } = render(<AiFieldMarker field="issueStatement" id="marker" label="Issue statement" onConfirm={onConfirm} state="changed" />);
    expect(screen.getByText('Edited, not saved')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<AiFieldMarker field="issueStatement" id="marker" label="Issue statement" onConfirm={onConfirm} state="accepted" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<AiFieldMarker field="issueStatement" id="marker" label="Issue statement" onConfirm={onConfirm} state="edited" />);
    expect(screen.getByText('Edited')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<AiFieldMarker field="issueStatement" id="marker" label="Issue statement" onConfirm={onConfirm} state={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
