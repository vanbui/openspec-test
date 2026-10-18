'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useId, useState } from 'react';

import { LocalInstant } from '@/components/csrm/local-time';
import { Button } from '@/components/ui/button';

import { historySentence, type AssignmentEvent } from './assignment-domain';

/*
 * The assignment history (13-UI-SPEC §5.3, D-09; UI-D27): an outline toggle, then an ordered list newest first, one
 * sentence per change with its time and any reason quoted on its own caption line. A log Strapi could not read arrives
 * as null and shows no toggle (fail safe), as does a request that has never been assigned. Names and reasons are React
 * text, never markup (T-13-33). The list prints when it is open.
 */
export function AssignmentHistory({ events }: { events: readonly AssignmentEvent[] | null }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (!events || events.length === 0) return null;
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <div className="grid gap-2">
      <Button
        aria-controls={listId}
        aria-expanded={open}
        className="w-fit max-md:min-h-11 max-md:w-full print:hidden"
        onClick={() => setOpen((current) => !current)}
        size="sm"
        type="button"
        variant="outline"
      >
        <Chevron aria-hidden="true" />
        {open ? 'Hide assignment history' : `Show assignment history (${events.length})`}
      </Button>
      {open ? (
        <ol aria-label="Assignment history" className="divide-y divide-border" id={listId}>
          {events.map((event, index) => (
            <li className="grid gap-1 py-4 first:pt-2" key={`${event.at}-${index}`}>
              <p className="text-sm text-foreground break-words">{historySentence(event)}</p>
              <p className="text-xs text-foreground-secondary"><LocalInstant style="date-time" value={event.at} /></p>
              {event.reason ? <p className="text-xs text-foreground-secondary whitespace-pre-wrap break-words">{`Reason: “${event.reason}”`}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
