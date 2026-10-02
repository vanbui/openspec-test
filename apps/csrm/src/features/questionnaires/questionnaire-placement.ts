/*
 * Where an analyst's added or moved question goes (10-CONTEXT D-05, UI-SPEC §1.3). Skeleton: it still places
 * every question the way the editor does today, in section `general` at order 0.
 */

export type PlacementSection = { key: string; title: string; description?: string; order: number };

export type QuestionPlacement = {
  documentId: string;
  questionKey: string;
  questionText: string;
  section: PlacementSection;
  order: number;
  removed: boolean;
};

export type SectionChoice = { key: string; label: string; section: PlacementSection };

export type Placement = { section: PlacementSection; order: number };

export function sectionChoices(_placements: readonly QuestionPlacement[]): SectionChoice[] {
  return [];
}

export function placeInSection(_placements: readonly QuestionPlacement[], _sectionKey: string): Placement | null {
  return { section: { key: 'general', title: 'General', order: 0 }, order: 0 };
}

export function placeInNewSection(_placements: readonly QuestionPlacement[], title: string): Placement {
  return { section: { key: 'general', title, order: 0 }, order: 0 };
}
