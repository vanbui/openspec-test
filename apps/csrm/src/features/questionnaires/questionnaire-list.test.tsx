import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionnaireList } from './questionnaire-list';
import type { QuestionnaireSummary } from './questionnaire-service';

const replace = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/questionnaires',
  useRouter: () => ({ replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('view=cards'),
}));

const questionnaire: QuestionnaireSummary = {
  assessmentRequest: { availability: 'available', documentId: 'request-one', requestNumber: 'RAR-2026-X7K4Q2', requestStatus: 'questionnaire-in-progress', title: 'Customer portal review' },
  documentId: 'questionnaire-one',
  progress: { answered: 3, percent: 60, total: 5 },
  questionnaireNumber: 'QUES-DEV-001',
  state: 'draft',
  title: 'Service security questionnaire',
  updatedAt: '2026-08-29T10:00:00.000Z',
};

describe('QuestionnaireList', () => {
  it('uses RecordLink in the first table column and native footer pagination', () => {
    render(<QuestionnaireList questionnaires={[questionnaire]} pagination={{ page: 1, pageCount: 2, pageSize: 25, total: 26 }} query={{ page: 1, pageSize: 25, sort: 'updatedAt:desc' }} />);

    const table = screen.getByRole('table', { name: 'My questionnaires' });
    expect(table.querySelector('tbody tr td a')).toHaveTextContent('QUES-DEV-001');
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(replace).toHaveBeenLastCalledWith('/app/questionnaires?view=cards&sort=updatedAt%3Adesc&page=2&pageSize=25', { scroll: false });
  });

  it('uses shared collection state slots', () => {
    const view = render(<QuestionnaireList questionnaires={[]} state="empty" />);
    expect(screen.getByRole('heading', { name: 'No questionnaires yet' })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="state"]')).toHaveAttribute('data-state-kind', 'empty');

    view.rerender(<QuestionnaireList questionnaires={[]} state="error" />);
    expect(document.querySelector('[data-slot="state"]')).toHaveAttribute('data-state-kind', 'error');
  });
});
