/*
 * D-06 (the portable subset, and IN-210): a wire schema sent for structured output uses no keyword some endpoints refuse,
 * holds at most 100 object properties in total (over every nested object, not per object) and nests at most five levels,
 * counted at each `properties` and `items`.
 */
export const UNPORTABLE_SCHEMA_KEYWORDS = ["minLength", "maxLength", "minItems", "maxItems", "uniqueItems", "pattern", "format", "const"] as const;

export function walkWireSchema(value: unknown, depth = 0): { forbidden: string[]; properties: number; depth: number } {
  if (value === null || typeof value !== "object") return { forbidden: [], properties: 0, depth };
  const row = value as Record<string, unknown>;
  const forbidden = Object.keys(row).filter((key) => (UNPORTABLE_SCHEMA_KEYWORDS as readonly string[]).includes(key));
  let properties = row.type === "object" && row.properties && typeof row.properties === "object" ? Object.keys(row.properties).length : 0;
  let maximum = depth;
  for (const [key, child] of Object.entries(row)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const result = walkWireSchema(item, depth);
        forbidden.push(...result.forbidden); properties += result.properties; maximum = Math.max(maximum, result.depth);
      }
    } else if (child && typeof child === "object") {
      const result = walkWireSchema(child, key === "items" || key === "properties" ? depth + 1 : depth);
      forbidden.push(...result.forbidden); properties += result.properties; maximum = Math.max(maximum, result.depth);
    }
  }
  return { forbidden, properties, depth: maximum };
}
