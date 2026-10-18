'use client';

import { useState } from 'react';
import { useUnloadWarning } from '@/components/csrm/use-unload-warning';

import { readSessionDraft, writeSessionDraft } from '@/lib/session-drafts/session-drafts';
import { NEW_SECTION, QuestionForm, isChoiceType, parseChoices, type DraftQuestion } from '../questionnaires/questionnaire-governance';
import type { SectionChoice } from '../questionnaires/questionnaire-placement';
import { RESTORED_CAPTION } from './instruction-field';
import type { QuestionnaireAiDecisionEdits, QuestionnaireAiItemView } from './questionnaire-ai-domain';

/*
 * Edit, then confirm (15-UI-SPEC §5.2; X-5; D-21): Phase 10's question form inside the card, prefilled with the proposal,
 * waiting for the server. Its values are kept for the session per person and proposal, as JSON read back defensively,
 * and restored with a caption. Only the fields the analyst changed are sent as `edits`; `section` for an addition only.
 */

/** The form's starting values: the proposal's, placed where the AI placed an addition. */
export function draftOfProposal(item: QuestionnaireAiItemView, sections: readonly SectionChoice[]): DraftQuestion {
  const values = item.proposed ?? item.current;
  const helpText = values?.helpText ?? '';
  const placement = item.kind === 'add' ? item.placement : null;
  const existing = placement && !placement.newSection ? sections.find((choice) => choice.section.title === placement.sectionTitle) : undefined;
  return {
    questionText: values?.questionText ?? '',
    helpText,
    initialHelpText: helpText,
    answerType: !values || values.answerType === 'File upload' ? 'Text' : values.answerType,
    required: values?.required ?? false,
    choices: (values?.choices ?? []).map((choice) => choice.label).join('\n'),
    sectionChoice: placement ? existing?.key ?? NEW_SECTION : '',
    newSectionTitle: placement && !existing ? placement.sectionTitle : '',
  };
}

const choiceLabels = (choices: string) => parseChoices(choices).map((choice) => choice.label).join('\n');

/** The fields the analyst changed, held to the contract's edit shape; empty when nothing changed. */
export function editsFromDraft(item: QuestionnaireAiItemView, initial: DraftQuestion, draft: DraftQuestion): QuestionnaireAiDecisionEdits {
  const edits: { -readonly [K in keyof QuestionnaireAiDecisionEdits]: QuestionnaireAiDecisionEdits[K] } = {};
  if (draft.questionText.trim() !== initial.questionText) edits.questionText = draft.questionText.trim();
  if (draft.helpText.trim() !== initial.helpText) edits.helpText = draft.helpText.trim() || null;
  if (draft.answerType !== initial.answerType) edits.answerType = draft.answerType;
  if (isChoiceType(draft.answerType) && (edits.answerType !== undefined || choiceLabels(draft.choices) !== choiceLabels(initial.choices))) edits.choices = parseChoices(draft.choices);
  if (draft.required !== initial.required) edits.required = draft.required;
  if (item.kind === 'add') {
    const newSection = draft.sectionChoice === NEW_SECTION;
    const moved = draft.sectionChoice !== initial.sectionChoice || (newSection && draft.newSectionTitle.trim() !== initial.newSectionTitle);
    if (moved) edits.section = newSection ? { kind: 'new', title: draft.newSectionTitle.trim() } : { kind: 'existing', key: draft.sectionChoice };
  }
  return edits;
}

const recordOf = (item: QuestionnaireAiItemView) => `${item.runId}:${item.itemKey}`;

/* A kept draft that does not parse, or is not a draft's shape, is discarded. */
function keptDraft(ownerKey: string | null, item: QuestionnaireAiItemView, fallback: DraftQuestion): DraftQuestion | null {
  if (!ownerKey) return null;
  const kept = readSessionDraft('proposal-edit', ownerKey, recordOf(item));
  if (!kept) return null;
  try {
    const value: unknown = JSON.parse(kept);
    if (typeof value !== 'object' || value === null) return null;
    const draft = { ...fallback, ...(value as Partial<DraftQuestion>) };
    const strings = [draft.questionText, draft.helpText, draft.choices, draft.sectionChoice, draft.newSectionTitle].every((field) => typeof field === 'string');
    return strings && typeof draft.required === 'boolean' ? draft : null;
  } catch {
    return null;
  }
}

export function clearProposalEditDraft(ownerKey: string | null, item: QuestionnaireAiItemView): void {
  if (ownerKey) writeSessionDraft('proposal-edit', ownerKey, recordOf(item), '');
}

export function ProposalEditForm({ item, onConfirm, onDiscard, ownerKey, pending, refusal, sections }: {
  item: QuestionnaireAiItemView;
  sections: readonly SectionChoice[];
  ownerKey: string | null;
  pending: boolean;
  /** A server refusal (§13 Q2), shown in the form's error line. */
  refusal: string | null;
  onConfirm: (edits: QuestionnaireAiDecisionEdits) => void;
  onDiscard: () => void;
}) {
  const [initial] = useState(() => draftOfProposal(item, sections));
  const [restored] = useState(() => keptDraft(ownerKey, item, initial));
  const [draft, setDraft] = useState(restored ?? initial);
  useUnloadWarning(JSON.stringify(draft) !== JSON.stringify(initial));
  return (
    <div className="grid gap-2">
      {restored ? <p className="text-xs text-foreground-secondary">{RESTORED_CAPTION}</p> : null}
      <QuestionForm
        discardLabel="Discard edits"
        headingLevel={4}
        initial={restored ?? initial}
        onDiscard={onDiscard}
        onDraftChange={(draft) => { setDraft(draft); if (ownerKey) writeSessionDraft('proposal-edit', ownerKey, recordOf(item), JSON.stringify(draft)); }}
        onReload={() => undefined}
        onSave={(draft) => onConfirm(editsFromDraft(item, initial, draft))}
        pendingLabel="Confirming…"
        refusal={refusal ? { message: refusal, reload: false } : null}
        saving={pending}
        sections={sections}
        showSection={item.kind === 'add'}
        submitLabel="Confirm with edits"
        title="Edit, then confirm"
      />
    </div>
  );
}
