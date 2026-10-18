type Row = Record<string, unknown>;
type RunReader = { documents: (uid: string) => { findMany: (query: Row) => Promise<Row[]> } };

/** Paginate legacy overflow records too: a bounded page must never hide an undecided run. */
export async function completedQuestionnaireProposalRuns(strapi: RunReader, questionnaireId: string, query: Row): Promise<Row[]> {
  const runs: Row[] = [];
  const pageSize = 100;
  for (let start = 0; ; start += pageSize) {
    const page = await strapi.documents("api::csrm-ai-run.csrm-ai-run").findMany({
      ...query,
      filters: { questionnaire: { documentId: { $eq: questionnaireId } }, operation: { $in: ["questionnaire-proposals", "question-rewrite"] }, status: { $eq: "completed" } },
      start, limit: pageSize,
    });
    runs.push(...page);
    if (page.length < pageSize) return runs;
  }
}
