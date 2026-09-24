import { parseQuestionnaireGenerationProposal, type QuestionnaireGenerationContext, type QuestionnaireGenerationProposal, type QuestionnaireGenerationProvider } from "./questionnaire-generation-provider";

function contextText(value: string | null | undefined): string { return value?.trim() || "the submitted request"; }
export const deterministicQuestionnaireGenerationProvider: QuestionnaireGenerationProvider = {
  name: "deterministic-questionnaire-generation", version: "1",
  async generate(context: QuestionnaireGenerationContext): Promise<QuestionnaireGenerationProposal> {
    const thirdParty = context.thirdPartyInvolvement || Boolean(context.thirdPartyDetails?.trim());
    return parseQuestionnaireGenerationProposal({ schemaVersion: 1, title: `Questionnaire: ${contextText(context.title)}`, description: `Questions derived from ${contextText(context.assessmentType)} request context and business purpose.`, questions: [
      { questionText: `Describe the security objectives for ${contextText(context.businessPurpose)}.`, answerType: "Long text", options: { schemaVersion: 1, questionKey: "security-objectives", section: { key: "context", title: "Request context", order: 0 }, order: 0, required: true } },
      { questionText: `Confirm the stated business criticality (${contextText(context.businessCriticality)}).`, answerType: "Single select", options: { schemaVersion: 1, questionKey: "business-criticality", section: { key: "context", title: "Request context", order: 0 }, order: 1, required: true, choices: ["Low", "Moderate", "High", "Critical"].map((value) => ({ value, label: value })) } },
      { questionText: "Are external providers involved in delivery or data handling?", answerType: "Boolean", options: { schemaVersion: 1, questionKey: "third-party-involvement", section: { key: "third-party", title: "Third-party involvement", order: 1 }, order: 0, required: true } },
      { questionText: `Provide relevant provider details: ${contextText(context.thirdPartyDetails)}.`, answerType: "Long text", options: { schemaVersion: 1, questionKey: "third-party-details", section: { key: "third-party", title: "Third-party involvement", order: 1 }, order: 1, required: thirdParty, visibility: { questionKey: "third-party-involvement", operator: "equals", value: true } } },
    ] });
  },
};
