import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RelationPicker, type RelationPickerItem, type RelationPickerSearchResult } from './relation-picker';

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', TestResizeObserver);
Element.prototype.scrollIntoView ??= () => {};

afterEach(() => vi.useRealTimers());

const app11: RelationPickerItem = {
  documentId: 'control-app-11',
  name: 'APP-11 · Security of personal information',
  detail: 'Privacy Act 1988 — Australian Privacy Principles and Notifiable Data Breaches scheme',
};
const ac1: RelationPickerItem = { documentId: 'control-ac-1', name: 'AC-1 · Access control', detail: 'NIST SP 800-53' };
const iso51: RelationPickerItem = { documentId: 'control-5-1', name: '5.1 · ISO/IEC 27001 Information security management systems — Annex A' };

const hint = 'Search by control number, name or framework. Controls that apply to the Risk Type come first.';

type HarnessProps = {
  initial?: RelationPickerItem | null;
  onChange?: (value: RelationPickerItem | null) => void;
  search?: (input: { search: string }) => Promise<RelationPickerSearchResult>;
  suggested?: { label: string; items: readonly RelationPickerItem[] };
};

function Harness({ initial = null, onChange, search = async () => ({ ok: true, data: [] }), suggested }: HarnessProps) {
  const [value, setValue] = useState<RelationPickerItem | null>(initial);
  return (
    <RelationPicker
      hint={hint}
      label="Control"
      noMatchText="No matching controls. Try a control number, name or framework."
      noun="control"
      onValueChange={(next) => { setValue(next); onChange?.(next); }}
      otherGroupLabel="Other controls"
      pageSize={10}
      search={search}
      searchingText="Searching controls…"
      suggested={suggested}
      value={value}
    />
  );
}

const applicable = { label: 'Applicable to Internet Exposure', items: [app11, ac1] };

