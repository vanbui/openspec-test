'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';

import { LocalInstant } from '@/components/csrm/local-time';
import { RecordLink } from '@/components/csrm/record-link';
import { notePartLabels, type NotePart } from '@/features/request-notes/notes-domain';
import { getAiRunAction } from './ai-assistance-actions';
import { sheetAssessmentRows } from './ai-assistance-domain';
import {
  aiRunOutcome,
  answeredQuestionsLine,
  classificationSourceCaption,
  requestFieldLabel,
  riskTypesLeftOutLine,
} from './ai-provenance-domain';
import type { AiRun, AiRunContextAttachments, AiRunContextInstruction, AiRunContextNotes, AiRunContextQuestionnaire, AiRunContextRiskProposals } from './ai-assistance-schema';
import { AiRunSheetLoadError, AiRunSheetMessage, AiRunSheetSkeleton, SKELETON_DELAY_MS } from './ai-run-sheet-frame';

type SheetState =
  | { kind: 'loading' }
  | { kind: 'populated'; run: AiRun & { contextSummary: NonNullable<AiRun['contextSummary']> } }
  | { kind: 'empty' | 'permission' | 'error' };

export type AiRunSheetBodyProps = {
  open: boolean;
  runId: string;
  /** Whether the frame was already showing the skeleton while this code loaded, so the first read keeps it (WR-307). */
  skeletonAtOnce?: boolean;
  /** The rewritten Risk's number, which a rewrite run's scope names (16-UI-SPEC §10.3); the run holds only its id. */
  riskNumber?: string | null;
  titleRef: RefObject<HTMLHeadingElement | null>;
};

/*
 * "What the AI used" (12-UI-SPEC §2; D-07, D-25), the body of `AiRunSheetFrame`: its code loads the first time an
 * analyst asks for it (D-36). Reads the run when the sheet opens and keeps the result for that open.
 */
export function AiRunSheetBody({ open, riskNumber = null, runId, skeletonAtOnce = false, titleRef }: AiRunSheetBodyProps) {
  const [state, setState] = useState<SheetState>({ kind: 'loading' });
  const [showSkeleton, setShowSkeleton] = useState(skeletonAtOnce);
  const request = useRef(0);
  const skeletonShown = useRef(skeletonAtOnce);

  const load = useCallback(async () => {
    const attempt = ++request.current;
    // A skeleton the frame already showed while this code loaded stays for the first read, so it never flickers off and on.
    const atOnce = skeletonShown.current;
    skeletonShown.current = false;
    setState({ kind: 'loading' });
    setShowSkeleton(atOnce);
    const timer = atOnce ? undefined : setTimeout(() => { if (request.current === attempt) setShowSkeleton(true); }, SKELETON_DELAY_MS);
    let next: SheetState;
    try {
      const result = await getAiRunAction({ runId });
      if (result.ok) next = result.data.contextSummary ? { kind: 'populated', run: { ...result.data, contextSummary: result.data.contextSummary } } : { kind: 'empty' };
      else next = { kind: result.status === 404 ? 'empty' : result.status === 403 ? 'permission' : 'error' };
    } catch {
      next = { kind: 'error' };
    }
    clearTimeout(timer);
    if (request.current === attempt) setState(next);
  }, [runId]);

  useEffect(() => {
    if (open) void load();
    else request.current += 1;
  }, [load, open]);

  /* §2.4: Try again keeps focus on the title. */
  function retry() {
    void load();
    titleRef.current?.focus();
  }

  if (state.kind === 'loading') return showSkeleton ? <AiRunSheetSkeleton /> : null;
  if (state.kind === 'empty') return <AiRunSheetMessage description="CSRM holds no record of what this generation used." title="No AI run record" />;
  if (state.kind === 'permission') return <AiRunSheetMessage description="Only Security Analysts can see what an AI run used." title="You don’t have access to this AI run" />;
  if (state.kind === 'error') return <AiRunSheetLoadError onRetry={retry} />;
  return state.kind === 'populated' ? <RunGroups riskNumber={riskNumber} run={state.run} /> : null;
}

/*
 * A group heading takes the panel heading style, so it reads apart from the micro-label row labels under it (12-UI-SPEC
 * §2.2 and the direction's X-13, amended 2026-10-08 after the pilot's walk).
 */
function Group({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-heading-sm text-foreground">{title}</h3>
      <dl className="grid gap-3">{children}</dl>
    </section>
  );
}

