import type { ApplicationCollectionResponse } from "@/lib/api/csrm-service";

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
