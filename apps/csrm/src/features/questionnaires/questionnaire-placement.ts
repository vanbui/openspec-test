/*
 * Where an analyst's added or moved question goes (10-CONTEXT D-05, UI-SPEC §1.3).
 *
 * Strapi checks a questionnaire's whole definition on every change, removed questions included
 * (`questionnaire-definition.ts`): each section order belongs to one section key, every question in a section
 * carries identical section metadata, and `{section key}:{order}` is unique. Placement is therefore computed
 * from the complete set the analyst read serves, never from the active questions alone:
 * - an existing section is sent with its stored `{ key, title, description?, order }` unchanged;
 * - a new section gets a key unused by any question and the next free section order;
 * - the question gets the next free order within its section.
 * Strapi still validates every placement and refuses a clash with `DEFINITION_CONFLICT`.
 *
 * This module stays zod-free (it imports nothing) so the client editor can use it.
 */

export type PlacementSection = { key: string; title: string; description?: string; order: number };

/** One question as placement sees it: where it sits, and whether it has been removed. */
export type QuestionPlacement = {
  documentId: string;
  questionKey: string;
  questionText: string;
  section: PlacementSection;
  order: number;
  removed: boolean;
};

/** A section the question form offers, labelled for its `Section` select. */
export type SectionChoice = { key: string; label: string; section: PlacementSection };

export type Placement = { section: PlacementSection; order: number };

/** The section key bound the question mutation accepts. */
const SECTION_KEY_MAX_LENGTH = 120;

function storedSection(section: PlacementSection): PlacementSection {
  return { key: section.key, title: section.title, ...(section.description !== undefined ? { description: section.description } : {}), order: section.order };
}

/**
 * The sections that still hold an active question, in section order, labelled by title. Two sections with the
 * same title read `{title} (section {n})`, `n` being the section's position in the list (UI-SPEC §1.2).
 */
export function sectionChoices(placements: readonly QuestionPlacement[]): SectionChoice[] {
  const sections = new Map<string, PlacementSection>();
  for (const placement of placements) {
    if (!placement.removed && !sections.has(placement.section.key)) sections.set(placement.section.key, storedSection(placement.section));
  }
  const ordered = [...sections.values()].sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
  const titleCounts = new Map<string, number>();
  for (const section of ordered) titleCounts.set(section.title, (titleCounts.get(section.title) ?? 0) + 1);
  return ordered.map((section, index) => ({
    key: section.key,
    label: (titleCounts.get(section.title) ?? 0) > 1 ? `${section.title} (section ${index + 1})` : section.title,
    section,
  }));
}

/** An existing section's stored metadata and the next free order in it, counting removed questions; null when no question holds the key. */
export function placeInSection(placements: readonly QuestionPlacement[], sectionKey: string): Placement | null {
  const inSection = placements.filter((placement) => placement.section.key === sectionKey);
  if (inSection.length === 0) return null;
  const metadata = inSection.find((placement) => !placement.removed) ?? inSection[0]!;
  return { section: storedSection(metadata.section), order: Math.max(...inSection.map((placement) => placement.order)) + 1 };
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function trimHyphens(value: string): string {
  return value.replace(/-+$/, '');
}

/** A new section titled `title`: `section-{slug}` (or `section`), numbered until no question holds it, at the next free section order. */
export function placeInNewSection(placements: readonly QuestionPlacement[], title: string): Placement {
  const trimmed = title.trim();
  const derived = slug(trimmed);
  const base = derived ? `section-${derived}` : 'section';
  const taken = new Set(placements.map((placement) => placement.section.key));
  let key = trimHyphens(base.slice(0, SECTION_KEY_MAX_LENGTH));
  for (let n = 2; taken.has(key); n += 1) {
    const suffix = `-${n}`;
    key = `${trimHyphens(base.slice(0, SECTION_KEY_MAX_LENGTH - suffix.length))}${suffix}`;
  }
  const order = placements.reduce((highest, placement) => Math.max(highest, placement.section.order), -1) + 1;
  return { section: { key, title: trimmed, order }, order: 0 };
}
