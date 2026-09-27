import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QuestionnaireRevisionTimeline } from './questionnaire-revision-timeline';
import type { QuestionnaireSummary } from './questionnaire-service';

const questionnaire: QuestionnaireSummary = {
  documentId: 'questionnaire-one', questionnaireNumber: 'QUES-001', title: 'Timeline test', state: 'draft',
  progress: { answered: 0, total: 2, percent: 0 }, assessmentRequest: { availability: 'available', documentId: 'request-one', requestNumber: 'RAR-001', title: 'Request', requestStatus: 'questionnaire-in-progress' }, updatedAt: '2026-09-01T00:00:00.000Z', release: { releasedAt: '2026-09-01T00:00:00.000Z', releasedBy: { documentId: 'analyst-1', displayName: 'Morgan Analyst' } },
  events: [
    { kind: 'released', at: '2026-09-01T00:00:00.000Z', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' } },
    { kind: 'returned-to-review', at: '2026-09-02T00:00:00.000Z', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, reason: 'x'.repeat(500) },
    { kind: 'question-edited', at: '2026-09-03T00:00:00.000Z', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, questionKey: 'hosting-region' },
    { kind: 'answer-cleared', at: '2026-09-03T00:00:00.000Z', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, questionKey: 'hosting-region', explanation: 'The available choices changed.' },
  ],
};

describe('QuestionnaireRevisionTimeline', () => {
  it('renders dated analyst detail with text labels and overflow-safe detail', () => {
    render(<QuestionnaireRevisionTimeline depth="detail" questionnaire={questionnaire} />);
    expect(screen.getByRole('region', { name: 'Questionnaire revision timeline' })).toBeInTheDocument();
    // The name sits beside a <time> element, so the paragraph's own text is
    // "by Morgan Analyst" rather than the bare name.
    expect(screen.getAllByText(/by Morgan Analyst$/)).toHaveLength(4);
    expect(screen.getByText(/Reason:/).parentElement).toHaveClass('[overflow-wrap:anywhere]');
    expect(document.querySelectorAll('time')).toHaveLength(4);
    expect(screen.getByText('Question edited')).toBeInTheDocument();
  });

  it('keeps the neutral actor wording when no display name is served and never shows a documentId', () => {
    // Strapi serves a null name for an actor it cannot name (unknown or inactive).
    const unnamed: QuestionnaireSummary = {
      ...questionnaire,
      events: [
        ...(questionnaire.events ?? []).slice(0, 2),
        { kind: 'question-edited', at: '2026-09-04T00:00:00.000Z', by: { documentId: 'analyst-2', displayName: null }, questionKey: 'hosting-region' },
        { kind: 'question-deleted', at: '2026-09-05T00:00:00.000Z', by: null, questionKey: 'hosting-region' },
      ],
    };
    render(<QuestionnaireRevisionTimeline depth="detail" questionnaire={unnamed} />);
    expect(screen.getAllByText(/by Morgan Analyst$/)).toHaveLength(2);
    expect(screen.getAllByText(/by An analyst$/)).toHaveLength(2);
    expect(document.querySelectorAll('time')).toHaveLength(4);
    expect(screen.queryByText(/analyst-2/)).not.toBeInTheDocument();
  });

  it('renders requestor summary without analyst-only detail and names required action', () => {
    render(<QuestionnaireRevisionTimeline depth="summary" questionnaire={questionnaire} />);
    expect(screen.getByText('Some answers need completing again before you re-submit.')).toBeInTheDocument();
    expect(screen.getByText('1 question added or changed')).toBeInTheDocument();
    expect(screen.queryByText(/Morgan Analyst/)).not.toBeInTheDocument();
    expect(screen.queryByText(/hosting-region/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reason:/)).not.toBeInTheDocument();
    expect(screen.getByText('The available choices changed.')).toBeInTheDocument();
  });

  it('renders the explicit empty state at both depths', () => {
    const empty = { ...questionnaire, events: [] };
    const view = render(<QuestionnaireRevisionTimeline depth="detail" questionnaire={empty} />);
    expect(screen.getByText('No revisions have been recorded.')).toBeInTheDocument();
    view.rerender(<QuestionnaireRevisionTimeline depth="summary" questionnaire={empty} />);
    expect(screen.getByText('No revisions have been recorded.')).toBeInTheDocument();
  });
});
