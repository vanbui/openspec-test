'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import type { ActiveUser } from './assessment-schema';

export type OwnerSearchInput = { search: string };

export type OwnerSearchResult =
  | { ok: true; data: readonly ActiveUser[] }
  | { ok: false; formError: string };

export type OwnerComboboxProps = {
  label: string;
  value: ActiveUser | null;
  onValueChange: (value: ActiveUser | null) => void;
  searchOwners: (input: OwnerSearchInput) => Promise<OwnerSearchResult>;
  clearable?: boolean;
  errorId?: string;
  invalid?: boolean;
};

const debounceMs = 300;

export type RelationSelection = { documentId: string; name: string };
export type RelationSearchInput = { search: string };
export type RelationSearchResult =
  | { ok: true; data: readonly RelationSelection[] }
  | { ok: false; formError: string };

/**
 * Bounded relation lookup which deliberately keeps selected summaries separate
 * from the current search page.  A label is never used as the submitted value.
 */
export function RelationMultiSelect({
  label,
  searchLabel,
  value,
  onValueChange,
  searchRelations,
}: {
  /** Names the selection as a whole: its results list and its chosen items. */
  label: string;
  /** Names the search box itself, so a surrounding legend is not repeated. */
  searchLabel?: string;
  value: readonly RelationSelection[];
  onValueChange: (value: readonly RelationSelection[]) => void;
  searchRelations: (input: RelationSearchInput) => Promise<RelationSearchResult>;
}) {
  const inputLabel = searchLabel ?? label;
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly RelationSelection[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  const search = useCallback(async (term: string) => {
    const request = ++sequence.current;
    setIsLoading(true);
    setError(null);
    const result = await searchRelations({ search: term });
    if (request !== sequence.current) return;
    setIsLoading(false);
    if (!result.ok) { setResults([]); setError(result.formError); return; }
    setResults(result.data);
  }, [searchRelations]);

  useEffect(() => {
    const term = query.trim();
    ++sequence.current;
    setActiveIndex(-1);
    setError(null);
    if (!term) { setResults([]); setIsLoading(false); setIsOpen(false); return undefined; }
    setIsLoading(true);
    setIsOpen(true);
    const timer = window.setTimeout(() => { void search(term); }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  const choose = (item: RelationSelection) => {
    if (!value.some((selected) => selected.documentId === item.documentId)) onValueChange([...value, item]);
    ++sequence.current;
    setQuery(''); setResults([]); setError(null); setIsLoading(false); setIsOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const remove = (documentId: string) => {
    onValueChange(value.filter((item) => item.documentId !== documentId));
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const active = activeIndex >= 0 ? results[activeIndex] : undefined;
  const listboxShown = !isLoading && !error && results.length > 0;

  return <div className="grid min-w-0 gap-2">
    <label className="grid gap-2"><span className="text-sm font-medium">{inputLabel}</span>
      <Popover open={isOpen} onOpenChange={setIsOpen}><PopoverAnchor asChild><input ref={inputRef} aria-label={inputLabel} className="h-9 min-w-0 rounded-md border border-input bg-surface px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring" role="combobox" aria-autocomplete="list" aria-controls={listboxShown ? listboxId : undefined} aria-expanded={isOpen} aria-haspopup="listbox" aria-activedescendant={active ? `${listboxId}-${active.documentId}` : undefined} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, results.length - 1)); }
        if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
        // Enter always belongs to the combobox, never to the surrounding form.
        // Without this, pressing it before the debounced search has returned
        // submits the whole request.
        if (event.key === 'Enter') { event.preventDefault(); const chosen = active ?? results[0]; if (chosen) choose(chosen); }
        if (event.key === 'Escape') { setQuery(''); setIsOpen(false); }
      }} /></PopoverAnchor>
      {/* A listbox popup (ARIA APG combobox): focus stays in the input, so the Popover only positions it and carries no dialog role. */}
      <PopoverContent className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] p-1" align="start" onOpenAutoFocus={(event) => event.preventDefault()} role={undefined}>
        {isLoading ? <p className="px-2 py-3 text-sm text-muted-foreground" role="status">Searching {label.toLowerCase()}…</p> : null}
        {error ? <div className="grid gap-2 px-2 py-3 text-sm" role="alert"><span>{error}</span><button className="w-fit text-primary underline-offset-4 hover:underline" type="button" onClick={() => { void search(query.trim()); }}>Retry search</button></div> : null}
        {!isLoading && !error && results.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground" role="status">No matching records.</p> : null}
        {listboxShown ? <div id={listboxId} role="listbox" aria-label={`${label} results`}>{results.map((item, index) => <button className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm ${index === activeIndex ? 'bg-muted text-foreground' : 'hover:bg-muted hover:text-foreground'}`} id={`${listboxId}-${item.documentId}`} key={item.documentId} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>{item.name}</button>)}</div> : null}
      </PopoverContent></Popover>
    </label>
    <p className="text-sm text-muted-foreground" role="status">{value.length} selected</p>
    {value.length ? <ul className="flex flex-wrap gap-2" aria-label={`Selected ${label}`}>{value.map((item) => <li className="flex min-w-0 items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm" key={item.documentId}><span className="truncate">{item.name}</span><button aria-label={`Remove ${item.name}`} className="text-primary underline-offset-4 hover:underline" type="button" onClick={() => remove(item.documentId)}>Remove</button></li>)}</ul> : null}
  </div>;
}

export function OwnerCombobox({
  label,
  value,
  onValueChange,
  searchOwners,
  clearable = true,
  errorId,
  invalid = false,
}: OwnerComboboxProps) {
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly ActiveUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  const search = useCallback(async (searchTerm: string) => {
    const request = ++sequence.current;
    setIsLoading(true);
    setError(null);
    setActiveIndex(-1);
    const result = await searchOwners({ search: searchTerm });
    if (request !== sequence.current) return;
    setIsLoading(false);
    if (!result.ok) {
      setResults([]);
      setError(result.formError);
      return;
    }
    setResults(result.data);
  }, [searchOwners]);

  useEffect(() => {
    const trimmed = query.trim();
    ++sequence.current;
    setResults([]);
    setActiveIndex(-1);
    setError(null);
    if (!trimmed) {
      setIsLoading(false);
      setIsOpen(false);
      return undefined;
    }
    setIsLoading(true);
    setIsOpen(true);
    const timer = window.setTimeout(() => { void search(trimmed); }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [query, search]);

  const choose = (owner: ActiveUser) => {
    ++sequence.current;
    onValueChange(owner);
    setQuery('');
    setResults([]);
    setError(null);
    setIsLoading(false);
    setIsOpen(false);
  };

  const activeOwner = activeIndex >= 0 ? results[activeIndex] : undefined;
  const listboxShown = !isLoading && !error && results.length > 0;

  return (
    <div className="grid min-w-0 gap-2">
      <label className="grid gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverAnchor asChild>
            <input
              className="h-9 min-w-0 rounded-md border border-input bg-surface px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxShown ? listboxId : undefined}
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              aria-activedescendant={activeOwner ? `${listboxId}-${activeOwner.documentId}` : undefined}
              aria-describedby={invalid ? errorId : undefined}
              aria-invalid={invalid}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && results.length > 0) {
                  event.preventDefault();
                  setActiveIndex((index) => Math.min(index + 1, results.length - 1));
                }
                if (event.key === 'ArrowUp' && results.length > 0) {
                  event.preventDefault();
                  setActiveIndex((index) => Math.max(index - 1, 0));
                }
                if (event.key === 'Enter') {
                  // Enter chooses the active option, or the first, and never submits the surrounding form (UI-SPEC §13.1, WR-204).
                  event.preventDefault();
                  const chosen = activeOwner ?? (query.trim() ? results[0] : undefined);
                  if (chosen) choose(chosen);
                }
                if (event.key === 'Tab') setIsOpen(false);
                if (event.key === 'Escape') {
                  ++sequence.current;
                  setQuery('');
                  setResults([]);
                  setError(null);
                  setIsLoading(false);
                  setIsOpen(false);
                }
              }}
            />
          </PopoverAnchor>
          {/*
            * A listbox popup (ARIA APG combobox): focus stays in the input and options are reached through
            * aria-activedescendant, so the Popover only positions it and carries no dialog role (an unnamed dialog
            * fails axe aria-dialog-name). The status lines and Retry owner search announce through their own roles.
            */}
          <PopoverContent className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] p-1" align="start" onOpenAutoFocus={(event) => event.preventDefault()} role={undefined}>
            {isLoading ? <p className="px-2 py-3 text-sm text-muted-foreground" role="status">Searching owners…</p> : null}
            {error ? <div className="grid gap-2 px-2 py-3 text-sm" role="alert"><span>{error}</span><button className="w-fit text-primary underline-offset-4 hover:underline" type="button" onClick={() => { void search(query.trim()); }}>Retry owner search</button></div> : null}
            {!isLoading && !error && results.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground" role="status">No matching active owners.</p> : null}
            {listboxShown ? (
              <div id={listboxId} role="listbox" aria-label={`${label} results`}>
                {results.map((owner, index) => (
                  <button
                    className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm ${index === activeIndex ? 'bg-muted text-foreground' : 'hover:bg-muted hover:text-foreground'}`}
                    key={owner.documentId}
                    id={`${listboxId}-${owner.documentId}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(owner)}
                  >
                    {owner.displayName}
                  </button>
                ))}
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      </label>
      {value ? <div className="flex flex-wrap items-center gap-2 text-sm"><span>Selected owner: {value.displayName}</span>{clearable ? <button className="text-primary underline-offset-4 hover:underline" type="button" onClick={() => onValueChange(null)} aria-label={`Clear ${label}`}>Clear</button> : null}</div> : null}
    </div>
  );
}
