import { factories } from '@strapi/strapi';

import { resolveContextAttachments, type ContextAttachmentReader } from '../../../csrm/ai/assessment-context-loader';
import { projectAiRun, runAttachmentIds, RUN_QUESTIONNAIRE_LABELS_POPULATE } from '../services/ai-run-record';

type RecordValue = Record<string, unknown>;

const RUN_ID_INVALID = 'CSRM AI run identifier is invalid.';
const RUN_NOT_FOUND = 'CSRM AI run was not found.';

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeError(ctx: RecordValue, status: 400 | 404, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest : ctx.notFound;
  if (typeof responder === 'function') return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}

/*
 * D-25: GET /api/v1/ai_runs/{runId}. The route's policy admits a human Security Analyst only (D-32). The read
 * serves the run's facts, its context summary and its outcome, never the proposal or any Requestor free text;
 * an unknown id answers the same 404 as any other. Phase 13 D-28: the summary names the notes the run used without
 * their text, and a v1 summary, written before notes reached the context, is served as having used none. Phase 14
 * D-35: the files the run used are named by what their records say now (current name, request, removed since), read
 * with one query; the stored summary keeps documentIds only.
 */
export default factories.createCoreController('api::csrm-ai-run.csrm-ai-run' as Parameters<typeof factories.createCoreController>[0], ({ strapi }) => ({
  async findRun(ctx: RecordValue) {
    if (!isRecord(ctx.query) || Object.keys(ctx.query).length > 0) return safeError(ctx, 400, RUN_ID_INVALID);
    const params = isRecord(ctx.params) ? ctx.params : {};
    const runId = typeof params.runId === 'string' && /^[A-Za-z0-9_-]{1,255}$/.test(params.runId) ? params.runId : null;
    if (!runId) return safeError(ctx, 400, RUN_ID_INVALID);
    const documents = strapi.documents as unknown as (uid: string) => { findOne: (query: RecordValue) => Promise<RecordValue | null> };
    const run = await documents('api::csrm-ai-run.csrm-ai-run').findOne({
      documentId: runId,
      populate: {
        initiatedBy: { fields: ['documentId', 'displayName', 'accountStatus'] },
        assessmentRequest: { fields: ['documentId'] },
        // WR-105: the questions' current text names the summary's answer sources (projectAiRun).
        questionnaire: RUN_QUESTIONNAIRE_LABELS_POPULATE,
        assessment: { fields: ['documentId'] },
        risk: { fields: ['documentId'] },
      },
    });
    if (!run) return safeError(ctx, 404, RUN_NOT_FOUND);
    const attachmentNames = await resolveContextAttachments(strapi as unknown as ContextAttachmentReader, runAttachmentIds(run));
    return { data: projectAiRun(run, attachmentNames) };
  },
}));