describe('RelationPicker (X-2, UI-SPEC §13.1)', () => {
  it('is a combobox named by its label and described by its hint', () => {
    render(<Harness suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    expect(input).toHaveAccessibleName('Control');
    expect(input).toHaveAccessibleDescription(hint);
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on a pointer press with only the suggested group, a group named by its label', () => {
    const search = vi.fn(async () => ({ ok: true as const, data: [iso51] }));
    render(<Harness search={search} suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });

    fireEvent.click(input);

    expect(input).toHaveAttribute('aria-expanded', 'true');
    const group = screen.getByRole('group', { name: 'Applicable to Internet Exposure' });
    expect(within(group).getAllByRole('option').map((option) => option.getAttribute('aria-label'))).toEqual([app11.name, ac1.name]);
    expect(screen.getAllByRole('group')).toHaveLength(1);
    expect(screen.getByRole('option', { name: app11.name })).toHaveAccessibleDescription(app11.detail!);
    expect(search).not.toHaveBeenCalled();
  });

  it('opens on ArrowDown or Alt+ArrowDown, never on Tab alone', () => {
    render(<Harness suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });

    input.focus();
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Applicable to Internet Exposure' })).toBeInTheDocument();
  });

  it('moves the active option with ArrowDown and ArrowUp through aria-activedescendant', () => {
    render(<Harness suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    fireEvent.click(input);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const first = screen.getByRole('option', { name: app11.name });
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: ac1.name }).id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: ac1.name }).id);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
  });

  it('chooses the active option on Enter and never submits the surrounding form', () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const change = vi.fn();
    render(<form onSubmit={submit}><Harness onChange={change} suggested={applicable} /><button type="submit">Save</button></form>);
    const input = screen.getByRole('combobox', { name: 'Control' });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(submit).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();

    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(submit).not.toHaveBeenCalled();
    expect(change).toHaveBeenLastCalledWith(ac1);
  });

  it('chooses the first option on Enter when none is active', () => {
    const change = vi.fn();
    render(<Harness onChange={change} suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(change).toHaveBeenLastCalledWith(app11);
  });

  it('closes and clears the query on Escape', () => {
    render(<Harness suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    fireEvent.change(input, { target: { value: 'APP' } });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('');
  });

  it('shows the choice below the field, clears the query, closes the list and keeps focus in the input', () => {
    render(<Harness suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    input.focus();
    fireEvent.change(input, { target: { value: 'APP' } });
    fireEvent.click(screen.getByRole('option', { name: app11.name }));

    expect(screen.getByText(`Selected control: ${app11.name}`)).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveFocus();
    // The selected line sits outside the label, so the field's name stays exactly its label.
    expect(input).toHaveAccessibleName('Control');
  });

  it('clears the choice with a Clear button named for the field and moves focus to the input', () => {
    const change = vi.fn();
    render(<Harness initial={app11} onChange={change} suggested={applicable} />);
    expect(screen.getByText(`Selected control: ${app11.name}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Control' }));

    expect(change).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText(/^Selected control:/)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Control' })).toHaveFocus();
  });

  it('tells a screen reader which record is already set, keeping the label as its name (WR-303)', () => {
    render(<Harness initial={app11} suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    expect(input).toHaveAccessibleName('Control');
    expect(input).toHaveAccessibleDescription(`${hint} Selected control: ${app11.name}`);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Control' }));
    expect(input).toHaveAccessibleDescription(hint);
  });

  it('asks for a search when it has no suggestions and the query is empty', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    fireEvent.click(input);
    expect(screen.getByRole('status')).toHaveTextContent('Type to search controls.');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('stays free of zod so the zod-free routes that render it download none', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/csrm/relation-picker.tsx'), 'utf8');
    expect(source).not.toMatch(/from ['"]zod['"]/);
  });
});

describe('RelationPicker typing', () => {
  it('filters the suggested group in the browser as the person types', async () => {
    vi.useFakeTimers();
    render(<Harness suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    fireEvent.change(input, { target: { value: 'app-11' } });
    const group = screen.getByRole('group', { name: 'Applicable to Internet Exposure' });
    expect(within(group).getAllByRole('option').map((option) => option.getAttribute('aria-label'))).toEqual([app11.name]);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  });
});

describe('RelationPicker search (UI-SPEC §13.1)', () => {
  const page = (count: number): RelationPickerItem[] => Array.from({ length: count }, (_, index) => ({
    documentId: `control-${index}`,
    name: `CTL-${index} · Control ${index}`,
  }));

  it('searches as the person types, then lists the matching suggestions before the server results, each once', async () => {
    vi.useFakeTimers();
    const search = vi.fn(async () => ({ ok: true as const, data: [app11, iso51] }));
    render(<Harness search={search} suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });

    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.getByRole('status')).toHaveTextContent('Searching controls…');
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(search).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(search).toHaveBeenCalledWith({ search: 'a' });

    const groups = screen.getAllByRole('group');
    expect(groups.map((group) => group.getAttribute('aria-labelledby') && document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent))
      .toEqual(['Applicable to Internet Exposure', 'Other controls']);
    expect(within(groups[0]!).getAllByRole('option').map((option) => option.getAttribute('aria-label'))).toEqual([app11.name, ac1.name]);
    expect(within(groups[1]!).getAllByRole('option').map((option) => option.getAttribute('aria-label'))).toEqual([iso51.name]);
    expect(screen.getAllByRole('option', { name: app11.name })).toHaveLength(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('gives the search results no group label when there is no suggested group', async () => {
    vi.useFakeTimers();
    render(<Harness search={async () => ({ ok: true, data: [iso51] })} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Control' }), { target: { value: '5.1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(screen.getByRole('option', { name: iso51.name })).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByText('Other controls')).not.toBeInTheDocument();
  });

  it('says a full page is only the first matches', async () => {
    vi.useFakeTimers();
    render(<Harness search={async () => ({ ok: true, data: page(10) })} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Control' }), { target: { value: 'CTL' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(screen.getAllByRole('option')).toHaveLength(10);
    expect(screen.getByRole('status')).toHaveTextContent('Showing the first 10 matches. Keep typing to narrow the list.');
  });

  it('says when nothing matches', async () => {
    vi.useFakeTimers();
    render(<Harness search={async () => ({ ok: true, data: [] })} suggested={applicable} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Control' }), { target: { value: 'zzz' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No matching controls. Try a control number, name or framework.');
  });

  it('shows a failed search with Retry search, which searches again', async () => {
    vi.useFakeTimers();
    const search = vi.fn()
      .mockResolvedValueOnce({ ok: false, formError: 'The selection service is unavailable. Please try again later.' })
      .mockResolvedValueOnce({ ok: true, data: [iso51] });
    render(<Harness search={search} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Control' }), { target: { value: '5.1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(screen.getByRole('alert')).toHaveTextContent('The selection service is unavailable. Please try again later.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
    await act(async () => {});
    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenLastCalledWith({ search: '5.1' });
    expect(screen.getByRole('option', { name: iso51.name })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows Retry search, never Searching… forever, when the search itself is rejected (WR-301)', async () => {
    vi.useFakeTimers();
    const search = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, data: [iso51] });
    render(<Harness search={search} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Control' }), { target: { value: '5.1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(screen.queryByText('Searching controls…')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The selection service is unavailable. Please try again later.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
    await act(async () => {});
    expect(search).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('option', { name: iso51.name })).toBeInTheDocument();
  });

  it('retries a failed search with Enter from the combobox, says so, and never submits the form (WR-302)', async () => {
    vi.useFakeTimers();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const search = vi.fn()
      .mockResolvedValueOnce({ ok: false, formError: 'The selection service is unavailable. Please try again later.' })
      .mockResolvedValueOnce({ ok: true, data: [iso51] });
    render(<form onSubmit={submit}><Harness search={search} /></form>);
    const input = screen.getByRole('combobox', { name: 'Control' });
    input.focus();
    fireEvent.change(input, { target: { value: '5.1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(screen.getByRole('alert')).toHaveTextContent('Press Enter to retry.');
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => {});
    expect(submit).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenLastCalledWith({ search: '5.1' });
    expect(input).toHaveFocus();
    expect(screen.getByRole('option', { name: iso51.name })).toBeInTheDocument();
  });

  it('chooses an active suggestion on Enter even while a search error shows (WR-302)', async () => {
    vi.useFakeTimers();
    const change = vi.fn();
    const search = vi.fn(async () => ({ ok: false as const, formError: 'The selection service is unavailable. Please try again later.' }));
    render(<Harness onChange={change} search={search} suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    fireEvent.change(input, { target: { value: 'APP' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(change).toHaveBeenLastCalledWith(app11);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('ignores a response a later keystroke superseded', async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: RelationPickerSearchResult) => void;
    const search = vi.fn()
      .mockImplementationOnce(() => new Promise<RelationPickerSearchResult>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: true, data: [iso51] });
    render(<Harness search={search} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    fireEvent.change(input, { target: { value: 'APP' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    fireEvent.change(input, { target: { value: '5.1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => { resolveFirst({ ok: true, data: [app11] }); });

    expect(screen.queryByRole('option', { name: app11.name })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: iso51.name })).toBeInTheDocument();
  });
});

/*
 * 10-23 walkthrough fix 8 (axe aria-dialog-name): focus never leaves the input and the options are reached
 * through aria-activedescendant, so the popup is a listbox (ARIA APG combobox, listbox popup). The Popover
 * that positions it is a plain wrapper, never an unnamed dialog; its status lines and Retry search are
 * announced through their own live roles.
 */
describe('RelationPicker popup (APG combobox with a listbox popup)', () => {
  it('opens a listbox popup that the combobox controls, with focus kept in the input and no dialog', () => {
    render(<Harness suggested={applicable} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    input.focus();

    fireEvent.click(input);

    const listbox = screen.getByRole('listbox', { name: 'Control options' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="popover-content"]')).not.toHaveAttribute('role');
  });

  it('announces its status line and a failed search with Retry search, without a dialog', async () => {
    vi.useFakeTimers();
    render(<Harness search={async () => ({ ok: false, formError: 'The selection service is unavailable. Please try again later.' })} />);
    const input = screen.getByRole('combobox', { name: 'Control' });
    fireEvent.click(input);
    expect(screen.getByRole('status')).toHaveTextContent('Type to search controls.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: '5.1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(screen.getByRole('alert')).toHaveTextContent('The selection service is unavailable. Please try again later.');
    expect(screen.getByRole('button', { name: 'Retry search' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

/*
 * Label in Name (WCAG 2.5.3; 10-23 walkthrough fix 8, found by the open-list axe scan): an option is named by its
 * title line, so its framework line, shown below it, is its description and stays out of the text that has to
 * match the name. The two lines read together as `…informationPrivacy Act…`, which the name did not contain.
 */
describe('RelationPicker option names (Label in Name)', () => {
  it('names an option by its title line and describes it with the framework line, which is not part of its label text', () => {
    render(<Harness suggested={applicable} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Control' }));

    const option = screen.getByRole('option', { name: app11.name });
    expect(option).toHaveAccessibleName(app11.name);
    expect(option).toHaveAccessibleDescription(app11.detail!);
    expect(within(option).getByText(app11.detail!)).toHaveAttribute('aria-hidden', 'true');
    expect(within(option).getByText(app11.name)).not.toHaveAttribute('aria-hidden');
  });
});
