import { factories } from "@strapi/strapi";

const protectedPolicies = [
  "global::csrm-app-enabled",
  "api::csrm-assessment-request.internal-csrm-caller",
];

export default factories.createCoreRouter("api::csrm-assessment-request.csrm-assessment-request", {
  except: ["delete"],
  config: {
    find: { auth: false, policies: protectedPolicies },
    findOne: { auth: false, policies: protectedPolicies },
    create: { auth: false, policies: protectedPolicies },
    update: { auth: false, policies: protectedPolicies },
  },
});
