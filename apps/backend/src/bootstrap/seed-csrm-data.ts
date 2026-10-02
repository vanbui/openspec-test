import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Core } from "@strapi/strapi";

import catalogue from "./idambox-csrm-role-function-api-catalogue.json";
import { developmentFixtureSubject } from "../keycloak/development-fixture-subjects";

const CSRM_APPLICATION_SLUG = "idambox-csrm";
const CSRM_SECURITY_ANALYST_ROLE_NAME = "Security Analyst";
const CONTROL_CATALOGUE_FILES = [
  "aescsf-v2-toolkit-1.1.json",
  "apra-cps-230-2026.json",
  "apra-cps-234-2019.json",
  "asd-ism-controls-2026.06.18.json",
  "cis-controls-v8.1.json",
  "essential-eight-2023-11.json",
  "iso-iec-27001-2022-annex-a.json",
  "nist-csf-2.0.json",
  "owasp-asvs-5.0.0.json",
  "privacy-act-app-ndb-2026-06-04.json",
  "pspf-release-2026.json",
  "soci-cirmp-2026-06-10.json",
] as const;
// D-46: CSRM's titles for controls whose catalogue gives no label. It sits beside the vendored
// catalogues and outside CONTROL_CATALOGUE_FILES, so the publishers' files stay as retrieved.
const CONTROL_TITLE_FILE = "csrm-control-titles.json";
const CONTROL_TITLE_BASES = ["framework", "descriptive"] as const;
const CONTROL_TITLE_MIN_LENGTH = 3;
const CONTROL_TITLE_MAX_LENGTH = 100;
const CONTROL_QUERY_PAGE_SIZE = 1_000;
const CSRM_APPLICATION = {
  name: "IdamBox CSRM",
  slug: CSRM_APPLICATION_SLUG,
  description:
    "Cybersecurity Risk Manager module for automating cybersecurity risk management processes.",
  applicationStatus: "active",
} as const;

type SeededFunction = {
  documentId: string;
  functionApis?: Array<{
    documentId: string;
    name: string;
    url: string;
  }>;
};

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

export type ControlCatalogue = {
  catalogueData: JsonObject;
  controls: Array<JsonObject & { id: string }>;
  framework: JsonObject & { name: string };
  sourceFile: string;
};

export type ControlSeed = {
  controlNumber: string;
  controlReference: string | undefined;
  description: string | undefined;
  framework: string;
  frameworkSource: string | undefined;
  frameworkVersion: string | undefined;
  name: string;
  sourceData: JsonObject;
};

type ExistingControl = Partial<ControlSeed> & {
  documentId: string;
};

const CONTROL_SEED_FIELDS = [
  "controlNumber",
  "controlReference",
  "description",
  "framework",
  "frameworkSource",
  "frameworkVersion",
  "name",
  "sourceData",
] as const;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonBlankString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function nestedString(
  object: JsonObject,
  objectKey: string,
  stringKey: string,
): string | undefined {
  const nestedObject = object[objectKey];

  return isJsonObject(nestedObject)
    ? nonBlankString(nestedObject[stringKey])
    : undefined;
}

function lastString(value: JsonValue | undefined): string | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  return nonBlankString(value[value.length - 1]);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const stringValue = nonBlankString(value);

    if (stringValue) {
      return stringValue;
    }
  }

  return undefined;
}

function parseControlCatalogue(
  sourceFile: string,
  source: string,
): ControlCatalogue {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";

    throw new Error(
      `Control catalogue ${sourceFile} is not valid JSON.${detail}`,
    );
  }

  if (!isJsonObject(parsed)) {
    throw new Error(`Control catalogue ${sourceFile} must contain an object.`);
  }

  const framework = parsed.framework;
  const controls = parsed.controls;
  const controlCount = parsed.controlCount;

  if (!isJsonObject(framework) || !nonBlankString(framework.name)) {
    throw new Error(
      `Control catalogue ${sourceFile} must define framework.name.`,
    );
  }

  if (!Array.isArray(controls)) {
    throw new Error(`Control catalogue ${sourceFile} must define controls.`);
  }

  if (!Number.isInteger(controlCount) || controlCount !== controls.length) {
    throw new Error(
      `Control catalogue ${sourceFile} declares ${String(controlCount)} controls but contains ${controls.length}.`,
    );
  }

  const validatedControls = controls.map((control, index) => {
    if (!isJsonObject(control) || !nonBlankString(control.id)) {
      throw new Error(
        `Control catalogue ${sourceFile} has an invalid control at index ${index}.`,
      );
    }

    return {
      ...control,
      id: nonBlankString(control.id) as string,
    };
  });
  const controlIds = validatedControls.map((control) => control.id);

  if (new Set(controlIds).size !== controlIds.length) {
    throw new Error(`Control catalogue ${sourceFile} contains duplicate IDs.`);
  }

  const { controls: _controls, ...catalogueData } = parsed;

  return {
    catalogueData,
    controls: validatedControls,
    framework: {
      ...framework,
      name: nonBlankString(framework.name) as string,
    },
    sourceFile,
  };
}

