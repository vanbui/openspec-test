import { Suspense } from 'react';

import { AnalystDashboardSkeleton } from '@/features/analyst-dashboard/analyst-dashboard';
import { AnalystHomeContent } from '@/features/home/analyst-home';
import { HomePageHeader } from '@/features/home/home-page-header';
import { RequestorHomeContent, RequestorHomeSkeleton } from '@/features/home/requestor-home';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';

export const metadata = { title: 'Home | IdamBox CSRM' };

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Home for every actor (D-16). The session's capabilities, read from the session without Strapi,
 * choose the analyst Home (the review summary) or the Requestor Home before any data read, so a
 * Requestor issues no analyst read, fixture or partial selector (T-11-01), and each Home streams
 * behind its own skeleton. The choice is presentation, never authorisation: every read the chosen
 * Home makes is authorised by Strapi.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  const analyst = can('assessment:review', granted);

  return (
    <>
      <HomePageHeader variant={analyst ? 'analyst' : 'requestor'} />
      <Suspense fallback={analyst ? <AnalystDashboardSkeleton /> : <RequestorHomeSkeleton />}>
        {analyst ? <AnalystHomeContent searchParams={searchParams} /> : <RequestorHomeContent searchParams={searchParams} />}
      </Suspense>
    </>
  );
}
