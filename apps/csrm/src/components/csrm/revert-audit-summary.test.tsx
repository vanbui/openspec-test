/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TimeZoneProvider } from './local-time';
import { RevertAuditSummary, type RevertAuditFacts } from './revert-audit-summary';

const facts: RevertAuditFacts = {
  revertReason: 'The hosting answers need another look.',
  revertedAt: '2026-09-27T05:47:00.000Z',
  revertedBy: { documentId: 'analyst-document-id', displayName: 'Morgan Analyst' },
};

const normalised = (value: string | null | undefined) => value?.replace(/\s/g, ' ');

/** The `dd` that follows the `dt` with this label. */
function valueFor(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: 'dt' });
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement)) throw new Error(`NO_VALUE:${label}`);
  return value;
}

describe('RevertAuditSummary', () => {
  it('shows when the record was returned in the viewer’s zone', () => {
    render(<TimeZoneProvider zone="Australia/Brisbane"><RevertAuditSummary facts={facts} /></TimeZoneProvider>);
    const time = valueFor('When').querySelector('time');
    expect(time).toHaveAttribute('dateTime', '2026-09-27T05:47:00.000Z');
    expect(normalised(time?.textContent)).toBe('27 Sept 2026, 3:47 pm');
  });

  it('labels the time UTC while the viewer’s zone is unknown', () => {
    render(<RevertAuditSummary facts={facts} />);
    expect(normalised(valueFor('When').querySelector('time')?.textContent)).toBe('27 Sept 2026, 5:47 am UTC');
  });

  it('names the analyst by display name', () => {
    render(<RevertAuditSummary facts={facts} />);
    expect(valueFor('By')).toHaveTextContent('Morgan Analyst');
  });

  it('never shows a document id as a name', () => {
    const { container } = render(
      <RevertAuditSummary facts={{ ...facts, revertedBy: { documentId: 'analyst-document-id', displayName: null } }} />,
    );
    expect(valueFor('By')).toHaveTextContent('Not recorded');
    expect(screen.queryByText(/analyst-document-id/)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('analyst-document-id');
  });

  it('says Not recorded when the time is missing', () => {
    render(<RevertAuditSummary facts={{ ...facts, revertedAt: null }} />);
    const when = valueFor('When');
    expect(when).toHaveTextContent('Not recorded');
    expect(when.querySelector('time')).toBeNull();
  });

  it('renders nothing without a reason', () => {
    const { container } = render(<RevertAuditSummary facts={{ ...facts, revertReason: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
