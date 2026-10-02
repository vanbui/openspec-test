'use client';

import { AlertCircle, CheckCircle2, ClipboardPenLine, Plus, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react';

import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { nativeSelectClassName } from '@/components/csrm/native-select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  addQuestionnaireQuestionAction, deleteQuestionnaireQuestionAction, editQuestionnaireQuestionAction,
  releaseQuestionnaireAction, returnQuestionnaireToAnalystReviewAction,
} from './questionnaire-actions';
import { orderQuestionnaire } from './questionnaire-domain';
import { placeInNewSection, placeInSection, sectionChoices, type QuestionPlacement, type SectionChoice } from './questionnaire-placement';
import type { QuestionnaireDefinition, QuestionnaireQuestion } from './questionnaire-schema';
import type { QuestionnaireSummary } from './questionnaire-service';
import { canReturnToAnalystReview } from './questionnaire-workflow-rules';

/*
 * File upload is deliberately absent: no authorised upload, storage, scanning
 * or retention contract exists, so a question the Requestor could never answer
 * must not be creatable.
 */
const answerTypes = ['Text', 'Long text', 'Boolean', 'Single select', 'Multi select', 'Date'] as const;
type DraftAnswerType = (typeof answerTypes)[number];
/*
 * The form chooses a section rather than typing one (D-05): an existing section by its key, whose stored
 * metadata is sent unchanged, or a new section with a title. `currentSectionKey` is the edited question's own
 * section, so an edit sends a placement only when the section changes. No section can be renamed.
 */
const NEW_SECTION = '__new-section__';
type DraftQuestion = { questionText: string; answerType: DraftAnswerType; required: boolean; choices: string; sectionChoice: string; newSectionTitle: string; currentSectionKey?: string };
type FieldErrors = Partial<Record<'questionText' | 'choices' | 'newSectionTitle', string>>;
/** A refusal shown in the form's error line; `reload` offers Reload questions (UI-SPEC §1.2, §10.2 G). */
type FormRefusal = { message: string; reload: boolean };
/** Where a form was opened: the editor-level add, a section's add, or a question's Edit (D-04). */
type OpenForm = { kind: 'editor' } | { kind: 'section'; sectionKey: string } | { kind: 'edit'; questionId: string };
/*
 * Where focus goes once the page shows the result of an action (UI-SPEC §1.4). An added question appears only
 * after the questions reload, and a removed one disappears only then, so these wait for the definition.
 */
type FocusTarget =
  | { kind: 'control'; control: string }
  | { kind: 'question'; questionId: string }
  | { kind: 'placed'; sectionKey: string; order: number }
  | { kind: 'after-delete'; removedId: string; candidates: readonly string[]; fallbackControl: string };

/** The served reasons after which reloading the questions is the way forward (D-06). */
const RELOAD_REASONS: readonly string[] = ['DEFINITION_CONFLICT', 'QUESTION_REMOVED'];
/** UI-SPEC §10.2 G, for a section the reloaded questions no longer hold. */
const PLACEMENT_CONFLICT = 'Another change reached this questionnaire first, so this question couldn’t be saved where you placed it. Reload the questions, then save again.';
const EDITOR_ADD = 'editor-add';
const sectionAddControl = (sectionKey: string) => `section-add:${sectionKey}`;
const editControl = (questionId: string) => `edit:${questionId}`;

function isChoiceType(answerType: DraftAnswerType): boolean {
  return answerType === 'Single select' || answerType === 'Multi select';
}

function questionId(question: QuestionnaireQuestion): string {
  return question.documentId ?? question.questionKey;
}

/** What the question asks for, and whether it must be answered: the caption under each question in the editor. */
function questionCaption(question: QuestionnaireQuestion): string {
  return `${question.answerType} · ${question.required ? 'Required' : 'Optional'}`;
}

/** The choice labels of a select question, in their stored order; null for any other answer type. */
function questionChoices(question: QuestionnaireQuestion): string | null {
  const isSelect = question.answerType === 'Single select' || question.answerType === 'Multi select';
  return isSelect && question.choices?.length ? `Choices: ${question.choices.map((choice) => choice.label).join(', ')}` : null;
}

/** One choice per line, so the label is the analyst's words and the value is derived. */
function parseChoices(value: string): Array<{ value: string; label: string }> {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((label) => ({
    value: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || label,
    label,
  }));
}

