'use client';

import { ErrorState } from '@/components/states/states';

/* 19-UI-SPEC §4.4 (Phase 11 §2.4 anatomy): `We couldn’t load this report` and `Try again`; the cause stays in the server log. */
export default function RequestorReportError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState noun="this report" retry={reset} />;
}
