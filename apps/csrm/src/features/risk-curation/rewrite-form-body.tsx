'use client';

import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { InstructionField, ShortcutHint } from '@/features/questionnaire-ai/instruction-field';
import { writeSessionDraft } from '@/lib/session-drafts/session-drafts';
import { cn } from '@/lib/utils';
import { startRiskRewriteAction } from './risk-curation-actions';
import { RISK_REWRITE_FOCUS, riskCardId, type RiskProposalJob, type RiskRewriteFocus } from './risk-curation-domain';
import { riskAiStartRefusal } from './risk-curation-refusal-copy';

/*
 * The Rewrite this risk form's body (16-UI-SPEC §4.1; D-34 to D-37), loaded the first time the form opens. The X-25
 * instruction, kept per person and Risk, takes focus; `What to rewrite` holds the three parts, all checked; a Risk with
 * open AI changes is told a new rewrite replaces them. A refusal keeps the form open with its values and R2's line.
 */
export type RewriteFormBodyProps = {
  assessmentId: string;
  riskId: string;
  riskNumber: string;
  openChanges: number;
  ownerKey: string | null;
  phone: boolean;
  titleId: string;
  onCancel: () => void;
  onStarted: (job: RiskProposalJob) => void;
};

const HINT = 'Say what to change, for example “Make it specific to unsigned payment files”. The AI reads this risk, its mitigation controls, the other risks and the request. It never changes owners, dates or statuses.';
const PART_LABELS: Readonly<Record<RiskRewriteFocus, string>> = { statement: 'Statement and cause', ratings: 'Ratings', treatment: 'Treatment' };
const NO_PART = 'Choose at least one part to rewrite.';

/** §4.1 (D-37): the caption when the Risk already holds open AI changes. */
export function supersedeCaption(count: number): string | null {
  if (count <= 0) return null;
  return `This risk already has ${count.toLocaleString('en-AU')} open AI ${count === 1 ? 'change' : 'changes'}. A new rewrite replaces ${count === 1 ? 'it' : 'them'} when it’s ready.`;
}

export function RewriteFormBody({ assessmentId, onCancel, onStarted, openChanges, ownerKey, phone, riskId, riskNumber, titleId }: RewriteFormBodyProps) {
  const [instruction, setInstruction] = useState('');
  const [parts, setParts] = useState<ReadonlySet<RiskRewriteFocus>>(new Set(RISK_REWRITE_FOCUS));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [partsError, setPartsError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const fieldId = riskCardId(riskId, '-rewrite-instruction');
  const caption = supersedeCaption(openChanges);
  const noPart = parts.size === 0;
  useEffect(() => { field.current?.focus(); }, []);

  function toggle(part: RiskRewriteFocus, checked: boolean) {
    const next = new Set(parts);
    if (checked) next.add(part);
    else next.delete(part);
    setParts(next);
    setPartsError(null);
  }

  async function submit() {
    if (pending || noPart) return;
    setFieldError(null);
    setFormError(null);
    setPartsError(null);
    setPending(true);
    try {
      const focus = RISK_REWRITE_FOCUS.filter((part) => parts.has(part));
      const result = await startRiskRewriteAction({ assessmentId, riskId, instruction, focus });
      if (!result.ok) {
        if (result.kind === 'field' && result.field === 'focus') setPartsError(result.message);
        else if (result.kind === 'field') {
          setFieldError(result.message);
          field.current?.focus();
        } else setFormError(result.message);
        return;
      }
      if (ownerKey) writeSessionDraft('risk-rewrite-instruction', ownerKey, riskId, '');
      onStarted(result.data);
    } catch {
      setFormError(riskAiStartRefusal({}).message);
    } finally {
      setPending(false);
    }
  }

  const partsMessage = noPart ? NO_PART : partsError;
  return (
    <form aria-labelledby={titleId} className="grid gap-4" data-risk={riskNumber} noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <InstructionField draft={{ kind: 'risk-rewrite-instruction', recordId: riskId, ownerKey }} error={fieldError} fieldRef={field} hint={HINT} id={fieldId} onChange={setInstruction} onSubmitShortcut={() => void submit()} value={instruction} />
      <fieldset aria-describedby={partsMessage ? `${fieldId}-parts-error` : undefined} className="grid gap-2">
        <legend className="mb-2 text-sm font-medium text-foreground">What to rewrite</legend>
        {RISK_REWRITE_FOCUS.map((part) => {
          const id = `${fieldId}-${part}`;
          return (
            <div className={cn('flex items-center gap-2', phone ? 'min-h-11' : 'min-h-6')} key={part}>
              <Checkbox aria-invalid={noPart ? true : undefined} checked={parts.has(part)} id={id} onCheckedChange={(checked) => toggle(part, checked === true)} />
              <Label className="font-normal" htmlFor={id}>{PART_LABELS[part]}</Label>
            </div>
          );
        })}
        {partsMessage ? <p className="flex items-start gap-1.5 text-xs text-destructive" id={`${fieldId}-parts-error`} role="alert"><AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />{partsMessage}</p> : null}
      </fieldset>
      {caption ? <p className="text-xs text-foreground-secondary">{caption}</p> : null}
      {formError ? <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{formError}</p> : null}
      <div className={phone ? 'grid gap-2' : 'flex flex-wrap items-center gap-2'}>
        <Button aria-disabled={pending || noPart ? true : undefined} className={phone ? 'min-h-11 w-full' : undefined} size="sm" type="submit">
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{pending ? 'Asking the AI…' : 'Rewrite risk'}
        </Button>
        <Button className={phone ? 'min-h-11 w-full' : undefined} onClick={onCancel} size="sm" type="button" variant="ghost">Keep as is</Button>
        {phone ? null : <ShortcutHint />}
      </div>
    </form>
  );
}