/** The form's own checks, run when Save question is pressed (UI-SPEC §1.2). */
function validateDraft(draft: DraftQuestion): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.questionText.trim()) errors.questionText = 'Enter the question text.';
  if (isChoiceType(draft.answerType) && parseChoices(draft.choices).length === 0) errors.choices = 'Add at least one choice, one per line.';
  if (draft.sectionChoice === NEW_SECTION && !draft.newSectionTitle.trim()) errors.newSectionTitle = 'Enter a title for the new section.';
  return errors;
}

function blankDraft(sectionChoice: string): DraftQuestion {
  return { questionText: '', answerType: 'Text', required: false, choices: '', sectionChoice, newSectionTitle: '' };
}

function draftOf(question: QuestionnaireQuestion): DraftQuestion {
  return {
    questionText: question.questionText,
    answerType: question.answerType === 'File upload' ? 'Text' : question.answerType,
    required: question.required,
    choices: (question.choices ?? []).map((choice) => choice.label).join('\n'),
    sectionChoice: question.section.key,
    newSectionTitle: '',
    currentSectionKey: question.section.key,
  };
}

/** A question's text and captions, as the editor rows show them. A focusable row takes focus after a save. */
function QuestionSummary({ question, focusable = false }: { question: QuestionnaireQuestion; focusable?: boolean }) {
  const choices = questionChoices(question);
  return <div className="min-w-0 space-y-1" {...(focusable ? { 'data-question-row': questionId(question), tabIndex: -1 } : {})}>
    <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{question.questionText}</p>
    <p className="text-xs text-foreground-secondary">{questionCaption(question)}</p>
    {choices ? <p className="text-xs text-foreground-secondary [overflow-wrap:anywhere]">{choices}</p> : null}
  </div>;
}

/**
 * The released questions as the analyst reads them while the Requestor answers (D-07): the governance rows
 * without Edit, Delete or any answer, grouped under a heading per section in definition order.
 */
export function ReleasedQuestionList({ definition }: { definition: QuestionnaireDefinition }) {
  const sectionIdPrefix = useId();
  return <div className="grid gap-4">
    {orderQuestionnaire(definition).map((section, sectionIndex) => {
      const headingId = `${sectionIdPrefix}-released-section-${sectionIndex}`;
      return <div className="grid gap-2" key={section.key}>
        <h3 className="micro-label text-muted-foreground" id={headingId}>{section.title}</h3>
        <ul aria-labelledby={headingId} className="grid gap-2">
          {section.questions.map((question) => <li className="rounded-lg border border-border p-3" key={questionId(question)}><QuestionSummary question={question} /></li>)}
        </ul>
      </div>;
    })}
  </div>;
}

