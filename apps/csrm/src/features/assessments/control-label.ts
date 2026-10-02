/*
 * The control label rule (D-36, D-42, D-43; UI-SPEC §16.1). One zod-free function names a control
 * everywhere Phase 10 shows one, so the browser routes that render it download no zod.
 *
 * 1. The number is the stored control number, trimmed.
 * 2. The title is the stored name, trimmed, without a leading copy of the number joined by a spaced
 *    em dash, en dash or hyphen, a spaced middle dot or a colon (the seed writes `{id} — {label}`).
 * 3. A title that is neither empty nor the number itself follows the number: `{number} · {title}`.
 * 4. Otherwise the framework follows (`{number} · {framework}`), or the number stands alone where
 *    the served shape carries no framework.
 */

import type { RelationPickerItem } from '@/components/csrm/relation-picker';

export type ControlTitleSource = {
  readonly controlNumber: string;
  readonly name: string;
};

export type ControlLabelSource = ControlTitleSource & {
  readonly framework?: string | null;
};

/** X-4: a spaced middle dot joins an identifier to its name or to a second fact. */
const SEPARATOR = ' · ';

function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The control's title without its number, or null when the control has no title of its own. */
export function controlTitle(control: ControlTitleSource): string | null {
  const number = control.controlNumber.trim();
  let title = control.name.trim();
  if (number.length > 0) {
    const prefix = new RegExp(`^${escapeForPattern(number)}(?:\\s+[—–-]\\s*|\\s+·\\s*|\\s*:\\s*)`, 'u');
    title = title.replace(prefix, '').trim();
  }
  return title.length > 0 && title !== number ? title : null;
}

/** The label that names a control: its number once, then its title, else its framework. */
export function controlLabel(control: ControlLabelSource): string {
  const number = control.controlNumber.trim();
  const title = controlTitle(control);
  if (title) return `${number}${SEPARATOR}${title}`;
  const framework = control.framework?.trim();
  return framework ? `${number}${SEPARATOR}${framework}` : number;
}

export type ControlPickerSource = ControlLabelSource & {
  readonly documentId: string;
  readonly framework: string;
};

/**
 * A control as a record picker option or selection (UI-SPEC §13.1, §16.2): named by its label, with the
 * framework, as stored, on a second line when the label shows the title rather than the framework.
 */
export function controlPickerItem(control: ControlPickerSource): RelationPickerItem {
  const name = controlLabel(control);
  const framework = control.framework.trim();
  return controlTitle(control) && framework
    ? { documentId: control.documentId, name, detail: framework }
    : { documentId: control.documentId, name };
}
