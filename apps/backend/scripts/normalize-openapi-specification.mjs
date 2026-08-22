import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const specificationPath = resolve(dirname(fileURLToPath(import.meta.url)), "../specification.json");
const generatedDateTimeDefault = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function normalizeGeneratedDefaults(value) {
  if (Array.isArray(value)) return value.map(normalizeGeneratedDefaults);
  if (!value || typeof value !== "object") return value;

  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, normalizeGeneratedDefaults(entry)]),
  );

  if (
    typeof normalized.default === "string" &&
    generatedDateTimeDefault.test(normalized.default) &&
    normalized.description === "A datetime field"
  ) {
    delete normalized.default;
  }

  return normalized;
}

const specification = JSON.parse(await readFile(specificationPath, "utf8"));
await writeFile(specificationPath, `${JSON.stringify(normalizeGeneratedDefaults(specification), null, 2)}\n`);
console.log("Normalized generated OpenAPI datetime defaults.");
