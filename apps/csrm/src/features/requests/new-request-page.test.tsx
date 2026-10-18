import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ current: vi.fn(), granted: vi.fn(), listInformationSystems: vi.fn(), listInformationAssets: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/development-session-adapter', () => ({ getSessionAdapter: () => ({ current: mocks.current, capabilitiesFor: () => ({ granted: mocks.granted }) }) }));
vi.mock('@/features/requests/request-service', () => ({ listInformationSystems: mocks.listInformationSystems, listInformationAssets: mocks.listInformationAssets }));
vi.mock('@/features/requests/request-form', () => ({ RequestForm: () => <form aria-label="New request form" /> }));

import NewRequestPage from '../../../app/(app)/app/requests/new/page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.current.mockResolvedValue({ displayName: 'Read-only Requestor' });
  mocks.granted.mockResolvedValue(new Set(['assessment-request:read']));
  mocks.listInformationSystems.mockResolvedValue({ data: [], error: null });
  mocks.listInformationAssets.mockResolvedValue({ data: [], error: null });
});

it('refuses creation before reading selectors or rendering the form for a read-only Requestor', async () => {
  render(await NewRequestPage());
  expect(screen.getByRole('heading', { level: 1, name: 'New request' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to create requests');
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
  expect(mocks.listInformationSystems).not.toHaveBeenCalled();
  expect(mocks.listInformationAssets).not.toHaveBeenCalled();
});

it('keeps the create workflow available when the resolved session grants creation', async () => {
  mocks.granted.mockResolvedValue(new Set(['assessment-request:read', 'assessment-request:create']));
  render(await NewRequestPage());
  expect(screen.getByRole('form', { name: 'New request form' })).toBeInTheDocument();
});
