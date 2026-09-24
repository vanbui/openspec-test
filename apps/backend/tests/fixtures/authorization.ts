import { CSRM_ASSESSMENT_REQUEST_OPERATIONS } from "../../src/api/csrm-assessment-request/operations";

export const FUNCTION_API_OPERATIONS = {
  getAssessmentRequest: CSRM_ASSESSMENT_REQUEST_OPERATIONS.findOne,
  listAssessmentRequests: CSRM_ASSESSMENT_REQUEST_OPERATIONS.find,
  deleteAssessmentRequest: CSRM_ASSESSMENT_REQUEST_OPERATIONS.delete,
} as const;

export type SeededIdentity = {
  id: number;
  documentId: string;
  accountStatus: "active" | "inactive";
  roles: SeededRole[];
};

type SeededRole = {
  name: string;
  functions: Array<{
    functionApis: Array<{ url: string }>;
  }>;
};

const requestorRole: SeededRole = {
  name: "Requestor",
  functions: [
    {
      functionApis: [
        { url: FUNCTION_API_OPERATIONS.getAssessmentRequest },
        { url: FUNCTION_API_OPERATIONS.listAssessmentRequests },
      ],
    },
  ],
};

const securityAnalystRole: SeededRole = {
  name: "Security Analyst",
  functions: [
    {
      functionApis: [
        { url: FUNCTION_API_OPERATIONS.getAssessmentRequest },
        { url: FUNCTION_API_OPERATIONS.listAssessmentRequests },
      ],
    },
  ],
};

const securityAnalystAgentRole: SeededRole = {
  name: "Security Analyst Agent",
  functions: [
    {
      functionApis: [
        { url: FUNCTION_API_OPERATIONS.getAssessmentRequest },
        { url: FUNCTION_API_OPERATIONS.listAssessmentRequests },
      ],
    },
  ],
};

const securityAnalystWithoutGrantRole: SeededRole = {
  name: "Security Analyst",
  functions: [],
};

export const authorizationIdentities = {
  requestor: {
    id: 101,
    documentId: "requestor-jane",
    accountStatus: "active",
    roles: [],
  },
  securityAnalyst: {
    id: 102,
    documentId: "security-analyst-bob",
    accountStatus: "active",
    roles: [securityAnalystRole],
  },
  securityAnalystAgent: {
    id: 105,
    documentId: "security-analyst-agent",
    accountStatus: "active",
    roles: [securityAnalystAgentRole],
  },
  securityAnalystWithoutGrant: {
    id: 103,
    documentId: "security-analyst-without-grant",
    accountStatus: "active",
    roles: [securityAnalystWithoutGrantRole],
  },
  inactiveSecurityAnalyst: {
    id: 104,
    documentId: "inactive-security-analyst",
    accountStatus: "inactive",
    roles: [securityAnalystRole],
  },
} as const satisfies Record<string, SeededIdentity>;

export const restrictedAssessmentRequest = {
  documentId: "assessment-request-owned-by-bob",
  requestor: {
    documentId: authorizationIdentities.securityAnalyst.documentId,
  },
};

export function createAuthorizationStrapi(options?: {
  assessmentRequests?: Array<typeof restrictedAssessmentRequest>;
}) {
  const assessmentRequests = [
    restrictedAssessmentRequest,
    ...(options?.assessmentRequests ?? []),
  ];

  return {
    documents(uid: string) {
      if (uid === "api::idambox-user.idambox-user") {
        return {
          findOne: async ({ documentId }: { documentId: string }) =>
            Object.values(authorizationIdentities).find(
              (identity) => identity.documentId === documentId,
            ) ?? null,
        };
      }

      if (uid === "api::role.role") {
        return {
          findMany: async () => [requestorRole],
        };
      }

      if (uid === "api::csrm-assessment-request.csrm-assessment-request") {
        return {
          findOne: async ({ documentId }: { documentId: string }) =>
            assessmentRequests.find(
              (assessmentRequest) => assessmentRequest.documentId === documentId,
            ) ?? null,
        };
      }

      throw new Error(`Unexpected Strapi document service: ${uid}`);
    },
  };
}

export function createPolicyContext(
  identity: SeededIdentity,
  assessmentRequestDocumentId?: string,
) {
  const forbiddenMessages: string[] = [];

  return {
    context: {
      params: assessmentRequestDocumentId
        ? { id: assessmentRequestDocumentId }
        : {},
      state: {
        // This server state is the future Keycloak-to-IdamBox identity hand-off.
        // It deliberately does not read a browser development-role cookie.
        idamboxUser: { documentId: identity.documentId },
      },
      forbidden(message: string) {
        forbiddenMessages.push(message);
        return undefined;
      },
    },
    forbiddenMessages,
  };
}