export function QuestionnaireGovernance({ questionnaire, definition, placements }: { questionnaire: QuestionnaireSummary; definition: QuestionnaireDefinition; placements: readonly QuestionPlacement[] }) {
  const router = useRouter();
  const sectionIdPrefix = useId();
  const containerRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const savingRef = useRef(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [cleared, setCleared] = useState<readonly { questionKey: string; explanation: string }[]>([]);
  const [openForm, setOpenForm] = useState<OpenForm | null>(null);
  const [formSequence, setFormSequence] = useState(0);
  const [refusal, setRefusal] = useState<FormRefusal | null>(null);
  const [saving, setSaving] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const inAnalystReview = questionnaire.release === null || questionnaire.release === undefined;
  // A released questionnaire returns to analyst review only before an assessment exists (D-22, UI-SPEC §2.3).
  const returnable = !inAnalystReview && canReturnToAnalystReview(questionnaire);
  const panelDescription = inAnalystReview
    ? 'This questionnaire is visible to Analysts only until it is released.'
    : returnable
      ? 'Return it to analyst review before changing its questions.'
      : 'An assessment has been drafted from the Requestor’s answers, so these questions can no longer change.';
  const sections = sectionChoices(placements);
  // An edited question the reloaded questions no longer hold has no row left to edit in.
  const activeForm = openForm?.kind === 'edit' && !definition.some((question) => questionId(question) === openForm.questionId) ? null : openForm;
  const formOpen = activeForm !== null;

  function control(name: string): HTMLElement | null {
    return [...(containerRef.current?.querySelectorAll<HTMLElement>('[data-governance-control]') ?? [])].find((element) => element.dataset.governanceControl === name) ?? null;
  }
  function questionRow(id: string): HTMLElement | null {
    return [...(containerRef.current?.querySelectorAll<HTMLElement>('[data-question-row]') ?? [])].find((element) => element.dataset.questionRow === id) ?? null;
  }
  function focusElement(target: FocusTarget): HTMLElement | null {
    switch (target.kind) {
      case 'control': return control(target.control);
      case 'question': return questionRow(target.questionId);
      case 'placed': {
        const placed = definition.find((question) => question.section.key === target.sectionKey && question.order === target.order);
        return placed ? questionRow(questionId(placed)) : null;
      }
      case 'after-delete': {
        if (definition.some((question) => questionId(question) === target.removedId)) return null;
        for (const candidate of target.candidates) {
          const row = questionRow(candidate);
          if (row) return row;
        }
        return control(target.fallbackControl) ?? control(EDITOR_ADD);
      }
    }
  }

  // Runs after every render: a pending focus move lands as soon as the element it names exists (UI-SPEC §1.4).
  useEffect(() => {
    const target = pendingFocus.current;
    if (target) {
      const element = focusElement(target);
      if (element) {
        pendingFocus.current = null;
        element.focus();
      }
    } else if (openForm && !activeForm && (document.activeElement === null || document.activeElement === document.body)) {
      control(EDITOR_ADD)?.focus();
    }
  });

  function open(form: OpenForm) {
    setOpenForm(form);
    setFormSequence((sequence) => sequence + 1);
    setRefusal(null);
  }
  function invokingControl(form: OpenForm): string {
    if (form.kind === 'editor') return EDITOR_ADD;
    if (form.kind === 'section') return sectionAddControl(form.sectionKey);
    return editControl(form.questionId);
  }
  function discard() {
    if (activeForm) pendingFocus.current = { kind: 'control', control: invokingControl(activeForm) };
    setOpenForm(null);
    setRefusal(null);
  }
  function reload() {
    // The form stays open with what the analyst typed; the next save places from the reloaded questions.
    setRefusal(null);
    router.refresh();
  }

  async function release() { const result = await releaseQuestionnaireAction({ documentId: questionnaire.documentId }); if (!result.ok) { setEditorError(result.formError); throw new Error('Release failed'); } router.refresh(); }
  async function returnToReview(reason?: string) { const result = await returnQuestionnaireToAnalystReviewAction({ documentId: questionnaire.documentId, reason }); if (!result.ok) { setEditorError(result.formError); throw new Error('Return failed'); } router.refresh(); }
  async function remove(question: QuestionnaireQuestion, siblings: readonly QuestionnaireQuestion[]) {
    const id = questionId(question);
    const index = siblings.findIndex((sibling) => questionId(sibling) === id);
    const candidates = [siblings[index + 1], siblings[index - 1]].filter((sibling): sibling is QuestionnaireQuestion => sibling !== undefined).map(questionId);
    const result = await deleteQuestionnaireQuestionAction({ documentId: questionnaire.documentId, questionId: id });
    if (!result.ok) { setDeleteError(result.formError); throw new Error('Delete failed'); }
    setDeleteError(null);
    pendingFocus.current = { kind: 'after-delete', removedId: id, candidates, fallbackControl: sectionAddControl(question.section.key) };
    setAnnouncement('Question removed.');
    router.refresh();
  }

  async function save(draft: DraftQuestion) {
    if (!activeForm || savingRef.current) return;
    const editing = activeForm.kind === 'edit' ? activeForm.questionId : null;
    const choices = isChoiceType(draft.answerType) ? parseChoices(draft.choices) : undefined;
    // Placement comes from every question, removed ones included (D-05); an edit that keeps its section sends none.
    const keepsSection = editing !== null && draft.sectionChoice === draft.currentSectionKey;
    const placement = keepsSection ? null : draft.sectionChoice === NEW_SECTION ? placeInNewSection(placements, draft.newSectionTitle) : placeInSection(placements, draft.sectionChoice);
    if (!keepsSection && !placement) { setRefusal({ message: PLACEMENT_CONFLICT, reload: true }); return; }
    const input = { questionText: draft.questionText.trim(), answerType: draft.answerType, required: draft.required, ...(placement ? { section: placement.section, order: placement.order } : {}), ...(choices ? { choices } : {}) };
    savingRef.current = true;
    setSaving(true);
    setRefusal(null);
    try {
      const result = editing ? await editQuestionnaireQuestionAction({ documentId: questionnaire.documentId, questionId: editing, input }) : await addQuestionnaireQuestionAction({ documentId: questionnaire.documentId, input });
      if (!result.ok) {
        setRefusal({ message: result.formError, reload: result.reason !== undefined && RELOAD_REASONS.includes(result.reason) });
        return;
      }
      setCleared('clearedAnswers' in result.data ? result.data.clearedAnswers : []);
      if (editing) {
        pendingFocus.current = { kind: 'question', questionId: editing };
        setAnnouncement('Question saved.');
      } else if (placement) {
        pendingFocus.current = { kind: 'placed', sectionKey: placement.section.key, order: placement.order };
        setAnnouncement(`Question added to ${placement.section.title}.`);
      }
      setOpenForm(null);
      router.refresh();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // The cleared notice names each question by text, resolved against every question, removed ones included (D-17).
  function questionTextFor(questionKey: string): string {
    return placements.find((placement) => placement.questionKey === questionKey)?.questionText
      ?? definition.find((question) => question.questionKey === questionKey)?.questionText
      ?? 'A question no longer in this questionnaire';
  }

  function questionForm(headingLevel: 4 | 5, title: string, initial: DraftQuestion) {
    return <QuestionForm headingLevel={headingLevel} initial={initial} key={formSequence} onDiscard={discard} onReload={reload} onSave={save} refusal={refusal} saving={saving} sections={sections} title={title} />;
  }

  return <section aria-label="Questionnaire governance" className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-4" ref={containerRef}>
    <div className="flex items-start gap-3"><ClipboardPenLine aria-hidden="true" className="mt-0.5 size-5 text-muted-foreground" /><div><h2 className="text-heading-sm text-foreground">{inAnalystReview ? 'Analyst review' : 'Released to Requestor'}</h2><p className="text-sm text-muted-foreground">{panelDescription}</p></div></div>
    {/* Release and return only: a question form shows its own errors beside Save question (D-06). */}
    {editorError ? <p className="text-sm text-destructive" role="alert">{editorError}</p> : null}
    {cleared.length ? <div aria-live="polite" className="rounded-lg border border-border p-3"><p className="font-medium">Answers cleared by this revision</p><ul className="mt-2 list-disc pl-5 text-sm">{cleared.map((answer) => <li key={`${answer.questionKey}-${answer.explanation}`}><span className="font-medium">{questionTextFor(answer.questionKey)}</span>: {answer.explanation}</li>)}</ul><Button className="mt-2" data-print="hidden" onClick={() => setCleared([])} size="sm" type="button" variant="outline">Dismiss notice</Button></div> : null}
    {inAnalystReview ? <>
      <div className="grid justify-items-start gap-2">
        <ConfirmDialog confirmLabel="Release questionnaire" confirmVariant="default" description="The Requestor can view this questionnaire after release." errorMessage={editorError} onConfirm={release} pendingLabel="Releasing questionnaire…" title="Release this questionnaire?" trigger={<Button data-print="hidden" disabled={formOpen} type="button"><CheckCircle2 aria-hidden="true" />Release questionnaire</Button>} />
        {formOpen ? <p className="text-xs text-foreground-secondary">Save or discard the open question before you release the questionnaire.</p> : null}
      </div>
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-2"><h3 className="font-medium">Question editor</h3><Button className="max-md:min-h-11" data-governance-control={EDITOR_ADD} data-print="hidden" disabled={formOpen} onClick={() => open({ kind: 'editor' })} size="sm" type="button"><Plus aria-hidden="true" />Add question</Button></div>
        {activeForm?.kind === 'editor' ? questionForm(4, 'Add question', blankDraft(sections.at(-1)?.key ?? NEW_SECTION)) : null}
        {/*
          * The single list of questions on the analyst review page (D-32): grouped under a heading per section in
          * definition order, one row per question in question order, each with its answer type, required flag and,
          * for select questions, its choices. Edit replaces its own row with the form; a section's add form opens
          * after that section's questions (D-04).
          */}
        {orderQuestionnaire(definition).map((section, sectionIndex) => {
          const headingId = `${sectionIdPrefix}-section-${sectionIndex}`;
          return <div className="grid gap-2" key={section.key}>
            <h4 className="micro-label text-muted-foreground" id={headingId}>{section.title}</h4>
            <ul aria-labelledby={headingId} className="grid gap-2">
              {section.questions.map((question) => {
                const id = questionId(question);
                if (activeForm?.kind === 'edit' && activeForm.questionId === id) return <li key={id}>{questionForm(5, 'Edit question', draftOf(question))}</li>;
                const isLastActive = definition.length <= 1;
                return <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3" key={id}>
                  <QuestionSummary focusable question={question} />
                  <div className="flex gap-2" data-print="hidden">
                    <Button data-governance-control={editControl(id)} disabled={formOpen} onClick={() => open({ kind: 'edit', questionId: id })} size="sm" type="button" variant="outline">Edit{' '}<span className="sr-only">question: {question.questionText}</span></Button>
                    {isLastActive
                      ? <Button disabled size="sm" title="A questionnaire must retain at least one active question." type="button" variant="outline">Delete{' '}<span className="sr-only">question: {question.questionText}</span></Button>
                      : <ConfirmDialog confirmLabel="Delete question" confirmVariant="destructive" description="The question and its answer are retained in the revision history." errorMessage={deleteError} onConfirm={() => remove(question, section.questions)} onDismiss={() => setDeleteError(null)} pendingLabel="Deleting question…" title="Delete this question?" trigger={<Button disabled={formOpen} size="sm" type="button" variant="outline">Delete{' '}<span className="sr-only">question: {question.questionText}</span></Button>} />}
                  </div>
                </li>;
              })}
            </ul>
            {activeForm?.kind === 'section' && activeForm.sectionKey === section.key ? questionForm(5, `Add question to ${section.title}`, blankDraft(section.key)) : null}
            <div><Button className="max-md:min-h-11" data-governance-control={sectionAddControl(section.key)} data-print="hidden" disabled={formOpen} onClick={() => open({ kind: 'section', sectionKey: section.key })} size="sm" type="button" variant="outline"><Plus aria-hidden="true" />Add question{' '}<span className="sr-only">to {section.title}</span></Button></div>
          </div>;
        })}
      </div>
    </> : returnable ? <ConfirmDialog confirmLabel="Return to analyst review" confirmVariant="default" description="Editing requires returning this questionnaire to review first." errorMessage={editorError} onConfirm={returnToReview} pendingLabel="Returning to analyst review…" reasonRequired title="Return questionnaire to analyst review?" trigger={<Button data-print="hidden" type="button"><RotateCcw aria-hidden="true" />Return to analyst review</Button>} /> : null}
    <p aria-live="polite" className="sr-only">{announcement}</p>
  </section>;
}

type QuestionFormProps = {
  headingLevel: 4 | 5;
  initial: DraftQuestion;
  onDiscard: () => void;
  onReload: () => void;
  onSave: (draft: DraftQuestion) => void;
  refusal: FormRefusal | null;
  saving: boolean;
  sections: readonly SectionChoice[];
  title: string;
};

/** A field's error under it, with its icon (§4 Forms); the field names it in its description. */
function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p className="flex items-start gap-1.5 text-xs text-destructive" id={id}><AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />{message}</p> : null;
}

/** The in-place question form (X-5): a form region named by its title, focused in Question text when it opens (D-04). */
function QuestionForm({ headingLevel, initial, onDiscard, onReload, onSave, refusal, saving, sections, title }: QuestionFormProps) {
  const id = useId();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const textRef = useRef<HTMLTextAreaElement>(null);
  const choicesRef = useRef<HTMLTextAreaElement>(null);
  const newSectionRef = useRef<HTMLInputElement>(null);
  useEffect(() => { textRef.current?.focus(); }, []);
  const Heading = headingLevel === 4 ? 'h4' : 'h5';
  const ids = {
    title: `${id}-title`, text: `${id}-text`, textError: `${id}-text-error`, type: `${id}-type`,
    choices: `${id}-choices`, choicesHint: `${id}-choices-hint`, choicesError: `${id}-choices-error`,
    section: `${id}-section`, sectionHint: `${id}-section-hint`,
    newSection: `${id}-new-section`, newSectionHint: `${id}-new-section-hint`, newSectionError: `${id}-new-section-error`,
    required: `${id}-required`,
  };
  const describedBy = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' ') || undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const next = validateDraft(draft);
    setErrors(next);
    // Save question is never disabled for missing input: the errors say what to fix, first one focused.
    const firstInvalid: RefObject<HTMLTextAreaElement | HTMLInputElement | null> | null = next.questionText ? textRef : next.choices ? choicesRef : next.newSectionTitle ? newSectionRef : null;
    if (firstInvalid) {
      firstInvalid.current?.focus();
      return;
    }
    onSave(draft);
  }

  return <form aria-labelledby={ids.title} className="grid w-full max-w-[640px] gap-4 rounded-lg border border-border bg-surface-muted p-4" data-print="hidden" noValidate onSubmit={submit}>
    <Heading className="text-sm font-medium text-foreground" id={ids.title}>{title}</Heading>
    <div className="grid gap-2"><Label htmlFor={ids.text}>Question text</Label><Textarea aria-describedby={describedBy(errors.questionText && ids.textError)} aria-invalid={errors.questionText ? true : undefined} id={ids.text} onChange={(event) => setDraft({ ...draft, questionText: event.target.value })} ref={textRef} value={draft.questionText} /><FieldError id={ids.textError} message={errors.questionText} /></div>
    <div className="grid gap-2"><Label htmlFor={ids.type}>Answer type</Label><select className={`${nativeSelectClassName} block w-full`} id={ids.type} onChange={(event) => setDraft({ ...draft, answerType: event.target.value as DraftAnswerType })} value={draft.answerType}>{answerTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
    {isChoiceType(draft.answerType) ? <div className="grid gap-2"><Label htmlFor={ids.choices}>Choices</Label><Textarea aria-describedby={describedBy(ids.choicesHint, errors.choices && ids.choicesError)} aria-invalid={errors.choices ? true : undefined} id={ids.choices} onChange={(event) => setDraft({ ...draft, choices: event.target.value })} ref={choicesRef} value={draft.choices} /><p className="text-sm text-muted-foreground" id={ids.choicesHint}>One choice per line.</p><FieldError id={ids.choicesError} message={errors.choices} /></div> : null}
    <div className="grid gap-2"><Label htmlFor={ids.section}>Section</Label><select aria-describedby={ids.sectionHint} className={`${nativeSelectClassName} block w-full`} id={ids.section} onChange={(event) => setDraft({ ...draft, sectionChoice: event.target.value })} value={draft.sectionChoice}>{sections.map((section) => <option key={section.key} value={section.key}>{section.label}</option>)}<option value={NEW_SECTION}>New section</option></select><p className="text-sm text-muted-foreground" id={ids.sectionHint}>A question you add or move goes at the end of its section.</p></div>
    {draft.sectionChoice === NEW_SECTION ? <div className="grid gap-2"><Label htmlFor={ids.newSection}>New section title</Label><Input aria-describedby={describedBy(ids.newSectionHint, errors.newSectionTitle && ids.newSectionError)} aria-invalid={errors.newSectionTitle ? true : undefined} id={ids.newSection} maxLength={255} onChange={(event) => setDraft({ ...draft, newSectionTitle: event.target.value })} ref={newSectionRef} value={draft.newSectionTitle} /><p className="text-sm text-muted-foreground" id={ids.newSectionHint}>Shown to the Requestor as a heading.</p><FieldError id={ids.newSectionError} message={errors.newSectionTitle} /></div> : null}
    <div className="flex items-center gap-2"><Checkbox checked={draft.required} id={ids.required} onCheckedChange={(checked) => setDraft({ ...draft, required: checked === true })} /><Label htmlFor={ids.required}>Required</Label></div>
    {refusal ? <div className="flex flex-wrap items-start gap-2">
      <p className="flex min-w-0 flex-1 items-start gap-1.5 text-sm text-destructive" role="alert"><AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{refusal.message}</p>
      {refusal.reload ? <Button className="max-md:min-h-11" data-print="hidden" onClick={onReload} size="sm" type="button" variant="outline">Reload questions</Button> : null}
    </div> : null}
    <div className="flex flex-col gap-2 md:flex-row">
      <Button aria-disabled={saving ? true : undefined} className="w-full max-md:min-h-11 md:w-auto" type="submit">{saving ? 'Saving question…' : 'Save question'}</Button>
      <Button className="w-full max-md:min-h-11 md:w-auto" onClick={onDiscard} type="button" variant="outline">Discard changes</Button>
    </div>
  </form>;
}
