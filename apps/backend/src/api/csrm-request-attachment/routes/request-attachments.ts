import type { Core } from "@strapi/strapi";

import { CSRM_REQUEST_ATTACHMENT_OPERATIONS } from "../operations";

/*
 * Phase 14 (D-01, D-04 items 1 and 2, D-23): the request attachment routes, in the only router of the
 * csrm-request-attachment API (the my-request-status-summary.ts and request-notes.ts shape). There is deliberately no
 * core router: Strapi mounts only the routes the files in routes/ export, so the attachment content type gets no
 * /api/csrm-request-attachment… route.
 *
 * The policy checks the Role → Function → FunctionAPI grant only. Who may use a request's attachments is decided by
 * canUseRequestNotes in the controller (D-18), which answers 404 to everyone else; requireRequestOwnership is never
 * used here, because it answers 403 and would tell another Requestor that the request exists.
 */
const config: Core.RouterConfig = {
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/v1/assessment_requests/:requestId/attachments",
      handler: "api::csrm-request-attachment.request-attachments.list",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_REQUEST_ATTACHMENT_OPERATIONS.list } },
        ],
      },
    },
    {
      method: "POST",
      path: "/v1/assessment_requests/:requestId/attachments",
      handler: "api::csrm-request-attachment.request-attachments.upload",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_REQUEST_ATTACHMENT_OPERATIONS.upload } },
        ],
      },
    },
    {
      // D-23: the only way a stored file's bytes leave Strapi.
      method: "GET",
      path: "/v1/assessment_requests/:requestId/attachments/:attachmentId/content",
      handler: "api::csrm-request-attachment.request-attachments.download",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_REQUEST_ATTACHMENT_OPERATIONS.download } },
        ],
      },
    },
    {
      // D-20: soft removal and restore, the ROADMAP's "delete"; nothing persisted is hard-deleted.
      method: "PUT",
      path: "/v1/assessment_requests/:requestId/attachments/:attachmentId/removal",
      handler: "api::csrm-request-attachment.request-attachments.setRemoval",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_REQUEST_ATTACHMENT_OPERATIONS.setRemoval } },
        ],
      },
    },
    {
      // D-30, D-38: a human Security Analyst includes a file's text in the AI inputs, or excludes it. The policy refuses
      // everyone without the grant, and every automation identity (HUMAN_ANALYST_ONLY_OPERATIONS), with 403.
      method: "PUT",
      path: "/v1/assessment_requests/:requestId/attachments/:attachmentId/ai_input",
      handler: "api::csrm-request-attachment.request-attachments.setAiInput",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_REQUEST_ATTACHMENT_OPERATIONS.setAiInput } },
        ],
      },
    },
    {
      // D-31, D-38: the stored text an included file sends, for the same human Security Analyst only.
      method: "GET",
      path: "/v1/assessment_requests/:requestId/attachments/:attachmentId/ai_text",
      handler: "api::csrm-request-attachment.request-attachments.getAiText",
      config: {
        auth: { strategies: ["content-api-token"] },
        policies: [
          "global::csrm-app-enabled",
          { name: "global::csrm-authorization", config: { operation: CSRM_REQUEST_ATTACHMENT_OPERATIONS.getAiText } },
        ],
      },
    },
  ],
};

export default config;
