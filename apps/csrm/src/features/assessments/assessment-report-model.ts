import type { ExportFixedTable } from '@/components/csrm/export/export-button';
import { exportVocabulary } from '@/features/exports/export-vocabulary';

import type {
  AnalystAssessmentDetail,
  AssessmentRating,
  AssessmentRiskListItem,
  ControlImplementation,
  ReleasedAssessmentDetailForActor,
} from './assessment-schema';

/*
 * The released assessment as the report and the header actions present it (Phase 19 D-14, D-21, D-23, D-24). Pure and
 * zod-free, read by server code only: the released page, the analyst review page and both report routes. The model
 * holds only fields the released projection discloses, so either actor's read gives the same paper.
 */

export type ControlsByRisk = Readonly<Record<string, readonly ControlImplementation[]>>;

export type AssessmentReportRisk = {
  /** The released risks read's Risk, Phase 10 §15.2's fields with each relation named. */
  readonly risk: AssessmentRiskListItem;
  readonly controls: readonly ControlImplementation[];
};

export type AssessmentReportModel = {
  readonly assessmentNumber: string;
  readonly requestNumber: string;
  readonly requestTitle: string;
  readonly releasedAt: string | null;
  readonly releasedBy: string | null;
  readonly overallRating: AssessmentRating | null;
  readonly overallRiskRationale: string | null;
  readonly summary: string | null;
  readonly recommendations: string | null;
  readonly overallControlEffectiveness: string | null;
  /** A calendar date (JDL LocalDate), formatted as the stored day. */
  readonly nextReviewDate: string | null;
  /** Phase 12 §10.1: whether the report's Notes carry the AI notice. */
  readonly aiAssisted: boolean;
  /** Active Risks only, in number order. */
  readonly risks: readonly AssessmentReportRisk[];
  /** The mitigation control implementations of those Risks. */
  readonly controlCount: number;
};

/** Either actor's released reads: the detail, the released risks read and each Risk's control implementations. */
export type AssessmentReportInput =
  | { readonly actor: 'requestor'; readonly assessment: ReleasedAssessmentDetailForActor; readonly risks: readonly AssessmentRiskListItem[]; readonly controlsByRisk: ControlsByRisk }
  | { readonly actor: 'analyst'; readonly assessment: AnalystAssessmentDetail; readonly risks: readonly AssessmentRiskListItem[]; readonly controlsByRisk: ControlsByRisk };

/*
 * Strapi's isAiAssistedAssessment, which decides the Requestor's aiAssisted, read from the analyst's generation facts:
 * generated, by a named provider. The released export's About sheet follows the same flag, and so does the released
 * read's parse of the analyst's detail (assessment-server-schema.ts).
 */
export function isAiAssistedGeneration(generation: AnalystAssessmentDetail['generation']): boolean {
  return Boolean(generation?.generatedAt && generation.providerName?.trim());
}

/*
 * 19-UI-SPEC §4.3 (FE4-01): the Notes carry the AI notice when AI assisted, a fact about the assessment, not the reader.
 * The released read's parse keeps it for either actor, so an analyst printing their own request's assessment from the
 * My route gets the same paper as the review route's and the Requestor's.
 */
function aiAssistedOf(input: AssessmentReportInput): boolean {
  return input.actor === 'analyst' ? isAiAssistedGeneration(input.assessment.generation) : input.assessment.aiAssisted;
}

/*
 * Phase 16 D-08 (W4): the report lists active Risks only, by the released read's rule. The released risks read is
 * already active-only in Strapi (ACTIVE_RISK_FILTER); the analyst detail keeps withdrawn Risks for its cards, so a Risk
 * it shows withdrawn is dropped here too, and both actors' reports are equal.
 */
function activeRisks(input: AssessmentReportInput): readonly AssessmentRiskListItem[] {
  if (input.actor === 'requestor') return input.risks;
  const active = new Set(input.assessment.risks.filter((risk) => risk.withdrawal === null).map((risk) => risk.documentId));
  return input.risks.filter((risk) => active.has(risk.documentId));
}

