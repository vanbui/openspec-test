import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('uses the complete portalled content width for a required reversal reason', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        confirmLabel="Return request to draft"
        confirmVariant="destructive"
        description="This returns the request to draft and clears its submitted date."
        onConfirm={vi.fn()}
        pendingLabel="Returning request to draft…"
        reasonRequired
        title="Return this request to draft?"
        trigger={<button type="button">Return to draft</button>}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Return to draft' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Return this request to draft?' });
    const reason = within(dialog).getByLabelText('Reason');
    expect(dialog).toHaveClass('w-[min(480px,calc(100vw-32px))]', 'max-w-none');
    expect(reason.parentElement).toHaveClass('w-full');
    expect(reason).toHaveClass('w-full');
    expect(within(dialog).getByRole('button', { name: 'Return request to draft' })).toBeDisabled();
  });
});

/* Controlled mode, for a dialog opened by something other than a trigger (the leave warning, UI-SPEC §6.3). */
describe('ConfirmDialog in controlled mode', () => {
  function controlled(open: boolean, onOpenChange = vi.fn(), onConfirm = vi.fn()) {
    return (
      <ConfirmDialog
        cancelLabel="Keep answering"
        confirmLabel="Leave questionnaire"
        confirmVariant="destructive"
        description="Your latest answers are still being saved. If you leave now, they may not be saved."
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open={open}
        pendingLabel="Leaving questionnaire…"
        title="Leave this questionnaire?"
      />
    );
  }

  it('renders open with no trigger, with the dismiss control focused', () => {
    render(controlled(true));

    const dialog = screen.getByRole('alertdialog', { name: 'Leave this questionnaire?' });
    expect(dialog).toHaveClass('w-[min(480px,calc(100vw-32px))]');
    expect(within(dialog).getByRole('button', { name: 'Keep answering' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Leave questionnaire' })).toBeEnabled();
  });

  it('renders nothing while closed', () => {
    render(controlled(false));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('asks its owner to close on dismiss and on Escape, and follows the open prop', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const view = render(controlled(true, onOpenChange));

    await user.click(screen.getByRole('button', { name: 'Keep answering' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    view.rerender(controlled(false, onOpenChange));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('confirms through onConfirm and leaves closing to its owner', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(controlled(true, onOpenChange, onConfirm));

    await user.click(screen.getByRole('button', { name: 'Leave questionnaire' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

/*
 * The pilot's walk, O8 (direction §4 Buttons: "Heights stay app-scaled: 32px small, 36px default, 40px large; touch
 * targets ≥44px below 768px"): the confirm and leave dialogs' buttons were 36px tall at 375. The shared footer gives
 * every button it holds the touch-target height below 768px, and leaves them at 36px from 768px.
 */
describe('ConfirmDialog’s buttons at phone widths (O8)', () => {
  it('holds both buttons in the shared footer, which gives each the touch-target height below 768px', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        confirmLabel="Submit request"
        confirmVariant="default"
        description="Security Analysts will be able to pick it up."
        onConfirm={vi.fn()}
        pendingLabel="Submitting request…"
        title="Submit this assessment request?"
        trigger={<button type="button">Submit request</button>}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Submit request' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Submit this assessment request?' });
    const footer = dialog.querySelector<HTMLElement>('[data-slot="alert-dialog-footer"]')!;
    expect(footer).toHaveClass('max-md:*:min-h-11');
    for (const name of ['Cancel', 'Submit request']) {
      const button = within(dialog).getByRole('button', { name });
      expect(button.parentElement, `${name} is the footer’s own child`).toBe(footer);
      expect(button).toHaveAttribute('data-size', 'default');
    }
  });
});
