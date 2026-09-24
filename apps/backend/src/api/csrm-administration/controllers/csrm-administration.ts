import { createStrapiAdministrationRepository } from "../services/administration-repository";
import type { AdministrationKind } from "../services/administration-config";
import { AdministrationValidationError } from "../services/administration-query";
import {
  AdministrationWorkflowError,
  createAdministration,
  commitAdministrationImport,
  getAdministration,
  listAdministration,
  previewAdministrationImport,
  updateAdministration,
} from "../services/administration-workflow";
import { isSelectorQuery } from "../../../utils/selector-query";
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
};

type InventoryKind = "information-systems" | "information-assets";

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
    const data = await commitAdministrationImport({
      repository: createStrapiAdministrationRepository(globalThis.strapi, kind),
      kind,
      state: ctx.state,
      uploads: files,
      previewDigest: body.previewDigest,
      confirmed: body.confirmed,
    });
    return { data };
  } catch (error) { return handleError(ctx, error); }
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

function handleError(ctx: RecordValue, error: unknown): unknown {
  if (error instanceof AdministrationValidationError) {
    ctx.status = 400;
    return { data: null, error: { status: 400, code: "INVALID_ADMINISTRATION_DATA", message: error.message } };
  }
  if (!(error instanceof AdministrationWorkflowError)) throw error;
  ctx.status = error.status;
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
