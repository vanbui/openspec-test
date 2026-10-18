import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directionReference = 'docs/design/csrm-design-direction.md';
const specifications = [
  {
    label: 'Phase 01 UI specification',
    path: '.planning/workstreams/csrm/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md',
  },
  {
    label: 'Phase 06 UI specification',
    path: '.planning/workstreams/csrm/phases/06-administration-and-csv-imports/06-UI-SPEC.md',
  },
];

function colorSections(specification) {
  const sections = [];
  let currentSection = null;

  for (const line of specification.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      if (currentSection !== null) {
        sections.push(currentSection.join('\n'));
        currentSection = null;
      }

      if (line.startsWith('## Color')) {
        currentSection = [];
      }
    } else if (currentSection !== null) {
      currentSection.push(line);
    }
  }

  if (currentSection !== null) {
    sections.push(currentSection.join('\n'));
  }

  return sections;
}

function hasDuplicateColorValue(section) {
  return /`--[a-z0-9-]+`[^\n]*`?\(\s*`?#[0-9a-f]{6}`?\s*\)/i.test(section);
}

export function verifyDesignSpecAuthority(repositoryRoot) {
  const directionPath = join(repositoryRoot, directionReference);
  if (!existsSync(directionPath)) {
    throw new Error(`Design direction is missing: ${directionReference}`);
  }

  readFileSync(directionPath, 'utf8');

  for (const specification of specifications) {
    const specificationPath = join(repositoryRoot, specification.path);
    if (!existsSync(specificationPath)) {
      throw new Error(`${specification.label} is missing: ${specification.path}`);
    }

    const contents = readFileSync(specificationPath, 'utf8');
    const sections = colorSections(contents);
    if (!sections.some((section) => section.includes(directionReference))) {
      throw new Error(`${specification.label} Color section must reference ${directionReference}`);
    }

    if (sections.some(hasDuplicateColorValue)) {
      throw new Error(`${specification.label} contains a duplicate semantic colour token/hexadecimal value pairing`);
    }
  }
}

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = join(dirname(scriptPath), '..', '..', '..');

try {
  verifyDesignSpecAuthority(repositoryRoot);
  console.log('Design-spec authority check passed.');
} catch (error) {
  console.error(`Design-spec authority check failed: ${error.message}`);
  process.exitCode = 1;
}
