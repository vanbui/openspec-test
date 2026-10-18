import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReportTable, type ReportTableRowData } from './report-table';

/*
 * X-10 and UI-SPEC §8.1: a report table's figure above zero opens the records it counts, with the
 * record-link treatment on the figure alone; a zero is plain text; a row header may open the records
 * its row describes. Each link's name begins with what it shows. A row with no links renders as before.
 */

function renderTable(rows: readonly ReportTableRowData[], columns: readonly string[] = ['Risks']) {
  render(<ReportTable caption="Due state" columns={columns} rowHeader="Due state" rows={rows} />);
  return screen.getByRole('table', { name: 'Due state' });
}

describe('ReportTable figure links', () => {
  it('renders a non-zero figure with a cell link as a record link named by the cell, right-aligned with tabular figures', () => {
    const table = renderTable([
      { key: 'later', label: 'Due later', values: [1_204], cells: [{ href: '/app/risks?dueState=later', accessibleName: '1,204 Risks: Due later' }] },
    ]);

    const link = within(table).getByRole('link', { name: '1,204 Risks: Due later' });
    expect(link).toHaveAttribute('href', '/app/risks?dueState=later');
    expect(link).toHaveClass('record-link');
    // The link wraps the figure alone, so the visible text is the figure and the name begins with it (WCAG 2.5.3).
    expect(link).toHaveTextContent(/^1,204$/);
    const cell = link.closest('td');
    expect(cell).toHaveClass('text-right', 'tabular-nums');
  });

  it('keeps a zero figure plain even when its cell carries a link', () => {
    const table = renderTable([
      { key: 'later', label: 'Due later', values: [0], cells: [{ href: '/app/risks?dueState=later', accessibleName: '0 Risks: Due later' }] },
    ]);

    expect(within(table).queryByRole('link')).not.toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '0' })).toBeInTheDocument();
  });

  it('keeps a figure plain when its position has no link, beside a linked figure in the same row', () => {
    const table = renderTable([
      {
        key: 'system-1',
        label: 'Alpha system',
        values: [1, 2, 3],
        cells: [
          { href: '/app/risks?system=system-1&residualRating=Critical&state=open&stage=released', accessibleName: '1 Risk: Alpha system, Critical' },
          { href: '/app/risks?system=system-1&residualRating=High&state=open&stage=released', accessibleName: '2 Risks: Alpha system, High' },
          null,
        ],
      },
    ], ['Critical', 'High', 'Total']);

    expect(within(table).getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual(['1 Risk: Alpha system, Critical', '2 Risks: Alpha system, High']);
    // A sum beside its linked parts stays plain (D-37).
    expect(within(within(table).getByRole('cell', { name: '3' })).queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a row header with a link as a record link named by the header', () => {
    const table = renderTable([
      {
        key: 'existing',
        label: 'Existing',
        values: [4],
        header: { href: '/app/risks?mitigationStatus=Existing&state=open', accessibleName: 'Existing: view the Risks with Existing mitigation controls' },
      },
    ], ['Mitigation controls']);

    const rowHeader = within(table).getByRole('rowheader');
    const link = within(rowHeader).getByRole('link', { name: 'Existing: view the Risks with Existing mitigation controls' });
    expect(link).toHaveAttribute('href', '/app/risks?mitigationStatus=Existing&state=open');
    expect(link).toHaveClass('record-link');
    expect(link).toHaveTextContent(/^Existing$/);
    // The figure stays plain: a count of mitigation controls never poses as an equal list (D-36).
    expect(within(table).getAllByRole('link')).toHaveLength(1);
  });

  it('renders a row with neither header nor cell links exactly as before, with no link', () => {
    const table = renderTable([{ key: 'overdue', label: 'Overdue', values: [2] }]);

    expect(within(table).queryByRole('link')).not.toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Overdue' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '2' })).toBeInTheDocument();
  });
});
