/*
 * People cross the CSRM API as a documentId and a display name only (Phase 13 "People Projection"): never an email,
 * a username, a name, an account status, an external subject or a role. Every Phase 13 projection of an assignee,
 * an assigner or an actor in a history reads its people through this module.
 */

const USER_UID = "api::idambox-user.idambox-user";

/** The only user fields a Phase 13 people read selects. */
export const PERSON_FIELDS = ["documentId", "displayName"] as const;

/** The bound of one people read: an assignment history holds at most 1,000 events. */
export const MAX_PEOPLE_PER_READ = 1_000;

export type Person = { documentId: string; displayName: string };

type RecordValue = Record<string, unknown>;

export type RequestPeopleStrapi = {
  documents: (uid: string) => { findMany: (query: RecordValue) => Promise<unknown[]> };
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The person a populated user relation names, or null when it names nobody readable. */
export function projectPerson(value: unknown): Person | null {
  if (!isRecord(value) || typeof value.documentId !== "string" || value.documentId.length === 0) return null;
  return { documentId: value.documentId, displayName: typeof value.displayName === "string" ? value.displayName : "" };
}

/**
 * The people `documentIds` name, keyed by documentId, from one bounded read that selects only PERSON_FIELDS.
 * An id that names no user is absent from the map; the caller decides how to show it.
 */
export async function resolvePeople(strapi: RequestPeopleStrapi, documentIds: Iterable<string>): Promise<Map<string, Person>> {
  const ids = [...new Set([...documentIds].filter((id) => typeof id === "string" && id.length > 0))];
  const people = new Map<string, Person>();
  if (ids.length === 0) return people;
  if (ids.length > MAX_PEOPLE_PER_READ) throw new RangeError("CSRM people read is over its bound.");
  const users = await strapi.documents(USER_UID).findMany({
    filters: { documentId: { $in: ids } },
    fields: [...PERSON_FIELDS],
    limit: ids.length,
  });
  for (const user of users) {
    const person = projectPerson(user);
    if (person) people.set(person.documentId, person);
  }
  return people;
}

/**
 * The relations a caller may populate on the request read (D-04): never `*` and never an IdamBox User relation,
 * whose record carries an email, a username and an external subject. The server projects every person itself.
 */
export const ALLOWED_REQUEST_READ_POPULATE = ["informationSystems", "informationAssets", "questionnaire", "assessment"] as const;

const ALLOWED_POPULATE: ReadonlySet<string> = new Set(ALLOWED_REQUEST_READ_POPULATE);

function allowedNames(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value.split(",").map((name) => name.trim()).filter((name) => ALLOWED_POPULATE.has(name));
}

/**
 * The caller's `populate` limited to ALLOWED_REQUEST_READ_POPULATE, or undefined when nothing allowed remains. It
 * accepts the string, comma list, array and object forms; `*`, a dotted path, every other key and any nested
 * populate are dropped, so an allowed relation is populated one level deep and reaches no person through it.
 */
export function filterRequestReadPopulate(populate: unknown): unknown {
  let names: string[];
  if (Array.isArray(populate)) names = populate.flatMap(allowedNames);
  else if (isRecord(populate)) {
    names = Object.entries(populate)
      .filter(([name, value]) => ALLOWED_POPULATE.has(name) && value !== false && value !== "false")
      .map(([name]) => name);
  } else names = allowedNames(populate);
  const unique = [...new Set(names)];
  return unique.length === 0 ? undefined : unique;
}

/** The request's people relations, each read as PERSON_FIELDS only (D-04). */
export const REQUEST_PEOPLE_POPULATE = {
  requestor: { fields: [...PERSON_FIELDS] },
  revertedBy: { fields: [...PERSON_FIELDS] },
  assignedAnalyst: { fields: [...PERSON_FIELDS] },
  assignedBy: { fields: [...PERSON_FIELDS] },
} as const;

/** What the Requestor sees of a request's assignment (D-17): the assignee's display name, or nobody. */
export function projectRequestorAssignment(assignee: unknown): { assignee: { displayName: string } | null } {
  const person = projectPerson(assignee);
  return { assignee: person === null ? null : { displayName: person.displayName } };
}
