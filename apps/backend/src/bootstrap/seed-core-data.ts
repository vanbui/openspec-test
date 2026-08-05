import type { Core } from "@strapi/strapi";

const IDAMBOX_NAME_PREFIX = "IdamBox ";

export function getApplicationNamePrefix(applicationName: string): string {
  return applicationName.startsWith(IDAMBOX_NAME_PREFIX)
    ? applicationName.slice(IDAMBOX_NAME_PREFIX.length)
    : applicationName;
}

export function buildPrefixedFunctionName(
  applicationName: string,
  functionName: string,
): string {
  return `${getApplicationNamePrefix(applicationName)} ${functionName}`;
}

export const CSRM_SECURITY_ANALYST_ROLE_NAME = buildPrefixedFunctionName(
  "IdamBox CSRM",
  "Security Analyst",
);

type FunctionSeed = {
  name: string;
  description: string;
  createReusableRole?: boolean;
};

type ApplicationSeed = {
  name: string;
  slug?: string;
  description: string;
  functions?: FunctionSeed[];
};

const applications: ApplicationSeed[] = [
  {
    name: "IdamBox IAM",
    description: "Identity and access management module.",
  },
  {
    name: "IdamBox Compliance",
    description: "Compliance management module.",
  },
  {
    name: "IdamBox Automation",
    description: "Automation workflow module.",
  },
  {
    name: "IdamBox Crypto Manager",
    description: "Cryptographic asset management module.",
  },
  {
    name: "IdamBox LMS",
    description: "Learning management module.",
    functions: [
      {
        name: "STUDENT",
        description: "Learner function for IdamBox LMS.",
        createReusableRole: true,
      },
      {
        name: "TUTOR",
        description: "Tutor function for IdamBox LMS.",
        createReusableRole: true,
      },
    ],
  },
  {
    name: "IdamBox CSRM",
    slug: "idambox-csrm",
    description:
      "Cybersecurity Risk Manager module for automating cybersecurity risk management processes.",
    functions: [
      {
        name: "Security Analyst",
        description: "Security Analyst function for IdamBox CSRM.",
        createReusableRole: true,
      },
      {
        name: "Security Analyst Agent",
        description:
          "Security Analyst Agent function for automated CSRM security analysis workflows.",
        createReusableRole: true,
      },
    ],
  },
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export async function seedCoreData(strapi: Core.Strapi) {
  if (process.env.IDAMBOX_SEED_CORE !== "true") {
    return;
  }

  const applicationService = strapi.documents("api::application.application");
  const functionService = strapi.documents("api::function.function");
  const roleService = strapi.documents("api::role.role");

  for (const appSeed of applications) {
    const slug = appSeed.slug ?? slugify(appSeed.name);

    const existingApplications = await applicationService.findMany({
      filters: {
        slug: {
          $eq: slug,
        },
      },
      limit: 1,
    });

    const application =
      existingApplications[0] ??
      (await applicationService.create({
        data: {
          name: appSeed.name,
          slug,
          description: appSeed.description,
          applicationStatus: "active",
        },
      }));

    for (const functionSeed of appSeed.functions ?? []) {
      const functionName = buildPrefixedFunctionName(
        appSeed.name,
        functionSeed.name,
      );

      const existingFunctions = await functionService.findMany({
        filters: {
          name: {
            $eq: functionName,
          },
          application: {
            documentId: {
              $eq: application.documentId,
            },
          },
        },
        limit: 1,
      });

      const platformFunction =
        existingFunctions[0] ??
        (await functionService.create({
          data: {
            name: functionName,
            description: functionSeed.description,
            application: application.documentId,
          },
        }));

      if (!functionSeed.createReusableRole) {
        continue;
      }

      const existingReusableRoles = await roleService.findMany({
        filters: {
          name: {
            $eq: functionName,
          },
        },
        limit: 1,
      });

      const reusableRole =
        existingReusableRoles[0] ??
        (await roleService.create({
          data: {
            name: functionName,
            description: functionSeed.description,
            functions: [platformFunction.documentId],
          },
        }));

      if (existingReusableRoles.length > 0) {
        await roleService.update({
          documentId: reusableRole.documentId,
          data: {
            functions: [platformFunction.documentId],
          },
        });
      }
    }
  }

  strapi.log.info("IdamBox core sample data seed complete");
}