function controlTitleError(sourceFile: string, detail: string): Error {
  return new Error(`Control title file ${sourceFile} ${detail}`);
}

function controlTitleProblem(controlId: string, title: unknown): string | undefined {
  if (typeof title !== "string") {
    return "is not a string";
  }

  if (title !== title.trim()) {
    return "has leading or trailing spaces";
  }

  if (title.length < CONTROL_TITLE_MIN_LENGTH || title.length > CONTROL_TITLE_MAX_LENGTH) {
    return `is not ${CONTROL_TITLE_MIN_LENGTH} to ${CONTROL_TITLE_MAX_LENGTH} characters long`;
  }

  if (/[\u2013\u2014]/.test(title)) {
    return "contains an em dash or an en dash";
  }

  if (/[\r\n]/.test(title)) {
    return "contains a line break";
  }

  if (title.endsWith(".")) {
    return "ends with a full stop";
  }

  if (title.toLowerCase().startsWith(controlId.toLowerCase())) {
    return "starts with its own control id";
  }

  return undefined;
}

/*
 * Reads the CSRM title file (D-46) against the parsed catalogues and returns each titled control's
 * title by control id. It refuses anything that could mislabel a control, naming the file and the
 * control. Coverage is proved by the tests, not enforced here, so a later catalogue update cannot
 * stop Strapi from starting.
 */
export function parseControlTitles(
  sourceFile: string,
  source: string,
  catalogues: ControlCatalogue[],
): Map<string, string> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";

    throw controlTitleError(sourceFile, `is not valid JSON.${detail}`);
  }

  if (!isJsonObject(parsed)) {
    throw controlTitleError(sourceFile, "must contain an object.");
  }

  const { description, sources, titles } = parsed;

  if (!nonBlankString(description)) {
    throw controlTitleError(sourceFile, "must define description.");
  }

  if (!isJsonObject(sources) || !isJsonObject(titles)) {
    throw controlTitleError(sourceFile, "must define sources and titles as objects.");
  }

  for (const catalogueFile of new Set([...Object.keys(sources), ...Object.keys(titles)])) {
    if (!(catalogueFile in sources) || !(catalogueFile in titles)) {
      throw controlTitleError(
        sourceFile,
        `must list ${catalogueFile} in both sources and titles.`,
      );
    }
  }

  const cataloguesByFile = new Map(
    catalogues.map((catalogue) => [catalogue.sourceFile, catalogue]),
  );
  const result = new Map<string, string>();

  for (const [catalogueFile, catalogueTitles] of Object.entries(titles)) {
    const catalogue = cataloguesByFile.get(catalogueFile);

    if (
      !(CONTROL_CATALOGUE_FILES as readonly string[]).includes(catalogueFile) ||
      !catalogue
    ) {
      throw controlTitleError(
        sourceFile,
        `names ${catalogueFile}, which is not a CSRM control catalogue.`,
      );
    }

    const sourceEntry = sources[catalogueFile];

    if (
      !isJsonObject(sourceEntry) ||
      !(CONTROL_TITLE_BASES as readonly unknown[]).includes(sourceEntry.basis) ||
      !nonBlankString(sourceEntry.note)
    ) {
      throw controlTitleError(
        sourceFile,
        `must give ${catalogueFile} a basis of framework or descriptive and a note.`,
      );
    }

    if (!isJsonObject(catalogueTitles)) {
      throw controlTitleError(
        sourceFile,
        `must map ${catalogueFile} control ids to titles.`,
      );
    }

    const controlsById = new Map(
      catalogue.controls.map((control) => [control.id, control]),
    );

    for (const [controlId, title] of Object.entries(catalogueTitles)) {
      const control = controlsById.get(controlId);

      if (!control) {
        throw controlTitleError(
          sourceFile,
          `titles ${controlId}, which ${catalogueFile} does not contain.`,
        );
      }

      if (catalogueLabel(control)) {
        throw controlTitleError(
          sourceFile,
          `titles ${controlId}, which ${catalogueFile} already labels.`,
        );
      }

      const problem = controlTitleProblem(controlId, title);

      if (problem) {
        throw controlTitleError(
          sourceFile,
          `has a title for ${controlId} in ${catalogueFile} that ${problem}.`,
        );
      }

      result.set(controlId, title as string);
    }
  }

  return result;
}

