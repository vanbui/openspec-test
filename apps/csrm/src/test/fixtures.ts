import type {
  ApplicationCollectionResponse,
  InformationAssetCollectionResponse,
  InformationSystemCollectionResponse,
  RequestCollectionResponse,
  RequestDashboardResponse,
  RequestResponse,
} from "@/lib/api/csrm-service";

export const applicationsFixture: ApplicationCollectionResponse = {
  data: [
    {
      applicationStatus: "active",
      documentId: "00000000-0000-0000-0000-000000000000",
      id: 1,
      name: "Cyber Risk Manager",
      publishedAt: "2026-08-09T00:00:00.000Z",
      slug: "csrm",
    },
  ],
};

export const requestFixture = {
  data: {
    documentId: "request-1",
    requestNumber: "REQ-0001",
    title: "Privacy impact review",
    description: null,
    assessmentType: null,
    division: null,
    businessUnit: null,
    businessPurpose: null,
    businessCriticality: null,
    thirdPartyInvolvement: false,
    thirdPartyDetails: null,
    regulatoryRequirements: null,
    dueDate: null,
    requestStatus: "draft",
    submittedDate: null,
    createdAt: null,
    updatedAt: null,
    requestor: { documentId: "requestor-1", displayName: "Requestor One" },
    informationSystems: [],
    informationAssets: [],
  },
} as unknown as RequestResponse;

export const requestListFixture: RequestCollectionResponse = {
  data: [
    {
      id: 1,
      documentId: "request-1",
      requestNumber: "REQ-0001",
      title: "Privacy impact review",
      requestStatus: "draft",
      publishedAt: "2026-08-22T00:00:00.000Z",
      thirdPartyInvolvement: false,
      informationSystems: [],
      informationAssets: [],
    },
  ],
};

export const requestDashboardFixture = {
  data: {
    statusCounts: { draft: 0, submitted: 1 },
    needsAttention: [requestFixture.data],
    recentSubmissions: [],
    notices: [],
  },
} as unknown as RequestDashboardResponse;

export const informationSystemsFixture = {
  data: [
    {
      id: 4,
      documentId: "system-1",
      name: "Core platform",
      publishedAt: "2026-08-22T00:00:00.000Z",
    },
  ],
} as unknown as InformationSystemCollectionResponse;

export const informationAssetsFixture = {
  data: [
    {
      id: 5,
      documentId: "asset-1",
      name: "Customer records",
      publishedAt: "2026-08-22T00:00:00.000Z",
    },
  ],
} as unknown as InformationAssetCollectionResponse;
