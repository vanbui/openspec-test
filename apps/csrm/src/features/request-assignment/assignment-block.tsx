'use client';

import { Undo2, UserRoundPlus, UserRoundSearch, type LucideIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { DetailSection } from '@/components/csrm/detail-section';
import { LocalInstant } from '@/components/csrm/local-time';
import { landOn, useHashLanding } from '@/components/csrm/use-hash-landing';
import { Button } from '@/components/ui/button';
import { successToast } from '@/components/ui/success-toast';
import { toastAction } from '@/components/ui/toast-action';
import { isAnalystAssignmentView, type RequestAssignmentView } from '@/features/requests/request-domain';
import { clearSessionDraft, readSessionDraft } from '@/lib/session-drafts/session-drafts';

import type { AssignmentActionResult } from './assignment-actions';
import {
  assignmentActionLabel,
  assignmentActionName,
  assignmentCaption,
  assignmentFailureTitle,
  assignmentNotice,
  assignmentStatusLine,
  assignmentToast,
  nextAssignmentRequest,
  optimisticAssignment,
  orderedAssignmentActions,
  undoAllowed,
  undoAssignmentRequest,
  undoToast,
  type AssignmentPerson,
  type AssignmentViewAction,
  type RequestAssignment,
} from './assignment-domain';
import { AssignmentHistory } from './assignment-history';
import { sendAssignmentChange } from './send-assignment-change';

/*
 * 13-UI-SPEC §6: the picker's code loads when it is first wanted, so the request page's first load never carries it.
 * Pointing at or focusing Assign or Reassign starts loading it before it is pressed (IN-306).
 */
const loadPicker = () => import('./assign-picker');
const AssignPicker = dynamic(() => loadPicker().then((module) => module.AssignPicker), { ssr: false });

/*
 * The assignee control on the analyst's request page (13-UI-SPEC §5.2, §7; X-15; D-05, D-16, D-34). It shows who holds
 * the request and offers only the actions Strapi served for this viewer; Strapi decides every change again, so hiding a
 * control is never the refusal (T-13-31). Pick up, Assign to me and Return to queue apply at once at the pending
 * opacity, confirm with an X-14 Undo toast and roll back with family K's copy; nothing asks for confirmation. The words
 * and what each change sends come from assignment-domain.ts.
 */

export type AssignmentBlockProps = {
  requestId: string;
  requestNumber: string;
  requestStatus: string;
  assignment: RequestAssignmentView | null | undefined;
  /** The signed-in person's session-draft key (draft-owner-key.ts), which keeps the picker's reason per person. */
  draftOwnerKey: string | null;
};

/** The Requestor's view, or a read without an assignment, shows no control at all (D-17). */
export function AssignmentBlock({ assignment, ...props }: AssignmentBlockProps) {
  if (!assignment || !isAnalystAssignmentView(assignment)) return null;
  return <AnalystAssignmentBlock assignment={assignment} {...props} />;
}

const actionIcons: Record<AssignmentViewAction, LucideIcon> = {
  'pick-up': UserRoundPlus,
  assign: UserRoundSearch,
  'assign-to-me': UserRoundPlus,
  reassign: UserRoundSearch,
  unassign: Undo2,
};

type Failure = Extract<AssignmentActionResult<RequestAssignment>, { ok: false }>;

function AnalystAssignmentBlock({ assignment, draftOwnerKey, requestId, requestNumber, requestStatus }: Omit<AssignmentBlockProps, 'assignment'> & { assignment: RequestAssignment }) {
  const router = useRouter();
  /* What Strapi last served: the page's read, then each change's answer, until the page is read again. */
  const [served, setServed] = useState(assignment);
  const [read, setRead] = useState(assignment);
  if (assignment !== read) {
    setRead(assignment);
    setServed(assignment);
  }
  const [shown, show] = useOptimistic(served, (_current, next: RequestAssignment) => next);
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState<'assign' | 'reassign' | null>(null);
  /* The picker stays mounted once wanted, so a reason it keeps still arms the unload warning after it closes (UI-D31). */
  const [pickerMounted, setPickerMounted] = useState(false);
  const [pickerMode, setPickerMode] = useState<'assign' | 'reassign'>('assign');
  /* Whether the picker's code has arrived: until then the trigger says it is busy, never that a picker is open (IN-306). */
  const [pickerLoaded, setPickerLoaded] = useState(false);
  const statusLine = useRef<HTMLParagraphElement>(null);
  const pickerTrigger = useRef<HTMLButtonElement>(null);

  /*
   * D1 (the 13-19 walk): `Pick up on the request page` links to #assignment (§11), which streams in after the browser and
   * the router have tried to scroll there, so the block lands on its own region once it exists, focusing its heading.
   */
  useHashLanding((id) => {
    const region = id === 'assignment' ? document.getElementById(id) : null;
    if (region) landOn(region);
  });

  /* A reason kept earlier in this session (before in-app navigation, say) mounts the picker closed, so it is guarded. */
  useEffect(() => {
    if (draftOwnerKey && readSessionDraft('assign', draftOwnerKey, requestId)) setPickerMounted(true);
  }, [draftOwnerKey, requestId]);

  /* One handler for the block's life, so the open picker is not handed a new one on every render (WR-304). */
  const pickerOpenChange = useCallback((open: boolean) => {
    if (!open) setPicker(null);
  }, []);

  function preloadPicker() {
    void loadPicker().then(() => setPickerLoaded(true), () => undefined);
  }

  function openPicker(mode: 'assign' | 'reassign') {
    preloadPicker();
    setPickerMode(mode);
    setPickerMounted(true);
    setPicker(mode);
  }

  const focusStatus = () => statusLine.current?.focus();

  /* §7.2: the change has already rolled back; a danger toast says why, with Try again or Refresh page. */
  function refused(title: string, failure: Failure, retry: () => void) {
    toast.error(title, {
      description: failure.message,
      duration: Infinity,
      action: failure.kind === 'retryable' ? toastAction('Try again', retry) : toastAction('Refresh page', () => router.refresh()),
    });
    /* §7.4: someone else changed it first, so the page reads who holds it now. */
    if (failure.reason === 'ASSIGNMENT_CHANGED') router.refresh();
  }

  /* An Undo is a second recorded change that gives the request back to who held it before (§7.1). */
  function undo(action: AssignmentViewAction, before: RequestAssignment, after: RequestAssignment) {
    const holder = before.assignee;
    const analystName = holder && holder.documentId !== after.viewer.documentId ? holder.displayName : undefined;
    focusStatus();
    startTransition(async () => {
      show(optimisticAssignment(after, holder, new Date().toISOString()));
      const result = await sendAssignmentChange({ requestId, requestNumber, ...undoAssignmentRequest(before, after), ...(analystName ? { analystName } : {}) });
      if (!result.ok) {
        refused('Couldn’t undo', result, () => undo(action, before, after));
        return;
      }
      setServed(result.data);
      successToast(undoToast(action, { requestNumber, previous: holder?.displayName }));
      focusStatus();
      router.refresh();
    });
  }

  /** Applies a change at once and sends it; resolves whether Strapi recorded it. */
  function apply(action: AssignmentViewAction, target?: AssignmentPerson, reason?: string): Promise<boolean> {
    const before = served;
    const request = nextAssignmentRequest(before, action, target);
    const holder = action === 'unassign' ? null : target ?? before.viewer;
    const analystName = holder && holder.documentId !== before.viewer.documentId ? holder.displayName : undefined;
    focusStatus();
    return new Promise((resolve) => {
      startTransition(async () => {
        show(optimisticAssignment(before, holder, new Date().toISOString()));
        const result = await sendAssignmentChange({
          requestId,
          requestNumber,
          ...request,
          ...(analystName ? { analystName } : {}),
          ...(reason ? { reason } : {}),
        });
        resolve(result.ok);
        if (!result.ok) {
          refused(assignmentFailureTitle(action), result, () => void apply(action, target, reason));
          return;
        }
        const after = result.data;
        setServed(after);
        /*
         * A picker change is recorded, by its own submit or by the danger toast's Try again: its kept reason and choice
         * are done with, and the closed picker unmounts, so nothing restores them or keeps the unload warning armed
         * (13-UI-SPEC §6, UI-D31, WR-302).
         */
        if (action === 'assign' || action === 'reassign') {
          if (draftOwnerKey) clearSessionDraft('assign', draftOwnerKey, requestId);
          setPickerMounted(false);
        }
        const message = assignmentToast(action, { requestNumber, name: holder?.displayName, previous: before.assignee?.displayName }, requestStatus);
        successToast(message, { action: undoAllowed(action, requestStatus) ? toastAction('Undo', () => undo(action, before, after)) : undefined });
        focusStatus();
        router.refresh();
      });
    });
  }

  const actions = orderedAssignmentActions(shown.actions);
  const caption = assignmentCaption(shown, requestStatus);
  const notice = assignmentNotice(shown, requestStatus);

  return (
    <div className="scroll-mt-24" id="assignment">
      <DetailSection headingFocusable title="Assignment">
        <div className="grid gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-start md:justify-between md:gap-4">
            {/* 13-UI-SPEC Motion: the pending opacity applies at once; leaving it, and a rollback, ease back at --duration-base. */}
            <div className="grid min-w-0 gap-2 transition-opacity duration-(--duration-base) ease-standard data-[pending=true]:opacity-60 data-[pending=true]:transition-none" data-pending={pending}>
              <p className="text-sm font-medium text-foreground break-words outline-none focus-visible:ring-2 focus-visible:ring-ring" ref={statusLine} tabIndex={-1}>
                {assignmentStatusLine(shown)}
              </p>
              {caption ? (
                <p className="text-xs text-foreground-secondary break-words">
                  {caption.text}
                  {caption.at ? <>{' '}<LocalInstant style="date-time" value={caption.at} /></> : null}
                </p>
              ) : null}
              {notice ? <p className="text-sm text-foreground-secondary">{notice}</p> : null}
            </div>
            {actions.length > 0 ? (
              <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:justify-end print:hidden">
                {actions.map((action) => {
                  const Icon = actionIcons[action];
                  const opensPicker = action === 'assign' || action === 'reassign';
                  const opening = opensPicker && picker === action;
                  return (
                    <Button
                      aria-busy={opening && !pickerLoaded ? true : undefined}
                      aria-expanded={opensPicker ? opening && pickerLoaded : undefined}
                      aria-haspopup={opensPicker ? 'dialog' : undefined}
                      aria-label={assignmentActionName(action, requestNumber)}
                      className="max-md:min-h-11 max-md:w-full aria-busy:opacity-60"
                      disabled={pending}
                      key={action}
                      onClick={() => (opensPicker ? openPicker(action) : void apply(action))}
                      onFocus={opensPicker ? preloadPicker : undefined}
                      onPointerEnter={opensPicker ? preloadPicker : undefined}
                      ref={opensPicker ? pickerTrigger : undefined}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Icon aria-hidden="true" />
                      {assignmentActionLabel(action)}
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <AssignmentHistory events={shown.history} />
        </div>
      </DetailSection>
      {pickerMounted ? (
        <AssignPicker
          anchor={pickerTrigger}
          currentAssigneeId={served.assignee?.documentId ?? null}
          draftOwnerKey={draftOwnerKey}
          mode={pickerMode}
          onAssign={(analyst, reason) => apply(pickerMode, analyst, reason)}
          onOpenChange={pickerOpenChange}
          open={picker !== null}
          requestId={requestId}
          requestNumber={requestNumber}
          returnFocus={(assigned) => (assigned ? focusStatus() : pickerTrigger.current?.focus())}
        />
      ) : null}
    </div>
  );
}
