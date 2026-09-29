/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/app' }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock('../../../app/actions/session', () => ({
  setDevelopmentRole: vi.fn(),
  signOutOfSession: vi.fn(),
}));

import { AppShell } from './app-shell';

const granted = new Set(['assessment-request:read'] as const);

describe('AppShell in OIDC mode (an account, no development role)', () => {
  it('shows "Signed in as <name>", a Sign out control, and no development role select', () => {
    render(
      <AppShell account={{ displayName: 'Jane Doe' }} granted={granted}>
        <p>content</p>
      </AppShell>,
    );

    expect(screen.getByText('Signed in as Jane Doe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Development role' })).not.toBeInTheDocument();
  });
});

describe('AppShell in development mode (a role, no account), unchanged', () => {
  it('shows the role switcher and no Sign out control', () => {
    render(
      <AppShell granted={granted} role="Requestor">
        <p>content</p>
      </AppShell>,
    );

    expect(screen.getAllByRole('combobox', { name: 'Development role' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });
});

describe('AppShell with neither a role nor an account, byte-identical to before', () => {
  it('renders no shell-footer at all', () => {
    render(
      <AppShell granted={granted}>
        <p>content</p>
      </AppShell>,
    );

    expect(document.querySelector('.shell-footer')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Development role' })).not.toBeInTheDocument();
  });
});
