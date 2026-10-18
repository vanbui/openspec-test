import assert from "node:assert/strict";
import test from "node:test";

import { myRiskAssessmentsExportView, riskAssessmentsExportView } from "../src/csrm/exports/export-views";
import { exportViewColumns } from "../src/csrm/exports/export-vocabulary";

/*
 * BE1-06 (Phase 19 code review): the assessment list exports re-read the chosen ids with the list's scope as well, and
 * the owner export checks each record again in memory with the one released-read rule, as the released read module
 * does ("each read applies both rules twice ... so a filter is never trusted alone"). A record that leaves the
 * caller's scope between selecting the ids and hydrating them is not written.
 */

type Doc = Record<string, unknown>;

const OWNER = "user-ann";
const OWNER_STATE = { csrmAuthorization: { assessmentOwnerCollectionScope: "own", assessmentOwnerDocumentId: OWNER } } as const;
const ANALYST_STATE = { csrmAuthorization: { assessmentRequestActor: "analyst" } } as const;

function assessment(documentId: string, changes: { requestStatus?: string; requestor?: string; assessmentStatus?: string } = {}): Doc {
  return {
    id: Number(documentId.replace(/\D/g, "")),
    documentId,
    assessmentNumber: documentId.toUpperCase(),
    assessmentStatus: changes.assessmentStatus ?? "approved",
    approvalDate: "2026-09-01T00:00:00.000Z",
    assessmentDate: "2026-09-01",
    approvedBy: { documentId: "user-max", displayName: "Max Analyst" },
    reviewedBy: null,
    overallRating: "High",
    assessmentRequest: {
      documentId: `request-${documentId}`,
      title: `Request for ${documentId}`,
      requestStatus: changes.requestStatus ?? "approved",
      requestor: { documentId: changes.requestor ?? OWNER, displayName: "Ann Requestor" },
    },
  };
}

/** A fake Strapi: the Document Service records every findMany, and the Risk summary aggregate returns no rows. */
function fakeStrapi(hydrated: readonly Doc[]) {
  const findMany: Doc[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["join", "whereIn", "whereRaw", "groupBy"]) chain[method] = () => chain;
  chain.select = async () => [];
  const connection = Object.assign(() => chain, { raw: (sql: string) => sql });
  const strapi = {
    documents: () => ({
      count: async () => hydrated.length,
      findMany: async (query: Doc) => {
        findMany.push(query);
        return [...hydrated];
      },
    }),
    db: { connection },
  };
  return { strapi, findMany };
}

/** Every `documentId: { $in }` and every other filter key the hydrate query names, flattened. */
function filterText(query: Doc): string {
  return JSON.stringify(query.filters);
}

test("the My risk assessments export hydrates within the owner's released scope and drops a record that left it (BE1-06)", async () => {
  const kept = assessment("a1");
  const closed = assessment("a2", { requestStatus: "rejected" });
  const someoneElse = assessment("a3", { requestor: "user-zed" });
  const { strapi, findMany } = fakeStrapi([kept, closed, someoneElse]);
  const view = myRiskAssessmentsExportView(strapi);
  view.parseExportQuery({}, OWNER_STATE);
  const documents = await view.hydrate(["a1", "a2", "a3"], exportViewColumns("my-risk-assessments"));
  assert.deepEqual(documents.map((document) => document.documentId), ["a1"]);
  const hydrate = findMany.at(-1)!;
  const filters = filterText(hydrate);
  assert.match(filters, /"\$in":\["a1","a2","a3"\]/);
  assert.match(filters, new RegExp(`"documentId":\\{"\\$eq":"${OWNER}"\\}`), "the owner rule is a hydrate filter");
  assert.match(filters, /"requestStatus":\{"\$eq":"approved"\}/, "the released rule is a hydrate filter");
});

test("the analyst Risk assessments export hydrates with the list's own filters, not by id alone (BE1-06)", async () => {
  const { strapi, findMany } = fakeStrapi([assessment("a1", { assessmentStatus: "in-review" })]);
  const view = riskAssessmentsExportView(strapi);
  view.parseExportQuery({ status: "in-review" }, ANALYST_STATE);
  const documents = await view.hydrate(["a1"], exportViewColumns("risk-assessments"));
  assert.deepEqual(documents.map((document) => document.documentId), ["a1"]);
  const filters = filterText(findMany.at(-1)!);
  assert.match(filters, /"\$in":\["a1"\]/);
  assert.match(filters, /"assessmentStatus":\{"\$eq":"in-review"\}/, "the list's filter is a hydrate filter");
});
