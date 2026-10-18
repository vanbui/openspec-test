'use client';

import { CheckIcon, ChevronDownIcon, ChevronUpIcon, LoaderCircleIcon, PlusIcon, Undo2Icon, XIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { controlLabel } from '../assessments/control-label';
import type { AiSuggestionReview } from '../assessments/assessment-schema';
import { useSuggestionDecisions } from './use-ai-decisions';

const suggestionLabel = (item: AiSuggestionReview) => controlLabel(item.control);

/*
 * Controls the AI suggested for a Risk (12-UI-SPEC §5; D-12, UAT-031): each becomes a planned mitigation control in
 * one action, or is dismissed, and either can be undone. Suggestions never block release and never print.
 */
export function AiControlSuggestions({ assessmentId, onControlsChanged, onReviewed, onUpdated, riskId, riskNumber, suggestions }: {
  assessmentId: string;
  onControlsChanged: () => Promise<void>;
  /** WR-302: applies a decision Strapi accepted to the Risk's suggestions, so it holds if the read after it fails. */
  onReviewed?: (key: string, state: AiSuggestionReview['state']) => void;
  onUpdated: () => Promise<void>;
  riskId: string;
  riskNumber: string;
  suggestions: readonly AiSuggestionReview[];
}) {
  const headingId = useId();
  const dismissedId = useId();
  const [showDismissed, setShowDismissed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstActions = useRef(new Map<string, HTMLButtonElement>());
  const order = useRef<readonly string[]>([]);

  /*
   * §6.2 (WR-301): once a row leaves the proposed list, focus moves to the next row's first action, else the previous
   * row's, else the heading. The order is read when the decision starts, while the row still has its place in it;
   * the move is made once the row has changed.
   */
  function focusAfter(key: string): () => void {
    const keys = order.current;
    const index = keys.indexOf(key);
    const candidates = index < 0 ? keys : [...keys.slice(index + 1), ...keys.slice(0, index).reverse()];
    return () => requestAnimationFrame(() => {
      const next = candidates.map((candidate) => firstActions.current.get(candidate)).find((element) => element?.isConnected);
      (next ?? heading.current)?.focus();
    });
  }
  function focusRestored(key: string) {
    requestAnimationFrame(() => firstActions.current.get(key)?.focus());
  }

  const decisions = useSuggestionDecisions({ assessmentId, riskId, riskNumber, suggestions, label: suggestionLabel, onControlsChanged, onUpdated, onReviewed, focusAfter, focusRestored });
  const visible = decisions.rows.filter((item) => item.state !== 'dismissed');
  const dismissed = decisions.rows.filter((item) => item.state === 'dismissed');
  order.current = visible.filter((item) => item.state === 'proposed').map((item) => item.key);

  const toggle = dismissed.length > 0 ? (
    <Button aria-controls={dismissedId} aria-expanded={showDismissed} className="justify-self-start max-md:min-h-11" data-print="hidden" onClick={() => setShowDismissed((current) => !current)} size="sm" type="button" variant="outline">
      {showDismissed ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
      {showDismissed ? 'Hide dismissed suggestions' : `Show dismissed suggestions (${dismissed.length})`}
    </Button>
  ) : null;

  /* Every Risk shows this block, so its region is named by its Risk (axe landmark-unique); the heading keeps §5's words. */
  return (
    <section aria-label={`Suggested by AI for ${riskNumber}`} className="grid gap-3" data-print="hidden">
      <h4 className="text-heading-sm outline-none" id={headingId} ref={heading} tabIndex={-1}>Suggested by AI</h4>
      {decisions.rows.length === 0 ? (
        <p className="text-sm text-foreground-secondary">The AI suggested no controls for this Risk. Use Add mitigation control to choose one from the library.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-foreground-secondary">You dismissed every suggestion for this Risk.</p>
      ) : (
        <ul aria-labelledby={headingId} className="grid gap-3">
          {visible.map((item) => (
            <SuggestionRow
              adding={decisions.addingKey === item.key}
              busy={decisions.addingKey === item.key}
              item={item}
              key={item.key}
              onAdd={() => decisions.add(item)}
              onDismiss={() => decisions.dismiss(item)}
              registerFirst={(element) => {
                if (element) firstActions.current.set(item.key, element);
                else firstActions.current.delete(item.key);
              }}
            />
          ))}
        </ul>
      )}
      {toggle}
      {dismissed.length > 0 ? (
        <ul aria-label="Dismissed suggestions" className="grid gap-3" hidden={!showDismissed} id={dismissedId}>
          {dismissed.map((item) => (
            <li className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" key={item.key}>
              <SuggestionText item={item} />
              <div className="grid gap-2 sm:flex sm:items-center">
                <StateNote icon="dismissed">Dismissed</StateNote>
                <Button aria-label={`Restore suggestion: ${suggestionLabel(item)}`} className="min-h-11 w-full md:min-h-8 sm:w-auto" onClick={() => decisions.restore(item)} size="sm" type="button" variant="ghost"><Undo2Icon aria-hidden="true" />Restore</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SuggestionRow({ adding, busy, item, onAdd, onDismiss, registerFirst }: {
  adding: boolean;
  busy: boolean;
  item: AiSuggestionReview;
  onAdd: () => void;
  onDismiss: () => void;
  registerFirst: (element: HTMLButtonElement | null) => void;
}) {
  const label = suggestionLabel(item);
  return (
    <li className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <SuggestionText item={item} />
      {item.state === 'proposed' ? (
        <div className="grid gap-2 sm:flex sm:items-center">
          <Button aria-busy={adding} aria-label={`Add as planned control: ${label}`} className="min-h-11 w-full md:min-h-8 sm:w-auto" disabled={busy} onClick={onAdd} ref={registerFirst} size="sm" type="button" variant="outline">
            {adding ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <PlusIcon aria-hidden="true" />}
            {adding ? 'Adding…' : 'Add as planned control'}
          </Button>
          <Button aria-label={`Dismiss suggestion: ${label}`} className="min-h-11 w-full md:min-h-8 sm:w-auto" disabled={busy} onClick={onDismiss} size="sm" type="button" variant="ghost"><XIcon aria-hidden="true" />Dismiss</Button>
        </div>
      ) : <StateNote icon="added">{item.state === 'added' ? 'Added as a planned control' : 'Already a mitigation control'}</StateNote>}
    </li>
  );
}

function SuggestionText({ item }: { item: AiSuggestionReview }) {
  return (
    <div className="grid min-w-0 gap-1">
      <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{suggestionLabel(item)}</p>
      <p className="whitespace-pre-wrap text-xs text-foreground-secondary">{item.rationale}</p>
    </div>
  );
}

function StateNote({ children, icon }: { children: string; icon: 'added' | 'dismissed' }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-foreground-secondary">
      {icon === 'added' ? <CheckIcon aria-hidden="true" className="size-3" /> : <XIcon aria-hidden="true" className="size-3" />}
      {children}
    </span>
  );
}
