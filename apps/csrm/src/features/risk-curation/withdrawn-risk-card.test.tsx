import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WithdrawnRiskCard, type WithdrawnRisk } from './withdrawn-risk-card';

/*
 * 16-UI-SPEC §6.4 and X-27 (D-45, UI-D10): a withdrawn Risk is a collapsed, read-only card. Its reason, who withdrew it
 * and when are visible; its details are behind Show details; Reinstate risk is offered only while the assessment can
 * change; History is always offered.
 */
const statement = `Unsigned payment files are reconciled by hand before upload, ${'so a tampered file may reach the bank unnoticed. '.repeat(8)}End.`;
const risk: WithdrawnRisk = {
  documentId: 'risk-3',
  riskNumber: 'R-3',
  riskStatement: statement,
  residualRating: 'High',
  withdrawal: { at: '2026-10-14T03:00:00.000Z', by: { documentId: 'analyst-1', displayName: 'Bob Analyst' }, reason: 'Proposed under the wrong Risk Type' },
};

function renderCard(overrides: Partial<Parameters<typeof WithdrawnRiskCard>[0]> = {}) {
  const onReinstate = vi.fn();
  const onHistory = vi.fn();
  render(
    <WithdrawnRiskCard
      details={<section aria-label="Risk details"><p>Risk cause: manual reconciliation</p></section>}
      editable
      onHistory={onHistory}
      onReinstate={onReinstate}
      risk={risk}
      {...overrides}
    />,
  );
  return { card: document.getElementById('risk-risk-3')!, onHistory, onReinstate };
}

describe('WithdrawnRiskCard (§6.4, X-27)', () => {
  it('is a collapsed, read-only card with the badge, the residual rating, the clamped statement, the reason and who and when', () => {
    const { card } = renderCard();
    expect(card.tagName).toBe('ARTICLE');
    expect(card).toHaveAttribute('tabindex', '-1');
    expect(card).toHaveAttribute('data-risk-card');
    expect(card).toHaveClass('bg-surface', 'border', 'border-border', 'rounded-lg', 'p-4');
    expect(within(card).getByRole('heading', { level: 3, name: 'R-3' })).toBeInTheDocument();
    const badge = within(card).getByText('Withdrawn', { exact: true });
    expect(badge).toHaveAttribute('data-tone', 'neutral');
    expect(within(card).getByLabelText('Severity: high (3 of 4)')).toBeInTheDocument();
    const clamped = within(card).getByText(statement);
    expect(clamped).toHaveClass('line-clamp-2', '[overflow-wrap:anywhere]');
    expect(clamped.textContent).toBe(statement);
    expect(within(card).getByText('Reason: “Proposed under the wrong Risk Type”')).toHaveClass('[overflow-wrap:anywhere]');
    const byline = within(card).getByText(/^Withdrawn by Bob Analyst ·/);
    expect(byline.querySelector('time')).toHaveAttribute('dateTime', '2026-10-14T03:00:00.000Z');
    expect(within(card).queryByRole('textbox')).toBeNull();
    expect(within(card).queryByRole('combobox')).toBeNull();
    expect(within(card).queryByText('Risk cause: manual reconciliation')).toBeNull();
  });

  it('Show details toggles aria-expanded and reveals the read-only Risk in place', async () => {
    const user = userEvent.setup();
    const { card } = renderCard();
    const toggle = within(card).getByRole('button', { name: 'Show details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const region = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(card).toContainElement(region);
    await user.click(toggle);
    expect(within(card).getByRole('button', { name: 'Hide details' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(region).getByRole('region', { name: 'Risk details' })).toHaveTextContent('Risk cause: manual reconciliation');
    await user.click(within(card).getByRole('button', { name: 'Hide details' }));
    expect(within(card).queryByText('Risk cause: manual reconciliation')).toBeNull();
  });

  it('offers Reinstate risk only while the assessment can change, and History always, each named for the risk', async () => {
    const user = userEvent.setup();
    const { card, onHistory, onReinstate } = renderCard();
    const reinstate = within(card).getByRole('button', { name: 'Reinstate risk R-3' });
    expect(reinstate).toHaveTextContent('Reinstate risk');
    await user.click(reinstate);
    expect(onReinstate).toHaveBeenCalledWith(reinstate);
    const history = within(card).getByRole('button', { name: 'History of R-3' });
    await user.click(history);
    expect(onHistory).toHaveBeenCalledWith(history);
    expect(within(card).getAllByRole('button').map((button) => button.textContent)).toEqual(['Reinstate risk', 'History', 'Show details']);
  });

  it('after release, keeps History and Show details and offers no Reinstate risk', () => {
    const { card } = renderCard({ editable: false });
    expect(within(card).queryByRole('button', { name: /Reinstate/ })).toBeNull();
    expect(within(card).getAllByRole('button').map((button) => button.textContent)).toEqual(['History', 'Show details']);
  });

  it('shows the reinstate form under its header, and its pending state at the pending opacity', () => {
    renderCard({ form: <form aria-label="Reinstate R-3" />, pending: true, reinstateOpen: true });
    const card = document.getElementById('risk-risk-3')!;
    expect(within(card).getByRole('form', { name: 'Reinstate R-3' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Reinstate risk R-3' })).toHaveAttribute('aria-expanded', 'true');
    expect(card).toHaveAttribute('data-pending', 'true');
    expect(card).toHaveClass('data-[pending=true]:opacity-60', 'data-[pending=true]:transition-none');
  });

  it('names a person CSRM can no longer read as a Security Analyst, and leaves out a missing rating and statement', () => {
    renderCard({ risk: { ...risk, residualRating: null, riskStatement: null, withdrawal: { ...risk.withdrawal, by: null } } });
    const card = document.getElementById('risk-risk-3')!;
    expect(within(card).getByText(/^Withdrawn by a Security Analyst ·/)).toBeInTheDocument();
    expect(within(card).queryByLabelText(/^Severity:/)).toBeNull();
  });

  it('separates the card’s blocks by 16px, as the Spacing table asks (UI-03)', () => {
    const { card } = renderCard();
    expect(card).toHaveClass('grid', 'gap-4');
    expect(card).not.toHaveClass('gap-3');
  });

  it('carries no destructive styling, and its actions do not print', () => {
    const { card } = renderCard();
    expect(card.querySelector('[data-variant="destructive"], .bg-destructive, .text-destructive')).toBeNull();
    for (const button of within(card).getAllByRole('button')) expect(button.closest('[data-print="hidden"]')).not.toBeNull();
  });
});
