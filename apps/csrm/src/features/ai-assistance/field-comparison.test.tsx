import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { changedFieldsToggleLabel, compareFields, wordDiff, WORD_DIFF_MAX_LENGTH } from './field-comparison-domain';
import { FieldComparison } from './field-comparison';

const rows = [
  { label: 'Question', current: 'Where is data stored?', proposed: 'Where is the data stored and backed up?' },
  { label: 'Help text', current: 'None', proposed: 'Name every region.' },
  { label: 'Answer type', current: 'Single select', proposed: 'Single select' },
  { label: 'Choices', current: 'Australia', proposed: 'Australia' },
  { label: 'Required', current: 'Yes', proposed: 'Yes' },
];

describe('compareFields (X-24)', () => {
  it('marks the rows whose values differ', () => {
    expect(compareFields(rows).map((row) => [row.label, row.changed])).toEqual([
      ['Question', true], ['Help text', true], ['Answer type', false], ['Choices', false], ['Required', false],
    ]);
  });

  it('is zod-free and React-free', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/ai-assistance/field-comparison-domain.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"](zod|react)['"]/);
  });
});

describe('FieldComparison (X-24)', () => {
  it('from 768px, a table with a hidden caption, Current and Proposed columns and Changed notes on changed rows', () => {
    render(<FieldComparison caption="Proposed change to Where is data stored?" density="comfortable" rows={compareFields(rows)} />);
    const table = screen.getByRole('table', { name: 'Proposed change to Where is data stored?' });
    expect(table.closest('[data-comparison-layout="table"]')).toHaveClass('hidden', 'md:block');
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Field', 'Current', 'Proposed']);
    for (const header of headers) expect(header).toHaveAttribute('scope', 'col');
    const question = within(table).getByRole('rowheader', { name: /Question/ });
    expect(question).toHaveAccessibleName('Question');
    expect(question.closest('tr')).toHaveTextContent('Changed');
    expect(within(table).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['Question', 'Help text']);
  });

  it('below 768px, each field stacks its current value above its proposed value', () => {
    const { container } = render(<FieldComparison caption="Proposed change" density="comfortable" rows={compareFields(rows)} />);
    const stacked = container.querySelector('[data-comparison-layout="stacked"]');
    expect(stacked).toHaveClass('md:hidden');
    const first = stacked!.querySelector('li');
    expect([...first!.querySelectorAll('.micro-label')].map((label) => label.textContent)).toEqual(['Question', 'Changed', 'Current', 'Proposed']);
  });

  it('collapses unchanged rows behind a count and shows them on request', () => {
    render(<FieldComparison caption="Proposed change" density="comfortable" rows={compareFields(rows)} />);
    const toggles = screen.getAllByRole('button', { name: 'Show 3 unchanged fields' });
    expect(within(screen.getByRole('table')).queryByText('Single select')).toBeNull();
    fireEvent.click(toggles[0]!);
    expect(within(screen.getByRole('table')).getAllByText('Single select')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Hide unchanged fields' }).length).toBeGreaterThan(0);
  });

  it('names one unchanged field in the singular, and renders values as text with their line breaks', () => {
    render(<FieldComparison caption="Proposed change" density="compact" rows={compareFields([rows[0]!, { label: 'Help text', current: '<b>x</b>\nsecond line', proposed: '<b>x</b>\nsecond line' }])} />);
    expect(screen.getAllByRole('button', { name: 'Show 1 unchanged field' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Show 1 unchanged field' })[0]!);
    expect(document.querySelector('b')).toBeNull();
  });
});

/*
 * Phase 16 (16-UI-SPEC §4.3, §8.3, X-28, X-29; D-36, D-46, UI-D21): the same comparison, extended rather than forked.
 * Custom column labels, a `tbody` per change with a spanning decision cell under a visually hidden header, `Same` rows,
 * stacked cards below 768px and changed-word marks bounded at 2,000 characters. The cases above stay as they are.
 */
const statementRow = { label: 'Risk statement', current: 'Unsigned files are reconciled by hand', proposed: 'Unsigned payment files are reconciled by hand before upload' };
const ratingGroups = [
  {
    key: 'u-risk-statement',
    label: 'Risk statement',
    rows: compareFields([statementRow]),
    decision: <div><button type="button">Confirm: Risk statement on R-3</button><button type="button">Reject: Risk statement on R-3</button></div>,
  },
  {
    key: 'u-residual-rating',
    label: 'Residual rating',
    rows: compareFields([
      { label: 'Residual likelihood', current: 'Likely', proposed: 'Possible' },
      { label: 'Highest residual consequence', current: 'Major', proposed: 'Major' },
      { label: 'Residual rating', current: 'High', proposed: 'Moderate' },
    ]),
    decision: <button type="button">Confirm: Residual rating on R-3</button>,
  },
];

describe('FieldComparison, extended for decisions and history (X-28, X-29)', () => {
  it('reads the column labels it is given, in the table and the stacked layout', () => {
    const { container } = render(<FieldComparison caption="Changes to R-3" columns={{ before: 'Before', after: 'After' }} density="comfortable" rows={compareFields([statementRow])} />);
    const table = screen.getByRole('table', { name: 'Changes to R-3' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Field', 'Before', 'After']);
    const stacked = container.querySelector('[data-comparison-layout="stacked"]')!;
    expect([...stacked.querySelectorAll('.micro-label')].map((label) => label.textContent)).toEqual(['Risk statement', 'Changed', 'Before', 'After']);
  });

  it('renders one tbody per change whose decision cell spans its rows under a visually hidden Decision header', () => {
    render(<FieldComparison caption="AI changes proposed for R-3" density="comfortable" groups={ratingGroups} />);
    const table = screen.getByRole('table', { name: 'AI changes proposed for R-3' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Field', 'Current', 'Proposed', 'Decision']);
    expect(headers[3]!.querySelector('.sr-only')).toHaveTextContent('Decision');
    const bodies = table.querySelectorAll('tbody');
    expect(bodies).toHaveLength(2);
    const residual = bodies[1]!;
    expect(within(residual).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['Residual likelihood', 'Residual rating']);
    const decision = within(residual).getByRole('button', { name: 'Confirm: Residual rating on R-3' }).closest('td')!;
    expect(decision).toHaveAttribute('rowSpan', '2');
    expect(decision).toHaveClass('align-top');
    expect(residual.querySelectorAll('td[rowspan]')).toHaveLength(1);
    expect(within(bodies[0]!).getByRole('button', { name: 'Confirm: Risk statement on R-3' }).closest('td')).toHaveAttribute('rowSpan', '1');
  });

  it('has no decision column when no change carries a decision (history)', () => {
    render(<FieldComparison caption="Changes" columns={{ before: 'Before', after: 'After' }} density="comfortable" groups={[{ key: 'e-1', label: 'Risk changed', rows: compareFields([statementRow]) }]} />);
    expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Field', 'Before', 'After']);
  });

  it('with showSame, lists every row and reads Same in place of Changed on a matching one', () => {
    render(<FieldComparison caption="Compare with R-2" columns={{ before: 'R-2', after: 'Proposed' }} density="comfortable" rows={compareFields(rows)} showSame />);
    const table = screen.getByRole('table', { name: 'Compare with R-2' });
    expect(within(table).getAllByRole('rowheader')).toHaveLength(5);
    const answerType = within(table).getByRole('rowheader', { name: 'Answer type' }).closest('tr')!;
    expect(answerType).toHaveTextContent('Same');
    expect(answerType).not.toHaveTextContent('Changed');
    expect(answerType.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(within(table).getByRole('rowheader', { name: 'Question' }).closest('tr')).toHaveTextContent('Changed');
    expect(screen.queryByRole('button', { name: /unchanged/ })).toBeNull();
  });

  it('with emphasis, marks inserted words with ins and removed words with del', () => {
    render(<FieldComparison caption="Changes" density="comfortable" emphasis rows={compareFields([{ label: 'Risk statement', current: 'Files are reconciled by hand', proposed: 'Payment files are reconciled before upload' }])} />);
    const table = screen.getByRole('table');
    const [current, proposed] = within(table).getAllByRole('cell');
    expect([...current!.querySelectorAll('del')].map((node) => node.textContent)).toEqual(['Files', 'by hand']);
    expect(current!.querySelector('ins')).toBeNull();
    expect([...proposed!.querySelectorAll('ins')].map((node) => node.textContent)).toEqual(['Payment files', 'before upload']);
    expect(proposed!.querySelector('del')).toBeNull();
    expect(proposed!.querySelector('ins')).toHaveClass('bg-surface-muted', 'font-medium');
    expect(current!.querySelector('del')).toHaveClass('line-through', 'text-foreground-secondary');
    expect(proposed).toHaveTextContent('Payment files are reconciled before upload');
  });

  it('drops the marks when either value is over 2,000 characters, and shows both whole', () => {
    const long = `${'word '.repeat(400)}x`;
    expect(long.length).toBe(WORD_DIFF_MAX_LENGTH + 1);
    render(<FieldComparison caption="Changes" density="comfortable" emphasis rows={compareFields([{ label: 'Risk statement', current: 'Short', proposed: long }])} />);
    const table = screen.getByRole('table');
    expect(table.querySelector('ins, del')).toBeNull();
    expect(within(table).getAllByRole('cell')[1]!.textContent).toContain(long);
  });

  it('lets renderEmphasis decide a value where it renders one, and emphasis mark the rest', () => {
    render(
      <FieldComparison
        caption="Changes"
        density="comfortable"
        emphasis
        renderEmphasis={(row, side) => (row.label === 'Residual rating' ? <strong>{row[side]} badge</strong> : null)}
        rows={compareFields([{ label: 'Residual rating', current: 'High', proposed: 'Moderate' }, statementRow])}
      />,
    );
    const table = screen.getByRole('table');
    expect(within(table).getByText('Moderate badge')).toBeInTheDocument();
    expect(table.querySelectorAll('ins').length).toBeGreaterThan(0);
  });

  it('builds the marks from text, never markup', () => {
    render(<FieldComparison caption="Changes" density="comfortable" emphasis rows={compareFields([{ label: 'Risk cause', current: 'a <b>bold</b> claim', proposed: 'a <img src=x onerror=alert(1)> claim' }])} />);
    expect(document.querySelector('b, img')).toBeNull();
  });

  it('below 768px, stacks each change as a card: its label, the current value above the proposed one, then the decision', () => {
    const { container } = render(<FieldComparison caption="AI changes proposed for R-3" density="comfortable" groups={ratingGroups} />);
    const stacked = container.querySelector('[data-comparison-layout="stacked"]')!;
    expect(stacked).toHaveClass('md:hidden');
    const cards = stacked.querySelectorAll(':scope > li');
    expect(cards).toHaveLength(2);
    const residual = cards[1]!;
    expect(residual).toHaveClass('rounded-lg', 'border', 'border-border');
    const text = [...residual.querySelectorAll('.micro-label, [data-comparison-value], button')].map((node) => node.textContent);
    expect(text).toEqual([
      'Residual rating',
      'Residual likelihood', 'Changed', 'Current', 'Likely', 'Proposed', 'Possible',
      'Residual rating', 'Changed', 'Current', 'High', 'Proposed', 'Moderate',
      'Confirm: Residual rating on R-3',
    ]);
    const single = cards[0]!;
    expect([...single.querySelectorAll('.micro-label')].map((node) => node.textContent)).toEqual(['Risk statement', 'Changed', 'Current', 'Proposed']);
  });

  it('collapses the unchanged rows of grouped changes behind the one count, as for rows', () => {
    render(<FieldComparison caption="AI changes proposed for R-3" density="compact" groups={ratingGroups} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Show 1 unchanged field' })[0]!);
    const residual = screen.getByRole('table').querySelectorAll('tbody')[1]!;
    expect(within(residual).getAllByRole('rowheader')).toHaveLength(3);
    expect(within(residual).getByRole('button', { name: 'Confirm: Residual rating on R-3' }).closest('td')).toHaveAttribute('rowSpan', '3');
  });
});

describe('the comparison rules Phase 16 adds (X-29, UI-D21)', () => {
  it('names the history’s compact toggle by the changed fields', () => {
    expect(changedFieldsToggleLabel(1, false)).toBe('Show 1 changed field');
    expect(changedFieldsToggleLabel(3, false)).toBe('Show 3 changed fields');
    expect(changedFieldsToggleLabel(3, true)).toBe('Hide changed fields');
  });

  it('keeps the bounded word diff beside the comparison it marks', () => {
    expect(wordDiff('a b c', 'a x c')).toEqual([{ kind: 'same', text: 'a ' }, { kind: 'del', text: 'b' }, { kind: 'ins', text: 'x' }, { kind: 'same', text: ' c' }]);
    expect(wordDiff('x'.repeat(2_001), 'y')).toBeNull();
  });
});
