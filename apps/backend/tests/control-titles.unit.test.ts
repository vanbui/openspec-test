import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  createControlSeeds,
  parseControlTitles,
  readControlLibrary,
  type ControlCatalogue,
  type ControlSeed,
} from "../src/bootstrap/seed-csrm-data";

/*
 * D-46 (operator decision 15): every seeded control whose catalogue gives no label takes a title from the
 * CSRM title file beside the vendored catalogues. Annex A controls carry the standard's own control names
 * and no control text; the stored name keeps the `{number} — {title}` form the D-36 label rule reads.
 */

const appRoot = path.resolve(__dirname, "..", "..", "..");
const TITLE_FILE = "csrm-control-titles.json";
const ISO_FILE = "iso-iec-27001-2022-annex-a.json";
const PRIVACY_FILE = "privacy-act-app-ndb-2026-06-04.json";
const CPS_234_FILE = "apra-cps-234-2019.json";

type ControlLibrary = { catalogues: ControlCatalogue[]; titles: Map<string, string> };

let libraryPromise: Promise<ControlLibrary> | undefined;

function library(): Promise<ControlLibrary> {
  return (libraryPromise ??= readControlLibrary(appRoot));
}

async function titledSeeds(): Promise<ControlSeed[]> {
  const { catalogues, titles } = await library();
  return createControlSeeds(catalogues, titles);
}

function seedsFrom(seeds: ControlSeed[], sourceFile: string): ControlSeed[] {
  return seeds.filter((seed) => seed.sourceData.sourceFile === sourceFile);
}

function seedFor(seeds: ControlSeed[], controlNumber: string): ControlSeed {
  const seed = seeds.find((candidate) => candidate.controlNumber === controlNumber);
  assert.ok(seed, `${controlNumber} is seeded`);
  return seed;
}

test("ADMIN-05 D-46 an Annex A control carries the standard's control name", async () => {
  const seeds = await titledSeeds();
  assert.equal(seedFor(seeds, "5.1").name, "5.1 — Policies for information security");
  assert.equal(seedFor(seeds, "8.11").name, "8.11 — Data masking");
  assert.equal(seedFor(seeds, "8.34").name, "8.34 — Protection of information systems during audit testing");
});

