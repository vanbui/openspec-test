import { factories } from "@strapi/strapi";
import { hydrateInformationAssets, InformationAssetSelectorError } from "../services/csrm-information-asset";
type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
export default factories.createCoreController("api::csrm-information-asset.csrm-information-asset", () => ({ async selected(ctx: RecordValue) { try { return { data: await hydrateInformationAssets({ strapi: globalThis.strapi, state: ctx.state, body: isRecord(ctx.request) ? ctx.request.body : undefined }) }; } catch (error) { if (!(error instanceof InformationAssetSelectorError)) throw error; ctx.status = error.message.includes("denied") ? 403 : 400; return { data: null, error: { status: ctx.status, message: error.message } }; } } }));
