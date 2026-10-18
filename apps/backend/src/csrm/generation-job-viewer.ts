import { resolvePeople, type Person, type RequestPeopleStrapi } from "../api/csrm-assessment-request/services/request-people";

/*
 * Phase 13 D-18: any human Security Analyst who may read a request follows and retries its questionnaire generation
 * and assessment draft jobs. Every job projection therefore carries, for the analyst reading it:
 *  - `canRetry`: the job failed and this viewer may retry it (the registry's `mayRetry`), never "this viewer started it";
 *  - `initiatedBy`: who started the job or its latest retry, as a documentId and a display name only (the Phase 13 people
 *    projection), resolved at read time so a renamed analyst never reads stale; null when that person can't be read;
 *  - `initiatedByViewer`: whether that is the viewer.
 * The registries keep only the initiator's documentId; nothing here is stored.
 */
export type GenerationJobViewerFacts = { canRetry: boolean; initiatedBy: Person | null; initiatedByViewer: boolean };

/** The initiators `documentIds` name, from one bounded people read (13-03's resolvePeople). */
export function resolveGenerationJobInitiators(strapi: unknown, documentIds: Iterable<string>): Promise<Map<string, Person>> {
  return resolvePeople(strapi as RequestPeopleStrapi, documentIds);
}

export function generationJobViewerFacts(input: {
  initiatorDocumentId: string;
  viewerDocumentId: string;
  canRetry: boolean;
  initiators: ReadonlyMap<string, Person>;
}): GenerationJobViewerFacts {
  const person = input.initiators.get(input.initiatorDocumentId);
  return {
    canRetry: input.canRetry,
    initiatedBy: person ? { documentId: person.documentId, displayName: person.displayName } : null,
    initiatedByViewer: input.initiatorDocumentId === input.viewerDocumentId,
  };
}
