import type { Core } from "@strapi/strapi";

import { CSRM_REQUEST_NOTE_OPERATIONS } from "../operations";

/*
 * Phase 13 (D-02, D-21 to D-24): the request notes routes, in the only router of the csrm-request-note API (the
 * my-request-status-summary.ts shape). There is deliberately no core router: Strapi mounts only the routes the files
 * in routes/ export, so neither notes content type gets a /api/csrm-request-note… route.
 *
 * The policy checks the Role → Function → FunctionAPI grant only. Who may use a request's notes is decided by
 * canUseRequestNotes in the controller, which answers 404 to everyone else; requireRequestOwnership is never used
 * here, because it answers 403 and would tell another Requestor that the request exists (Pitfall 3).
 */
const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/v1/assessment_requests/:requestId/notes",
      handler: "api::csrm-request-note.request-notes.list",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_REQUEST_NOTE_OPERATIONS.list } },
        ],
      },
    },
    {
      method: "POST",
      path: "/v1/assessment_requests/:requestId/notes",
      handler: "api::csrm-request-note.request-notes.create",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_REQUEST_NOTE_OPERATIONS.create } },
        ],
      },
    },
    {
      method: "POST",
      path: "/v1/assessment_requests/:requestId/notes/read",
      handler: "api::csrm-request-note.request-notes.markRead",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_REQUEST_NOTE_OPERATIONS.markRead } },
        ],
      },
    },
    {
      // D-26, D-30: the human Security Analyst's AI-input mark; the policy refuses every other caller (human-only).
      method: "PUT",
      path: "/v1/assessment_requests/:requestId/notes/:noteId/ai_input",
      handler: "api::csrm-request-note.request-notes.setAiInput",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_REQUEST_NOTE_OPERATIONS.setAiInput } },
        ],
      },
    },
  ],
};

export default config;