test("ADMIN-05 D-46 every Annex A control is named, by theme, and none carries ISO text", async () => {
  const annexA = seedsFrom(await titledSeeds(), ISO_FILE);
  assert.equal(annexA.length, 93);
  const byTheme = new Map<string, number>();
  for (const seed of annexA) {
    assert.ok(seed.name.startsWith(`${seed.controlNumber} — `), `${seed.controlNumber} is named: ${seed.name}`);
    assert.ok(seed.name.length > `${seed.controlNumber} — `.length + 2, `${seed.controlNumber} has a title`);
    assert.equal(seed.description, undefined, `${seed.controlNumber} carries no ISO control text`);
    assert.equal((seed.sourceData.control as { statement: unknown }).statement, null, `${seed.controlNumber} keeps the vendored null statement`);
    const theme = String((seed.sourceData.control as { theme: unknown }).theme);
    byTheme.set(theme, (byTheme.get(theme) ?? 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(byTheme), { Organizational: 37, People: 8, Physical: 14, Technological: 34 });
});

test("ADMIN-05 D-46 a title changes only the name of a control its catalogue leaves untitled", async () => {
  const { catalogues, titles } = await library();
  const untitled = createControlSeeds(catalogues, new Map());
  const titled = createControlSeeds(catalogues, titles);
  assert.equal(titled.length, 2_646);
  assert.equal(untitled.length, titled.length);
  const titledFiles = new Set(["iso-iec-27001-2022-annex-a.json", "apra-cps-230-2026.json", CPS_234_FILE, "pspf-release-2026.json"]);
  titled.forEach((seed, index) => {
    const before = untitled[index];
    assert.equal(seed.controlNumber, before.controlNumber);
    if (!titledFiles.has(String(seed.sourceData.sourceFile))) {
      assert.deepEqual(seed, before, `${seed.controlNumber} is seeded exactly as before`);
      return;
    }
    if (seed.name !== before.name) {
      assert.equal(before.name, before.controlNumber, `${seed.controlNumber} was untitled before`);
    }
    assert.deepEqual({ ...seed, name: "" }, { ...before, name: "" }, `${seed.controlNumber} changes only its name`);
  });
});

/* The seed refuses a malformed title file, naming the file and the control (D-46, T-10-61). */

function validTitleFile() {
  return {
    description: "Titles for seeded controls whose catalogue gives none (D-46).",
    sources: { [ISO_FILE]: { basis: "framework", note: "The standard's control names; no control text." } },
    titles: { [ISO_FILE]: { "5.1": "Policies for information security" } } as Record<string, Record<string, unknown>>,
  };
}

async function parse(file: unknown): Promise<Map<string, string>> {
  const { catalogues } = await library();
  return parseControlTitles(TITLE_FILE, typeof file === "string" ? file : JSON.stringify(file), catalogues);
}

test("ADMIN-05 D-46 a well-formed title file gives each control its title", async () => {
  assert.deepEqual([...(await parse(validTitleFile())).entries()], [["5.1", "Policies for information security"]]);
  for (const title of ["Abc", "A".repeat(100)]) {
    const file = validTitleFile();
    file.titles[ISO_FILE] = { "5.1": title };
    assert.equal((await parse(file)).get("5.1"), title, `a title of ${title.length} characters is accepted`);
  }
});

test("ADMIN-05 D-46 the seed refuses a title file that is not a JSON object", async () => {
  for (const source of ["[]", "not json", "null"]) {
    await assert.rejects(parse(source), /csrm-control-titles\.json/);
  }
});

test("ADMIN-05 D-46 the seed refuses a title file for an unknown catalogue", async () => {
  const file = validTitleFile() as ReturnType<typeof validTitleFile> & { sources: Record<string, unknown> };
  file.sources["unknown-catalogue.json"] = { basis: "descriptive", note: "Not a vendored catalogue." };
  file.titles["unknown-catalogue.json"] = { "X-1": "Unknown requirement" };
  await assert.rejects(parse(file), (error: Error) => /csrm-control-titles\.json/.test(error.message) && /unknown-catalogue\.json/.test(error.message));
});

test("ADMIN-05 D-46 the seed refuses sources and titles that list different catalogues", async () => {
  const file = validTitleFile() as ReturnType<typeof validTitleFile> & { sources: Record<string, unknown> };
  file.sources[CPS_234_FILE] = { basis: "descriptive", note: "CSRM's words." };
  await assert.rejects(parse(file), (error: Error) => /csrm-control-titles\.json/.test(error.message) && /apra-cps-234-2019\.json/.test(error.message));
  const missingSource = validTitleFile();
  missingSource.titles[CPS_234_FILE] = { "CPS-234-15": "Information security policy framework" };
  await assert.rejects(parse(missingSource), (error: Error) => /csrm-control-titles\.json/.test(error.message) && /apra-cps-234-2019\.json/.test(error.message));
});

test("ADMIN-05 D-46 the seed refuses a source basis other than framework or descriptive", async () => {
  const file = validTitleFile() as ReturnType<typeof validTitleFile> & { sources: Record<string, { basis: string; note: string }> };
  file.sources[ISO_FILE] = { basis: "official", note: "Unknown basis." };
  await assert.rejects(parse(file), (error: Error) => /csrm-control-titles\.json/.test(error.message) && error.message.includes(ISO_FILE) && /basis/.test(error.message));
});

test("ADMIN-05 D-46 the seed refuses a control its catalogue does not hold", async () => {
  const file = validTitleFile();
  file.titles[ISO_FILE] = { "5.99": "Imaginary control" };
  await assert.rejects(parse(file), (error: Error) => /csrm-control-titles\.json/.test(error.message) && error.message.includes(ISO_FILE) && /5\.99/.test(error.message));
});

test("ADMIN-05 D-46 the seed refuses a title for a control its catalogue already labels", async () => {
  const file = validTitleFile() as ReturnType<typeof validTitleFile> & { sources: Record<string, unknown> };
  file.sources[PRIVACY_FILE] = { basis: "descriptive", note: "CSRM's words." };
  file.titles[PRIVACY_FILE] = { "APP-11": "Securing personal information" };
  await assert.rejects(parse(file), (error: Error) => /csrm-control-titles\.json/.test(error.message) && error.message.includes(PRIVACY_FILE) && /APP-11/.test(error.message));
});

test("ADMIN-05 D-46 the seed refuses a title outside the form rules", async () => {
  const malformed: Array<[string, unknown]> = [
    ["two characters", "Ab"],
    ["101 characters", "A".repeat(101)],
    ["an em dash", "Policies — information security"],
    ["an en dash", "Policies – information security"],
    ["a line break", "Policies for\ninformation security"],
    ["a carriage return", "Policies for\rinformation security"],
    ["a trailing full stop", "Policies for information security."],
    ["its own control id", "5.1 Policies for information security"],
    ["untrimmed text", " Policies for information security"],
    ["a value that is not a string", 51],
  ];
  for (const [rule, title] of malformed) {
    const file = validTitleFile();
    file.titles[ISO_FILE] = { "5.1": title };
    await assert.rejects(
      parse(file),
      (error: Error) => /csrm-control-titles\.json/.test(error.message) && error.message.includes(ISO_FILE) && /\b5\.1\b/.test(error.message),
      `a title with ${rule} is refused`,
    );
  }
});
