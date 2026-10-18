const entities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const escape = (value: string): string => value.replace(/[&<>]/g, (character) => entities[character]);

/** Renders external text as data, not prompt markup. */
export function promptDataTag(label: string, value: string): string {
  return `<${label}>${escape(value)}</${label}>`;
}

/* A label or attribute name is a code constant; an attribute value is an integer or a lower-case code value. */
const NAME = /^[a-z][a-zA-Z]*$/;
const CODE_VALUE = /^[a-z0-9-]+$/;
export type PromptDataAttributes = Readonly<Record<string, string | number>>;

/*
 * Phase 14 D-34 (decision 5, G-3): external text as data inside a block whose attributes describe it. Only CSRM writes the
 * attributes, from closed enums and integers, so nothing a person typed (a file name, a display name, a time, an id)
 * can become markup: any other label, name or value throws. The value is escaped exactly as promptDataTag escapes it.
 */
export function promptDataBlock(label: string, attributes: PromptDataAttributes, value: string): string {
  if (!NAME.test(label)) throw new Error("Prompt data label is invalid.");
  const rendered = Object.entries(attributes).map(([name, attribute]) => {
    if (!NAME.test(name)) throw new Error("Prompt data attribute name is invalid.");
    const valid = typeof attribute === "number" ? Number.isSafeInteger(attribute) : typeof attribute === "string" && CODE_VALUE.test(attribute);
    if (!valid) throw new Error("Prompt data attribute value is invalid.");
    return ` ${name}="${attribute}"`;
  }).join("");
  return `<${label}${rendered}>${escape(value)}</${label}>`;
}
