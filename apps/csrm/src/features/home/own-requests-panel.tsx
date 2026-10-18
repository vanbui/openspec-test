import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';

import { RetryableErrorState } from '@/components/states/retryable-error-state';
import { homeLinkRowClassName, HomeSection, HomeSectionFooter } from './home-section';
import { ownRequestsCopy, ownRequestsRows, type RequestorHomeSection } from './requestor-home-presentation';

/** Who holds the analyst's own requests: the status summary's byHolder (D-11). */
export type OwnRequestHolderCounts = { requestor: number; analyst: number; none: number };

/**
 * The analyst Home's Your own requests (D-18 item 7, UI-SPEC §5.3): the requests the analyst raised as a
 * Requestor, apart from and after the review work. Each count is a whole-row link to My requests filtered by that
 * holder, so the list's total equals the figure (D-35); zero rows render. Its read fails on its own.
 */
export function OwnRequestsPanel({ className, state, canCreate = true }: { className?: string; state: RequestorHomeSection<OwnRequestHolderCounts>; canCreate?: boolean }) {
  if (state.status === 'unavailable') {
    return (
      <HomeSection className={className} copy={ownRequestsCopy}>
        <RetryableErrorState density="compact" headingLevel="h3" noun={ownRequestsCopy.errorNoun} />
      </HomeSection>
    );
  }

  const links = canCreate ? ownRequestsCopy.links : ownRequestsCopy.links.filter((link) => link.href !== '/app/requests/new');
  return (
    <HomeSection className={className} copy={ownRequestsCopy} footer={<HomeSectionFooter links={links} note={null} />}>
      <ul role="list">
        {ownRequestsRows(state.data).map((row) => (
          <li key={row.key}>
            <Link aria-label={row.accessibleName} className={homeLinkRowClassName} href={row.href}>
              <span className="min-w-0 flex-1 break-words">{row.label}</span>
              {/* A word break the flex row does not draw: the link's text reads as its name begins (SC 2.5.3). */}
              {' '}
              <span className="shrink-0 font-medium tabular-nums">{row.countText}</span>
              <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
