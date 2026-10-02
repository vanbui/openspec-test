'use client';

import { useCallback, useEffect, useId, useRef, useState, type Ref } from 'react';

import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/*
 * The record picker (X-2, D-28; UI-SPEC §13.1). One single-record, server-backed, debounced combobox that
 * generalises OwnerCombobox: a labelled field with a hint, a Popover listbox with a suggested group first,
 * server search as the person types, and the chosen record shown below the field with a Clear control.
 * It is zod-free: the routes that render it validate nothing in the browser.
 */

/** One record the picker offers or holds: its id is submitted, its name and second line are shown. */
export type RelationPickerItem = { documentId: string; name: string; detail?: string };
export type RelationPickerSearchInput = { search: string };
export type RelationPickerSearchResult =
  | { ok: true; data: readonly RelationPickerItem[] }
  | { ok: false; formError: string };
/** The records the context suggests, listed first under their own label (for example the Risk Type's controls). */
export type RelationPickerGroup = { label: string; items: readonly RelationPickerItem[] };

export type RelationPickerProps = {
  label: string;
  hint?: string;
  /** Names the record in the selected line: `Selected {noun}: {name}`. */
  noun: string;
  /** Names the records in the empty-query prompt: `Type to search {nouns}.` Defaults to the noun with an s. */
  nounPlural?: string;
  value: RelationPickerItem | null;
  onValueChange: (value: RelationPickerItem | null) => void;
  search: (input: RelationPickerSearchInput) => Promise<RelationPickerSearchResult>;
  /** The server's page size, so a full page can say that more records match. */
  pageSize: number;
  suggested?: RelationPickerGroup;
  /** Labels the search results when a suggested group is shown above them. */
  otherGroupLabel: string;
  searchingText: string;
  noMatchText: string;
  errorId?: string;
  invalid?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

/** The shipped combobox debounce (OwnerCombobox). */
const debounceMs = 300;

function matches(item: RelationPickerItem, term: string): boolean {
  const needle = term.toLocaleLowerCase('en-AU');
  return item.name.toLocaleLowerCase('en-AU').includes(needle)
    || (item.detail?.toLocaleLowerCase('en-AU').includes(needle) ?? false);
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export function RelationPicker({
  label,
  hint,
  noun,
  nounPlural = `${noun}s`,
  value,
  onValueChange,
  search,
  pageSize,
  suggested,
  otherGroupLabel,
  searchingText,
  noMatchText,
  errorId,
  invalid = false,
  inputRef,
}: RelationPickerProps) {
  const inputId = useId();
  const hintId = useId();
  const listboxId = useId();
  const suggestedLabelId = useId();
  const otherLabelId = useId();
  const localInput = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef(search);
  const sequence = useRef(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly RelationPickerItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { searchRef.current = search; }, [search]);

  const setInput = useCallback((node: HTMLInputElement | null) => {
    localInput.current = node;
    assignRef(inputRef, node);
  }, [inputRef]);

  const runSearch = useCallback(async (term: string) => {
    const request = ++sequence.current;
    setIsLoading(true);
    setError(null);
    const result = await searchRef.current({ search: term });
    // A later keystroke or choice supersedes this response.
    if (request !== sequence.current) return;
    setIsLoading(false);
    if (!result.ok) {
      setResults([]);
      setError(result.formError);
      return;
    }
    setResults(result.data);
  }, []);

  useEffect(() => {
    const term = query.trim();
    ++sequence.current;
    setActiveIndex(-1);
    setError(null);
    setResults((current) => current.length === 0 ? current : []);
    if (!term) {
      setIsLoading(false);
      return undefined;
    }
    setIsLoading(true);
    const timer = window.setTimeout(() => { void runSearch(term); }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  const term = query.trim();
  const suggestedItems = suggested?.items ?? [];
  const suggestedShown = term ? suggestedItems.filter((item) => matches(item, term)) : suggestedItems;
  const suggestedIds = new Set(suggestedShown.map((item) => item.documentId));
  // An item appears once: a suggested record the server also returns stays in the suggested group.
  const otherShown = term ? results.filter((item) => !suggestedIds.has(item.documentId)) : [];
  const options = [...suggestedShown, ...otherShown];
  const active = activeIndex >= 0 ? options[activeIndex] : undefined;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listboxId]);

  const reset = () => {
    ++sequence.current;
    setQuery('');
    setResults([]);
    setError(null);
    setIsLoading(false);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const choose = (item: RelationPickerItem) => {
    onValueChange(item);
    reset();
    localInput.current?.focus();
  };

  const clear = () => {
    onValueChange(null);
    localInput.current?.focus();
  };

  let status: string | null = null;
  if (!term && suggestedItems.length === 0) status = `Type to search ${nounPlural}.`;
  else if (term && isLoading) status = searchingText;
  else if (term && !error && options.length === 0) status = noMatchText;
  else if (term && !error && results.length >= pageSize) status = `Showing the first ${pageSize} matches. Keep typing to narrow the list.`;

  const describedBy = [hint ? hintId : null, invalid && errorId ? errorId : null].filter(Boolean).join(' ') || undefined;
  const listboxShown = isOpen && options.length > 0;

  const renderOption = (item: RelationPickerItem, index: number) => {
    const isActive = index === activeIndex;
    const id = optionId(index);
    return (
      <button
        aria-describedby={item.detail ? `${id}-detail` : undefined}
        aria-label={item.name}
        aria-selected={isActive}
        className={cn(
          'flex min-h-11 w-full flex-col items-start justify-center gap-0.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground md:min-h-6',
          isActive ? 'bg-muted' : 'hover:bg-muted',
        )}
        id={id}
        key={item.documentId}
        onClick={() => choose(item)}
        onMouseDown={(event) => event.preventDefault()}
        role="option"
        tabIndex={-1}
        type="button"
      >
        <span className="max-w-full break-words">{item.name}</span>
        {item.detail ? <span className="max-w-full break-words text-xs text-muted-foreground" id={`${id}-detail`}>{item.detail}</span> : null}
      </button>
    );
  };

  return (
    <div className="grid min-w-0 gap-2">
      {/* The hint and the selected line sit outside the label, so the field's name is exactly its label. */}
      <label className="text-sm font-medium" htmlFor={inputId}>{label}</label>
      {hint ? <p className="text-xs text-muted-foreground" id={hintId}>{hint}</p> : null}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverAnchor asChild>
          <Input
            aria-activedescendant={listboxShown && active ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            aria-controls={listboxShown ? listboxId : undefined}
            aria-describedby={describedBy}
            aria-expanded={isOpen}
            aria-invalid={invalid}
            autoComplete="off"
            id={inputId}
            onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
            onClick={() => setIsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (!isOpen) {
                  setIsOpen(true);
                  // Alt+ArrowDown opens the list without moving into it (WAI-ARIA combobox pattern).
                  if (!event.altKey && options.length > 0) setActiveIndex(0);
                } else if (options.length > 0) {
                  setActiveIndex((index) => Math.min(index + 1, options.length - 1));
                }
              }
              if (event.key === 'ArrowUp' && isOpen && options.length > 0) {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              }
              // Enter always belongs to the picker, never to the surrounding form.
              if (event.key === 'Enter') {
                event.preventDefault();
                const chosen = isOpen ? active ?? options[0] : undefined;
                if (chosen) choose(chosen);
              }
              if (event.key === 'Escape' && (isOpen || query)) {
                event.preventDefault();
                reset();
              }
              if (event.key === 'Tab') setIsOpen(false);
            }}
            ref={setInput}
            role="combobox"
            value={query}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] overflow-y-auto p-1"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            // A press in the field itself keeps the list open; it is the field's own control.
            if (event.target instanceof Node && localInput.current?.contains(event.target)) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {listboxShown ? (
            <div aria-label={`${label} options`} id={listboxId} role="listbox">
              {suggested && suggestedShown.length > 0 ? (
                <div aria-labelledby={suggestedLabelId} role="group">
                  <div aria-hidden="true" className="micro-label px-2 pt-2 pb-1 text-muted-foreground" id={suggestedLabelId}>{suggested.label}</div>
                  {suggestedShown.map((item, index) => renderOption(item, index))}
                </div>
              ) : null}
              {otherShown.length > 0 && suggestedShown.length > 0 ? (
                <div aria-labelledby={otherLabelId} role="group">
                  <div aria-hidden="true" className="micro-label px-2 pt-2 pb-1 text-muted-foreground" id={otherLabelId}>{otherGroupLabel}</div>
                  {otherShown.map((item, index) => renderOption(item, suggestedShown.length + index))}
                </div>
              ) : null}
              {otherShown.length > 0 && suggestedShown.length === 0 ? otherShown.map((item, index) => renderOption(item, index)) : null}
            </div>
          ) : null}
          {status ? <p className="px-2 py-3 text-sm text-muted-foreground" role="status">{status}</p> : null}
          {error ? (
            <div className="grid gap-2 px-2 py-3 text-sm" role="alert">
              <span>{error}</span>
              <button className="min-h-6 w-fit text-primary underline-offset-4 hover:underline" onClick={() => { void runSearch(term); }} onMouseDown={(event) => event.preventDefault()} type="button">Retry search</button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      {value ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 break-words">Selected {noun}: {value.name}</span>
          <button aria-label={`Clear ${label}`} className="min-h-6 text-primary underline-offset-4 hover:underline" onClick={clear} type="button">Clear</button>
        </div>
      ) : null}
    </div>
  );
}
