import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'questionnaire-in-progress'
  | 'risk-assessment-drafted'
  | 'under-review'
  | 'approved'
  | 'closed';

type StatusBadgeProps = {
  live?: boolean;
  status: RequestStatus;
};

type ConfirmDialogProps = {
  confirmLabel: string;
  confirmVariant: 'default' | 'destructive';
  description: string;
  onConfirm: () => Promise<void> | void;
  pendingLabel: string;
  reasonRequired?: boolean;
  title: string;
  trigger: ReactNode;
};

const requestStatuses: ReadonlyArray<readonly [RequestStatus, string]> = [
  ['draft', 'Draft'],
  ['submitted', 'Submitted'],
  ['questionnaire-in-progress', 'Questionnaire in progress'],
  ['risk-assessment-drafted', 'Risk assessment drafted'],
  ['under-review', 'Under review'],
  ['approved', 'Approved'],
  ['closed', 'Closed'],
];

const sentinel = 'PHASE2_RED_02_11_01_FEEDBACK_COMPOSITES_ABSENT';

async function loadComponent<TProps>(path: string, exportName: string): Promise<ComponentType<TProps>> {
  const sourcePath = resolve(process.cwd(), path);

  if (!existsSync(sourcePath)) {
    throw new Error(sentinel);
  }

  const moduleUrl = pathToFileURL(sourcePath).href;
  const module = (await import(/* @vite-ignore */ moduleUrl)) as Record<string, ComponentType<TProps> | undefined>;
  const component = module[exportName];

  if (!component) {
    throw new Error(sentinel);
  }

  return component;
}

function deferredPromise() {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

describe('feedback composites', () => {
  it('communicates status and confirmation feedback accessibly', async () => {
    const baseline = render(
      <>
        <Badge>Baseline badge</Badge>
        <AlertDialog>
          <AlertDialogTrigger>Open baseline dialog</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Baseline confirmation</AlertDialogTitle>
            <AlertDialogDescription>Baseline dialog description</AlertDialogDescription>
          </AlertDialogContent>
        </AlertDialog>
      </>,
    );
    const user = userEvent.setup();

    expect(screen.getByText('Baseline badge')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open baseline dialog' }));
    expect(screen.getByRole('alertdialog', { name: 'Baseline confirmation' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    baseline.unmount();

    const schema = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          '../strapi/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json',
        ),
        'utf8',
      ),
    ) as { attributes: { requestStatus: { enum: string[] } } };
    expect(schema.attributes.requestStatus.enum).toEqual(requestStatuses.map(([status]) => status));

    const layoutSource = readFileSync(resolve(process.cwd(), 'app/layout.tsx'), 'utf8');
    if ((layoutSource.match(/<Toaster\b/g) ?? []).length !== 1) {
      throw new Error(sentinel);
    }

    const [StatusBadge, ConfirmDialog] = await Promise.all([
      loadComponent<StatusBadgeProps>('src/components/csrm/status-badge.tsx', 'StatusBadge'),
      loadComponent<ConfirmDialogProps>('src/components/csrm/confirm-dialog.tsx', 'ConfirmDialog'),
    ]);

    const statusView = render(
      <div>
        {requestStatuses.map(([status]) => (
          <StatusBadge key={status} status={status} />
        ))}
        <StatusBadge live status="under-review" />
      </div>,
    );

    for (const [, label] of requestStatuses) {
      const badge = screen.getAllByText(label)[0].closest('[data-slot="badge"]');
      expect(badge).not.toBeNull();
      expect((badge as HTMLElement).querySelector('svg')).not.toBeNull();
    }
    expect(screen.getAllByText('Under review')[1].closest('[data-slot="badge"]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    statusView.unmount();

    const submission = deferredPromise();
    const onConfirm = vi.fn(() => submission.promise);
    render(
      <ConfirmDialog
        confirmLabel="Delete assessment"
        confirmVariant="destructive"
        description="Submitting sends this assessment request to the Security Analyst and cannot be undone."
        onConfirm={onConfirm}
        pendingLabel="Deleting assessment…"
        title="Submit assessment request?"
        trigger={<button type="button">Review submission</button>}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Review submission' });
    trigger.focus();
    await user.click(trigger);

    const dialog = screen.getByRole('alertdialog', { name: 'Submit assessment request?' });
    expect(dialog).toHaveAccessibleDescription(
      'Submitting sends this assessment request to the Security Analyst and cannot be undone.',
    );
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const submit = within(dialog).getByRole('button', { name: 'Delete assessment' });
    expect(submit).toHaveAttribute('data-variant', 'destructive');
    expect(cancel).toHaveFocus();

    await user.click(cancel);
    expect(trigger).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(trigger);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete assessment' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Deleting assessment…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Deleting assessment…' }));
    expect(onConfirm).toHaveBeenCalledOnce();

    submission.resolve();
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Review submission' })).toHaveFocus();
    });
  });

  it('reports a required reason only after the person has used the field', async () => {
    const user = userEvent.setup();
    const ConfirmDialog = await loadComponent<ConfirmDialogProps>(
      'src/components/csrm/confirm-dialog.tsx',
      'ConfirmDialog',
    );
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
    const dialog = screen.getByRole('alertdialog');
    const reason = within(dialog).getByLabelText('Reason');
    const confirm = within(dialog).getByRole('button', { name: 'Return request to draft' });

    // Nothing has been typed yet: the action is unavailable, but the field is
    // not yet announced as invalid and shows the neutral counter.
    expect(confirm).toBeDisabled();
    expect(reason).not.toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByText('0/500 characters')).toBeInTheDocument();

    await user.type(reason, 'Scope changed');
    expect(reason).not.toHaveAttribute('aria-invalid', 'true');
    expect(confirm).toBeEnabled();

    await user.clear(reason);
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByText('Enter a reason of up to 500 characters.')).toBeInTheDocument();
    expect(confirm).toBeDisabled();
  });
});
