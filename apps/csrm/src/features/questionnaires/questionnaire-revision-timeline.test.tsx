import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TimeZoneProvider } from '@/components/csrm/local-time';

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
    expect(screen.getByText('1 change to the questions')).toBeInTheDocument();
    expect(screen.queryByText(/question added or changed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Morgan Analyst/)).not.toBeInTheDocument();
    expect(screen.queryByText(/hosting-region/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reason:/)).not.toBeInTheDocument();
    expect(screen.getByText('The available choices changed.')).toBeInTheDocument();
  });

  const by = { documentId: 'analyst-1', displayName: 'Morgan Analyst' };
  const summaryItems = () => screen.getAllByRole('listitem').map((item) => item.querySelector('p.font-medium')?.textContent);

  it('counts the Requestor’s history per release round, newest first, with a neutral change icon (UI-SPEC §4.3)', () => {
    const rounds: QuestionnaireSummary = {
      ...questionnaire,
      events: [
        { kind: 'question-added', at: '2026-08-30T00:00:00.000Z', by, questionKey: 'before-release' },
        { kind: 'released', at: '2026-09-01T00:00:00.000Z', by },
        { kind: 'returned-to-review', at: '2026-09-02T00:00:00.000Z', by, reason: 'Clarify the hosting question.' },
        { kind: 'question-edited', at: '2026-09-03T00:00:00.000Z', by, questionKey: 'hosting-region' },
        { kind: 'question-deleted', at: '2026-09-04T00:00:00.000Z', by, questionKey: 'legacy-question' },
        { kind: 'released', at: '2026-09-05T00:00:00.000Z', by },
        { kind: 'returned-to-review', at: '2026-09-06T00:00:00.000Z', by },
        { kind: 'question-added', at: '2026-09-07T00:00:00.000Z', by, questionKey: 'data-residency' },
        { kind: 'released', at: '2026-09-08T00:00:00.000Z', by },
      ],
    };
    render(<QuestionnaireRevisionTimeline depth="summary" questionnaire={rounds} />);
    expect(summaryItems()).toEqual([
      'Questionnaire made available to you',
      '1 change to the questions',
      'Questionnaire taken back for analyst review',
      'Questionnaire made available to you',
      '2 changes to the questions',
      'Questionnaire taken back for analyst review',
      'Questionnaire made available to you',
    ]);
    // Each round is dated by its latest change.
    const roundTimes = screen.getAllByText(/changes? to the questions$/).map((label) => label.closest('li')?.querySelector('time')?.getAttribute('dateTime'));
    expect(roundTimes).toEqual(['2026-09-07T00:00:00.000Z', '2026-09-04T00:00:00.000Z']);
    // A round that ends with a removal still reads as a change, never with the bin.
    for (const label of screen.getAllByText(/changes? to the questions$/)) {
      expect(label.closest('li')?.querySelector('svg')).toHaveClass('lucide-file-pen-line');
    }
    expect(document.querySelector('.lucide-trash2, .lucide-trash-2')).toBeNull();
    // No question key, no analyst name, no reason.
    for (const hidden of [/Morgan Analyst/, /hosting-region|legacy-question|data-residency|before-release/, /Clarify the hosting question/]) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
    }
  });

  it('lists no question changes made before the first release', () => {
    const unreleasedChanges: QuestionnaireSummary = {
      ...questionnaire,
      events: [
        { kind: 'question-added', at: '2026-08-29T00:00:00.000Z', by, questionKey: 'service-name' },
        { kind: 'question-edited', at: '2026-08-30T00:00:00.000Z', by, questionKey: 'service-name' },
        { kind: 'released', at: '2026-09-01T00:00:00.000Z', by },
      ],
    };
    render(<QuestionnaireRevisionTimeline depth="summary" questionnaire={unreleasedChanges} />);
    expect(summaryItems()).toEqual(['Questionnaire made available to you']);
    expect(screen.queryByText(/to the questions$/)).not.toBeInTheDocument();
  });

  it('shows each detail entry’s time in the viewer’s zone', () => {
    const local: QuestionnaireSummary = {
      ...questionnaire,
      events: [{ kind: 'question-edited', at: '2026-09-03T05:47:00.000Z', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, questionKey: 'hosting-region' }],
    };
    render(<TimeZoneProvider zone="Australia/Brisbane"><QuestionnaireRevisionTimeline depth="detail" questionnaire={local} /></TimeZoneProvider>);
    const time = document.querySelector('time');
    expect(time).toHaveAttribute('dateTime', '2026-09-03T05:47:00.000Z');
    expect(time?.textContent?.replace(/\s/g, ' ')).toBe('3 Sept 2026, 3:47 pm');
  });

  it('names a question by its text and never by its key (UI-SPEC §4.2)', () => {
    const named: QuestionnaireSummary = {
      ...questionnaire,
      events: [{ kind: 'question-edited', at: '2026-09-03T00:00:00.000Z', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, questionKey: 'hosting-region', questionText: 'Where will the service be hosted?' }],
    };
    render(<QuestionnaireRevisionTimeline depth="detail" questionnaire={named} />);
    const line = screen.getByText('Where will the service be hosted?');
    expect(line).toHaveTextContent('Question: Where will the service be hosted?');
    expect(line).toHaveClass('[overflow-wrap:anywhere]');
    expect(screen.queryByText(/hosting-region/)).not.toBeInTheDocument();
  });

  it('reads a question it cannot name as a question from an earlier version (UI-SPEC §4.2)', () => {
    const unnamed: QuestionnaireSummary = {
      ...questionnaire,
      events: [{ kind: 'question-deleted', at: '2026-09-03T00:00:00.000Z', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, questionKey: 'hosting-region' }],
    };
    render(<QuestionnaireRevisionTimeline depth="detail" questionnaire={unnamed} />);
    const value = screen.getByText('A question from an earlier version');
    expect(value).toHaveClass('text-foreground-secondary');
    expect(value.closest('p')).toHaveTextContent('Question: A question from an earlier version');
    expect(value.closest('p')).toHaveClass('[overflow-wrap:anywhere]');
    expect(screen.queryByText(/hosting-region/)).not.toBeInTheDocument();
  });

  it('shows no question line on an event that concerns no question', () => {
    const released: QuestionnaireSummary = { ...questionnaire, events: [(questionnaire.events ?? [])[0]!] };
    render(<QuestionnaireRevisionTimeline depth="detail" questionnaire={released} />);
    expect(screen.queryByText(/Question:/)).not.toBeInTheDocument();
  });

  const replacedDetail = 'A newly generated questionnaire replaced 12 questions. 2 analyst changes were discarded.';

  it('shows a replacement to the analyst as Questionnaire replaced with its detail (UI-SPEC §3.4)', () => {
    const replaced: QuestionnaireSummary = {
      ...questionnaire,
      events: [{ kind: 'regenerated', at: '2026-09-03T00:00:00.000Z', by, explanation: replacedDetail }],
    };
    render(<QuestionnaireRevisionTimeline depth="detail" questionnaire={replaced} />);
    const label = screen.getByText('Questionnaire replaced');
    const entry = label.closest('li');
    expect(entry?.querySelector('svg')).toHaveClass('lucide-sparkles');
    expect(entry?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(entry).toHaveTextContent(`Detail: ${replacedDetail}`);
    expect(entry).toHaveTextContent(/by Morgan Analyst$/);
    expect(screen.queryByText(/Question:/)).not.toBeInTheDocument();
  });

  it('shows the Requestor a replacement only after the first release, without detail, and restarts the round count (UI-SPEC §4.3)', () => {
    const replacedRounds: QuestionnaireSummary = {
      ...questionnaire,
      events: [
        // Before the first release the Requestor never saw the replaced version.
        { kind: 'regenerated', at: '2026-08-30T00:00:00.000Z', by, explanation: replacedDetail },
        { kind: 'released', at: '2026-09-01T00:00:00.000Z', by },
        { kind: 'returned-to-review', at: '2026-09-02T00:00:00.000Z', by, reason: 'Generate it again.' },
        // Discarded by the replacement that follows, so not counted.
        { kind: 'question-edited', at: '2026-09-03T00:00:00.000Z', by, questionKey: 'hosting-region' },
        { kind: 'question-deleted', at: '2026-09-03T01:00:00.000Z', by, questionKey: 'legacy-question' },
        { kind: 'regenerated', at: '2026-09-04T00:00:00.000Z', by, explanation: replacedDetail },
        { kind: 'question-added', at: '2026-09-05T00:00:00.000Z', by, questionKey: 'data-residency' },
        { kind: 'released', at: '2026-09-06T00:00:00.000Z', by },
      ],
    };
    render(<QuestionnaireRevisionTimeline depth="summary" questionnaire={replacedRounds} />);
    expect(summaryItems()).toEqual([
      'Questionnaire made available to you',
      '1 change to the questions',
      'Questionnaire replaced',
      'Questionnaire taken back for analyst review',
      'Questionnaire made available to you',
    ]);
    const replacedEntry = screen.getByText('Questionnaire replaced').closest('li');
    expect(replacedEntry?.querySelector('svg')).toHaveClass('lucide-sparkles');
    expect(replacedEntry?.querySelector('time')).toHaveAttribute('dateTime', '2026-09-04T00:00:00.000Z');
    expect(screen.queryByText(/newly generated questionnaire/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Detail:/)).not.toBeInTheDocument();
  });

  it('renders the explicit empty state at both depths', () => {
    const empty = { ...questionnaire, events: [] };
    const view = render(<QuestionnaireRevisionTimeline depth="detail" questionnaire={empty} />);
    expect(screen.getByText('No revisions have been recorded.')).toBeInTheDocument();
    view.rerender(<QuestionnaireRevisionTimeline depth="summary" questionnaire={empty} />);
    expect(screen.getByText('No revisions have been recorded.')).toBeInTheDocument();
  });
});
