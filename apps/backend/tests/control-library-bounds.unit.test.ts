import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createControlSeeds, readControlLibrary, type ControlSeed } from "../src/bootstrap/seed-csrm-data";

/*
 * The Controls contract bounds every control field the Administration record serves
 * (`ControlsAdministrationRecord` in docs/references/specification.json: description at 10,000 characters,
 * the reference at 500, the source at 2,000 and the rest at 255). The web's closed parser enforces those
 * bounds, so one seeded control beyond any of them fails every list page and picker page it appears on.
 * Every seeded control, titles applied, satisfies every bound the contract declares.
 */

const appRoot = path.resolve(__dirname, "..", "..", "..");
const specificationPath = path.resolve(appRoot, "..", "..", "docs", "references", "specification.json");

type StringBound = { field: string; minLength?: number; maxLength?: number };

async function controlRecordStringBounds(): Promise<StringBound[]> {
  const specification = JSON.parse(await readFile(specificationPath, "utf8")) as {
    components: { schemas: Record<string, { properties: Record<string, { type: string | string[]; minLength?: number; maxLength?: number }> }> };
  };
  const properties = specification.components.schemas.ControlsAdministrationRecord?.properties;
  assert.ok(properties, "the specification declares ControlsAdministrationRecord");
  return Object.entries(properties)
    .filter(([, schema]) => [schema.type].flat().includes("string") && (schema.minLength !== undefined || schema.maxLength !== undefined))
    .map(([field, schema]) => ({ field, minLength: schema.minLength, maxLength: schema.maxLength }));
}

async function seededLibrary(): Promise<ControlSeed[]> {
  const { catalogues, titles } = await readControlLibrary(appRoot);
  return createControlSeeds(catalogues, titles);
}

test("ADMIN-05 every seeded control satisfies every Controls contract bound", async () => {
  const bounds = await controlRecordStringBounds();
  assert.deepEqual(bounds.map(({ field }) => field).sort(), [
    "controlNumber", "controlReference", "description", "documentId", "framework", "frameworkSource", "frameworkVersion", "name",
  ]);
  const seeds = await seededLibrary();
  assert.equal(seeds.length, 2_646);
  const breaches: string[] = [];
  for (const seed of seeds) {
    for (const { field, minLength, maxLength } of bounds) {
      if (!(field in seed)) continue;
      const value = (seed as Record<string, unknown>)[field];
      if (value === undefined || value === null) continue;
      if (typeof value !== "string") {
        breaches.push(`${seed.controlNumber} ${field} is not text`);
        continue;
      }
      if (maxLength !== undefined && value.length > maxLength) breaches.push(`${seed.controlNumber} ${field} ${value.length} > ${maxLength}`);
      if (minLength !== undefined && value.length < minLength) breaches.push(`${seed.controlNumber} ${field} ${value.length} < ${minLength}`);
      if (value.trim() !== value || value.trim().length === 0) breaches.push(`${seed.controlNumber} ${field} is blank or untrimmed`);
    }
  }
  assert.deepEqual(breaches, []);
});

/*
 * APP 13 is five subclauses (13.1 to 13.5). The catalogue's extraction ran on past the end of Schedule 1 and
 * appended the whole of Schedule 2 and the compilation's endnotes, 98,415 characters that are not APP 13.
 * The curated description keeps APP 13's own paragraphs, verbatim, and nothing after them.
 */
test("ADMIN-05 APP-13 keeps its own five subclauses and nothing after the end of Schedule 1", async () => {
  const app13 = (await seededLibrary()).find((seed) => seed.controlNumber === "APP-13");
  assert.ok(app13, "APP-13 is seeded");
  const description = String(app13.description);
  assert.ok(description.startsWith("Correction 13.1 If: (a) an APP entity holds personal information about an individual;"), description.slice(0, 80));
  for (const subclause of ["13.1 If:", "13.2 If:", "13.3 If the APP entity refuses", "13.4 If:", "13.5 If a request is made"]) {
    assert.ok(description.includes(subclause), `APP-13 keeps ${subclause}`);
  }
  assert.ok(description.endsWith("for associating the statement with the personal information (as the case may be)."), description.slice(-80));
  for (const appended of ["Schedule 2", "Statutory Tort", "Endnote"]) {
    assert.equal(description.includes(appended), false, `APP-13 carries no ${appended} text`);
  }
  assert.equal(description.length, 2_558);
  assert.equal(app13.name, "APP-13 — Correction of personal information");
  assert.equal(app13.controlReference, "Schedule 1, APP 13");
});
