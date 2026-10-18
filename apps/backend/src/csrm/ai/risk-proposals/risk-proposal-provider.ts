import { CSRM_AI_PROVIDER_MODE, type CsrmAiProviderMode } from "../../ai-provider-selection";
import type { SlotInstruction } from "../analyst-instruction";
import type { AssessmentContext, AssessmentContextRecords } from "../assessment-context";
import { deterministicRiskProposalProvider } from "./deterministic-risk-proposal-provider";
import { openAiCompatibleRiskProposalProvider } from "./openai-compatible-risk-proposal-provider";

/*
 * The risk proposal providers (Phase 16 D-25, D-50). A provider returns model-facing wire JSON, never the stored
 * envelope: the job passes whatever it returns through the one adapter (`risk-proposal-adapter.ts`), so the
 * deterministic provider every suite runs exercises every rule the adapter owns. The hosted provider reads only the
 * built context (its prompt carries the instruction in its slot); the deterministic one also reads the records and the
 * instruction the context was built from, which is how its rules stay deterministic.
 *
 * The two wire schemas live beside the adapter that reads them, and the hosted provider's system instructions beside
 * the call that sends them; both are re-exported here, the providers' one entry point, so no module cycle forms.
 */
export { riskRewriteWireSchema, riskSuggestionsWireSchema } from "./risk-proposal-adapter";
export { RISK_PROPOSAL_SYSTEM_INSTRUCTIONS, RISK_REWRITE_TASK, RISK_SUGGESTIONS_TASK } from "./openai-compatible-risk-proposal-provider";

export type RiskProposalProviderInput = {
  context: AssessmentContext;
  records: AssessmentContextRecords;
  /** The validated analyst instruction the context's slot carries, or null for the default task. */
  instruction: SlotInstruction | null;
};

export interface RiskProposalProvider {
  readonly name: string;
  readonly version: string;
  /** "Suggest more risks": `{ schemaVersion: 1, risks: [...] }` wire JSON. */
  suggest(input: RiskProposalProviderInput): Promise<unknown>;
  /** "Rewrite this risk": `{ schemaVersion: 1, risk }` wire JSON. */
  rewrite(input: RiskProposalProviderInput): Promise<unknown>;
}

/** The provider `CSRM_AI_PROVIDER` selects, as Phase 12 selects the draft's: the deterministic one unless the hosted provider is configured. */
export function selectRiskProposalProvider(mode: CsrmAiProviderMode = CSRM_AI_PROVIDER_MODE): RiskProposalProvider {
  return mode === "openai-compatible" ? openAiCompatibleRiskProposalProvider : deterministicRiskProposalProvider;
}
