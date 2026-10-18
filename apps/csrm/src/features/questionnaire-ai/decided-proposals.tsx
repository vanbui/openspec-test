'use client';

import { Check, ChevronDown, ChevronUp, ListRestart, Lock, PenLine, Undo2, X } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  decidedNote,
  itemEyebrow,
  itemSubject,
  proposedCaption,
  type DecidedNote,
  type ItemActions,
  type QuestionnaireAiItemView,
  type QuestionnaireAiRunView,
} from './questionnaire-ai-domain';
import { Eyebrow, proposalKey, useInstant } from './proposal-item-card';

/*
 * 15-UI-SPEC §4.6: the decided proposals, collapsed after the open groups, newest first as the read serves them. Each is a
 * compact card with who asked and how it was decided; Undo shows where D-23 allows it. Loaded on demand by the panel
 * (D-35), so a questionnaire with no decided proposal never downloads it.
 */
const noteIcons: Record<DecidedNote['icon'], typeof Check> = { Check, PenLine, X, ListRestart, Lock };

export function DecidedProposals({ actionsFor, items, onUndo, runs }: {
  actionsFor: (item: QuestionnaireAiItemView) => ItemActions;
  items: readonly QuestionnaireAiItemView[];
  onUndo: (item: QuestionnaireAiItemView) => void;
  runs: readonly QuestionnaireAiRunView[];
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const instant = useInstant();
  if (items.length === 0) return null;
  return (
    <div className="grid gap-3">
      <Button aria-controls={listId} aria-expanded={open} className="w-fit max-md:min-h-11" data-print="hidden" onClick={() => setOpen(!open)} size="sm" type="button" variant="outline">
        {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        {open ? 'Hide decided proposals' : `Show decided proposals (${items.length.toLocaleString('en-AU')})`}
      </Button>
      <ol className="grid gap-2" hidden={!open} id={listId}>
        {items.map((item) => {
          const run = runs.find((candidate) => candidate.runId === item.runId);
          const subject = itemSubject(item);
          const note = decidedNote(item, { deciderName: item.decision?.by?.displayName ?? null, instant: instant(item.decision?.at ?? null) });
          const NoteIcon = note ? noteIcons[note.icon] : null;
          return (
            <li className="grid gap-1 rounded-lg border border-border bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" id={`ai-proposal-${item.runId}-${item.itemKey}`} key={proposalKey(item)} tabIndex={-1}>
              {run ? <Eyebrow eyebrow={itemEyebrow(item, run)} /> : null}
              <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{subject}</p>
              {run ? <p className="text-xs text-foreground-secondary">{proposedCaption(instant(run.completedAt ?? run.startedAt), run.initiatedBy?.displayName ?? 'a Security Analyst')}</p> : null}
              {note && NoteIcon ? <p className="flex items-center gap-1 text-xs text-foreground-secondary"><NoteIcon aria-hidden="true" className="size-3 shrink-0" />{note.text}</p> : null}
              {note?.reason ? <p className="whitespace-pre-wrap text-xs text-foreground-secondary [overflow-wrap:anywhere]">{note.reason}</p> : null}
              {actionsFor(item).undo ? <Button aria-label={`Undo: ${subject}`} className="w-fit max-md:min-h-11" data-print="hidden" data-proposal-undo={proposalKey(item)} onClick={() => onUndo(item)} size="sm" type="button" variant="ghost"><Undo2 aria-hidden="true" />Undo</Button> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
