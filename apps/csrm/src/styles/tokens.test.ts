import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const appRoot = resolve(__dirname, '../..');
const readAppFile = (relativePath: string) => readFileSync(resolve(appRoot, relativePath), 'utf8');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.[jt]sx?$/.test(entry.name) ? [entryPath] : [];
  });
}

const expectedTokens = {
  light: {
    background: '#F7FAFC',
    foreground: '#17212B',
    surface: '#FFFFFF',
    'surface-muted': '#EDF4F6',
    'border-subtle': '#D7E2E8',
    primary: '#075E9B',
    'primary-foreground': '#FFFFFF',
    'primary-soft': '#E4F1F8',
    accent: '#087F8C',
    'focus-ring': '#0B73C9',
    success: '#16794D',
    warning: '#9A5B00',
    destructive: '#B42318',
    info: '#075E9B',
    'risk-low': '#16794D',
    'risk-medium': '#9A5B00',
    'risk-high': '#C2410C',
    'risk-critical': '#B42318',
  },
  dark: {
    background: '#0B1220',
    foreground: '#E6EDF3',
    surface: '#131E2A',
    'surface-muted': '#1C2A38',
    'border-subtle': '#2D4152',
    primary: '#4EA7E8',
    'primary-foreground': '#06111B',
    'primary-soft': '#17354A',
    accent: '#36BFC1',
    'focus-ring': '#7BC5F5',
    success: '#55C58A',
    warning: '#F0B45B',
    destructive: '#F28B82',
    info: '#4EA7E8',
    'risk-low': '#55C58A',
    'risk-medium': '#F0B45B',
    'risk-high': '#FB923C',
    'risk-critical': '#F28B82',
  },
} as const;

function sectionFor(css: string, selector: ':root' | '.dark') {
  const match = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  expect(match, `Expected ${selector} token declarations`).toBeTruthy();
  return match?.[1] ?? '';
}

function token(section: string, name: string) {
  const match = section.match(new RegExp(`--${name}:\\s*(#[0-9A-F]{6});`, 'i'));
  expect(match, `Expected --${name} token`).toBeTruthy();
  return match?.[1] ?? '';
}

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('CSRM semantic token foundation', () => {
  const css = readAppFile('src/app/globals.css');

  it.each([
    ['light', ':root'],
    ['dark', '.dark'],
  ] as const)('declares the exact %s semantic token palette with accessible core pairs', (theme, selector) => {
    const section = sectionFor(css, selector);

    for (const [name, value] of Object.entries(expectedTokens[theme])) {
      expect(token(section, name)).toBe(value);
    }

    expect(contrast(token(section, 'foreground'), token(section, 'background'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(section, 'primary-foreground'), token(section, 'primary'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(section, 'focus-ring'), token(section, 'background'))).toBeGreaterThanOrEqual(3);
    expect(contrast(token(section, 'success'), token(section, 'background'))).toBeGreaterThanOrEqual(4.5);
  });

  it('maps semantic tokens to Tailwind utilities and preserves global accessibility defaults', () => {
    expect(css).toContain('@custom-variant dark');
    expect(css).toContain('--color-background: var(--background)');
    expect(css).toContain('--color-primary: var(--primary)');
    expect(css).toContain('--color-focus-ring: var(--focus-ring)');
    expect(css).toContain('--radius-card: 8px');
    expect(css).toContain('--duration-standard: 150ms');
    expect(css).toContain('--duration-drawer: 200ms');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('outline: 2px solid var(--focus-ring)');
    expect(css).toContain('overflow-wrap: anywhere');
  });

  it('uses only the declared semantic typography sizes in application source', () => {
    const undeclaredTextSize = /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g;
    const violations = sourceFiles(resolve(appRoot, 'src')).flatMap((filePath) => {
      const matches = readFileSync(filePath, 'utf8').match(undeclaredTextSize) ?? [];
      return matches.map((utility) => `${filePath.slice(appRoot.length + 1)}: ${utility}`);
    });

    expect(violations).toEqual([]);
  });

  it('renders dashboard copy through semantic classes without hard-coded colours', () => {
    const page = readAppFile('src/app/page.tsx');
    const dashboard = readAppFile('src/features/requests/request-dashboard.tsx');

    expect(page).toContain('Dashboard');
    expect(page).toContain('Review your current cyber risk assessment request work.');
    expect(dashboard).toContain('Needs your attention');
    expect(dashboard).toMatch(/className="[^"]*(?:bg-|text-|border-)/);
    expect(`${page}\n${dashboard}`).not.toMatch(/#[0-9a-fA-F]{3,8}|(?:red|blue|green|teal|slate|gray|zinc|neutral)-\d{2,3}/);
  });

  it('exposes only the CSRM button variants and touch-size contract', () => {
    const button = readAppFile('src/components/ui/button.tsx');
    const card = readAppFile('src/components/ui/card.tsx');

    for (const variant of ['primary', 'secondary', 'ghost', 'destructive']) {
      expect(button).toMatch(new RegExp(`${variant}:`));
    }
    for (const size of ['sm', 'md', 'icon']) {
      expect(button).toMatch(new RegExp(`${size}:`));
    }
    expect(button).toContain('min-h-9');
    expect(button).toContain('min-h-10');
    expect(button).toContain('md:size-10');
    expect(button).toContain('size-11');
    expect(button).toContain('focus-visible:outline-2');
    expect(button).toContain('data-slot="button"');
    expect(card).toContain('rounded-[var(--radius-card)]');
    expect(card).toContain('border-border-subtle');
    expect(card).toContain('data-slot="card"');
  });
});
