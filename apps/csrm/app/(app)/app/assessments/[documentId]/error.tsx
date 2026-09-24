'use client';

import { ErrorState } from '@/components/states/states';

export default function ReleasedAssessmentError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState retry={reset} />;
}
