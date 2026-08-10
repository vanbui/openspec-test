import catalogue from "../../docs/references/idambox-csrm-role-function-api-catalogue.json";
import { describe, expect, it } from "vitest";

import {
  capabilityIds,
  requestorCapabilityIds,
  resolveEffectiveCapabilities,
  securityAnalystCapabilityIds,
} from "./capabilities";
import { navigationGroupLabels, routeDefinitions, visibleRoutes } from "./routes";

describe("CSRM Function capability registry", () => {
  it("keeps the local Function ID vocabulary exactly aligned with the committed catalogue", () => {
    expect(capabilityIds).toEqual(catalogue.functions.map((item) => item.id));
    expect(capabilityIds).toHaveLength(23);

    const requestor = catalogue.roles.find((role) => role.id === "role.requestor");
    const analyst = catalogue.roles.find(
      (role) => role.id === "role.security_analyst",
    );

    expect(requestor?.functionIds).toEqual(requestorCapabilityIds);
    expect(analyst?.functionIds).toEqual(securityAnalystCapabilityIds);
  });

  it("adds explicit analyst capabilities to the Requestor birthright", () => {
    const requestorCapabilities = resolveEffectiveCapabilities();
    const analystCapabilities = resolveEffectiveCapabilities(
      securityAnalystCapabilityIds,
    );

    expect(requestorCapabilities).toEqual(requestorCapabilityIds);
    expect(requestorCapabilities).toHaveLength(8);
    expect(analystCapabilities).toEqual(
      expect.arrayContaining([
        ...requestorCapabilityIds,
        ...securityAnalystCapabilityIds,
      ]),
    );
    expect(analystCapabilities).toHaveLength(23);
  });

  it("enables only the foundation route and filters every planned destination", () => {
    expect(routeDefinitions.find((route) => route.href === "/")).toMatchObject({
      capability: "function.dashboard.dashboard",
      status: "enabled",
    });
    expect(routeDefinitions.filter((route) => route.status === "planned")).toHaveLength(
      22,
    );
    expect(visibleRoutes(resolveEffectiveCapabilities())).toEqual([
      expect.objectContaining({ href: "/", status: "enabled" }),
    ]);
  });

  it("keeps the catalogue Questionnaire menuPath values while rendering the plural display group", () => {
    expect(
      catalogue.functions
        .filter((item) => item.menuPath.startsWith("Questionnaire:"))
        .map((item) => item.menuPath),
    ).toEqual([
      "Questionnaire:My Questionnaires",
      "Questionnaire:Questionnaire Details",
    ]);
    expect(navigationGroupLabels.questionnaires).toBe("Questionnaires");
  });
});
