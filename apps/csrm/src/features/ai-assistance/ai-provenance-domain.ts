import type { QuestionAiOrigin } from '@/features/questionnaires/questionnaire-schema';
/*
 * The provenance header and the "What the AI used" sheet (12-UI-SPEC §1 and §2). Plain and zod-free, and apart
 * from the policy helpers, whose refusal copy would otherwise ride into the editor's client bundle.
 */

/*
 * The provenance header (12-UI-SPEC §1, X-11). The page derives these props on the server from the served
 * facts; the header only renders them.
 */
export type AiGenerationFactsView = {
  generatedAt: string | null;
  generatedBy: { documentId: string; displayName: string } | null;
  providerName: string | null;
  providerVersion: string | null;
  runId: string | null;
  /** Phase 15 D-28: a questionnaire's open AI proposals, served to a human Security Analyst who did not raise the request. */
  openProposals?: number | null;
};

export type AiProvenanceReview =
  | { kind: 'counts'; outstanding: number; firstDestination: string | null }
  | { kind: 'questionnaire-counts'; generated: number; edited: number; added: number; fromProposals: number }
  | { kind: 'untracked' }
  | { kind: 'none' };

export type AiProvenanceHeaderProps = {
  kind: 'assessment' | 'questionnaire';
  generation: AiGenerationFactsView;
  released: boolean;
  review: AiProvenanceReview;
  /** Phase 15 (15-UI-SPEC §9.1; D-28): the questionnaire's open AI proposals before the draft; null when not served. */
  openProposals?: number | null;
};

/** The "What the AI used" sheet's record: Phase 15's proposal and rewrite runs have their own description (§9.3). */
export type AiRunSheetKind = AiProvenanceHeaderProps['kind'] | 'questionnaire-proposals';

type ProvenanceCount = { runId: string; outstanding: number } | null | undefined;

/** The analyst editor's header props, or null when the assessment was not generated with AI. */
export function assessmentProvenanceHeaderProps(detail: {
  assessmentStatus: string;
  generation: AiGenerationFactsView | null;
  aiProvenance: ProvenanceCount;
  risks: readonly { documentId: string; aiProvenance: ProvenanceCount }[];
}): AiProvenanceHeaderProps | null {
  if (!detail.generation) return null;
  const released = detail.assessmentStatus === 'approved' || detail.assessmentStatus === 'closed';
  const base = { kind: 'assessment' as const, generation: detail.generation, released };
  if (released) return { ...base, review: { kind: 'none' } };
  /*
   * IN-301 (with CR-01): Strapi serves the run id from the assessment's own AI facts alone, which may be missing or
   * malformed while the Risks carry theirs. The record is untracked (generated before CSRM recorded runs) only when it
   * and every Risk carry none; otherwise the counts stay, and the run is the first one a record carries.
   */
  const runId = detail.generation.runId ?? detail.aiProvenance?.runId ?? detail.risks.find((risk) => risk.aiProvenance)?.aiProvenance?.runId ?? null;
  if (runId === null) return { ...base, review: { kind: 'untracked' } };
  const tracked = { ...base, generation: { ...detail.generation, runId } };
  const detailsOutstanding = detail.aiProvenance?.outstanding ?? 0;
  const firstRisk = detail.risks.find((risk) => (risk.aiProvenance?.outstanding ?? 0) > 0);
  const outstanding = detailsOutstanding + detail.risks.reduce((sum, risk) => sum + (risk.aiProvenance?.outstanding ?? 0), 0);
  const firstDestination = detailsOutstanding > 0 ? '#assessment-details' : firstRisk ? `#risk-${encodeURIComponent(firstRisk.documentId)}` : null;
  return { ...tracked, review: { kind: 'counts', outstanding, firstDestination } };
}

/** The questionnaire review page's header props, or null when the questionnaire was not generated with AI. */
export function questionnaireProvenanceHeaderProps(input: {
  generation: AiGenerationFactsView | null | undefined;
  inAnalystReview: boolean;
  questions: readonly { aiOrigin?: QuestionAiOrigin | null }[];
}): AiProvenanceHeaderProps | null {
  if (!input.generation) return null;
  const base = { kind: 'questionnaire' as const, generation: input.generation, released: !input.inAnalystReview };
  if (!input.inAnalystReview) return { ...base, review: { kind: 'none' } };
  if (input.generation.runId === null) return { ...base, review: { kind: 'untracked' } };
  const count = (origin: string) => input.questions.filter((question) => question.aiOrigin === origin).length;
  return {
    ...base,
    review: { kind: 'questionnaire-counts', generated: count('generated'), edited: count('generated-edited'), added: count('analyst-added'), fromProposals: count('proposal-confirmed') + count('proposal-edited') },
    openProposals: input.generation.openProposals ?? null,
  };
}

