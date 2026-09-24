import { factories } from "@strapi/strapi";
import { hydrateInformationSystems, InformationSystemSelectorError } from "../services/csrm-information-system";
type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
export default factories.createCoreController("api::csrm-information-system.csrm-information-system", () => ({ async selected(ctx: RecordValue) { try { return { data: await hydrateInformationSystems({ strapi: globalThis.strapi, state: ctx.state, body: isRecord(ctx.request) ? ctx.request.body : undefined }) }; } catch (error) { if (!(error instanceof InformationSystemSelectorError)) throw error; ctx.status = error.message.includes("denied") ? 403 : 400; return { data: null, error: { status: ctx.status, message: error.message } }; } } }));
