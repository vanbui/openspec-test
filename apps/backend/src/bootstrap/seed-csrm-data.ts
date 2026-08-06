import type { Core } from "@strapi/strapi";

import catalogue from "./idambox-csrm-role-function-api-catalogue.json";

const CSRM_APPLICATION_SLUG = "idambox-csrm";
const CSRM_SECURITY_ANALYST_ROLE_NAME = "Security Analyst";

type SeededFunction = {
  documentId: string;
  functionApis?: Array<{
    documentId: string;
    name: string;
    url: string;
  }>;
};

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

  const applicationService = strapi.documents("api::application.application");
  const functionService = strapi.documents("api::function.function");
  const functionApiService = strapi.documents("api::function-api.function-api");
  const roleService = strapi.documents("api::role.role");
  const userService = strapi.documents("api::idambox-user.idambox-user");

  const existingApplications = await applicationService.findMany({
    filters: {
      slug: {
        $eq: CSRM_APPLICATION_SLUG,
      },
    },
    limit: 1,
  });

  const application = existingApplications[0];

  if (!application) {
    throw new Error(
      `The IdamBox CSRM application was not found. Enable IDAMBOX_SEED_CORE=true to seed core applications before CSRM data.`,
    );
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
      data: CSRM_USERS.jane,
    });
  } else {
    await userService.update({
      documentId: existingJaneUsers[0].documentId,
      data: CSRM_USERS.jane,
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
        roles: [securityAnalystRole.documentId],
      },
    });
  } else {
    await userService.update({
      documentId: existingBobUsers[0].documentId,
      data: {
        roles: [securityAnalystRole.documentId],
        ...CSRM_USERS.bob,
      },
    });
  }

  strapi.log.info("IdamBox CSRM sample data seed complete");
}
