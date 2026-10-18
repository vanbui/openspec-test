import type { ExportCellValue } from "./export-views";
import { exportTableColumns } from "./export-vocabulary";
import type { ExportAboutExtras, ExportTable } from "./run-export";

/*
 * The released risk assessment as the tables its export writes (Phase 19 D-21; 19-UI-SPEC §3.2, §3.3). Its input is
 * exactly what the three released reads return to the Requestor: the released detail (projectReleasedAssessmentDetail),
 * the released risks read (active Risks only, under ACTIVE_RISK_FILTER) and each of those Risks' control implementations
 * read. So both actors' files hold the same tables, no analyst-only field reaches either, and a withdrawn Risk is absent
 * because the read leaves it out. Nothing here reads a record: the controller loads the reads and this module only shapes
 * them. The vocabulary's `tables.released-assessment` names every column, and holds no column the released reads do not
 * disclose (19-10 dropped `Risk Type`).
 */

type Row = Readonly<Record<string, ExportCellValue>>;
type RecordValue = Record<string, unknown>;

/** The export view the log line names. */
export const RELEASED_ASSESSMENT_EXPORT_VIEW = "released-assessment";

/** Phase 12 §10.1's notice: the About sheet's `AI assistance` row when the released read says AI assisted. */
export const RELEASED_ASSESSMENT_AI_NOTICE = "AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before releasing it to you.";

/** The released reads of one assessment, as the Requestor's released view reads them. */
export type ReleasedAssessmentReads = {
  /** projectReleasedAssessmentDetail of the released record. */
  readonly detail: RecordValue;
  /** projectAssessmentRiskListItem of each Risk the released risks read returns, in its order. */
  readonly risks: readonly RecordValue[];
  /** projectControlImplementationSummary of each implementation the control-implementation read returns, by Risk documentId. */
  readonly controlImplementations: ReadonlyMap<string, readonly RecordValue[]>;
};

export type ReleasedAssessmentExport = {
  readonly heading: string;
  /** The workbook's file slug, `{assessment number}-risk-assessment`. */
  readonly slug: string;
  readonly tables: readonly ExportTable[];
  readonly about: ExportAboutExtras;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** An instant as the ISO text the pipeline reads, whether the store returned a string or a Date. */
function instant(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return text(value);
}

function personName(value: unknown): string | null {
  return isRecord(value) ? text(value.displayName) : null;
}

/**
 * The assessment number as a file name's start: lower case (exportFileName takes lower-case names only), with any other
 * character than a letter, a digit or a hyphen made a hyphen. An assessment number is `ASM-YYYY-XXXXXX`, so this only
 * ever lowers its case; a number that leaves nothing names the file `risk-assessment` alone.
 */
export function releasedAssessmentFileStem(assessmentNumber: unknown): string {
  const stem = (typeof assessmentNumber === "string" ? assessmentNumber : "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return stem;
}

function slugOf(stem: string, suffix: string): string {
  return stem ? `${stem}-${suffix}` : suffix;
}

function table(key: "summary" | "risks" | "mitigation-controls", slug: string, rows: readonly Row[], summary = false): ExportTable {
  const spec = exportTableColumns(RELEASED_ASSESSMENT_EXPORT_VIEW, key);
  return { key, heading: spec.heading, slug, columns: spec.columns, rows, ...(summary ? { summary: true } : {}) };
}

/** The released assessment's Summary, Risks and Mitigation controls tables, its About extras, heading and file slug. */
export function releasedAssessmentExportTables(reads: ReleasedAssessmentReads): ReleasedAssessmentExport {
  const { detail } = reads;
  const request = isRecord(detail.assessmentRequest) ? detail.assessmentRequest : {};
  const stem = releasedAssessmentFileStem(detail.assessmentNumber);

  const summary: Row = {
    assessmentNumber: text(detail.assessmentNumber),
    requestNumber: text(request.requestNumber),
    requestTitle: text(request.title),
    releasedAt: instant(detail.approvalDate),
    releasedBy: personName(detail.approvedBy),
    overallRating: text(detail.overallRating),
    overallControlEffectiveness: text(detail.overallControlEffectiveness),
    summary: text(detail.summary),
    overallRationale: text(detail.overallRiskRationale),
    recommendations: text(detail.recommendationsSummary),
    nextReviewDate: text(detail.nextReviewDate),
  };

  const risks: Row[] = reads.risks.map((risk) => ({
    riskNumber: text(risk.riskNumber),
    riskStatement: text(risk.riskStatement),
    inherentRating: text(risk.inherentRating),
    residualRating: text(risk.residualRating),
    treatmentAction: text(risk.treatmentAction),
    treatmentPlan: text(risk.treatmentPlan),
    riskOwner: personName(risk.riskOwner),
    treatmentOwner: personName(risk.treatmentOwner),
    targetDate: text(risk.targetDate),
    treatmentStatus: text(risk.treatmentStatus),
  }));

  // Keyed by risk number, in the risks read's order, each Risk's implementations in its own read's order.
  const mitigation: Row[] = reads.risks.flatMap((risk) => (reads.controlImplementations.get(String(risk.documentId)) ?? []).map((implementation) => {
    const control = isRecord(implementation.controlSummary) ? implementation.controlSummary : null;
    return {
      riskNumber: text(risk.riskNumber),
      controlNumber: text(control?.controlNumber),
      controlName: text(control?.name),
      implementationStatus: text(implementation.controlStatus),
      effectiveness: text(implementation.effectivenessRating),
    };
  }));

  const number = text(detail.assessmentNumber) ?? "";
  const title = text(request.title);
  return {
    heading: title ? `${number} · ${title}` : number,
    slug: slugOf(stem, "risk-assessment"),
    tables: [
      table("summary", slugOf(stem, "summary"), [summary], true),
      table("risks", slugOf(stem, "risks"), risks),
      table("mitigation-controls", slugOf(stem, "mitigation-controls"), mitigation),
    ],
    about: detail.aiAssisted === true ? { aiAssistance: RELEASED_ASSESSMENT_AI_NOTICE } : {},
  };
}
