import type { Core } from "@strapi/strapi";

import { parseQuestionnaireDefinition } from "../api/csrm-questionnaire/services/questionnaire-definition";
import { developmentIdentityEnabled } from "../utils/development-identity-enabled";
import { seedRequestDetails } from "./seed-request-details";

const JANE_EMAIL = "jane.doe@idambox.com";
const BOB_EMAIL = "bob.doe@idambox.com";
const REQUEST_NUMBER = "RAR-DEV-QUES-001";
const CROSS_OWNER_REQUEST_NUMBER = "RAR-DEV-CROSS-001";
const QUESTIONNAIRE_NUMBER = "QUES-DEV-001";
const DRAFT_REQUEST_NUMBER = "RAR-DEV-QUES-DRAFT-001";
const DRAFT_QUESTIONNAIRE_NUMBER = "QUES-DEV-DRAFT-001";
const DRAFT_QUESTIONNAIRE_TITLE = "Customer portal questionnaire draft";
const UNRELEASED_REQUEST_NUMBER = "RAR-DEV-QUES-UNRELEASED-001";
const UNRELEASED_QUESTIONNAIRE_NUMBER = "QUES-DEV-UNRELEASED-001";
const UNRELEASED_QUESTIONNAIRE_TITLE = "Customer portal questionnaire awaiting release";
const FIXTURE_RELEASED_AT = "2026-08-30T00:00:00.000Z";

type SeedDocument = { documentId: string; options?: unknown; releasedAt?: unknown };
type SeedDocumentService = {
  create: (input: { data: Record<string, unknown> }) => Promise<SeedDocument>;
  findMany: (input: Record<string, unknown>) => Promise<SeedDocument[]>;
  update: (input: { documentId: string; data: Record<string, unknown> }) => Promise<SeedDocument>;
};

type QuestionSeed = {
  questionText: string;
  answerType: "Text" | "Long text" | "Boolean" | "Single select" | "Multi select" | "Date";
  options: {
    schemaVersion: 1;
    questionKey: string;
    section: { key: string; title: string; description: string; order: number };
    order: number;
    required: boolean;
    choices?: Array<{ value: string; label: string }>;
    visibility?: { questionKey: string; operator: "equals"; value: boolean };
  };
};

const sections = {
  service: { key: "service-context", title: "Service context", description: "Purpose and scope of the service being assessed.", order: 1 },
  data: { key: "data-privacy", title: "Data and privacy", description: "Information handled by the service and its privacy implications.", order: 2 },
  hosting: { key: "hosting-access", title: "Hosting and access", description: "Hosting model, production access, and delivery timing.", order: 3 },
  thirdParties: { key: "third-parties", title: "Third parties", description: "External organisations involved in service delivery.", order: 4 },
} as const;

const QUESTION_SEEDS: readonly QuestionSeed[] = [
  {
    questionText: "What is the name of the service being assessed?",
    answerType: "Text",
    options: { schemaVersion: 1, questionKey: "service-name", section: sections.service, order: 1, required: true },
  },
  {
    questionText: "Describe what the service does and who relies on it.",
    answerType: "Long text",
    options: { schemaVersion: 1, questionKey: "service-description", section: sections.service, order: 2, required: true },
  },
  {
    questionText: "Will the service handle personal information?",
    answerType: "Boolean",
    options: { schemaVersion: 1, questionKey: "handles-personal-data", section: sections.data, order: 1, required: true },
  },
  {
    questionText: "Which categories of personal information will be handled?",
    answerType: "Multi select",
    options: {
      schemaVersion: 1,
      questionKey: "personal-data-types",
      section: sections.data,
      order: 2,
      required: true,
      choices: [
        { value: "contact", label: "Contact details" },
        { value: "identity", label: "Identity information" },
        { value: "financial", label: "Financial information" },
        { value: "sensitive", label: "Sensitive information" },
      ],
      visibility: { questionKey: "handles-personal-data", operator: "equals", value: true },
    },
  },
  {
    questionText: "Where will the service be hosted?",
    answerType: "Single select",
    options: {
      schemaVersion: 1,
      questionKey: "hosting-model",
      section: sections.hosting,
      order: 1,
      required: true,
      choices: [
        { value: "organisation", label: "Organisation managed" },
        { value: "cloud", label: "Cloud service" },
        { value: "hybrid", label: "Hybrid" },
        { value: "third-party", label: "Third-party hosted" },
      ],
    },
  },
  {
    questionText: "What production URL or network location will users access?",
    answerType: "Text",
    options: { schemaVersion: 1, questionKey: "production-url", section: sections.hosting, order: 2, required: false },
  },
  {
    questionText: "What is the planned production go-live date?",
    answerType: "Date",
    options: { schemaVersion: 1, questionKey: "go-live-date", section: sections.hosting, order: 3, required: true },
  },
  {
    questionText: "Identify any third parties that operate, support, or receive data from the service.",
    answerType: "Long text",
    options: { schemaVersion: 1, questionKey: "third-party-providers", section: sections.thirdParties, order: 1, required: false },
  },
];

