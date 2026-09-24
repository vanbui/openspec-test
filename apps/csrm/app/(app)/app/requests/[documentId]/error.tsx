'use client';

import { ErrorState } from '@/components/states/states';

export default function RequestDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState retry={reset} />;
}
