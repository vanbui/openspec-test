import 'server-only';

import { z } from 'zod';

import {
  analystAssessmentDetailSchema,
  assessmentDetailShape,
  requestorReleasedAssessmentDetailSchema,
  requireReleaseFacts,
} from './assessment-schema';
import { isAiAssistedGeneration } from './assessment-report-model';

/*
 * The assessment detail parsers only server code runs (19-10; 19-PLAN-CHECK recheck B W-2). The client modules of
 * /app/risks/{documentId} and /app/requests/{documentId} load assessment-schema.ts, whose top-level schemas are not
 * tree-shaken, so a parser only the server needs lives here and those route budgets keep their headroom.
 */

/**
 * D-14: the analyst detail as GET /v1/risk_assessments/{id} serves it to an analyst, with `released`: whether the
 * assessment is released, decided by Strapi's one released-assessment record-read check. The analyst page offers its
 * Export and Print report from this flag, never from a copy of the rule.
 */
export const analystAssessmentReadSchema = analystAssessmentDetailSchema.extend({ released: z.boolean() }).strict();

/*
 * D10, WR-304: exactly what ReleasedAssessmentDetailView renders. The route passes the parsed read to a Client
 * Component, so whatever the parse keeps reaches the browser: it keeps no generating analyst, no generation date, no
 * analyst aggregate, no released flag and no record id the view never shows.
 */
const releasedAssessmentViewSchema = z.object({
  assessmentNumber: assessmentDetailShape.assessmentNumber,
  assessmentStatus: assessmentDetailShape.assessmentStatus,
  assessmentDate: assessmentDetailShape.assessmentDate,
  nextReviewDate: assessmentDetailShape.nextReviewDate,
  approvalDate: assessmentDetailShape.approvalDate,
  summary: assessmentDetailShape.summary,
  overallRating: assessmentDetailShape.overallRating,
  overallControlEffectiveness: assessmentDetailShape.overallControlEffectiveness,
  recommendationsSummary: assessmentDetailShape.recommendationsSummary,
  overallRiskRationale: assessmentDetailShape.overallRiskRationale,
  assessmentRequest: assessmentDetailShape.assessmentRequest,
  reviewedBy: assessmentDetailShape.reviewedBy,
  approvedBy: assessmentDetailShape.approvedBy,
}).strict().superRefine(requireReleaseFacts);
const releasedAssessmentViewKeys = Object.keys(releasedAssessmentViewSchema.shape);

/**
 * `/v1/risk_assessments/{id}` serves the analyst detail to an analyst and the
 * Requestor detail to a Requestor, discriminated by `actor` exactly as the
 * contract declares. The released screen shows the same released facts either
 * way, so it accepts both and keeps only the fields it renders — an analyst
 * opening their own released assessment from the My screen must not be told the
 * assessment could not be loaded.
 */
export const releasedAssessmentDetailForActorSchema = z
  .discriminatedUnion('actor', [analystAssessmentReadSchema, requestorReleasedAssessmentDetailSchema])
  .transform((detail, context) => {
    /*
     * FE4-02 (D-16, 19-UI-SPEC §4.4): Strapi serves an analyst the detail released or not, and decides `released`. An
     * assessment it says is not released is the released read's missing record, decided before its release facts are
     * checked, so it is never mistaken for a contract mismatch. getReleasedAssessment answers it as the 404 Strapi
     * gives a Requestor.
     */
    if (detail.actor === 'analyst' && !detail.released) return null;
    const released: Record<string, unknown> = {};
    for (const key of releasedAssessmentViewKeys) {
      released[key] = (detail as Record<string, unknown>)[key];
    }
    const parsed = releasedAssessmentViewSchema.safeParse(released);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      }
      return z.NEVER;
    }
    /*
     * D-23, FE4-01 (19-UI-SPEC §4.3): either actor's view keeps whether AI assisted, and nothing else of the AI facts, so
     * the paper discloses an AI draft whoever prints it. The analyst's flag is Strapi's rule read from the generation
     * facts. The released screen still shows Phase 12 §10.1's sentence to the Requestor only (IN-302).
     */
    return detail.actor === 'requestor'
      ? { ...parsed.data, actor: detail.actor, aiAssisted: detail.aiAssisted }
      : { ...parsed.data, actor: detail.actor, aiAssisted: isAiAssistedGeneration(detail.generation) };
  });
/** A released detail; the parse's null, an assessment that is not released, never leaves getReleasedAssessment. */
export type ReleasedAssessmentDetailForActor = NonNullable<z.infer<typeof releasedAssessmentDetailForActorSchema>>;
