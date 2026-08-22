import { factories } from "@strapi/strapi";
import type { Context } from "koa";

import type { CsrmActor } from "../policies/internal-csrm-caller";
import type { RequestWorkflowService } from "../services/csrm-assessment-request";

const REQUEST_UID = "api::csrm-assessment-request.csrm-assessment-request";
const NOT_AVAILABLE = {
  error: {
    status: 404,
    name: "NotFoundError",
    message: "Request is not available.",
    details: {},
  },
};

function actorFrom(ctx: Context): CsrmActor {
  return ctx.state.csrmActor as CsrmActor;
}

function service(strapi: { service: (uid: string) => unknown }): RequestWorkflowService {
  return strapi.service(REQUEST_UID) as RequestWorkflowService;
}

export default factories.createCoreController(REQUEST_UID, ({ strapi }) => ({
  async create(ctx: Context) {
    const body = ctx.request.body as { data?: unknown } | undefined;
    if (!body || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      ctx.status = 400;
      ctx.body = { error: { status: 400, name: "ValidationError", message: "Missing data payload.", details: {} } };
      return;
    }

    const created = await service(strapi).createForActor(actorFrom(ctx), body.data);
    ctx.status = 201;
    ctx.body = { data: service(strapi).serialize(created) };
  },

  async findOne(ctx: Context) {
    const found = await service(strapi).findOneForActor(actorFrom(ctx), ctx.params.id);
    if (!found) {
      ctx.status = 404;
      ctx.body = NOT_AVAILABLE;
      return;
    }
    ctx.body = { data: service(strapi).serialize(found) };
  },
}));
