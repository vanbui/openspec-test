export const administrationKinds = ['risk-types', 'controls', 'information-systems', 'information-assets'] as const;
export type AdministrationKind = typeof administrationKinds[number];

export type AdministrationFeatureConfig = {
  kind: AdministrationKind;
  label: string;
  pluralLabel: string;
  /** The record's name inside a sentence (sentence case, X-4 and D-38): `control`, never `Control`; Risk Type keeps its capitals. */
  runningLabel: string;
  runningPluralLabel: string;
  naturalKey: 'name' | 'controlNumber';
  defaultSort: 'name:asc' | 'controlNumber:asc';
  listPath: string;
  importPath: string;
  newPath: string;
  detailPath: (documentId: string) => string;
};

export const administrationConfig = {
  'risk-types': {
    kind: 'risk-types',
    label: 'Risk Type',
    pluralLabel: 'Risk Types',
    runningLabel: 'Risk Type',
    runningPluralLabel: 'Risk Types',
    naturalKey: 'name',
    defaultSort: 'name:asc',
    listPath: '/app/admin/risk-types',
    importPath: '/app/admin/risk-types/import',
    newPath: '/app/admin/risk-types/new',
    detailPath: (documentId: string) => `/app/admin/risk-types/${encodeURIComponent(documentId)}`,
  },
  controls: {
    kind: 'controls',
    label: 'Control',
    pluralLabel: 'Controls',
    runningLabel: 'control',
    runningPluralLabel: 'controls',
    naturalKey: 'controlNumber',
    defaultSort: 'controlNumber:asc',
    listPath: '/app/admin/controls',
    importPath: '/app/admin/controls/import',
    newPath: '/app/admin/controls/new',
    detailPath: (documentId: string) => `/app/admin/controls/${encodeURIComponent(documentId)}`,
  },
  'information-systems': {
    kind: 'information-systems',
    label: 'Information System',
    pluralLabel: 'Information Systems',
    runningLabel: 'information system',
    runningPluralLabel: 'information systems',
    naturalKey: 'name',
    defaultSort: 'name:asc',
    listPath: '/app/admin/information-systems',
    importPath: '/app/admin/information-systems/import',
    newPath: '/app/admin/information-systems/new',
    detailPath: (documentId: string) => `/app/admin/information-systems/${encodeURIComponent(documentId)}`,
  },
  'information-assets': {
    kind: 'information-assets',
    label: 'Information Asset',
    pluralLabel: 'Information Assets',
    runningLabel: 'information asset',
    runningPluralLabel: 'information assets',
    naturalKey: 'name',
    defaultSort: 'name:asc',
    listPath: '/app/admin/information-assets',
    importPath: '/app/admin/information-assets/import',
    newPath: '/app/admin/information-assets/new',
    detailPath: (documentId: string) => `/app/admin/information-assets/${encodeURIComponent(documentId)}`,
  },
} as const satisfies Record<AdministrationKind, AdministrationFeatureConfig>;

export function getAdministrationConfig(kind: unknown): AdministrationFeatureConfig {
  if (typeof kind !== 'string' || !administrationKinds.includes(kind as AdministrationKind)) throw new Error('Unsupported CSRM Administration collection.');
  return administrationConfig[kind as AdministrationKind];
}

/** How long a list search or a Control search waits after the last keystroke before it runs. */
export const administrationSearchDelayMs = 700;