/** Line 1: who asked for the generation. */
export function generationRequesterLine(generation: AiGenerationFactsView): string {
  const name = generation.generatedBy?.displayName.trim();
  return name ? `Generated with AI at the request of ${name}` : 'Generated with AI';
}

/** Line 3 for an assessment with proposals outstanding. */
export function outstandingProposalsLabel(outstanding: number): string {
  return `${outstanding} AI-proposed ${outstanding === 1 ? 'field' : 'fields'} to review`;
}

/** Line 3 for a questionnaire in analyst review: each non-zero part, joined by the X-4 separator (walk D11: one or many). */
export function questionnaireOriginLine(review: { generated: number; edited: number; added: number; fromProposals?: number }): string | null {
  const fromProposals = review.fromProposals ?? 0;
  const parts = [
    review.generated > 0 ? `${review.generated} AI proposed` : null,
    review.edited > 0 ? `${review.edited} edited` : null,
    // Phase 15 (15-UI-SPEC §9.1; D-28): questions that came from a confirmed or edited AI proposal.
    fromProposals > 0 ? `${fromProposals} from AI proposals` : null,
    review.added > 0 ? `${review.added} added by ${review.added === 1 ? 'an analyst' : 'analysts'}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function untrackedGenerationLine(kind: AiProvenanceHeaderProps['kind']): string {
  return kind === 'assessment'
    ? 'This draft was generated before CSRM recorded what the AI used, so its fields aren’t marked.'
    : 'This questionnaire was generated before CSRM recorded what the AI used, so its questions aren’t marked.';
}

/* "What the AI used" (12-UI-SPEC §2). */
/** §9.1: the header's line linking the open AI proposals to the panel. */
export function openProposalsLine(count: number): string {
  return `${count} open AI ${count === 1 ? 'proposal' : 'proposals'}`;
}

export function aiRunSheetDescription(kind: AiRunSheetKind): string {
  if (kind === 'questionnaire-proposals') return 'What CSRM sent to the AI for these proposals. Requestor text was marked as information to analyse, never as instructions, and isn’t stored with this record.';
  return `What CSRM sent to the AI for ${kind === 'assessment' ? 'this draft' : 'this questionnaire'}. Requestor text was marked as information to analyse, never as instructions, and isn’t stored with this record.`;
}

export function aiRunOutcome(run: { status: 'running' | 'completed' | 'failed' | 'interrupted'; failureMessage: string | null }): string {
  if (run.status === 'completed') return 'Completed';
  if (run.status === 'failed') return run.failureMessage ? `Failed: ${run.failureMessage}` : 'Failed';
  if (run.status === 'interrupted') return 'Interrupted by a restart';
  return 'Running';
}

export function classificationSourceCaption(source: 'assets' | 'default'): string {
  return source === 'assets'
    ? 'From the request’s information assets'
    : 'No information asset on this request is classified, so Internal applies';
}

export function answeredQuestionsLine(answered: number, included: number): string {
  return `${answered} of ${included} ${included === 1 ? 'question' : 'questions'} answered`;
}

/* The run summary names request fields by key; the sheet shows the request form's labels (Phase 10 §9.1; walk D11). */
const requestFieldLabels: ReadonlyMap<string, string> = new Map([
  ['request.title', 'Request title'],
  ['request.description', 'Description'],
  ['request.assessmentType', 'Assessment type'],
  ['request.division', 'Division'],
  ['request.businessUnit', 'Business unit'],
  ['request.businessPurpose', 'Business purpose'],
  ['request.businessCriticality', 'Business criticality'],
  ['request.thirdPartyInvolvement', 'Third-party involvement'],
  ['request.thirdPartyDetails', 'Third-party details'],
  ['request.regulatoryRequirements', 'Regulatory requirements'],
]);

export function requestFieldLabel(key: string): string {
  return requestFieldLabels.get(key) ?? key.replace(/^request\./, '');
}

/** The Risk Types line under the names, when some were left out of the context. */
export function riskTypesLeftOutLine(offered: number, total: number): string | null {
  const left = total - offered;
  if (left <= 0) return null;
  return `${left} less relevant Risk ${left === 1 ? 'Type was' : 'Types were'} left out.`;
}

/* 12-UI-SPEC §4.1, X-12: a citation reads as its kind and the served label. */
export type AiCitationView = { key: string; kind: 'request' | 'answer' | 'system' | 'asset'; label: string; section: string | null; classification: string | null };

export function citationText(citation: AiCitationView): string {
  if (citation.kind === 'answer') return `Answer: ${citation.label}`;
  if (citation.kind === 'request') return `Request: ${citation.label}`;
  if (citation.kind === 'system') return `System: ${citation.label}`;
  return `Asset: ${citation.label} · ${citation.classification ?? 'Not classified'}`;
}

/** Answer and request citations open their source in place; systems and assets are plain text (UI-D9). */
export function citationOpensSource(citation: AiCitationView): boolean {
  return citation.kind === 'answer' || citation.kind === 'request';
}
