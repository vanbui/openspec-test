import { http, HttpResponse } from "msw";

import { applicationsFixture } from "@/test/fixtures";

export const handlers = [
  http.get("http://strapi.test/api/applications", () =>
    HttpResponse.json(applicationsFixture),
  ),
];
