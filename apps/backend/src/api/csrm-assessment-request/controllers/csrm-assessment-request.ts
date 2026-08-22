import { factories } from "@strapi/strapi";
import type { Context } from "koa";

import type { CsrmActor } from "../policies/internal-csrm-caller";
import { RequestWorkflowError } from "../services/csrm-assessment-request";
import type { RequestWorkflowService } from "../services/csrm-assessment-request";

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
const NOT_AVAILABLE = { error: { status: 404, name: "NotFoundError", message: "Request is not available.", details: {} } };

function actorFrom(ctx: Context): CsrmActor { return ctx.state.csrmActor as CsrmActor; }
function service(strapi: { service: (uid: string) => unknown }): RequestWorkflowService { return strapi.service(REQUEST_UID) as RequestWorkflowService; }
function dataFrom(ctx: Context): unknown {
  const body = ctx.request.body as { data?: unknown } | undefined;
  if (!body || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new RequestWorkflowError(400, "Missing data payload.");
  return body.data;
}
function failure(ctx: Context, error: unknown): void {
  if (error instanceof RequestWorkflowError) {
    if (error.status === 404) { ctx.status = 404; ctx.body = NOT_AVAILABLE; return; }
    ctx.status = error.status;
    ctx.body = { error: { status: error.status, name: error.status === 400 ? "ValidationError" : "ForbiddenError", message: error.message, details: {} } };
    return;
  }
  throw error;
}

export default factories.createCoreController(REQUEST_UID, ({ strapi }) => ({
  async create(ctx: Context) {
    try { const created = await service(strapi).createForActor(actorFrom(ctx), dataFrom(ctx)); ctx.status = 201; ctx.body = { data: service(strapi).serialize(created) }; }
    catch (error) { failure(ctx, error); }
  },
  async find(ctx: Context) {
    try { const results = await service(strapi).listForActor(actorFrom(ctx), ctx.query); ctx.body = { data: results.data.map(service(strapi).serialize), meta: results.meta }; }
    catch (error) { failure(ctx, error); }
  },
  async findOne(ctx: Context) {
    try { const found = await service(strapi).findOneForActor(actorFrom(ctx), ctx.params.id); if (!found) { ctx.status = 404; ctx.body = NOT_AVAILABLE; return; } ctx.body = { data: service(strapi).serialize(found) }; }
    catch (error) { failure(ctx, error); }
  },
  async update(ctx: Context) {
    try { const updated = await service(strapi).updateForActor(actorFrom(ctx), ctx.params.id, dataFrom(ctx)); ctx.body = { data: service(strapi).serialize(updated) }; }
    catch (error) { failure(ctx, error); }
  },
  async dashboard(ctx: Context) {
    try { ctx.body = { data: await service(strapi).dashboardForActor(actorFrom(ctx)) }; }
    catch (error) { failure(ctx, error); }
  },
  async submit(ctx: Context) {
    try { const updated = await service(strapi).submitForActor(actorFrom(ctx), ctx.params.id); ctx.body = { data: service(strapi).serialize(updated) }; }
    catch (error) { failure(ctx, error); }
  },
  async withdraw(ctx: Context) {
    try { const updated = await service(strapi).withdrawForActor(actorFrom(ctx), ctx.params.id); ctx.body = { data: service(strapi).serialize(updated) }; }
    catch (error) { failure(ctx, error); }
  },
}));
