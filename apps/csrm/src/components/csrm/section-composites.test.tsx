import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { render, screen, within } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { PageHeader as ShellPageHeader } from '@/components/shell/app-shell';

type PageHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

type SectionProps = {
  title: string;
  description?: string;
  headingId?: string;
  children: ReactNode;
};

const sentinel = 'PHASE2_RED_02_10_01_SECTION_COMPOSITES_ABSENT';

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

describe('page and section composites', () => {
  it('associates page and section composite content accessibly', async () => {
    const baseline = render(
      <ShellPageHeader
        action={<button type="button">Create request</button>}
        description="Review and manage your assessment requests."
        title="My requests"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'My requests' })).toHaveClass('text-heading-lg');
    expect(screen.getByText('Review and manage your assessment requests.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create request' })).toBeInTheDocument();
    baseline.unmount();

    const [PageHeader, DetailSection, FormSection] = await Promise.all([
      loadComponent<PageHeaderProps>('src/components/csrm/page-header.tsx', 'PageHeader'),
      loadComponent<SectionProps>('src/components/csrm/detail-section.tsx', 'DetailSection'),
      loadComponent<SectionProps>('src/components/csrm/form-section.tsx', 'FormSection'),
    ]);

    expect(PageHeader).toBe(ShellPageHeader);

    const { rerender } = render(
      <>
        <PageHeader
          action={<button type="button">Create request</button>}
          description="Review and manage your assessment requests."
          title="My requests"
        />
        <DetailSection
          description="Information supplied by the requestor."
          headingId="request-details-heading"
          title="Request details"
        >
          <dl><dt>Owner</dt><dd>Jane Doe</dd></dl>
        </DetailSection>
        <FormSection
          description="Provide the information needed for review."
          headingId="request-scope-heading"
          title="Request scope"
        >
          <label htmlFor="request-title">Title</label>
          <input id="request-title" />
          <label htmlFor="request-description">Description</label>
          <textarea id="request-description" />
        </FormSection>
      </>,
    );

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'My requests' })).toBeInTheDocument();
    expect(screen.getByText('Review and manage your assessment requests.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create request' })).toBeInTheDocument();

    const detailSection = screen.getByRole('region', { name: 'Request details' });
    const detailHeading = within(detailSection).getByRole('heading', { level: 2, name: 'Request details' });
    expect(detailHeading).toHaveClass('text-heading-md');
    const detailDescription = within(detailSection).getByText('Information supplied by the requestor.');
    expect(detailSection).toHaveAttribute('aria-labelledby', detailHeading.id);
    expect(detailSection).toHaveAttribute('aria-describedby', detailDescription.id);
    expect(within(detailSection).getByText('Jane Doe')).toBeInTheDocument();

    const formSection = screen.getByRole('group', { name: 'Request scope' });
    const formHeading = within(formSection).getByRole('heading', { level: 2, name: 'Request scope' });
    expect(formHeading).toHaveClass('text-heading-sm');
    const formDescription = within(formSection).getByText('Provide the information needed for review.');
    expect(formSection).toHaveAttribute('aria-labelledby', formHeading.id);
    expect(formSection).toHaveAttribute('aria-describedby', formDescription.id);

    const fields = within(formSection).getAllByRole('textbox');
    expect(fields.map((field) => field.id)).toEqual(['request-title', 'request-description']);
    expect(fields[0].compareDocumentPosition(fields[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rerender(<PageHeader description="No action is currently available." title="Request overview" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Request overview' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
