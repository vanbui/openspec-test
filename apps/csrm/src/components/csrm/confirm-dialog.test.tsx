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
