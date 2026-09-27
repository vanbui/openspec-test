import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CsrmAssessmentRequest } from './request-domain';

vi.mock('./request-actions', () => ({
  createRequestAction: vi.fn(),
  updateRequestAction: vi.fn(),
  submitRequestAction: vi.fn(),
  revertRequestToDraftAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const routeRoot = resolve(process.cwd(), 'app/(app)/app/requests');

describe('request route workflow', () => {
  it('keeps authorised loading in Server Components and exposes all route states', () => {
    const files = [
      'new/page.tsx',
      'new/loading.tsx',
      '[documentId]/page.tsx',
      '[documentId]/edit/page.tsx',
      '[documentId]/edit/loading.tsx',
      '[documentId]/loading.tsx',
      '[documentId]/error.tsx',
    ];
    for (const file of files) expect(existsSync(resolve(routeRoot, file))).toBe(true);

    const detail = readFileSync(resolve(routeRoot, '[documentId]/page.tsx'), 'utf8');
    const edit = readFileSync(resolve(routeRoot, '[documentId]/edit/page.tsx'), 'utf8');
    expect(detail).toContain('await params');
    expect(detail).toContain('getRequest');
    expect(detail).not.toContain("'use client'");
    expect(edit).toContain('await params');
    expect(edit).toContain('getRequest');
    expect(edit).not.toContain("'use client'");
    expect(detail).not.toMatch(/\bfetch\s*\(/);
    expect(edit).not.toMatch(/\bfetch\s*\(/);
    expect(readFileSync(resolve(routeRoot, 'new/loading.tsx'), 'utf8')).toContain('RequestFormLoading');
    expect(readFileSync(resolve(routeRoot, '[documentId]/edit/loading.tsx'), 'utf8')).toContain('RequestFormLoading');
  });

  it('derives Requestor editability only from the authoritative returned status', async () => {
    const domainModule = './request-' + 'domain';
    const domain = await import(/* @vite-ignore */ domainModule) as {
      canRequestorEdit?: (status: string) => boolean;
    };
    if (!domain.canRequestorEdit) throw new Error('PHASE2_RED_W0_03B_FORM_WORKFLOW_UI_ABSENT');

    expect(domain.canRequestorEdit('draft')).toBe(true);
    for (const status of ['submitted', 'questionnaire-in-progress', 'risk-assessment-drafted', 'under-review', 'approved', 'closed'] as const) {
      expect(domain.canRequestorEdit(status)).toBe(false);
    }
  });

  it('does not expose Requestor mutation controls for a submitted detail payload', async () => {
    const actionsModule = './request-' + 'workflow-actions';
    const module = await import(/* @vite-ignore */ actionsModule) as {
      RequestWorkflowActions?: ComponentType<{ request: CsrmAssessmentRequest }>;
    };
    if (!module.RequestWorkflowActions) throw new Error('PHASE2_RED_W0_03B_FORM_WORKFLOW_UI_ABSENT');
    const request: CsrmAssessmentRequest = {
      documentId: 'request-1', requestNumber: 'RAR-2026-X7K4Q2', title: 'Portal review',
      description: null, requestStatus: 'submitted', submittedDate: '2026-08-29T00:00:00.000Z',
      dueDate: null, updatedAt: null, dueDateLabel: null, updatedDateLabel: null,
      informationSystems: [], informationAssets: [], questionnaire: null, assessment: null,
    };
    render(<module.RequestWorkflowActions request={request} />);
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit request' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit request' })).not.toBeInTheDocument();
  });
});
