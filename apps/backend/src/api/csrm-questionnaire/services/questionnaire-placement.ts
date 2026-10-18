import type { QuestionnaireDefinitionQuestion } from "./questionnaire-definition";

/*
 * Server placement and key allocation for confirmed AI additions (Phase 15 D-13, D-22).
 *
 * The rules equal the browser's (apps/csrm/src/features/questionnaires/questionnaire-placement.ts `placeInSection`
 * and `placeInNewSection`, plan 10-09), because Strapi checks the whole definition, removed questions included, on
 * every change: each section order belongs to one section key, every question in a section carries identical section
 * metadata, and `{section key}:{order}` is unique. So placement reads the complete set, never the active questions
 * alone:
 * - an existing section is used with its stored `{ key, title, description?, order }` unchanged, and the question goes
 *   one past the section's highest order, removed questions counted;
 * - a new section gets a key no question holds and the next free section order, and the question goes at order 0.
 *
 * A confirmation batch may hold several additions, so the allocation also remembers what the batch has taken: orders
 * in a section, new sections (a second addition with the same title, case-insensitive, joins the first one's section)
 * and question keys. Placement never reorders an existing question. The module is pure and imports only the
 * definition types.
 */

export type PlacementSection = { key: string; title: string; description?: string; order: number };
export type Placement = { section: PlacementSection; order: number };
export type AdditionSection = { kind: "existing"; key: string } | { kind: "new"; title: string };

/** What a batch has taken so far: every question key and section, each section's highest order, and the highest section order. */
export type BatchAllocation = {
  readonly questionKeys: Set<string>;
  readonly sections: Map<string, { section: PlacementSection; highestOrder: number; fromActive: boolean }>;
  highestSectionOrder: number;
  /* The batch's new sections, by trimmed lower-case title. */
  readonly newSections: Map<string, string>;
};

/** The section key bound the definition parser accepts. */
const SECTION_KEY_MAX_LENGTH = 120;
/** `questionKeyFromText`'s base bound, leaving room for a numeric suffix inside the 120-character key bound. */
const QUESTION_KEY_BASE_MAX_LENGTH = 110;

function storedSection(section: PlacementSection): PlacementSection {
  return { key: section.key, title: section.title, ...(section.description !== undefined ? { description: section.description } : {}), order: section.order };
}

/**
 * Records every question key (removed included), each section's stored metadata (from its first active question,
 * else its first question) and highest question order (removed included), and the highest section order (removed
 * included; -1 for an empty definition, so its first section is order 0).
 */
export function createBatchAllocation(definition: readonly QuestionnaireDefinitionQuestion[]): BatchAllocation {
  const allocation: BatchAllocation = { questionKeys: new Set(), sections: new Map(), highestSectionOrder: -1, newSections: new Map() };
  for (const question of definition) {
    allocation.questionKeys.add(question.questionKey);
    allocation.highestSectionOrder = Math.max(allocation.highestSectionOrder, question.section.order);
    const active = question.deleted === undefined;
    const entry = allocation.sections.get(question.section.key);
    if (entry === undefined) {
      allocation.sections.set(question.section.key, { section: storedSection(question.section), highestOrder: question.order, fromActive: active });
      continue;
    }
    entry.highestOrder = Math.max(entry.highestOrder, question.order);
    if (active && !entry.fromActive) {
      entry.section = storedSection(question.section);
      entry.fromActive = true;
    }
  }
  return allocation;
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function trimTrailingHyphens(value: string): string {
  return value.replace(/-+$/, "");
}

/**
 * A new section's key: `section-{slug}`, or `section` when the trimmed title has no letter or digit, cut to 120
 * characters with trailing hyphens removed; while a section key is taken, the base is cut shorter by the suffix's
 * length before `-2`, `-3`… is added, so every key fits inside 120 characters.
 */
export function newSectionKey(title: string, taken: ReadonlySet<string>): string {
  const derived = slug(title.trim());
  const base = derived ? `section-${derived}` : "section";
  let key = trimTrailingHyphens(base.slice(0, SECTION_KEY_MAX_LENGTH));
  for (let n = 2; taken.has(key); n += 1) {
    const suffix = `-${n}`;
    key = `${trimTrailingHyphens(base.slice(0, SECTION_KEY_MAX_LENGTH - suffix.length))}${suffix}`;
  }
  return key;
}

/**
 * Where one addition goes, recorded in the allocation so the batch's later additions see it. An existing section
 * that no question holds, or a blank new title, offers no placement (null).
 */
export function placeAddition(allocation: BatchAllocation, section: AdditionSection): Placement | null {
  if (section.kind === "existing") {
    const entry = allocation.sections.get(section.key);
    if (entry === undefined) return null;
    entry.highestOrder += 1;
    return { section: storedSection(entry.section), order: entry.highestOrder };
  }
  const title = section.title.trim();
  if (title.length === 0) return null;
  const reused = allocation.newSections.get(title.toLowerCase());
  if (reused !== undefined) return placeAddition(allocation, { kind: "existing", key: reused });
  const key = newSectionKey(title, new Set(allocation.sections.keys()));
  allocation.highestSectionOrder += 1;
  const placed: PlacementSection = { key, title, order: allocation.highestSectionOrder };
  allocation.sections.set(key, { section: placed, highestOrder: 0, fromActive: true });
  allocation.newSections.set(title.toLowerCase(), key);
  return { section: storedSection(placed), order: 0 };
}

/**
 * A question key from its text by the governance workflow's rule (`questionKeyFromText`): lower case, every run of
 * other characters a hyphen, leading and trailing hyphens trimmed, cut to 110 characters, `question` when empty, then
 * `-2`, `-3`… until no question (removed included) and no earlier allocation in the batch holds it. The key is recorded.
 */
export function allocateQuestionKey(text: string, allocation: BatchAllocation): string {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, QUESTION_KEY_BASE_MAX_LENGTH) || "question";
  for (let suffix = 1; ; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    if (!allocation.questionKeys.has(candidate)) {
      allocation.questionKeys.add(candidate);
      return candidate;
    }
  }
}