const SUBMITTED_VALUES: Readonly<Record<string, string | boolean | readonly string[]>> = {
  "service-name": "Customer portal",
  "service-description":
    "About 38,000 customers a month use the portal to view bills, make payments through the payment gateway, update their phone number and email address and raise service requests. Release 4.2 adds self-service change of bank account details, upload of identity documents for verification, and passkey sign-in. The contact centre and the billing team rely on it as the system of entry for customer changes; an outage of more than four hours moves that work back to the phones.",
  "handles-personal-data": true,
  "personal-data-types": ["contact", "identity"],
  "hosting-model": "cloud",
  "production-url": "https://portal.example.test",
  "go-live-date": "2026-10-01",
  "third-party-providers":
    "Microsoft Azure hosts the portal in Australia East (App Service, Azure SQL Database, Storage, Front Door) and provides customer identity through Entra External ID. A managed support provider deploys releases and has just-in-time read access to production; part of its team is offshore and can see customer phone numbers and email addresses in application logs. The payment gateway takes card payments on its own hosted page. An external firm performs the annual penetration test.",
};

function service(strapi: Core.Strapi, uid: string): SeedDocumentService {
  return strapi.documents(uid as never) as unknown as SeedDocumentService;
}

/*
 * The release facts a fixture needs so a Requestor journey written before the
 * release gate still reaches its questionnaire. They are applied only when the
 * fixture has no release fact yet: a running development application owns its
 * own governance state, so a dev-server restart must never reset a release or
 * a return to analyst review that an analyst performed in the app.
 */
function releaseFactsFor(analystDocumentId: string, existing?: SeedDocument) {
  if (existing && typeof existing.releasedAt === "string" && existing.releasedAt.length > 0) return {};
  return {
    releasedAt: FIXTURE_RELEASED_AT,
    releasedBy: analystDocumentId,
    governanceLog: [{ schemaVersion: 1, kind: "released", at: FIXTURE_RELEASED_AT, by: analystDocumentId }],
  };
}

function validateQuestionSeeds(): void {
  parseQuestionnaireDefinition(
    QUESTION_SEEDS.map((question) => ({
      documentId: question.options.questionKey,
      questionText: question.questionText,
      answerType: question.answerType,
      options: question.options,
      answer: null,
    })),
  );
}