/*
 * Reads the twelve vendored catalogues and the CSRM title file from src/bootstrap/controls under the
 * app root, refusing duplicate control ids across catalogues.
 */
export async function readControlLibrary(
  appRoot: string,
): Promise<{ catalogues: ControlCatalogue[]; titles: Map<string, string> }> {
  const catalogueDirectory = path.resolve(
    appRoot,
    "src",
    "bootstrap",
    "controls",
  );
  const catalogues = await Promise.all(
    CONTROL_CATALOGUE_FILES.map(async (sourceFile) => {
      const source = await readFile(
        path.join(catalogueDirectory, sourceFile),
        "utf8",
      );

      return parseControlCatalogue(sourceFile, source);
    }),
  );
  const controlIds = catalogues.flatMap((catalogue) =>
    catalogue.controls.map((control) => control.id),
  );

  if (new Set(controlIds).size !== controlIds.length) {
    throw new Error("CSRM control catalogues contain duplicate control IDs.");
  }

  const titleSource = await readFile(
    path.join(catalogueDirectory, CONTROL_TITLE_FILE),
    "utf8",
  );

  return {
    catalogues,
    titles: parseControlTitles(CONTROL_TITLE_FILE, titleSource, catalogues),
  };
}

function catalogueLabel(control: JsonObject): string | undefined {
  return firstString(
    control.title,
    control.objective,
    control.strategy,
    nestedString(control, "section", "name"),
    nestedString(control, "category", "title"),
    lastString(control.groupPath),
  );
}

// The catalogue's own label comes first; a CSRM title applies only where the catalogue has none.
function controlName(
  control: JsonObject & { id: string },
  titles: Map<string, string>,
): string {
  const label = catalogueLabel(control) ?? titles.get(control.id);

  return label ? `${control.id} — ${label}` : control.id;
}

function controlReference(control: JsonObject): string | undefined {
  const clause =
    typeof control.clause === "number"
      ? `Clause ${control.clause}`
      : nonBlankString(control.clause);
  const sectionNumber = nonBlankString(control.sectionNumber);

  return (
    firstString(
      control.sourceClause,
      clause,
      control.oscalId,
      control.objectiveId,
      nestedString(control, "parentControl", "id"),
      nestedString(control, "category", "id"),
      nestedString(control, "section", "id"),
      sectionNumber ? `Section ${sectionNumber}` : undefined,
    )
  );
}

