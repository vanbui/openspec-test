import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { statusPresentation } from '@/components/csrm/status-badge';
import { alertKindLabels, alertUrgencyLabels } from '@/features/alerts/alert-presentation';
import { reportCopy, reportKeys } from '@/features/reports/report-copy';
import { reportSectionCopy, treatmentStatusColumns } from '@/features/reports/report-presentation';
import { requestHolderPresentation } from '@/features/requests/request-domain';
import { riskRegisterStageLabels, riskRegisterStateLabels, riskTreatmentDueStateLabels } from '@/features/risks/risk-domain';

import { exportLabel, exportReport, exportViewColumns, exportViewMeta, exportVocabulary, importColumns } from './export-vocabulary';

/*
 * The web's copy of the one export vocabulary (19-04; D-06, D-07, D-31, D-33). It is byte-identical to Strapi's, its
 * labels equal the web's one status mapping family by family, each view's visible headers are the headers its list
 * shows, and each report's tables are the tables its page renders. Drift on either side fails here.
 */

const webPath = resolve(process.cwd(), 'src/features/exports/export-vocabulary.json');
const strapiPath = resolve(process.cwd(), '../backend/src/csrm/exports/export-vocabulary.json');
const source = (file: string) => readFileSync(resolve(process.cwd(), 'src', file), 'utf8');

function labelsOf<T extends Record<string, { label: string }>>(family: T): Record<string, string> {
  return Object.fromEntries(Object.entries(family).map(([value, presentation]) => [value, presentation.label]));
}

/** Each family, and the web mapping it must equal (decision 16: approved reads Released). */
const FAMILY_PARITY: Record<string, Record<string, string>> = {
  requestStatus: labelsOf(statusPresentation.request),
  questionnaireStatus: labelsOf(statusPresentation.questionnaire),
  assessmentStatus: labelsOf(statusPresentation.assessment),
  treatmentStatus: labelsOf(statusPresentation.treatment),
  treatmentDueState: { ...riskTreatmentDueStateLabels },
  riskStage: { ...riskRegisterStageLabels },
  riskState: { ...riskRegisterStateLabels },
  requestHolder: labelsOf(requestHolderPresentation),
  alertKind: { ...alertKindLabels },
  alertUrgency: { ...alertUrgencyLabels },
};

/** The list component each view mirrors: its visible labels are that component's `header:` values. */
const VIEW_COMPONENTS: Record<string, string> = {
  'risk-register': 'features/risks/risk-register.tsx',
  requests: 'features/assessments/assessment-list.tsx',
  'risk-assessments': 'features/assessments/assessment-list.tsx',
  questionnaires: 'features/questionnaires/questionnaire-review-list.tsx',
  'my-questionnaires': 'features/questionnaires/questionnaire-list.tsx',
  alerts: 'features/alerts/alert-list.tsx',
  'my-requests': 'features/requests/request-table.tsx',
  'my-risk-assessments': 'features/assessments/released-assessment.tsx',
};

/**
 * The administration list's headers per collection (administration-workspace.tsx). Each is one export column, except
 * `Sensitive-data flags`, which the export writes as its three flags, one value per cell (D-06).
 */
const REFERENCE_HEADERS: Record<string, readonly string[]> = {
  'risk-types': ['Name', 'Description', 'Applicable controls'],
  controls: ['Control number', 'Name', 'Framework', 'Type', 'Reference'],
  'information-systems': ['Name', 'Owner', 'Business criticality', 'Type', 'Environment', 'Deployment model', 'Lifecycle', 'Internet-facing'],
  'information-assets': ['Name', 'Type', 'Classification', 'Location'],
};

/** Each report's tables: the report section each renders as a ReportTable, in page order. */
const REPORT_SECTIONS: Record<string, readonly (keyof typeof reportSectionCopy)[]> = {
  'risk-exposure': ['ratings', 'residualByTreatmentStatus', 'exposedSystems', 'underAssessment'],
  'treatment-performance': ['dueState', 'treatmentStatus'],
  'assessment-throughput': ['releasedPerMonth', 'requestLifecycle'],
  'control-effectiveness': ['implementationStatus', 'effectivenessRating'],
};

const kebab = (value: string) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

describe('the export vocabulary (web copy)', () => {
  it('is byte-identical to the Strapi vocabulary', () => {
    expect(readFileSync(webPath).equals(readFileSync(strapiPath))).toBe(true);
  });

  it('label parity: every family maps each stored value to the label the web’s one mapping shows', () => {
    expect(Object.keys(exportVocabulary.labels).sort()).toEqual(Object.keys(FAMILY_PARITY).sort());
    for (const [family, labels] of Object.entries(FAMILY_PARITY)) {
      expect(exportVocabulary.labels[family], family).toEqual(labels);
    }
    expect(exportLabel('requestStatus', 'approved')).toBe('Released');
    expect(exportLabel('assessmentStatus', 'approved')).toBe('Released');
    expect(exportLabel('riskState', 'withdrawn')).toBe('Withdrawn');
  });

  it('each list view’s visible labels are headers its list component shows', () => {
    for (const [view, file] of Object.entries(VIEW_COMPONENTS)) {
      const text = source(file);
      for (const column of exportViewColumns(view).filter((entry) => entry.visible)) {
        expect(text, `${view}: ${column.label}`).toContain(`header: '${column.label}'`);
      }
    }
  });

  it('each reference view holds every header its administration list shows', () => {
    const text = source('features/administration/administration-workspace.tsx');
    for (const [view, headers] of Object.entries(REFERENCE_HEADERS)) {
      const labels = exportViewColumns(view).map((column) => column.label);
      for (const header of headers) {
        expect(text).toContain(`header: '${header}'`);
        expect(labels, `${view}: ${header}`).toContain(header);
      }
    }
    expect(exportViewColumns('information-assets').map((column) => column.label)).toEqual(
      expect.arrayContaining(['Contains personal data', 'Contains legal data', 'Contains credit card data']),
    );
  });

  it('each report’s tables are the tables its page renders, with the section captions and columns', () => {
    expect(Object.keys(exportVocabulary.reports).sort()).toEqual([...reportKeys].sort());
    for (const key of reportKeys) {
      const report = exportReport(key);
      expect(report.heading).toBe(reportCopy(key).title);
      expect(report.slug).toBe(`${key}-report`);
      const sections = REPORT_SECTIONS[key];
      expect(report.tables.map((table) => table.key)).toEqual(sections.map(kebab));
      report.tables.forEach((table, index) => {
        const section = reportSectionCopy[sections[index]] as { caption: string; rowHeader: string; columns?: readonly string[] };
        const columns = section.columns ?? treatmentStatusColumns.map((column) => column.label);
        expect(table.heading, table.key).toBe(section.caption);
        expect(table.columns.map((column) => column.label), table.key).toEqual([section.rowHeader, ...columns]);
      });
    }
  });

  it('serves the register’s visible columns first and its meta, from a module safe for client components', () => {
    const columns = exportViewColumns('risk-register');
    const firstHidden = columns.findIndex((column) => !column.visible);
    expect(firstHidden).toBeGreaterThan(0);
    expect(columns.slice(firstHidden).every((column) => !column.visible)).toBe(true);
    expect(exportViewMeta('risk-register')).toMatchObject({ slug: 'risk-register', heading: 'Risk register', records: 'risks' });
    expect(importColumns('controls').naturalKey).toBe('controlNumber');
    const module = source('features/exports/export-vocabulary.ts');
    expect(module).not.toMatch(/from ['"]zod['"]/);
    expect(module).not.toMatch(/server-only/);
  });
});
