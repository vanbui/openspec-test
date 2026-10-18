import { parseQuestionnaireGenerationProposal, type QuestionnaireGenerationProvider } from "./questionnaire-generation-provider";

const BUSINESS_CRITICALITIES: readonly string[] = ["Low", "Moderate", "High", "Critical"];
function contextText(value: unknown, fallback: string): string { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
/*
 * WR-105 (G-3) and walk D12: the questions, title and description are CSRM's own sentences, so the run's proposal keeps
 * no Requestor text and every sentence ends with one mark. Only the request's business criticality (a closed value) and
 * the first selected asset's name (reference data, which the run's context summary also names) are written in.
 */
export const deterministicQuestionnaireGenerationProvider: QuestionnaireGenerationProvider = {
  name: "deterministic-questionnaire-generation", version: "2",
  async generate({ records }) {
    const request = records.request;
    const thirdParty = request.thirdPartyInvolvement === true || Boolean(contextText(request.thirdPartyDetails, ""));
    const criticality = typeof request.businessCriticality === "string" && BUSINESS_CRITICALITIES.includes(request.businessCriticality) ? request.businessCriticality : "not stated";
    const asset = contextText(records.assets[0]?.name, "the information this service handles").replace(/[\s.?!]+$/, "");
    const context = { key: "context", title: "Request context", order: 0 };
    const protection = { key: "protection", title: "Protection and recovery", order: 1 };
    const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "not-sure", label: "Not sure" }];
    return parseQuestionnaireGenerationProposal({ schemaVersion: 1, title: "Cyber risk questionnaire", description: "Questions about what this service must protect, who provides it, and how it is protected and recovered.", questions: [
      { questionText: "What security outcomes matter most for this service?", helpText: "Describe what must be protected and what would cause a serious problem if it failed.", answerType: "Long text", options: { schemaVersion: 1, questionKey: "security-objectives", section: context, order: 0, required: true } },
      { questionText: `Is the stated business criticality (${criticality}) right?`, helpText: "Choose the level of disruption the business could tolerate. Select Not sure if another person needs to confirm it.", answerType: "Single select", options: { schemaVersion: 1, questionKey: "business-criticality", section: context, order: 1, required: true, choices: [...BUSINESS_CRITICALITIES.map((value) => ({ value, label: value })), { value: "not-sure", label: "Not sure" }] } },
      { questionText: "Is an external provider involved?", helpText: "Include providers that deliver the service or handle its information.", answerType: "Single select", options: { schemaVersion: 1, questionKey: "third-party-involvement", section: context, order: 2, required: true, choices: yesNo } },
      { questionText: "What does the external provider do?", helpText: "Name the provider and describe its role, including any information it handles.", answerType: "Long text", options: { schemaVersion: 1, questionKey: "third-party-details", section: context, order: 3, required: thirdParty, visibility: { questionKey: "third-party-involvement", operator: "equals", value: "yes" } } },
      { questionText: "How do you meet the regulatory requirements that apply to this request?", helpText: "Describe any known obligations. You can leave this blank if the Security Analyst can confirm them elsewhere.", answerType: "Long text", options: { schemaVersion: 1, questionKey: "regulatory-obligations", section: protection, order: 0, required: false } },
      { questionText: `How is ${asset} protected?`, helpText: "Describe who can access it and how it is kept safe during storage and transfer.", answerType: "Long text", options: { schemaVersion: 1, questionKey: "asset-protection", section: protection, order: 1, required: true } },
      { questionText: "Has recovery been tested?", helpText: "Choose Yes if a recent recovery test showed the service or information could be restored.", answerType: "Single select", options: { schemaVersion: 1, questionKey: "recovery-tested", section: protection, order: 2, required: true, choices: yesNo } },
    ] });
  },
};