function Row({ caption, children, label }: { caption?: string; children: ReactNode; label: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="micro-label">{label}</dt>
      <dd className="text-sm text-foreground [overflow-wrap:anywhere]">{children}</dd>
      {caption ? <dd className="text-xs text-foreground-secondary">{caption}</dd> : null}
    </div>
  );
}

function Lines({ items }: { items: readonly string[] }) {
  if (items.length === 0) return <>None selected</>;
  return <ul className="grid gap-0.5">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>;
}

const count = (value: number) => value.toLocaleString('en-AU');

/*
 * 13-UI-SPEC §10.3 (Phase 13 D-28): the `Notes` group's copy. It lives in this lazily loaded body, never in
 * `ai-assistance-domain.ts`, which the Risk route's client graph loads (D-34's route budget).
 */

/** §10.3: how many notes the run included, written out, or `None included` (an earlier run included none). */
export function sheetNotesHeading(included: number): string {
  return included === 0 ? 'None included' : `${count(included)} ${included === 1 ? 'note' : 'notes'} included`;
}

/** §10.3: one included note's row, its link's words and its length; its time is shown between them. Never its text. */
export function sheetNoteRow(note: { part: NotePart; characters: number }): { label: string; characters: string } {
  return { label: `${notePartLabels[note.part]} note`, characters: `${count(note.characters)} ${note.characters === 1 ? 'character' : 'characters'}` };
}

/*
 * The notes the run used, by part, time and length (G-3: the summary holds no note text). Each row's first part links to
 * the note in the request's thread: the sheet closes, then the route navigates (Next's Link runs the Close handler before
 * it navigates). The link drops the Close button's `type`, which an anchor does not take.
 */
