'use client';

import { Archive, EllipsisVertical, History, Sparkles } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { curationFormId } from './risk-curation-domain';

/*
 * A Risk card's actions (16-UI-SPEC §6.1, §8.1, §12.3; UI-D4; X-27). From 768px they are small pills in the card header,
 * in the order Rewrite this risk, History, Withdraw risk; below 768px one circular `Actions for {risk number}` button opens
 * a menu with the same items at the touch-target height. Both layouts are in the markup and the breakpoint shows one, so
 * a phone never paints the pills before hydration. The requesting analyst is offered History and Withdraw risk only.
 * Showing an action is a courtesy: Strapi decides every act again.
 */
export type RiskCardRewrite = {
  /** The rewrite form's own trigger (16-13), shown as the first pill from 768px. */
  readonly trigger: ReactNode;
  /** Opens the rewrite form from the phone menu. */
  readonly open: () => void;
};

export type RiskCardActionsProps = {
  riskId: string;
  riskNumber: string;
  /** Rewrite this risk, when the card offers it; null on a released or withdrawn Risk, or while it cannot be asked. */
  rewrite: RiskCardRewrite | null;
  /** Opens the history; receives the control that opened it, so focus returns there when it closes. */
  onHistory: (opener: HTMLElement | null) => void;
  /** Opens the withdraw form; receives the control that opened it, so Keep risk returns focus there. */
  onWithdraw: (opener: HTMLElement | null) => void;
  /** The Security Analyst who raised the request: History and Withdraw risk only (§12.3). */
  requestingAnalyst?: boolean;
  /** Whether this Risk's withdraw form is open, for the pill's `aria-expanded`. */
  withdrawOpen?: boolean;
};

export function RiskCardActions({ onHistory, onWithdraw, requestingAnalyst = false, rewrite, riskId, riskNumber, withdrawOpen }: RiskCardActionsProps) {
  const menuTrigger = useRef<HTMLButtonElement>(null);
  /* An item that opens a form or a sheet takes focus there, so the menu does not hand it back to its button. */
  const handedOn = useRef(false);
  const offered = requestingAnalyst ? null : rewrite;
  const historyName = `History of ${riskNumber}`;
  const withdrawName = `Withdraw risk ${riskNumber}`;

  function fromMenu(act: () => void) {
    handedOn.current = true;
    act();
  }

  return (
    <div className="flex items-center" data-risk-actions={riskId}>
      <div className="hidden flex-wrap items-center gap-2 md:flex" data-card-actions="pills">
        {offered ? offered.trigger : null}
        <Button aria-label={historyName} data-print="hidden" onClick={(event) => onHistory(event.currentTarget)} size="sm" type="button" variant="ghost">
          <History aria-hidden="true" />History
        </Button>
        <Button aria-controls={curationFormId('withdraw', riskId)} aria-expanded={withdrawOpen} aria-label={withdrawName} data-print="hidden" onClick={(event) => onWithdraw(event.currentTarget)} size="sm" type="button" variant="ghost">
          <Archive aria-hidden="true" />Withdraw risk
        </Button>
      </div>
      <div className="md:hidden" data-card-actions="menu" data-print="hidden">
        {/*
          Not modal: a modal menu aria-hides the rest of the page while its controls stay focusable (axe
          aria-hidden-focus). The menu still takes focus, closes on Escape, Tab and an outside press, and hands focus on.
        */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Actions for ${riskNumber}`} className="size-11 rounded-full" ref={menuTrigger} size="icon" type="button" variant="ghost">
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(event) => {
              if (!handedOn.current) return;
              handedOn.current = false;
              event.preventDefault();
            }}
          >
            {offered ? (
              <DropdownMenuItem aria-label={`Rewrite this risk: ${riskNumber}`} className="min-h-11" onSelect={() => fromMenu(offered.open)}>
                <Sparkles aria-hidden="true" />Rewrite this risk
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem aria-label={historyName} className="min-h-11" onSelect={() => fromMenu(() => onHistory(menuTrigger.current))}>
              <History aria-hidden="true" />History
            </DropdownMenuItem>
            <DropdownMenuItem aria-label={withdrawName} className="min-h-11" onSelect={() => fromMenu(() => onWithdraw(menuTrigger.current))}>
              <Archive aria-hidden="true" />Withdraw risk
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
