import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ current: vi.fn(), granted: vi.fn(), loadNavigationCounts: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/development-session-adapter', () => ({ getSessionAdapter: () => ({
  current: mocks.current, capabilitiesFor: () => ({ granted: mocks.granted }),
}) }));
vi.mock('@/lib/auth/development-runtime', () => ({ resolveSessionRuntimeMode: () => 'development' }));
vi.mock('@/lib/time/viewer-time-zone', () => ({ readViewerTimeZone: async () => null }));
vi.mock('./app-shell', () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('./navigation-counts', () => ({ loadNavigationCounts: mocks.loadNavigationCounts }));

import ProtectedLayout from '../../../app/(app)/layout';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.current.mockResolvedValue({ displayName: 'Development user', developmentRole: 'Requestor' });
  mocks.granted.mockResolvedValue(new Set());
});

it('offers sign-in recovery when the entire protected shell is refused, without claiming Home is available', async () => {
  render(await ProtectedLayout({ children: <p>Protected work</p> }));
  expect(screen.getByRole('alert')).toHaveTextContent('Your access is unavailable. Return to sign in and try again. If the problem continues, contact your administrator.');
  expect(screen.getByRole('link', { name: 'Return to sign in' })).toHaveAttribute('href', '/sign-in');
  expect(screen.queryByRole('link', { name: 'Go to Home' })).not.toBeInTheDocument();
  expect(screen.queryByText('Protected work')).not.toBeInTheDocument();
  expect(mocks.loadNavigationCounts).not.toHaveBeenCalled();
});

it('stays dynamic and withholds protected children while current access is pending, then refuses', async () => {
  const { dynamic } = await import('../../../app/(app)/layout');
  expect(dynamic).toBe('force-dynamic');
  let resolve!: (granted: Set<string>) => void;
  mocks.current.mockResolvedValue({ displayName: 'Existing session', identityKey: 'same-person' });
  mocks.granted.mockReturnValue(new Promise<Set<string>>((done) => { resolve = done; }));
  let settled = false;
  const rendering = ProtectedLayout({ children: <p>Private assessment details</p> }).then((element) => { settled = true; return element; });
  await vi.waitFor(() => expect(mocks.granted).toHaveBeenCalledOnce());
  expect(settled).toBe(false);
  expect(screen.queryByText('Private assessment details')).not.toBeInTheDocument();
  resolve(new Set());
  render(await rendering);
  expect(screen.getByRole('heading', { name: 'You don’t have access to this area' })).toBeVisible();
  expect(screen.queryByText('Private assessment details')).not.toBeInTheDocument();
  expect(mocks.loadNavigationCounts).not.toHaveBeenCalled();
});
