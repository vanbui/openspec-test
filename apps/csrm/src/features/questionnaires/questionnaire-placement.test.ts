import { describe, expect, it } from 'vitest';

import { placeInNewSection, placeInSection, sectionChoices, type PlacementSection, type QuestionPlacement } from './questionnaire-placement';

/*
 * Placement over the complete question set, removed questions included (10-CONTEXT D-05, UI-SPEC §1.3). Strapi's
 * definition check (questionnaire-definition.ts) counts every question: one key per section order, identical
 * section metadata per key, and a unique `{section key}:{order}`. The three shapes below are the ones a
 * questionnaire really has: the hosted provider's `section-N` from order 0, the deterministic provider's
 * `context` at 0, and the seeded questionnaires' sections from order 1.
 */

function question(questionKey: string, section: PlacementSection, order: number, removed = false): QuestionPlacement {
  return { documentId: `doc-${questionKey}`, questionKey, questionText: `Question ${questionKey}?`, section, order, removed };
}

const hostedScope = { key: 'section-1', title: 'Service scope', order: 0 };
const hostedData = { key: 'section-2', title: 'Data handling', description: 'How the service treats personal data.', order: 1 };
const hosted = [
  question('q-1', hostedScope, 0),
  question('q-2', hostedScope, 1),
  question('q-3', hostedScope, 2, true),
  question('q-4', hostedData, 0),
  question('q-5', hostedData, 1),
];

const requestContext = { key: 'context', title: 'Request context', order: 0 };
const thirdParty = { key: 'third-party', title: 'Third-party involvement', order: 1 };
const deterministic = [
  question('security-objectives', requestContext, 0),
  question('business-criticality', requestContext, 1, true),
  question('third-party-involvement', thirdParty, 0),
  question('third-party-details', thirdParty, 1),
];

const service = { key: 'service', title: 'Service', order: 1 };
const hosting = { key: 'hosting', title: 'Hosting', order: 2 };
const seeded = [
  question('service-name', service, 1),
  question('service-description', service, 2),
  question('production-url', service, 3, true),
  question('hosting-model', hosting, 1),
];

describe('placeInSection', () => {
  it.each([
    ['hosted', hosted, hostedScope, 3],
    ['deterministic', deterministic, requestContext, 2],
    ['seeded', seeded, service, 4],
  ] as const)('places a %s question one past the removed question, keeping the stored section', (_shape, placements, section, order) => {
    expect(placeInSection(placements, section.key)).toEqual({ section, order });
  });

  it('sends the stored section description unchanged', () => {
    expect(placeInSection(hosted, 'section-2')).toEqual({ section: hostedData, order: 2 });
  });

  it('places a question in a section that holds only removed questions one past the highest of them', () => {
    const archived = { key: 'archived', title: 'Archived', order: 3 };
    expect(placeInSection([...seeded, question('old', archived, 4, true)], 'archived')).toEqual({ section: archived, order: 5 });
  });

  it('knows no section the questions do not hold', () => {
    expect(placeInSection(seeded, 'general')).toBeNull();
  });
});

describe('placeInNewSection', () => {
  it.each([
    ['hosted', hosted, 2],
    ['deterministic', deterministic, 2],
    ['seeded', seeded, 3],
  ] as const)('opens a %s questionnaire’s new section at the next free section order', (_shape, placements, sectionOrder) => {
    expect(placeInNewSection(placements, 'Offshore support')).toEqual({
      section: { key: 'section-offshore-support', title: 'Offshore support', order: sectionOrder },
      order: 0,
    });
  });

  it('skips a key a removed question still holds, and the section order it holds', () => {
    const offshore = { key: 'section-offshore-support', title: 'Offshore support', order: 4 };
    const placements = [...seeded, question('removed-offshore', offshore, 0, true)];
    expect(placeInNewSection(placements, 'Offshore support')).toEqual({
      section: { key: 'section-offshore-support-2', title: 'Offshore support', order: 5 },
      order: 0,
    });
  });

  it('counts up past every key already taken', () => {
    const taken = [1, 2, 3].map((n) => ({ key: n === 1 ? 'section-offshore-support' : `section-offshore-support-${n}`, title: 'Offshore support', order: 2 + n }));
    const placements = [...seeded, ...taken.map((section, index) => question(`offshore-${index}`, section, 0))];
    expect(placeInNewSection(placements, 'Offshore support').section.key).toBe('section-offshore-support-4');
  });

  it('trims the title and derives the key from its letters and digits', () => {
    expect(placeInNewSection(seeded, '  Cloud & On-premises (2026)  ').section).toEqual({ key: 'section-cloud-on-premises-2026', title: 'Cloud & On-premises (2026)', order: 3 });
  });

  it('uses `section` when the title has no letters or digits to derive a key from', () => {
    expect(placeInNewSection(seeded, '¿¡ — !?').section.key).toBe('section');
    expect(placeInNewSection([...seeded, question('x', { key: 'section', title: '—', order: 3 }, 0)], '—').section.key).toBe('section-2');
  });

  it('keeps a long title’s key, and its numbered successor, within the 120-character key bound', () => {
    const title = 'Offshore support '.repeat(12);
    const first = placeInNewSection(seeded, title).section;
    expect(first.key.length).toBeLessThanOrEqual(120);
    expect(first.key).toMatch(/^section-offshore-support-offshore/);
    expect(first.key.endsWith('-')).toBe(false);
    const second = placeInNewSection([...seeded, question('long', first, 0)], title).section;
    expect(second.key.length).toBeLessThanOrEqual(120);
    expect(second.key.endsWith('-2')).toBe(true);
    expect(second.key).not.toBe(first.key);
  });

  it('opens the first section of an empty set at order 0', () => {
    expect(placeInNewSection([], 'General')).toEqual({ section: { key: 'section-general', title: 'General', order: 0 }, order: 0 });
  });
});

describe('sectionChoices', () => {
  it.each([
    ['hosted', hosted, [['section-1', 'Service scope'], ['section-2', 'Data handling']]],
    ['deterministic', deterministic, [['context', 'Request context'], ['third-party', 'Third-party involvement']]],
    ['seeded', seeded, [['service', 'Service'], ['hosting', 'Hosting']]],
  ] as const)('lists a %s questionnaire’s sections by title in section order', (_shape, placements, expected) => {
    expect(sectionChoices([...placements].reverse()).map(({ key, label }) => [key, label])).toEqual(expected);
  });

  it('offers only sections that still have an active question, with their stored metadata', () => {
    const archived = { key: 'archived', title: 'Archived', order: 3 };
    const choices = sectionChoices([...hosted, question('old', archived, 0, true)]);
    expect(choices.map(({ key }) => key)).toEqual(['section-1', 'section-2']);
    expect(choices[1]?.section).toEqual(hostedData);
  });

  it('tells two sections with the same title apart by their position', () => {
    const general = { key: 'general', title: 'General', order: 0 };
    const later = { key: 'section-general', title: 'General', order: 3 };
    const choices = sectionChoices([...seeded, question('g-1', general, 0), question('g-2', later, 0)]);
    expect(choices.map(({ label }) => label)).toEqual(['General (section 1)', 'Service', 'Hosting', 'General (section 4)']);
  });

  it('offers nothing when every question has been removed', () => {
    expect(sectionChoices(seeded.map((placement) => ({ ...placement, removed: true })))).toEqual([]);
  });
});
