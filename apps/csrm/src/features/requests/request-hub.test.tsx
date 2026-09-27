import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CsrmAssessmentRequest, RequestLifecycle } from './request-domain';
import { requestLifecycleStepKeys } from './request-domain';
import { RequestHub } from './request-hub';

const lifecycle: RequestLifecycle = {
  currentKey: 'questionnaire-released', currentLabel: 'Questionnaire released', terminal: false,
  nextAction: { actor: 'requestor', summary: 'Answer and submit the questionnaire.', href: '/app/questionnaires/q-1' },
  steps: requestLifecycleStepKeys.map((key, index) => ({ key, label: key, state: index < 3 ? 'completed' : index === 3 ? 'current' : 'future' })),
};

function request(overrides: Partial<CsrmAssessmentRequest> = {}): CsrmAssessmentRequest {
  return {
    documentId: 'request-1', requestNumber: 'RAR-001', title: 'Portal assessment', description: null,
    assessmentType: 'Project', businessCriticality: 'High', requestStatus: 'questionnaire-in-progress',
    submittedDate: '2026-09-01T00:00:00.000Z', dueDate: '2026-10-01', updatedAt: null,
    dueDateLabel: '1 Oct 2026', updatedDateLabel: null, requestorName: 'Jane Doe',
    informationSystems: [{ documentId: 'system-1', name: 'Customer portal' }],
    informationAssets: [{ documentId: 'asset-1', name: 'Customer data' }], questionnaire: null, assessment: null,
    relationships: {
      questionnaire: { availability: 'available', documentId: 'q-1', questionnaireNumber: 'QUES-001', title: 'Portal questionnaire', state: 'released' },
      assessment: { availability: 'available', documentId: 'a-1', assessmentNumber: 'ASM-001', assessmentStatus: 'in-review', controlImplementationCount: 3, residualRiskCounts: { Low: 1, Moderate: 2, High: 3, Critical: 4, total: 10 } },
    },
    ...overrides,
  };
}

const hrefs = { questionnaire: '/app/questionnaires/q-1', assessment: '/app/assessments/a-1' };

describe('RequestHub', () => {
  it('renders all six available summaries with only the supplied record destinations', () => {
    render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request()} />);
    expect(screen.getByText('Next action:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Answer and submit the questionnaire.' })).toHaveAttribute('href', '/app/questionnaires/q-1');
    for (const [heading, text] of [['Questionnaire', 'QUES-001'], ['Assessment', 'ASM-001'], ['Risks', 'High: 3'], ['Controls', '3 control implementations.'], ['Information systems', 'Customer portal'], ['Information assets', 'Customer data']] as const) {
      expect(within(screen.getByRole('heading', { name: heading }).closest('article')!).getByText(text)).toBeInTheDocument();
    }
    // A record opens from its identifier, never from a separate Open control.
    expect(screen.getByRole('link', { name: 'QUES-001' })).toHaveAttribute('href', '/app/questionnaires/q-1');
    expect(screen.getByRole('link', { name: 'ASM-001' })).toHaveAttribute('href', '/app/assessments/a-1');
    expect(screen.queryByRole('link', { name: /^Open (questionnaire|assessment)$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open identified risks' })).toHaveAttribute('href', '/app/assessments/a-1');
    expect(screen.getByRole('link', { name: 'Open controls' })).toHaveAttribute('href', '/app/assessments/a-1');
    // The tally names what it counts and labels every rating, zeros included.
    expect(screen.getByText('Contextual Risks by residual rating.')).toBeInTheDocument();
    const counts = { Low: 1, Moderate: 2, High: 3, Critical: 4 } as const;
    for (const rating of ['Low', 'Moderate', 'High', 'Critical'] as const) {
      expect(screen.getByText(new RegExp(`^${rating}:`))).toBeInTheDocument();
      expect(screen.getByLabelText(`${rating} residual contextual risks: ${counts[rating]}`)).toBeInTheDocument();
    }
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('labels the assessment tile status from the shared mapping, so a released assessment reads Released', () => {
    const view = render(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request()} />);
    expect(screen.getByText('Status: In review.')).toBeInTheDocument();

    const released = request();
    const relationships = released.relationships!;
    view.rerender(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={{ ...released, relationships: { ...relationships, assessment: { ...relationships.assessment, assessmentStatus: 'approved' } as typeof relationships.assessment } }} />);
    expect(screen.getByText('Status: Released.')).toBeInTheDocument();
    expect(screen.queryByText(/Approved/)).not.toBeInTheDocument();
  });

  it('states absent records and entirely omits unavailable records', () => {
    const absent = request({ relationships: { questionnaire: { availability: 'absent' }, assessment: { availability: 'absent' } }, informationSystems: [], informationAssets: [] });
    const view = render(<RequestHub hrefs={{}} lifecycle={lifecycle} request={absent} />);
    // An absent record contributes no identifier and no destination.
    expect(screen.queryByRole('link', { name: /^(QUES|ASM)-/ })).not.toBeInTheDocument();
    expect(screen.getByText('No questionnaire is linked to this request.')).toBeInTheDocument();
    expect(screen.getByText('No assessment exists for this request.')).toBeInTheDocument();
    expect(screen.getByText('No information systems are selected.')).toBeInTheDocument();
    expect(screen.getByText('No information assets are selected.')).toBeInTheDocument();
    view.rerender(<RequestHub hrefs={hrefs} lifecycle={lifecycle} request={request({ relationships: { questionnaire: { availability: 'unavailable' }, assessment: { availability: 'unavailable' } } })} />);
    for (const heading of ['Questionnaire', 'Assessment', 'Risks', 'Controls']) expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument();
    // An unavailable record leaves no trace at all, because its existence is
    // itself protected: no identifier, linked or otherwise.
    expect(view.container.textContent).not.toMatch(/QUES-001|ASM-001/);
  });

  it('adds only governance wording for the analyst view and does not infer an action link', () => {
    const view = render(<RequestHub hrefs={hrefs} lifecycle={{ ...lifecycle, nextAction: { actor: 'analyst', summary: 'The work is waiting with the other party.' } }} request={request()} />);
    expect(screen.getByText('Questionnaire state: released.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'The work is waiting with the other party.' })).not.toBeInTheDocument();
    view.rerender(<RequestHub governanceDetail hrefs={hrefs} lifecycle={lifecycle} request={request()} />);
    expect(screen.getByText('Governance state: released.')).toBeInTheDocument();
    expect(screen.queryByText('Questionnaire state: released.')).not.toBeInTheDocument();
  });
});