export function createControlSeeds(
  catalogues: ControlCatalogue[],
  titles: Map<string, string>,
): ControlSeed[] {
  return catalogues.flatMap((catalogue) => {
    const frameworkVersion = firstString(
      catalogue.framework.version,
      catalogue.framework.release,
    );
    const frameworkSource = firstString(catalogue.framework.source);

    return catalogue.controls.map((control) => ({
      controlNumber: control.id,
      controlReference: controlReference(control),
      description: firstString(
        control.statement,
        control.legalText,
        control.title,
      ),
      framework: catalogue.framework.name,
      frameworkSource,
      frameworkVersion,
      name: controlName(control, titles),
      sourceData: {
        catalogue: catalogue.catalogueData,
        control,
        sourceFile: catalogue.sourceFile,
      },
    }));
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (isJsonObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

function controlNeedsUpdate(
  existingControl: ExistingControl,
  controlSeed: ControlSeed,
): boolean {
  return CONTROL_SEED_FIELDS.some(
    (field) =>
      stableJson(existingControl[field]) !== stableJson(controlSeed[field]),
  );
}

async function findExistingControls(
  strapi: Core.Strapi,
): Promise<Map<string, ExistingControl>> {
  const controlService = strapi.documents("api::csrm-control.csrm-control");
  const existingControls = new Map<string, ExistingControl>();
  let start = 0;

  while (true) {
    const controls = (await controlService.findMany({
      fields: [...CONTROL_SEED_FIELDS],
      limit: CONTROL_QUERY_PAGE_SIZE,
      sort: ["controlNumber:asc"],
      start,
    })) as ExistingControl[];

    for (const control of controls) {
      if (control.controlNumber) {
        existingControls.set(control.controlNumber, control);
      }
    }

    if (controls.length < CONTROL_QUERY_PAGE_SIZE) {
      return existingControls;
    }

    start += controls.length;
  }
}

async function seedCsrmControls(
  strapi: Core.Strapi,
  controlSeeds: ControlSeed[],
) {
  const controlService = strapi.documents("api::csrm-control.csrm-control");
  const existingControls = await findExistingControls(strapi);
  let created = 0;
  let updated = 0;

  for (const controlSeed of controlSeeds) {
    const existingControl = existingControls.get(controlSeed.controlNumber);

    if (!existingControl) {
      await controlService.create({ data: controlSeed });
      created += 1;
      continue;
    }

    if (controlNeedsUpdate(existingControl, controlSeed)) {
      await controlService.update({
        documentId: existingControl.documentId,
        data: controlSeed,
      });
      updated += 1;
    }
  }

  strapi.log.info(
    `IdamBox CSRM control seed complete: ${controlSeeds.length} controls (${created} created, ${updated} updated, ${controlSeeds.length - created - updated} unchanged)`,
  );
}

const CSRM_USERS = {
  jane: {
    email: "jane.doe@idambox.com",
    username: "jane.doe",
    firstName: "Jane",
    lastName: "Doe",
    displayName: "Jane Doe",
    accountStatus: "active",
  },
  bob: {
    email: "bob.doe@idambox.com",
    username: "bob.doe",
    firstName: "Bob",
    lastName: "Doe",
    displayName: "Bob Doe",
    accountStatus: "active",
  },
} as const;

export async function seedCsrmData(strapi: Core.Strapi) {
  if (process.env.IDAMBOX_SEED_CSRM !== "true") {
    return;
  }

  const controlLibrary = await readControlLibrary(strapi.dirs.app.root);
  const controlSeeds = createControlSeeds(
    controlLibrary.catalogues,
    controlLibrary.titles,
  );
  const applicationService = strapi.documents("api::application.application");
  const functionService = strapi.documents("api::function.function");
  const functionApiService = strapi.documents("api::function-api.function-api");
  const roleService = strapi.documents("api::role.role");
  const userService = strapi.documents("api::idambox-user.idambox-user");
  const informationSystemService = strapi.documents("api::csrm-information-system.csrm-information-system");
  const informationAssetService = strapi.documents("api::csrm-information-asset.csrm-information-asset");

  await seedCsrmControls(strapi, controlSeeds);

  const existingApplications = await applicationService.findMany({
    filters: {
      slug: {
        $eq: CSRM_APPLICATION_SLUG,
      },
    },
    limit: 1,
  });

  const application =
    existingApplications[0] ??
    (await applicationService.create({
      data: CSRM_APPLICATION,
    }));

  if (existingApplications.length > 0) {
    await applicationService.update({
      documentId: application.documentId,
      data: CSRM_APPLICATION,
    });
  }

  const seededFunctions = new Map<string, SeededFunction>();

  for (const functionSeed of catalogue.functions) {
    const existingFunctions = await functionService.findMany({
      filters: {
        name: {
          $eq: functionSeed.name,
        },
        application: {
          documentId: {
            $eq: application.documentId,
          },
        },
        // An API-only Function stores no menuPath. `$eq: undefined` is cast to an
        // empty string that never matches the stored NULL, which re-created every
        // API-only Function on each seed, so it is matched as NULL instead.
        menuPath:
          functionSeed.menuPath === undefined
            ? { $null: true }
            : { $eq: functionSeed.menuPath },
      },
      populate: {
        functionApis: true,
      },
      limit: 1,
    });

    const platformFunction =
      existingFunctions[0] ??
      (await functionService.create({
        data: {
          name: functionSeed.name,
          description: functionSeed.description,
          menuPath: functionSeed.menuPath,
          application: application.documentId,
        },
      }));

    if (existingFunctions.length > 0) {
      await functionService.update({
        documentId: platformFunction.documentId,
        data: {
          description: functionSeed.description,
          menuPath: functionSeed.menuPath,
          application: application.documentId,
        },
      });
    }

    const existingFunctionApis =
      (platformFunction as SeededFunction).functionApis ?? [];
    const functionApiDocumentIds: string[] = [];

    for (const functionApiSeed of catalogue.functionApis.filter(
      (apiSeed) => apiSeed.functionId === functionSeed.id,
    )) {
      const existingFunctionApi = existingFunctionApis.find(
        (functionApi) =>
          functionApi.name === functionApiSeed.name &&
          functionApi.url === functionApiSeed.url,
      );

      const functionApi =
        existingFunctionApi ??
        (await functionApiService.create({
          data: {
            name: functionApiSeed.name,
            description: functionApiSeed.description,
            url: functionApiSeed.url,
          },
        }));

      if (existingFunctionApi) {
        await functionApiService.update({
          documentId: functionApi.documentId,
          data: {
            description: functionApiSeed.description,
            url: functionApiSeed.url,
          },
        });
      }

      functionApiDocumentIds.push(functionApi.documentId);
    }

    await functionService.update({
      documentId: platformFunction.documentId,
      data: {
        functionApis: functionApiDocumentIds,
      },
    });

    seededFunctions.set(functionSeed.id, {
      documentId: platformFunction.documentId,
    });
  }

  const seededRoles = new Map<string, { documentId: string }>();

  for (const roleSeed of catalogue.roles) {
    const functionDocumentIds = roleSeed.functionIds.map((functionId) => {
      const seededFunction = seededFunctions.get(functionId);

      if (!seededFunction) {
        throw new Error(
          `Function ${functionId} referenced by role ${roleSeed.name} was not found in the CSRM catalogue.`,
        );
      }

      return seededFunction.documentId;
    });

    const existingRoles = await roleService.findMany({
      filters: {
        name: {
          $eq: roleSeed.name,
        },
      },
      limit: 1,
    });

    const role =
      existingRoles[0] ??
      (await roleService.create({
        data: {
          name: roleSeed.name,
          description: roleSeed.description,
          functions: functionDocumentIds,
        },
      }));

    if (existingRoles.length > 0) {
      await roleService.update({
        documentId: role.documentId,
        data: {
          description: roleSeed.description,
          functions: functionDocumentIds,
        },
      });
    }

    seededRoles.set(roleSeed.id, role);
  }

  const securityAnalystRole = seededRoles.get("role.security_analyst");

  if (!securityAnalystRole) {
    throw new Error(
      `${CSRM_SECURITY_ANALYST_ROLE_NAME} role was not found in the CSRM catalogue.`,
    );
  }

  const existingJaneUsers = await userService.findMany({
    filters: {
      email: {
        $eq: CSRM_USERS.jane.email,
      },
    },
    limit: 1,
  });

  if (existingJaneUsers.length === 0) {
    await userService.create({
      data: {
        ...CSRM_USERS.jane,
        ...developmentFixtureSubject(CSRM_USERS.jane.email),
        roles: [],
      },
    });
  } else {
    await userService.update({
      documentId: existingJaneUsers[0].documentId,
      data: {
        ...CSRM_USERS.jane,
        ...developmentFixtureSubject(CSRM_USERS.jane.email),
        roles: [],
      },
    });
  }

  const existingBobUsers = await userService.findMany({
    filters: {
      email: {
        $eq: CSRM_USERS.bob.email,
      },
    },
    limit: 1,
  });

  if (existingBobUsers.length === 0) {
    await userService.create({
      data: {
        ...CSRM_USERS.bob,
        ...developmentFixtureSubject(CSRM_USERS.bob.email),
        roles: [securityAnalystRole.documentId],
      },
    });
  } else {
    await userService.update({
      documentId: existingBobUsers[0].documentId,
      data: {
        roles: [securityAnalystRole.documentId],
        ...CSRM_USERS.bob,
        ...developmentFixtureSubject(CSRM_USERS.bob.email),
      },
    });
  }

  const existingSystems = await informationSystemService.findMany({
    filters: { name: { $eq: "Customer portal" } },
    limit: 1,
  });
  if (existingSystems.length === 0) {
    await informationSystemService.create({
      data: {
        name: "Customer portal",
        description: "Development fixture for authorised Requestor workflow verification.",
        environment: "Production",
        lifecycleState: "Existing",
      },
    });
  }

  const existingAssets = await informationAssetService.findMany({
    filters: { name: { $eq: "Customer records" } },
    limit: 1,
  });
  if (existingAssets.length === 0) {
    await informationAssetService.create({
      data: {
        name: "Customer records",
        description: "Development fixture for authorised Requestor workflow verification.",
        dataClassification: "Restricted",
        containsPersonalData: true,
      },
    });
  }

  strapi.log.info("IdamBox CSRM sample data seed complete");
}
