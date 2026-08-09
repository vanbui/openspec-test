import { StateEvidence } from "@/components/test-evidence/state-evidence";

/** This route has no production surface and exists only for browser state evidence. */
export default async function StateEvidencePage() {
  return await StateEvidence();
}
