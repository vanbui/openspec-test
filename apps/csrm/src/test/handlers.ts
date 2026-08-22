import { http, HttpResponse } from "msw";

import {
  applicationsFixture,
  informationAssetsFixture,
  informationSystemsFixture,
  requestDashboardFixture,
  requestFixture,
  requestListFixture,
} from "@/test/fixtures";

export const handlers = [
  http.get("http://strapi.test/api/applications", () =>
    HttpResponse.json(applicationsFixture),
  ),
  http.get("http://strapi.test/api/csrm-assessment-requests", () =>
    HttpResponse.json(requestListFixture),
  ),
  http.post("http://strapi.test/api/csrm-assessment-requests", () =>
    HttpResponse.json(requestFixture),
  ),
  http.get("http://strapi.test/api/csrm-assessment-requests/dashboard", () =>
    HttpResponse.json(requestDashboardFixture),
  ),
  http.get("http://strapi.test/api/csrm-assessment-requests/:id", () =>
    HttpResponse.json(requestFixture),
  ),
  http.put("http://strapi.test/api/csrm-assessment-requests/:id", () =>
    HttpResponse.json(requestFixture),
  ),
  http.post("http://strapi.test/api/csrm-assessment-requests/:id/submit", () =>
    HttpResponse.json(requestFixture),
  ),
  http.post("http://strapi.test/api/csrm-assessment-requests/:id/withdraw", () =>
    HttpResponse.json(requestFixture),
  ),
  http.get("http://strapi.test/api/csrm-information-systems", () =>
    HttpResponse.json(informationSystemsFixture),
  ),
  http.get("http://strapi.test/api/csrm-information-assets", () =>
    HttpResponse.json(informationAssetsFixture),
  ),
];