function NotesGroup({ notes, requestId }: { notes: AiRunContextNotes; requestId: string | null }) {
  /* UI-07: the sheet's own group and row, as every other group is; the count and the rows sit in the row's value. */
  return (
    <Group title="Notes">
      <Row label="Included">
        <span className="block tabular-nums">{sheetNotesHeading(notes.included.length)}</span>
        {notes.included.length > 0 ? (
          <ul className="mt-1 grid gap-1">
            {notes.included.map((note) => {
              const row = sheetNoteRow(note);
              return (
                <li className="[overflow-wrap:anywhere]" key={note.documentId}>
                  {requestId ? (
                    <SheetPrimitive.Close asChild>
                      <RecordLink href={`/app/review/requests/${encodeURIComponent(requestId)}#note-${encodeURIComponent(note.documentId)}`} type={undefined}>{row.label}</RecordLink>
                    </SheetPrimitive.Close>
                  ) : row.label} · <LocalInstant style="date-time" value={note.postedAt} /> · <span className="tabular-nums">{row.characters}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Row>
    </Group>
  );
}

/*
 * 14-UI-SPEC §7.1 (Phase 14 D-35; UI-D23): the `Files` group's copy, beside the Notes group's and for the same reason.
 */

/** §7.1: how many files the run included, written out, or `None included` (an earlier run included none). */
export function sheetFilesHeading(included: number): string {
  return included === 0 ? 'None included' : `${count(included)} ${included === 1 ? 'file' : 'files'} included`;
}

type RunFile = AiRunContextAttachments['included'][number];

const filePartLabels: Readonly<Record<RunFile['part'], string>> = { requestor: 'Requestor', 'security-analyst': 'Security Analyst' };

/** A file whose record the run read can no longer name (D-35). */
export const sheetUnnamedFile = 'A file no longer on this request';

/**
 * §7.1: one included file's value after its name: who added it, the characters sent, how much of a longer file that was
 * (D-33) and whether it was removed after the run. Never its text (G-3): the summary holds none.
 */
export function sheetFileValue(file: Pick<RunFile, 'part' | 'charactersSent' | 'charactersAvailable' | 'truncated' | 'removed'>): string {
  const sent = `${filePartLabels[file.part]} file · ${count(file.charactersSent)} ${file.charactersSent === 1 ? 'character' : 'characters'} sent`;
  const truncated = file.truncated ? ` · first ${count(file.charactersSent)} of ${count(file.charactersAvailable)}` : '';
  return `${sent}${truncated}${file.removed ? ' · Removed since' : ''}`;
}

/*
 * The files the run used, in upload order, each named as it is now (UI-D23). The name is a record link to the file's row
 * on the analyst's request page: the sheet closes, then the route navigates. A file removed since the run has no row in
 * the main list, and a file whose record no longer names its request has no page to open, so each is named plainly
 * (WR-506).
 */
function FilesGroup({ files }: { files: AiRunContextAttachments }) {
  return (
    <Group title="Files">
      <Row label="Included">
        <span className="block tabular-nums">{sheetFilesHeading(files.included.length)}</span>
        {files.included.length > 0 ? (
          <ul className="mt-1 grid gap-1">
            {files.included.map((file) => (
              <li className="[overflow-wrap:anywhere]" key={file.documentId}>
                {/* The name is React text, never markup; the link is built from ids only. */}
                {file.fileName && file.requestId && !file.removed ? (
                  <SheetPrimitive.Close asChild>
                    <RecordLink href={`/app/review/requests/${encodeURIComponent(file.requestId)}#file-${encodeURIComponent(file.documentId)}`} type={undefined}>{file.fileName}</RecordLink>
                  </SheetPrimitive.Close>
                ) : (file.fileName ?? sheetUnnamedFile)} · <span className="tabular-nums">{sheetFileValue(file)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Row>
    </Group>
  );
}

/*
 * 15-UI-SPEC §9.3 (Phase 15 D-14, D-19): the `Instruction` and `Questionnaire` groups of a questionnaire proposal or
 * rewrite run. Their copy lives in this lazily loaded body, beside the Notes and Files groups', so no route's first load
 * carries it (the risk editor reaches `ai-assistance-domain.ts`; 15-12 "Budget").
 */
export type SheetRow = { label: string; value: string; quoted?: boolean };

/* 16-UI-SPEC §10.3: what steered a risk run when no analyst gave an instruction, and the parts a rewrite was asked for. */
const RISK_DEFAULT_TASKS: Partial<Record<AiRun['operation'], string>> = {
  'risk-suggestions': 'None: the AI looked for the risks it judged missing',
  'risk-rewrite': 'None: the AI rewrote the parts asked for',
};
const REWRITE_PARTS: Readonly<Record<string, string>> = { statement: 'Statement and cause', ratings: 'Ratings', treatment: 'Treatment' };

export function sheetInstructionRows(instruction: AiRunContextInstruction, run: Pick<AiRun, 'instruction' | 'initiatedBy'> & Partial<Pick<AiRun, 'operation'>>, riskProposals: AiRunContextRiskProposals | null = null): SheetRow[] {
  const givenBy = instruction.source === 'analyst'
    ? run.initiatedBy?.displayName ?? 'Not recorded'
    : instruction.source === 'plain-language-preset'
      ? 'Plain-language rewrite (standard wording)'
      : (run.operation ? RISK_DEFAULT_TASKS[run.operation] : undefined) ?? 'None: the AI suggested the questions it judged still needed';
  const rows: SheetRow[] = [{ label: 'Given by', value: givenBy }];
  if (instruction.source === 'analyst' && run.instruction) rows.push({ label: 'Instruction', value: `“${run.instruction}”`, quoted: true });
  if (run.operation === 'risk-rewrite' && riskProposals?.focus) rows.push({ label: 'What to rewrite', value: riskProposals.focus.map((part) => REWRITE_PARTS[part] ?? part).join(', ') });
  return rows;
}

export function sheetQuestionnaireRows(questionnaire: AiRunContextQuestionnaire): SheetRow[] {
  return [
    { label: 'Scope', value: questionnaire.scope === 'questionnaire' ? 'Whole questionnaire' : 'One question' },
    { label: 'Questions offered', value: count(questionnaire.questionsOffered) },
    { label: 'Answered', value: `${count(questionnaire.answered)} (the AI couldn’t change them)` },
    { label: 'Answers', value: questionnaire.answerContent === 'included' ? 'Included, because the Requestor had submitted them' : 'Not included, because the Requestor hadn’t submitted them' },
    { label: 'Open proposals listed', value: count(questionnaire.openItemsListed) },
    { label: 'Rejected proposals listed', value: `${count(questionnaire.rejectedItemsListed)} of ${count(questionnaire.rejectedItemsTotal)}` },
    { label: 'Removed questions listed', value: count(questionnaire.removedListed) },
  ];
}

function SheetRows({ rows }: { rows: readonly SheetRow[] }) {
  /* The instruction is the analyst's plain text, line breaks kept, never markup (X-25; T-15-46). */
  return <>{rows.map((row) => <Row key={row.label} label={row.label}>{row.quoted ? <span className="whitespace-pre-wrap">{row.value}</span> : <span className="tabular-nums">{row.value}</span>}</Row>)}</>;
}

function RunGroups({ riskNumber, run }: { riskNumber: string | null; run: Extract<SheetState, { kind: 'populated' }>['run'] }) {
  const summary = run.contextSummary;
  const draft = run.operation === 'assessment-draft';
  const leftOut = riskTypesLeftOutLine(summary.riskTypes.offered, summary.riskTypes.total);
  return (
    <div className="grid gap-6">
      <Group title="Run">
        <Row label="Started by">{run.initiatedBy?.displayName ?? 'Not recorded'}</Row>
        <Row label="Started"><LocalInstant fallback="Not recorded" style="date-time" value={run.startedAt} /></Row>
        <Row label="Finished"><LocalInstant fallback="Not finished" style="date-time" value={run.completedAt} /></Row>
        <Row label="Provider">{run.providerName}</Row>
        <Row label="Model">{run.providerVersion}</Row>
        <Row label="Outcome">{aiRunOutcome(run)}</Row>
      </Group>
      {summary.instruction ? <Group title="Instruction"><SheetRows rows={sheetInstructionRows(summary.instruction, run, summary.riskProposals)} /></Group> : null}
      {summary.riskProposals ? <Group title="Assessment"><SheetRows rows={sheetAssessmentRows(summary.riskProposals, { riskNumber })} /></Group> : null}
      {summary.questionnaire ? <Group title="Questionnaire"><SheetRows rows={sheetQuestionnaireRows(summary.questionnaire)} /></Group> : null}
      <Group title="Data policy">
        <Row caption={classificationSourceCaption(summary.classification.source)} label="Information classification">{summary.classification.level}</Row>
        <Row label="Approved limit">{summary.classification.ceiling ?? 'No limit set in development'}</Row>
        <Row label="Decision">{summary.classification.decision === 'allowed' ? 'Allowed' : 'Refused'}</Row>
      </Group>
      <Group title="Request">
        <Row label="Fields sent"><Lines items={summary.request.fields.map((field) => requestFieldLabel(field.label))} /></Row>
      </Group>
      <NotesGroup notes={summary.notes} requestId={run.targets.assessmentRequest} />
      <FilesGroup files={summary.attachments} />
      {draft ? (
        <Group title="Questions and answers">
          <Row label="Answered"><span className="tabular-nums">{answeredQuestionsLine(summary.questions.answered, summary.questions.included)}</span></Row>
          {summary.questions.sources.length > 0 ? (
            <Row label="Questions">
              <ol className="grid list-decimal gap-2 pl-5">
                {summary.questions.sources.map((source) => (
                  <li key={source.key}>
                    <span className="line-clamp-2">{source.label}</span>
                    <span className="block text-xs text-foreground-secondary">{source.section}</span>
                  </li>
                ))}
              </ol>
            </Row>
          ) : null}
        </Group>
      ) : null}
      <Group title="Information systems">
        <Row label="Systems"><Lines items={summary.systems.map((system) => system.name)} /></Row>
      </Group>
      <Group title="Information assets">
        <Row label="Assets"><Lines items={summary.assets.map((asset) => `${asset.name} · ${asset.classification ?? 'Not classified'}`)} /></Row>
      </Group>
      <Group title="Risk Types">
        <Row caption={leftOut ?? undefined} label="Offered">
          <span className="tabular-nums">{`${summary.riskTypes.offered} of ${summary.riskTypes.total} offered`}</span>
          {summary.riskTypes.names.length > 0 ? <Lines items={summary.riskTypes.names} /> : null}
        </Row>
      </Group>
      {draft ? (
        <Group title="Control candidates">
          <Row label="Offered"><span className="tabular-nums">{`${summary.controlCandidates.offered} of ${summary.controlCandidates.total} library controls offered`}</span></Row>
        </Group>
      ) : null}
      <Group title="Context digest">
        <Row caption="A SHA-256 fingerprint of the exact text sent to the AI." label="Digest"><code className="font-mono text-xs [overflow-wrap:anywhere]">{summary.digest}</code></Row>
      </Group>
    </div>
  );
}
