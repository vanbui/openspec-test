import { AlertUrgencyBadge } from '@/components/csrm/alert-urgency-badge';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import {
  alertConditionSentence,
  alertDateLabel,
  alertReleasedNote,
  alertResidualDisplay,
  alertSourceHref,
  alertSourceSecondaryText,
  formatAlertDate,
} from './alert-presentation';
import type { AlertItem } from './alert-schema';

export type AlertRowVariant = 'default' | 'agenda';

export type AlertRowProps = {
  alert: AlertItem;
  /** `agenda` leads with the date instead of the urgency badge, for a list that is all due soon. */
  variant?: AlertRowVariant;
};

function AlertDate({ className, value }: { className?: string; value: string | null }) {
  const text = formatAlertDate(value);
  return value ? <time className={className} dateTime={value}>{text}</time> : <span className={className}>{text}</span>;
}

/**
 * One derived alert (UI-SPEC §3.5): the Alerts screen's mobile card, and the row the dashboard and
 * reports reuse. The row adapts to its own container: below `@md` it stacks, and from `@md` it
 * reads as two lines, the condition with the badges at the end, then the record with its date at
 * the end. The record identifier and its description share a line only from `@2xl`: in a
 * half-width dashboard widget they stack, so the description keeps a readable measure instead of
 * squeezing into the space the identifier and date leave. The badges lead the DOM in every layout, so assistive technology hears the urgency
 * first; the record identifier is the row's single link.
 */
export function AlertRow({ alert, variant = 'default' }: AlertRowProps) {
  const residual = alertResidualDisplay(alert);
  const releasedNote = alertReleasedNote(alert);

  return (
    <article className="@container" data-alert-kind={alert.kind} data-slot="alert-row" data-variant={variant}>
      <div className="grid grid-cols-1 gap-y-1 @md:grid-cols-[minmax(0,1fr)_auto] @md:gap-x-4">
        <div className="flex flex-wrap items-center gap-1 @md:col-start-2 @md:row-start-1 @md:justify-end">
          {variant === 'agenda'
            ? <AlertDate className="text-sm font-medium tabular-nums text-foreground" value={alert.governingDate} />
            : <AlertUrgencyBadge urgency={alert.urgency} />}
          {residual.kind === 'rating' ? <RiskRatingBadge rating={residual.rating} /> : null}
          {residual.kind === 'not-rated' ? (
            <span className="text-xs text-foreground-secondary">
              <span className="sr-only">Residual rating: </span>
              {residual.text}
            </span>
          ) : null}
        </div>
        <p className="text-sm font-medium text-foreground @md:col-start-1 @md:row-start-1">{alertConditionSentence(alert)}</p>
        <div className="flex min-w-0 flex-col @md:col-start-1 @md:row-start-2 @2xl:flex-row @2xl:flex-wrap @2xl:items-baseline @2xl:gap-x-2">
          <RecordLink className="inline-flex min-h-11 items-center self-start tabular-nums md:min-h-6" href={alertSourceHref(alert)}>
            {alert.source.identifier}
          </RecordLink>
          <p className="line-clamp-2 min-w-0 text-xs text-foreground-secondary @2xl:flex-1">{alertSourceSecondaryText(alert)}</p>
          {releasedNote ? <p className="text-xs text-foreground-secondary @md:basis-full">{releasedNote}</p> : null}
        </div>
        {variant === 'agenda' ? null : (
          <p className="text-xs tabular-nums text-foreground-secondary @md:col-start-2 @md:row-start-2 @md:text-end">
            {alertDateLabel(alert.kind)} · <AlertDate value={alert.governingDate} />
          </p>
        )}
      </div>
    </article>
  );
}
