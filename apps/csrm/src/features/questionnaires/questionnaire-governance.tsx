'use client';

import { CheckCircle2, ClipboardPenLine, Plus, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

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
 * section, so an edit sends a placement only when the section changes.
 */
const NEW_SECTION = '__new-section__';
type DraftQuestion = { questionText: string; answerType: DraftAnswerType; required: boolean; choices: string; sectionChoice: string; newSectionTitle: string; currentSectionKey?: string };

function isChoiceType(answerType: DraftAnswerType): boolean {
  return answerType === 'Single select' || answerType === 'Multi select';
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

export function QuestionnaireGovernance({ questionnaire, definition, placements }: { questionnaire: QuestionnaireSummary; definition: QuestionnaireDefinition; placements: readonly QuestionPlacement[] }) {
  const router = useRouter(); const sectionIdPrefix = useId(); const [error, setError] = useState<string | null>(null); const [cleared, setCleared] = useState<readonly { questionKey: string; explanation: string }[]>([]); const [draft, setDraft] = useState<DraftQuestion | null>(null); const [editing, setEditing] = useState<string | null>(null);
  const inAnalystReview = questionnaire.release === null || questionnaire.release === undefined;
  const sections = sectionChoices(placements);
  async function release() { const result = await releaseQuestionnaireAction({ documentId: questionnaire.documentId }); if (!result.ok) { setError(result.formError); throw new Error('Release failed'); } router.refresh(); }
  async function returnToReview(reason?: string) { const result = await returnQuestionnaireToAnalystReviewAction({ documentId: questionnaire.documentId, reason }); if (!result.ok) { setError(result.formError); throw new Error('Return failed'); } router.refresh(); }
  async function remove(questionId: string) { const result = await deleteQuestionnaireQuestionAction({ documentId: questionnaire.documentId, questionId }); if (!result.ok) { setError(result.formError); throw new Error('Delete failed'); } router.refresh(); }
  async function save() {
    if (!draft) return;
    const choices = isChoiceType(draft.answerType) ? parseChoices(draft.choices) : undefined;
    if (isChoiceType(draft.answerType) && (!choices || choices.length === 0)) { setError('A select question needs at least one choice.'); return; }
    // Placement comes from every question, removed ones included (D-05); an edit that keeps its section sends none.
    const keepsSection = editing !== null && draft.sectionChoice === draft.currentSectionKey;
    const placement = keepsSection ? null : draft.sectionChoice === NEW_SECTION ? placeInNewSection(placements, draft.newSectionTitle) : placeInSection(placements, draft.sectionChoice);
    if (!keepsSection && !placement) { setError('Choose a section for this question.'); return; }
    const input = { questionText: draft.questionText, answerType: draft.answerType, required: draft.required, ...(placement ? { section: placement.section, order: placement.order } : {}), ...(choices ? { choices } : {}) };
    const result = editing ? await editQuestionnaireQuestionAction({ documentId: questionnaire.documentId, questionId: editing, input }) : await addQuestionnaireQuestionAction({ documentId: questionnaire.documentId, input });
    if (!result.ok) { setError(result.formError); return; }
    setCleared('clearedAnswers' in result.data ? result.data.clearedAnswers : []); setDraft(null); setEditing(null); router.refresh();
  }
  return <section aria-label="Questionnaire governance" className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-4">
    <div className="flex items-start gap-3"><ClipboardPenLine aria-hidden="true" className="mt-0.5 size-5 text-muted-foreground" /><div><h2 className="text-heading-sm text-foreground">{inAnalystReview ? 'Analyst review' : 'Released to Requestor'}</h2><p className="text-sm text-muted-foreground">{inAnalystReview ? 'This questionnaire is visible to Analysts only until it is released.' : 'Return it to analyst review before changing its questions.'}</p></div></div>
    {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    {cleared.length ? <div aria-live="polite" className="rounded-lg border border-border p-3"><p className="font-medium">Answers cleared by this revision</p><ul className="mt-2 list-disc pl-5 text-sm">{cleared.map((answer) => <li key={`${answer.questionKey}-${answer.explanation}`}><strong>{answer.questionKey}</strong>: {answer.explanation}</li>)}</ul><Button className="mt-2" data-print="hidden" onClick={() => setCleared([])} size="sm" type="button" variant="outline">Dismiss</Button></div> : null}
    {inAnalystReview ? <>
      <ConfirmDialog confirmLabel="Release questionnaire" confirmVariant="default" description="The Requestor can view this questionnaire after release." errorMessage={error} onConfirm={release} pendingLabel="Releasing questionnaire…" title="Release this questionnaire?" trigger={<Button data-print="hidden" type="button"><CheckCircle2 aria-hidden="true" />Release questionnaire</Button>} />
      <div className="grid gap-3"><div className="flex items-center justify-between"><h3 className="font-medium">Question editor</h3><Button onClick={() => { setDraft({ questionText: '', answerType: 'Text', required: false, choices: '', sectionChoice: sections.at(-1)?.key ?? NEW_SECTION, newSectionTitle: '' }); setEditing(null); }} data-print="hidden" size="sm" type="button"><Plus aria-hidden="true" />Add question</Button></div>
      {/*
        * The single list of questions on the analyst review page (D-32): grouped under a heading per section in
        * definition order, one row per question in question order, each with its answer type, required flag and,
        * for select questions, its choices.
        */}
      {orderQuestionnaire(definition).map((section, sectionIndex) => { const headingId = `${sectionIdPrefix}-section-${sectionIndex}`; return <div className="grid gap-2" key={section.key}><h4 className="micro-label text-muted-foreground" id={headingId}>{section.title}</h4><ul aria-labelledby={headingId} className="grid gap-2">
      {section.questions.map((question) => { const isLastActive = definition.length <= 1; const choices = questionChoices(question); return <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3" key={question.documentId ?? question.questionKey}><div className="min-w-0 space-y-1"><p className="text-sm font-medium text-foreground">{question.questionText}</p><p className="text-xs text-foreground-secondary">{questionCaption(question)}</p>{choices ? <p className="text-xs text-foreground-secondary">{choices}</p> : null}</div><div className="flex gap-2" data-print="hidden"><Button onClick={() => { setEditing(question.documentId ?? question.questionKey); setDraft({ questionText: question.questionText, answerType: question.answerType === 'File upload' ? 'Text' : question.answerType, required: question.required, choices: (question.choices ?? []).map((choice) => choice.label).join('\n'), sectionChoice: question.section.key, newSectionTitle: '', currentSectionKey: question.section.key }); }} size="sm" type="button" variant="outline">Edit{' '}<span className="sr-only">question: {question.questionText}</span></Button>{isLastActive ? <Button disabled size="sm" title="A questionnaire must retain at least one active question." type="button" variant="outline">Delete{' '}<span className="sr-only">question: {question.questionText}</span></Button> : <ConfirmDialog confirmLabel="Delete question" confirmVariant="destructive" description="The question and its answer are retained in the revision history." errorMessage={error} onConfirm={() => remove(question.documentId ?? question.questionKey)} pendingLabel="Deleting question…" title="Delete this question?" trigger={<Button size="sm" type="button" variant="outline">Delete{' '}<span className="sr-only">question: {question.questionText}</span></Button>} />}</div></li>; })}
      </ul></div>; })}
      </div>
      {draft ? <QuestionForm choices={sections} draft={draft} onCancel={() => { setDraft(null); setEditing(null); }} onChange={setDraft} onSave={save} /> : null}
    </> : <ConfirmDialog confirmLabel="Return to analyst review" confirmVariant="default" description="Editing requires returning this questionnaire to review first." errorMessage={error} onConfirm={returnToReview} pendingLabel="Returning to analyst review…" reasonRequired title="Return questionnaire to analyst review?" trigger={<Button data-print="hidden" type="button"><RotateCcw aria-hidden="true" />Return to analyst review</Button>} />}
  </section>;
}

function QuestionForm({ choices, draft, onChange, onSave, onCancel }: { choices: readonly SectionChoice[]; draft: DraftQuestion; onChange: (value: DraftQuestion) => void; onSave: () => void; onCancel: () => void }) {
  return <div className="grid gap-3 rounded-lg border border-border p-3">
    <h3 className="font-medium">Question details</h3>
    <div className="grid gap-2"><Label htmlFor="governance-question-text">Question text</Label><Textarea id="governance-question-text" onChange={(event) => onChange({ ...draft, questionText: event.target.value })} value={draft.questionText} /></div>
    <div className="grid gap-2"><Label htmlFor="governance-answer-type">Answer type</Label><select className={`${nativeSelectClassName} block w-full`} id="governance-answer-type" onChange={(event) => onChange({ ...draft, answerType: event.target.value as DraftAnswerType })} value={draft.answerType}>{answerTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
    {isChoiceType(draft.answerType) ? <div className="grid gap-2"><Label htmlFor="governance-choices">Choices</Label><Textarea aria-describedby="governance-choices-hint" id="governance-choices" onChange={(event) => onChange({ ...draft, choices: event.target.value })} value={draft.choices} /><p className="text-sm text-muted-foreground" id="governance-choices-hint">One choice per line.</p></div> : null}
    <div className="grid gap-2"><Label htmlFor="governance-section">Section</Label><select aria-describedby="governance-section-hint" className={`${nativeSelectClassName} block w-full`} id="governance-section" onChange={(event) => onChange({ ...draft, sectionChoice: event.target.value })} value={draft.sectionChoice}>{choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}<option value={NEW_SECTION}>New section</option></select><p className="text-sm text-muted-foreground" id="governance-section-hint">A question you add or move goes at the end of its section.</p></div>
    {draft.sectionChoice === NEW_SECTION ? <div className="grid gap-2"><Label htmlFor="governance-new-section-title">New section title</Label><Input aria-describedby="governance-new-section-title-hint" id="governance-new-section-title" maxLength={255} onChange={(event) => onChange({ ...draft, newSectionTitle: event.target.value })} value={draft.newSectionTitle} /><p className="text-sm text-muted-foreground" id="governance-new-section-title-hint">Shown to the Requestor as a heading.</p></div> : null}
    <div className="flex items-center gap-2"><Checkbox checked={draft.required} id="governance-required" onCheckedChange={(checked) => onChange({ ...draft, required: checked === true })} /><Label htmlFor="governance-required">Required</Label></div>
    <div className="flex gap-2"><Button disabled={draft.questionText.trim().length === 0 || (draft.sectionChoice === NEW_SECTION && draft.newSectionTitle.trim().length === 0)} onClick={onSave} type="button">Save question</Button><Button onClick={onCancel} type="button" variant="outline">Cancel</Button></div>
  </div>;
}
