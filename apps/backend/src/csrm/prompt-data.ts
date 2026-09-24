const entities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

/** Renders external text as data, not prompt markup. */
export function promptDataTag(label: string, value: string): string {
  return `<${label}>${value.replace(/[&<>]/g, (character) => entities[character])}</${label}>`;
}
