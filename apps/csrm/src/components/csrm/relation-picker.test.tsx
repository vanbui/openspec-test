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
