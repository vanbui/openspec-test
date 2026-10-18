import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/* UI-07: a spy that calls through, so every test reads the domain's real wording and one can see the bar ask for it. */
vi.mock('./ai-provenance-domain', async (importOriginal) => {
  const domain = await importOriginal<typeof import('./ai-provenance-domain')>();
  return { ...domain, outstandingProposalsLabel: vi.fn(domain.outstandingProposalsLabel) };
});

import { outstandingProposalsLabel } from './ai-provenance-domain';
import { AiReviewBar } from './ai-review-bar';

const provenance = { fields: [
  { field: 'issueStatement', state: 'proposed' as const, sources: [], by: null, at: null },
  { field: 'riskStatement', state: 'proposed' as const, sources: [], by: null, at: null },
  { field: 'riskType', state: 'proposed' as const, sources: null, by: null, at: null },
] };

describe('AiReviewBar', () => {
  it('sends one batch of unchanged fields and names the Risk', () => {
    const confirm = vi.fn();
    render(<AiReviewBar changedFields={new Set(['riskStatement'])} onConfirmRemaining={confirm} place={{ kind: 'risk', number: 'RSK-001' }} provenance={provenance} />);
    expect(screen.getByRole('group', { name: 'AI review for RSK-001' })).toHaveTextContent('2 AI-proposed fields to review');
    expect(screen.getByText(/1 without a source/)).toBeInTheDocument();
    expect(screen.getByText('Confirm remaining skips the 1 field you’ve changed. Save to record your edit.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remaining (2) on RSK-001' }));
    expect(confirm).toHaveBeenCalledWith(['issueStatement', 'riskType']);
  });

  /* Stage B S2 (direction §4 Buttons): Confirm remaining keeps the touch-target height up to 767px, small from 768px. */
  it('keeps Confirm remaining at the touch-target height below 768px', () => {
    render(<AiReviewBar changedFields={new Set()} onConfirmRemaining={vi.fn()} place={{ kind: 'risk', number: 'RSK-001' }} provenance={provenance} />);
    const confirm = screen.getByRole('button', { name: 'Confirm remaining (3) on RSK-001' });
    expect(confirm).toHaveClass('min-h-11', 'md:min-h-9');
    expect(confirm).not.toHaveClass('sm:min-h-9');
  });

  it('shows the completed status and no action when all proposals have been reviewed', () => {
    render(<AiReviewBar changedFields={new Set()} onConfirmRemaining={vi.fn()} place={{ kind: 'assessment' }} provenance={{ fields: provenance.fields.map((fact) => ({ ...fact, state: 'accepted' as const })) }} />);
    expect(screen.getByRole('group', { name: 'AI review for the assessment details' })).toHaveTextContent('All AI proposals reviewed');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('All AI proposals reviewed')).toHaveAttribute('tabindex', '-1');
  });

  /* 12-UI-SPEC Motion (walk D13(d)): the pending opacity applies without a transition. */
  it('takes the pending opacity without a transition while a decision is pending', () => {
    render(<AiReviewBar changedFields={new Set()} onConfirmRemaining={vi.fn()} pending place={{ kind: 'risk', number: 'RSK-001' }} provenance={provenance} />);
    const bar = screen.getByRole('group', { name: 'AI review for RSK-001' });
    expect(bar).toHaveAttribute('data-pending', 'true');
    expect(bar).toHaveClass('data-[pending=true]:opacity-60', 'data-[pending=true]:transition-none');
  });

  /*
   * 12-UI-SPEC §3.2 ("All d proposals are changed: no action; the caption"), walk D11: no count of zero shows above the
   * caption, which becomes the bar's status line, so focus after the last Confirm still has a place to land (§6.2).
   */
  it('does not call unsaved edits reviewed when every proposed field has changed, and shows no zero count', () => {
    render(<AiReviewBar changedFields={new Set(['issueStatement', 'riskStatement', 'riskType'])} onConfirmRemaining={vi.fn()} place={{ kind: 'risk', number: 'RSK-001' }} provenance={provenance} />);
    const bar = screen.getByRole('group', { name: 'AI review for RSK-001' });
    expect(bar).not.toHaveTextContent(/0 AI-proposed/);
    expect(bar).toHaveTextContent(/^Confirm remaining skips the 3 fields you’ve changed\. Save to record your edits\.$/);
    const status = bar.querySelector<HTMLElement>('[data-ai-review-status]');
    expect(status).toHaveTextContent('Confirm remaining skips the 3 fields you’ve changed. Save to record your edits.');
    expect(status).toHaveAttribute('tabindex', '-1');
    expect(bar.querySelectorAll('[data-ai-review-status]')).toHaveLength(1);
    expect(screen.queryByText('All AI proposals reviewed')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  /* UI-07 (AGENTS.md: no domain logic in JSX): the count line is the provenance domain's wording, which the header shares. */
  it('takes its count line from the provenance domain, which words one field or many (UI-07)', () => {
    vi.mocked(outstandingProposalsLabel).mockClear();
    render(<AiReviewBar changedFields={new Set()} onConfirmRemaining={vi.fn()} place={{ kind: 'risk', number: 'RSK-001' }} provenance={provenance} />);
    expect(outstandingProposalsLabel).toHaveBeenCalledWith(3);
    const status = screen.getByRole('group', { name: 'AI review for RSK-001' }).querySelector('[data-ai-review-status]');
    expect(status).toHaveTextContent(/^3 AI-proposed fields to review$/);
  });

  /*
   * UI-05 (direction §3.10; 12-UI-SPEC §3.2): `· {k} without a source` is a caption that follows the count line as its
   * sibling, in the caption style, rather than a weight override nested inside the count line's 500 weight.
   */
  it('sets the uncited count as a caption beside the count line, outside its weight (UI-05)', () => {
    render(<AiReviewBar changedFields={new Set()} onConfirmRemaining={vi.fn()} place={{ kind: 'risk', number: 'RSK-001' }} provenance={provenance} />);
    const status = screen.getByRole('group', { name: 'AI review for RSK-001' }).querySelector<HTMLElement>('[data-ai-review-status]');
    const caption = screen.getByText('· 2 without a source');
    expect(status).toHaveClass('font-medium');
    expect(status).not.toContainElement(caption);
    expect(caption.closest('.font-medium')).toBeNull();
    expect(caption).toHaveClass('text-xs', 'text-foreground-secondary');
    expect(caption).not.toHaveClass('font-normal');
    expect(caption.closest('.tabular-nums'), 'the caption’s count keeps tabular figures').not.toBeNull();
  });
});
