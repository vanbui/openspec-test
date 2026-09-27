'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useMemo,
  useOptimistic,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from 'react';

import { SegmentedControl } from '@/components/csrm/segmented-control';
import { reportPeriods, type ReportPeriod } from './report-periods';

/*
 * The throughput period (UI-SPEC §4.5). The period lives in the URL (`?period=6|12`, default 6), so
 * a change replaces the URL and the report re-renders on the server. The navigation runs inside one
 * transition, which the header control and the report body share: while it is pending the old
 * report stays on screen marked busy, with no spinner, and the new one replaces it in place.
 */

type ReportTransition = { pending: boolean; startTransition: TransitionStartFunction };

const ReportTransitionContext = createContext<ReportTransition | null>(null);

/** Shares one navigation transition between the header's period control and the report body. */
export function ReportTransitionProvider({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const transition = useMemo(() => ({ pending, startTransition }), [pending, startTransition]);
  return <ReportTransitionContext value={transition}>{children}</ReportTransitionContext>;
}

/** The report body, marked `aria-busy` while a period change is loading the new report. */
export function ReportBody({ children }: { children: ReactNode }) {
  const transition = useContext(ReportTransitionContext);
  return <div aria-busy={transition?.pending ? true : undefined} data-slot="report-body">{children}</div>;
}

type PeriodValue = `${ReportPeriod}`;

const periodOptions = reportPeriods.map((period) => ({ value: `${period}` as PeriodValue, label: `${period} months` }));

/**
 * The Period segmented control. The chosen segment is checked at once, while the new report loads,
 * and the control is never remounted by the navigation, so focus stays on the checked segment.
 */
export function ReportPeriodControl({ period }: { period: ReportPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const shared = useContext(ReportTransitionContext);
  const [, startLocalTransition] = useTransition();
  const startTransition = shared?.startTransition ?? startLocalTransition;
  const [shownPeriod, showPeriod] = useOptimistic<ReportPeriod, ReportPeriod>(period, (_, next) => next);

  return (
    <SegmentedControl
      // From md the header sets the control beside the title in one row. Its segments share the
      // width equally and could otherwise be squeezed below their labels, so the control keeps its
      // own width and the description wraps instead.
      className="md:shrink-0"
      label="Period"
      onValueChange={(value: PeriodValue) => {
        const next: ReportPeriod = value === '12' ? 12 : 6;
        startTransition(() => {
          showPeriod(next);
          router.replace(`${pathname}?period=${next}`, { scroll: false });
        });
      }}
      options={periodOptions}
      value={`${shownPeriod}` as PeriodValue}
    />
  );
}
