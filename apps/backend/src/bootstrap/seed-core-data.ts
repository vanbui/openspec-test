import type { Core } from "@strapi/strapi";

type ApplicationSeed = {
  name: string;
  slug?: string;
  description: string;
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
  },
  {
    name: "IdamBox CSRM",
    slug: "idambox-csrm",
    description:
      "Cybersecurity Risk Manager module for automating cybersecurity risk management processes.",
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
  }

  strapi.log.info("IdamBox core sample data seed complete");
}