const riskOrder = new Intl.Collator('en', { numeric: true });

/** The released assessment as the report shows it, from either actor's reads. */
export function toAssessmentReportModel(input: AssessmentReportInput): AssessmentReportModel {
  const { assessment } = input;
  const risks = [...activeRisks(input)]
    .sort((left, right) => riskOrder.compare(left.riskNumber, right.riskNumber))
    .map((risk) => ({ risk, controls: input.controlsByRisk[risk.documentId] ?? [] }));
  return {
    assessmentNumber: assessment.assessmentNumber,
    requestNumber: assessment.assessmentRequest.requestNumber,
    requestTitle: assessment.assessmentRequest.title,
    releasedAt: assessment.approvalDate,
    releasedBy: assessment.approvedBy?.displayName ?? null,
    overallRating: assessment.overallRating,
    overallRiskRationale: assessment.overallRiskRationale,
    summary: assessment.summary,
    recommendations: assessment.recommendationsSummary,
    overallControlEffectiveness: assessment.overallControlEffectiveness,
    nextReviewDate: assessment.nextReviewDate,
    aiAssisted: aiAssistedOf(input),
    risks,
    controlCount: risks.reduce((total, { controls }) => total + controls.length, 0),
  };
}

const counts = new Intl.NumberFormat('en-AU');

/** 19-UI-SPEC §2.2: `{assessment number} as released: its summary, {r} {risk|risks} and {c} mitigation {control|controls}.` */
export function releasedAssessmentScopeSentence(model: Pick<AssessmentReportModel, 'assessmentNumber' | 'controlCount' | 'risks'>): string {
  const risks = model.risks.length;
  const controls = model.controlCount;
  return `${model.assessmentNumber} as released: its summary, ${counts.format(risks)} ${risks === 1 ? 'risk' : 'risks'} and ${counts.format(controls)} mitigation ${controls === 1 ? 'control' : 'controls'}.`;
}

/** The two tables a CSV can hold (the summary travels in the workbook only), named by the vocabulary's headings. */
const releasedCsvTables = ['risks', 'mitigation-controls'] as const;

export function releasedAssessmentExportTables(): readonly ExportFixedTable[] {
  const tables = exportVocabulary.tables['released-assessment'];
  return releasedCsvTables.map((key) => {
    const table = tables && Object.hasOwn(tables, key) ? tables[key] : undefined;
    if (!table) throw new Error(`The export vocabulary has no released-assessment table ${key}.`);
    return { key, heading: table.heading };
  });
}

/** What the released header's actions need: the report route, and the export when the session holds it. */
export type ReleasedAssessmentActions = {
  readonly documentId: string;
  readonly assessmentNumber: string;
  readonly reportHref: string;
  readonly export: { readonly scope: string; readonly tables: readonly ExportFixedTable[] } | null;
};

export function requestorReportHref(documentId: string): string {
  return `/app/assessments/${encodeURIComponent(documentId)}/report`;
}

export function analystReportHref(documentId: string): string {
  return `/app/review/assessments/${encodeURIComponent(documentId)}/report`;
}

/*
 * The released header's actions for a populated read (19-UI-SPEC §1, §4.1). Export is offered only when the session
 * holds released-assessment:export; that is presentation, and the export operation is the control (19-10, D-16).
 */
export function releasedAssessmentActions({ canExport, documentId, model, reportHref }: {
  canExport: boolean;
  documentId: string;
  model: AssessmentReportModel;
  reportHref: string;
}): ReleasedAssessmentActions {
  return {
    documentId,
    assessmentNumber: model.assessmentNumber,
    reportHref,
    export: canExport ? { scope: releasedAssessmentScopeSentence(model), tables: releasedAssessmentExportTables() } : null,
  };
}
