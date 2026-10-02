import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { controlLabel, controlTitle } from './control-label';

const isoFramework = 'ISO/IEC 27001 Information security management systems — Annex A';

describe('the control label rule (D-36, UI-SPEC §16.1)', () => {
  it('names an untitled control by its number and framework (D-42)', () => {
    expect(controlLabel({ controlNumber: '5.1', name: '5.1', framework: isoFramework }))
      .toBe('5.1 · ISO/IEC 27001 Information security management systems — Annex A');
  });

  it('shows the number once when the stored name repeats it before a spaced em dash', () => {
    expect(controlLabel({
      controlNumber: 'ACCESS-1a',
      name: 'ACCESS-1a — Establish Identities and Manage Authentication',
      framework: 'Essential Eight',
    })).toBe('ACCESS-1a · Establish Identities and Manage Authentication');
    expect(controlLabel({
      controlNumber: 'APP-11',
      name: 'APP-11 — Security of personal information',
      framework: 'Australian Privacy Principles',
    })).toBe('APP-11 · Security of personal information');
  });

  it.each([
    ['an en dash', 'A.8.1 – User endpoint devices'],
    ['a spaced hyphen', 'A.8.1 - User endpoint devices'],
    ['a spaced middle dot', 'A.8.1 · User endpoint devices'],
    ['a colon', 'A.8.1: User endpoint devices'],
  ])('strips a number prefix joined by %s', (_separator, name) => {
    expect(controlLabel({ controlNumber: 'A.8.1', name, framework: 'ISO/IEC 27001' })).toBe('A.8.1 · User endpoint devices');
    expect(controlTitle({ controlNumber: 'A.8.1', name })).toBe('User endpoint devices');
  });

  it('keeps a title that only begins with the same characters as the number', () => {
    // ACCESS-1 is not a prefix of ACCESS-1a's title: no separator follows it.
    expect(controlLabel({ controlNumber: 'ACCESS-1', name: 'ACCESS-1a overview', framework: 'Essential Eight' }))
      .toBe('ACCESS-1 · ACCESS-1a overview');
  });

  it('trims the stored number, name and framework', () => {
    expect(controlLabel({ controlNumber: ' AC-1 ', name: '  Access control  ', framework: ' NIST ' })).toBe('AC-1 · Access control');
    expect(controlLabel({ controlNumber: ' 5.1 ', name: ' 5.1 ', framework: '  ISO/IEC 27001  ' })).toBe('5.1 · ISO/IEC 27001');
  });

  it('names an untitled control without a framework by its number alone', () => {
    expect(controlLabel({ controlNumber: 'CPS-234-15', name: 'CPS-234-15' })).toBe('CPS-234-15');
    expect(controlLabel({ controlNumber: 'CPS-234-15', name: 'CPS-234-15 — ', framework: null })).toBe('CPS-234-15');
    expect(controlLabel({ controlNumber: 'CPS-234-15', name: '   ', framework: '  ' })).toBe('CPS-234-15');
  });

  it('returns the title part alone, or null for an untitled control', () => {
    expect(controlTitle({ controlNumber: 'APP-11', name: 'APP-11 — Security of personal information' })).toBe('Security of personal information');
    expect(controlTitle({ controlNumber: 'AC-1', name: 'Access control' })).toBe('Access control');
    expect(controlTitle({ controlNumber: '5.1', name: '5.1' })).toBeNull();
    expect(controlTitle({ controlNumber: '5.1', name: '5.1 — ' })).toBeNull();
  });

  it('stays free of zod so the browser routes that name controls download none', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/assessments/control-label.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]zod['"]/);
    expect(source).not.toMatch(/from ['"]\.\/assessment-schema['"]/);
  });
});
