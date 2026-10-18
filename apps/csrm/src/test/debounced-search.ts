import { act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

/** The pause the record pickers (RelationPicker) and the Risk Register's relation filters wait before they search. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Enters `term` in a debounced search field and runs that pause on fake timers, so the search has run and its answer is
 * listed when this returns, however loaded the machine is. A real pause would leave a find query's one-second timeout to
 * cover the debounce as well, which a full parallel suite outlasts. Real timers are back afterwards, so userEvent works.
 */
export async function searchAfterPause(field: HTMLElement, term: string): Promise<void> {
  vi.useFakeTimers();
  try {
    fireEvent.change(field, { target: { value: term } });
    await act(async () => { await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS); });
  } finally {
    vi.useRealTimers();
  }
}
