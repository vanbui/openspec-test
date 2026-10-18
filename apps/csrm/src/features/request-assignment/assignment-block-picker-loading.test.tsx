import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestAssignment } from './assignment-domain';

/*
 * IN-306: the assign picker's code loads on demand (13-UI-SPEC §6), so on a slow link there is a moment between
 * pressing Assign and the picker existing. The picker module is held back here until the test releases it, which is
 * that moment. The trigger must not announce an open picker nobody can see: it says it is busy until the picker is
 * there, and pointing at it or focusing it starts loading the code before it is pressed.
 */
const gate = vi.hoisted(() => {
  let release!: () => void;
  const opened = new Promise<void>((done) => { release = done; });
  return { opened, release, requested: 0 };
});

const mocks = vi.hoisted(() => ({
  changeAssigneeAction: vi.fn(),
  listAssignableAnalystsAction: vi.fn(),
}));
vi.mock('./assignment-actions', () => ({
  changeAssigneeAction: mocks.changeAssigneeAction,
  listAssignableAnalystsAction: mocks.listAssignableAnalystsAction,
}));
vi.mock('./assign-picker', async (importOriginal) => {
  gate.requested += 1;
  await gate.opened;
  return importOriginal<typeof import('./assign-picker')>();
});
vi.mock('@/components/ui/success-toast', () => ({ successToast: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { installTestResizeObserver } from '@/test/layout-stubs';
import { AssignmentBlock } from './assignment-block';

const bob = { documentId: 'u1', displayName: 'Bob Doe' };
const sam = { documentId: 'u4', displayName: 'Sam Analyst' };
const RAR = 'RAR-2026-0001';

const unassigned: RequestAssignment = { assignee: null, assignedBy: null, assignedAt: null, actions: ['pick-up', 'assign'], ownRequest: false, history: [], viewer: bob };

beforeEach(() => {
  installTestResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  mocks.listAssignableAnalystsAction.mockResolvedValue({ ok: true, data: [bob, sam] });
});

afterEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('the assign picker while its code loads (IN-306)', () => {
  it('starts loading on focus, says the trigger is busy rather than expanded until the picker is there, then opens it', async () => {
    const user = userEvent.setup();
    render(<AssignmentBlock assignment={unassigned} draftOwnerKey="owner-key" requestId="request-1" requestNumber={RAR} requestStatus="submitted" />);
    const trigger = screen.getByRole('button', { name: `Assign ${RAR}` });

    fireEvent.focus(trigger);
    await waitFor(() => expect(gate.requested).toBe(1));

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await act(async () => gate.release());
    expect(await screen.findByRole('dialog', { name: `Assign ${RAR}` })).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
    expect(trigger).not.toHaveAttribute('aria-busy');
  });
});
