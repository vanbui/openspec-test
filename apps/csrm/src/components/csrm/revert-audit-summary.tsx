import { UndoDotIcon } from 'lucide-react';

import { LocalInstant } from './local-time';

export interface RevertAuditFacts {
  revertReason?: string | null;
  revertedAt?: string | null;
  revertedBy?: { documentId: string; displayName?: string | null } | null;
}

/*
 * The latest reversal facts for a record. A questionnaire additionally carries
 * its complete revision timeline, rendered by QuestionnaireRevisionTimeline.
 * This remains the latest-fact summary used by request detail.
 */
export function RevertAuditSummary({ className, facts }: { className?: string; facts: RevertAuditFacts }) {
  if (!facts.revertReason) return null;

  /* A document id is an opaque identifier, not a person; never show one as a name (UI-SPEC §4.4). */
  const by = facts.revertedBy?.displayName?.trim() || 'Not recorded';

  return (
    <section className={className} aria-labelledby="revert-audit-heading">
      <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-surface-muted p-4">
        <h2 className="micro-label flex items-center gap-2 text-foreground-secondary" id="revert-audit-heading">
          <UndoDotIcon aria-hidden="true" className="size-3.5" />
          Last returned to draft
        </h2>
        <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-3">
          <div className="grid min-w-0 gap-1 sm:col-span-3">
            <dt className="text-xs font-medium text-muted-foreground">Reason</dt>
            {/*
              * A reason may be 500 characters with no spaces in it. Two things
              * are needed: min-w-0 down the grid chain, because a Tailwind
              * `grid` with no column definition gives one auto track sized to
              * max-content; and overflow-wrap:anywhere rather than break-word,
              * because only `anywhere` reduces the intrinsic minimum the track
              * is sized from. With break-word alone the track still measured the
              * unbroken string and scrolled the page sideways.
              */}
            <dd className="[overflow-wrap:anywhere] text-foreground">{facts.revertReason}</dd>
          </div>
          <div className="grid min-w-0 gap-1">
            <dt className="text-xs font-medium text-muted-foreground">When</dt>
            <dd className="text-foreground tabular-nums">
              <LocalInstant fallback="Not recorded" style="date-time" value={facts.revertedAt} />
            </dd>
          </div>
          <div className="grid min-w-0 gap-1">
            <dt className="text-xs font-medium text-muted-foreground">By</dt>
            <dd className="[overflow-wrap:anywhere] text-foreground">{by}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
