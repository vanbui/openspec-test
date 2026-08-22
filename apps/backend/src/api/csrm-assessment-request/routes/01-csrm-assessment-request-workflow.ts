import { z } from "zod/v4";

const protectedPolicies = [
  "global::csrm-app-enabled",
  "api::csrm-assessment-request.internal-csrm-caller",
];

const requestDocumentSchema = z.object({
  documentId: z.string(),
  requestNumber: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  assessmentType: z.string().nullable(),
  division: z.string().nullable(),
  businessUnit: z.string().nullable(),
  businessPurpose: z.string().nullable(),
  businessCriticality: z.string().nullable(),
  thirdPartyInvolvement: z.boolean().nullable(),
  thirdPartyDetails: z.string().nullable(),
  regulatoryRequirements: z.string().nullable(),
  dueDate: z.string().nullable(),
  requestStatus: z.string(),
  submittedDate: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  requestor: z
    .object({ documentId: z.string(), displayName: z.string().nullable() })
    .nullable(),
  informationSystems: z.array(z.object({ documentId: z.string(), name: z.string().optional() })),
  informationAssets: z.array(z.object({ documentId: z.string(), name: z.string().optional() })),
});

const requestId = { id: z.string().min(1) };
const actionBody = { "application/json": z.object({ data: z.object({}).strict() }) };
const requestResponse = z.object({ data: requestDocumentSchema });
const dashboardResponse = z.object({
  data: z.object({
    statusCounts: z.record(z.string(), z.number()),
    needsAttention: z.array(requestDocumentSchema),
    recentSubmissions: z.array(requestDocumentSchema),
    notices: z.array(z.object({}).strict()),
  }),
});

export default {
  routes: [
    {
      method: "GET",
      path: "/csrm-assessment-requests/dashboard",
      handler: "csrm-assessment-request.dashboard",
      response: dashboardResponse,
      config: { auth: false, policies: protectedPolicies },
    },
    {
      method: "POST",
      path: "/csrm-assessment-requests/:id/submit",
      handler: "csrm-assessment-request.submit",
      request: { params: requestId, body: actionBody },
      response: requestResponse,
      config: { auth: false, policies: protectedPolicies },
    },
    {
      method: "POST",
      path: "/csrm-assessment-requests/:id/withdraw",
      handler: "csrm-assessment-request.withdraw",
      request: { params: requestId, body: actionBody },
      response: requestResponse,
      config: { auth: false, policies: protectedPolicies },
    },
  ],
};
