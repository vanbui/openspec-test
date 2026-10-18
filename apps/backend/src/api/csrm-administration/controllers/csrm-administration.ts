import { createStrapiAdministrationRepository } from "../services/administration-repository";
import type { AdministrationKind } from "../services/administration-config";
import { AdministrationValidationError } from "../services/administration-query";
import {
  AdministrationWorkflowError,
  assertAdministrationScope,
  buildImportErrorReport,
  buildImportTemplate,
  createAdministration,
  errorReportFields,
  commitAdministrationImport,
  getAdministration,
  listAdministration,
  parseTemplateQuery,
  previewAdministrationImport,
  updateAdministration,
} from "../services/administration-workflow";
import { isSelectorQuery } from "../../../utils/selector-query";
import type { SecurityEventLogger } from "../../../csrm/audit/security-event-log";
import { ExportForbiddenError } from "../../../csrm/exports/export-errors";
import { referenceListExportView } from "../../../csrm/exports/export-views";
import { runListExport } from "../../../csrm/exports/run-export";
import { EXPORT_MEDIA_TYPES, resolveExportActor, sendExportError, sendExportFile, type ExportErrorContext } from "../../../csrm/exports/send-export";
import { sendStoredFile, type DownloadContext } from "../../../csrm/files/send-stored-file";
import { searchInformationSystems, InformationSystemSelectorError } from "../../csrm-information-system/services/csrm-information-system";
import { searchInformationAssets, InformationAssetSelectorError } from "../../csrm-information-asset/services/csrm-information-asset";

type RecordValue = Record<string, unknown>;