export async function seedQuestionnaireWorkflow(strapi: Core.Strapi): Promise<void> {
  if (process.env.IDAMBOX_SEED_CSRM !== "true" || !developmentIdentityEnabled()) return;

  validateQuestionSeeds();

  const userService = service(strapi, "api::idambox-user.idambox-user");
  const requestService = service(strapi, "api::csrm-assessment-request.csrm-assessment-request");
  const questionnaireService = service(strapi, "api::csrm-questionnaire.csrm-questionnaire");
  const questionService = service(strapi, "api::csrm-question.csrm-question");

  const [jane] = await userService.findMany({ filters: { email: { $eq: JANE_EMAIL } }, limit: 1 });
  const [bob] = await userService.findMany({ filters: { email: { $eq: BOB_EMAIL } }, limit: 1 });
  if (!jane) throw new Error(`Questionnaire development fixture owner ${JANE_EMAIL} was not found.`);
  if (!bob) throw new Error(`Questionnaire development fixture owner ${BOB_EMAIL} was not found.`);

  // Workflow facts are seeded only at creation. Once a fixture request exists,
  // the running application owns its workflow state: reseeding on a dev-server
  // restart must never regress a request that has advanced (for example to an
  // approved request behind a released assessment) back to its starting stage.
  const withoutWorkflowFacts = <T extends { requestStatus?: unknown; submittedDate?: unknown }>(data: T) => {
    const { requestStatus: _requestStatus, submittedDate: _submittedDate, ...descriptive } = data;
    return descriptive;
  };

  const crossOwnerRequestData = {
    requestNumber: CROSS_OWNER_REQUEST_NUMBER,
    title: "Azure Pipeline Decorator for all delivery pipelines",
    ...seedRequestDetails(CROSS_OWNER_REQUEST_NUMBER),
    businessCriticality: "Moderate",
    submittedDate: "2026-08-29T00:00:00.000Z",
    requestStatus: "submitted",
    requestor: bob.documentId,
  };
  const [existingCrossOwnerRequest] = await requestService.findMany({
    filters: { requestNumber: { $eq: CROSS_OWNER_REQUEST_NUMBER } },
    limit: 1,
  });
  if (existingCrossOwnerRequest) {
    await requestService.update({ documentId: existingCrossOwnerRequest.documentId, data: withoutWorkflowFacts(crossOwnerRequestData) });
  } else {
    await requestService.create({ data: crossOwnerRequestData });
  }

  const requestData = {
    requestNumber: REQUEST_NUMBER,
    title: "Customer portal release 4.2 self-service changes",
    ...seedRequestDetails(REQUEST_NUMBER),
    businessCriticality: "High",
    submittedDate: "2026-08-30T00:00:00.000Z",
    requestStatus: "questionnaire-in-progress",
    requestor: jane.documentId,
  };
  const [existingRequest] = await requestService.findMany({ filters: { requestNumber: { $eq: REQUEST_NUMBER } }, limit: 1 });
  const request = existingRequest
    ? await requestService.update({ documentId: existingRequest.documentId, data: withoutWorkflowFacts(requestData) })
    : await requestService.create({ data: requestData });

  const [existingQuestionnaire] = await questionnaireService.findMany({ filters: { questionnaireNumber: { $eq: QUESTIONNAIRE_NUMBER } }, limit: 1 });
  const questionnaireData = {
    questionnaireNumber: QUESTIONNAIRE_NUMBER,
    title: "Customer portal cyber risk questionnaire",
    description: "Structured service, privacy, hosting, access, and third-party context for analyst review.",
    assessmentRequest: request.documentId,
    ...releaseFactsFor(bob.documentId, existingQuestionnaire),
  };
  const questionnaire = existingQuestionnaire
    ? await questionnaireService.update({ documentId: existingQuestionnaire.documentId, data: questionnaireData })
    : await questionnaireService.create({ data: questionnaireData });

  const existingQuestions = await questionService.findMany({
    filters: { questionnaire: { documentId: { $eq: questionnaire.documentId } } },
    limit: 100,
  });
  const existingByKey = new Map(
    existingQuestions.flatMap((question) => {
      const options = question.options;
      if (typeof options !== "object" || options === null || Array.isArray(options)) return [];
      const questionKey = (options as { questionKey?: unknown }).questionKey;
      return typeof questionKey === "string" ? [[questionKey, question] as const] : [];
    }),
  );

  for (const questionSeed of QUESTION_SEEDS) {
    const submittedAt = "2026-08-30T00:00:00.000Z";
    const questionData = {
      ...questionSeed,
      answer: {
        schemaVersion: 1,
        value: SUBMITTED_VALUES[questionSeed.options.questionKey] ?? null,
        state: "submitted",
        updatedAt: submittedAt,
        submittedAt,
      },
      questionnaire: questionnaire.documentId,
    };
    const existingQuestion = existingByKey.get(questionSeed.options.questionKey);
    if (existingQuestion) {
      await questionService.update({ documentId: existingQuestion.documentId, data: questionData });
    } else {
      await questionService.create({ data: questionData });
    }
  }

  const draftRequestData = {
    requestNumber: DRAFT_REQUEST_NUMBER,
    title: "Customer portal virtual assistant and live chat",
    ...seedRequestDetails(DRAFT_REQUEST_NUMBER),
    businessCriticality: "High",
    requestStatus: "questionnaire-in-progress",
    requestor: jane.documentId,
  };
  const [existingDraftRequest] = await requestService.findMany({
    filters: { requestNumber: { $eq: DRAFT_REQUEST_NUMBER } },
    limit: 1,
  });
  const draftRequest = existingDraftRequest
    ? await requestService.update({ documentId: existingDraftRequest.documentId, data: withoutWorkflowFacts(draftRequestData) })
    : await requestService.create({ data: draftRequestData });

  const [existingDraftQuestionnaire] = await questionnaireService.findMany({
    filters: { questionnaireNumber: { $eq: DRAFT_QUESTIONNAIRE_NUMBER } },
    limit: 1,
  });
  const draftQuestionnaireData = {
    questionnaireNumber: DRAFT_QUESTIONNAIRE_NUMBER,
    title: DRAFT_QUESTIONNAIRE_TITLE,
    description: "A mutable questionnaire fixture for Requestor workflow verification.",
    assessmentRequest: draftRequest.documentId,
    ...releaseFactsFor(bob.documentId, existingDraftQuestionnaire),
  };
  const draftQuestionnaire = existingDraftQuestionnaire
    ? await questionnaireService.update({ documentId: existingDraftQuestionnaire.documentId, data: draftQuestionnaireData })
    : await questionnaireService.create({ data: draftQuestionnaireData });
  const existingDraftQuestions = await questionService.findMany({
    filters: { questionnaire: { documentId: { $eq: draftQuestionnaire.documentId } } },
    limit: 100,
  });
  const existingDraftByKey = new Map(
    existingDraftQuestions.flatMap((question) => {
      const options = question.options;
      if (typeof options !== "object" || options === null || Array.isArray(options)) return [];
      const questionKey = (options as { questionKey?: unknown }).questionKey;
      return typeof questionKey === "string" ? [[questionKey, question] as const] : [];
    }),
  );
  for (const questionSeed of QUESTION_SEEDS) {
    const questionData = {
      ...questionSeed,
      answer: null,
      questionnaire: draftQuestionnaire.documentId,
    };
    const existingQuestion = existingDraftByKey.get(questionSeed.options.questionKey);
    if (existingQuestion) {
      await questionService.update({ documentId: existingQuestion.documentId, data: questionData });
    } else {
      await questionService.create({ data: questionData });
    }
  }

  /*
   * A deliberately unreleased fixture. It is owned by the same Requestor as the
   * released fixtures and carries the same question seeds, so a browser journey
   * can prove that an analyst-only questionnaire is refused by the server
   * rather than merely unlinked in the navigation.
   */
  const unreleasedRequestData = {
    requestNumber: UNRELEASED_REQUEST_NUMBER,
    title: "Customer portal mobile app and public API",
    ...seedRequestDetails(UNRELEASED_REQUEST_NUMBER),
    businessCriticality: "Moderate",
    requestStatus: "questionnaire-in-progress",
    requestor: jane.documentId,
  };
  const [existingUnreleasedRequest] = await requestService.findMany({
    filters: { requestNumber: { $eq: UNRELEASED_REQUEST_NUMBER } },
    limit: 1,
  });
  const unreleasedRequest = existingUnreleasedRequest
    ? await requestService.update({ documentId: existingUnreleasedRequest.documentId, data: withoutWorkflowFacts(unreleasedRequestData) })
    : await requestService.create({ data: unreleasedRequestData });

  const unreleasedQuestionnaireData = {
    questionnaireNumber: UNRELEASED_QUESTIONNAIRE_NUMBER,
    title: UNRELEASED_QUESTIONNAIRE_TITLE,
    description: "An analyst-only questionnaire fixture that has never been released.",
    assessmentRequest: unreleasedRequest.documentId,
  };
  const [existingUnreleasedQuestionnaire] = await questionnaireService.findMany({
    filters: { questionnaireNumber: { $eq: UNRELEASED_QUESTIONNAIRE_NUMBER } },
    limit: 1,
  });
  const unreleasedQuestionnaire = existingUnreleasedQuestionnaire
    ? await questionnaireService.update({ documentId: existingUnreleasedQuestionnaire.documentId, data: unreleasedQuestionnaireData })
    : await questionnaireService.create({ data: unreleasedQuestionnaireData });
  const existingUnreleasedQuestions = await questionService.findMany({
    filters: { questionnaire: { documentId: { $eq: unreleasedQuestionnaire.documentId } } },
    limit: 100,
  });
  const existingUnreleasedByKey = new Map(
    existingUnreleasedQuestions.flatMap((question) => {
      const options = question.options;
      if (typeof options !== "object" || options === null || Array.isArray(options)) return [];
      const questionKey = (options as { questionKey?: unknown }).questionKey;
      return typeof questionKey === "string" ? [[questionKey, question] as const] : [];
    }),
  );
  for (const questionSeed of QUESTION_SEEDS) {
    const questionData = {
      ...questionSeed,
      answer: null,
      questionnaire: unreleasedQuestionnaire.documentId,
    };
    const existingQuestion = existingUnreleasedByKey.get(questionSeed.options.questionKey);
    if (existingQuestion) {
      await questionService.update({ documentId: existingQuestion.documentId, data: questionData });
    } else {
      await questionService.create({ data: questionData });
    }
  }

  strapi.log.info(`CSRM questionnaire workflow fixtures ${QUESTIONNAIRE_NUMBER}, ${DRAFT_QUESTIONNAIRE_NUMBER} and ${UNRELEASED_QUESTIONNAIRE_NUMBER} reconciled.`);
}
