'use client';

import { History, RotateCcw } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRef, useState, type ComponentType, type RefObject } from 'react';

import { Button } from '@/components/ui/button';

import type { RiskHistoryEvent } from './risk-curation-domain';
import {
  DelayedRiskHistorySkeleton,
  HISTORY_LOAD_FAILED,
  RiskHistoryFrame,
  RiskHistoryMessage,
  type RiskHistorySheetProps,
} from './risk-history-frame';

/*
 * A Risk's `History` (16-UI-SPEC §8.1; X-29; D-48). The pill and the sheet's frame ship with the page; the sheet's body,
 * with its entries, comparison and paging, loads through next/dynamic the first time someone opens a history, and
 * pointer enter or focus on the pill starts that load early. A body that cannot load says so in the frame with `Try
 * again`, which loads it afresh, rather than replacing the page with its error boundary (12-15's WR-307).
 *
 * `RiskHistoryTrigger` is the pill and its sheet. `RiskHistoryDialog` is the sheet alone, opened by a control elsewhere
 * (the card actions' `History`, the phone menu), which passes the control that opened it to take focus back on close.
 */
const loadSheet = () => import('./risk-history-sheet');

function RiskHistoryLoadFailed({ onReload }: RiskHistorySheetProps) {
  return (
    <RiskHistoryMessage
      action={<Button className="w-fit max-md:min-h-11" onClick={onReload} size="sm" type="button" variant="outline"><RotateCcw aria-hidden="true" />Try again</Button>}
      description={HISTORY_LOAD_FAILED.description}
      title={HISTORY_LOAD_FAILED.title}
      tone="error"
    />
  );
}

/* A failed load resolves to the failure state, so loading again needs a fresh loader. */
function createRiskHistorySheet(since: () => number): ComponentType<RiskHistorySheetProps> {
  return dynamic(
    () => loadSheet().then((module) => module.RiskHistorySheet, (): ComponentType<RiskHistorySheetProps> => RiskHistoryLoadFailed),
    { ssr: false, loading: () => <DelayedRiskHistorySkeleton since={since()} /> },
  );
}

export type RiskHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskId: string;
  riskNumber: string;
  ownerKey: string | null;
  /** The control that opened the sheet, which takes focus back when it closes. */
  returnFocusTo: RefObject<HTMLElement | null>;
  /** When the sheet opened; defaults to when its frame first rendered open. */
  openedAt?: number;
  proposalHref?: (event: RiskHistoryEvent) => string | null;
};

export function RiskHistoryDialog({ onOpenChange, open, openedAt, ownerKey, proposalHref, returnFocusTo, riskId, riskNumber }: RiskHistoryDialogProps) {
  const title = useRef<HTMLHeadingElement>(null);
  const [frameOpenedAt, setFrameOpenedAt] = useState(() => Date.now());
  const [wasOpen, setWasOpen] = useState(open);
  /* Track when the frame opened, so the skeleton's 300 ms count from the open, whatever opened it. */
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFrameOpenedAt(Date.now());
  }
  const since = openedAt ?? frameOpenedAt;
  const sinceRef = useRef(since);
  sinceRef.current = since;
  const [Body, setBody] = useState(() => createRiskHistorySheet(() => sinceRef.current));

  return (
    <RiskHistoryFrame onOpenChange={onOpenChange} open={open} returnFocusTo={returnFocusTo} riskNumber={riskNumber} titleRef={title}>
      <Body
        onReload={() => {
          setBody(() => createRiskHistorySheet(() => sinceRef.current));
          title.current?.focus();
        }}
        open={open}
        openedAt={since}
        ownerKey={ownerKey}
        proposalHref={proposalHref}
        riskId={riskId}
        riskNumber={riskNumber}
        titleRef={title}
      />
    </RiskHistoryFrame>
  );
}

export type RiskHistoryTriggerProps = {
  riskId: string;
  riskNumber: string;
  ownerKey: string | null;
  /** `History` (ghost) on a card; `Show history` (outline) in a page header (§8.1, §11.3). */
  variant?: 'card' | 'header';
  proposalHref?: (event: RiskHistoryEvent) => string | null;
};

export function RiskHistoryTrigger({ ownerKey, proposalHref, riskId, riskNumber, variant = 'card' }: RiskHistoryTriggerProps) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const prefetch = () => { loadSheet().catch(() => undefined); };
  const card = variant === 'card';

  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-label={card ? `History of ${riskNumber}` : undefined}
        className="max-md:min-h-11"
        data-print="hidden"
        onClick={() => { setOpenedAt(Date.now()); setOpen(true); }}
        onFocus={prefetch}
        onPointerEnter={prefetch}
        ref={trigger}
        size="sm"
        type="button"
        variant={card ? 'ghost' : 'outline'}
      >
        <History aria-hidden="true" />{card ? 'History' : 'Show history'}
      </Button>
      <RiskHistoryDialog onOpenChange={setOpen} open={open} openedAt={openedAt} ownerKey={ownerKey} proposalHref={proposalHref} returnFocusTo={trigger} riskId={riskId} riskNumber={riskNumber} />
    </>
  );
}
