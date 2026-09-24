import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OwnerCombobox, RelationMultiSelect } from './owner-combobox';

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', TestResizeObserver);
Element.prototype.scrollIntoView ??= () => {};

const alex = { documentId: 'user-alex', displayName: 'Alex Analyst' };
const casey = { documentId: 'user-casey', displayName: 'Casey Custodian' };

afterEach(() => vi.useRealTimers());

describe('OwnerCombobox', () => {
  it('debounces arbitrary non-empty names and never searches empty input', async () => {
    vi.useFakeTimers();
    const searchOwners = vi.fn().mockResolvedValue({ ok: true, data: [alex] });
    render(<OwnerCombobox label="Risk owner" value={null} onValueChange={vi.fn()} searchOwners={searchOwners} />);
    const input = screen.getByRole('combobox', { name: 'Risk owner' });

    fireEvent.change(input, { target: { value: 'Alex' } });
    expect(screen.getByRole('status')).toHaveTextContent('Searching owners');
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(searchOwners).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(searchOwners).toHaveBeenCalledWith({ search: 'Alex' });

    fireEvent.change(input, { target: { value: '' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(searchOwners).toHaveBeenCalledTimes(1);
  });

  it('selects with pointer and keyboard, clears optional values, and preserves persisted selection', async () => {
    vi.useFakeTimers();
    const change = vi.fn();
    const searchOwners = vi.fn().mockResolvedValue({ ok: true, data: [alex] });
    const { rerender } = render(<OwnerCombobox label="Risk owner" value={casey} onValueChange={change} searchOwners={searchOwners} />);
    expect(screen.getByText('Selected owner: Casey Custodian')).toBeInTheDocument();
    const input = screen.getByRole('combobox', { name: 'Risk owner' });

    fireEvent.change(input, { target: { value: 'Alex' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => {});
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const option = screen.getByRole('option', { name: 'Alex Analyst' });
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', option.id);
    expect(option.className).toContain('bg-muted');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(change).toHaveBeenCalledWith(alex);

    rerender(<OwnerCombobox label="Risk owner" value={alex} onValueChange={change} searchOwners={searchOwners} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Risk owner' }));
    expect(change).toHaveBeenCalledWith(null);
  });

  it('prevents implicit submit, selects the first result, and dismisses on Tab', async () => {
    vi.useFakeTimers();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const change = vi.fn();
    const searchOwners = vi.fn().mockResolvedValue({ ok: true, data: [alex, casey] });
    render(<form onSubmit={submit}><OwnerCombobox label="Risk owner" value={null} onValueChange={change} searchOwners={searchOwners} /><button type="submit">Save</button></form>);
    const input = screen.getByRole('combobox', { name: 'Risk owner' });
    fireEvent.change(input, { target: { value: 'A' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => {});
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(submit).not.toHaveBeenCalled();
    expect(change).toHaveBeenCalledWith(alex);

    fireEvent.change(input, { target: { value: 'A' } });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('suppresses stale responses and exposes safe errors with retry', async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: { ok: true; data: readonly typeof alex[] }) => void;
    const searchOwners = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: false, formError: 'The assessment service is unavailable. Please try again later.' })
      .mockResolvedValueOnce({ ok: true, data: [casey] });
    render(<OwnerCombobox label="Risk owner" value={null} onValueChange={vi.fn()} searchOwners={searchOwners} />);
    const input = screen.getByRole('combobox', { name: 'Risk owner' });

    fireEvent.change(input, { target: { value: 'Alex' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    fireEvent.change(input, { target: { value: 'Casey' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => { resolveFirst({ ok: true, data: [alex] }); });

    expect(screen.queryByRole('option', { name: 'Alex Analyst' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry owner search' }));
    await act(async () => {});
    expect(screen.getByRole('option', { name: 'Casey Custodian' })).toBeInTheDocument();
  });
});

describe('RelationMultiSelect', () => {
  it('debounces a bounded search, selects with keyboard, retains selected summaries, and removes by named control', async () => {
    vi.useFakeTimers();
    const change = vi.fn();
    const searchRelations = vi.fn().mockResolvedValue({ ok: true, data: [{ documentId: 'system-2', name: 'Identity platform' }] });
    render(<RelationMultiSelect label="Information systems" value={[{ documentId: 'system-1', name: 'Customer portal' }]} onValueChange={change} searchRelations={searchRelations} />);
    const input = screen.getByRole('combobox', { name: 'Information systems' });
    expect(screen.getByText('Customer portal')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'identity' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(searchRelations).toHaveBeenCalledWith({ search: 'identity' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(change).toHaveBeenCalledWith([
      { documentId: 'system-1', name: 'Customer portal' },
      { documentId: 'system-2', name: 'Identity platform' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Customer portal' }));
    expect(change).toHaveBeenLastCalledWith([]);
  });
});
