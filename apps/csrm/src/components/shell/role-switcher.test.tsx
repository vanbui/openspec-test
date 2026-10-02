import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver } from '@/test/layout-stubs';

const setDevelopmentRole = vi.hoisted(() => vi.fn());

vi.mock('../../../app/actions/session', () => ({ setDevelopmentRole }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/app/questionnaires/q-1' }));

import { NavigationGuardProvider, useLeaveGuard } from '../csrm/navigation-guard';
import { RoleSwitcher } from './role-switcher';

beforeEach(() => {
  installTestResizeObserver();
  setDevelopmentRole.mockReset();
});

describe('RoleSwitcher', () => {
  it('keeps its label on every copy, so the navigation sheet copy is named while the sidebar copy exists', () => {
    // The shell renders the switcher in the sidebar (hidden below lg) and again in the navigation
    // sheet. A shared id pointed the sheet's label at the hidden sidebar select, leaving the
    // visible select unnamed.
    render(
      <>
        <RoleSwitcher role="Security Analyst" />
        <RoleSwitcher role="Security Analyst" />
      </>,
    );

    const selects = screen.getAllByRole('combobox', { name: 'Development role' });
    expect(selects).toHaveLength(2);
    expect(new Set(selects.map((select) => select.id)).size).toBe(2);
    for (const select of selects) expect(select).toHaveValue('Security Analyst');
  });
});

/*
 * WR-305: in development and E2E mode the role switcher changes the identity, and the page re-renders under it.
 * While answers wait to be saved, it consults the leave guard like every other in-app navigation, so the waiting
 * answers are never sent under a different identity.
 */
describe('RoleSwitcher and the leave guard (WR-305)', () => {
  function Questionnaire({ blocking }: { blocking: boolean }) {
    useLeaveGuard(blocking);
    return <h1>Customer portal questionnaire</h1>;
  }

  function shell(blocking: boolean) {
    return (
      <NavigationGuardProvider>
        <Questionnaire blocking={blocking} />
        <RoleSwitcher role="Requestor" />
      </NavigationGuardProvider>
    );
  }

  const submittedRole = () => (setDevelopmentRole.mock.lastCall?.[0] as FormData | undefined)?.get('role');

  it('switches at once when nothing is unsaved', async () => {
    const user = userEvent.setup();
    render(shell(false));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Development role' }), 'Security Analyst');

    expect(setDevelopmentRole).toHaveBeenCalledOnce();
    expect(submittedRole()).toBe('Security Analyst');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks first while answers wait, and Keep answering keeps the identity and the select as they were', async () => {
    const user = userEvent.setup();
    render(shell(true));
    const select = screen.getByRole('combobox', { name: 'Development role' });

    await user.selectOptions(select, 'Security Analyst');

    expect(setDevelopmentRole).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Leave this questionnaire?' })).toBeInTheDocument();
    expect(select).toHaveValue('Requestor');

    await user.click(screen.getByRole('button', { name: 'Keep answering' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(setDevelopmentRole).not.toHaveBeenCalled();
    expect(select).toHaveValue('Requestor');
    await waitFor(() => expect(select).toHaveFocus());
  });

  it('switches only after Leave questionnaire, with the role that was chosen', async () => {
    const user = userEvent.setup();
    render(shell(true));
    const select = screen.getByRole('combobox', { name: 'Development role' });

    await user.selectOptions(select, 'Secondary Requestor');
    await user.click(screen.getByRole('button', { name: 'Leave questionnaire' }));

    expect(setDevelopmentRole).toHaveBeenCalledOnce();
    expect(submittedRole()).toBe('Secondary Requestor');
    expect(select).toHaveValue('Secondary Requestor');
  });
});
