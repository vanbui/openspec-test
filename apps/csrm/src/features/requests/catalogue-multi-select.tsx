"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

export type CatalogueOption = {
  documentId: string;
  name: string;
};

export function CatalogueMultiSelect({
  label,
  emptyMessage,
  options,
  selected,
  onChange,
}: {
  label: string;
  emptyMessage: string;
  options: readonly CatalogueOption[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const results = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();
    return options.filter((option) => !normalizedQuery || option.name.toLowerCase().includes(normalizedQuery));
  }, [debouncedQuery, options]);
  const selectedOptions = options.filter((option) => selected.includes(option.documentId));

  function select(option: CatalogueOption) {
    if (!selected.includes(option.documentId)) onChange([...selected, option.documentId]);
    setQuery("");
    setDebouncedQuery("");
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex]);
    }
  }

  return (
    <div className="min-w-0">
      <p className="mb-sm text-label text-muted-foreground">Search and select all that apply.</p>
      <div className="flex flex-wrap gap-sm" aria-live="polite">
        {selectedOptions.map((option) => (
          <button
            className="inline-flex min-h-9 items-center rounded-[var(--radius-card)] border border-border-subtle bg-surface-muted px-sm text-label font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            key={option.documentId}
            onClick={() => onChange(selected.filter((id) => id !== option.documentId))}
            type="button"
          >
            Remove {option.name}
          </button>
        ))}
      </div>
      <div className="relative mt-sm">
        <Button aria-controls={listboxId} aria-expanded={open} onClick={() => setOpen((current) => !current)} type="button" variant="secondary">
          Select {label.toLowerCase()}
        </Button>
        {open ? (
          <div className="absolute z-20 mt-sm w-full min-w-0 rounded-[var(--radius-card)] border border-border-subtle bg-surface p-md shadow-[var(--shadow-floating)]">
            <label className="sr-only" htmlFor={`${listboxId}-search`}>Search {label.toLowerCase()}</label>
            <input
              aria-activedescendant={results[activeIndex] ? `${listboxId}-${results[activeIndex].documentId}` : undefined}
              className="min-h-11 w-full rounded-[var(--radius-card)] border border-border-subtle bg-surface px-md text-body text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              id={`${listboxId}-search`}
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              onKeyDown={onSearchKeyDown}
              placeholder={`Search ${label.toLowerCase()}`}
              role="searchbox"
              value={query}
            />
            <p aria-live="polite" className="mt-sm text-label text-muted-foreground">{results.length} options available.</p>
            <ul aria-label={`${label} options`} className="mt-sm max-h-56 overflow-y-auto" id={listboxId} role="listbox">
              {results.length ? results.map((option, index) => (
                <li aria-selected={selected.includes(option.documentId)} id={`${listboxId}-${option.documentId}`} key={option.documentId} role="option">
                  <button
                    className="flex min-h-11 w-full items-center rounded-[var(--radius-card)] px-sm text-left text-body text-foreground hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    onClick={() => select(option)}
                    type="button"
                  >
                    {index === activeIndex ? <span aria-hidden="true" className="mr-sm size-2 rounded-full bg-accent" /> : null}
                    {option.name}
                  </button>
                </li>
              )) : <li className="px-sm py-md text-body text-muted-foreground">{emptyMessage}</li>}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
