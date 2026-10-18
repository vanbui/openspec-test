import type { Core } from "@strapi/strapi";
import { registerIdentitySource } from "../iam/identity/source-registration";

export async function seedIamData(
  strapi: Core.Strapi,
  env: Record<string, string | undefined> = process.env,
) {
  if (env.NODE_ENV !== "development" || env.IDAMBOX_SEED_IAM !== "true") return;
  await registerIdentitySource(strapi, {
    name: "midPoint (dev)", username: "midpoint-dev-provisioning",
    email: "midpoint-dev-provisioning@idambox.test", displayName: "midPoint (dev) provisioning",
  });
  strapi.log.info("IdamBox development Identity Source seed complete.");
}
