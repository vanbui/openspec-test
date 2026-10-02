import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TimeZoneProvider } from '@/components/csrm/local-time';
import type { CsrmAssessmentRequest } from './request-domain';
import { RequestContextDetails } from './request-context-details';

/*
 * The one read-only request context both actors read (D-20, UI-SPEC §9.1): every field the Requestor
 * submitted, in the request form's three groups, with instants in the viewer's zone (D-19).
 */

function request(overrides: Partial<CsrmAssessmentRequest> = {}): CsrmAssessmentRequest {
  return {
    documentId: 'request-1', requestNumber: 'RAR-2026-5WWFVQ', title: 'Customer portal expansion',
    description: 'Expand the customer portal.', assessmentType: 'Project', division: 'Digital Services',
    businessUnit: 'Customer Platforms', businessPurpose: 'Serve customers online.', businessCriticality: 'High',
    thirdPartyInvolvement: true, thirdPartyDetails: 'Hosting partner\nruns the platform.',
    regulatoryRequirements: 'Privacy Act 1988', requestStatus: 'submitted',
    submittedDate: '2026-09-27T20:00:00.000Z', dueDate: '2026-10-30', updatedAt: '2026-09-27T21:00:00.000Z',
    dueDateLabel: '30 Oct 2026', updatedDateLabel: null,
    informationSystems: [{ documentId: 'system-1', name: 'Customer portal' }, { documentId: 'system-2', name: 'Identity service' }],
    informationAssets: [{ documentId: 'asset-1', name: 'Customer data' }],
    questionnaire: null, assessment: null,
    ...overrides,
  };
}

function group(name: string): HTMLElement {
  return screen.getByRole('heading', { level: 3, name }).parentElement as HTMLElement;
}

function value(container: HTMLElement, label: string): HTMLElement {
  const term = within(container).getByText(label, { selector: 'dt' });
  return term.nextElementSibling as HTMLElement;
}

describe('RequestContextDetails', () => {
  it('is the Request context section, described plainly, with the form’s three groups in order', () => {
    render(<RequestContextDetails request={request()} />);

    const section = screen.getByRole('region', { name: 'Request context' });
    expect(section).toHaveAccessibleDescription('The details submitted with this request.');
    const headings = within(section).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Request overview', 'Business context', 'Scope and timing']);
  });

  it('shows every submitted field under its group, third-party and regulatory details included', () => {
    render(<TimeZoneProvider zone="Australia/Brisbane"><RequestContextDetails request={request()} /></TimeZoneProvider>);

    const overview = group('Request overview');
    expect(value(overview, 'Description')).toHaveTextContent('Expand the customer portal.');
    expect(value(overview, 'Assessment type')).toHaveTextContent('Project');
    expect(value(overview, 'Division')).toHaveTextContent('Digital Services');
    expect(value(overview, 'Business unit')).toHaveTextContent('Customer Platforms');

    const business = group('Business context');
    expect(value(business, 'Business purpose')).toHaveTextContent('Serve customers online.');
    expect(value(business, 'Business criticality')).toHaveTextContent('High');
    expect(value(business, 'Third-party involvement')).toHaveTextContent('Yes');
    const thirdParty = value(business, 'Third-party details');
    expect(thirdParty.textContent).toBe('Hosting partner\nruns the platform.');
    expect(thirdParty).toHaveClass('whitespace-pre-wrap');
    const regulatory = value(business, 'Regulatory requirements');
    expect(regulatory).toHaveTextContent('Privacy Act 1988');
    expect(regulatory).toHaveClass('whitespace-pre-wrap');

    const scope = group('Scope and timing');
    expect(value(scope, 'Due date')).toHaveTextContent('30 Oct 2026');
    expect(value(scope, 'Information systems')).toHaveTextContent('Customer portal');
    expect(value(scope, 'Information assets')).toHaveTextContent('Customer data');
  });

  it('reads No for a request without third-party involvement', () => {
    render(<RequestContextDetails request={request({ thirdPartyInvolvement: false, thirdPartyDetails: null })} />);
    expect(value(group('Business context'), 'Third-party involvement')).toHaveTextContent('No');
  });

  it('says Not provided for a missing value and None selected for an empty list', () => {
    render(<RequestContextDetails request={request({
      description: null, assessmentType: null, division: '', thirdPartyDetails: null, regulatoryRequirements: null,
      dueDate: null, informationSystems: [], informationAssets: [],
    })} />);

    expect(value(group('Request overview'), 'Description')).toHaveTextContent('Not provided');
    expect(value(group('Request overview'), 'Assessment type')).toHaveTextContent('Not provided');
    expect(value(group('Request overview'), 'Division')).toHaveTextContent('Not provided');
    expect(value(group('Business context'), 'Third-party details')).toHaveTextContent('Not provided');
    expect(value(group('Business context'), 'Regulatory requirements')).toHaveTextContent('Not provided');
    expect(value(group('Scope and timing'), 'Due date')).toHaveTextContent('Not provided');
    expect(value(group('Scope and timing'), 'Information systems')).toHaveTextContent('None selected');
    expect(value(group('Scope and timing'), 'Information assets')).toHaveTextContent('None selected');
  });

  it('lists one system or asset name per line', () => {
    render(<RequestContextDetails request={request()} />);
    const systems = within(value(group('Scope and timing'), 'Information systems')).getAllByRole('listitem');
    expect(systems.map((item) => item.textContent)).toEqual(['Customer portal', 'Identity service']);
  });

  it('shows the submitted and updated instants as the viewer’s local date with no zone label', () => {
    render(<TimeZoneProvider zone="Australia/Brisbane"><RequestContextDetails request={request()} /></TimeZoneProvider>);
    const scope = group('Scope and timing');
    // 20:00 UTC on 27 September is the morning of 28 September in Brisbane.
    expect(value(scope, 'Submitted').textContent).toBe('28 Sept 2026');
    expect(value(scope, 'Last updated').textContent).toBe('28 Sept 2026');
    expect(scope).not.toHaveTextContent(/UTC/);
    // A calendar date has no zone: it stays the date that was chosen.
    expect(value(scope, 'Due date').textContent).toBe('30 Oct 2026');
  });

  it('omits Submitted for a request that has not been submitted', () => {
    render(<RequestContextDetails request={request({ requestStatus: 'draft', submittedDate: null })} />);
    expect(within(group('Scope and timing')).queryByText('Submitted', { selector: 'dt' })).not.toBeInTheDocument();
  });

  it('ends with the latest return-to-draft facts', () => {
    render(<RequestContextDetails request={request({
      requestStatus: 'draft', submittedDate: null, revertReason: 'Business unit was wrong.',
      revertedAt: '2026-09-03T04:55:00.000Z', revertedBy: { documentId: 'user-bob', displayName: 'Bob Doe' },
    })} />);
    const section = screen.getByRole('region', { name: 'Request context' });
    const revert = within(section).getByRole('heading', { name: 'Last returned to draft' });
    const scope = within(section).getByRole('heading', { level: 3, name: 'Scope and timing' });
    expect(scope.compareDocumentPosition(revert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(section).getByText('Business unit was wrong.')).toBeInTheDocument();
  });
});