const unavailableHandlers = {
  async createRiskType(ctx: RecordValue) {
    try {
      const data = await createAdministration({
        repository: createStrapiAdministrationRepository(globalThis.strapi, "risk-types"),
        kind: "risk-types",
        state: ctx.state,
        body: isRecord(ctx.request) ? ctx.request.body : undefined,
      });
      ctx.status = 201;
      return { data };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
  async getRiskType(ctx: RecordValue) {
    try {
      const params = isRecord(ctx.params) ? ctx.params : {};
      const data = await getAdministration({
        repository: createStrapiAdministrationRepository(globalThis.strapi, "risk-types"),
        kind: "risk-types",
        state: ctx.state,
        documentId: typeof params.riskTypeId === "string" ? params.riskTypeId : "",
      });
      return { data };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
  async updateRiskType(ctx: RecordValue) {
    try {
      const params = isRecord(ctx.params) ? ctx.params : {};
      const data = await updateAdministration({
        repository: createStrapiAdministrationRepository(globalThis.strapi, "risk-types"),
        kind: "risk-types",
        state: ctx.state,
        documentId: typeof params.riskTypeId === "string" ? params.riskTypeId : "",
        body: isRecord(ctx.request) ? ctx.request.body : undefined,
      });
      return { data };
    } catch (error) {
      return handleError(ctx, error);
    }
  },
  async previewRiskTypesImport(ctx: RecordValue) {
    return previewImportHandler(ctx, "risk-types");
  },
  async importRiskTypes(ctx: RecordValue) {
    return importHandler(ctx, "risk-types");
  },
  async createControl(ctx: RecordValue) {
    try {
      const data = await createAdministration({ repository: createStrapiAdministrationRepository(globalThis.strapi, "controls"), kind: "controls", state: ctx.state, body: isRecord(ctx.request) ? ctx.request.body : undefined });
      ctx.status = 201;
      return { data };
    } catch (error) { return handleError(ctx, error); }
  },
  async getControl(ctx: RecordValue) {
    try {
      const params = isRecord(ctx.params) ? ctx.params : {};
      return { data: await getAdministration({ repository: createStrapiAdministrationRepository(globalThis.strapi, "controls"), kind: "controls", state: ctx.state, documentId: typeof params.controlId === "string" ? params.controlId : "" }) };
    } catch (error) { return handleError(ctx, error); }
  },
  async updateControl(ctx: RecordValue) {
    try {
      const params = isRecord(ctx.params) ? ctx.params : {};
      return { data: await updateAdministration({ repository: createStrapiAdministrationRepository(globalThis.strapi, "controls"), kind: "controls", state: ctx.state, documentId: typeof params.controlId === "string" ? params.controlId : "", body: isRecord(ctx.request) ? ctx.request.body : undefined }) };
    } catch (error) { return handleError(ctx, error); }
  },
  async previewControlsImport(ctx: RecordValue) { return previewImportHandler(ctx, "controls"); },
  async importControls(ctx: RecordValue) { return importHandler(ctx, "controls"); },
  async listInformationSystems(ctx: RecordValue) { return selectorOrListHandler(ctx, "information-systems"); },
  async createInformationSystem(ctx: RecordValue) { return createHandler(ctx, "information-systems"); },
  async getInformationSystem(ctx: RecordValue) { return getHandler(ctx, "information-systems", "informationSystemId"); },
  async updateInformationSystem(ctx: RecordValue) { return updateHandler(ctx, "information-systems", "informationSystemId"); },
  async previewInformationSystemsImport(ctx: RecordValue) { return previewImportHandler(ctx, "information-systems"); },
  async importInformationSystems(ctx: RecordValue) { return importHandler(ctx, "information-systems"); },
  async listInformationAssets(ctx: RecordValue) { return selectorOrListHandler(ctx, "information-assets"); },
  async createInformationAsset(ctx: RecordValue) { return createHandler(ctx, "information-assets"); },
  async getInformationAsset(ctx: RecordValue) { return getHandler(ctx, "information-assets", "informationAssetId"); },
  async updateInformationAsset(ctx: RecordValue) { return updateHandler(ctx, "information-assets", "informationAssetId"); },
  async previewInformationAssetsImport(ctx: RecordValue) { return previewImportHandler(ctx, "information-assets"); },
  async importInformationAssets(ctx: RecordValue) { return importHandler(ctx, "information-assets"); },
  // 19-14 (D-31): each collection's import template.
  async downloadRiskTypesImportTemplate(ctx: RecordValue) { return templateHandler(ctx, "risk-types"); },
  async downloadControlsImportTemplate(ctx: RecordValue) { return templateHandler(ctx, "controls"); },
  async downloadInformationSystemsImportTemplate(ctx: RecordValue) { return templateHandler(ctx, "information-systems"); },
  async downloadInformationAssetsImportTemplate(ctx: RecordValue) { return templateHandler(ctx, "information-assets"); },
  // 19-14 (D-32): each collection's error report, rebuilt from the upload and Strapi's own record.
  async downloadRiskTypesImportErrorReport(ctx: RecordValue) { return errorReportHandler(ctx, "risk-types"); },
  async downloadControlsImportErrorReport(ctx: RecordValue) { return errorReportHandler(ctx, "controls"); },
  async downloadInformationSystemsImportErrorReport(ctx: RecordValue) { return errorReportHandler(ctx, "information-systems"); },
  async downloadInformationAssetsImportErrorReport(ctx: RecordValue) { return errorReportHandler(ctx, "information-assets"); },
  // 19-14 (D-04, D-33): each reference list, whole, in its import shape.
  async exportRiskTypes(ctx: RecordValue) { return exportHandler(ctx, "risk-types"); },
  async exportControls(ctx: RecordValue) { return exportHandler(ctx, "controls"); },
  async exportInformationSystems(ctx: RecordValue) { return exportHandler(ctx, "information-systems"); },
  async exportInformationAssets(ctx: RecordValue) { return exportHandler(ctx, "information-assets"); },
};

type InventoryKind = "information-systems" | "information-assets";

/*
 * GET /api/v1/{segment}/import/template?format=csv|xlsx (19-14; D-31): the template as a download with the export file
 * headers and no X-CSRM-Row-Count. A template is not an export of records, so no event is written (D-18).
 */
async function templateHandler(ctx: RecordValue, kind: AdministrationKind): Promise<unknown> {
  try {
    assertAdministrationScope(ctx.state);
    const file = await buildImportTemplate(kind, parseTemplateQuery(ctx.query));
    sendStoredFile(ctx as unknown as DownloadContext, { fileName: file.fileName, mediaType: EXPORT_MEDIA_TYPES[file.format], bytes: file.bytes });
    return undefined;
  } catch (error) { return handleError(ctx, error); }
}

async function previewImportHandler(ctx: RecordValue, kind: AdministrationKind): Promise<unknown> {
  try {
    const request = isRecord(ctx.request) ? ctx.request : {};
    const files = isRecord(request.files) ? request.files : {};
    const data = await previewAdministrationImport({
      repository: createStrapiAdministrationRepository(globalThis.strapi, kind),
      kind,
      state: ctx.state,
      uploads: files,
    });
    return { data };
  } catch (error) { return handleError(ctx, error); }
}

async function importHandler(ctx: RecordValue, kind: AdministrationKind): Promise<unknown> {
  try {
    const request = isRecord(ctx.request) ? ctx.request : {};
    const files = isRecord(request.files) ? request.files : {};
    const body = isRecord(request.body) ? request.body : {};
    const strapi = globalThis.strapi as unknown as { log: SecurityEventLogger };
    const data = await commitAdministrationImport({
      repository: createStrapiAdministrationRepository(globalThis.strapi, kind),
      kind,
      state: ctx.state,
      uploads: files,
      previewDigest: body.previewDigest,
      confirmed: body.confirmed,
      decisions: body.decisions,
      // The import.committed line names the resolved IdamBox User (D-18), resolved before anything is written.
      events: { log: strapi.log, actor: await importActor(ctx.state) },
    });
    return { data };
  } catch (error) { return handleError(ctx, error); }
}

/*
 * POST /api/v1/{segment}/import/error_report (19-14; D-32): the same file and exactly one of previewDigest or resultToken,
 * as a download with X-CSRM-Row-Count. The body's fields are closed, so issues are never taken from the client; an
 * error report is not an export of records, so no event is written (D-18).
 */
async function errorReportHandler(ctx: RecordValue, kind: AdministrationKind): Promise<unknown> {
  try {
    assertAdministrationScope(ctx.state);
    const request = isRecord(ctx.request) ? ctx.request : {};
    const files = isRecord(request.files) ? request.files : {};
    const fields = errorReportFields(request.body);
    const file = await buildImportErrorReport({ kind, state: ctx.state, uploads: files, ...fields });
    sendExportFile(ctx as unknown as DownloadContext, file);
    return undefined;
  } catch (error) { return handleError(ctx, error); }
}

/*
 * GET /api/v1/{segment}/export?format=csv|xlsx (19-14; D-04, D-05, D-33): the reference list whole, through the admin
 * list's own parser, order and projection (referenceListExportView), as one file and one security event line.
 */
async function exportHandler(ctx: RecordValue, kind: AdministrationKind): Promise<unknown> {
  const strapi = globalThis.strapi;
  try {
    const file = await runListExport({
      view: referenceListExportView(strapi, kind),
      query: ctx.query,
      state: ctx.state,
      actor: await resolveExportActor(strapi, ctx.state),
      now: new Date(),
      log: (strapi as unknown as { log: SecurityEventLogger }).log,
    });
    sendExportFile(ctx as unknown as DownloadContext, file);
    return undefined;
  } catch (error) {
    if (sendExportError(ctx as unknown as ExportErrorContext, error)) return undefined;
    return handleError(ctx, error);
  }
}

async function listHandler(ctx: RecordValue, kind: InventoryKind): Promise<unknown> {
  try {
    return { data: undefined, ...(await listAdministration({ repository: createStrapiAdministrationRepository(globalThis.strapi, kind), kind, state: ctx.state, query: ctx.query })) };
  } catch (error) { return handleError(ctx, error); }
}

async function selectorOrListHandler(ctx: RecordValue, kind: InventoryKind): Promise<unknown> {
  const query = isRecord(ctx.query) ? ctx.query : {};
  // Same predicate the authorization policy used to choose the required grant.
  if (isSelectorQuery(query)) {
    try {
      return kind === "information-systems"
        ? await searchInformationSystems({ strapi: globalThis.strapi, state: ctx.state, query })
        : await searchInformationAssets({ strapi: globalThis.strapi, state: ctx.state, query });
    } catch (error) {
      if (error instanceof InformationSystemSelectorError || error instanceof InformationAssetSelectorError) {
        ctx.status = error.message.includes("denied") ? 403 : 400;
        return { data: null, error: { status: ctx.status, message: error.message } };
      }
      throw error;
    }
  }
  return listHandler(ctx, kind);
}

async function createHandler(ctx: RecordValue, kind: InventoryKind): Promise<unknown> {
  try {
    const data = await createAdministration({ repository: createStrapiAdministrationRepository(globalThis.strapi, kind), kind, state: ctx.state, body: isRecord(ctx.request) ? ctx.request.body : undefined });
    ctx.status = 201;
    return { data };
  } catch (error) { return handleError(ctx, error); }
}

async function getHandler(ctx: RecordValue, kind: InventoryKind, param: string): Promise<unknown> {
  try {
    const params = isRecord(ctx.params) ? ctx.params : {};
    return { data: await getAdministration({ repository: createStrapiAdministrationRepository(globalThis.strapi, kind), kind, state: ctx.state, documentId: typeof params[param] === "string" ? params[param] : "" }) };
  } catch (error) { return handleError(ctx, error); }
}

async function updateHandler(ctx: RecordValue, kind: InventoryKind, param: string): Promise<unknown> {
  try {
    const params = isRecord(ctx.params) ? ctx.params : {};
    return { data: await updateAdministration({ repository: createStrapiAdministrationRepository(globalThis.strapi, kind), kind, state: ctx.state, documentId: typeof params[param] === "string" ? params[param] : "", body: isRecord(ctx.request) ? ctx.request.body : undefined }) };
  } catch (error) { return handleError(ctx, error); }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The committing analyst, as the import.committed line names them; no resolved IdamBox User is a 403. */
async function importActor(state: unknown): Promise<{ documentId: string; displayName: string }> {
  try {
    return await resolveExportActor(globalThis.strapi, state);
  } catch (error) {
    if (error instanceof ExportForbiddenError) {
      throw new AdministrationWorkflowError(403, "CSRM Administration access is denied.", "ADMINISTRATION_FORBIDDEN");
    }
    throw error;
  }
}

function handleError(ctx: RecordValue, error: unknown): unknown {
  if (error instanceof AdministrationValidationError) {
    ctx.status = 400;
    return { data: null, error: { status: 400, code: "INVALID_ADMINISTRATION_DATA", message: error.message } };
  }
  if (!(error instanceof AdministrationWorkflowError)) throw error;
  ctx.status = error.status;
  if (error.details) {
    // A refusal with a closed reason (19-13; D-25, D-26, D-30): the AssessmentWorkflowErrorResponse envelope, whose
    // details carry the reason and, for a file, the safe found details; never a cell value.
    return {
      data: null,
      error: { status: error.status, name: "AdministrationImportRefusal", message: error.message, details: error.details },
    };
  }
  return {
    data: null,
    error: {
      status: error.status,
      code: error.code,
      message: error.message,
      ...(error.field ? { field: error.field } : {}),
    },
  };
}

export default unavailableHandlers;
