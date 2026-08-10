import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const cataloguePath = fileURLToPath(
  new URL("../docs/references/idambox-csrm-role-function-api-catalogue.json", import.meta.url),
);
const capabilitiesPath = fileURLToPath(
  new URL("../src/config/capabilities.ts", import.meta.url),
);
const routesPath = fileURLToPath(new URL("../src/config/routes.ts", import.meta.url));

function extractStringArray(source, exportName) {
  const match = source.match(
    new RegExp(`export const ${exportName} = \\[([\\s\\S]*?)\\] as const`),
  );
  if (!match) {
    throw new Error(`Unable to find ${exportName} in the capability registry.`);
  }

  return [...match[1].matchAll(/"(function\.[^"]+)"/g)].map((item) => item[1]);
}

function assertExact(label, actual, expected) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(
      `${label} does not match the committed CSRM Function catalogue. ` +
      `Expected ${expected.length} ordered entries and found ${actual.length}.`,
    );
  }
}

export async function verifyCapabilities() {
  const [catalogueSource, capabilitiesSource, routesSource] = await Promise.all([
    readFile(cataloguePath, "utf8"),
    readFile(capabilitiesPath, "utf8"),
    readFile(routesPath, "utf8"),
  ]);
  const catalogue = JSON.parse(catalogueSource);
  const expectedCapabilityIds = catalogue.functions.map((item) => item.id);
  const roleFunctionIds = new Map(
    catalogue.roles.map((role) => [role.id, role.functionIds]),
  );

  assertExact(
    "capabilityIds",
    extractStringArray(capabilitiesSource, "capabilityIds"),
    expectedCapabilityIds,
  );
  assertExact(
    "requestorCapabilityIds",
    extractStringArray(capabilitiesSource, "requestorCapabilityIds"),
    roleFunctionIds.get("role.requestor") ?? [],
  );
  assertExact(
    "securityAnalystCapabilityIds",
    extractStringArray(capabilitiesSource, "securityAnalystCapabilityIds"),
    roleFunctionIds.get("role.security_analyst") ?? [],
  );

  const routeCapabilityIds = [
    ...routesSource.matchAll(/capability:\s*"(function\.[^"]+)"/g),
  ].map((item) => item[1]);
  const unknownRouteCapability = routeCapabilityIds.find(
    (capability) => !expectedCapabilityIds.includes(capability),
  );
  if (unknownRouteCapability) {
    throw new Error(`Route registry references unknown capability ${unknownRouteCapability}.`);
  }

  console.log(
    `Capability verification passed: ${expectedCapabilityIds.length} Functions, ` +
    `${routeCapabilityIds.length} routes, and exact Requestor/Security Analyst role parity.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyCapabilities().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
