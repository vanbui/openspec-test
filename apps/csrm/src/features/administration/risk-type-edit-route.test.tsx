import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * WR-207: the Risk Type edit page labels each saved applicable control from the control library read. When that
 * read fails, a saved control has no label, and the form would read it as `Control not found` (D-36, the wording
 * for a control deleted from the library), inviting an administrator to remove a valid control. The page shows
 * its load failure instead, so no removal can rest on the failed read.
 */

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  granted: vi.fn(),
  getRiskType: vi.fn(),
  listControls: vi.fn(),
  notFound: vi.fn(),
}));

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', TestResizeObserver);

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app/admin/risk-types/risk-type-1',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({ current: mocks.current, capabilitiesFor: () => ({ granted: mocks.granted }) }),
}));
vi.mock('@/features/administration/administration-service', () => ({
  getAdministrationControl: vi.fn(),
  getInformationAsset: vi.fn(),
  getInformationSystem: vi.fn(),
  getRiskType: mocks.getRiskType,
}));
vi.mock('@/features/assessments/assessment-service', () => ({ listControls: mocks.listControls }));
vi.mock('@/features/administration/administration-actions', () => ({
  searchApplicableControlsAction: vi.fn(),
  updateControlAction: vi.fn(),
  updateInformationAssetAction: vi.fn(),
  updateInformationSystemAction: vi.fn(),
  updateRiskTypeAction: vi.fn(),
}));
vi.mock('@/features/assessments/assessment-actions', () => ({ searchActiveUsersAction: vi.fn() }));

import AdministrationRecordPage from '../../../app/(app)/app/admin/[collection]/[documentId]/page';

const props = () => ({ params: Promise.resolve({ collection: 'risk-types', documentId: 'risk-type-1' }) });
const ok = <T,>(data: T) => ({ data, error: null });
const failed = (status: number) => ({ data: null, error: { status, message: 'raw internal detail' } });
const riskType = { documentId: 'risk-type-1', name: 'Internet Exposure', description: null, applicableControls: ['control-1'] };
const ac1 = { documentId: 'control-1', controlNumber: 'AC-1', name: 'Access control', description: null, framework: 'NIST SP 800-53' };

describe('the Risk Type edit page and its control library read (WR-207)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.current.mockResolvedValue({ displayName: 'Bob Doe' });
    mocks.granted.mockResolvedValue(new Set(['administration:manage']));
    mocks.getRiskType.mockResolvedValue(ok(riskType));
    mocks.listControls.mockResolvedValue(ok([ac1]));
  });

  it('labels a saved applicable control from the library read', async () => {
    render(await AdministrationRecordPage(props()));

    expect(screen.getByText('AC-1 · Access control')).toBeInTheDocument();
    expect(screen.queryByText('Control not found')).not.toBeInTheDocument();
  });

  it('shows the load failure, never Control not found, when the library read fails', async () => {
    mocks.listControls.mockResolvedValue(failed(503));
    render(await AdministrationRecordPage(props()));

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load this Risk Type.');
    expect(screen.queryByText('Control not found')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows the permission state when Strapi refuses the library read', async () => {
    mocks.listControls.mockResolvedValue(failed(403));
    render(await AdministrationRecordPage(props()));

    expect(screen.queryByText('Control not found')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Risk Types' })).toBeInTheDocument();
  });
});
