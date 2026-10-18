'use client';

import { AlertCircle } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import { useUnloadWarning } from '@/components/csrm/use-unload-warning';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { readSessionDraft, writeSessionDraft, type SessionDraftKind } from '@/lib/session-drafts/session-drafts';
import { instructionCountLine } from './questionnaire-ai-domain';

/*
 * The AI instruction field (X-25; 15-UI-SPEC §3; D-17 to D-19): optional, three rows growing to eight, never cut by a
 * length limit, so a paste is kept whole and the 500-character rule is said on submit. Its unsent text is kept for the
 * browser session per person and record and restored with a caption; while it holds text, the browser warns before the
 * tab closes or reloads (in-app navigation keeps the text, so no dialog). A refusal never clears it; the caller clears it
 * once the AI has been asked. Reused by the rewrite control (15-12) and the hub (15-13).
 */
export type InstructionDraft = { readonly kind: SessionDraftKind; readonly recordId: string; readonly ownerKey: string | null };

export const INSTRUCTION_LABEL = 'Instruction for the AI (optional)';
export const RESTORED_CAPTION = 'Restored from earlier in this session.';

export function InstructionField({ draft, error, fieldRef, hint, id, label = INSTRUCTION_LABEL, onChange, onSubmitShortcut, value }: {
  id: string;
  label?: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  /** The field's error (§3.1's over-500 line, or Q1's instruction refusals), shown under it; null when none. */
  error: string | null;
  draft: InstructionDraft | null;
  onSubmitShortcut: () => void;
  fieldRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const [restored, setRestored] = useState(false);
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = fieldRef ?? ownRef;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const count = instructionCountLine(value.length);

  /* §3.2: restore the session's unsent text once, when the field opens empty. */
  useEffect(() => {
    if (!draft?.ownerKey || value !== '') return;
    const kept = readSessionDraft(draft.kind, draft.ownerKey, draft.recordId);
    if (kept) {
      onChange(kept);
      setRestored(true);
    }
    // Only on opening: a later empty value is the person's own, or a cleared field after the AI was asked.
  }, [draft?.kind, draft?.ownerKey, draft?.recordId]);

  useUnloadWarning(value.trim().length > 0);

  function change(next: string) {
    onChange(next);
    if (draft?.ownerKey) writeSessionDraft(draft.kind, draft.ownerKey, draft.recordId, next);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSubmitShortcut();
    }
  }

  return (
    <div className="grid w-full max-w-[640px] gap-2">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-xs text-foreground-secondary" id={hintId}>{hint}</p>
      <Textarea
        aria-describedby={[hintId, error ? errorId : null].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-keyshortcuts="Control+Enter Meta+Enter"
        className="max-h-48 min-h-[4.75rem] overflow-y-auto"
        id={id}
        onChange={(event) => change(event.target.value)}
        onKeyDown={keyDown}
        ref={ref}
        rows={3}
        value={value}
      />
      {count ? <p className="text-xs tabular-nums text-foreground-secondary">{count}</p> : null}
      {restored && value ? <p className="text-xs text-foreground-secondary">{RESTORED_CAPTION}</p> : null}
      {error ? <p className="flex items-start gap-1.5 text-xs text-destructive" id={errorId} role="alert"><AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />{error}</p> : null}
    </div>
  );
}

/** X-7: the keys after the action, from 768px only, once the platform is known (decided after mount). */
export function ShortcutHint() {
  const [modifier, setModifier] = useState<'⌘' | 'Ctrl' | null>(null);
  useEffect(() => { setModifier(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '⌘' : 'Ctrl'); }, []);
  if (!modifier) return null;
  return (
    <span aria-hidden="true" className="hidden md:inline-flex">
      <span className="shortcut-hint"><kbd className="shortcut-key micro-label">{modifier}</kbd><kbd className="shortcut-key micro-label">Enter</kbd></span>
    </span>
  );
}
