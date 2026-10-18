import { cn } from '@/lib/utils';

/*
 * Claims the AI made without a source (12-UI-SPEC §4.3; D-14, UI-D10). While a proposed field remains they are a
 * warning to check before confirming; once none remains they stay for reference until release. Claims render as
 * text, never markup. Each Risk can hold claims, so the region is named by its Risk as well as its heading (axe
 * landmark-unique).
 */
export function AiUncitedClaims({ claims, reviewOutstanding, riskNumber }: { claims: readonly string[]; reviewOutstanding: boolean; riskNumber: string }) {
  if (claims.length === 0) return null;
  const heading = reviewOutstanding ? 'Claims to check' : 'Claims the AI couldn’t support';
  return (
    <section
      aria-label={`${heading} for ${riskNumber}`}
      className={cn(
        'grid gap-2 rounded-lg border p-4',
        reviewOutstanding ? 'border-warning-border bg-warning-subtle' : 'border-border bg-surface',
      )}
    >
      <h4 className="text-heading-sm text-foreground">{heading}</h4>
      <p className="text-sm text-foreground-secondary">
        {reviewOutstanding
          ? 'The AI made these claims without a source in the request or answers. Check each one before you confirm the fields that rely on it.'
          : 'Kept for reference until release.'}
      </p>
      <ul className="grid list-disc gap-1 pl-5">
        {claims.map((claim, index) => <li className="text-sm text-foreground [overflow-wrap:anywhere]" key={`${index}-${claim}`}>{`“${claim}”`}</li>)}
      </ul>
    </section>
  );
}
