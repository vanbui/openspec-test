import assert from "node:assert/strict";
import test from "node:test";

import { assessmentControllerExtension } from "../src/api/csrm-assessment/controllers/csrm-assessment";
import { readWorkbookSheets } from "../src/csrm/spreadsheets/xlsx-reader";

/*
 * BE1-07 (Phase 19 code review): the released export reads every active Risk of the assessment and every control
 * implementation of each, page by page, never the first 1,000 alone. A cut table is data loss in the delivered file
 * ("never a partial file", D-17); past the export row cap the existing EXPORT_ROW_LIMIT refusal applies.
 */

type Doc = Record<string, unknown>;

const ASSESSMENT = {
  id: 1,
  documentId: "assessment-1",
  assessmentNumber: "ASM-001",
  assessmentStatus: "approved",
  approvalDate: "2026-09-01T00:00:00.000Z",
  assessmentDate: "2026-09-01",
  approvedBy: { documentId: "user-max", displayName: "Max Analyst" },
  reviewedBy: null,
  overallRating: "High",
  summary: "Summary",
  assessmentRequest: { documentId: "request-1", requestNumber: "REQ-001", title: "Payroll", requestStatus: "approved", requestor: { documentId: "user-ann", displayName: "Ann" } },
};

function risk(index: number): Doc {
  const number = String(index).padStart(5, "0");
  return { id: index + 1, documentId: `risk-${number}`, riskNumber: `RSK-${number}`, riskStatement: `Risk ${number}`, withdrawnAt: null, withdrawalReason: null };
}

function implementation(index: number): Doc {
  const number = String(index).padStart(5, "0");
  return {
    id: index + 1,
    documentId: `implementation-${number}`,
    control: { documentId: `control-${number}`, controlNumber: `CTL-${number}`, name: `Control ${number}`, framework: "ISO 27001" },
    controlOwner: null,
    controlStatus: "Implemented",
    effectivenessRating: "Effective",
  };
}

/** A page of `rows` as the Document Service gives it: `start` (default 0) and `limit` honoured. */
function page(rows: readonly Doc[], query: Doc): Doc[] {
  const start = typeof query.start === "number" ? query.start : 0;
  const limit = typeof query.limit === "number" ? query.limit : rows.length;
  return rows.slice(start, start + limit);
}

function fakeStrapi(risks: readonly Doc[], implementations: ReadonlyMap<string, readonly Doc[]>) {
  const documents = (uid: string) => ({
    findOne: async (query: Doc) => {
      if (uid === "api::idambox-user.idambox-user") return { documentId: query.documentId, displayName: "Bob Analyst" };
      if (uid === "api::csrm-assessment.csrm-assessment") return query.documentId === ASSESSMENT.documentId ? structuredClone(ASSESSMENT) : null;
      return null;
    },
    findMany: async (query: Doc) => {
      if (uid === "api::csrm-risk.csrm-risk") return page(risks, query);
      if (uid === "api::csrm-control-implementation.csrm-control-implementation") {
        const filters = query.filters as { risk: { documentId: { $eq: string } } };
        return page(implementations.get(filters.risk.documentId.$eq) ?? [], query);
      }
      return [];
    },
  });
  return { documents, log: { info: () => undefined, warn: () => undefined } };
}

async function exportReleased(risks: readonly Doc[], implementations: ReadonlyMap<string, readonly Doc[]>) {
  const controller = assessmentControllerExtension({ strapi: fakeStrapi(risks, implementations) }) as unknown as {
    exportReleasedAssessment: (ctx: Doc) => Promise<unknown>;
  };
  const headers = new Map<string, string>();
  const ctx = {
    params: { assessmentId: ASSESSMENT.documentId },
    query: { format: "xlsx" },
    state: { csrmAuthorization: { assessmentRequestActor: "analyst" }, idamboxUser: { documentId: "user-bob" } },
    status: 200,
    body: undefined as unknown,
    set(field: string, value: string) {
      headers.set(field, value);
    },
  };
  await controller.exportReleasedAssessment(ctx);
  assert.ok(Buffer.isBuffer(ctx.body), `a file was sent (status ${ctx.status}, body ${JSON.stringify(ctx.body)})`);
  const sheets = await readWorkbookSheets(ctx.body as Buffer);
  return { headers, sheets };
}

test("the released export writes every control implementation of a Risk, past the first 1,000 (BE1-07)", async () => {
  const risks = [risk(1)];
  const implementations = new Map([[String(risks[0].documentId), Array.from({ length: 1_200 }, (_, index) => implementation(index))]]);
  const { headers, sheets } = await exportReleased(risks, implementations);
  assert.equal(headers.get("X-CSRM-Row-Count"), String(1 + 1_200));
  const mitigation = sheets.find((sheet) => sheet.name !== "Summary" && sheet.name !== "Risks" && sheet.name !== "About this export");
  assert.ok(mitigation, `a mitigation sheet among ${sheets.map((sheet) => sheet.name).join(", ")}`);
  assert.equal(mitigation.rows.length - 1, 1_200);
});

test("the released export writes every active Risk of the assessment, past the first 1,000 (BE1-07)", async () => {
  const risks = Array.from({ length: 1_050 }, (_, index) => risk(index));
  const { headers, sheets } = await exportReleased(risks, new Map());
  assert.equal(headers.get("X-CSRM-Row-Count"), "1050");
  const riskSheet = sheets.find((sheet) => sheet.name === "Risks");
  assert.ok(riskSheet);
  assert.equal(riskSheet.rows.length - 1, 1_050);
});
