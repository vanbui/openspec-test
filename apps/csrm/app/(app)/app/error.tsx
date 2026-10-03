'use client';

import { ErrorState } from '@/components/states/states';
import { HomePageHeader } from '@/features/home/home-page-header';

/* retry re-fetches and re-renders the segment (Next.js 16.3), so Try again reloads Home. */
export default function HomeError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <HomePageHeader withAction={false} />
      <ErrorState retry={retry} />
    </>
  );
}
