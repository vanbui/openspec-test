'use client';

import { useRouter } from 'next/navigation';

import { ErrorState, type ErrorStateProps } from './states';

export type RetryableErrorStateProps = Pick<ErrorStateProps, 'density' | 'description' | 'headingLevel' | 'noun'>;

/**
 * The shared error state with a "Try again" that re-renders the current route from the server. A
 * server component can place it wherever a read failed, since it needs no callback from its parent.
 */
export function RetryableErrorState({ density, description, headingLevel, noun }: RetryableErrorStateProps) {
  const router = useRouter();

  return (
    <ErrorState
      density={density}
      description={description}
      headingLevel={headingLevel}
      noun={noun}
      retry={() => router.refresh()}
    />
  );
}
