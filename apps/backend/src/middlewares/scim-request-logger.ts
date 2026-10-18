import type { Core } from "@strapi/strapi";

/** SCIM logs its closed request event at the boundary; raw URLs can contain person data. */
export default function scimRequestLogger(config: Record<string, unknown>, { strapi }: { strapi: Core.Strapi }) {
  const logger = strapi.middleware("strapi::logger")(config, { strapi });
  if (typeof logger !== "function") throw new Error("The installed request logger is required.");
  return async (context: Parameters<typeof logger>[0], next: () => Promise<unknown>): Promise<void> => {
    if (context.path === "/scim/v2" || context.path.startsWith("/scim/v2/")) {
      await next();
      return;
    }
    await logger(context, next);
  };
}
